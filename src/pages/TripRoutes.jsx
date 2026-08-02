import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Route as RouteIcon, MapPin, Flag, Plus, Trash2, RefreshCw, AlertCircle,
  Link2, Copy, Check, Navigation, X, Clock, Loader2, CheckCircle2,
  Play, Square,
} from 'lucide-react';
import { trips as tripsApi, tracking, geo } from '../services/api';
import { PlaceSearchInput } from '../components/PlaceSearchInput';
import { Topbar } from '../components/Topbar';
import { GoogleFleetMap } from '../components/GoogleFleetMap';
import { useNavigate } from 'react-router-dom';

const POLL_MS = 5000;

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

// Normalize polyline coordinates (handles both 2D [[lat,lng],...] and flattened 1D [lat1,lng1,lat2,lng2,...] arrays)
const normalizePolyline = (raw) => {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  if (typeof raw[0] === 'number') {
    const pairs = [];
    for (let i = 0; i < raw.length - 1; i += 2) {
      if (Number.isFinite(Number(raw[i])) && Number.isFinite(Number(raw[i + 1]))) {
        pairs.push([Number(raw[i]), Number(raw[i + 1])]);
      }
    }
    return pairs.length > 1 ? pairs : null;
  }
  if (Array.isArray(raw[0])) {
    const valid = raw.filter(
      (p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]))
    ).map((p) => [Number(p[0]), Number(p[1])]);
    return valid.length > 1 ? valid : null;
  }
  return null;
};

// Format a stop's duration from milliseconds (e.g. 8m or 2h 14m). Stops are
// reported in whole minutes — second-level precision on a parking spell reads
// as false accuracy given GPS reports every few seconds.
const formatStopDuration = (ms) => {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

// Clock time of a stop, e.g. "2:45 PM".
const formatClock = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// Format planned duration in minutes/hours (e.g., 12 min or 1h 15m)
const formatDurationMin = (mins) => {
  if (!mins || mins <= 0) return '';
  const totalMins = Math.round(mins);
  if (totalMins < 60) return `~${totalMins} min`;
  const hrs = Math.floor(totalMins / 60);
  const remMins = totalMins % 60;
  return remMins > 0 ? `~${hrs}h ${remMins}m` : `~${hrs}h`;
};

export function TripRoutes() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [trips, setTrips] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [share, setShare] = useState(null);
  const [copied, setCopied] = useState(false);

  // Trip creation state
  const [creating, setCreating] = useState(false);
  const [createDeviceId, setCreateDeviceId] = useState('');
  const [createOrigin, setCreateOrigin] = useState(null);
  const [createDestination, setCreateDestination] = useState(null);
  const [createRoute, setCreateRoute] = useState(null);
  const [routing, setRouting] = useState(false);
  const [pickingTarget, setPickingTarget] = useState(null); // 'origin' | 'destination' | null
  const [geocodingPick, setGeocodingPick] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState(null);

  // The actual driven path for the selected trip, as [[lat, lng], ...]. Loaded
  // per trip and refreshed on the poll while the trip is still running, so the
  // amber trail grows behind the vehicle as it moves.
  const [trail, setTrail] = useState([]);
  const [showTrail, setShowTrail] = useState(true);

  // Places the vehicle stood still during the selected trip, with how long it
  // sat at each. Detected server-side from the same GPS fixes as the trail.
  const [stops, setStops] = useState([]);
  const [showStops, setShowStops] = useState(true);

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

  useEffect(() => {
    if (!createDeviceId && devices.length > 0) {
      setCreateDeviceId(devices[0]._id || devices[0].id || '');
    }
  }, [devices, createDeviceId]);

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

  // Load the driven path whenever the selection changes, then keep it current
  // while the trip is active.
  const [trailMeta, setTrailMeta] = useState(null);

  const selectedStatus = selected?.status;
  useEffect(() => {
    if (!selectedId) {
      setTrail([]);
      setStops([]);
      setTrailMeta(null);
      return;
    }
    let cancelled = false;

    const fetchTrail = async () => {
      try {
        const res = await tripsApi.getTrail(selectedId);
        if (!cancelled) {
          setTrail(res.trail || []);
          setStops(res.stops || []);
          setTrailMeta({ startedAt: res.startedAt, endedAt: res.endedAt });
        }
      } catch {
        if (!cancelled) {
          setTrail([]);
          setStops([]);
          setTrailMeta(null);
        }
      }
    };

    setTrail([]);
    setStops([]);
    setTrailMeta(null);
    fetchTrail();

    if (selectedStatus === 'completed') return () => { cancelled = true; };

    const timer = setInterval(fetchTrail, POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [selectedId, selectedStatus]);

  // Actual driven distance (haversine sum along GPS trail points)
  const actualDistanceKm = useMemo(() => {
    if (!trail || trail.length < 2) return null;
    let meters = 0;
    for (let i = 1; i < trail.length; i++) {
      meters += distanceMeters(trail[i - 1], trail[i]);
    }
    return Math.round((meters / 1000) * 10) / 10;
  }, [trail]);

  // Actual driven time duration (from start time to completion or live time)
  const actualDurationFormatted = useMemo(() => {
    if (!trail || trail.length < 2) return null;
    // Measured from the start click only — never from createdAt, which would
    // count the hours a trip sat planned as though they were time on the road.
    const startIso = selected?.startedAt || trailMeta?.startedAt;
    if (!startIso) return null;
    const startMs = new Date(startIso).getTime();
    const endIso = selected?.completedAt || trailMeta?.endedAt;
    const endMs = endIso ? new Date(endIso).getTime() : Date.now();
    const diffMins = Math.max(1, Math.round((endMs - startMs) / 60000));
    if (diffMins < 60) return `${diffMins} min`;
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return `${h}h ${m}m`;
  }, [trail, trailMeta, selected]);

  // Cache for dynamic route polylines fetched on trips missing stored routePolyline.
  // Keyed by trip ID so each missing trip is fetched ONCE and never re-fetched on 5s poll ticks.
  const [routeCache, setRouteCache] = useState({});

  useEffect(() => {
    if (!selectedId || !selected) return;

    const existing = normalizePolyline(selected?.routePolyline);
    if (existing) return;

    if (routeCache[selectedId]) return;

    if (!selected.origin?.lat || !selected.destination?.lat) return;

    let cancelled = false;
    geo.getRoute(selected.origin, selected.destination)
      .then((r) => {
        if (!cancelled && r?.polyline?.length) {
          setRouteCache((prev) => ({ ...prev, [selectedId]: r.polyline }));
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [
    selectedId,
    selected?.origin?.lat,
    selected?.origin?.lng,
    selected?.destination?.lat,
    selected?.destination?.lng,
    selected?.routePolyline,
    routeCache,
  ]);

  const routePoints = useMemo(() => {
    const fromSelected = normalizePolyline(selected?.routePolyline);
    if (fromSelected) return fromSelected;
    const fromCache = normalizePolyline(routeCache[selectedId]);
    if (fromCache) return fromCache;
    return null;
  }, [selected?.routePolyline, routeCache, selectedId]);

  const visibleTrail = showTrail ? trail : [];
  const visibleStops = showStops ? stops : [];

  // Total time parked across the trip — the single number that explains a gap
  // between planned and actual duration.
  const totalIdleMs = useMemo(
    () => stops.reduce((sum, s) => sum + (s.durationMs || 0), 0),
    [stops]
  );

  const framePoints = useMemo(() => {
    if (creating) {
      const pts = [];
      if (createOrigin) pts.push([createOrigin.lat, createOrigin.lng]);
      if (createDestination) pts.push([createDestination.lat, createDestination.lng]);
      if (!pts.length) return null;
      return pts.map(([lat, lng]) => ({ lat, lng }));
    }
    const pts = routePoints ? [...routePoints] : [];
    if (livePos) pts.push(livePos);
    if (!pts.length) return null;
    return pts.map(([lat, lng]) => ({ lat, lng }));
  }, [creating, createOrigin, createDestination, routePoints, livePos]);

  // The selected trip's route or creation preview route
  const mapRoute = useMemo(() => {
    if (creating) {
      return {
        polyline: createRoute?.polyline || null,
        origin: createOrigin ? { lat: createOrigin.lat, lng: createOrigin.lng } : null,
        originName: createOrigin?.name || 'From',
        destination: createDestination ? { lat: createDestination.lat, lng: createDestination.lng } : null,
        destinationName: createDestination?.name || 'To',
      };
    }
    if (!selected) return null;
    return {
      polyline: routePoints,
      actualPath: visibleTrail,
      stops: visibleStops,
      origin: { lat: selected.origin.lat, lng: selected.origin.lng },
      originName: selected.origin.name,
      destination: { lat: selected.destination.lat, lng: selected.destination.lng },
      destinationName: selected.destination.name,
    };
  }, [creating, createRoute, createOrigin, createDestination, selected, routePoints, visibleTrail, visibleStops]);

  // Recompute the road route whenever both endpoints are set during creation.
  useEffect(() => {
    if (!creating || !createOrigin || !createDestination) {
      setCreateRoute(null);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setRouting(true);
    setCreateError(null);
    geo.getRoute(createOrigin, createDestination, { signal: controller.signal })
      .then((r) => { if (!cancelled) setCreateRoute(r); })
      .catch((err) => {
        if (err.name !== 'AbortError' && !cancelled) {
          setCreateRoute(null);
        }
      })
      .finally(() => { if (!cancelled) setRouting(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [creating, createOrigin, createDestination]);

  const handleStartCreate = () => {
    setCreating(true);
    setCreateDeviceId(devices[0]?._id || devices[0]?.id || '');
    setCreateOrigin(null);
    setCreateDestination(null);
    setCreateRoute(null);
    setPickingTarget('origin');
    setCreateError(null);
  };

  const handleCancelCreate = () => {
    setCreating(false);
    setPickingTarget(null);
    setCreateError(null);
  };

  const handleMapClick = async ({ lat, lng }) => {
    if (!creating) return;

    let target = pickingTarget;
    if (!target) {
      if (!createOrigin) target = 'origin';
      else if (!createDestination) target = 'destination';
      else target = 'destination';
    }

    setGeocodingPick(true);
    setCreateError(null);
    try {
      const place = await geo.reverseGeocode({ lat, lng });
      if (target === 'origin') {
        setCreateOrigin(place);
        if (!createDestination) {
          setPickingTarget('destination');
        } else {
          setPickingTarget(null);
        }
      } else {
        setCreateDestination(place);
        setPickingTarget(null);
      }
    } catch (err) {
      setCreateError(err.message || 'Could not resolve address for clicked position');
    } finally {
      setGeocodingPick(false);
    }
  };

  const handleUseVehicleLocation = async () => {
    const dev = devices.find((d) => (d._id || d.id) === createDeviceId);
    if (!dev) {
      throw new Error('Please select a vehicle first.');
    }
    const pos = dev.lastPosition;
    if (!pos?.latitude || !pos?.longitude) {
      throw new Error(`No GPS location recorded for ${dev.name || 'this vehicle'} yet.`);
    }
    const coords = { lat: pos.latitude, lng: pos.longitude };
    const place = await geo.reverseGeocode(coords);
    return place;
  };

  const canSubmitCreate = createDeviceId && createOrigin && createDestination && !createBusy && !routing;

  const submitNewTrip = async (e) => {
    e.preventDefault();
    if (!canSubmitCreate) return;
    setCreateBusy(true);
    setCreateError(null);
    try {
      const res = await tripsApi.create({
        deviceId: createDeviceId,
        origin: createOrigin,
        destination: createDestination,
        routePolyline: createRoute?.polyline,
        distanceKm: createRoute?.distanceKm,
        durationMin: createRoute?.durationMin,
        route: createRoute,
      });
      setTrips((prev) => [res.trip, ...prev]);
      setSelectedId(res.trip.id || res.trip._id);
      setCreating(false);
      setPickingTarget(null);
    } catch (err) {
      setCreateError(err.message || 'Could not create trip');
    } finally {
      setCreateBusy(false);
    }
  };

  // Arrival detection
  useEffect(() => {
    if (!trips.length || !devices.length) return;

    const arrived = [];
    for (const t of trips) {
      const id = t.id || t._id;
      if (t.status === 'completed' || t.status === 'planned' || arrivedFiredRef.current.has(id)) continue;

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

  const startTrip = async (trip, e) => {
    e.stopPropagation();
    const id = trip.id || trip._id;
    try {
      const res = await tripsApi.update(id, { status: 'active' });
      setTrips((prev) =>
        prev.map((t) => ((t.id || t._id) === id ? { ...t, ...res.trip } : t))
      );
    } catch (err) {
      setError(err.message || 'Could not start trip');
    }
  };

  const endTrip = async (trip, e) => {
    e.stopPropagation();
    const id = trip.id || trip._id;
    try {
      const res = await tripsApi.update(id, { status: 'completed' });
      setTrips((prev) =>
        prev.map((t) => ((t.id || t._id) === id ? { ...t, ...res.trip } : t))
      );
      arrivedFiredRef.current.add(id);
    } catch (err) {
      setError(err.message || 'Could not end trip');
    }
  };

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
          {/* ---- left sidebar: trip list or trip creation ---------------- */}
          <aside className="flex w-full flex-col rounded-xl border border-slate-200 bg-white lg:w-96">
            {creating ? (
              /* ---- New Trip Form ---- */
              <>
                <div className="flex items-center justify-between border-b border-slate-200 p-4">
                  <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                    <RouteIcon className="h-5 w-5 text-sky-600" />
                    New Trip Route
                  </h2>
                  <button
                    onClick={handleCancelCreate}
                    className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" /> Cancel
                  </button>
                </div>

                <form onSubmit={submitNewTrip} className="flex-1 overflow-y-auto space-y-4 p-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Vehicle</label>
                    {devices.length === 0 ? (
                      <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                        No vehicles yet. Add one under Live Tracking first.
                      </p>
                    ) : (
                      <select
                        value={createDeviceId}
                        onChange={(e) => setCreateDeviceId(e.target.value)}
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
                    value={createOrigin}
                    onSelect={setCreateOrigin}
                    icon={MapPin}
                    allowCurrentLocation
                    onUseCurrentLocation={handleUseVehicleLocation}
                    allowMapPick
                    onPickOnMap={() => setPickingTarget(pickingTarget === 'origin' ? null : 'origin')}
                    isPickingOnMap={pickingTarget === 'origin'}
                  />

                  <PlaceSearchInput
                    label="To"
                    placeholder="Destination, e.g. Pune"
                    value={createDestination}
                    onSelect={setCreateDestination}
                    icon={Flag}
                    allowMapPick
                    onPickOnMap={() => setPickingTarget(pickingTarget === 'destination' ? null : 'destination')}
                    isPickingOnMap={pickingTarget === 'destination'}
                  />

                  <p className="flex items-start gap-1.5 rounded-lg border border-sky-100 bg-sky-50 p-2.5 text-xs text-slate-600">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                    <span>
                      Tip: Click <strong>Pick on map</strong> or click anywhere directly on the map to choose From and To locations.
                    </span>
                  </p>

                  {/* route summary */}
                  {createOrigin && createDestination && (
                    <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                      {routing ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculating road route…
                        </span>
                      ) : createRoute ? (
                        <span className="flex items-center gap-3 font-medium text-slate-700">
                          <span className="flex items-center gap-1"><Navigation className="h-3.5 w-3.5 text-sky-500" /> {createRoute.distanceKm} km</span>
                          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatDurationMin(createRoute.durationMin)}</span>
                        </span>
                      ) : (
                        <span>Route service unavailable.</span>
                      )}
                    </div>
                  )}

                  {createError && (
                    <div className="flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{createError}</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleCancelCreate}
                      className="w-1/3 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!canSubmitCreate}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {createBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RouteIcon className="h-4 w-4" />}
                      {createBusy ? 'Saving…' : 'Create trip'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              /* ---- Trip List ---- */
              <>
                <div className="flex items-center justify-between border-b border-slate-200 p-4">
                  <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                    <RouteIcon className="h-5 w-5 text-sky-600" />
                    Trip Routes
                  </h2>
                  <button
                    onClick={handleStartCreate}
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
                        Hit <strong>New trip</strong>, pick a vehicle, and select From and To locations directly from the map or search bar.
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
                            <p className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-900">
                              <span className="truncate">{shortPlace(t.origin.name)}</span>
                              <Navigation className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                              <span className="truncate">{shortPlace(t.destination.name)}</span>
                            </p>
                            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 truncate text-xs text-slate-500">
                              <span>
                                {t.device?.name || 'Vehicle'}
                                {t.distanceKm ? ` · ${t.distanceKm} km` : ''}
                                {t.durationMin ? ` · ${formatDurationMin(t.durationMin)}` : ''}
                              </span>
                              {id === selectedId && actualDistanceKm != null && (
                                <span className="font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[11px] border border-amber-200">
                                  Driven: {actualDistanceKm} km {actualDurationFormatted ? `(${actualDurationFormatted})` : ''}
                                </span>
                              )}
                              {t.status === 'planned' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                                  <Clock className="h-3 w-3" /> Planned
                                </span>
                              )}
                              {t.status === 'active' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                  <Navigation className="h-3 w-3" /> In Transit
                                </span>
                              )}
                              {t.status === 'completed' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
                                  <CheckCircle2 className="h-3 w-3" /> Arrived
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {t.status === 'planned' && (() => {
                              const deviceId = t.device?._id || t.device?.id || t.device;
                              const hasActiveTrip = trips.some(
                                (other) =>
                                  (other.device?._id || other.device?.id || other.device) === deviceId &&
                                  other.status === 'active'
                              );
                              return (
                                <button
                                  onClick={(e) => !hasActiveTrip && startTrip(t, e)}
                                  disabled={hasActiveTrip}
                                  title={hasActiveTrip ? "Complete current active trip on this device before starting a new one" : "Start trip"}
                                  className={`rounded p-1 transition ${
                                    hasActiveTrip
                                      ? 'cursor-not-allowed text-slate-300'
                                      : 'text-green-600 hover:bg-green-50 hover:text-green-700'
                                  }`}
                                >
                                  <Play className="h-4 w-4" />
                                </button>
                              );
                            })()}
                            {t.status === 'active' && (
                              <button
                                onClick={(e) => endTrip(t, e)}
                                title="End trip"
                                className="rounded p-1 text-red-500 transition hover:bg-red-50 hover:text-red-600"
                              >
                                <Square className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={(e) => removeTrip(t, e)}
                              title="Delete trip"
                              className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Stops along the selected trip. This is what explains a run
                    planned for minutes that took hours — each entry is a place
                    the vehicle sat, with how long it sat there. */}
                {selected && stops.length > 0 && (
                  <div className="border-t border-slate-200">
                    <div className="flex items-center justify-between px-4 pt-3 pb-2">
                      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        <Clock className="h-4 w-4 text-amber-600" />
                        Stops ({stops.length})
                      </h3>
                      <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        {formatStopDuration(totalIdleMs)} idle
                      </span>
                    </div>

                    <ul className="max-h-56 overflow-y-auto px-4 pb-3">
                      {stops.map((s, i) => (
                        <li
                          key={`${s.startedAt}-${i}`}
                          className="flex gap-2.5 border-b border-slate-100 py-2 last:border-b-0"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-slate-800" title={s.address}>
                              {s.address || `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {formatClock(s.startedAt)} – {formatClock(s.endedAt)}
                              <span className="ml-1.5 font-semibold text-amber-700">
                                {formatStopDuration(s.durationMs)}
                              </span>
                              {/* The tracker went quiet rather than reporting
                                  from a standstill, so the duration is bounded
                                  by the silence, not watched throughout. */}
                              {s.inferred && (
                                <span
                                  className="ml-1.5 text-slate-400"
                                  title="No GPS reports during this period — duration inferred from the gap between fixes"
                                >
                                  · no signal
                                </span>
                              )}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

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
              </>
            )}
          </aside>

          {/* ---- map -------------------------------------------------- */}
          <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-xl border border-slate-200">
            <GoogleFleetMap
              devices={creating ? devices : (liveDevice ? [liveDevice] : [])}
              selectedId={selectedId}
              route={mapRoute}
              fitTo={framePoints}
              onClick={creating ? handleMapClick : undefined}
              pickingMode={Boolean(creating && pickingTarget)}
            />

            {/* creation prompt or trip status banner over map */}
            {creating ? (
              <div className="pointer-events-none absolute left-1/2 top-4 z-[1000] -translate-x-1/2">
                {geocodingPick ? (
                  <div className="flex items-center gap-2 rounded-full bg-slate-900/90 px-4 py-2 text-sm text-white shadow-md backdrop-blur-sm animate-pulse">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="font-medium">Finding location address…</span>
                  </div>
                ) : pickingTarget === 'origin' ? (
                  <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm text-white shadow-lg backdrop-blur-sm animate-pulse">
                    <MapPin className="h-4 w-4" />
                    <span className="font-medium">Click on map to select "From" location</span>
                    <button onClick={() => setPickingTarget(null)} className="ml-1 rounded-full p-0.5 hover:bg-emerald-700">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : pickingTarget === 'destination' ? (
                  <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm text-white shadow-lg backdrop-blur-sm animate-pulse">
                    <Flag className="h-4 w-4" />
                    <span className="font-medium">Click on map to select "To" location</span>
                    <button onClick={() => setPickingTarget(null)} className="ml-1 rounded-full p-0.5 hover:bg-rose-700">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : createOrigin || createDestination ? (
                  <div className="flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm shadow-md backdrop-blur-sm">
                    {createOrigin ? (
                      <>
                        <MapPin className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-slate-900">{shortPlace(createOrigin.name)}</span>
                      </>
                    ) : (
                      <span className="text-slate-400">Set From</span>
                    )}
                    <Navigation className="h-4 w-4 text-sky-500" />
                    {createDestination ? (
                      <>
                        <Flag className="h-4 w-4 text-red-600" />
                        <span className="font-medium text-slate-900">{shortPlace(createDestination.name)}</span>
                      </>
                    ) : (
                      <span className="text-slate-400">Set To</span>
                    )}
                    {createRoute?.distanceKm ? (
                      <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {createRoute.distanceKm} km
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Legend for the two lines with actual driven path stats */}
            {!creating && selected && (
              <div className="absolute bottom-4 left-4 z-[1000] rounded-xl bg-white/95 p-3.5 text-xs shadow-lg backdrop-blur-sm border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-6 shrink-0 rounded-full bg-sky-600" />
                    <span className="font-semibold text-slate-800">Planned route</span>
                  </div>
                  {(selected.distanceKm || selected.durationMin) && (
                    <span className="font-medium text-slate-500">
                      {selected.distanceKm ? `${selected.distanceKm} km` : ''}
                      {selected.durationMin ? ` · ${formatDurationMin(selected.durationMin)}` : ''}
                    </span>
                  )}
                </div>

                {trail.length > 1 && (
                  <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-2">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showTrail}
                        onChange={(e) => setShowTrail(e.target.checked)}
                        className="h-3.5 w-3.5 accent-amber-500 rounded"
                      />
                      <span className="h-1.5 w-6 shrink-0 rounded-full bg-amber-500" />
                      <span className="font-semibold text-slate-800">Actual path driven</span>
                    </label>
                    {actualDistanceKm != null && (
                      <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                        {actualDistanceKm} km {actualDurationFormatted ? `· ${actualDurationFormatted}` : ''}
                      </span>
                    )}
                  </div>
                )}

                {stops.length > 0 && (
                  <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-2">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showStops}
                        onChange={(e) => setShowStops(e.target.checked)}
                        className="h-3.5 w-3.5 accent-amber-600 rounded"
                      />
                      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-amber-600 text-[8px] font-bold text-white">
                        1
                      </span>
                      <span className="font-semibold text-slate-800">Stops</span>
                    </label>
                    <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                      {stops.length} · {formatStopDuration(totalIdleMs)} idle
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}


