import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Truck } from 'lucide-react';
import { PageShell, PageHeader, Panel, Banner, Button, EmptyState, Th, Td } from '../components/business/BusinessUI';
import { formatCurrency, formatDate, inputClass, toISODate } from '../components/business/helpers';
import { invoices as invoicesApi, customers as customersApi } from '../services/api';

// Raise or edit an invoice. Picking a customer lists their finished trips that
// are not on any live invoice yet; ticking one adds its revenue lines. Lines can
// also be typed by hand (detention, an ad-hoc charge).
//
// The totals shown here are a preview using the same formula as the server
// (services/invoiceMath.js). What is saved is what the server computes.

const LINE_KINDS = [
  { value: 'freight', label: 'Freight' },
  { value: 'loading', label: 'Loading' },
  { value: 'unloading', label: 'Unloading' },
  { value: 'detention', label: 'Detention' },
  { value: 'other', label: 'Other charge' },
];

const blankLine = (sac = '') => ({ kind: 'other', description: '', quantity: 1, rate: '', sac });

const preview = (lines, discount, gst) => {
  const subtotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.rate) || 0), 0);
  const taxable = Math.max(0, subtotal - (Number(discount) || 0));
  const tax = gst.mode === 'none' ? 0 : (taxable * (Number(gst.rate) || 0)) / 100;
  const payable = gst.reverseCharge ? taxable : taxable + tax;
  return { subtotal, taxable, tax, total: Math.round(payable) };
};

export function InvoiceForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);

  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [nextNumber, setNextNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [billable, setBillable] = useState([]);
  const [picked, setPicked] = useState(new Set());
  const [manualLines, setManualLines] = useState([]);
  const [tripLines, setTripLines] = useState([]);
  const [form, setForm] = useState({ invoiceDate: toISODate(new Date()), dueDate: '', discount: 0, notes: '', gst: { rate: 0, mode: 'cgst_sgst', reverseCharge: true } });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    customersApi.list().then((r) => setCustomers((r.customers || []).filter((c) => c.status !== 'Blacklisted'))).catch(() => {});
    invoicesApi
      .options()
      .then((o) => {
        setSettings(o.settings);
        setNextNumber(o.nextNumber);
        if (!editing) {
          setForm((f) => ({ ...f, gst: { rate: o.settings.defaultGstRate, mode: 'cgst_sgst', reverseCharge: o.settings.defaultReverseCharge } }));
        }
      })
      .catch(() => {});
  }, [editing]);

  // Editing: load the invoice and split its lines into trip-linked and manual.
  useEffect(() => {
    if (!editing) return;
    invoicesApi
      .get(id)
      .then(({ invoice }) => {
        setCustomerId(String(invoice.customer?._id || invoice.customer));
        setTripLines(invoice.lines.filter((l) => l.tripOrder));
        setManualLines(invoice.lines.filter((l) => !l.tripOrder));
        setPicked(new Set(invoice.lines.filter((l) => l.tripOrder).map((l) => String(l.tripOrder))));
        setForm({
          invoiceDate: toISODate(invoice.invoiceDate),
          dueDate: toISODate(invoice.dueDate),
          discount: invoice.discount,
          notes: invoice.notes,
          gst: invoice.gst,
        });
      })
      .catch((e) => setError(e.message));
  }, [editing, id]);

  // The list is cleared where the customer changes (the select's onChange),
  // so this effect only ever fetches.
  useEffect(() => {
    if (!customerId) return;
    invoicesApi
      .billableTrips(customerId)
      .then((r) => setBillable(r.trips || []))
      .catch((e) => setError(e.message));
  }, [customerId]);

  // Choosing a customer resets the trip picks and takes that customer's own
  // GST rate, when the master has one.
  const chooseCustomer = (value) => {
    setCustomerId(value);
    setBillable([]);
    setPicked(new Set());
    setTripLines([]);
    const c = customers.find((x) => x._id === value);
    if (c?.gstRate) setForm((f) => ({ ...f, gst: { ...f.gst, rate: c.gstRate } }));
  };

  // Reads `picked` directly rather than inside a state updater: the updater may
  // run twice under StrictMode, and adding lines from inside it would duplicate
  // them.
  const toggleTrip = (trip) => {
    const key = String(trip._id);
    const next = new Set(picked);
    if (next.has(key)) {
      next.delete(key);
      setTripLines((ls) => ls.filter((l) => String(l.tripOrder) !== key));
      if (trip.discount) setForm((f) => ({ ...f, discount: Math.max(0, Number(f.discount || 0) - trip.discount) }));
    } else {
      next.add(key);
      setTripLines((ls) => [...ls, ...trip.lines.map((l) => ({ ...l, sac: settings?.defaultSac || '' }))]);
      if (trip.discount) setForm((f) => ({ ...f, discount: Number(f.discount || 0) + trip.discount }));
    }
    setPicked(next);
  };

  const allLines = useMemo(() => [...tripLines, ...manualLines], [tripLines, manualLines]);
  const totals = preview(allLines, form.discount, form.gst);

  const updateManual = (i, key, value) => setManualLines((ls) => ls.map((l, j) => (j === i ? { ...l, [key]: value } : l)));
  const updateTripLine = (i, key, value) => setTripLines((ls) => ls.map((l, j) => (j === i ? { ...l, [key]: value } : l)));

  const save = async (status) => {
    setBusy(true);
    setError('');
    try {
      const payload = {
        customer: customerId,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate || undefined,
        discount: Number(form.discount) || 0,
        notes: form.notes,
        gst: { rate: Number(form.gst.rate) || 0, mode: form.gst.mode, reverseCharge: form.gst.reverseCharge },
        lines: allLines.map((l) => ({ ...l, rate: Number(l.rate) || 0, quantity: Number(l.quantity) || 0 })),
        status,
      };
      const res = editing ? await invoicesApi.update(id, payload) : await invoicesApi.create(payload);
      navigate(`/invoices/${res.invoice._id}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Could not save the invoice');
      setBusy(false);
    }
  };

  const shownTrips = editing
    ? [...billable, ...tripLines.filter((l, i, arr) => arr.findIndex((x) => String(x.tripOrder) === String(l.tripOrder)) === i).map((l) => ({ _id: l.tripOrder, tripNumber: l.tripNumber, route: l.route, vehicleNumber: l.vehicleNumber, amount: null, lines: [], alreadyOnInvoice: true }))]
    : billable;

  return (
    <PageShell>
      <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <PageHeader title={editing ? 'Edit Invoice' : 'New Invoice'} subtitle={!editing && nextNumber ? `Will be numbered ${nextNumber} (allocated when saved)` : undefined} />
      <Banner message={error} onDismiss={() => setError('')} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Panel title="Customer & dates">
            <div className="p-4 grid sm:grid-cols-3 gap-4">
              <label className="text-sm text-slate-700 sm:col-span-3">
                Customer *
                <select value={customerId} disabled={editing} onChange={(e) => chooseCustomer(e.target.value)} className={inputClass}>
                  <option value="">Choose a customer…</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} {c.paymentTerms ? `(${c.paymentTerms})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                Invoice date
                <input type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} className={inputClass} />
              </label>
              <label className="text-sm text-slate-700">
                Due date
                <input type="date" value={form.dueDate} min={form.invoiceDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={inputClass} />
                <span className="text-xs text-slate-500">Blank = from the customer&apos;s payment terms</span>
              </label>
            </div>
          </Panel>

          {customerId && (
            <Panel title="Trips to bill" subtitle="Finished trips for this customer that are not on another invoice">
              {shownTrips.length === 0 ? (
                <EmptyState icon={Truck} title="No unbilled trips" hint="Add lines by hand below, or finish a trip first." />
              ) : (
                <div className="divide-y divide-slate-100">
                  {shownTrips.map((t) => (
                    <label key={t._id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer">
                      <input type="checkbox" checked={picked.has(String(t._id))} onChange={() => (t.alreadyOnInvoice ? null : toggleTrip(t))} disabled={t.alreadyOnInvoice} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          {t.tripNumber} <span className="text-slate-500 font-normal">· {t.vehicleNumber || '—'}</span>
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {t.route || '—'} {t.tripDate ? `· ${formatDate(t.tripDate)}` : ''}
                        </p>
                      </div>
                      <span className="text-sm tabular-nums text-slate-700">{t.amount !== null ? formatCurrency(t.amount) : 'On this invoice'}</span>
                    </label>
                  ))}
                </div>
              )}
            </Panel>
          )}

          <Panel
            title="Invoice lines"
            action={
              <Button variant="secondary" icon={Plus} onClick={() => setManualLines((ls) => [...ls, blankLine(settings?.defaultSac || '')])}>
                Add line
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <Th>Type</Th>
                    <Th>Description</Th>
                    <Th>SAC</Th>
                    <Th right>Qty</Th>
                    <Th right>Rate</Th>
                    <Th right>Amount</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allLines.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                        Tick a trip above or add a line.
                      </td>
                    </tr>
                  )}
                  {tripLines.map((l, i) => (
                    <tr key={`t${i}`}>
                      <Td>{LINE_KINDS.find((k) => k.value === l.kind)?.label}</Td>
                      <Td>
                        <input value={l.description} onChange={(e) => updateTripLine(i, 'description', e.target.value)} className={inputClass} />
                        <span className="text-xs text-slate-500">Trip {l.tripNumber}</span>
                      </Td>
                      <Td>
                        <input value={l.sac || ''} onChange={(e) => updateTripLine(i, 'sac', e.target.value)} className={`${inputClass} w-24`} />
                      </Td>
                      <Td right>{l.quantity}</Td>
                      <Td right>
                        <input type="number" min={0} value={l.rate} onChange={(e) => updateTripLine(i, 'rate', e.target.value)} className={`${inputClass} w-28 text-right`} />
                      </Td>
                      <Td right>{formatCurrency((Number(l.quantity) || 0) * (Number(l.rate) || 0))}</Td>
                      <Td />
                    </tr>
                  ))}
                  {manualLines.map((l, i) => (
                    <tr key={`m${i}`}>
                      <Td>
                        <select value={l.kind} onChange={(e) => updateManual(i, 'kind', e.target.value)} className={inputClass}>
                          {LINE_KINDS.map((k) => (
                            <option key={k.value} value={k.value}>
                              {k.label}
                            </option>
                          ))}
                        </select>
                      </Td>
                      <Td>
                        <input value={l.description} onChange={(e) => updateManual(i, 'description', e.target.value)} placeholder="e.g. Detention at Bhiwandi, 2 days" className={inputClass} />
                      </Td>
                      <Td>
                        <input value={l.sac || ''} onChange={(e) => updateManual(i, 'sac', e.target.value)} className={`${inputClass} w-24`} />
                      </Td>
                      <Td right>
                        <input type="number" min={0} value={l.quantity} onChange={(e) => updateManual(i, 'quantity', e.target.value)} className={`${inputClass} w-20 text-right`} />
                      </Td>
                      <Td right>
                        <input type="number" min={0} value={l.rate} onChange={(e) => updateManual(i, 'rate', e.target.value)} className={`${inputClass} w-28 text-right`} />
                      </Td>
                      <Td right>{formatCurrency((Number(l.quantity) || 0) * (Number(l.rate) || 0))}</Td>
                      <Td>
                        <button type="button" onClick={() => setManualLines((ls) => ls.filter((_, j) => j !== i))} className="p-1.5 text-red-600 hover:bg-red-50 rounded" aria-label="Remove line">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="GST & totals">
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-slate-700">
                  GST %
                  <input type="number" min={0} max={28} value={form.gst.rate} onChange={(e) => setForm({ ...form, gst: { ...form.gst, rate: e.target.value } })} className={inputClass} />
                </label>
                <label className="text-sm text-slate-700">
                  Type
                  <select value={form.gst.mode} onChange={(e) => setForm({ ...form, gst: { ...form.gst, mode: e.target.value } })} className={inputClass}>
                    <option value="cgst_sgst">CGST + SGST</option>
                    <option value="igst">IGST</option>
                    <option value="none">No GST</option>
                  </select>
                </label>
              </div>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" className="mt-1" checked={form.gst.reverseCharge} onChange={(e) => setForm({ ...form, gst: { ...form.gst, reverseCharge: e.target.checked } })} />
                <span>
                  Reverse charge
                  <span className="block text-xs text-slate-500">The customer pays the GST to the government; it is shown but not added to the total.</span>
                </span>
              </label>
              <label className="text-sm text-slate-700 block">
                Discount (₹)
                <input type="number" min={0} value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} className={inputClass} />
              </label>
              <div className="border-t border-slate-200 pt-3 space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(totals.subtotal)}</span></div>
                <div className="flex justify-between"><span>Taxable value</span><span className="tabular-nums">{formatCurrency(totals.taxable)}</span></div>
                <div className="flex justify-between"><span>GST {form.gst.reverseCharge ? '(reverse charge)' : ''}</span><span className="tabular-nums">{formatCurrency(totals.tax)}</span></div>
                <div className="flex justify-between font-semibold text-base pt-1"><span>Invoice total</span><span className="tabular-nums">{formatCurrency(totals.total)}</span></div>
                <p className="text-xs text-slate-500">Preview — the saved invoice uses the server&apos;s figures.</p>
              </div>
            </div>
          </Panel>
          <Panel title="Notes">
            <div className="p-4">
              <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputClass} placeholder="Printed on the invoice" />
            </div>
          </Panel>
          <div className="flex flex-col gap-2">
            <Button busy={busy} disabled={!customerId || !allLines.length} onClick={() => save('issued')}>
              {editing ? 'Save changes' : 'Create & issue invoice'}
            </Button>
            {!editing && (
              <Button variant="secondary" busy={busy} disabled={!customerId || !allLines.length} onClick={() => save('draft')}>
                Save as draft
              </Button>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
