import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { Truck, Link2, Copy, Check, RefreshCw, AlertCircle } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { tracking } from '../services/api';

const POLL_MS = 5000;
const INDIA_CENTER = [22.9868, 72.6100];

const STATUS_COLOR = {
  moving: '#22c55e',
  idle: '#f59e0b',
  offline: '#64748b',
};

const timeAgo = (iso) => {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
};

// Recentre the map when the user picks a different vehicle.
function PanTo({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, Math.max(map.getZoom(), 15), { duration: 0.8 });
  }, [position, map]);
  return null;
}

export function FleetMap() {
  const [devices, setDevices] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [share, setShare] = useState(null);
  const [copied, setCopied] = useState(false);

  // Let the poller read the current selection without re-arming the interval.
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await tracking.getDevices();
        if (cancelled) return;
        setDevices(data.devices || []);
        setError(null);
        // Auto-select the first device, but only before the user has chosen one.
        if (!selectedRef.current && data.devices?.length) {
          setSelectedId(data.devices[0].id || data.devices[0]._id);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not reach the tracking API');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const timer = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const selected = useMemo(
    () => devices.find((d) => (d.id || d._id) === selectedId) || null,
    [devices, selectedId]
  );

  const selectedPos = selected?.lastPosition?.latitude
    ? [selected.lastPosition.latitude, selected.lastPosition.longitude]
    : null;

  const createLink = async () => {
    if (!selected) return;
    setShare({ loading: true });
    try {
      const res = await tracking.createShareLink(
        selected.id || selected._id, 120, `Client link — ${selected.name}`
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

  const fleet = {
    moving: devices.filter((d) => d.status === 'moving').length,
    idle: devices.filter((d) => d.status === 'idle').length,
    offline: devices.filter((d) => d.status === 'offline').length,
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4 lg:flex-row">
      {/* ---- vehicle list ------------------------------------------------- */}
      <aside className="flex w-full flex-col rounded-xl border border-slate-200 bg-white lg:w-80">
        <div className="border-b border-slate-200 p-4">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <Truck className="h-5 w-5 text-sky-600" />
            Live Fleet
          </h2>
          <div className="mt-3 flex gap-2 text-xs">
            <span className="rounded-full bg-green-50 px-2 py-1 font-medium text-green-700">
              {fleet.moving} moving
            </span>
            <span className="rounded-full bg-amber-50 px-2 py-1 font-medium text-amber-700">
              {fleet.idle} idle
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-600">
              {fleet.offline} offline
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <p className="flex items-center gap-2 p-4 text-sm text-slate-500">
              <RefreshCw className="h-4 w-4 animate-spin" /> Loading devices…
            </p>
          )}

          {error && (
            <div className="m-4 flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && devices.length === 0 && (
            <div className="p-4 text-sm text-slate-500">
              <p className="font-medium text-slate-700">No devices reporting yet.</p>
              <p className="mt-1">
                Turn on the Traccar Client app and the vehicle will appear here within a few seconds.
              </p>
            </div>
          )}

          {devices.map((d) => {
            const id = d.id || d._id;
            return (
              <button
                key={id}
                onClick={() => setSelectedId(id)}
                className={`flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left transition hover:bg-slate-50 ${
                  id === selectedId ? 'bg-sky-50' : ''
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: STATUS_COLOR[d.status] }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{d.name}</span>
                  <span className="block text-xs text-slate-500">
                    {Math.round(d.lastPosition?.speed || 0)} km/h · {timeAgo(d.lastSeenAt)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* ---- share link (Milestone 3) ----------------------------------- */}
        {selected && (
          <div className="border-t border-slate-200 p-4">
            <button
              onClick={createLink}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
            >
              <Link2 className="h-4 w-4" />
              Share live link with client
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

      {/* ---- map ----------------------------------------------------------- */}
      <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-xl border border-slate-200">
        <MapContainer
          center={selectedPos || INDIA_CENTER}
          zoom={selectedPos ? 15 : 6}
          className="h-full w-full"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          <PanTo position={selectedPos} />

          {devices.map((d) => {
            if (!d.lastPosition?.latitude) return null;
            const id = d.id || d._id;
            return (
              <CircleMarker
                key={id}
                center={[d.lastPosition.latitude, d.lastPosition.longitude]}
                radius={id === selectedId ? 11 : 8}
                pathOptions={{
                  color: '#fff',
                  weight: 2,
                  fillColor: STATUS_COLOR[d.status],
                  fillOpacity: 1,
                }}
                eventHandlers={{ click: () => setSelectedId(id) }}
              >
                <Popup>
                  <strong>{d.name}</strong>
                  <br />
                  {Math.round(d.lastPosition.speed || 0)} km/h ·{' '}
                  {d.lastPosition.ignition ? 'ignition on' : 'ignition off'}
                  <br />
                  {timeAgo(d.lastSeenAt)}
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {selected && (
          <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex flex-wrap gap-2 lg:right-auto">
            {[
              ['Speed', `${Math.round(selected.lastPosition?.speed || 0)} km/h`],
              ['Ignition', selected.lastPosition?.ignition ? 'On' : 'Off'],
              ['Status', selected.status],
              ['Last fix', timeAgo(selected.lastSeenAt)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
                <p className="text-sm font-semibold capitalize text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
