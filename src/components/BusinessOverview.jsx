import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell } from 'recharts';
import { Route, Activity, IndianRupee, Receipt, Wallet, TrendingUp, TrendingDown, AlertTriangle, Clock } from 'lucide-react';
import { finance } from '../services/api';
import { formatCurrency, formatDate, TRIP_STATUS_LABELS, TRIP_STATUS_COLORS } from '../constants/trip';

// The business half of the dashboard (brief §2): this month's money, the
// revenue/expense/profit trend, where trips stand, which vehicles earn and
// which lose, and what needs attention. One request to /finance/dashboard; the
// server leaves out any block the seat may not see, and this component simply
// does not render it.
const COLORS = { revenue: '#2563eb', expenses: '#f59e0b', profit: '#16a34a' };

const STATUS_TILES = [
  { key: 'planned', label: 'Planned', color: 'bg-slate-100 text-slate-700' },
  { key: 'ongoing', label: 'Ongoing', color: 'bg-indigo-100 text-indigo-800' },
  { key: 'delayed', label: 'Delayed', color: 'bg-red-100 text-red-700' },
  { key: 'awaitingSettlement', label: 'Awaiting settlement', color: 'bg-amber-100 text-amber-800' },
  { key: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800' },
  { key: 'cancelled', label: 'Cancelled', color: 'bg-slate-200 text-slate-600' },
];

export function BusinessOverview() {
  const navigate = useNavigate();
  const [months, setMonths] = useState(6);
  const [efficiencyView, setEfficiencyView] = useState('cost');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    finance
      .dashboard(months)
      .then((r) => !cancelled && setData(r))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [months]);

  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>;
  if (!data) return <div className="text-sm text-slate-500">Loading business overview…</div>;

  const f = data.finance;
  const t = data.trips;
  const vehicles = f?.vehicles || [];
  const ranked = [...vehicles].sort((a, b) => b.contribution - a.contribution);
  const chartVehicles = [...ranked.slice(0, 5), ...ranked.slice(5).filter((v) => v.lossMaking).slice(-5)];
  const costPerKm = vehicles.filter((v) => v.costPerKm !== null).sort((a, b) => b.costPerKm - a.costPerKm).slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {t && <Kpi label="Trips this month" value={t.thisMonth} icon={Route} onClick={() => navigate('/trips')} />}
        {t && <Kpi label="Active trips" value={t.active} hint={t.status.delayed ? `${t.status.delayed} delayed` : 'On the road now'} icon={Activity} tone={t.status.delayed ? 'warn' : 'neutral'} onClick={() => navigate('/trips')} />}
        {f && <Kpi label="Revenue (month)" value={formatCurrency(f.monthRevenue)} icon={IndianRupee} onClick={() => navigate('/finance')} />}
        {f && <Kpi label="Expenses (month)" value={formatCurrency(f.monthExpenses)} icon={Receipt} onClick={() => navigate('/finance')} />}
        {f && <Kpi label="Pending payments" value={formatCurrency(f.receivables.balance)} hint={f.overdueReceivables.balance ? `${formatCurrency(f.overdueReceivables.balance)} overdue` : `${f.receivables.invoices} open invoice(s)`} icon={Wallet} tone={f.overdueReceivables.balance ? 'bad' : 'neutral'} onClick={() => navigate('/invoices?status=outstanding')} />}
        {f && <Kpi label="Net profit (month)" value={formatCurrency(f.monthNetProfit)} icon={f.monthNetProfit >= 0 ? TrendingUp : TrendingDown} tone={f.monthNetProfit >= 0 ? 'good' : 'bad'} onClick={() => navigate('/finance')} />}
      </div>

      {f && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card
            title="Revenue vs expenses vs profit"
            className="xl:col-span-2"
            action={
              <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="px-2 py-1 border border-slate-200 rounded text-sm">
                <option value={6}>6 months</option>
                <option value={12}>12 months</option>
              </select>
            }
          >
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={f.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} width={64} tickFormatter={(v) => `₹${Math.round(v / 1000).toLocaleString('en-IN')}k`} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill={COLORS.revenue} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill={COLORS.expenses} radius={[3, 3, 0, 0]} />
                  <Line dataKey="profit" name="Profit" stroke={COLORS.profit} strokeWidth={2} dot />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Vehicle profitability (month)" action={<button type="button" onClick={() => navigate('/finance')} className="text-sm text-blue-600 hover:underline">All vehicles</button>}>
            {chartVehicles.length ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartVehicles} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
                    <YAxis type="category" dataKey="number" width={90} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                    <Bar dataKey="contribution" name="Contribution">
                      {chartVehicles.map((v) => (
                        <Cell key={v.truck} fill={v.contribution < 0 ? '#dc2626' : '#16a34a'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-10 text-center">No vehicle activity this month yet.</p>
            )}
            <p className="text-xs text-slate-500 mt-2">Red = loss-making. Before overheads.</p>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {t && (
          <Card title="Trip status">
            <div className="grid grid-cols-2 gap-3">
              {STATUS_TILES.map((s) => (
                <button key={s.key} type="button" onClick={() => navigate('/trips')} className={`rounded-lg px-3 py-3 text-left ${s.color}`}>
                  <p className="text-xs font-medium">{s.label}</p>
                  <p className="text-2xl font-bold">{t.status[s.key] ?? 0}</p>
                </button>
              ))}
            </div>
            {data.utilisation && (
              <div className="mt-4">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Vehicles on a trip now</span>
                  <span className="font-medium text-slate-900">
                    {data.utilisation.onTripNow} / {data.utilisation.vehicles} ({data.utilisation.pct}%)
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-blue-600" style={{ width: `${data.utilisation.pct}%` }} />
                </div>
              </div>
            )}
          </Card>
        )}

        {(f || data.fuel) && (
          <Card
            title={efficiencyView === 'cost' ? 'Cost per km by vehicle (month)' : 'Mileage by vehicle (90 days)'}
            action={
              <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
                {f && (
                  <button type="button" onClick={() => setEfficiencyView('cost')} className={`px-2 py-1 ${efficiencyView === 'cost' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>
                    ₹ / km
                  </button>
                )}
                {data.fuel && (
                  <button type="button" onClick={() => setEfficiencyView('mileage')} className={`px-2 py-1 ${efficiencyView === 'mileage' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>
                    km / L
                  </button>
                )}
              </div>
            }
          >
            {efficiencyView === 'mileage' || !f ? (
              data.fuel?.vehicles?.length ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.fuel.vehicles} margin={{ left: 0, right: 8 }}>
                      <XAxis dataKey="number" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 11 }} width={40} />
                      <Tooltip formatter={(v, n, p) => [`${v} km/L${p.payload.vsFleetPct !== null ? ` (${p.payload.vsFleetPct > 0 ? '+' : ''}${p.payload.vsFleetPct}% vs fleet)` : ''}`, 'Mileage']} />
                      <Bar dataKey="kmPerUnit" name="km / L" radius={[3, 3, 0, 0]}>
                        {data.fuel.vehicles.map((v) => (
                          <Cell key={`${v.truck}-${v.fuelType}`} fill={v.vsFleetPct !== null && v.vsFleetPct < -10 ? '#dc2626' : '#16a34a'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-slate-500 mt-1">Full-tank to full-tank. Red = over 10% below the fleet average.</p>
                </div>
              ) : (
                <p className="text-sm text-slate-500 py-10 text-center">Needs at least two full-tank fillings per vehicle with odometer readings.</p>
              )
            ) : costPerKm.length ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costPerKm} margin={{ left: 0, right: 8 }}>
                    <XAxis dataKey="number" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11 }} width={48} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip formatter={(v) => `${formatCurrency(v)} / km`} />
                    <Bar dataKey="costPerKm" name="Cost / km" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-10 text-center">Needs trips with start and end odometer readings.</p>
            )}
          </Card>
        )}

        <Card title="Needs attention" action={<button type="button" onClick={() => navigate('/alerts')} className="text-sm text-blue-600 hover:underline">All alerts</button>}>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {f?.unbilledTrips?.count > 0 && (
              <Attention icon={Receipt} tone="warn" title={`${f.unbilledTrips.count} finished trip(s) not invoiced`} detail={formatCurrency(f.unbilledTrips.amount)} onClick={() => navigate('/invoices/new')} />
            )}
            {(data.overdueInvoices || []).map((inv) => (
              <Attention key={inv._id} icon={Clock} tone="bad" title={`${inv.invoiceNumber} — ${inv.billTo?.name}`} detail={`${formatCurrency(inv.totals.balance)} · ${inv.daysOverdue} day(s) overdue`} onClick={() => navigate(`/invoices/${inv._id}`)} />
            ))}
            {data.alerts.map((a) => (
              <Attention key={a._id} icon={AlertTriangle} tone={a.severity === 'critical' ? 'bad' : 'warn'} title={a.title} detail={a.message} onClick={() => navigate('/alerts')} />
            ))}
            {!data.alerts.length && !(data.overdueInvoices || []).length && !f?.unbilledTrips?.count && (
              <p className="text-sm text-slate-500 py-8 text-center">Nothing needs attention right now.</p>
            )}
          </div>
        </Card>
      </div>

      {t?.recent?.length > 0 && (
        <Card title="Recent trips" action={<button type="button" onClick={() => navigate('/trips')} className="text-sm text-blue-600 hover:underline">All trips</button>}>
          <div className="overflow-x-auto -mx-4">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Trip', 'Date', 'Route', 'Vehicle', 'Status', 'Profit'].map((h) => (
                    <th key={h} className={`px-4 py-2 text-xs font-semibold text-slate-700 uppercase ${h === 'Profit' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {t.recent.map((trip) => (
                  <tr key={trip._id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/trips/${trip._id}`)}>
                    <td className="px-4 py-2 text-sm font-medium text-blue-700">{trip.tripNumber}</td>
                    <td className="px-4 py-2 text-sm text-slate-600">{formatDate(trip.tripDate)}</td>
                    <td className="px-4 py-2 text-sm text-slate-700">{trip.pickup?.city || '—'} → {trip.destination?.city || '—'}</td>
                    <td className="px-4 py-2 text-sm text-slate-700">{trip.vehicleNumber || '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TRIP_STATUS_COLORS[trip.status] || 'bg-slate-100 text-slate-700'}`}>{TRIP_STATUS_LABELS[trip.status] || trip.status}</span>
                    </td>
                    <td className={`px-4 py-2 text-sm text-right tabular-nums ${trip.totals?.profit < 0 ? 'text-red-600' : 'text-slate-900'}`}>{formatCurrency(trip.totals?.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Kpi({ label, value, hint, icon: Icon, tone = 'neutral', onClick }) {
  const colors = {
    neutral: 'bg-blue-50 text-blue-600',
    good: 'bg-green-50 text-green-600',
    bad: 'bg-red-50 text-red-600',
    warn: 'bg-amber-50 text-amber-600',
  };
  return (
    <button type="button" onClick={onClick} className="bg-white rounded-lg border border-slate-200 p-4 text-left hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-slate-600">{label}</p>
        <span className={`p-1.5 rounded-lg ${colors[tone]}`}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <p className={`text-xl font-bold mt-1 truncate ${tone === 'bad' ? 'text-red-600' : tone === 'good' ? 'text-green-700' : 'text-slate-900'}`}>{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-0.5 truncate">{hint}</p>}
    </button>
  );
}

function Card({ title, action, children, className = '' }) {
  return (
    <div className={`bg-white rounded-lg border border-slate-200 ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Attention({ icon: Icon, tone, title, detail, onClick }) {
  const color = tone === 'bad' ? 'text-red-600 bg-red-50' : 'text-amber-600 bg-amber-50';
  return (
    <button type="button" onClick={onClick} className="w-full flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 text-left">
      <span className={`p-1.5 rounded-lg shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-900 truncate">{title}</span>
        <span className="block text-xs text-slate-500 truncate">{detail}</span>
      </span>
    </button>
  );
}
