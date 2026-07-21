import { useEffect, useMemo, useRef, useState } from 'react';
import { Truck, Link2, Copy, Check, RefreshCw, AlertCircle, Trash2, Plus } from 'lucide-react';
import { tracking } from '../services/api';
import { AddDeviceModal } from '../components/AddDeviceModal';
import { Topbar } from '../components/Topbar';
import { GoogleFleetMap } from '../components/GoogleFleetMap';
import { STATUS_COLOR } from '../components/mapConstants';

const POLL_MS = 5000;

const timeAgo = (iso) => {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
};

export function FleetMap() {
  const [devices, setDevices] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [share, setShare] = useState(null);
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);

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
    ['Last seen', timeAgo(selected.lastSeenAt)],
  ];

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <Topbar />
      <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4 lg:flex-row">
      {/* ---- vehicle list ------------------------------------------------- */}
      <aside className="flex w-full flex-col rounded-xl border border-slate-200 bg-white lg:w-80">
        <div className="border-b border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <Truck className="h-5 w-5 text-sky-600" />
              Live Fleet
            </h2>
            <button
              onClick={() => setAdding(true)}
              title="Add a vehicle"
              className="flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-sky-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
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
              <p className="font-medium text-slate-700">No vehicles yet.</p>
              <p className="mt-1">
                Hit <strong>Add</strong> to register one. You'll get a Server URL and Device ID to
                enter into the Traccar Client app on the driver's phone.
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
        <GoogleFleetMap
          devices={devices}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

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

        {adding && (
          <AddDeviceModal
            onClose={() => setAdding(false)}
            onRegistered={load}          // pull the new vehicle straight into the list
          />
        )}
      </div>
    </div>
  );
}
