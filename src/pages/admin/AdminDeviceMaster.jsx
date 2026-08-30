import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Cpu, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Topbar } from '../../components/Topbar';
import { admin } from '../../services/api';
import {
  DEVICE_LIFECYCLE_STATUSES,
  getLifecycleColor,
  getTelemetryColor,
  formatDate,
} from '../../constants/device';

// The device master: the tracking hardware itself, as an asset register.
// Fleet Oversight answers "what vehicles exist"; this answers "what units are
// fitted to them, with which SIM, since when, on what firmware" — the record an
// operator needs when a truck stops reporting and someone has to work out
// whether it is the box, the SIM or the vehicle.
//
// Adding and editing happen on their own page (AdminAddDevice), the way the
// vehicle master does: the form runs to four sections, which is more than a
// dialog can hold without growing its own scrollbar.

export function AdminDeviceMaster() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = async () => {
    try {
      const res = await admin.listDevices();
      setDevices(res.devices || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (device) => {
    const id = device._id || device.id;
    if (!confirm(`Remove device ${device.name}? Its vehicle will be left without a tracker.`)) return;
    try {
      await admin.removeDevice(id);
      setDevices((prev) => prev.filter((d) => (d._id || d.id) !== id));
    } catch (err) {
      setError(err.message || 'Failed to remove device');
    }
  };

  const filtered = devices.filter((d) => {
    if (statusFilter !== 'all' && (d.lifecycleStatus || 'Active') !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [
      d.name,
      d.imei,
      d.uniqueId,
      d.model,
      d.manufacturer,
      d.sim?.number,
      d.sim?.provider,
      d.vehicle?.number,
      d.owner?.company,
      d.owner?.name,
    ].some((v) => String(v || '').toLowerCase().includes(q));
  });

  // Headline counts run off the full list, not the filtered one — they describe
  // the estate, and would be circular if they moved with the filter.
  const counts = useMemo(() => {
    const byStatus = devices.reduce((acc, d) => {
      const s = d.lifecycleStatus || 'Active';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
    return {
      total: devices.length,
      active: byStatus.Active || 0,
      unfitted: devices.filter((d) => !d.vehicle).length,
      offline: devices.filter((d) => d.status === 'offline').length,
    };
  }, [devices]);

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <Topbar />
      <main className="flex-1 overflow-y-auto">
        <div className="w-full space-y-6 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Device Master</h1>
              <p className="mt-1 text-slate-600">Every tracking unit, its SIM and the vehicle it is fitted to</p>
            </div>
            <button
              onClick={() => navigate('/admin/add-device')}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Device
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Total devices', counts.total, 'text-slate-900'],
              ['Active', counts.active, 'text-green-600'],
              ['Not fitted', counts.unfitted, 'text-amber-600'],
              ['Offline now', counts.offline, 'text-red-600'],
            ].map(([label, value, tone]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-500">{label}</p>
                <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by IMEI, model, SIM, vehicle, or client..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 sm:w-48"
            >
              <option value="all">All statuses</option>
              {DEVICE_LIFECYCLE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {loading && <div className="py-12 text-center text-slate-500">Loading devices...</div>}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {!loading && (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      {['Device', 'IMEI', 'Model', 'SIM', 'Provider', 'Installed', 'Firmware', 'Vehicle', 'Status', 'Actions'].map(
                        (h) => (
                          <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-slate-900">
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filtered.map((device) => {
                      const id = device._id || device.id;
                      return (
                        <tr key={id} className="align-top transition-colors hover:bg-slate-50">
                          <td className="px-4 py-4 text-sm">
                            <div className="flex items-center gap-2">
                              {device.deviceType === 'phone' ? (
                                <Smartphone className="h-4 w-4 shrink-0 text-slate-400" />
                              ) : (
                                <Cpu className="h-4 w-4 shrink-0 text-slate-400" />
                              )}
                              <div className="min-w-0">
                                <p className="font-medium text-blue-600">{device.name}</p>
                                <p className="text-xs text-slate-500">
                                  {device.owner?.company || 'Unclaimed'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 font-mono text-xs text-slate-700">
                            {device.imei || device.uniqueId || '—'}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            <p>{device.model || '—'}</p>
                            {device.manufacturer && (
                              <p className="text-xs text-slate-500">{device.manufacturer}</p>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                            {device.sim?.number || '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                            <p>{device.sim?.provider || '—'}</p>
                            {device.sim?.validTill && (
                              <p className="text-xs text-slate-500">till {formatDate(device.sim.validTill)}</p>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                            <p>{formatDate(device.installedAt)}</p>
                            {device.installedBy && (
                              <p className="text-xs text-slate-500">by {device.installedBy}</p>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                            {device.firmwareVersion || '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm">
                            {device.vehicle ? (
                              <>
                                <p className="text-slate-900">{device.vehicle.number}</p>
                                <p className="text-xs text-slate-500">{device.vehicle.model}</p>
                              </>
                            ) : (
                              <span className="text-xs text-amber-600">Not fitted</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm">
                            <div className="flex flex-col items-start gap-1">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${getLifecycleColor(
                                  device.lifecycleStatus
                                )}`}
                              >
                                {device.lifecycleStatus || 'Active'}
                              </span>
                              {/* Live telemetry, next to the lifecycle status:
                                  an "Active" unit that is "offline" is exactly
                                  what an operator is looking for. */}
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${getTelemetryColor(
                                  device.status
                                )}`}
                              >
                                {device.status}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => navigate(`/admin/add-device/${id}`)}
                                className="rounded p-2 text-slate-600 transition-colors hover:bg-slate-200"
                                title="Edit device"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => remove(device)}
                                className="rounded p-2 text-red-600 transition-colors hover:bg-red-50"
                                title="Remove device"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 && (
                <p className="p-6 text-center text-sm text-slate-500">No devices found.</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
