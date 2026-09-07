import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Truck, User, Building2, Route, TrendingUp, AlertTriangle, Fuel, IndianRupee,
} from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { fuel as fuelApi, fleet } from '../services/api';
import {
  FUEL_TYPES, FUEL_TYPE_LABELS,
  formatMoney, formatNumber, formatKmPerUnit, formatCostPerKm, formatPer100Km, formatDate,
} from '../constants/fuel';

// M3-F07 — the fuel reports. Consumption, cost and efficiency grouped by
// vehicle, driver, station, trip or period.
//
// Every figure here is aggregated in the database and arrives computed. In
// particular the group mileage is total distance ÷ total fuel, not the average
// of the per-entry ratios: averaging ratios would weight a 20-litre top-up the
// same as a 400-litre fill and drift away from the truth. That reasoning lives
// in services/fuelReports.js; this page renders the result.

const TABS = [
  { id: 'vehicle', label: 'By vehicle', icon: Truck },
  { id: 'driver', label: 'By driver', icon: User },
  { id: 'station', label: 'By station', icon: Building2 },
  { id: 'trip', label: 'By trip', icon: Route },
  { id: 'period', label: 'Over time', icon: TrendingUp },
  { id: 'efficiency', label: 'Efficiency ranking', icon: Fuel },
];

export function FuelReports() {
  const navigate = useNavigate();

  const [tab, setTab] = useState('vehicle');
  const [filters, setFilters] = useState({ from: '', to: '', truck: '', fuelType: '' });
  const [granularity, setGranularity] = useState('month');

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [fleetAverages, setFleetAverages] = useState({});
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
      const summaryPromise = fuelApi.summary(filters);

      let data;
      if (tab === 'period') {
        data = await fuelApi.trend({ ...filters, granularity });
        setRows(data.rows || []);
      } else if (tab === 'efficiency') {
        data = await fuelApi.efficiency(filters);
        setRows(data.vehicles || []);
        setFleetAverages(data.fleetAverages || {});
      } else {
        data = await fuelApi.report(tab, filters);
        setRows(data.rows || []);
      }

      setSummary(await summaryPromise);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load the report');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab, filters, granularity]);

  // Wrapped in an async IIFE so the loader's first setState lands in a
  // continuation rather than synchronously in the effect body, which would
  // trigger a cascading render.
  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  const totals = summary?.totals;

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full space-y-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/fuel')}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Fuel Reports</h1>
              <p className="text-slate-600 mt-1">
                Consumption, cost and efficiency across the fleet
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatTile label="Fuel purchased" value={totals ? formatNumber(totals.quantity, { decimals: 0 }) : '—'}
              hint={totals ? `${totals.entries} fillings` : ''} icon={Fuel} bg="bg-blue-50" fg="text-blue-600" />
            <StatTile label="Total spend" value={totals ? formatMoney(totals.amount) : '—'}
              icon={IndianRupee} bg="bg-green-50" fg="text-green-600" />
            <StatTile label="Distance" value={totals?.distanceKm ? `${formatNumber(totals.distanceKm, { decimals: 0 })} km` : '—'}
              hint="measured" icon={Route} bg="bg-indigo-50" fg="text-indigo-600" />
            <StatTile label="Fleet mileage" value={totals?.kmPerUnit ? formatNumber(totals.kmPerUnit) : '—'}
              hint="km per unit" icon={TrendingUp} bg="bg-teal-50" fg="text-teal-600" />
            <StatTile label="Cost per km" value={totals?.costPerKm ? formatCostPerKm(totals.costPerKm) : '—'}
              icon={IndianRupee} bg="bg-amber-50" fg="text-amber-600" />
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              From
              <input type="date" value={filters.from}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              To
              <input type="date" value={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </label>
            <select value={filters.truck}
              onChange={(e) => setFilters((f) => ({ ...f, truck: e.target.value }))}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All vehicles</option>
              {trucks.map((t) => <option key={t._id} value={t._id}>{t.number}</option>)}
            </select>
            <select value={filters.fuelType}
              onChange={(e) => setFilters((f) => ({ ...f, fuelType: e.target.value }))}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All fuel types</option>
              {FUEL_TYPES.map((t) => <option key={t} value={t}>{FUEL_TYPE_LABELS[t]}</option>)}
            </select>
            {tab === 'period' && (
              <select value={granularity} onChange={(e) => setGranularity(e.target.value)}
                className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="day">Daily</option>
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </select>
            )}
            {(filters.from || filters.to || filters.truck || filters.fuelType) && (
              <button onClick={() => setFilters({ from: '', to: '', truck: '', fuelType: '' })}
                className="text-sm text-blue-600 hover:text-blue-700">
                Clear filters
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="flex overflow-x-auto border-b border-slate-200">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id} onClick={() => setTab(id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    tab === id
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <p className="px-4 py-12 text-center text-slate-500">Building the report…</p>
              ) : rows.length === 0 ? (
                <p className="px-4 py-12 text-center text-slate-500">
                  No fuel data for this selection.
                </p>
              ) : tab === 'efficiency' ? (
                <EfficiencyTable rows={rows} fleetAverages={fleetAverages} />
              ) : (
                <ReportTable tab={tab} rows={rows} />
              )}
            </div>
          </div>

          {/* Where a figure can be absent, say why rather than leaving a dash
              to be guessed at. */}
          <p className="text-xs text-slate-500">
            Mileage and cost per kilometre are measured between full tanks, using the odometer
            readings on each filling. Entries without an odometer reading are costed but do not
            contribute to those figures, and a dash means the distance is not known — never zero.
          </p>
        </div>
      </main>
    </div>
  );
}

// The four grouped reports share a shape, so one table renders all of them and
// only the first column differs.
function ReportTable({ tab, rows }) {
  const firstColumn = {
    vehicle: 'Vehicle',
    driver: 'Driver',
    station: 'Station',
    trip: 'Trip',
    period: 'Period',
  }[tab];

  const label = (row) => {
    if (tab === 'vehicle') return { main: row.vehicleNumber, sub: [row.model, row.vehicleType].filter(Boolean).join(' · ') };
    if (tab === 'driver') return { main: row.driverName, sub: row.mobile };
    if (tab === 'station') return { main: row.station, sub: [row.city, row.state].filter(Boolean).join(', ') };
    if (tab === 'trip') return { main: row.tripNumber, sub: row.route };
    return { main: row.period, sub: '' };
  };

  return (
    <table className="w-full">
      <thead className="bg-slate-50 border-b border-slate-200">
        <tr>
          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{firstColumn}</th>
          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Fillings</th>
          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Quantity</th>
          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Spend</th>
          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Avg rate</th>
          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Distance</th>
          {/* M3-F03 */}
          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Mileage</th>
          {/* M3-F05 */}
          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Per 100 km</th>
          {/* M3-F04 */}
          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Cost/km</th>
          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Flagged</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row, i) => {
          const { main, sub } = label(row);
          return (
            <tr key={i} className="hover:bg-slate-50">
              <td className="px-4 py-4">
                <p className="font-medium text-slate-900">{main}</p>
                {sub && <p className="text-xs text-slate-500">{sub}</p>}
                {tab === 'trip' && row.tripDate && (
                  <p className="text-xs text-slate-400">{formatDate(row.tripDate)}</p>
                )}
              </td>
              <td className="px-4 py-4 text-right text-sm text-slate-700">{row.entries}</td>
              <td className="px-4 py-4 text-right text-sm text-slate-700">
                {formatNumber(row.quantity, { decimals: 1 })}
              </td>
              <td className="px-4 py-4 text-right text-sm font-medium text-slate-900">
                {formatMoney(row.amount)}
              </td>
              <td className="px-4 py-4 text-right text-sm text-slate-700">
                {row.avgRate ? formatMoney(row.avgRate, { decimals: 2 }) : '—'}
              </td>
              <td className="px-4 py-4 text-right text-sm text-slate-700">
                {row.distanceKm ? `${formatNumber(row.distanceKm, { decimals: 0 })} km` : '—'}
              </td>
              <td className="px-4 py-4 text-right text-sm font-medium text-slate-900">
                {row.kmPerUnit ? formatNumber(row.kmPerUnit) : '—'}
              </td>
              <td className="px-4 py-4 text-right text-sm text-slate-700">
                {row.unitsPer100Km ? formatNumber(row.unitsPer100Km) : '—'}
              </td>
              <td className="px-4 py-4 text-right text-sm text-slate-700">
                {formatCostPerKm(row.costPerKm)}
              </td>
              <td className="px-4 py-4 text-right">
                {row.flagged > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                    <AlertTriangle className="w-3 h-3" />
                    {row.flagged}
                  </span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// The fleet ranking behind M3-F06: each vehicle against the average for its own
// fuel type, so a CNG van is never ranked against a diesel tractor.
function EfficiencyTable({ rows, fleetAverages }) {
  return (
    <>
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-4">
        {Object.entries(fleetAverages).map(([fuelType, avg]) => (
          <p key={fuelType} className="text-sm text-slate-600">
            <span className="font-medium text-slate-900">{FUEL_TYPE_LABELS[fuelType] || fuelType}</span>
            {' fleet average: '}
            {avg ? formatKmPerUnit(avg, fuelType) : '—'}
          </p>
        ))}
      </div>

      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Rank</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Vehicle</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Fuel</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Mileage</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">vs fleet</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Per 100 km</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Cost/km</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Distance</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Spend</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={`${row.truck}-${row.fuelType}`} className="hover:bg-slate-50">
              <td className="px-4 py-4 text-sm text-slate-500">{i + 1}</td>
              <td className="px-4 py-4 font-medium text-slate-900">{row.vehicleNumber}</td>
              <td className="px-4 py-4 text-sm text-slate-700">
                {FUEL_TYPE_LABELS[row.fuelType] || row.fuelType}
              </td>
              <td className="px-4 py-4 text-right text-sm font-medium text-slate-900">
                {formatKmPerUnit(row.kmPerUnit, row.fuelType)}
              </td>
              <td className="px-4 py-4 text-right">
                {row.vsFleetPct === null || row.vsFleetPct === undefined ? (
                  <span className="text-slate-300">—</span>
                ) : (
                  <span className={`text-sm font-medium ${
                    row.vsFleetPct >= 0 ? 'text-green-600' : 'text-amber-600'
                  }`}>
                    {row.vsFleetPct > 0 ? '+' : ''}{formatNumber(row.vsFleetPct, { decimals: 1 })}%
                  </span>
                )}
              </td>
              <td className="px-4 py-4 text-right text-sm text-slate-700">
                {formatPer100Km(row.unitsPer100Km, row.fuelType)}
              </td>
              <td className="px-4 py-4 text-right text-sm text-slate-700">
                {formatCostPerKm(row.costPerKm)}
              </td>
              <td className="px-4 py-4 text-right text-sm text-slate-700">
                {row.distanceKm ? `${formatNumber(row.distanceKm, { decimals: 0 })} km` : '—'}
              </td>
              <td className="px-4 py-4 text-right text-sm text-slate-700">
                {formatMoney(row.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
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
