import { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, Paperclip, IndianRupee } from 'lucide-react';
import { Card, Field, EmptyState, ErrorNote } from './shared';
import { inputClass, readFileAsDataUrl } from './helpers';
import { tripOrders } from '../../services/api';
import {
  REVENUE_CATEGORY_LABELS, EXPENSE_CATEGORY_LABELS, PAYMENT_MODES,
  formatCurrency, formatDate,
} from '../../constants/trip';

// Revenue and expenses, line by line.
//
// Every total on this screen comes back from the server after each write. The
// page never adds figures up itself: the server decides that a discount
// subtracts and a tax adds, and having the browser reach its own conclusion
// would eventually produce two different numbers for the same trip.
export function TripMoneyTab({ trip, reload, canEdit }) {
  const [error, setError] = useState('');
  const [totals, setTotals] = useState(trip.totals || {});
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      const res = await fn();
      if (res?.totals) setTotals(res.totals);
      await reload();
      return true;
    } catch (err) {
      setError(err.message || 'That change was refused');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <ErrorNote>{error}</ErrorNote>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MoneyTile label="Revenue" value={formatCurrency(totals.revenue)} />
        <MoneyTile label="Expenses" value={formatCurrency(totals.expenses)} />
        <MoneyTile
          label="Profit"
          value={formatCurrency(totals.profit)}
          tone={totals.profit > 0 ? 'good' : totals.profit < 0 ? 'bad' : 'neutral'}
        />
        <MoneyTile
          label="Margin"
          value={totals.revenue ? `${Number(totals.marginPct || 0).toFixed(2)}%` : '—'}
        />
      </div>

      <RevenueSection trip={trip} canEdit={canEdit} busy={busy} run={run} />
      <ExpenseSection trip={trip} canEdit={canEdit} busy={busy} run={run} />
    </div>
  );
}

function RevenueSection({ trip, canEdit, busy, run }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ category: 'freight', description: '', amount: '' });

  const reset = () => {
    setAdding(false);
    setEditingId(null);
    setDraft({ category: 'freight', description: '', amount: '' });
  };

  const submit = async () => {
    const payload = { ...draft, amount: Number(draft.amount) };
    const ok = await run(() =>
      editingId
        ? tripOrders.updateRevenue(trip._id, editingId, payload)
        : tripOrders.addRevenue(trip._id, payload)
    );
    if (ok) reset();
  };

  return (
    <Card
      title="Revenue"
      action={
        canEdit && !adding && !editingId && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Revenue
          </button>
        )
      }
    >
      {(adding || editingId) && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end mb-4 pb-4 border-b border-slate-200">
          <Field label="Category">
            <select
              value={draft.category}
              onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
              className={inputClass}
            >
              {Object.entries(REVENUE_CATEGORY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <input
              type="text"
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field
            label="Amount"
            hint={draft.category === 'discount' ? 'Entered positive; it subtracts from the total' : null}
          >
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.amount}
              onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
              className={inputClass}
            />
          </Field>
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={busy || draft.amount === ''}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Check className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={reset}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {(trip.revenue || []).length === 0 && !adding ? (
        <EmptyState
          icon={IndianRupee}
          title="No revenue recorded"
          hint="Add the freight charge and any extras this trip is billed for."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left text-sm font-semibold text-slate-900">Category</th>
                <th className="px-3 py-2 text-left text-sm font-semibold text-slate-900">Description</th>
                <th className="px-3 py-2 text-right text-sm font-semibold text-slate-900">Amount</th>
                {canEdit && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(trip.revenue || []).map((line) => (
                <tr key={line._id}>
                  <td className="px-3 py-2 text-sm text-slate-700">
                    {REVENUE_CATEGORY_LABELS[line.category] || line.category}
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-600">{line.description || '—'}</td>
                  <td
                    className={`px-3 py-2 text-sm text-right font-medium ${
                      line.category === 'discount' ? 'text-red-600' : 'text-slate-900'
                    }`}
                  >
                    {line.category === 'discount' ? '−' : ''}
                    {formatCurrency(line.amount)}
                  </td>
                  {canEdit && (
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          setEditingId(line._id);
                          setAdding(false);
                          setDraft({
                            category: line.category,
                            description: line.description || '',
                            amount: line.amount,
                          });
                        }}
                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => run(() => tripOrders.removeRevenue(trip._id, line._id))}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ExpenseSection({ trip, canEdit, busy, run }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(emptyExpense());
  const [fileError, setFileError] = useState('');

  const reset = () => {
    setAdding(false);
    setEditingId(null);
    setDraft(emptyExpense());
    setFileError('');
  };

  const pickReceipt = async (file) => {
    if (!file) return;
    setFileError('');
    try {
      const receipt = await readFileAsDataUrl(file);
      setDraft((d) => ({ ...d, receipt }));
    } catch (err) {
      setFileError(err.message || 'Could not read that file');
    }
  };

  const submit = async () => {
    const payload = {
      ...draft,
      amount: Number(draft.amount),
      litres: draft.litres === '' ? null : Number(draft.litres),
      odometer: draft.odometer === '' ? null : Number(draft.odometer),
    };
    const ok = await run(() =>
      editingId
        ? tripOrders.updateExpense(trip._id, editingId, payload)
        : tripOrders.addExpense(trip._id, payload)
    );
    if (ok) reset();
  };

  const openReceipt = async (lineId) => {
    try {
      const res = await tripOrders.getReceipt(trip._id, lineId);
      // A data URI opened in a new tab is how the ledger already shows its
      // receipts, so the behaviour matches what operators expect here.
      const win = window.open();
      if (win) win.document.write(`<img src="${res.receipt.dataUrl}" style="max-width:100%">`);
    } catch {
      setFileError('Could not load that receipt');
    }
  };

  return (
    <Card
      title="Expenses"
      action={
        canEdit && !adding && !editingId && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        )
      }
    >
      {fileError && <ErrorNote>{fileError}</ErrorNote>}

      {(adding || editingId) && (
        <div className="space-y-3 mb-4 pb-4 border-b border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Field label="Category">
              <select
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                className={inputClass}
              >
                {Object.entries(EXPENSE_CATEGORY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Amount">
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.amount}
                onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={draft.spentAt}
                onChange={(e) => setDraft((d) => ({ ...d, spentAt: e.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label="Payment Mode">
              <select
                value={draft.paymentMode}
                onChange={(e) => setDraft((d) => ({ ...d, paymentMode: e.target.value }))}
                className={inputClass}
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Field label="Description">
              <input
                type="text"
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label="Vendor">
              <input
                type="text"
                value={draft.vendor}
                onChange={(e) => setDraft((d) => ({ ...d, vendor: e.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label="Paid By">
              <input
                type="text"
                value={draft.paidBy}
                onChange={(e) => setDraft((d) => ({ ...d, paidBy: e.target.value }))}
                placeholder="Driver, office..."
                className={inputClass}
              />
            </Field>
            <Field label="Receipt">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => pickReceipt(e.target.files?.[0])}
                className="w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              />
            </Field>
          </div>

          {/* Litres and odometer only matter for fuel, and asking for them on
              every expense would be noise. They are what makes fuel cost per km
              and km/l computable without parsing a description. */}
          {draft.category === 'fuel' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Field label="Litres" hint="Needed for the km/l figure">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.litres}
                  onChange={(e) => setDraft((d) => ({ ...d, litres: e.target.value }))}
                  className={inputClass}
                />
              </Field>
              <Field label="Odometer at fill">
                <input
                  type="number"
                  min="0"
                  value={draft.odometer}
                  onChange={(e) => setDraft((d) => ({ ...d, odometer: e.target.value }))}
                  className={inputClass}
                />
              </Field>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={busy || draft.amount === ''}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Check className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={reset}
              className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {(trip.expenses || []).length === 0 && !adding ? (
        <EmptyState
          icon={IndianRupee}
          title="No expenses recorded"
          hint="Add fuel, tolls, allowances and anything else this trip cost."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left text-sm font-semibold text-slate-900">Category</th>
                <th className="px-3 py-2 text-left text-sm font-semibold text-slate-900">Description</th>
                <th className="px-3 py-2 text-left text-sm font-semibold text-slate-900">Date</th>
                <th className="px-3 py-2 text-left text-sm font-semibold text-slate-900">Mode</th>
                <th className="px-3 py-2 text-right text-sm font-semibold text-slate-900">Amount</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(trip.expenses || []).map((line) => (
                <tr key={line._id}>
                  <td className="px-3 py-2 text-sm text-slate-700">
                    {EXPENSE_CATEGORY_LABELS[line.category] || line.category}
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-600">
                    {line.description || '—'}
                    {line.litres ? <span className="text-slate-400"> · {line.litres} L</span> : null}
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-600">{formatDate(line.spentAt)}</td>
                  <td className="px-3 py-2 text-sm text-slate-600">{line.paymentMode}</td>
                  <td className="px-3 py-2 text-sm text-right font-medium text-slate-900">
                    {formatCurrency(line.amount)}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {line.hasReceipt && (
                      <button
                        onClick={() => openReceipt(line._id)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="View receipt"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>
                    )}
                    {canEdit && (
                      <>
                        <button
                          onClick={() => {
                            setEditingId(line._id);
                            setAdding(false);
                            setDraft({
                              category: line.category,
                              description: line.description || '',
                              amount: line.amount,
                              spentAt: line.spentAt ? new Date(line.spentAt).toISOString().slice(0, 10) : '',
                              paidBy: line.paidBy || '',
                              paymentMode: line.paymentMode || 'Cash',
                              vendor: line.vendor || '',
                              litres: line.litres ?? '',
                              odometer: line.odometer ?? '',
                            });
                          }}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => run(() => tripOrders.removeExpense(trip._id, line._id))}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function emptyExpense() {
  return {
    category: 'fuel',
    description: '',
    amount: '',
    spentAt: new Date().toISOString().slice(0, 10),
    paidBy: '',
    paymentMode: 'Cash',
    vendor: '',
    litres: '',
    odometer: '',
  };
}

function MoneyTile({ label, value, tone = 'neutral' }) {
  const toneClass =
    tone === 'good' ? 'text-green-600' : tone === 'bad' ? 'text-red-600' : 'text-slate-900';
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`text-xl font-bold mt-1 ${toneClass}`}>{value}</p>
    </div>
  );
}
