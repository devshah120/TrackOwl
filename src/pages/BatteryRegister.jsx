import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, ChevronLeft, ChevronRight, BatteryCharging, ArrowLeft,
  AlertTriangle, ShieldCheck, X, Activity,
} from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { usePermissions } from '../hooks/usePermissions';
import { components as api, fleet } from '../services/api';
import {
  StatTile, Panel, EmptyState, Banner, BatteryStatusPill, HealthPill,
} from '../components/maintenance/MaintenanceUI';
import {
  BATTERY_STATUSES, BATTERY_STATUS_LABELS, BATTERY_HEALTH, BATTERY_VOLTAGES,
  formatMoney, formatDate, formatNumber,
} from '../constants/maintenance';

// M3-M09 — the battery master.
//
// The same asset shape as the tyre register, but what makes a battery due for
// replacement has nothing to do with distance: it dies of age and of how it is
// charged. So this screen leads with health and warranty rather than with
// kilometres, and the action that matters most is recording a check.
//
// The warranty column is the one that changes decisions: a battery that fails
// inside its warranty is a claim, and the same battery failing a week later is
// a purchase.
export function BatteryRegister() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [searchParams] = useSearchParams();

  const [batteries, setBatteries] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 25 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [filters, setFilters] = useState({
    search: '',
    truck: searchParams.get('truck') || '',
    status: '',
    health: '',
    inWarranty: false,
    dueForReplacement: searchParams.get('due') === 'true',
  });
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ sortBy: 'createdAt', sortDir: 'desc' });

  const [trucks, setTrucks] = useState([]);
  const [acting, setActing] = useState(null); // { kind: 'check'|'install'|'remove', battery }

  const query = useMemo(
    () => ({ ...filters, page, limit: pagination.limit, ...sort }),
    [filters, page, sort, pagination.limit]
  );

  const requestId = useRef(0);

  const load = useCallback(async () => {
    const rid = ++requestId.current;
    setLoading(true);
    try {
      const res = await api.batteries.list(query);
      if (rid !== requestId.current) return;
      setBatteries(res.batteries || []);
      setPagination(res.pagination || { page: 1, pages: 1, total: 0, limit: 25 });
      setError('');
    } catch (err) {
      if (rid !== requestId.current) return;
      setError(err.message || 'Failed to load batteries');
    } finally {
      if (rid === requestId.current) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fleet.list();
        setTrucks(res.trucks || []);
      } catch {
        // The picker is a convenience.
      }
    })();
  }, []);

  const setFilter = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const runAction = async (kind, battery, payload) => {
    try {
      if (kind === 'check') await api.batteries.check(battery._id, payload);
      else if (kind === 'install') await api.batteries.install(battery._id, payload);
      else await api.batteries.remove(battery._id, payload);
      setActing(null);
      setNotice(
        kind === 'check'
          ? 'Check recorded.'
          : kind === 'install'
            ? 'Battery installed. Any battery already in that position has been retired.'
            : 'Battery removed.'
      );
      await load();
    } catch (err) {
      setError(err.message || 'That action could not be completed');
      setActing(null);
    }
  };

  const fitted = batteries.filter((b) => b.status === 'Fitted').length;
  const failing = batteries.filter((b) => b.health === 'Weak' || b.health === 'Dead').length;
  const inWarranty = batteries.filter((b) => b.warrantyDaysLeft !== null && b.warrantyDaysLeft >= 0).length;

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/maintenance')}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                title="Back to maintenance"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Batteries</h1>
                <p className="text-slate-600 mt-1">
                  What is fitted, how it is testing, and what is still under warranty
                </p>
              </div>
            </div>
            {can('maintenance', 'create') && (
              <button
                onClick={() => navigate('/maintenance/batteries/new')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Battery
              </button>
            )}
          </div>

          <Banner tone="error" message={error} onDismiss={() => setError('')} />
          <Banner tone="success" message={notice} onDismiss={() => setNotice('')} />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile
              label="In this selection"
              value={pagination.total}
              hint={`${fitted} fitted`}
              icon={BatteryCharging} bg="bg-blue-50" fg="text-blue-600"
            />
            <StatTile
              label="Testing weak or dead"
              value={failing}
              hint="on this page"
              icon={AlertTriangle}
              bg={failing ? 'bg-red-50' : 'bg-slate-50'}
              fg={failing ? 'text-red-600' : 'text-slate-400'}
              onClick={() => setFilter({ health: 'Weak' })}
            />
            <StatTile
              label="Under warranty"
              value={inWarranty}
              hint="a failure here is a claim"
              icon={ShieldCheck} bg="bg-green-50" fg="text-green-600"
              onClick={() => setFilter({ inWarranty: true })}
            />
            <StatTile
              label="Value on this page"
              value={formatMoney(batteries.reduce((s, b) => s + (b.cost || 0), 0))}
              icon={Activity} bg="bg-indigo-50" fg="text-indigo-600"
            />
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col lg:flex-row flex-wrap gap-4">
            <div className="flex-1 min-w-64 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search serial, brand or vehicle..."
                value={filters.search}
                onChange={(e) => setFilter({ search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filters.truck}
              onChange={(e) => setFilter({ truck: e.target.value })}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All vehicles</option>
              {trucks.map((t) => (
                <option key={t._id} value={t._id}>{t.number}</option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilter({ status: e.target.value })}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All statuses</option>
              {BATTERY_STATUSES.map((s) => (
                <option key={s} value={s}>{BATTERY_STATUS_LABELS[s]}</option>
              ))}
            </select>
            <select
              value={filters.health}
              onChange={(e) => setFilter({ health: e.target.value })}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Any health</option>
              {BATTERY_HEALTH.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-600 whitespace-nowrap">
              <input
                type="checkbox"
                checked={filters.inWarranty}
                onChange={(e) => setFilter({ inWarranty: e.target.checked })}
                className="rounded border-slate-300"
              />
              In warranty
            </label>
            <select
              value={`${sort.sortBy}:${sort.sortDir}`}
              onChange={(e) => {
                const [sortBy, sortDir] = e.target.value.split(':');
                setSort({ sortBy, sortDir });
                setPage(1);
              }}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="createdAt:desc">Newest first</option>
              <option value="warrantyExpiry:asc">Warranty ending soonest</option>
              <option value="purchaseDate:asc">Oldest purchase</option>
              <option value="lastCheckedAt:asc">Longest since checked</option>
            </select>
          </div>

          <Panel className="overflow-hidden">
            {loading && !batteries.length ? (
              <div className="p-10 text-center text-slate-500">Loading batteries…</div>
            ) : !batteries.length ? (
              <EmptyState
                icon={BatteryCharging}
                title="No batteries match"
                hint="Add a battery to the master, then install it on a vehicle."
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <Th>Serial</Th>
                        <Th>Brand / spec</Th>
                        <Th>Status</Th>
                        <Th>Fitted to</Th>
                        <Th>Health</Th>
                        <Th>Warranty</Th>
                        <Th align="right">Cost</Th>
                        <Th />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {batteries.map((battery) => (
                        <tr key={battery._id} className="hover:bg-slate-50">
                          <td className="px-4 py-4">
                            <p className="text-sm font-medium text-slate-900">{battery.serialNumber}</p>
                            {battery.purchaseDate ? (
                              <p className="text-xs text-slate-500">
                                bought {formatDate(battery.purchaseDate)}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-sm text-slate-900">{battery.brand || '—'}</p>
                            <p className="text-xs text-slate-500">
                              {battery.voltage ? `${battery.voltage}V` : ''}
                              {battery.capacityAh ? ` · ${battery.capacityAh}Ah` : ''}
                            </p>
                          </td>
                          <td className="px-4 py-4"><BatteryStatusPill status={battery.status} /></td>
                          <td className="px-4 py-4">
                            {battery.vehicleNumber ? (
                              <>
                                <p className="text-sm text-slate-900">{battery.vehicleNumber}</p>
                                <p className="text-xs text-slate-500">{battery.position}</p>
                              </>
                            ) : (
                              <span className="text-sm text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <HealthPill health={battery.health} />
                            {battery.lastVoltage ? (
                              <p className="text-xs text-slate-500 mt-1">
                                {formatNumber(battery.lastVoltage, { decimals: 1 })}V
                                {battery.lastCheckedAt ? ` · ${formatDate(battery.lastCheckedAt)}` : ''}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {battery.warrantyExpiry ? (
                              <>
                                <p
                                  className={`text-sm ${
                                    battery.warrantyDaysLeft < 0
                                      ? 'text-slate-400'
                                      : battery.warrantyClosing
                                        ? 'text-amber-600 font-medium'
                                        : 'text-green-700'
                                  }`}
                                >
                                  {formatDate(battery.warrantyExpiry)}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {battery.warrantyDaysLeft < 0
                                    ? 'expired'
                                    : `${battery.warrantyDaysLeft} days left`}
                                </p>
                              </>
                            ) : (
                              <span className="text-sm text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right text-sm text-slate-700 whitespace-nowrap">
                            {formatMoney(battery.cost)}
                          </td>
                          <td className="px-4 py-4">
                            {can('maintenance', 'update') && (
                              <div className="flex items-center gap-1 justify-end">
                                <button
                                  onClick={() => setActing({ kind: 'check', battery })}
                                  className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50 whitespace-nowrap"
                                  title="Record a voltage/health check"
                                >
                                  Check
                                </button>
                                {battery.status === 'Fitted' ? (
                                  <button
                                    onClick={() => setActing({ kind: 'remove', battery })}
                                    className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"
                                  >
                                    Remove
                                  </button>
                                ) : battery.status !== 'Scrapped' ? (
                                  <button
                                    onClick={() => setActing({ kind: 'install', battery })}
                                    className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"
                                  >
                                    Install
                                  </button>
                                ) : null}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {pagination.pages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                    <p className="text-sm text-slate-600">
                      Page {pagination.page} of {pagination.pages} · {pagination.total} batteries
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={pagination.page <= 1}
                        className="p-2 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                        disabled={pagination.page >= pagination.pages}
                        className="p-2 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Panel>
        </div>
      </main>

      {acting?.kind === 'check' && (
        <CheckModal
          battery={acting.battery}
          onClose={() => setActing(null)}
          onSubmit={(payload) => runAction('check', acting.battery, payload)}
        />
      )}
      {acting?.kind === 'install' && (
        <InstallModal
          trucks={trucks}
          onClose={() => setActing(null)}
          onSubmit={(payload) => runAction('install', acting.battery, payload)}
        />
      )}
      {acting?.kind === 'remove' && (
        <RemoveModal
          battery={acting.battery}
          onClose={() => setActing(null)}
          onSubmit={(payload) => runAction('remove', acting.battery, payload)}
        />
      )}
    </div>
  );
}

function Th({ children, align = 'left' }) {
  return (
    <th className={`px-4 py-3 text-${align} text-xs font-medium text-slate-500 uppercase tracking-wider`}>
      {children}
    </th>
  );
}

function Field({ label, required, children, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
      {hint ? <p className="text-xs text-slate-500 mt-1">{hint}</p> : null}
    </div>
  );
}

function Modal({ title, subtitle, onClose, onSubmit, submitLabel, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
        className="bg-white rounded-lg p-6 w-full max-w-md space-y-4"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            {subtitle ? <p className="text-sm text-slate-600 mt-1">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        {children}
        <div className="flex justify-end gap-2">
          <button
            type="button" onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

// M3-M09 — a voltage/health check.
//
// Health is asked for separately from voltage rather than derived from it: a
// tired battery reads fine at rest and collapses under load, so the tester's
// verdict is evidence the number does not carry.
function CheckModal({ battery, onClose, onSubmit }) {
  const [voltage, setVoltage] = useState('');
  const [health, setHealth] = useState('');
  const [checkedBy, setCheckedBy] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <Modal
      title={`Check ${battery.serialNumber}`}
      subtitle="Record a reading, a verdict, or both."
      onClose={onClose}
      submitLabel="Record check"
      onSubmit={() =>
        onSubmit({
          voltage: voltage === '' ? null : Number(voltage),
          health: health || null,
          checkedBy,
          notes,
        })
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Voltage" hint={`nominal ${battery.voltage || 12}V`}>
          <input
            type="number" min="0" max="100" step="0.1"
            value={voltage}
            onChange={(e) => setVoltage(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </Field>
        <Field label="Health" hint="the tester's verdict">
          <select
            value={health}
            onChange={(e) => setHealth(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">No verdict</option>
            {BATTERY_HEALTH.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Checked by">
        <input
          type="text" value={checkedBy}
          onChange={(e) => setCheckedBy(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Field>
      <Field label="Notes">
        <input
          type="text" value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Field>
    </Modal>
  );
}

function InstallModal({ trucks, onClose, onSubmit }) {
  const [truck, setTruck] = useState('');
  const [position, setPosition] = useState('Battery 1');

  return (
    <Modal
      title="Install on a vehicle"
      subtitle="If that position already has a battery, it is retired and the two are linked."
      onClose={onClose}
      submitLabel="Install"
      onSubmit={() => onSubmit({ truck, position })}
    >
      <Field label="Vehicle" required>
        <select
          required value={truck}
          onChange={(e) => setTruck(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a vehicle</option>
          {trucks.map((t) => (
            <option key={t._id} value={t._id}>{t.number}</option>
          ))}
        </select>
      </Field>
      <Field label="Position" hint="most trucks carry two, wired in series">
        <input
          type="text" list="battery-positions"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <datalist id="battery-positions">
          <option value="Battery 1" />
          <option value="Battery 2" />
        </datalist>
      </Field>
    </Modal>
  );
}

function RemoveModal({ battery, onClose, onSubmit }) {
  const [status, setStatus] = useState('Removed');
  const [reason, setReason] = useState('');

  const inWarranty = battery.warrantyDaysLeft !== null && battery.warrantyDaysLeft >= 0;

  return (
    <Modal
      title={`Remove ${battery.serialNumber}`}
      subtitle={`Off ${battery.vehicleNumber || 'the vehicle'}.`}
      onClose={onClose}
      submitLabel="Remove"
      onSubmit={() => onSubmit({ status, reason })}
    >
      <Field label="Where does it go?">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="Removed">Back to the store</option>
          <option value="Scrapped">Scrapped</option>
          <option value="Warranty Claim">Warranty claim</option>
        </select>
      </Field>
      {/* A battery still in warranty should not be quietly scrapped — that is
          money the fleet is entitled to. */}
      {inWarranty && status === 'Scrapped' && (
        <Banner
          tone="warning"
          message={`This battery still has ${battery.warrantyDaysLeft} days of warranty left — a claim may be worth more than scrapping it.`}
        />
      )}
      <Field label="Reason">
        <input
          type="text" value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Would not hold charge overnight"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Field>
    </Modal>
  );
}

export { BATTERY_VOLTAGES };
