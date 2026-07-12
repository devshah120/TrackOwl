import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Truck, Link2, Copy, Check, RefreshCw, AlertCircle, Trash2 } from 'lucide-react';
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

// A truck pin, rotated to the vehicle's heading. Built as a divIcon so it can be
// coloured by status and rotated without shipping a sprite per state.
const truckIcon = (status, course = 0, selected = false) => {
  const size = selected ? 42 : 34;
  const color = STATUS_COLOR[status] || STATUS_COLOR.offline;

  return L.divIcon({
    className: '',           // suppress Leaflet's default white box
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `
      <div style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:${color};border:3px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,.35);
        display:flex;align-items:center;justify-content:center;
        transition:transform .3s ease;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="${size * 0.55}" height="${size * 0.55}"
             viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round"
             style="transform:rotate(${course}deg)">
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
          <path d="M15 18H9"/>
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
          <circle cx="17" cy="18" r="2"/>
          <circle cx="7" cy="18" r="2"/>
        </svg>
      </div>`,
  });
};

// Recentre when the user picks a different vehicle.
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

  const load = async () => {
    try {
      const data = await tracking.getDevices();
      setDevices(data.devices || []);
      setError(null);
      if (!selectedRef.current && data.devices?.length) {
        setSelectedId(data.devices[0].id || data.devices[0]._id);
      }
    } catch (err) {
      setError(err.message || 'Could not reach the tracking API');
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
    () => devices.find((d) => (d.id || d._id) === selectedId) || null,
    [devices, selectedId]
  );

  const selectedPos = selected?.lastPosition?.latitude
    ? [selected.lastPosition.latitude, selected.lastPosition.longitude]
    : null;

  const removeDevice = async (device, event) => {
    event.stopPropagation();   // don't also select the row we're deleting
    const id = device.id || device._id;
    if (!confirm(`Remove "${device.name}"? Its stored positions and share links go too.`)) return;

    try {
      await tracking.deleteDevice(id);
      setDevices((prev) => prev.filter((d) => (d.id || d._id) !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      setError(err.message || 'Could not delete device');
    }
  };

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

  const stats = selected && [
    ['Speed', `${Math.round(selected.lastPosition?.speed || 0)} km/h`],
    ['Ignition', selected.lastPosition?.ignition ? 'On' : 'Off'],
    ['Status', selected.status],
    ['Last fix', timeAgo(selected.lastSeenAt)],
  ];

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4 p-4 lg:flex-row">
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
              <div
                key={id}
                onClick={() => setSelectedId(id)}
                className={`group flex cursor-pointer items-center gap-3 border-b border-slate-100 p-4 transition hover:bg-slate-50 ${
                  id === selectedId ? 'bg-sky-50' : ''
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: STATUS_COLOR[d.status] }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{d.name}</p>
                  <p className="text-xs text-slate-500">
                    {Math.round(d.lastPosition?.speed || 0)} km/h · {timeAgo(d.lastSeenAt)}
                  </p>
                </div>
                <button
                  onClick={(e) => removeDevice(d, e)}
                  title="Remove device"
                  className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
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

      {/* ---- map ----------------------------------------------------------
           The stat tiles float over the map rather than sitting under it, so
           they never steal height from the map container. --------------------- */}
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
              <Marker
                key={id}
                position={[d.lastPosition.latitude, d.lastPosition.longitude]}
                icon={truckIcon(d.status, d.lastPosition.course, id === selectedId)}
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
              </Marker>
            );
          })}
        </MapContainer>

        {stats && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 z-[1000] flex -translate-x-1/2 gap-2 whitespace-nowrap">
            {stats.map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg bg-white/95 px-3 py-2 shadow-md backdrop-blur-sm"
              >
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
