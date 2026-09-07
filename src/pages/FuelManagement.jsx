import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Edit2, Trash2, Fuel, AlertTriangle, TrendingUp,
  IndianRupee, Gauge, BarChart3, Settings2, X, ChevronLeft, ChevronRight, Check,
} from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { usePermissions } from '../hooks/usePermissions';
import { fuel as fuelApi, fleet, drivers as driversApi } from '../services/api';
import {
  FUEL_TYPES, FUEL_TYPE_LABELS, FUEL_TYPE_COLORS, FLAG_REASON_LABELS, FLAG_REASON_COLORS,
  formatMoney, formatNumber, formatQuantity, formatKmPerUnit, formatCostPerKm,
  formatOdometer, formatDateTime, unitFor,
} from '../constants/fuel';

// Fuel Management — the fuelling register (M3-F01/F02) with the efficiency
// figures the server computes for each entry (M3-F03/F04/F05) and the outlier
// flags it raises (M3-F06).
//
// Every number shown here arrives computed. Nothing on this page divides one
// figure by another: mileage is measured from the odometer chain server-side,
// where the full-to-full rule and the partial-fill roll-up live, and a dash
// means the server said "not known" rather than zero.
export function FuelManagement() {
  const navigate = useNavigate();
  const { can } = usePermissions();

  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 25 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Filter state. Held as one object so the effect below has a single
  // dependency and a filter change resets the page in one place.
  const [filters, setFilters] = useState({
    search: '', truck: '', driver: '', fuelType: '',
    from: '', to: '', flagged: false, unreviewed: false,
  });
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ sortBy: 'filledAt', sortDir: 'desc' });

  // The vehicle and driver pickers. Loaded once — a fleet's rosters are small
  // enough to hold, unlike the register itself.
  const [trucks, setTrucks] = useState([]);
  const [driverList, setDriverList] = useState([]);

  const [reviewing, setReviewing] = useState(null);

  const query = useMemo(
    () => ({
      ...filters,
      page,
      limit: pagination.limit,
      ...sort,
      // Empty strings would go to the API as `truck=`; the client's toQuery
      // drops them, but being explicit keeps the summary call identical.
    }),
    [filters, page, sort, pagination.limit]
  );

  // Guards against an out-of-order response overwriting a newer one: a slow
  // request for page 1 must not land after a fast request for page 2 and put
  // the wrong rows on screen.
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const rid = ++requestId.current;
    setLoading(true);
    try {
      // The list and its stat strip are fetched together and filtered
      // identically, so the totals always describe exactly the rows below them.
      const [listRes, summaryRes] = await Promise.all([
        fuelApi.list(query),
        fuelApi.summary(filters),
      ]);
      if (rid !== requestId.current) return;
      setEntries(listRes.entries || []);
      setPagination(listRes.pagination || { page: 1, pages: 1, total: 0, limit: 25 });
      setSummary(summaryRes || null);
      setError('');
    } catch (err) {
      if (rid !== requestId.current) return;
      setError(err.message || 'Failed to load fuel entries');
    } finally {
      if (rid === requestId.current) setLoading(false);
    }
  }, [query, filters]);

  // Wrapped in an async IIFE so the loader's first setState lands in a
  // continuation rather than synchronously in the effect body, which would
  // trigger a cascading render.
  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const [truckRes, driverRes] = await Promise.all([
          fleet.list(),
          driversApi.list(),
        ]);
        setTrucks(truckRes.trucks || []);
        setDriverList(driverRes.drivers || []);
      } catch {
        // The pickers are a convenience; the register still works without them.
      }
    })();
  }, []);

  const setFilter = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1); // a narrowed list starts at its own first page, not page 7
  };

  const clearFilters = () =>
    setFilter({ search: '', truck: '', driver: '', fuelType: '', from: '', to: '', flagged: false, unreviewed: false });

  const hasFilters = Object.entries(filters).some(([, v]) => v !== '' && v !== false);

  const remove = async (entry) => {
    if (!window.confirm(`Delete this ${entry.fuelType} entry for ${entry.vehicleNumber}?`)) return;
    try {
      await fuelApi.remove(entry._id);
      setNotice('Fuel entry deleted. The vehicle’s mileage figures were recomputed.');
      await load();
    } catch (err) {
      setError(err.message || 'Could not delete that fuel entry');
    }
  };

  const submitReview = async (note) => {
    try {
      await fuelApi.review(reviewing._id, note);
      setReviewing(null);
      setNotice('Flags marked as reviewed.');
      await load();
    } catch (err) {
      setError(err.message || 'Could not record the review');
    }
  };

  const totals = summary?.totals;

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Fuel Management</h1>
              <p className="text-slate-600 mt-1">
                Fuelling register, mileage and cost per kilometre across the fleet
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/fuel/reports')}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                Reports
              </button>
              {can('fuel', 'manage') && (
                <button
                  onClick={() => navigate('/fuel/settings')}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  title="Outlier thresholds"
                >
                  <Settings2 className="w-4 h-4" />
                  Thresholds
                </button>
              )}
              {can('fuel', 'create') && (
                <button
                  onClick={() => navigate('/fuel/new')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Record Filling
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 flex items-start justify-between gap-4">
              <span>{error}</span>
              <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
            </div>
          )}
          {notice && (
            <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 flex items-start justify-between gap-4">
              <span>{notice}</span>
              <button onClick={() => setNotice('')}><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* The stat strip describes exactly the filtered set below it. */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatTile
              label="Fuel purchased"
              value={totals ? formatNumber(totals.quantity, { decimals: 0 }) : '—'}
              hint={totals ? `${totals.entries} entries` : ''}
              icon={Fuel} bg="bg-blue-50" fg="text-blue-600"
            />
            <StatTile
              label="Total spend"
              value={totals ? formatMoney(totals.amount) : '—'}
              hint={totals?.avgRate ? `avg ${formatMoney(totals.avgRate, { decimals: 2 })}/unit` : ''}
              icon={IndianRupee} bg="bg-green-50" fg="text-green-600"
            />
            <StatTile
              label="Distance measured"
              value={totals?.distanceKm ? `${formatNumber(totals.distanceKm, { decimals: 0 })} km` : '—'}
              hint="from the odometer chain"
              icon={Gauge} bg="bg-indigo-50" fg="text-indigo-600"
            />
            <StatTile
              label="Fleet mileage"
              value={totals?.kmPerUnit ? formatNumber(totals.kmPerUnit) : '—'}
              hint={totals?.costPerKm ? formatCostPerKm(totals.costPerKm) : 'km per unit'}
              icon={TrendingUp} bg="bg-teal-50" fg="text-teal-600"
            />
            <StatTile
              label="Flagged"
              value={totals ? totals.flagged : '—'}
              hint="need a look"
              icon={AlertTriangle}
              bg={totals?.flagged ? 'bg-amber-50' : 'bg-slate-50'}
              fg={totals?.flagged ? 'text-amber-600' : 'text-slate-400'}
            />
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search vehicle, driver, station or bill number..."
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
                value={filters.fuelType}
                onChange={(e) => setFilter({ fuelType: e.target.value })}
                className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All fuel types</option>
                {FUEL_TYPES.map((t) => (
                  <option key={t} value={t}>{FUEL_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <select
                value={filters.driver}
                onChange={(e) => setFilter({ driver: e.target.value })}
                className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All drivers</option>
                {driverList.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                From
                <input
                  type="date" value={filters.from}
                  onChange={(e) => setFilter({ from: e.target.value })}
                  className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                To
                <input
                  type="date" value={filters.to}
                  onChange={(e) => setFilter({ to: e.target.value })}
                  className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox" checked={filters.flagged}
                  onChange={(e) => setFilter({ flagged: e.target.checked, unreviewed: false })}
                  className="rounded border-slate-300"
                />
                Flagged only
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox" checked={filters.unreviewed}
                  onChange={(e) => setFilter({ unreviewed: e.target.checked, flagged: false })}
                  className="rounded border-slate-300"
                />
                Needs review
              </label>
              {hasFilters && (
                <button onClick={clearFilters} className="text-sm text-blue-600 hover:text-blue-700">
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* The register */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <SortHeader label="Filled" field="filledAt" sort={sort} onSort={setSort} />
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Vehicle</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Station</th>
                    <SortHeader label="Quantity" field="quantity" sort={sort} onSort={setSort} align="right" />
                    <SortHeader label="Rate" field="rate" sort={sort} onSort={setSort} align="right" />
                    <SortHeader label="Amount" field="amount" sort={sort} onSort={setSort} align="right" />
                    <SortHeader label="Odometer" field="odometer" sort={sort} onSort={setSort} align="right" />
                    {/* M3-F03 and M3-F04, both computed server-side. */}
                    <SortHeader label="Mileage" field="kmPerUnit" sort={sort} onSort={setSort} align="right" />
                    <SortHeader label="Cost/km" field="costPerKm" sort={sort} onSort={setSort} align="right" />
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Flags</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && (
                    <tr><td colSpan={11} className="px-4 py-12 text-center text-slate-500">Loading fuel entries…</td></tr>
                  )}

                  {!loading && entries.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center text-slate-500">
                        {hasFilters
                          ? 'No fuel entries match these filters.'
                          : 'No fuel entries yet. Record a filling to start tracking mileage.'}
                      </td>
                    </tr>
                  )}

                  {!loading && entries.map((entry) => {
                    const unit = unitFor(entry.fuelType);
                    const eff = entry.efficiency || {};
                    return (
                      <tr key={entry._id} className="hover:bg-slate-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <p className="text-sm text-slate-900">{formatDateTime(entry.filledAt)}</p>
                          {entry.trip?.tripNumber && (
                            <p className="text-xs text-blue-600">{entry.trip.tripNumber}</p>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-slate-900">{entry.vehicleNumber || '—'}</p>
                          {entry.driverName && (
                            <p className="text-xs text-slate-500">{entry.driverName}</p>
                          )}
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                            FUEL_TYPE_COLORS[entry.fuelType] || 'bg-slate-100 text-slate-700'
                          }`}>
                            {FUEL_TYPE_LABELS[entry.fuelType] || entry.fuelType}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm text-slate-900">{entry.station?.name || '—'}</p>
                          {entry.station?.city && (
                            <p className="text-xs text-slate-500">{entry.station.city}</p>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right whitespace-nowrap">
                          <p className="text-sm text-slate-900">{formatQuantity(entry.quantity, entry.fuelType)}</p>
                          {/* A partial fill cannot anchor a mileage measurement,
                              so it is called out rather than left to be assumed. */}
                          {entry.fillType === 'partial' && (
                            <p className="text-xs text-amber-600">partial</p>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right text-sm text-slate-700 whitespace-nowrap">
                          {entry.rate ? `${formatMoney(entry.rate, { decimals: 2 })}/${unit}` : '—'}
                        </td>
                        <td className="px-4 py-4 text-right text-sm font-medium text-slate-900 whitespace-nowrap">
                          {formatMoney(entry.amount)}
                        </td>
                        <td className="px-4 py-4 text-right text-sm text-slate-700 whitespace-nowrap">
                          {formatOdometer(entry.odometer)}
                        </td>
                        <td className="px-4 py-4 text-right whitespace-nowrap">
                          <p className="text-sm font-medium text-slate-900">
                            {formatKmPerUnit(eff.kmPerUnit, entry.fuelType)}
                          </p>
                          {/* A figure rolled across partial fills is an estimate,
                              and says so — it is not a full-to-full measurement. */}
                          {eff.kmPerUnit !== null && eff.kmPerUnit !== undefined && !eff.measured && (
                            <p className="text-xs text-slate-400">estimated</p>
                          )}
                          {eff.distanceKm ? (
                            <p className="text-xs text-slate-500">over {formatNumber(eff.distanceKm, { decimals: 0 })} km</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-right text-sm text-slate-700 whitespace-nowrap">
                          {formatCostPerKm(eff.costPerKm)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            {(entry.flags || []).map((flag, i) => (
                              <span
                                key={i}
                                title={flag.message}
                                className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                  FLAG_REASON_COLORS[flag.reason] || 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {FLAG_REASON_LABELS[flag.reason] || flag.reason}
                              </span>
                            ))}
                            {entry.reviewedAt && (
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <Check className="w-3 h-3" /> reviewed
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            {entry.isFlagged && !entry.reviewedAt && can('fuel', 'update') && (
                              <button
                                onClick={() => setReviewing(entry)}
                                className="p-2 hover:bg-amber-50 text-amber-600 rounded transition-colors"
                                title="Mark flags reviewed"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                            {can('fuel', 'update') && (
                              <button
                                onClick={() => navigate(`/fuel/${entry._id}`)}
                                className="p-2 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {can('fuel', 'delete') && (
                              <button
                                onClick={() => remove(entry)}
                                className="p-2 hover:bg-red-50 text-red-600 rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paged server-side: the register grows without limit. */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                <p className="text-sm text-slate-600">
                  Page {pagination.page} of {pagination.pages} · {pagination.total} entries
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
          </div>
        </div>
      </main>

      {reviewing && (
        <ReviewModal entry={reviewing} onClose={() => setReviewing(null)} onSubmit={submitReview} />
      )}
    </div>
  );
}

function StatTile({ label, value, hint, icon: Icon, bg, fg }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center gap-4">
      <div className={`p-2 rounded-lg ${bg}`}>
        <Icon className={`w-5 h-5 ${fg}`} />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-slate-600 truncate">{label}</p>
        <p className="text-xl font-bold text-slate-900 truncate">{value}</p>
        {hint && <p className="text-xs text-slate-400 truncate">{hint}</p>}
      </div>
    </div>
  );
}

// A sortable column header. Sorting is server-side and restricted to an
// allow-list there, so these fields match what the API will actually accept.
function SortHeader({ label, field, sort, onSort, align = 'left' }) {
  const active = sort.sortBy === field;
  return (
    <th
      className={`px-4 py-3 text-${align} text-xs font-semibold uppercase cursor-pointer select-none ${
        active ? 'text-blue-600' : 'text-slate-600'
      }`}
      onClick={() =>
        onSort({
          sortBy: field,
          sortDir: active && sort.sortDir === 'desc' ? 'asc' : 'desc',
        })
      }
    >
      {label}
      {active && <span className="ml-1">{sort.sortDir === 'desc' ? '↓' : '↑'}</span>}
    </th>
  );
}

// Dismissing an entry's flags after looking into them. The flags stay on the
// record — they were genuinely raised — so the note explains what was found.
function ReviewModal({ entry, onClose, onSubmit }) {
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Review flags</h2>
            <p className="text-sm text-slate-600">
              {entry.vehicleNumber} · {formatDateTime(entry.filledAt)}
            </p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="space-y-2">
          {(entry.flags || []).map((flag, i) => (
            <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm font-medium text-amber-900">
                {FLAG_REASON_LABELS[flag.reason] || flag.reason}
              </p>
              <p className="text-sm text-amber-800 mt-1">{flag.message}</p>
            </div>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            What did you find? <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="e.g. Confirmed with the driver — long idling in traffic on this run."
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            The flags stay on the record. Marking them reviewed only takes the entry off the
            outstanding list.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(note)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Mark reviewed
          </button>
        </div>
      </div>
    </div>
  );
}
