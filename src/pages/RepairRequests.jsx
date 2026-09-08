import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, ChevronLeft, ChevronRight, Wrench, ArrowLeft,
  AlertTriangle, Clock, IndianRupee,
} from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { usePermissions } from '../hooks/usePermissions';
import { maintenance as api, fleet } from '../services/api';
import {
  StatTile, Panel, EmptyState, Banner, RepairStatusPill, PriorityPill,
} from '../components/maintenance/MaintenanceUI';
import {
  REPAIR_STATUSES, REPAIR_STATUS_LABELS, REPAIR_PRIORITIES,
  formatMoney, formatDate, formatHours, formatOdometer,
} from '../constants/maintenance';

// M3-M04 — the repair register.
//
// Unplanned work: a fault someone reported and what was done about it. The
// default view is the open queue rather than everything, because that is what a
// workshop actually works from — the finished jobs are history and are one
// filter change away.
export function RepairRequests() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [searchParams] = useSearchParams();

  const [requests, setRequests] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 25 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    search: '',
    truck: searchParams.get('truck') || '',
    status: '',
    priority: '',
    from: '',
    to: '',
    // Seeded from the URL so the dashboard's "under repair" tile lands on the
    // queue rather than on the whole history.
    open: searchParams.get('open') === 'true',
  });
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ sortBy: 'reportedAt', sortDir: 'desc' });

  const [trucks, setTrucks] = useState([]);

  const query = useMemo(
    () => ({ ...filters, page, limit: pagination.limit, ...sort }),
    [filters, page, sort, pagination.limit]
  );

  const requestId = useRef(0);

  const load = useCallback(async () => {
    const rid = ++requestId.current;
    setLoading(true);
    try {
      const [listRes, summaryRes] = await Promise.all([
        api.repairs.list(query),
        api.summary(filters),
      ]);
      if (rid !== requestId.current) return;
      setRequests(listRes.requests || []);
      setPagination(listRes.pagination || { page: 1, pages: 1, total: 0, limit: 25 });
      setSummary(summaryRes?.totals || null);
      setError('');
    } catch (err) {
      if (rid !== requestId.current) return;
      setError(err.message || 'Failed to load repair requests');
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
    setPage(1);
  };

  const hasFilters =
    filters.search || filters.truck || filters.status || filters.priority || filters.from || filters.to || filters.open;

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
                <h1 className="text-3xl font-bold text-slate-900">Repairs</h1>
                <p className="text-slate-600 mt-1">
                  Reported faults, what they cost, and how long each vehicle was off the road
                </p>
              </div>
            </div>
            {can('maintenance', 'create') && (
              <button
                onClick={() => navigate('/maintenance/repairs/new')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Report Fault
              </button>
            )}
          </div>

          <Banner tone="error" message={error} onDismiss={() => setError('')} />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile
              label="Open jobs"
              value={summary ? summary.openRepairs : '—'}
              hint="not yet finished"
              icon={AlertTriangle}
              bg={summary?.openRepairs ? 'bg-amber-50' : 'bg-slate-50'}
              fg={summary?.openRepairs ? 'text-amber-600' : 'text-slate-400'}
              onClick={() => setFilter({ open: true, status: '' })}
            />
            <StatTile
              label="Completed"
              value={summary ? summary.repairs : '—'}
              hint="in this selection"
              icon={Wrench} bg="bg-blue-50" fg="text-blue-600"
            />
            <StatTile
              label="Repair spend"
              value={summary ? formatMoney(summary.repairCost) : '—'}
              hint="completed jobs only"
              icon={IndianRupee} bg="bg-green-50" fg="text-green-600"
            />
            <StatTile
              label="Downtime"
              value={summary ? formatHours(summary.downtimeHours) : '—'}
              hint="approval to completion"
              icon={Clock} bg="bg-indigo-50" fg="text-indigo-600"
            />
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search request number, vehicle, fault or workshop..."
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
                // Picking an explicit status supersedes the open-queue filter:
                // the two would otherwise contradict each other.
                onChange={(e) => setFilter({ status: e.target.value, open: false })}
                className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All statuses</option>
                {REPAIR_STATUSES.map((s) => (
                  <option key={s} value={s}>{REPAIR_STATUS_LABELS[s]}</option>
                ))}
              </select>
              <select
                value={filters.priority}
                onChange={(e) => setFilter({ priority: e.target.value })}
                className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All priorities</option>
                {REPAIR_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={filters.open}
                  onChange={(e) => setFilter({ open: e.target.checked, status: '' })}
                  className="rounded border-slate-300"
                />
                Open jobs only
              </label>
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
                  onClick={() =>
                    setFilter({ search: '', truck: '', status: '', priority: '', from: '', to: '', open: false })
                  }
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Clear filters
                </button>
              )}
              <div className="ml-auto flex items-center gap-2 text-sm text-slate-600">
                Sort
                <select
                  value={`${sort.sortBy}:${sort.sortDir}`}
                  onChange={(e) => {
                    const [sortBy, sortDir] = e.target.value.split(':');
                    setSort({ sortBy, sortDir });
                  }}
                  className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="reportedAt:desc">Newest first</option>
                  <option value="reportedAt:asc">Oldest first</option>
                  <option value="priority:desc">Priority</option>
                  <option value="totalCost:desc">Most expensive</option>
                  <option value="completedAt:desc">Recently completed</option>
                </select>
              </div>
            </div>
          </div>

          <Panel className="overflow-hidden">
            {loading && !requests.length ? (
              <div className="p-10 text-center text-slate-500">Loading repair requests…</div>
            ) : !requests.length ? (
              <EmptyState
                icon={Wrench}
                title={hasFilters ? 'No repairs match those filters' : 'No repair requests yet'}
                hint={
                  hasFilters
                    ? 'Try clearing the open-jobs filter — completed repairs are hidden by it.'
                    : 'Report a fault and it moves through approval, repair and completion from here.'
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <Th>Request</Th>
                        <Th>Vehicle</Th>
                        <Th>Fault</Th>
                        <Th>Priority</Th>
                        <Th>Status</Th>
                        <Th align="right">Estimate</Th>
                        <Th align="right">Actual</Th>
                        <Th align="right">Downtime</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {requests.map((request) => (
                        <tr
                          key={request._id}
                          onClick={() => navigate(`/maintenance/repairs/${request._id}`)}
                          className="hover:bg-slate-50 cursor-pointer"
                        >
                          <td className="px-4 py-4 whitespace-nowrap">
                            <p className="text-sm font-medium text-slate-900">{request.requestNumber}</p>
                            <p className="text-xs text-slate-500">{formatDate(request.reportedAt)}</p>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-sm text-slate-900">{request.vehicleNumber || '—'}</p>
                            {request.odometer ? (
                              <p className="text-xs text-slate-500">{formatOdometer(request.odometer)}</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-4 max-w-xs">
                            <p className="text-sm text-slate-900 truncate">{request.issue}</p>
                            {request.reportedByName && (
                              <p className="text-xs text-slate-500 truncate">
                                by {request.reportedByName}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-4"><PriorityPill priority={request.priority} /></td>
                          <td className="px-4 py-4">
                            <RepairStatusPill status={request.status} />
                            {request.workshop?.name && (
                              <p className="text-xs text-slate-500 mt-1 truncate">{request.workshop.name}</p>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right text-sm text-slate-700 whitespace-nowrap">
                            {request.estimatedCost ? formatMoney(request.estimatedCost) : '—'}
                          </td>
                          <td className="px-4 py-4 text-right whitespace-nowrap">
                            <p className="text-sm font-medium text-slate-900">
                              {request.totalCost ? formatMoney(request.totalCost) : '—'}
                            </p>
                            {/* Over an estimate is the thing worth seeing at a
                                glance — it is the number somebody has to explain. */}
                            {request.estimatedCost && request.totalCost > request.estimatedCost ? (
                              <p className="text-xs text-red-600">
                                +{formatMoney(request.totalCost - request.estimatedCost)}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-4 text-right text-sm text-slate-700 whitespace-nowrap">
                            {formatHours(request.downtimeHours)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {pagination.pages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                    <p className="text-sm text-slate-600">
                      Page {pagination.page} of {pagination.pages} · {pagination.total} requests
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

function Th({ children, align = 'left' }) {
  return (
    <th className={`px-4 py-3 text-${align} text-xs font-medium text-slate-500 uppercase tracking-wider`}>
      {children}
    </th>
  );
}
