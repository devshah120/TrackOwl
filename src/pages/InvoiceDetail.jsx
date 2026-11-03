import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, Edit2, Plus, Trash2, Ban, Send, Paperclip } from 'lucide-react';
import { PageShell, PageHeader, Panel, Banner, Button, Modal, Pill, StatTile, Th, Td } from '../components/business/BusinessUI';
import { formatCurrency, formatDate, inputClass, toISODate, readFileAsDataUrl, INVOICE_STATUS_COLORS } from '../components/business/helpers';
import { invoices as invoicesApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';

const RECEIPT_MODES = ['Bank Transfer', 'UPI', 'Cheque', 'Cash', 'Card', 'Other'];
const ADJ_LABELS = { credit_note: 'Credit note', tds: 'TDS deducted', write_off: 'Write-off' };

export function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(null); // 'payment' | 'adjustment' | 'cancel'
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    invoicesApi.get(id).then((r) => setInvoice(r.invoice)).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!invoice) {
    return (
      <PageShell>
        <Banner message={error} />
        {!error && <p className="text-sm text-slate-500">Loading invoice…</p>}
      </PageShell>
    );
  }

  const t = invoice.totals;
  const editable = can('billing', 'update') && !['cancelled'].includes(invoice.status) && !invoice.payments.length && !invoice.adjustments.length;
  const takesMoney = can('billing', 'update') && ['issued', 'partially_paid'].includes(invoice.status) && t.balance > 0.5;

  const act = async (fn, message) => {
    setBusy(true);
    setError('');
    try {
      const res = await fn();
      if (res?.invoice) setInvoice(res.invoice);
      if (message) setNotice(message);
      setModal(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell>
      <button type="button" onClick={() => navigate('/invoices')} className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="w-4 h-4" /> All invoices
      </button>

      <PageHeader
        title={
          <span className="flex items-center gap-3 flex-wrap">
            {invoice.invoiceNumber}
            <Pill className={INVOICE_STATUS_COLORS[invoice.overdue ? 'overdue' : invoice.status]}>{invoice.statusLabel}</Pill>
          </span>
        }
        subtitle={`${invoice.billTo?.name} · issued ${formatDate(invoice.invoiceDate)} · due ${formatDate(invoice.dueDate)}${invoice.overdue ? ` (${invoice.daysOverdue} days overdue)` : ''}`}
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={() => invoicesApi.downloadPdf(invoice._id).catch((e) => setError(e.message))}>
              PDF
            </Button>
            {invoice.status === 'draft' && can('billing', 'update') && (
              <Button icon={Send} busy={busy} onClick={() => act(() => invoicesApi.issue(invoice._id), 'Invoice issued')}>
                Issue
              </Button>
            )}
            {editable && (
              <Button variant="secondary" icon={Edit2} onClick={() => navigate(`/invoices/${invoice._id}/edit`)}>
                Edit
              </Button>
            )}
            {takesMoney && (
              <Button icon={Plus} onClick={() => setModal('payment')}>
                Record payment
              </Button>
            )}
          </>
        }
      />

      <Banner message={error} onDismiss={() => setError('')} />
      <Banner tone="success" message={notice} onDismiss={() => setNotice('')} />
      {invoice.status === 'cancelled' && <Banner tone="warning" message={`Cancelled ${formatDate(invoice.cancelledAt)}: ${invoice.cancelReason}`} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Invoice total" value={formatCurrency(t.total)} hint={invoice.gst?.reverseCharge && t.tax ? `GST ${formatCurrency(t.tax)} under reverse charge` : t.tax ? `incl. GST ${formatCurrency(t.tax)}` : 'No GST'} />
        <StatTile label="Received" value={formatCurrency(t.received)} />
        <StatTile label="Credit notes / TDS" value={formatCurrency(t.adjusted)} />
        <StatTile label="Balance due" value={formatCurrency(t.balance)} bg="bg-red-50" fg="text-red-600" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Panel title="Lines" className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <Th>Description</Th>
                  <Th>SAC</Th>
                  <Th right>Qty</Th>
                  <Th right>Rate</Th>
                  <Th right>Amount</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.lines.map((l) => (
                  <tr key={l._id}>
                    <Td>
                      <span className="text-slate-900">{l.description || l.kind}</span>
                      {l.tripOrder ? (
                        <span className="block text-xs text-slate-500">
                          <Link to={`/trips/${l.tripOrder}`} className="text-blue-600 hover:underline">
                            Trip {l.tripNumber}
                          </Link>
                          {l.vehicleNumber ? ` · ${l.vehicleNumber}` : ''}
                          {l.route ? ` · ${l.route}` : ''}
                        </span>
                      ) : null}
                    </Td>
                    <Td>{l.sac || '—'}</Td>
                    <Td right>{l.quantity}</Td>
                    <Td right>{formatCurrency(l.rate)}</Td>
                    <Td right>{formatCurrency(l.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-200 px-4 py-3 text-sm space-y-1 ml-auto max-w-xs">
            <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(t.subtotal)}</span></div>
            {invoice.discount > 0 && <div className="flex justify-between"><span>Discount</span><span className="tabular-nums">−{formatCurrency(invoice.discount)}</span></div>}
            <div className="flex justify-between"><span>Taxable value</span><span className="tabular-nums">{formatCurrency(t.taxable)}</span></div>
            {t.cgst > 0 && <div className="flex justify-between"><span>CGST {invoice.gst.rate / 2}%</span><span className="tabular-nums">{formatCurrency(t.cgst)}</span></div>}
            {t.sgst > 0 && <div className="flex justify-between"><span>SGST {invoice.gst.rate / 2}%</span><span className="tabular-nums">{formatCurrency(t.sgst)}</span></div>}
            {t.igst > 0 && <div className="flex justify-between"><span>IGST {invoice.gst.rate}%</span><span className="tabular-nums">{formatCurrency(t.igst)}</span></div>}
            {invoice.gst?.reverseCharge && t.tax > 0 && <p className="text-xs text-slate-500">GST payable by the customer under reverse charge — not in the total.</p>}
            {t.roundOff ? <div className="flex justify-between"><span>Round off</span><span className="tabular-nums">{formatCurrency(t.roundOff)}</span></div> : null}
            <div className="flex justify-between font-semibold text-base"><span>Total</span><span className="tabular-nums">{formatCurrency(t.total)}</span></div>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Bill to">
            <div className="p-4 text-sm text-slate-700 space-y-1">
              <p className="font-medium text-slate-900">{invoice.billTo?.name}</p>
              {invoice.billTo?.address && <p>{invoice.billTo.address}</p>}
              {invoice.billTo?.gstin && <p>GSTIN {invoice.billTo.gstin}</p>}
              {invoice.billTo?.contact && <p>{invoice.billTo.contact}</p>}
              <p className="text-xs text-slate-500 pt-1">Place of supply: {invoice.placeOfSupply || '—'}</p>
            </div>
          </Panel>
          {can('billing', 'update') && invoice.status !== 'cancelled' && (
            <Panel title="Other actions">
              <div className="p-4 flex flex-col gap-2">
                {takesMoney && (
                  <Button variant="secondary" onClick={() => setModal('adjustment')}>
                    Record credit note / TDS
                  </Button>
                )}
                {!invoice.payments.length && can('billing', 'approve') && (
                  <Button variant="danger" icon={Ban} onClick={() => setModal('cancel')}>
                    Cancel invoice
                  </Button>
                )}
                {invoice.status === 'draft' && can('billing', 'delete') && (
                  <Button
                    variant="danger"
                    icon={Trash2}
                    onClick={() => window.confirm('Delete this draft?') && invoicesApi.remove(invoice._id).then(() => navigate('/invoices')).catch((e) => setError(e.message))}
                  >
                    Delete draft
                  </Button>
                )}
              </div>
            </Panel>
          )}
        </div>
      </div>

      <Panel title="Payments & adjustments">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <Th>Date</Th>
                <Th>Type</Th>
                <Th>Reference</Th>
                <Th>Notes</Th>
                <Th right>Amount</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!invoice.payments.length && !invoice.adjustments.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    Nothing received yet.
                  </td>
                </tr>
              )}
              {invoice.payments.map((p) => (
                <tr key={p._id}>
                  <Td>{formatDate(p.date)}</Td>
                  <Td>Payment · {p.mode}</Td>
                  <Td>{p.reference || '—'}</Td>
                  <Td>
                    {p.notes || '—'}
                    {p.hasReceipt && (
                      <button
                        type="button"
                        className="ml-2 text-blue-600 inline-flex items-center gap-1 text-xs"
                        onClick={() => invoicesApi.receipt(invoice._id, p._id).then((r) => window.open(r.receipt.dataUrl, '_blank', 'noopener')).catch((e) => setError(e.message))}
                      >
                        <Paperclip className="w-3 h-3" /> receipt
                      </button>
                    )}
                  </Td>
                  <Td right className="font-medium text-green-700">{formatCurrency(p.amount)}</Td>
                  <Td>
                    {can('billing', 'update') && (
                      <button type="button" aria-label="Remove payment" className="p-1.5 text-red-600 hover:bg-red-50 rounded" onClick={() => window.confirm(`Remove the ${formatCurrency(p.amount)} payment?`) && act(() => invoicesApi.removePayment(invoice._id, p._id), 'Payment removed')}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
              {invoice.adjustments.map((a) => (
                <tr key={a._id}>
                  <Td>{formatDate(a.date)}</Td>
                  <Td>{ADJ_LABELS[a.kind]}</Td>
                  <Td>{a.reference || '—'}</Td>
                  <Td>{a.notes || '—'}</Td>
                  <Td right className="font-medium">{formatCurrency(a.amount)}</Td>
                  <Td>
                    {can('billing', 'update') && (
                      <button type="button" aria-label="Remove adjustment" className="p-1.5 text-red-600 hover:bg-red-50 rounded" onClick={() => window.confirm('Remove this adjustment?') && act(() => invoicesApi.removeAdjustment(invoice._id, a._id), 'Adjustment removed')}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {modal === 'payment' && (
      <PaymentModal
        open
        balance={t.balance}
        onClose={() => setModal(null)}
        submit={(p) => invoicesApi.addPayment(invoice._id, p)}
        onDone={(res) => { setInvoice(res.invoice); setNotice('Payment recorded'); setModal(null); }}
      />
      )}
      {modal === 'adjustment' && (
      <AdjustmentModal
        open
        balance={t.balance}
        onClose={() => setModal(null)}
        submit={(p) => invoicesApi.addAdjustment(invoice._id, p)}
        onDone={(res) => { setInvoice(res.invoice); setNotice('Adjustment recorded'); setModal(null); }}
      />
      )}
      <CancelModal open={modal === 'cancel'} busy={busy} onClose={() => setModal(null)} onSave={(reason) => act(() => invoicesApi.cancel(invoice._id, reason), 'Invoice cancelled')} />
    </PageShell>
  );
}

// Submits itself so it can show the server's answer in place — including the
// "identical payment just recorded" check, which the user confirms to send a
// genuine second payment.
function PaymentModal({ open, balance, onClose, submit: send, onDone }) {
  // Mounted fresh each time it opens, so the defaults come from props here.
  const [form, setForm] = useState(() => ({ date: toISODate(new Date()), amount: balance, mode: 'Bank Transfer', reference: '', notes: '', receipt: null }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (confirmDuplicate = false) => {
    setBusy(true);
    setError('');
    try {
      onDone(await send({ ...form, amount: Number(form.amount), confirmDuplicate }));
    } catch (err) {
      if (err.data?.duplicate && window.confirm(`${err.message}

Record it anyway?`)) {
        setBusy(false);
        return submit(true);
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Record payment"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button busy={busy} onClick={() => submit()} disabled={!(Number(form.amount) > 0)}>Save payment</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Banner message={error} />
        <p className="text-sm text-slate-600">Balance due: <span className="font-semibold">{formatCurrency(balance)}</span></p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-slate-700">Date<input type="date" value={form.date || ''} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputClass} /></label>
          <label className="text-sm text-slate-700">Amount (₹)<input type="number" min={0} max={balance} value={form.amount ?? ''} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputClass} /></label>
          <label className="text-sm text-slate-700">Mode
            <select value={form.mode || ''} onChange={(e) => setForm({ ...form, mode: e.target.value })} className={inputClass}>
              {RECEIPT_MODES.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">Reference / UTR<input value={form.reference || ''} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={inputClass} /></label>
        </div>
        <label className="text-sm text-slate-700 block">Notes<input value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputClass} /></label>
        <label className="text-sm text-slate-700 block">
          Receipt (photo or PDF, optional)
          <input type="file" accept="image/*,application/pdf" className="block mt-1 text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setForm({ ...form, receipt: await readFileAsDataUrl(f) }); }} />
        </label>
      </div>
    </Modal>
  );
}

function AdjustmentModal({ open, balance, onClose, submit: send, onDone }) {
  const { can } = usePermissions();
  const canWriteOff = can('billing', 'approve');
  const [form, setForm] = useState(() => ({ kind: 'tds', date: toISODate(new Date()), amount: '', reference: '', notes: '' }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const saveAdjustment = async () => {
    setBusy(true);
    setError('');
    try {
      onDone(await send({ ...form, amount: Number(form.amount) }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      title="Credit note, TDS or write-off"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button busy={busy} disabled={!(Number(form.amount) > 0)} onClick={saveAdjustment}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Banner message={error} />
        <p className="text-sm text-slate-600">Reduces the balance due ({formatCurrency(balance)}) without a payment.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-slate-700">Type
            <select value={form.kind || 'tds'} onChange={(e) => setForm({ ...form, kind: e.target.value })} className={inputClass}>
              {Object.entries(ADJ_LABELS).filter(([v]) => v !== 'write_off' || canWriteOff).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">Date<input type="date" value={form.date || ''} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputClass} /></label>
          <label className="text-sm text-slate-700">Amount (₹)<input type="number" min={0} value={form.amount ?? ''} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputClass} /></label>
          <label className="text-sm text-slate-700">Reference<input value={form.reference || ''} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={inputClass} placeholder="CN no. / TDS cert." /></label>
        </div>
        <label className="text-sm text-slate-700 block">Notes<input value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputClass} /></label>
      </div>
    </Modal>
  );
}

function CancelModal({ open, busy, onClose, onSave }) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      open={open}
      title="Cancel invoice"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Keep invoice</Button>
          <Button variant="danger" busy={busy} disabled={reason.trim().length < 3} onClick={() => onSave(reason)}>Cancel invoice</Button>
        </>
      }
    >
      <p className="text-sm text-slate-600 mb-3">The number stays used (GST series must not have gaps) and its trips become billable again.</p>
      <label className="text-sm text-slate-700 block">Reason<textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} /></label>
    </Modal>
  );
}
