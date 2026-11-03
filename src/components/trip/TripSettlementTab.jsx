import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Lock, Plus, Trash2, Gauge, ShieldAlert } from 'lucide-react';
import { tripSettlement } from '../../services/api';
import { formatCurrency, formatNumber, formatDate, formatDateTime } from '../../constants/trip';
import { Card, Field, ErrorNote } from './shared';
import { inputClass } from './helpers';

// Settlement & close-out (brief §3.1, §3.4, §3.5).
//
// Shows the trip's final figures as the server computes them, the driver's
// account (allowance, advances, balance), odometer corrections, the close
// checklist, and the review → close actions. Nothing here is calculated in the
// browser; every write reloads the trip so the page matches the record.

const MODES = ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Fuel Card', 'Company Account'];
const KIND_LABELS = { advance: 'Advance to driver', settlement_payment: 'Balance paid to driver', recovery: 'Recovered from driver' };

const today = () => new Date().toISOString().slice(0, 10);

export function TripSettlementTab({ trip, reload, canEdit }) {
  const [s, setS] = useState(null);
  const [canOverride, setCanOverride] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [money, setMoney] = useState({ kind: 'advance', amount: '', paidAt: today(), paymentMode: 'Cash', reference: '', notes: '' });
  const [reading, setReading] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [override, setOverride] = useState({ on: false, reason: '' });

  const load = useCallback(async () => {
    try {
      const res = await tripSettlement.get(trip._id);
      setS(res.settlement);
      setCanOverride(res.canOverride);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [trip._id]);

  useEffect(() => {
    (async () => { await load(); })();
  }, [load, trip.updatedAt]);

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await reload();
      await load();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addMoney = async (confirmDuplicate = false) => {
    setBusy(true);
    setError('');
    try {
      await tripSettlement.addDriverMoney(trip._id, { ...money, amount: Number(money.amount), confirmDuplicate });
      setMoney((m) => ({ ...m, amount: '', reference: '', notes: '' }));
      await reload();
      await load();
    } catch (err) {
      // An identical entry seconds ago is almost always a double click; the
      // user confirms before a genuine second payment goes in.
      if (err.data?.duplicate && window.confirm(`${err.message}\n\nRecord it anyway?`)) {
        setBusy(false);
        return addMoney(true);
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!s) return error ? <ErrorNote>{error}</ErrorNote> : <p className="text-slate-500">Loading settlement…</p>;

  const closed = trip.status === 'closed';
  const inSettlement = ['completed', 'pending_settlement'].includes(trip.status);
  const failing = s.checks.filter((c) => !c.ok && c.key !== 'status');
  const d = s.driver;

  return (
    <div className="space-y-6">
      <ErrorNote>{error}</ErrorNote>

      {closed && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-4 py-3 text-sm">
          <Lock className="w-5 h-5 shrink-0" />
          <div>
            Closed {formatDateTime(s.closed?.closedAt)} by {s.closed?.closedByName || '—'}. The trip is locked.
            {s.closed?.override?.used && (
              <p className="mt-1 text-amber-800">
                Closed by override, skipping: {s.closed.override.skippedChecks.join(', ')} — “{s.closed.override.reason}”
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <Card title="Trip settlement" className="lg:col-span-2">
          <div className="divide-y divide-slate-100 -mx-6 -my-6">
            <Line label="Customer revenue (excluding GST)" value={s.revenueExTax} />
            {s.taxCollected > 0 && <Line label="GST on revenue lines — not counted as revenue" value={s.taxCollected} muted />}
            {Object.entries(s.expensesByCategory).map(([cat, v]) => (
              <Line key={cat} label={cat.replace('_', ' ')} value={-v} indent />
            ))}
            <Line label="Total trip expenses" value={-s.expenses} strong />
            <Line label="Trip contribution (before overheads)" value={s.contribution} strong tone={s.contribution >= 0 ? 'good' : 'bad'} />
            <div className="px-6 py-3 text-xs text-slate-500">
              {s.basis}
              {s.contributionPerKm !== null && ` · ${formatCurrency(s.contributionPerKm)} per km`}
              {s.marginPct !== null && ` · ${s.marginPct}% margin`}
            </div>
          </div>
        </Card>

        <Card title="Close checklist">
          <ul className="space-y-2">
            {s.checks.map((c) => (
              <li key={c.key} className="flex items-start gap-2 text-sm">
                {c.ok ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
                <span className={c.ok ? 'text-slate-700' : 'text-slate-900 font-medium'}>{c.label}</span>
              </li>
            ))}
          </ul>
          {s.review.reviewedAt && (
            <p className="text-xs text-slate-500 mt-3">
              Reviewed {formatDateTime(s.review.reviewedAt)} by {s.review.reviewedByName}
              {!s.review.current && <span className="block text-amber-700">Figures changed since — review again before closing.</span>}
            </p>
          )}

          {canEdit && inSettlement && (
            <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
              <Field label="Review notes">
                <textarea rows={2} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} className={inputClass} placeholder="Optional" />
              </Field>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => tripSettlement.review(trip._id, reviewNotes))}
                className="w-full px-4 py-2 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 text-sm font-medium disabled:opacity-50"
              >
                {s.review.reviewedAt ? 'Review again' : 'Mark settlement reviewed'}
              </button>

              {failing.length > 0 && canOverride && (
                <label className="flex items-start gap-2 text-sm text-amber-800">
                  <input type="checkbox" className="mt-1" checked={override.on} onChange={(e) => setOverride({ ...override, on: e.target.checked })} />
                  Close anyway with {failing.length} check(s) outstanding (recorded in the audit log)
                </label>
              )}
              {override.on && (
                <Field label="Reason for closing early" required>
                  <input value={override.reason} onChange={(e) => setOverride({ ...override, reason: e.target.value })} className={inputClass} />
                </Field>
              )}
              <button
                type="button"
                disabled={busy || (failing.length > 0 && !(override.on && override.reason.trim().length >= 5))}
                onClick={() => {
                  if (!window.confirm('Close this trip? It will be locked and can no longer be edited.')) return;
                  run(() => tripSettlement.close(trip._id, failing.length ? { override: true, reason: override.reason } : {}));
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-50"
              >
                <Lock className="w-4 h-4" /> Close trip
              </button>
              {failing.length > 0 && !canOverride && <p className="text-xs text-slate-500">Complete the checklist above to close. Only a manager can close past it.</p>}
            </div>
          )}
          {!inSettlement && !closed && <p className="text-xs text-slate-500 mt-3">Settlement opens once the trip is Completed.</p>}
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card title={`Driver account${trip.driverName ? ` — ${trip.driverName}` : ''}`} className="lg:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <Tile label="Allowance" value={d.allowance} />
            <Tile label="Paid by driver" value={d.paidByDriver} hint="Expenses marked “paid by driver”" />
            <Tile label="Advances" value={d.advances} />
            <Tile
              label={d.balanceDirection === 'receivable_from_driver' ? 'Driver to return' : 'Balance payable'}
              value={Math.abs(d.balance)}
              tone={d.balance === 0 ? 'neutral' : d.balance > 0 ? 'bad' : 'warn'}
            />
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Balance = allowance {formatCurrency(d.allowance)} + paid by driver {formatCurrency(d.paidByDriver)} − advances {formatCurrency(d.advances)}
            {d.settlementPayments ? ` − paid out ${formatCurrency(d.settlementPayments)}` : ''}
            {d.recoveries ? ` + recovered ${formatCurrency(d.recoveries)}` : ''} = {formatCurrency(d.balance)}
          </p>

          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Mode / ref</th>
                <th className="py-2 pr-3 font-medium text-right">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {s.driverMoney.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-500">No advances or payments recorded.</td>
                </tr>
              )}
              {s.driverMoney.map((m) => (
                <tr key={m._id}>
                  <td className="py-2 pr-3">{formatDate(m.paidAt)}</td>
                  <td className="py-2 pr-3">{KIND_LABELS[m.kind]}</td>
                  <td className="py-2 pr-3 text-slate-600">{[m.paymentMode, m.reference].filter(Boolean).join(' · ')}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(m.amount)}</td>
                  <td className="py-2 text-right">
                    {canEdit && !closed && (
                      <button type="button" aria-label="Remove" className="p-1 text-red-600 hover:bg-red-50 rounded" onClick={() => window.confirm('Remove this entry?') && run(() => tripSettlement.removeDriverMoney(trip._id, m._id))}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {canEdit && !closed && trip.driver && (
            <div className="grid sm:grid-cols-6 gap-3 mt-4 pt-4 border-t border-slate-200 items-end">
              <div className="sm:col-span-2">
                <Field label="Type">
                  <select value={money.kind} onChange={(e) => setMoney({ ...money, kind: e.target.value })} className={inputClass}>
                    {Object.entries(KIND_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Amount (₹)">
                <input type="number" min={0} value={money.amount} onChange={(e) => setMoney({ ...money, amount: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Date">
                <input type="date" value={money.paidAt} onChange={(e) => setMoney({ ...money, paidAt: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Mode">
                <select value={money.paymentMode} onChange={(e) => setMoney({ ...money, paymentMode: e.target.value })} className={inputClass}>
                  {MODES.map((m) => <option key={m}>{m}</option>)}
                </select>
              </Field>
              <button type="button" disabled={busy || !(Number(money.amount) > 0)} onClick={() => addMoney()} className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
                <Plus className="w-4 h-4" /> Add
              </button>
              <div className="sm:col-span-6">
                <input value={money.reference} onChange={(e) => setMoney({ ...money, reference: e.target.value })} className={inputClass} placeholder="Reference (UPI / voucher no.) — optional" />
              </div>
            </div>
          )}
          {!trip.driver && <p className="text-sm text-slate-500 mt-3">Assign a driver to record advances.</p>}
        </Card>

        <Card title="Distance">
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2 text-slate-900 font-semibold text-lg">
              <Gauge className="w-5 h-5 text-slate-500" /> {s.actualKm !== null ? `${formatNumber(s.actualKm)} km` : '—'}
            </p>
            <p className="text-slate-600">
              {s.distanceSource.method === 'odometer'
                ? `From odometer: ${formatNumber(s.distanceSource.from)} → ${formatNumber(s.distanceSource.to)} km${s.distanceSource.corrected ? ' (corrected)' : ''}`
                : 'No start/end odometer recorded yet'}
            </p>
            {s.readingCorrections.length > 0 && (
              <ul className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-100">
                {s.readingCorrections.map((c, i) => (
                  <li key={i}>
                    <ShieldAlert className="w-3 h-3 inline mr-1 text-amber-600" />
                    {c.reading} {formatNumber(c.from)} → {formatNumber(c.to)} km by {c.byName || '—'} on {formatDate(c.at)}: “{c.reason}”
                  </li>
                ))}
              </ul>
            )}
            {canEdit && !closed && (trip.start?.at || trip.end?.at) && !reading && (
              <button type="button" onClick={() => setReading({ start: trip.start?.odometer ?? '', end: trip.end?.odometer ?? '', reason: '' })} className="text-blue-600 text-sm hover:underline">
                Correct a reading…
              </button>
            )}
            {reading && (
              <div className="space-y-2 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Start km"><input type="number" disabled={!trip.start?.at} value={reading.start} onChange={(e) => setReading({ ...reading, start: e.target.value })} className={inputClass} /></Field>
                  <Field label="End km"><input type="number" disabled={!trip.end?.at} value={reading.end} onChange={(e) => setReading({ ...reading, end: e.target.value })} className={inputClass} /></Field>
                </div>
                <Field label="Reason" required><input value={reading.reason} onChange={(e) => setReading({ ...reading, reason: e.target.value })} className={inputClass} placeholder="e.g. typo at gate, photo shows 10,520" /></Field>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy || reading.reason.trim().length < 5}
                    onClick={async () => {
                      const ok = await run(() =>
                        tripSettlement.correctReadings(trip._id, {
                          start: trip.start?.at ? reading.start : undefined,
                          end: trip.end?.at ? reading.end : undefined,
                          reason: reading.reason,
                        })
                      );
                      if (ok) setReading(null);
                    }}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
                  >
                    Save correction
                  </button>
                  <button type="button" onClick={() => setReading(null)} className="px-3 py-1.5 border border-slate-200 rounded text-sm">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Line({ label, value, strong = false, indent = false, muted = false, tone }) {
  const color = tone === 'good' ? 'text-green-700' : tone === 'bad' ? 'text-red-600' : muted ? 'text-slate-400' : 'text-slate-900';
  return (
    <div className={`flex justify-between px-6 py-2.5 ${strong ? 'bg-slate-50 font-semibold' : ''} ${indent ? 'pl-10 text-sm capitalize' : ''}`}>
      <span className={muted ? 'text-slate-500 text-sm' : 'text-slate-700'}>{label}</span>
      <span className={`tabular-nums ${color}`}>{value < 0 ? `(${formatCurrency(-value)})` : formatCurrency(value)}</span>
    </div>
  );
}

function Tile({ label, value, hint, tone = 'neutral' }) {
  const color = tone === 'bad' ? 'text-red-600' : tone === 'warn' ? 'text-amber-600' : 'text-slate-900';
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{formatCurrency(value)}</p>
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}
