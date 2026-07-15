import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Route as RouteIcon, MapPin, Flag, Plus, Trash2, RefreshCw, AlertCircle,
  Link2, Copy, Check, Navigation, X, Clock, Loader2, CheckCircle2,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { trips as tripsApi, tracking, geo } from '../services/api';
import { PlaceSearchInput } from '../components/PlaceSearchInput';
import { Topbar } from '../components/Topbar';
import { useNavigate } from 'react-router-dom';
import truckPng from '../assets/truck-icon.png';

const POLL_MS = 5000;
const INDIA_CENTER = [22.9868, 72.61];

const STATUS_COLOR = { moving: '#22c55e', idle: '#f59e0b', offline: '#64748b' };

const timeAgo = (iso) => {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
};

// Metres between two [lat, lng] points (haversine). Used to tell when the live
// vehicle has reached the destination.
const distanceMeters = (a, b) => {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

// The vehicle counts as "arrived" once it's within this many metres of the To
// point. 200 m absorbs normal GPS drift without triggering early.
const ARRIVAL_RADIUS_M = 200;

// Short first segment of a place name ("Mumbai, Maharashtra, India" → "Mumbai").
const shortPlace = (name = '') => name.split(',')[0].trim();

// Reuse the dashboard truck marker (upright 3D render, status ring).
const truckIcon = (status) => {
  const size = 40;
  const ring = STATUS_COLOR[status] || STATUS_COLOR.offline;
  const box = size + 14;
  return L.divIcon({
    className: '',
    iconSize: [box, box],
    iconAnchor: [box / 2, box / 2],
    popupAnchor: [0, -box / 2],
    html: `
      <div style="position:relative;width:${box}px;height:${box}px;">
        <div style="position:absolute;inset:5px;border-radius:50%;
          background:${ring}22;border:2px solid ${ring};"></div>
        <img src="${truckPng}" alt="" style="position:absolute;top:50%;left:50%;
          width:${size * 0.72}px;height:auto;transform:translate(-50%,-50%);
          filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))
            ${status === 'offline' ? ' grayscale(1) opacity(.55)' : ''};"/>
      </div>`,
  });
};

// A simple round pin for the From / To endpoints.
const pinIcon = (color, letter) =>
  L.divIcon({
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
    html: `
      <div style="position:relative;width:26px;height:26px;">
        <div style="position:absolute;left:50%;top:0;transform:translateX(-50%);
          width:22px;height:22px;border-radius:50% 50% 50% 0;
          background:${color};transform:translateX(-50%) rotate(-45deg);
          border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);"></div>
        <span style="position:absolute;left:50%;top:3px;transform:translateX(-50%);
          color:#fff;font:700 11px sans-serif;">${letter}</span>
      </div>`,
  });

// Fit the map to show the whole route (or fly to the vehicle if no route).
function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points && points.length >= 2) {
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
    } else if (points && points.length === 1) {
      map.flyTo(points[0], 14, { duration: 0.8 });
    }
  }, [points, map]);
  return null;
}

// Leaflet measures its container once, at mount. Inside this flex layout the
// container often isn't at full width yet, so only a narrow strip of tiles loads.
// Force a re-measure after the first paint, and again whenever the window
// resizes, so the map always fills its box.
function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize();
    // A double rAF lets the flex layout settle before we re-measure.
    const raf = requestAnimationFrame(() => requestAnimationFrame(fix));
    const t = setTimeout(fix, 300);
    window.addEventListener('resize', fix);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      window.removeEventListener('resize', fix);
    };
  }, [map]);
  return null;
}

export function TripRoutes() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [trips, setTrips] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [share, setShare] = useState(null);
  const [copied, setCopied] = useState(false);

  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  // Trip ids we've already fired an arrival update for, so we PATCH the server
  // only once per arrival even though the check runs on every 5s poll.
  const arrivedFiredRef = useRef(new Set());

  // Poll devices (for live vehicle position) and load trips.
  const load = async () => {
    try {
      const [dRes, tRes] = await Promise.all([tracking.getDevices(), tripsApi.list()]);
      setDevices(dRes.devices || []);
      setTrips(tRes.trips || []);
      setError(null);
      if (!selectedRef.current && tRes.trips?.length) {
        setSelectedId(tRes.trips[0].id || tRes.trips[0]._id);
      }
    } catch (err) {
      setError(err.message || 'Could not load trips');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  const selected = useMemo(
    () => trips.find((t) => (t.id || t._id) === selectedId) || null,
    [trips, selectedId]
  );

  // Live position comes from the fresh devices poll, not the trip's snapshot.
  const liveDevice = useMemo(() => {
    if (!selected?.device) return null;
    const devId = selected.device._id || selected.device.id || selected.device;
    return devices.find((d) => (d._id || d.id) === String(devId)) || null;
  }, [selected, devices]);

  const livePos = liveDevice?.lastPosition?.latitude
    ? [liveDevice.lastPosition.latitude, liveDevice.lastPosition.longitude]
    : null;

  const routePoints = selected?.routePolyline?.length
    ? selected.routePolyline
    : selected
      ? [[selected.origin.lat, selected.origin.lng], [selected.destination.lat, selected.destination.lng]]
      : null;

  // What FitBounds should frame: the route, plus the live vehicle if present.
  const framePoints = useMemo(() => {
    if (!routePoints) return livePos ? [livePos] : null;
    return livePos ? [...routePoints, livePos] : routePoints;
  }, [routePoints, livePos]);

  // Arrival detection: on every poll, any still-running trip whose vehicle is
  // within ARRIVAL_RADIUS_M of its destination flips to 'completed'. We update
  // local state immediately (so the badge shows at once) and PATCH the server
  // once, guarded by arrivedFiredRef so a slow request can't fire twice.
  useEffect(() => {
    if (!trips.length || !devices.length) return;

    const arrived = [];
    for (const t of trips) {
      const id = t.id || t._id;
      if (t.status === 'completed' || arrivedFiredRef.current.has(id)) continue;

      const devId = String(t.device?._id || t.device?.id || t.device);
      const dev = devices.find((d) => (d._id || d.id) === devId);
      const pos = dev?.lastPosition;
      if (!pos?.latitude) continue;

      const d = distanceMeters(
        [pos.latitude, pos.longitude],
        [t.destination.lat, t.destination.lng]
      );
      if (d <= ARRIVAL_RADIUS_M) arrived.push(id);
    }

    if (!arrived.length) return;

    arrived.forEach((id) => arrivedFiredRef.current.add(id));
    setTrips((prev) =>
      prev.map((t) =>
        arrived.includes(t.id || t._id) ? { ...t, status: 'completed' } : t
      )
    );
    arrived.forEach((id) => {
      tripsApi.update(id, { status: 'completed' }).catch(() => {
        // Roll back the guard so a failed PATCH can be retried next poll.
        arrivedFiredRef.current.delete(id);
      });
    });
  }, [trips, devices]);

  const removeTrip = async (trip, e) => {
    e.stopPropagation();
    if (!confirm('Delete this trip route?')) return;
    const id = trip.id || trip._id;
    try {
      await tripsApi.remove(id);
      setTrips((prev) => prev.filter((t) => (t.id || t._id) !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      setError(err.message || 'Could not delete trip');
    }
  };

  // Share the selected trip's device as a live public link (reuses the token API).
  const createLink = async () => {
    if (!selected?.device) return;
    setShare({ loading: true });
    try {
      const devId = selected.device._id || selected.device.id;
      const res = await tracking.createShareLink(
        devId, 120, `${shortPlace(selected.origin.name)} → ${shortPlace(selected.destination.name)}`
      );
      setShare({ url: res.url, expiresAt: res.expiresAt });
      setCopied(false);
    } catch (err) {
      setShare({ error: err.message || 'Could not create link' });
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(share.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar activeMenu="triproutes" onMenuChange={() => {}} />

      <main className="flex-1 overflow-hidden">
        <div className="flex h-full flex-col gap-4 p-4 lg:flex-row">
          {/* ---- trip list ---------------------------------------------- */}
          <aside className="flex w-full flex-col rounded-xl border border-slate-200 bg-white lg:w-96">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <RouteIcon className="h-5 w-5 text-sky-600" />
                Trip Routes
              </h2>
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-sky-700"
              >
                <Plus className="h-3.5 w-3.5" /> New trip
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading && (
                <p className="flex items-center gap-2 p-4 text-sm text-slate-500">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Loading trips…
                </p>
              )}

              {error && (
                <div className="m-4 flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {!loading && !error && trips.length === 0 && (
                <div className="p-4 text-sm text-slate-500">
                  <p className="font-medium text-slate-700">No trips yet.</p>
                  <p className="mt-1">
                    Hit <strong>New trip</strong>, pick a vehicle, and set a From and To
                    location. The route appears on the map with the live vehicle on it.
                  </p>
                </div>
              )}

              {trips.map((t) => {
                const id = t.id || t._id;
                return (
                  <div
                    key={id}
                    onClick={() => setSelectedId(id)}
                    className={`group cursor-pointer border-b border-slate-100 p-4 transition hover:bg-slate-50 ${
                      id === selectedId ? 'bg-sky-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {/* the one-line From → To summary */}
                        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-900">
                          <span className="truncate">{shortPlace(t.origin.name)}</span>
                          <Navigation className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                          <span className="truncate">{shortPlace(t.destination.name)}</span>
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 truncate text-xs text-slate-500">
                          <span>
                            {t.device?.name || 'Vehicle'}
                            {t.distanceKm ? ` · ${t.distanceKm} km` : ''}
                            {t.durationMin ? ` · ~${Math.round(t.durationMin / 60 * 10) / 10} h` : ''}
                          </span>
                          {t.status === 'completed' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
                              <CheckCircle2 className="h-3 w-3" /> Arrived
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={(e) => removeTrip(t, e)}
                        title="Delete trip"
                        className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ---- share the selected trip ------------------------------ */}
            {selected && (
              <div className="border-t border-slate-200 p-4">
                <button
                  onClick={createLink}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
                >
                  <Link2 className="h-4 w-4" /> Share this trip with client
                </button>
                {share?.error && <p className="mt-2 text-xs text-red-600">{share.error}</p>}
                {share?.url && (
                  <div className="mt-3 rounded-lg bg-slate-50 p-2">
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={share.url}
                        onFocus={(e) => e.target.select()}
                        className="min-w-0 flex-1 bg-transparent text-xs text-slate-600 outline-none"
                      />
                      <button onClick={copyLink} className="shrink-0 text-slate-500 hover:text-sky-600">
                        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Expires {new Date(share.expiresAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            )}
          </aside>

          {/* ---- map -------------------------------------------------- */}
          <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-xl border border-slate-200">
            <MapContainer center={INDIA_CENTER} zoom={6} className="h-full w-full">
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              <InvalidateSize />
              <FitBounds points={framePoints} />

              {selected && routePoints && (
                <Polyline positions={routePoints} pathOptions={{ color: '#0284c7', weight: 5, opacity: 0.8 }} />
              )}

              {selected && (
                <>
                  <Marker position={[selected.origin.lat, selected.origin.lng]} icon={pinIcon('#16a34a', 'A')}>
                    <Popup><strong>From:</strong> {selected.origin.name}</Popup>
                  </Marker>
                  <Marker position={[selected.destination.lat, selected.destination.lng]} icon={pinIcon('#dc2626', 'B')}>
                    <Popup><strong>To:</strong> {selected.destination.name}</Popup>
                  </Marker>
                </>
              )}

              {livePos && (
                <Marker position={livePos} icon={truckIcon(liveDevice.status)}>
                  <Popup>
                    <strong>{liveDevice.name}</strong><br />
                    {Math.round(liveDevice.lastPosition.speed || 0)} km/h · {timeAgo(liveDevice.lastSeenAt)}
                  </Popup>
                </Marker>
              )}
            </MapContainer>

            {/* one-line From → To banner over the map (or an arrival banner) */}
            {selected && (
              <div className="pointer-events-none absolute left-1/2 top-4 z-[1000] -translate-x-1/2">
                {selected.status === 'completed' ? (
                  <div className="flex items-center gap-2 rounded-full bg-green-600/95 px-4 py-2 text-sm text-white shadow-md backdrop-blur-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-medium">Arrived at {shortPlace(selected.destination.name)}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm shadow-md backdrop-blur-sm">
                    <MapPin className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-slate-900">{shortPlace(selected.origin.name)}</span>
                    <Navigation className="h-4 w-4 text-sky-500" />
                    <Flag className="h-4 w-4 text-red-600" />
                    <span className="font-medium text-slate-900">{shortPlace(selected.destination.name)}</span>
                    {selected.distanceKm ? (
                      <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {selected.distanceKm} km
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {creating && (
        <NewTripModal
          devices={devices}
          onClose={() => setCreating(false)}
          onCreated={(trip) => {
            setTrips((prev) => [trip, ...prev]);
            setSelectedId(trip.id || trip._id);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create-trip dialog: pick a device, a From and a To, compute the road route,
// then save. Routing is best-effort — if OSRM is unreachable we still save the
// trip and fall back to a straight line on the map.
// ---------------------------------------------------------------------------
function NewTripModal({ devices, onClose, onCreated }) {
  const [deviceId, setDeviceId] = useState(devices[0]?._id || devices[0]?.id || '');
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [route, setRoute] = useState(null);       // { polyline, distanceKm, durationMin }
  const [routing, setRouting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Recompute the road route whenever both endpoints are set.
  useEffect(() => {
    if (!origin || !destination) {
      setRoute(null);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setRouting(true);
    setError(null);
    geo.getRoute(origin, destination, { signal: controller.signal })
      .then((r) => { if (!cancelled) setRoute(r); })
      .catch((err) => {
        if (err.name !== 'AbortError' && !cancelled) {
          setRoute(null); // saving still allowed; map falls back to a straight line
        }
      })
      .finally(() => { if (!cancelled) setRouting(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [origin, destination]);

  const canSubmit = deviceId && origin && destination && !busy && !routing;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await tripsApi.create({ deviceId, origin, destination, route });
      onCreated(res.trip);
    } catch (err) {
      setError(err.message || 'Could not create trip');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900">New trip route</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Vehicle</label>
            {devices.length === 0 ? (
              <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                No vehicles yet. Add one under Live Tracking first.
              </p>
            ) : (
              <select
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              >
                {devices.map((d) => (
                  <option key={d._id || d.id} value={d._id || d.id}>{d.name}</option>
                ))}
              </select>
            )}
          </div>

          <PlaceSearchInput
            label="From"
            placeholder="Start location, e.g. Mumbai"
            value={origin}
            onSelect={setOrigin}
            icon={MapPin}
          />
          <PlaceSearchInput
            label="To"
            placeholder="Destination, e.g. Pune"
            value={destination}
            onSelect={setDestination}
            icon={Flag}
          />

          {/* route summary */}
          {origin && destination && (
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              {routing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculating road route…
                </span>
              ) : route ? (
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><Navigation className="h-3.5 w-3.5 text-sky-500" /> {route.distanceKm} km</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> ~{Math.round(route.durationMin / 60 * 10) / 10} h</span>
                </span>
              ) : (
                <span>Route service unavailable — a straight line will be shown.</span>
              )}
            </div>
          )}

          {error && (
            <div className="flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RouteIcon className="h-4 w-4" />}
            {busy ? 'Saving…' : 'Create trip'}
          </button>
        </form>
      </div>
    </div>
  );
}
