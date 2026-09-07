import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Filter, X, ChevronLeft, ChevronRight, ChevronsUpDown,
  Route as RouteIcon, TrendingUp, TrendingDown, IndianRupee, Truck as TruckIcon,
} from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { usePermissions } from '../hooks/usePermissions';
import { tripOrders, customers as customersApi, fleet, drivers as driversApi } from '../services/api';
import {
  TRIP_STATUS_LABELS,
  TRIP_STATUS_COLORS,
  TRIP_TYPE_LABELS,
  TRIP_STATUSES,
  TRIP_TYPES,
  formatCurrency,
  formatNumber,
  formatDate,
} from '../constants/trip';

// A sortable column header. Declared at module scope rather than inside the
// page: a component created during render is a new type on every render, so
// React would unmount and remount the whole header row each time a filter
// changed.
function SortHeader({ field, children, className = '', sort, onSort }) {
  return (
    <th className={`px-4 py-3 text-left text-sm font-semibold text-slate-900 ${className}`}>
      <button
        onClick={() => onSort(field)}
        className="flex items-center gap-1 hover:text-blue-600 transition-colors"
      >
        {children}
        <ChevronsUpDown
          className={`w-3 h-3 ${sort.sortBy === field ? 'text-blue-600' : 'text-slate-400'}`}
        />
      </button>
    </th>
  );
}

// Trip Management — the operational trip list.
//
// Filtering, sorting and paging are all server-side: a fleet accumulates
// thousands of trips, and every figure in the money columns is computed by the
// API rather than here. This page renders what it is given.
export function TripManagement() {
  const navigate = useNavigate();
  const { can } = usePermissions();

  const [trips, setTrips] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 25 });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Master data for the filter dropdowns. Loaded once — these are small lists
  // and re-fetching them on every filter change would be wasteful.
  const [customerList, setCustomerList] = useState([]);
  const [truckList, setTruckList] = useState([]);
  const [driverList, setDriverList] = useState([]);

  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    status: [],
    tripType: '',
    customer: '',
    truck: '',
    driver: '',
    from: '',
    to: '',
    sortBy: 'tripDate',
    sortDir: 'desc',
    page: 1,
  });

  // Debounce the search box so typing a trip number does not fire a request per
  // keystroke. 400ms is long enough to finish a word, short enough not to feel
  // laggy.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput, page: 1 }));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Guards against an out-of-order response overwriting a newer one: a slow
  // request for page 1 must not land after a fast request for page 2 and put
  // the wrong rows on screen.
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const res = await tripOrders.list(filters);
      if (id !== requestId.current) return;
      setTrips(res.trips || []);
      setPagination(res.pagination || { page: 1, pages: 1, total: 0, limit: 25 });
      setError('');
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err.message || 'Failed to load trips');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [filters]);

  // Wrapped in an async IIFE so the loader's first setState lands in a
  // continuation rather than synchronously in the effect body, which would
  // trigger a cascading render.
  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // The stat strip and the filter lists are independent of the table, and a
      // failure in any one of them should not blank the page — each is caught
      // on its own.
      const [s, c, t, d] = await Promise.allSettled([
        tripOrders.summary(),
        customersApi.list({ status: 'Active' }),
        fleet.list(),
        driversApi.list(),
      ]);
      if (cancelled) return;
      if (s.status === 'fulfilled') setSummary(s.value);
      if (c.status === 'fulfilled') setCustomerList(c.value.customers || []);
      if (t.status === 'fulfilled') setTruckList(t.value.trucks || []);
      if (d.status === 'fulfilled') setDriverList(d.value.drivers || []);
    })();
    return () => { cancelled = true; };
  }, []);

  const setFilter = (patch) => setFilters((f) => ({ ...f, ...patch, page: 1 }));

  const toggleStatus = (status) =>
    setFilters((f) => ({
      ...f,
      status: f.status.includes(status)
        ? f.status.filter((s) => s !== status)
        : [...f.status, status],
      page: 1,
    }));

  const sortBy = (field) =>
    setFilters((f) => ({
      ...f,
      sortBy: field,
      // Clicking the active column flips direction; a new column starts
      // descending, which is what you want for dates and money.
      sortDir: f.sortBy === field && f.sortDir === 'desc' ? 'asc' : 'desc',
      page: 1,
    }));

  const clearFilters = () => {
    setSearchInput('');
    setFilters({
      search: '', status: [], tripType: '', customer: '', truck: '', driver: '',
      from: '', to: '', sortBy: 'tripDate', sortDir: 'desc', page: 1,
    });
  };

  const activeFilterCount =
    (filters.status.length ? 1 : 0) +
    [filters.tripType, filters.customer, filters.truck, filters.driver, filters.from, filters.to]
      .filter(Boolean).length;

  const statTiles = summary
    ? [
        { label: 'Total Trips', value: formatNumber(summary.totals.trips), icon: RouteIcon, bg: 'bg-blue-50', fg: 'text-blue-600' },
        { label: 'On the Road', value: formatNumber(summary.active), icon: TruckIcon, bg: 'bg-indigo-50', fg: 'text-indigo-600' },
        { label: 'Revenue', value: formatCurrency(summary.totals.revenue), icon: IndianRupee, bg: 'bg-green-50', fg: 'text-green-600' },
        {
          label: 'Profit',
          value: formatCurrency(summary.totals.profit),
          icon: summary.totals.profit >= 0 ? TrendingUp : TrendingDown,
          bg: summary.totals.profit >= 0 ? 'bg-green-50' : 'bg-red-50',
          fg: summary.totals.profit >= 0 ? 'text-green-600' : 'text-red-600',
        },
      ]
    : [];

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Trip Management</h1>
              <p className="text-slate-600 mt-1">
                Plan, dispatch and close out trips across the fleet
              </p>
            </div>
            {can('trips', 'create') && (
              <button
                onClick={() => navigate('/trips/new')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Trip
              </button>
            )}
          </div>

          {/* At a glance */}
          {statTiles.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statTiles.map((tile) => {
                const Icon = tile.icon;
                return (
                  <div
                    key={tile.label}
                    className="bg-white rounded-lg border border-slate-200 p-4 flex items-center gap-4"
                  >
                    <div className={`p-2 rounded-lg ${tile.bg}`}>
                      <Icon className={`w-5 h-5 ${tile.fg}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-slate-600">{tile.label}</p>
                      <p className="text-xl font-bold text-slate-900 truncate">{tile.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Search and filters */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by trip number, vehicle, driver, city, LR or e-way bill..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                  activeFilterCount
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Clear
                </button>
              )}
            </div>

            {showFilters && (
              <div className="space-y-4 pt-4 border-t border-slate-200">
                {/* Status is multi-select: "show me everything on the road" is
                    several statuses, not one. */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                  <div className="flex flex-wrap gap-2">
                    {TRIP_STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() => toggleStatus(s)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          filters.status.includes(s)
                            ? 'bg-blue-600 text-white'
                            : TRIP_STATUS_COLORS[s] || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {TRIP_STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Trip Type</label>
                    <select
                      value={filters.tripType}
                      onChange={(e) => setFilter({ tripType: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All types</option>
                      {TRIP_TYPES.map((t) => (
                        <option key={t} value={t}>{TRIP_TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Customer</label>
                    <select
                      value={filters.customer}
                      onChange={(e) => setFilter({ customer: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All customers</option>
                      {customerList.map((c) => (
                        <option key={c._id} value={c._id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle</label>
                    <select
                      value={filters.truck}
                      onChange={(e) => setFilter({ truck: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All vehicles</option>
                      {truckList.map((t) => (
                        <option key={t._id} value={t._id}>{t.number}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Driver</label>
                    <select
                      value={filters.driver}
                      onChange={(e) => setFilter({ driver: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All drivers</option>
                      {driverList.map((d) => (
                        <option key={d._id} value={d._id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">From</label>
                    <input
                      type="date"
                      value={filters.from}
                      onChange={(e) => setFilter({ from: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">To</label>
                    <input
                      type="date"
                      value={filters.to}
                      onChange={(e) => setFilter({ to: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Trips table */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <SortHeader sort={filters} onSort={sortBy} field="tripNumber">Trip</SortHeader>
                    <SortHeader sort={filters} onSort={sortBy} field="tripDate">Date</SortHeader>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Customer</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Route</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Vehicle / Driver</th>
                    <SortHeader sort={filters} onSort={sortBy} field="status">Status</SortHeader>
                    <SortHeader sort={filters} onSort={sortBy} field="plannedKm" className="text-right">KM</SortHeader>
                    <SortHeader sort={filters} onSort={sortBy} field="revenue">Revenue</SortHeader>
                    <SortHeader sort={filters} onSort={sortBy} field="expenses">Expenses</SortHeader>
                    <SortHeader sort={filters} onSort={sortBy} field="profit">Profit</SortHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading && (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                        Loading trips...
                      </td>
                    </tr>
                  )}

                  {!loading && trips.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                        {activeFilterCount || filters.search
                          ? 'No trips match these filters.'
                          : 'No trips yet. Create one to get started.'}
                      </td>
                    </tr>
                  )}

                  {!loading && trips.map((trip) => {
                    const profit = trip.totals?.profit ?? 0;
                    return (
                      <tr
                        key={trip._id}
                        onClick={() => navigate(`/trips/${trip._id}`)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-4 text-sm font-medium text-blue-600 whitespace-nowrap">
                          {trip.tripNumber}
                          <span className="block text-xs text-slate-500 font-normal">
                            {TRIP_TYPE_LABELS[trip.tripType] || trip.tripType}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">
                          {formatDate(trip.tripDate)}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {trip.customer?.name || <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          <span className="whitespace-nowrap">
                            {trip.pickup?.city || trip.pickup?.name || '—'}
                            <span className="text-slate-400 mx-1">→</span>
                            {trip.destination?.city || trip.destination?.name || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">
                          {trip.vehicleNumber || trip.truck?.number || (
                            <span className="text-slate-400">Unassigned</span>
                          )}
                          {(trip.driverName || trip.driver?.name) && (
                            <span className="block text-xs text-slate-500">
                              {trip.driverName || trip.driver?.name}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                              TRIP_STATUS_COLORS[trip.status] || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {TRIP_STATUS_LABELS[trip.status] || trip.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700 text-right whitespace-nowrap">
                          {/* Actual once known, planned until then — the label
                              says which, so a planned figure is never mistaken
                              for a measured one. */}
                          {trip.actualKm != null ? (
                            <span title="Actual distance">{formatNumber(trip.actualKm)}</span>
                          ) : (
                            <span className="text-slate-400" title="Planned distance">
                              {trip.plannedKm != null ? `~${formatNumber(trip.plannedKm)}` : '—'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">
                          {formatCurrency(trip.totals?.revenue)}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">
                          {formatCurrency(trip.totals?.expenses)}
                        </td>
                        <td
                          className={`px-4 py-4 text-sm font-semibold whitespace-nowrap ${
                            profit > 0 ? 'text-green-600' : profit < 0 ? 'text-red-600' : 'text-slate-700'
                          }`}
                        >
                          {formatCurrency(profit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.total > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                <p className="text-sm text-slate-600">
                  Showing {(pagination.page - 1) * pagination.limit + 1}–
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} trip{pagination.total === 1 ? '' : 's'}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, f.page - 1) }))}
                    disabled={pagination.page <= 1}
                    className="p-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-slate-600">
                    Page {pagination.page} of {pagination.pages}
                  </span>
                  <button
                    onClick={() =>
                      setFilters((f) => ({ ...f, page: Math.min(pagination.pages, f.page + 1) }))
                    }
                    disabled={pagination.page >= pagination.pages}
                    className="p-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
