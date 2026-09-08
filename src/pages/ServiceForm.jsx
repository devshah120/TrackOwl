import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Wand2, History } from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { maintenance as api, fleet } from '../services/api';
import { Panel, Banner } from '../components/maintenance/MaintenanceUI';
import {
  SERVICE_TYPES, SERVICE_TYPE_LABELS, SERVICE_INTERVALS,
  PAYMENT_MODES, WORKSHOP_TYPES,
  formatMoney, formatOdometer, formatDate, toDateInput,
} from '../constants/maintenance';

// M3-M02 — record or correct a service visit.
//
// Two things this form does that a plain CRUD form would not:
//
//   1. It shows the vehicle's last service of the same type as soon as a
//      vehicle and type are chosen, so a duplicate entry — or a service being
//      booked far too early — is caught at the keyboard rather than found in a
//      report months later.
//
//   2. It offers the next-due date and reading from the service type's usual
//      interval. Offered, not applied: the record stores whatever the workshop
//      actually specified, and a fleet on its own schedule types its own.
//
// The bill adds up in the browser as the lines are typed, but the server
// recomputes it on save and its answer is the one stored — a total the browser
// derived is one nobody can audit.
export function ServiceForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    truck: '',
    serviceType: 'General',
    servicedAt: toDateInput(new Date()),
    odometer: '',
    workshop: { name: '', type: 'Local', contact: '', city: '', gstin: '' },
    parts: [],
    labourCost: '',
    taxAmount: '',
    discount: '',
    paymentMode: 'Cash',
    invoiceNumber: '',
    nextServiceDate: '',
    nextServiceKm: '',
    notes: '',
  });

  const [trucks, setTrucks] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [history, setHistory] = useState(null);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // --- reference data ------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const [truckRes, workshopRes] = await Promise.all([fleet.list(), api.workshops()]);
        setTrucks(truckRes.trucks || []);
        setWorkshops(workshopRes.workshops || []);
      } catch {
        // The pickers are a convenience; the form still saves without them.
      }
    })();
  }, []);

  // --- existing record -----------------------------------------------------
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await api.services.get(id);
        const r = res.record;
        setForm({
          truck: r.truck?._id || r.truck || '',
          serviceType: r.serviceType || 'General',
          servicedAt: toDateInput(r.servicedAt),
          odometer: r.odometer ?? '',
          workshop: {
            name: r.workshop?.name || '',
            type: r.workshop?.type || 'Local',
            contact: r.workshop?.contact || '',
            city: r.workshop?.city || '',
            gstin: r.workshop?.gstin || '',
          },
          parts: (r.parts || []).map((p) => ({
            name: p.name || '',
            partNumber: p.partNumber || '',
            quantity: p.quantity ?? 1,
            unitPrice: p.unitPrice ?? 0,
            warrantyMonths: p.warrantyMonths ?? '',
          })),
          labourCost: r.labourCost ?? '',
          taxAmount: r.taxAmount ?? '',
          discount: r.discount ?? '',
          paymentMode: r.paymentMode || 'Cash',
          invoiceNumber: r.invoiceNumber || '',
          nextServiceDate: toDateInput(r.nextServiceDate),
          nextServiceKm: r.nextServiceKm ?? '',
          notes: r.notes || '',
        });
      } catch (err) {
        setError(err.message || 'Failed to load that service record');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit]);

  // --- the vehicle's own history ------------------------------------------
  //
  // Loaded whenever the vehicle changes, so the last service of the chosen type
  // can be shown beside the form.
  useEffect(() => {
    // Both branches go through the async continuation rather than clearing
    // synchronously in the effect body, which would cascade a second render
    // before this one had finished.
    (async () => {
      if (!form.truck) {
        setHistory(null);
        return;
      }
      try {
        setHistory(await api.vehicleHistory(form.truck));
      } catch {
        setHistory(null);
      }
    })();
  }, [form.truck]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setWorkshop = (patch) => setForm((f) => ({ ...f, workshop: { ...f.workshop, ...patch } }));

  // The vehicle's current odometer, offered as the starting suggestion so the
  // reading does not have to be looked up.
  const vehicle = trucks.find((t) => t._id === form.truck);
  const lastOfType = history?.lastByType?.[form.serviceType] || null;

  // --- the bill ------------------------------------------------------------
  //
  // Mirrors computeJobTotal on the server. Shown so the total appears before
  // saving; the server recomputes and its answer is what is stored.
  const totals = useMemo(() => {
    const partsTotal = form.parts.reduce((sum, p) => {
      const qty = Number(p.quantity) || 0;
      const rate = Number(p.unitPrice) || 0;
      return sum + qty * rate;
    }, 0);
    const labour = Number(form.labourCost) || 0;
    const tax = Number(form.taxAmount) || 0;
    const off = Number(form.discount) || 0;
    return {
      partsTotal,
      total: Math.max(0, partsTotal + labour + tax - off),
    };
  }, [form.parts, form.labourCost, form.taxAmount, form.discount]);

  const addPart = () =>
    set({ parts: [...form.parts, { name: '', partNumber: '', quantity: 1, unitPrice: '', warrantyMonths: '' }] });

  const setPart = (index, patch) =>
    set({ parts: form.parts.map((p, i) => (i === index ? { ...p, ...patch } : p)) });

  const removePart = (index) => set({ parts: form.parts.filter((_, i) => i !== index) });

  // M3-M10 — ask the server what the next service should be, from the type's
  // usual interval. The user still has to accept it.
  const suggestNext = useCallback(async () => {
    try {
      const res = await api.nextServiceSuggestion({
        serviceType: form.serviceType,
        servicedAt: form.servicedAt,
        odometer: form.odometer || undefined,
      });
      set({
        nextServiceDate: toDateInput(res.nextServiceDate),
        nextServiceKm: res.nextServiceKm ?? '',
      });
    } catch (err) {
      setError(err.message || 'Could not work out the next service');
    }
  }, [form.serviceType, form.servicedAt, form.odometer]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    // Empty strings are sent as nulls rather than as '', so a cleared optional
    // field is genuinely cleared and a blank number does not become zero.
    const payload = {
      truck: form.truck,
      serviceType: form.serviceType,
      servicedAt: form.servicedAt,
      odometer: form.odometer === '' ? null : Number(form.odometer),
      workshop: form.workshop,
      parts: form.parts
        .filter((p) => p.name.trim())
        .map((p) => ({
          name: p.name,
          partNumber: p.partNumber,
          quantity: Number(p.quantity) || 0,
          unitPrice: Number(p.unitPrice) || 0,
          warrantyMonths: p.warrantyMonths === '' ? null : Number(p.warrantyMonths),
        })),
      labourCost: form.labourCost === '' ? 0 : Number(form.labourCost),
      taxAmount: form.taxAmount === '' ? 0 : Number(form.taxAmount),
      discount: form.discount === '' ? 0 : Number(form.discount),
      paymentMode: form.paymentMode,
      invoiceNumber: form.invoiceNumber,
      nextServiceDate: form.nextServiceDate || null,
      nextServiceKm: form.nextServiceKm === '' ? null : Number(form.nextServiceKm),
      notes: form.notes,
    };

    try {
      if (isEdit) await api.services.update(id, payload);
      else await api.services.create(payload);
      navigate('/maintenance/services');
    } catch (err) {
      setError(err.message || 'Could not save the service record');
      setSaving(false);
    }
  };

  const interval = SERVICE_INTERVALS[form.serviceType] || {};

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <Topbar />
        <main className="flex-1 flex items-center justify-center text-slate-500">
          Loading the service record…
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />

      <main className="flex-1 overflow-y-auto">
        <form onSubmit={submit} className="p-6 w-full max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/maintenance/services')}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                {isEdit ? 'Edit Service Record' : 'Record a Service'}
              </h1>
              <p className="text-slate-600 mt-1">
                What was done, what it cost, and when it is next due
              </p>
            </div>
          </div>

          <Banner tone="error" message={error} onDismiss={() => setError('')} />

          {/* --- what was serviced --- */}
          <Panel title="Vehicle and service">
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Vehicle" required>
                <select
                  required
                  value={form.truck}
                  onChange={(e) => set({ truck: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a vehicle</option>
                  {trucks.map((t) => (
                    <option key={t._id} value={t._id}>{t.number} — {t.model}</option>
                  ))}
                </select>
              </Field>

              <Field label="Service type" required>
                <select
                  required
                  value={form.serviceType}
                  onChange={(e) => set({ serviceType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SERVICE_TYPES.map((t) => (
                    <option key={t} value={t}>{SERVICE_TYPE_LABELS[t]}</option>
                  ))}
                </select>
                {/* The usual interval, so the suggestion below is explicable. */}
                {(interval.km || interval.months) && (
                  <p className="text-xs text-slate-500 mt-1">
                    usually every
                    {interval.km ? ` ${interval.km.toLocaleString('en-IN')} km` : ''}
                    {interval.km && interval.months ? ' or' : ''}
                    {interval.months ? ` ${interval.months} months` : ''}
                  </p>
                )}
              </Field>

              <Field label="Service date" required>
                <input
                  type="date" required
                  value={form.servicedAt}
                  onChange={(e) => set({ servicedAt: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>

              <Field label="Odometer (km)">
                <input
                  type="number" min="0" step="1"
                  value={form.odometer}
                  onChange={(e) => set({ odometer: e.target.value })}
                  placeholder={vehicle?.odometer ? String(vehicle.odometer) : ''}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {vehicle?.odometer ? (
                  <p className="text-xs text-slate-500 mt-1">
                    vehicle currently reads {formatOdometer(vehicle.odometer)}
                  </p>
                ) : null}
              </Field>

              <Field label="Invoice number">
                <input
                  type="text"
                  value={form.invoiceNumber}
                  onChange={(e) => set({ invoiceNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>

              <Field label="Paid by">
                <select
                  value={form.paymentMode}
                  onChange={(e) => set({ paymentMode: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* The last service of this type on this vehicle. Shown so a
                duplicate — or a service being done far too early — is obvious
                before it is saved. */}
            {lastOfType && (
              <div className="mx-4 mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                <History className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-900">
                  Last {SERVICE_TYPE_LABELS[form.serviceType]?.toLowerCase()} on this vehicle was{' '}
                  <strong>{formatDate(lastOfType.servicedAt)}</strong>
                  {lastOfType.odometer ? ` at ${formatOdometer(lastOfType.odometer)}` : ''}
                  {lastOfType.totalCost ? `, costing ${formatMoney(lastOfType.totalCost)}` : ''}.
                  {lastOfType.nextServiceKm || lastOfType.nextServiceDate ? (
                    <>
                      {' '}It was due again
                      {lastOfType.nextServiceDate ? ` on ${formatDate(lastOfType.nextServiceDate)}` : ''}
                      {lastOfType.nextServiceKm ? ` at ${formatOdometer(lastOfType.nextServiceKm)}` : ''}.
                    </>
                  ) : null}
                </div>
              </div>
            )}
          </Panel>

          {/* --- workshop --- */}
          <Panel title="Workshop">
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Name">
                <input
                  type="text" list="workshop-names"
                  value={form.workshop.name}
                  onChange={(e) => setWorkshop({ name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {/* Names already used by this account, so a garage is not
                    re-spelled into two rows on the vendor report. */}
                <datalist id="workshop-names">
                  {workshops.map((w) => (
                    <option key={w.name} value={w.name}>{w.city}</option>
                  ))}
                </datalist>
              </Field>

              <Field label="Type">
                <select
                  value={form.workshop.type}
                  onChange={(e) => setWorkshop({ type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {WORKSHOP_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>

              <Field label="City">
                <input
                  type="text"
                  value={form.workshop.city}
                  onChange={(e) => setWorkshop({ city: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>

              <Field label="Contact">
                <input
                  type="text"
                  value={form.workshop.contact}
                  onChange={(e) => setWorkshop({ contact: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>

              <Field label="GSTIN">
                <input
                  type="text"
                  value={form.workshop.gstin}
                  onChange={(e) => setWorkshop({ gstin: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
            </div>
          </Panel>

          {/* --- parts and labour --- */}
          <Panel
            title="Parts and labour"
            subtitle="Each part is a line, so the parts report can answer what the fleet spends on any one of them"
            action={
              <button
                type="button"
                onClick={addPart}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-4 h-4" /> Add part
              </button>
            }
          >
            <div className="p-4 space-y-3">
              {form.parts.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No parts on this job. Labour-only work is normal — add lines only if parts were fitted.
                </p>
              ) : (
                form.parts.map((part, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-start">
                    <input
                      type="text" placeholder="Part name"
                      value={part.name}
                      onChange={(e) => setPart(i, { name: e.target.value })}
                      className="col-span-12 md:col-span-4 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text" placeholder="Part no."
                      value={part.partNumber}
                      onChange={(e) => setPart(i, { partNumber: e.target.value })}
                      className="col-span-4 md:col-span-2 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number" min="0" step="0.01" placeholder="Qty"
                      value={part.quantity}
                      onChange={(e) => setPart(i, { quantity: e.target.value })}
                      className="col-span-3 md:col-span-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number" min="0" step="0.01" placeholder="Rate"
                      value={part.unitPrice}
                      onChange={(e) => setPart(i, { unitPrice: e.target.value })}
                      className="col-span-5 md:col-span-2 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="col-span-8 md:col-span-2 px-3 py-2 text-sm text-slate-700 text-right">
                      {formatMoney((Number(part.quantity) || 0) * (Number(part.unitPrice) || 0))}
                    </div>
                    <button
                      type="button"
                      onClick={() => removePart(i)}
                      className="col-span-4 md:col-span-1 p-2 hover:bg-red-50 text-red-600 rounded transition-colors justify-self-end"
                      title="Remove this part"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}

              <div className="pt-3 border-t border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
                <Field label="Labour cost">
                  <input
                    type="number" min="0" step="0.01"
                    value={form.labourCost}
                    onChange={(e) => set({ labourCost: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
                <Field label="Tax">
                  <input
                    type="number" min="0" step="0.01"
                    value={form.taxAmount}
                    onChange={(e) => set({ taxAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
                <Field label="Discount">
                  <input
                    type="number" min="0" step="0.01"
                    value={form.discount}
                    onChange={(e) => set({ discount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
                <div className="flex flex-col justify-end">
                  <p className="text-sm text-slate-500">Total</p>
                  <p className="text-2xl font-bold text-slate-900">{formatMoney(totals.total)}</p>
                  <p className="text-xs text-slate-500">
                    {formatMoney(totals.partsTotal)} parts
                  </p>
                </div>
              </div>
            </div>
          </Panel>

          {/* --- M3-M10: next due --- */}
          <Panel
            title="Next service"
            subtitle="Either clock, or both — whichever comes first is what the reminder uses"
            action={
              <button
                type="button"
                onClick={suggestNext}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Wand2 className="w-4 h-4" /> Suggest from interval
              </button>
            }
          >
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Next service date">
                <input
                  type="date"
                  value={form.nextServiceDate}
                  onChange={(e) => set({ nextServiceDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
              <Field label="Next service at (km)">
                <input
                  type="number" min="0" step="1"
                  value={form.nextServiceKm}
                  onChange={(e) => set({ nextServiceKm: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Notes">
            <div className="p-4">
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => set({ notes: e.target.value })}
                placeholder="Anything the next person opening this record should know."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </Panel>

          <div className="flex justify-end gap-2 pb-6">
            <button
              type="button"
              onClick={() => navigate('/maintenance/services')}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Record service'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
    </div>
  );
}
