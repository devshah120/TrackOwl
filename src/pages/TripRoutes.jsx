import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Route as RouteIcon, Plus, Trash2, RefreshCw, AlertCircle,
  Link2, Copy, Check, Navigation, X, Clock, CheckCircle2,
  Play, Square, WifiOff, ChevronRight,
} from 'lucide-react';
import { trips as tripsApi, tracking, geo } from '../services/api';
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

// The full account of one trip: how its elapsed time divides up, where the
// vehicle sat, and when the tracker went quiet. Lives in a modal because it is
// reference detail for a single trip — inline, it crowded out the trip list.
function TripBreakdownModal({ trip, timeBudget, stops, coverage, totalIdleMs, onClose }) {
  // Escape closes, matching every other dismissable surface in the app.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const gaps = coverage?.gaps || [];
  const pct = (ms) => (timeBudget.totalMs > 0 ? (ms / timeBudget.totalMs) * 100 : 0);

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Trip breakdown"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 p-4">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900">Trip breakdown</h3>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-500">
              <span className="truncate">{shortPlace(trip.origin.name)}</span>
              <Navigation className="h-3 w-3 shrink-0 text-sky-500" />
              <span className="truncate">{shortPlace(trip.destination.name)}</span>
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Driving, waiting, and unknown are three different answers, and a
              single "5h 5m" hides which one applies. */}
          <div className="px-4 pt-4 pb-3">
            <h4 className="mb-2 text-sm font-semibold text-slate-900">
              Time breakdown · {formatStopDuration(timeBudget.totalMs)}
            </h4>

            <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="bg-sky-500" style={{ width: `${pct(timeBudget.movingMs)}%` }} />
              <div className="bg-amber-500" style={{ width: `${pct(timeBudget.idleMs)}%` }} />
              <div className="bg-slate-300" style={{ width: `${pct(timeBudget.untrackedMs)}%` }} />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-sky-100 bg-sky-50/60 p-2">
                <p className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <span className="h-2 w-2 rounded-full bg-sky-500" /> Moving
                </p>
                <p className="mt-0.5 text-sm font-semibold text-sky-700">
                  {formatStopDuration(timeBudget.movingMs)}
                </p>
              </div>
              <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-2">
                <p className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> Idle
                </p>
                <p className="mt-0.5 text-sm font-semibold text-amber-700">
                  {formatStopDuration(timeBudget.idleMs)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <p className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <span className="h-2 w-2 rounded-full bg-slate-300" /> Offline
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-600">
                  {formatStopDuration(timeBudget.untrackedMs)}
                </p>
              </div>
            </div>

            {/* Say plainly when most of the trip is unaccounted for — the
                distance and stops below are only as good as the coverage. */}
            {timeBudget.untrackedMs > timeBudget.totalMs * 0.2 && (
              <p className="mt-3 flex gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[11px] leading-snug text-slate-600">
                <WifiOff className="mt-px h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span>
                  The device was offline for{' '}
                  <strong>{formatStopDuration(timeBudget.untrackedMs)}</strong> of this trip, so
                  the distance and stops below cover only part of it.
                </span>
              </p>
            )}
          </div>

          {/* What explains a run planned for minutes that took hours — each
              entry is a place the vehicle sat, with how long it sat there. */}
          {stops.length > 0 && (
            <div className="border-t border-slate-200 px-4 pt-3 pb-3">
              <div className="mb-1 flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <Clock className="h-4 w-4 text-amber-600" />
                  Stops ({stops.length})
                </h4>
                <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  {formatStopDuration(totalIdleMs)} idle
                </span>
              </div>

              <ul>
                {stops.map((s, i) => (
                  <li
                    key={`${s.startedAt}-${i}`}
                    className="flex gap-2.5 border-b border-slate-100 py-2.5 last:border-b-0"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-800">
                        {s.address || `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {formatClock(s.startedAt)} – {formatClock(s.endedAt)}
                        <span className="ml-1.5 font-semibold text-amber-700">
                          {formatStopDuration(s.durationMs)}
                        </span>
                        {/* The tracker went quiet rather than reporting from a
                            standstill, so the duration is bounded by the
                            silence, not watched throughout. */}
                        {s.inferred && (
                          <span
                            className="ml-1.5 text-slate-400"
                            title="Device was offline during this period — duration inferred from the gap between fixes"
                          >
                            · device offline
                          </span>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Blind spots, listed separately from stops so the two are never
              read as the same kind of fact. */}
          {gaps.length > 0 && (
            <div className="border-t border-slate-200 px-4 pt-3 pb-4">
              <div className="mb-1 flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <WifiOff className="h-4 w-4 text-slate-400" />
                  Offline device ({gaps.length})
                </h4>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  {formatStopDuration(timeBudget.untrackedMs)} offline
                </span>
              </div>

              <ul>
                {gaps.map((g, i) => (
                  <li
                    key={`${g.startedAt}-${i}`}
                    className="flex gap-2.5 border-b border-slate-100 py-2.5 last:border-b-0"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 ring-1 ring-inset ring-slate-200">
                      <WifiOff className="h-3 w-3" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-700">
                        {g.address || `${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}`}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {formatClock(g.startedAt)} – {formatClock(g.endedAt)}
                        <span className="ml-1.5 font-semibold text-slate-600">
                          {formatStopDuration(g.durationMs)}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {g.position === 'end'
                          ? 'Device went offline here'
                          : 'Device was offline at trip start'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function TripRoutes() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [trips, setTrips] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [share, setShare] = useState(null);
  const [copied, setCopied] = useState(false);

  // The actual driven path for the selected trip, as [[lat, lng], ...]. Loaded
  // per trip and refreshed on the poll while the trip is still running, so the
  // amber trail grows behind the vehicle as it moves.
  const [trail, setTrail] = useState([]);
  const [showTrail, setShowTrail] = useState(true);

  // Places the vehicle stood still during the selected trip, with how long it
  // sat at each. Detected server-side from the same GPS fixes as the trail.
  const [stops, setStops] = useState([]);
  const [showStops, setShowStops] = useState(true);

  // Periods the trip was running but the device reported nothing. Not stops —
  // the vehicle's behaviour during them is unknown — but shown so a trip that
  // lost its tracker doesn't read as a confident short journey.
  const [coverage, setCoverage] = useState(null);

  // The full time/stops/offline breakdown lives in a modal — it is reference
  // detail for one trip, and inline it crowded the trip list it belongs to.
  const [showBreakdown, setShowBreakdown] = useState(false);

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

  // Load the driven path whenever the selection changes, then keep it current
  // while the trip is active.
  const [trailMeta, setTrailMeta] = useState(null);

  // Switching trips invalidates whatever the modal is showing, so close it
  // rather than let it repaint with another trip's numbers.
  useEffect(() => {
    setShowBreakdown(false);
  }, [selectedId]);

  const selectedStatus = selected?.status;
  useEffect(() => {
    if (!selectedId) {
      setTrail([]);
      setStops([]);
      setCoverage(null);
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
          setCoverage(res.coverage || null);
          setTrailMeta({ startedAt: res.startedAt, endedAt: res.endedAt });
        }
      } catch {
        if (!cancelled) {
          setTrail([]);
          setStops([]);
          setCoverage(null);
          setTrailMeta(null);
        }
      }
    };

    setTrail([]);
    setStops([]);
    setCoverage(null);
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

  const untrackedMs = coverage?.untrackedMs || 0;
  const untrackedGaps = showStops ? (coverage?.gaps || []) : [];

  // How the trip's whole duration divides up. Shown because the three parts
  // answer different questions: driving time is performance, idle is delay, and
  // untracked is simply unknown — and lumping the last into either would state
  // as fact something the GPS data cannot support.
  const timeBudget = useMemo(() => {
    const startIso = selected?.startedAt || trailMeta?.startedAt;
    if (!startIso) return null;
    const endMs = selected?.completedAt
      ? new Date(selected.completedAt).getTime()
      : Date.now();
    const totalMs = endMs - new Date(startIso).getTime();
    if (totalMs <= 0) return null;
    // Whatever is left once idle and untracked are taken out is time the
    // vehicle was tracked and not stationary.
    const movingMs = Math.max(0, totalMs - totalIdleMs - untrackedMs);
    return { totalMs, movingMs, idleMs: totalIdleMs, untrackedMs };
  }, [selected, trailMeta, totalIdleMs, untrackedMs]);

  const framePoints = useMemo(() => {
    const pts = routePoints ? [...routePoints] : [];
    if (livePos) pts.push(livePos);
    if (!pts.length) return null;
    return pts.map(([lat, lng]) => ({ lat, lng }));
  }, [routePoints, livePos]);

  // The selected trip's route
  const mapRoute = useMemo(() => {
    if (!selected) return null;
    return {
      polyline: routePoints,
      actualPath: visibleTrail,
      stops: visibleStops,
      untracked: untrackedGaps,
      origin: { lat: selected.origin.lat, lng: selected.origin.lng },
      originName: selected.origin.name,
      destination: { lat: selected.destination.lat, lng: selected.destination.lng },
      destinationName: selected.destination.name,
    };
  }, [selected, routePoints, visibleTrail, visibleStops, untrackedGaps]);

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
            {/* ---- Trip List ---- */}
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <RouteIcon className="h-5 w-5 text-sky-600" />
                Trip Routes
              </h2>
            </div>


              {/* The trip list owns the sidebar now that the breakdown lives
                  in a modal — only the fixed-height summary and share
                  footer sit below it. */}
              <div className="min-h-[12rem] flex-1 overflow-y-auto">
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

                {/* Trips are created with their paperwork on the Add New Trip
                    wizard, so this page never creates one — it points there
                    rather than offering a second, route-only way in. */}
                {!loading && !error && trips.length === 0 && (
                  <div className="p-4 text-sm text-slate-500">
                    <p className="font-medium text-slate-700">No trips yet.</p>
                    <p className="mt-1">
                      Create one under <strong>Trips &amp; Documents</strong> — pick the From and To
                      locations on the map and attach a tracker, and the trip appears here for live
                      tracking.
                    </p>
                    <button
                      onClick={() => navigate('/add-new-trip')}
                      className="mt-3 flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-700"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add a trip
                    </button>
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

              {/* A compact read of the selected trip, with the full
                  breakdown one click away in a modal. Kept small here so
                  the trip list above it stays usable. */}
              {selected && timeBudget && (stops.length > 0 || untrackedMs > 0) && (
                <div className="shrink-0 border-t border-slate-200 p-4">
                  <button
                    onClick={() => setShowBreakdown(true)}
                    className="group flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-left transition hover:border-sky-300 hover:bg-sky-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        <Clock className="h-4 w-4 text-sky-600" />
                        Trip breakdown
                      </p>

                      {/* The same three-part split as the modal, so the
                          shape of the trip is readable without opening it. */}
                      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="bg-sky-500"
                          style={{ width: `${(timeBudget.movingMs / timeBudget.totalMs) * 100}%` }}
                        />
                        <div
                          className="bg-amber-500"
                          style={{ width: `${(timeBudget.idleMs / timeBudget.totalMs) * 100}%` }}
                        />
                        <div
                          className="bg-slate-300"
                          style={{ width: `${(timeBudget.untrackedMs / timeBudget.totalMs) * 100}%` }}
                        />
                      </div>

                      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-700">
                          {formatStopDuration(timeBudget.totalMs)} total
                        </span>
                        {stops.length > 0 && (
                          <span className="text-amber-700">
                            · {stops.length} stop{stops.length === 1 ? '' : 's'}
                          </span>
                        )}
                        {untrackedMs > 0 && (
                          <span className="text-slate-500">
                            · {formatStopDuration(untrackedMs)} offline
                          </span>
                        )}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-sky-600" />
                  </button>
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
          </aside>

          {/* ---- map -------------------------------------------------- */}
          <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-xl border border-slate-200">
            <GoogleFleetMap
              devices={liveDevice ? [liveDevice] : []}
              selectedId={selectedId}
              route={mapRoute}
              fitTo={framePoints}
            />

            {/* Legend for the two lines with actual driven path stats */}
            {selected && (
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

      {showBreakdown && selected && timeBudget && (
        <TripBreakdownModal
          trip={selected}
          timeBudget={timeBudget}
          stops={stops}
          coverage={coverage}
          totalIdleMs={totalIdleMs}
          onClose={() => setShowBreakdown(false)}
        />
      )}
    </div>
  );
}


