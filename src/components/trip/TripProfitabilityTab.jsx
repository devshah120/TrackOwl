import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, Detail } from './shared';
import {
  REVENUE_CATEGORY_LABELS, EXPENSE_CATEGORY_LABELS,
  formatCurrency, formatNumber, formatDuration,
} from '../../constants/trip';

// Profitability and planned-against-actual.
//
// Every figure here is computed by the server and rendered as given. Where a
// number cannot honestly be produced — per-km rates on a trip whose odometer
// has not been closed out — the API sends null and this shows an em dash rather
// than a zero that would read as a real measurement.
export function TripProfitabilityTab({ data }) {
  const p = data.profitability || {};
  const v = data.variance || {};

  const profitable = (p.profit ?? 0) >= 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label="Revenue" value={formatCurrency(p.revenue)} />
        <Tile label="Expenses" value={formatCurrency(p.expenses)} />
        <Tile
          label="Profit"
          value={formatCurrency(p.profit)}
          tone={profitable ? 'good' : 'bad'}
          icon={profitable ? TrendingUp : TrendingDown}
        />
        <Tile
          label="Margin"
          value={p.revenue ? `${formatNumber(p.marginPct)}%` : '—'}
          tone={profitable ? 'good' : 'bad'}
        />
      </div>

      <Card title="Per Kilometre">
        {p.actualKm ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Detail label="Actual Distance" value={`${formatNumber(p.actualKm)} km`} />
            <Detail label="Revenue / KM" value={formatCurrency(p.revenuePerKm)} />
            <Detail label="Expense / KM" value={formatCurrency(p.expensePerKm)} />
            <Detail label="Profit / KM" value={formatCurrency(p.profitPerKm)} />
            <Detail
              label="Fuel Cost / KM"
              value={p.fuelCostPerKm != null ? formatCurrency(p.fuelCostPerKm) : null}
            />
            <Detail
              label="Fuel Economy"
              value={p.kmPerLitre != null ? `${formatNumber(p.kmPerLitre)} km/l` : null}
            />
          </div>
        ) : (
          <p className="text-slate-500 text-sm">
            Per-kilometre figures need the actual distance, which is measured from the odometer
            readings taken when the trip starts and ends. They will appear once this trip is closed
            out.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Revenue Breakdown">
          <Breakdown
            entries={p.revenueByCategory}
            labels={REVENUE_CATEGORY_LABELS}
            total={p.revenue}
            emptyText="No revenue recorded on this trip."
          />
        </Card>

        <Card title="Expense Breakdown">
          <Breakdown
            entries={p.expensesByCategory}
            labels={EXPENSE_CATEGORY_LABELS}
            total={p.expenses}
            emptyText="No expenses recorded on this trip."
            barClass="bg-red-500"
          />
        </Card>
      </div>

      <Card title="Planned vs Actual">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Detail
            label="Planned Distance"
            value={v.plannedKm != null ? `${formatNumber(v.plannedKm)} km` : null}
          />
          <Detail
            label="Actual Distance"
            value={v.actualKm != null ? `${formatNumber(v.actualKm)} km` : null}
          />
          <Detail
            label="Route Deviation"
            value={
              v.kmDeviation != null
                ? `${v.kmDeviation > 0 ? '+' : ''}${formatNumber(v.kmDeviation)} km`
                : null
            }
          />
          <Detail
            label="Deviation %"
            value={v.kmDeviationPct != null ? `${formatNumber(v.kmDeviationPct)}%` : null}
          />
          <Detail
            label="Planned Time"
            value={v.plannedMinutes != null ? formatDuration(v.plannedMinutes) : null}
          />
          <Detail
            label="Actual Time"
            value={v.actualMinutes != null ? formatDuration(v.actualMinutes) : null}
          />
          <Detail
            label="Time Variance"
            value={
              v.timeDeviation != null
                ? `${v.timeDeviation > 0 ? '+' : ''}${formatDuration(v.timeDeviation)}`
                : null
            }
          />
          <Detail
            label="Average Speed"
            value={v.averageSpeedKmph != null ? `${formatNumber(v.averageSpeedKmph)} km/h` : null}
          />
        </div>

        <p className="text-xs text-slate-500 mt-4">
          Average speed covers the whole trip including stops, which is what the planned duration was
          measured against. Idle and driving time separately require GPS telemetry.
        </p>
      </Card>
    </div>
  );
}

function Breakdown({ entries, labels, total, emptyText, barClass = 'bg-blue-500' }) {
  const rows = Object.entries(entries || {});
  if (!rows.length) return <p className="text-slate-500 text-sm">{emptyText}</p>;

  const max = Math.max(...rows.map(([, v]) => Math.abs(v)));

  return (
    <div className="space-y-3">
      {rows
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .map(([category, amount]) => (
          <div key={category}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-700">{labels[category] || category}</span>
              <span className="font-medium text-slate-900">{formatCurrency(amount)}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${barClass} rounded-full`}
                style={{ width: `${max ? (Math.abs(amount) / max) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      <div className="flex items-center justify-between text-sm pt-3 border-t border-slate-200">
        <span className="font-medium text-slate-900">Total</span>
        <span className="font-bold text-slate-900">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}

function Tile({ label, value, tone = 'neutral', icon: Icon }) {
  const toneClass =
    tone === 'good' ? 'text-green-600' : tone === 'bad' ? 'text-red-600' : 'text-slate-900';
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon className={`w-4 h-4 ${toneClass}`} />}
        <p className="text-sm text-slate-600">{label}</p>
      </div>
      <p className={`text-xl font-bold mt-1 ${toneClass}`}>{value}</p>
    </div>
  );
}
