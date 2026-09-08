import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, Edit2, Trash2, ChevronLeft, ChevronRight, Wrench,
  IndianRupee, CalendarClock, ArrowLeft,
} from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { usePermissions } from '../hooks/usePermissions';
import { maintenance as api, fleet } from '../services/api';
import { StatTile, Panel, EmptyState, Banner } from '../components/maintenance/MaintenanceUI';
import {
  SERVICE_TYPES, SERVICE_TYPE_LABELS,
  formatMoney, formatDate, formatOdometer, formatNumber,
} from '../constants/maintenance';

// M3-M02 — the service register.
//
// Scheduled work, as opposed to the repair register next door. The two are
// separate screens because they answer different questions: a service is
// planned and measured by whether the schedule was kept, a repair is unplanned
// and measured by how long the vehicle was off the road.
//
// Filtering, sorting and pagination are all server-side. A fleet services a
// vehicle every few weeks, so this grows without limit and none of it is done
// in the browser.
export function ServiceRecords() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [searchParams] = useSearchParams();

  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 25 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Filter state. Held as one object so the effect below has a single
  // dependency and a filter change resets the page in one place.
  //
  // The vehicle filter is seeded from the URL, so a reminder on the dashboard
  // can link straight to the rows it was about.
  const [filters, setFilters] = useState({
    search: '',
    truck: searchParams.get('truck') || '',
    serviceType: '',
    from: '',
    to: '',
  });
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ sortBy: 'servicedAt', sortDir: 'desc' });

  const [trucks, setTrucks] = useState([]);

  const query = useMemo(
    () => ({ ...filters, page, limit: pagination.limit, ...sort }),
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
        api.services.list(query),
        api.summary(filters),
      ]);
      if (rid !== requestId.current) return;
      setRecords(listRes.records || []);
      setPagination(listRes.pagination || { page: 1, pages: 1, total: 0, limit: 25 });
      setSummary(summaryRes?.totals || null);
      setError('');
    } catch (err) {
      if (rid !== requestId.current) return;
      setError(err.message || 'Failed to load service records');
    } finally {
      if (rid === requestId.current) setLoading(false);
    }
  }, [query, filters]);

  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fleet.list();
        setTrucks(res.trucks || []);
      } catch {
        // The picker is a convenience; the register still works without it.
      }
    })();
  }, []);

  const setFilter = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1); // a narrowed list starts at its own first page, not page 7
  };

  const hasFilters = Object.values(filters).some((v) => v !== '');

  const remove = async (record) => {
    if (
      !window.confirm(
        `Delete the ${SERVICE_TYPE_LABELS[record.serviceType] || record.serviceType} record for ${record.vehicleNumber}?`
      )
    ) {
      return;
    }
    try {
      await api.services.remove(record._id);
      setNotice('Service record deleted. The reminder now points at the previous service.');
      await load();
    } catch (err) {
      setError(err.message || 'Could not delete that service record');
    }
  };

  // Sorting is a header click, and the column that is active shows which way it
  // is pointing.
  const toggleSort = (field) =>
    setSort((s) => ({
      sortBy: field,
      sortDir: s.sortBy === field && s.sortDir === 'desc' ? 'asc' : 'desc',
    }));

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
                <h1 className="text-3xl font-bold text-slate-900">Service Records</h1>
                <p className="text-slate-600 mt-1">
                  Scheduled work, what it cost, and when each vehicle is next due
                </p>
              </div>
            </div>
            {can('maintenance', 'create') && (
              <button
                onClick={() => navigate('/maintenance/services/new')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Record Service
              </button>
            )}
          </div>

          <Banner tone="error" message={error} onDismiss={() => setError('')} />
          <Banner tone="success" message={notice} onDismiss={() => setNotice('')} />

          {/* The stat strip describes exactly the filtered set below it. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile
              label="Service visits"
              value={summary ? summary.services : '—'}
              hint="in this selection"
              icon={Wrench} bg="bg-blue-50" fg="text-blue-600"
            />
            <StatTile
              label="Service spend"
              value={summary ? formatMoney(summary.serviceCost) : '—'}
              hint={summary ? `${formatMoney(summary.partsTotal)} of it parts` : ''}
              icon={IndianRupee} bg="bg-green-50" fg="text-green-600"
            />
            <StatTile
              label="Repair spend"
              value={summary ? formatMoney(summary.repairCost) : '—'}
              hint={summary ? `${summary.repairs} completed jobs` : ''}
              icon={Wrench} bg="bg-orange-50" fg="text-orange-600"
            />
            <StatTile
              label="Unplanned share"
              value={summary?.unplannedShare !== null && summary?.unplannedShare !== undefined
                ? `${formatNumber(summary.unplannedShare, { decimals: 0 })}%`
                : '—'}
              hint="of total maintenance spend"
              icon={CalendarClock}
              bg={summary?.unplannedShare > 50 ? 'bg-amber-50' : 'bg-slate-50'}
              fg={summary?.unplannedShare > 50 ? 'text-amber-600' : 'text-slate-400'}
            />
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search vehicle, workshop or invoice number..."
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
                value={filters.serviceType}
                onChange={(e) => setFilter({ serviceType: e.target.value })}
                className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All service types</option>
                {SERVICE_TYPES.map((t) => (
                  <option key={t} value={t}>{SERVICE_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-4">
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
              {hasFilters && (
                <button
                  onClick={() => setFilter({ search: '', truck: '', serviceType: '', from: '', to: '' })}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          <Panel className="overflow-hidden">
            {loading && !records.length ? (
              <div className="p-10 text-center text-slate-500">Loading service records…</div>
            ) : !records.length ? (
              <EmptyState
                icon={Wrench}
                title={hasFilters ? 'No service records match those filters' : 'No service records yet'}
                hint={
                  hasFilters
                    ? 'Try widening the date range or clearing the vehicle filter.'
                    : 'Record a service visit and its next-due date, and the reminders start from there.'
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <SortHeader field="servicedAt" sort={sort} onSort={toggleSort}>Date</SortHeader>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Vehicle
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Service
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Workshop
                        </th>
                        <SortHeader field="odometer" align="right" sort={sort} onSort={toggleSort}>Odometer</SortHeader>
                        <SortHeader field="totalCost" align="right" sort={sort} onSort={toggleSort}>Cost</SortHeader>
                        <SortHeader field="nextServiceDate" sort={sort} onSort={toggleSort}>Next due</SortHeader>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {records.map((record) => (
                        <tr key={record._id} className="hover:bg-slate-50">
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-700">
                            {formatDate(record.servicedAt)}
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-sm font-medium text-slate-900">{record.vehicleNumber || '—'}</p>
                            {record.truck?.model && (
                              <p className="text-xs text-slate-500">{record.truck.model}</p>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-sm text-slate-900">
                              {SERVICE_TYPE_LABELS[record.serviceType] || record.serviceType}
                            </p>
                            {record.parts?.length ? (
                              <p className="text-xs text-slate-500">
                                {record.parts.length} {record.parts.length === 1 ? 'part' : 'parts'}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-sm text-slate-900">{record.workshop?.name || '—'}</p>
                            {record.workshop?.city && (
                              <p className="text-xs text-slate-500">{record.workshop.city}</p>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right text-sm text-slate-700 whitespace-nowrap">
                            {formatOdometer(record.odometer)}
                          </td>
                          <td className="px-4 py-4 text-right whitespace-nowrap">
                            <p className="text-sm font-medium text-slate-900">
                              {formatMoney(record.totalCost)}
                            </p>
                            {record.labourCost ? (
                              <p className="text-xs text-slate-500">
                                {formatMoney(record.labourCost)} labour
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {/* Both clocks, because either can be the one that
                                comes first — see assessDue on the server. */}
                            {record.nextServiceDate || record.nextServiceKm ? (
                              <>
                                {record.nextServiceDate && (
                                  <p className="text-sm text-slate-700">{formatDate(record.nextServiceDate)}</p>
                                )}
                                {record.nextServiceKm && (
                                  <p className="text-xs text-slate-500">
                                    at {formatOdometer(record.nextServiceKm)}
                                  </p>
                                )}
                              </>
                            ) : (
                              <span className="text-sm text-slate-400">not scheduled</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1">
                              {can('maintenance', 'update') && (
                                <button
                                  onClick={() => navigate(`/maintenance/services/${record._id}`)}
                                  className="p-2 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}
                              {can('maintenance', 'delete') && (
                                <button
                                  onClick={() => remove(record)}
                                  className="p-2 hover:bg-red-50 text-red-600 rounded transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Paged server-side: the register grows without limit. */}
                {pagination.pages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                    <p className="text-sm text-slate-600">
                      Page {pagination.page} of {pagination.pages} · {pagination.total} records
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
    </div>
  );
}

// A sortable column header. Declared at module scope rather than inside the
// page: a component defined during render is a new type on every pass, which
// remounts the header and loses focus mid-interaction.
function SortHeader({ field, children, align = 'left', sort, onSort }) {
  const active = sort.sortBy === field;
  return (
    <th className={`px-4 py-3 text-${align}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="text-xs font-medium text-slate-500 uppercase tracking-wider hover:text-slate-700"
      >
        {children}
        {active ? (sort.sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
      </button>
    </th>
  );
}
