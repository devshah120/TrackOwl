import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { IndianRupee, TrendingUp, TrendingDown, Wallet, FileWarning, Truck, Download } from 'lucide-react';
import { PageShell, PageHeader, StatTile, Panel, Banner, DateRangeBar, Basis, Th, Td, Pill, Button, EmptyState } from '../components/business/BusinessUI';
import { formatCurrency, formatNumber, rangePreset } from '../components/business/helpers';
import { finance as financeApi, reports as reportsApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';

// Finance & Expenses (brief §8): the P&L, vehicle and trip profitability, the
// receivables/payables position and the cash view. Every figure comes from the
// server (services/finance.js); this page only lays them out, and each block
// says how it was calculated.
const TABS = [
  { key: 'pnl', label: 'Profit & Loss' },
  { key: 'vehicles', label: 'Vehicle Profitability' },
  { key: 'trips', label: 'Trip Profitability' },
  { key: 'cash', label: 'Cash Flow' },
];

const TREND_COLORS = { revenue: '#2563eb', expenses: '#f59e0b', profit: '#16a34a' };

export function Finance() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [tab, setTab] = useState('pnl');
  const [range, setRange] = useState(rangePreset('this_month'));
  const [months, setMonths] = useState(6);
  const [data, setData] = useState({});
  const [positions, setPositions] = useState(null);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    financeApi.positions().then((r) => setPositions(r.positions)).catch(() => {});
  }, []);

  useEffect(() => {
    financeApi.trend(months).then((r) => setTrend(r.trend || [])).catch(() => setTrend([]));
  }, [months]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const call =
          tab === 'pnl' ? financeApi.pnl(range) : tab === 'vehicles' ? financeApi.vehicles(range) : tab === 'trips' ? financeApi.trips(range) : financeApi.cashflow(range);
        const res = await call;
        if (!cancelled) setData((d) => ({ ...d, [tab]: res }));
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load finance data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, range]);

  const exportKey = { vehicles: 'vehicle-profitability', trips: 'trip-profitability' }[tab];

  return (
    <PageShell>
      <PageHeader
        title="Finance & Expenses"
        subtitle="Revenue, costs and profit from your trips, fuel, maintenance, bills and ledger — each counted once"
        actions={
          exportKey && can('reports', 'export') ? (
            <>
              <Button variant="secondary" icon={Download} onClick={() => reportsApi.download(exportKey, range, 'xlsx').catch((e) => setError(e.message))}>
                Excel
              </Button>
              <Button variant="secondary" icon={Download} onClick={() => reportsApi.download(exportKey, range, 'pdf').catch((e) => setError(e.message))}>
                PDF
              </Button>
            </>
          ) : null
        }
      />

      {positions && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile label="Receivables" value={formatCurrency(positions.receivables.balance)} hint={`${positions.receivables.invoices} open invoice(s)`} icon={Wallet} bg="bg-blue-50" fg="text-blue-600" onClick={() => navigate('/invoices?status=outstanding')} />
          <StatTile label="Overdue" value={formatCurrency(positions.overdueReceivables.balance)} hint={`${positions.overdueReceivables.invoices} invoice(s) past due`} icon={FileWarning} bg="bg-red-50" fg="text-red-600" onClick={() => navigate('/invoices?status=overdue')} />
          <StatTile label="Payables" value={formatCurrency(positions.payables.balance)} hint={`${positions.payables.bills} vendor bill(s) open`} icon={IndianRupee} bg="bg-amber-50" fg="text-amber-600" onClick={() => navigate('/vendors?tab=bills')} />
          <StatTile label="Unbilled trips" value={formatCurrency(positions.unbilledTrips.amount)} hint={`${positions.unbilledTrips.count} finished trip(s) not invoiced`} icon={Truck} bg="bg-slate-100" fg="text-slate-600" onClick={() => navigate('/invoices/new')} />
        </div>
      )}

      <Panel
        title="Revenue, expenses and profit"
        subtitle="Calendar months, same basis as the P&L below"
        action={
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="px-2 py-1 border border-slate-200 rounded text-sm">
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
          </select>
        }
      >
        <div className="h-72 p-3">
          {trend.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${(v / 1000).toLocaleString('en-IN')}k`} width={70} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill={TREND_COLORS.revenue} radius={[3, 3, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill={TREND_COLORS.expenses} radius={[3, 3, 0, 0]} />
                <Line dataKey="profit" name="Net profit" stroke={TREND_COLORS.profit} strokeWidth={2} dot />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No figures yet" hint="The chart fills in as trips, fuel and expenses are recorded." />
          )}
        </div>
      </Panel>

      <DateRangeBar value={range} onChange={setRange} />

      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Banner message={error} onDismiss={() => setError('')} />
      {loading && !data[tab] ? <p className="text-sm text-slate-500">Loading…</p> : null}

      {tab === 'pnl' && data.pnl && <PnlStatement pnl={data.pnl.pnl} />}
      {tab === 'vehicles' && data.vehicles && <VehicleTable rows={data.vehicles.vehicles} />}
      {tab === 'trips' && data.trips && <TripTable rows={data.trips.trips} onOpen={(id) => navigate(`/trips/${id}`)} />}
      {tab === 'cash' && data.cash && <CashView cash={data.cash.cashflow} />}
    </PageShell>
  );
}

const EXPENSE_LABELS = {
  fuel: 'Fuel',
  toll: 'Toll',
  parking: 'Parking',
  driver_allowance: 'Driver allowance',
  food: 'Food',
  hotel: 'Hotel',
  loading: 'Loading',
  unloading: 'Unloading',
  repair: 'Repair on trip',
  tyre: 'Tyre on trip',
  permit: 'Permit',
  challan: 'Challan',
  miscellaneous: 'Miscellaneous',
};

function Row({ label, value, strong = false, indent = false, negative = false, hint }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 px-4 py-2 ${strong ? 'bg-slate-50 font-semibold text-slate-900' : 'text-slate-700'} ${indent ? 'pl-8 text-sm' : ''}`}>
      <span>
        {label}
        {hint ? <span className="block text-xs font-normal text-slate-500">{hint}</span> : null}
      </span>
      <span className={`tabular-nums ${negative && value > 0 ? 'text-slate-700' : ''} ${strong && value < 0 ? 'text-red-600' : ''}`}>
        {negative && value ? `(${formatCurrency(value)})` : formatCurrency(value)}
      </span>
    </div>
  );
}

function PnlStatement({ pnl }) {
  const d = pnl.directCosts;
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Panel title="Profit & Loss" subtitle={`${pnl.revenue.trips} trip(s) in the period`} className="lg:col-span-2">
        <div className="divide-y divide-slate-100">
          <Row label="Trip revenue (excluding GST)" value={pnl.revenue.tripRevenue} indent />
          <Row label="Other income" value={pnl.revenue.otherIncome} indent />
          <Row label="Total revenue" value={pnl.revenue.total} strong />

          {Object.entries(d.tripExpenseByCategory).map(([cat, v]) => (
            <Row key={cat} label={`Trip: ${EXPENSE_LABELS[cat] || cat}`} value={v} indent negative />
          ))}
          <Row label="Fuel not linked to a trip" value={d.fuelNoTrip} indent negative />
          <Row label="Maintenance (services + completed repairs)" value={d.maintenance} indent negative />
          {d.hiredVehicles ? <Row label="Hired vehicles" value={d.hiredVehicles} indent negative /> : null}
          <Row label="Total direct costs" value={d.total} strong negative />
          <Row label="Gross contribution" value={pnl.grossContribution} strong />

          {pnl.overheads.lines.map((l) => (
            <Row key={l.key} label={l.label} hint={l.source} value={l.amount} indent negative />
          ))}
          <Row label="Total overheads" value={pnl.overheads.total} strong negative />
          <Row label="Operating profit" value={pnl.operatingProfit} strong />

          {pnl.financeCosts.lines.map((l) => (
            <Row key={l.key} label={l.label} value={l.amount} indent negative />
          ))}
          <Row label="Net profit (before tax)" value={pnl.netProfit} strong />
        </div>
      </Panel>

      <div className="space-y-4">
        <StatTile label="Net profit" value={formatCurrency(pnl.netProfit)} hint={pnl.marginPct !== null ? `${pnl.marginPct}% of revenue` : 'No revenue in this period'} icon={pnl.netProfit >= 0 ? TrendingUp : TrendingDown} bg={pnl.netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'} fg={pnl.netProfit >= 0 ? 'text-green-600' : 'text-red-600'} />
        <StatTile label="GST collected (excluded)" value={formatCurrency(pnl.revenue.gstCollectedExcluded)} hint="Owed to the government, not revenue" icon={IndianRupee} />
        {pnl.excludedLedger.length ? (
          <Panel title="Ledger entries left out of the P&L" subtitle="Cash records of costs counted elsewhere, or balance-sheet items">
            <div className="divide-y divide-slate-100 text-sm">
              {pnl.excludedLedger.map((r) => (
                <div key={r.category} className="flex justify-between px-4 py-2">
                  <span>{r.category}</span>
                  <span className="tabular-nums text-slate-600">
                    {r.income ? `+${formatCurrency(r.income)} ` : ''}
                    {r.expense ? `−${formatCurrency(r.expense)}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}
        <Basis lines={pnl.basis} />
      </div>
    </div>
  );
}

function VehicleTable({ rows }) {
  const [onlyLoss, setOnlyLoss] = useState(false);
  const shown = useMemo(() => rows.filter((r) => (onlyLoss ? r.lossMaking : r.trips || r.costs)), [rows, onlyLoss]);
  return (
    <Panel
      title="Vehicle-wise contribution"
      subtitle="Revenue minus each vehicle's own direct costs. Overheads are not allocated."
      action={
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={onlyLoss} onChange={(e) => setOnlyLoss(e.target.checked)} />
          Loss-making only
        </label>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <Th>Vehicle</Th>
              <Th right>Trips</Th>
              <Th right>KM</Th>
              <Th right>Revenue</Th>
              <Th right>Trip exp.</Th>
              <Th right>Fuel (no trip)</Th>
              <Th right>Maintenance</Th>
              <Th right>Other vehicle</Th>
              <Th right>Contribution</Th>
              <Th right>Cost/km</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.length === 0 && (
              <tr>
                <td colSpan={10}>
                  <EmptyState title={onlyLoss ? 'No loss-making vehicles in this period' : 'No vehicle activity in this period'} />
                </td>
              </tr>
            )}
            {shown.map((r) => (
              <tr key={r.truck} className={r.lossMaking ? 'bg-red-50/40' : ''}>
                <Td className="font-medium text-slate-900">
                  {r.number} {r.lossMaking ? <Pill className="bg-red-100 text-red-700 ml-1">Loss</Pill> : null}
                </Td>
                <Td right>{r.trips}</Td>
                <Td right>{formatNumber(r.km)}</Td>
                <Td right>{formatCurrency(r.revenue)}</Td>
                <Td right>{formatCurrency(r.tripExpenses)}</Td>
                <Td right>{formatCurrency(r.fuelNoTrip)}</Td>
                <Td right>{formatCurrency(r.maintenance)}</Td>
                <Td right>{formatCurrency(r.vehicleCosts)}</Td>
                <Td right className={`font-semibold ${r.contribution < 0 ? 'text-red-600' : 'text-green-700'}`}>{formatCurrency(r.contribution)}</Td>
                <Td right>{r.costPerKm !== null ? formatCurrency(r.costPerKm) : '—'}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function TripTable({ rows, onOpen }) {
  const [q, setQ] = useState('');
  const shown = rows.filter((r) => !q || `${r.tripNumber} ${r.vehicleNumber} ${r.route} ${r.driverName}`.toLowerCase().includes(q.toLowerCase()));
  const total = shown.reduce((s, r) => ({ revenue: s.revenue + r.revenue, expenses: s.expenses + r.expenses, contribution: s.contribution + r.contribution }), { revenue: 0, expenses: 0, contribution: 0 });
  return (
    <Panel
      title="Trip-wise contribution"
      subtitle="Revenue excluding GST − direct trip expenses, before overheads"
      action={<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search trips…" className="px-3 py-1.5 border border-slate-200 rounded text-sm w-48" />}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <Th>Trip</Th>
              <Th>Vehicle</Th>
              <Th>Route</Th>
              <Th right>KM</Th>
              <Th right>Revenue</Th>
              <Th right>Expenses</Th>
              <Th right>Contribution</Th>
              <Th right>Margin</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState title="No trips in this period" />
                </td>
              </tr>
            )}
            {shown.map((r) => (
              <tr key={r._id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onOpen(r._id)}>
                <Td className="font-medium text-blue-700">{r.tripNumber}</Td>
                <Td>{r.vehicleNumber || '—'}</Td>
                <Td>{r.route || '—'}</Td>
                <Td right>{formatNumber(r.km)}</Td>
                <Td right>{formatCurrency(r.revenue)}</Td>
                <Td right>{formatCurrency(r.expenses)}</Td>
                <Td right className={`font-semibold ${r.contribution < 0 ? 'text-red-600' : 'text-green-700'}`}>{formatCurrency(r.contribution)}</Td>
                <Td right>{r.marginPct !== null ? `${r.marginPct}%` : '—'}</Td>
              </tr>
            ))}
          </tbody>
          {shown.length > 0 && (
            <tfoot className="bg-slate-50 border-t border-slate-200 font-semibold">
              <tr>
                <Td>Total</Td>
                <Td />
                <Td />
                <Td />
                <Td right>{formatCurrency(total.revenue)}</Td>
                <Td right>{formatCurrency(total.expenses)}</Td>
                <Td right>{formatCurrency(total.contribution)}</Td>
                <Td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Panel>
  );
}

function CashView({ cash }) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Panel title="Money in">
        <div className="divide-y divide-slate-100">
          <Row label="Receipts against invoices" value={cash.inflow.customerReceipts} indent />
          <Row label="Daily Ledger income" value={cash.inflow.ledgerIncome} indent />
          <Row label="Total in" value={cash.totalIn} strong />
        </div>
      </Panel>
      <Panel title="Money out">
        <div className="divide-y divide-slate-100">
          <Row label="Payments to vendors" value={cash.outflow.vendorPayments} indent />
          <Row label="Daily Ledger expenses (incl. EMI, GST)" value={cash.outflow.ledgerExpenses} indent />
          <Row label="Total out" value={cash.totalOut} strong />
        </div>
      </Panel>
      <div className="md:col-span-2 space-y-3">
        <StatTile label="Net cash movement" value={formatCurrency(cash.net)} icon={cash.net >= 0 ? TrendingUp : TrendingDown} bg={cash.net >= 0 ? 'bg-green-50' : 'bg-red-50'} fg={cash.net >= 0 ? 'text-green-600' : 'text-red-600'} />
        <Banner tone="warning" message={cash.note} />
      </div>
    </div>
  );
}
