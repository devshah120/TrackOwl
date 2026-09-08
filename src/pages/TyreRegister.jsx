import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, ChevronLeft, ChevronRight, Disc3, ArrowLeft, LayoutGrid, List,
  AlertTriangle, IndianRupee, Gauge,
} from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { usePermissions } from '../hooks/usePermissions';
import { components as api, fleet } from '../services/api';
import {
  StatTile, Panel, EmptyState, Banner, TyreStatusPill,
} from '../components/maintenance/MaintenanceUI';
import {
  TYRE_STATUSES, TYRE_STATUS_LABELS, TYRE_AXLES,
  formatMoney, formatCostPerKm, formatTread, formatNumber, formatDate,
} from '../constants/maintenance';

// M3-M06 / M3-M07 / M3-M08 — the tyre master.
//
// Two views of the same data, because a fleet asks two different questions of
// it. The register answers "what do we own and what is it costing"; the layout
// answers "what is on this vehicle, and is any of it worn out" — which is what
// somebody standing next to a truck actually needs.
export function TyreRegister() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [searchParams] = useSearchParams();

  // The layout view only makes sense for one vehicle at a time, so choosing it
  // without a vehicle selected falls back to the register.
  const [view, setView] = useState(searchParams.get('truck') ? 'layout' : 'register');

  const [tyres, setTyres] = useState([]);
  const [layout, setLayout] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 25 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    search: '',
    truck: searchParams.get('truck') || '',
    status: '',
    dueForReplacement: searchParams.get('due') === 'true',
  });
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ sortBy: 'createdAt', sortDir: 'desc' });

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
      const res = await api.tyres.list(query);
      if (rid !== requestId.current) return;
      setTyres(res.tyres || []);
      setPagination(res.pagination || { page: 1, pages: 1, total: 0, limit: 25 });
      setError('');
    } catch (err) {
      if (rid !== requestId.current) return;
      setError(err.message || 'Failed to load tyres');
    } finally {
      if (rid === requestId.current) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  // The axle diagram, loaded only when a vehicle is chosen and the layout view
  // is showing.
  useEffect(() => {
    (async () => {
      if (view !== 'layout' || !filters.truck) {
        setLayout(null);
        return;
      }
      try {
        setLayout(await api.tyres.layout(filters.truck));
      } catch (err) {
        setError(err.message || 'Failed to load the tyre layout');
        setLayout(null);
      }
    })();
  }, [view, filters.truck]);

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

  // The stat strip is computed from the page in hand rather than fetched: these
  // describe the current selection, and the tyre reports screen carries the
  // fleet-wide figures.
  const onRoad = tyres.filter((t) => t.truck).length;
  const worn = tyres.filter(
    (t) => t.treadDepthMm !== null && t.treadDepthMm !== undefined && t.treadDepthMm <= 3
  ).length;
  const withCost = tyres.filter((t) => t.costPerKm !== null && t.costPerKm !== undefined);
  const avgCostPerKm = withCost.length
    ? withCost.reduce((s, t) => s + t.costPerKm, 0) / withCost.length
    : null;

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
                <h1 className="text-3xl font-bold text-slate-900">Tyres</h1>
                <p className="text-slate-600 mt-1">
                  What is fitted where, how far each has run, and what it costs per kilometre
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* The two views. Layout needs a vehicle, so it says so rather
                  than rendering an empty diagram. */}
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setView('register')}
                  className={`flex items-center gap-1 px-3 py-2 text-sm ${
                    view === 'register' ? 'bg-slate-100 text-slate-900' : 'bg-white text-slate-600'
                  }`}
                >
                  <List className="w-4 h-4" /> Register
                </button>
                <button
                  onClick={() => setView('layout')}
                  className={`flex items-center gap-1 px-3 py-2 text-sm ${
                    view === 'layout' ? 'bg-slate-100 text-slate-900' : 'bg-white text-slate-600'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" /> Layout
                </button>
              </div>
              {can('maintenance', 'create') && (
                <button
                  onClick={() => navigate('/maintenance/tyres/new')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Tyre
                </button>
              )}
            </div>
          </div>

          <Banner tone="error" message={error} onDismiss={() => setError('')} />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile
              label="In this selection"
              value={pagination.total}
              hint={`${onRoad} on vehicles`}
              icon={Disc3} bg="bg-blue-50" fg="text-blue-600"
            />
            <StatTile
              label="Worn"
              value={worn}
              hint="at or under 3mm on this page"
              icon={AlertTriangle}
              bg={worn ? 'bg-red-50' : 'bg-slate-50'}
              fg={worn ? 'text-red-600' : 'text-slate-400'}
              onClick={() => setFilter({ dueForReplacement: true })}
            />
            <StatTile
              label="Avg cost per km"
              value={formatCostPerKm(avgCostPerKm)}
              hint={`across ${withCost.length} measured`}
              icon={IndianRupee} bg="bg-green-50" fg="text-green-600"
            />
            <StatTile
              label="Distance run"
              value={formatNumber(
                tyres.reduce((s, t) => s + (t.runningKm || 0), 0),
                { decimals: 0, suffix: 'km' }
              )}
              hint="on this page"
              icon={Gauge} bg="bg-indigo-50" fg="text-indigo-600"
            />
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search tyre number, brand, size or vehicle..."
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
              {TYRE_STATUSES.map((s) => (
                <option key={s} value={s}>{TYRE_STATUS_LABELS[s]}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-600 whitespace-nowrap">
              <input
                type="checkbox"
                checked={filters.dueForReplacement}
                onChange={(e) => setFilter({ dueForReplacement: e.target.checked })}
                className="rounded border-slate-300"
              />
              Due for replacement
            </label>
            {/* Sorting on cost per km is what turns the register into a
                purchasing decision — the cheap tyre that wore out in 20,000 km
                was not the cheap one. */}
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
              <option value="tyreNumber:asc">Tyre number</option>
              <option value="costPerKm:desc">Costliest per km</option>
              <option value="costPerKm:asc">Cheapest per km</option>
              <option value="runningKm:desc">Most distance run</option>
              <option value="treadDepthMm:asc">Least tread left</option>
            </select>
          </div>

          {view === 'layout' ? (
            <TyreLayout
              layout={layout}
              truckSelected={Boolean(filters.truck)}
              onOpen={(tyreId) => navigate(`/maintenance/tyres/${tyreId}`)}
            />
          ) : (
            <Panel className="overflow-hidden">
              {loading && !tyres.length ? (
                <div className="p-10 text-center text-slate-500">Loading tyres…</div>
              ) : !tyres.length ? (
                <EmptyState
                  icon={Disc3}
                  title="No tyres match"
                  hint="Add a tyre to the master, then fit it to a vehicle so its distance starts being measured."
                />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <Th>Tyre</Th>
                          <Th>Brand / size</Th>
                          <Th>Status</Th>
                          <Th>Fitted to</Th>
                          <Th align="right">Tread</Th>
                          <Th align="right">Distance run</Th>
                          <Th align="right">Cost</Th>
                          <Th align="right">Cost per km</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tyres.map((tyre) => (
                          <tr
                            key={tyre._id}
                            onClick={() => navigate(`/maintenance/tyres/${tyre._id}`)}
                            className="hover:bg-slate-50 cursor-pointer"
                          >
                            <td className="px-4 py-4">
                              <p className="text-sm font-medium text-slate-900">{tyre.tyreNumber}</p>
                              {tyre.serialNumber ? (
                                <p className="text-xs text-slate-500">{tyre.serialNumber}</p>
                              ) : null}
                            </td>
                            <td className="px-4 py-4">
                              <p className="text-sm text-slate-900">{tyre.brand || '—'}</p>
                              <p className="text-xs text-slate-500">{tyre.size || ''}</p>
                            </td>
                            <td className="px-4 py-4"><TyreStatusPill status={tyre.status} /></td>
                            <td className="px-4 py-4">
                              {tyre.vehicleNumber ? (
                                <>
                                  <p className="text-sm text-slate-900">{tyre.vehicleNumber}</p>
                                  <p className="text-xs text-slate-500">{tyre.position}</p>
                                </>
                              ) : (
                                <span className="text-sm text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-right whitespace-nowrap">
                              <p
                                className={`text-sm ${
                                  tyre.treadDepthMm !== null && tyre.treadDepthMm <= 3
                                    ? 'text-red-600 font-medium'
                                    : 'text-slate-700'
                                }`}
                              >
                                {formatTread(tyre.treadDepthMm)}
                              </p>
                              {tyre.treadCheckedAt ? (
                                <p className="text-xs text-slate-500">{formatDate(tyre.treadCheckedAt)}</p>
                              ) : null}
                            </td>
                            <td className="px-4 py-4 text-right text-sm text-slate-700 whitespace-nowrap">
                              {formatNumber(tyre.runningKm, { decimals: 0, suffix: 'km' })}
                              {tyre.ratedKm ? (
                                <p className="text-xs text-slate-500">
                                  of {formatNumber(tyre.ratedKm, { decimals: 0 })} rated
                                </p>
                              ) : null}
                            </td>
                            <td className="px-4 py-4 text-right text-sm text-slate-700 whitespace-nowrap">
                              {formatMoney(tyre.price)}
                              {tyre.retreadCost ? (
                                <p className="text-xs text-slate-500">
                                  +{formatMoney(tyre.retreadCost)} retread
                                </p>
                              ) : null}
                            </td>
                            <td className="px-4 py-4 text-right text-sm font-medium text-slate-900 whitespace-nowrap">
                              {formatCostPerKm(tyre.costPerKm)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {pagination.pages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                      <p className="text-sm text-slate-600">
                        Page {pagination.page} of {pagination.pages} · {pagination.total} tyres
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
          )}
        </div>
      </main>
    </div>
  );
}

// M3-M07 — the axle diagram.
//
// Rows are drawn from TYRE_AXLES rather than from the tyres present, so an
// empty corner shows as an empty corner. A vehicle with no third axle simply
// has no tyres in that row and the row is skipped — which is what "expandable
// for multiple axles" has to mean when the fleet is mixed.
function TyreLayout({ layout, truckSelected, onOpen }) {
  if (!truckSelected) {
    return (
      <Panel>
        <EmptyState
          icon={LayoutGrid}
          title="Choose a vehicle"
          hint="The layout shows what is fitted at each position on one vehicle."
        />
      </Panel>
    );
  }

  if (!layout) {
    return (
      <Panel>
        <div className="p-10 text-center text-slate-500">Loading the tyre layout…</div>
      </Panel>
    );
  }

  const fitted = Object.keys(layout.byPosition || {}).length;

  return (
    <Panel
      title={`${layout.vehicle?.number || 'Vehicle'} — tyre layout`}
      subtitle={`${fitted} fitted · replacement warning at ${layout.minTreadMm}mm`}
    >
      <div className="p-4 space-y-4">
        {TYRE_AXLES.map((axle) => {
          const present = axle.positions.filter((p) => layout.byPosition?.[p]);
          // An axle this vehicle does not have is not drawn — an empty "third
          // axle" row on a two-axle van is noise.
          if (!present.length) return null;

          return (
            <div key={axle.label}>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{axle.label}</p>
              <div className="flex flex-wrap gap-3">
                {axle.positions.map((position) => {
                  const tyre = layout.byPosition?.[position];
                  if (!tyre) return null;
                  return (
                    <button
                      key={position}
                      type="button"
                      onClick={() => onOpen(tyre._id)}
                      className={`text-left border rounded-lg p-3 w-48 transition-colors ${
                        tyre.dueForReplacement
                          ? 'border-red-300 bg-red-50 hover:bg-red-100'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <p className="text-xs text-slate-500">{position}</p>
                      <p className="text-sm font-medium text-slate-900">{tyre.tyreNumber}</p>
                      <p className="text-xs text-slate-500">
                        {tyre.brand} {tyre.size}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span
                          className={`text-xs font-medium ${
                            tyre.dueForReplacement ? 'text-red-700' : 'text-slate-600'
                          }`}
                        >
                          {formatTread(tyre.treadDepthMm)}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatNumber(tyre.runningKm, { decimals: 0, suffix: 'km' })}
                        </span>
                      </div>
                      {tyre.dueForReplacement && (
                        <p className="text-xs text-red-700 mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> replace
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {fitted === 0 && (
          <EmptyState
            icon={Disc3}
            title="No tyres fitted to this vehicle"
            hint="Fit a tyre from the register and it appears here at its position."
          />
        )}
      </div>
    </Panel>
  );
}

function Th({ children, align = 'left' }) {
  return (
    <th className={`px-4 py-3 text-${align} text-xs font-medium text-slate-500 uppercase tracking-wider`}>
      {children}
    </th>
  );
}
