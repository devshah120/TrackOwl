import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, IndianRupee, Wrench, TrendingUp } from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { maintenance as api, fleet } from '../services/api';
import { StatTile, Panel, EmptyState, Banner } from '../components/maintenance/MaintenanceUI';
import {
  SERVICE_TYPES, SERVICE_TYPE_LABELS,
  formatMoney, formatNumber, formatCostPerKm, formatDate, formatHours, formatTread,
} from '../constants/maintenance';

// M3-M11 — the maintenance reports: vehicle, service, repair, parts, tyres,
// battery, cost and vendor.
//
// One tab per grouping rather than a single table with a "group by" control,
// because each grouping genuinely has its own columns: a vehicle row carries a
// cost per kilometre, a tyre row carries a tread depth, a vendor row carries an
// estimate variance. A union of all of them would be a table of mostly-empty
// cells.
//
// Every figure arrives computed. The money reports read both the service and
// repair collections and merge them server-side — a brake pad fitted at a
// service and one fitted at a breakdown are the same spend, and a report that
// saw only one of them would be wrong in a way nobody would notice.

const TABS = [
  { id: 'vehicle', label: 'By vehicle' },
  { id: 'service', label: 'By service type' },
  { id: 'vendor', label: 'By vendor' },
  { id: 'part', label: 'By part' },
  { id: 'tyre', label: 'Tyres' },
  { id: 'battery', label: 'Batteries' },
  { id: 'repair', label: 'Repairs' },
  { id: 'period', label: 'Over time' },
];

export function MaintenanceReports() {
  const navigate = useNavigate();

  const [tab, setTab] = useState('vehicle');
  const [filters, setFilters] = useState({ from: '', to: '', truck: '', serviceType: '' });
  const [granularity, setGranularity] = useState('month');

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fleet.list();
        setTrucks(res.trucks || []);
      } catch {
        // The vehicle filter is a convenience.
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // The summary is fetched alongside every tab so the headline numbers
      // always describe the same filtered set the table below does.
      const summaryPromise = api.summary(filters);

      const data =
        tab === 'period'
          ? await api.trend({ ...filters, granularity })
          : await api.report(tab, filters);

      setRows(data.rows || []);
      setSummary((await summaryPromise)?.totals || null);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load the report');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab, filters, granularity]);

  // Wrapped in an async IIFE so the loader's first setState lands in a
  // continuation rather than synchronously in the effect body.
  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  const setFilter = (patch) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full space-y-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/maintenance')}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
              title="Back to maintenance"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Maintenance Reports</h1>
              <p className="text-slate-600 mt-1">
                What the fleet spends on keeping itself on the road, and where it goes
              </p>
            </div>
          </div>

          <Banner tone="error" message={error} onDismiss={() => setError('')} />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile
              label="Total spend"
              value={summary ? formatMoney(summary.total) : '—'}
              hint={summary ? `${summary.services + summary.repairs} jobs` : ''}
              icon={IndianRupee} bg="bg-green-50" fg="text-green-600"
            />
            <StatTile
              label="Scheduled service"
              value={summary ? formatMoney(summary.serviceCost) : '—'}
              hint={summary ? `${summary.services} visits` : ''}
              icon={Wrench} bg="bg-blue-50" fg="text-blue-600"
            />
            <StatTile
              label="Repairs"
              value={summary ? formatMoney(summary.repairCost) : '—'}
              hint={summary ? `${summary.repairs} completed` : ''}
              icon={Wrench} bg="bg-orange-50" fg="text-orange-600"
            />
            <StatTile
              label="Unplanned share"
              value={
                summary?.unplannedShare !== null && summary?.unplannedShare !== undefined
                  ? `${formatNumber(summary.unplannedShare, { decimals: 0 })}%`
                  : '—'
              }
              // The most telling number here: a fleet whose repair spend dwarfs
              // its service spend is one that is not servicing enough.
              hint="the higher this is, the less is being planned"
              icon={TrendingUp}
              bg={summary?.unplannedShare > 50 ? 'bg-amber-50' : 'bg-slate-50'}
              fg={summary?.unplannedShare > 50 ? 'text-amber-600' : 'text-slate-400'}
            />
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-wrap items-center gap-4">
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
            {tab === 'period' && (
              <select
                value={granularity}
                onChange={(e) => setGranularity(e.target.value)}
                className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="day">By day</option>
                <option value="month">By month</option>
                <option value="year">By year</option>
              </select>
            )}
            {(filters.from || filters.to || filters.truck || filters.serviceType) && (
              <button
                onClick={() => setFilter({ from: '', to: '', truck: '', serviceType: '' })}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <Panel className="overflow-hidden mb-6">
            {loading ? (
              <div className="p-10 text-center text-slate-500">Building the report…</div>
            ) : !rows.length ? (
              <EmptyState
                icon={Wrench}
                title="Nothing to report"
                hint="No maintenance in this period matches those filters."
              />
            ) : (
              <div className="overflow-x-auto">
                <ReportTable tab={tab} rows={rows} granularity={granularity} />
              </div>
            )}
          </Panel>
        </div>
      </main>
    </div>
  );
}

// One table per grouping. Each knows its own columns — see the note at the top
// about why this is not a single generic table.
function ReportTable({ tab, rows, granularity }) {
  if (tab === 'vehicle') {
    return (
      <Table
        head={['Vehicle', 'Jobs', 'Service', 'Repair', 'Parts', 'Labour', 'Total', 'Cost/km']}
        aligns={['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right']}
      >
        {rows.map((r) => (
          <tr key={r.key} className="hover:bg-slate-50">
            <Td>
              <p className="text-sm font-medium text-slate-900">{r.vehicleNumber || '—'}</p>
              <p className="text-xs text-slate-500">{r.model || r.vehicleType || ''}</p>
            </Td>
            <Td right>{r.jobs}</Td>
            <Td right>{r.services}</Td>
            <Td right>{r.repairs}</Td>
            <Td right>{formatMoney(r.partsTotal)}</Td>
            <Td right>{formatMoney(r.labourCost)}</Td>
            <Td right strong>{formatMoney(r.totalCost)}</Td>
            {/* Null where the service records carry no odometer spread — a
                vehicle serviced once has no distance to divide by. */}
            <Td right>{formatCostPerKm(r.costPerKm)}</Td>
          </tr>
        ))}
      </Table>
    );
  }

  if (tab === 'service') {
    return (
      <Table
        head={['Service type', 'Jobs', 'Vehicles', 'Parts', 'Labour', 'Total', 'Average', 'Last done']}
        aligns={['left', 'right', 'right', 'right', 'right', 'right', 'right', 'left']}
      >
        {rows.map((r) => (
          <tr key={r.key} className="hover:bg-slate-50">
            <Td>{SERVICE_TYPE_LABELS[r.serviceType] || r.serviceType}</Td>
            <Td right>{r.jobs}</Td>
            <Td right>{r.vehicles}</Td>
            <Td right>{formatMoney(r.partsTotal)}</Td>
            <Td right>{formatMoney(r.labourCost)}</Td>
            <Td right strong>{formatMoney(r.totalCost)}</Td>
            {/* What one job of this type typically costs — the figure that
                makes a quote checkable. */}
            <Td right>{formatMoney(r.avgCost)}</Td>
            <Td>{formatDate(r.lastAt)}</Td>
          </tr>
        ))}
      </Table>
    );
  }

  if (tab === 'vendor') {
    return (
      <Table
        head={['Vendor', 'Type', 'Jobs', 'Service', 'Repair', 'Total', 'Vs estimate']}
        aligns={['left', 'left', 'right', 'right', 'right', 'right', 'right']}
      >
        {rows.map((r) => (
          <tr key={r.key} className="hover:bg-slate-50">
            <Td>
              <p className="text-sm font-medium text-slate-900">{r.vendor}</p>
              <p className="text-xs text-slate-500">{r.city || ''}</p>
            </Td>
            <Td>{r.type || '—'}</Td>
            <Td right>{r.jobs}</Td>
            <Td right>{r.services}</Td>
            <Td right>{r.repairs}</Td>
            <Td right strong>{formatMoney(r.totalCost)}</Td>
            <Td right>
              {/* Who quotes low and bills high. Only present where the jobs
                  carried an estimate to compare against. */}
              {r.estimateVariancePct === null || r.estimateVariancePct === undefined ? (
                <span className="text-slate-400">—</span>
              ) : (
                <span
                  className={
                    r.estimateVariancePct > 10
                      ? 'text-red-600 font-medium'
                      : r.estimateVariancePct < -5
                        ? 'text-green-700'
                        : 'text-slate-700'
                  }
                >
                  {r.estimateVariancePct > 0 ? '+' : ''}
                  {formatNumber(r.estimateVariancePct, { decimals: 1 })}%
                </span>
              )}
            </Td>
          </tr>
        ))}
      </Table>
    );
  }

  if (tab === 'part') {
    return (
      <Table
        head={['Part', 'Part no.', 'Lines', 'Vehicles', 'Quantity', 'Avg price', 'Total', 'Last fitted']}
        aligns={['left', 'left', 'right', 'right', 'right', 'right', 'right', 'left']}
      >
        {rows.map((r) => (
          <tr key={r.key} className="hover:bg-slate-50">
            <Td strong>{r.name}</Td>
            <Td>{r.partNumber || '—'}</Td>
            <Td right>
              {r.lines}
              <p className="text-xs text-slate-500">
                {r.services} svc · {r.repairs} rep
              </p>
            </Td>
            <Td right>{r.vehicles}</Td>
            <Td right>{formatNumber(r.quantity, { decimals: 0 })}</Td>
            <Td right>{formatMoney(r.avgUnitPrice)}</Td>
            <Td right strong>{formatMoney(r.totalCost)}</Td>
            <Td>{formatDate(r.lastAt)}</Td>
          </tr>
        ))}
      </Table>
    );
  }

  if (tab === 'tyre') {
    return (
      <Table
        head={['Brand / size', 'Tyres', 'Fitted', 'Scrapped', 'Distance', 'Spend', 'Cost/km', 'Avg life', 'Avg tread']}
        aligns={['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right']}
      >
        {rows.map((r) => (
          <tr key={r.key} className="hover:bg-slate-50">
            <Td>
              <p className="text-sm font-medium text-slate-900">{r.brand}</p>
              <p className="text-xs text-slate-500">{r.size}</p>
            </Td>
            <Td right>
              {r.tyres}
              {r.retreaded ? (
                <p className="text-xs text-slate-500">{r.retreaded} retread</p>
              ) : null}
            </Td>
            <Td right>{r.fitted}</Td>
            <Td right>{r.scrapped}</Td>
            <Td right>{formatNumber(r.totalKm, { decimals: 0, suffix: 'km' })}</Td>
            <Td right>{formatMoney(r.totalCost)}</Td>
            {/* M3-M08 at brand level: total spend over total distance, not the
                average of each tyre's own ratio. */}
            <Td right strong>{formatCostPerKm(r.costPerKm)}</Td>
            {/* Only tyres that finished tell you what a tyre lasts. */}
            <Td right>
              {r.avgLifeKm === null ? (
                <span className="text-slate-400">—</span>
              ) : (
                formatNumber(r.avgLifeKm, { decimals: 0, suffix: 'km' })
              )}
            </Td>
            <Td right>{formatTread(r.avgTreadMm)}</Td>
          </tr>
        ))}
      </Table>
    );
  }

  if (tab === 'battery') {
    return (
      <Table
        head={['Brand', 'Batteries', 'Fitted', 'Scrapped', 'Claims', 'Spend', 'Avg cost', 'Avg life']}
        aligns={['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right']}
      >
        {rows.map((r) => (
          <tr key={r.key} className="hover:bg-slate-50">
            <Td strong>{r.brand}</Td>
            <Td right>{r.batteries}</Td>
            <Td right>{r.fitted}</Td>
            <Td right>{r.scrapped}</Td>
            <Td right>{r.warrantyClaims}</Td>
            <Td right>{formatMoney(r.totalCost)}</Td>
            <Td right>{formatMoney(r.avgCost)}</Td>
            <Td right>
              {r.avgLifeMonths === null ? (
                <span className="text-slate-400">—</span>
              ) : (
                `${formatNumber(r.avgLifeMonths, { decimals: 1 })} mo`
              )}
            </Td>
          </tr>
        ))}
      </Table>
    );
  }

  if (tab === 'repair') {
    return (
      <Table
        head={['Status', 'Priority', 'Jobs', 'Estimated', 'Actual', 'Downtime', 'Avg downtime']}
        aligns={['left', 'left', 'right', 'right', 'right', 'right', 'right']}
      >
        {rows.map((r) => (
          <tr key={r.key} className="hover:bg-slate-50">
            <Td strong>{r.status}</Td>
            <Td>{r.priority}</Td>
            <Td right>{r.jobs}</Td>
            <Td right>{r.estimatedCost ? formatMoney(r.estimatedCost) : '—'}</Td>
            <Td right>{formatMoney(r.totalCost)}</Td>
            <Td right>{formatHours(r.downtimeHours)}</Td>
            <Td right>{formatHours(r.avgDowntimeHours)}</Td>
          </tr>
        ))}
      </Table>
    );
  }

  // Over time.
  return (
    <Table
      head={[granularity === 'year' ? 'Year' : granularity === 'day' ? 'Day' : 'Month',
        'Jobs', 'Service', 'Repair', 'Parts', 'Labour', 'Total', 'Downtime']}
      aligns={['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right']}
    >
      {rows.map((r) => (
        <tr key={r.period} className="hover:bg-slate-50">
          <Td strong>{r.period}</Td>
          <Td right>{r.jobs}</Td>
          <Td right>{r.services}</Td>
          <Td right>{r.repairs}</Td>
          <Td right>{formatMoney(r.partsTotal)}</Td>
          <Td right>{formatMoney(r.labourCost)}</Td>
          <Td right strong>{formatMoney(r.totalCost)}</Td>
          <Td right>{formatHours(r.downtimeHours)}</Td>
        </tr>
      ))}
    </Table>
  );
}

function Table({ head, aligns = [], children }) {
  return (
    <table className="w-full">
      <thead className="bg-slate-50 border-b border-slate-200">
        <tr>
          {head.map((label, i) => (
            <th
              key={label}
              className={`px-4 py-3 text-${aligns[i] || 'left'} text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap`}
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">{children}</tbody>
    </table>
  );
}

function Td({ children, right, strong }) {
  return (
    <td
      className={`px-4 py-3 whitespace-nowrap ${right ? 'text-right' : ''} ${
        strong ? 'text-sm font-medium text-slate-900' : 'text-sm text-slate-700'
      }`}
    >
      {children}
    </td>
  );
}
