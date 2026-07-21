import { useEffect, useMemo, useRef, useState } from 'react';
import { Truck, RefreshCw, AlertCircle, Plus } from 'lucide-react';
import { admin } from '../../services/api';
import { Topbar } from '../../components/Topbar';
import { AdminAddDeviceModal } from '../../components/AdminAddDeviceModal';
import { GoogleFleetMap } from '../../components/GoogleFleetMap';
import { STATUS_COLOR } from '../../components/mapConstants';

const POLL_MS = 5000;

const timeAgo = (iso) => {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
};

export function AdminLiveTracking() {
  const [devices, setDevices] = useState([]);
  const [clients, setClients] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  const load = async () => {
    try {
      const data = await admin.listDevices();
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

  useEffect(() => {
    admin.listUsers().then((res) => setClients(res.users)).catch(() => {});
    admin.listTrucks().then((res) => setTrucks(res.trucks)).catch(() => {});
  }, []);

  const selected = useMemo(
    () => devices.find((d) => (d.id || d._id) === selectedId) || null,
    [devices, selectedId]
  );

  const fleet = {
    moving: devices.filter((d) => d.status === 'moving').length,
    idle: devices.filter((d) => d.status === 'idle').length,
    offline: devices.filter((d) => d.status === 'offline').length,
  };

  const stats = selected && [
    ['Client', selected.owner?.company || selected.owner?.name || 'Unclaimed'],
    ['Speed', `${Math.round(selected.lastPosition?.speed || 0)} km/h`],
    ['Status', selected.status],
    ['Last seen', timeAgo(selected.lastSeenAt)],
  ];

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <Topbar />
      <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4 lg:flex-row">
        <aside className="flex w-full flex-col rounded-xl border border-slate-200 bg-white lg:w-80">
          <div className="border-b border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <Truck className="h-5 w-5 text-sky-600" />
                All Fleets (Global)
              </h2>
              <button
                onClick={() => setAdding(true)}
                title="Add a vehicle for a client"
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
                <p className="font-medium text-slate-700">No vehicles on the platform yet.</p>
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
                    <p className="truncate text-xs text-slate-500">
                      {d.owner?.company || d.owner?.name || 'Unclaimed'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {Math.round(d.lastPosition?.speed || 0)} km/h · {timeAgo(d.lastSeenAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-xl border border-slate-200">
          <GoogleFleetMap
            devices={devices}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />

          {stats && (
            <div className="pointer-events-none absolute bottom-4 left-1/2 z-[1000] flex -translate-x-1/2 gap-2 whitespace-nowrap">
              {stats.map(([label, value]) => (
                <div key={label} className="rounded-lg bg-white/95 px-3 py-2 shadow-md backdrop-blur-sm">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="text-sm font-semibold capitalize text-slate-900">{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {adding && (
          <AdminAddDeviceModal
            clients={clients}
            trucks={trucks}
            onClose={() => setAdding(false)}
            onRegistered={load}
          />
        )}
      </div>
    </div>
  );
}
