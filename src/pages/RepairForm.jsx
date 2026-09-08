import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { maintenance as api, fleet, drivers as driversApi } from '../services/api';
import { Panel, Banner } from '../components/maintenance/MaintenanceUI';
import {
  REPAIR_PRIORITIES, REPAIR_PRIORITY_LABELS, PAYMENT_MODES, WORKSHOP_TYPES,
  formatMoney, formatOdometer, toDateTimeLocal,
} from '../constants/maintenance';

// M3-M04 — raise or edit a repair request.
//
// The status is deliberately absent from this form. A repair moves through its
// workflow on the detail screen, where the transition is checked and the note
// goes onto the job's timeline — letting a field edit set the status would let
// a job skip from Reported to Completed with no record of the work in between.
//
// The cost fields are here rather than only on completion because a workshop
// invoice arrives when it arrives, and forcing the whole bill to be typed in
// one go at the moment of completion is not how the office works.
export function RepairForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    truck: '',
    issue: '',
    reportedBy: '',
    reportedAt: toDateTimeLocal(new Date()),
    odometer: '',
    priority: 'Medium',
    workshop: { name: '', type: 'Local', contact: '', city: '', gstin: '' },
    estimatedCost: '',
    parts: [],
    labourCost: '',
    taxAmount: '',
    discount: '',
    paymentMode: 'Cash',
    invoiceNumber: '',
    diagnosis: '',
    workDone: '',
    notes: '',
  });

  const [trucks, setTrucks] = useState([]);
  const [driverList, setDriverList] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [nextNumber, setNextNumber] = useState('');

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [truckRes, driverRes, workshopRes] = await Promise.all([
          fleet.list(),
          driversApi.list(),
          api.workshops(),
        ]);
        setTrucks(truckRes.trucks || []);
        setDriverList(driverRes.drivers || []);
        setWorkshops(workshopRes.workshops || []);
      } catch {
        // The pickers are a convenience; the form still saves without them.
      }
    })();
  }, []);

  // The number this request would take, shown before anything is saved. A
  // preview only — it is not reserved, and the request gets its number at save
  // time.
  useEffect(() => {
    if (isEdit) return;
    (async () => {
      try {
        const res = await api.repairs.nextNumber();
        setNextNumber(res.requestNumber || '');
      } catch {
        // Cosmetic: the request still gets a number on save.
      }
    })();
  }, [isEdit]);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await api.repairs.get(id);
        const r = res.request;
        setForm({
          truck: r.truck?._id || r.truck || '',
          issue: r.issue || '',
          reportedBy: r.reportedBy?._id || r.reportedBy || '',
          reportedAt: toDateTimeLocal(r.reportedAt),
          odometer: r.odometer ?? '',
          priority: r.priority || 'Medium',
          workshop: {
            name: r.workshop?.name || '',
            type: r.workshop?.type || 'Local',
            contact: r.workshop?.contact || '',
            city: r.workshop?.city || '',
            gstin: r.workshop?.gstin || '',
          },
          estimatedCost: r.estimatedCost ?? '',
          parts: (r.parts || []).map((p) => ({
            name: p.name || '',
            partNumber: p.partNumber || '',
            quantity: p.quantity ?? 1,
            unitPrice: p.unitPrice ?? 0,
          })),
          labourCost: r.labourCost ?? '',
          taxAmount: r.taxAmount ?? '',
          discount: r.discount ?? '',
          paymentMode: r.paymentMode || 'Cash',
          invoiceNumber: r.invoiceNumber || '',
          diagnosis: r.diagnosis || '',
          workDone: r.workDone || '',
          notes: r.notes || '',
        });
        setNextNumber(r.requestNumber || '');
      } catch (err) {
        setError(err.message || 'Failed to load that repair request');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setWorkshop = (patch) => setForm((f) => ({ ...f, workshop: { ...f.workshop, ...patch } }));

  const vehicle = trucks.find((t) => t._id === form.truck);

  const totals = useMemo(() => {
    const partsTotal = form.parts.reduce(
      (sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.unitPrice) || 0),
      0
    );
    const labour = Number(form.labourCost) || 0;
    const tax = Number(form.taxAmount) || 0;
    const off = Number(form.discount) || 0;
    return { partsTotal, total: Math.max(0, partsTotal + labour + tax - off) };
  }, [form.parts, form.labourCost, form.taxAmount, form.discount]);

  // Over the estimate is worth flagging while the bill is still being typed,
  // not only once it is saved.
  const overEstimate =
    form.estimatedCost && totals.total > Number(form.estimatedCost)
      ? totals.total - Number(form.estimatedCost)
      : 0;

  const addPart = () =>
    set({ parts: [...form.parts, { name: '', partNumber: '', quantity: 1, unitPrice: '' }] });

  const setPart = (index, patch) =>
    set({ parts: form.parts.map((p, i) => (i === index ? { ...p, ...patch } : p)) });

  const removePart = (index) => set({ parts: form.parts.filter((_, i) => i !== index) });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      truck: form.truck,
      issue: form.issue,
      reportedBy: form.reportedBy || null,
      reportedAt: form.reportedAt,
      odometer: form.odometer === '' ? null : Number(form.odometer),
      priority: form.priority,
      workshop: form.workshop,
      estimatedCost: form.estimatedCost === '' ? null : Number(form.estimatedCost),
      parts: form.parts
        .filter((p) => p.name.trim())
        .map((p) => ({
          name: p.name,
          partNumber: p.partNumber,
          quantity: Number(p.quantity) || 0,
          unitPrice: Number(p.unitPrice) || 0,
        })),
      labourCost: form.labourCost === '' ? 0 : Number(form.labourCost),
      taxAmount: form.taxAmount === '' ? 0 : Number(form.taxAmount),
      discount: form.discount === '' ? 0 : Number(form.discount),
      paymentMode: form.paymentMode,
      invoiceNumber: form.invoiceNumber,
      diagnosis: form.diagnosis,
      workDone: form.workDone,
      notes: form.notes,
    };

    try {
      if (isEdit) {
        await api.repairs.update(id, payload);
        navigate(`/maintenance/repairs/${id}`);
      } else {
        const res = await api.repairs.create(payload);
        navigate(`/maintenance/repairs/${res.request._id}`);
      }
    } catch (err) {
      setError(err.message || 'Could not save the repair request');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <Topbar />
        <main className="flex-1 flex items-center justify-center text-slate-500">
          Loading the repair request…
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
              onClick={() => navigate(isEdit ? `/maintenance/repairs/${id}` : '/maintenance/repairs')}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                {isEdit ? 'Edit Repair Request' : 'Report a Fault'}
              </h1>
              <p className="text-slate-600 mt-1">
                {nextNumber ? `${nextNumber} · ` : ''}
                What is wrong, who found it, and what it will take to fix
              </p>
            </div>
          </div>

          <Banner tone="error" message={error} onDismiss={() => setError('')} />

          <Panel title="The fault">
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                <Field label="Priority">
                  <select
                    value={form.priority}
                    onChange={(e) => set({ priority: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {REPAIR_PRIORITIES.map((p) => (
                      <option key={p} value={p}>{REPAIR_PRIORITY_LABELS[p]}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Reported at">
                  <input
                    type="datetime-local"
                    value={form.reportedAt}
                    onChange={(e) => set({ reportedAt: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
              </div>

              <Field label="What is wrong" required>
                <textarea
                  required rows={3}
                  value={form.issue}
                  onChange={(e) => set({ issue: e.target.value })}
                  placeholder="In the reporter's own words — e.g. Judder from the front end under braking, worse when loaded."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Reported by">
                  <select
                    value={form.reportedBy}
                    onChange={(e) => set({ reportedBy: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {/* Optional: the office raises requests too, and a fault
                        found in the yard has no driver against it. */}
                    <option value="">Not a driver / office raised</option>
                    {driverList.map((d) => (
                      <option key={d._id} value={d._id}>{d.name}</option>
                    ))}
                  </select>
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
              </div>
            </div>
          </Panel>

          <Panel title="Workshop and estimate">
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Workshop">
                <input
                  type="text" list="repair-workshops"
                  value={form.workshop.name}
                  onChange={(e) => setWorkshop({ name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <datalist id="repair-workshops">
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

              <Field label="Estimated cost">
                <input
                  type="number" min="0" step="0.01"
                  value={form.estimatedCost}
                  onChange={(e) => set({ estimatedCost: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  what the workshop quoted, for comparing against the final bill
                </p>
              </Field>

              <Field label="Invoice number">
                <input
                  type="text"
                  value={form.invoiceNumber}
                  onChange={(e) => set({ invoiceNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
            </div>
          </Panel>

          <Panel
            title="Parts and labour"
            subtitle="Fill these in as the invoice arrives — the job does not have to be finished first"
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
                  No parts yet. Add them when the workshop tells you what it needed.
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
                <div className="flex flex-col justify-end">
                  <p className="text-sm text-slate-500">Total</p>
                  <p className="text-2xl font-bold text-slate-900">{formatMoney(totals.total)}</p>
                  {overEstimate > 0 ? (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {formatMoney(overEstimate)} over estimate
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">{formatMoney(totals.partsTotal)} parts</p>
                  )}
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Findings">
            <div className="p-4 space-y-4">
              <Field label="Diagnosis">
                <textarea
                  rows={2}
                  value={form.diagnosis}
                  onChange={(e) => set({ diagnosis: e.target.value })}
                  placeholder="What the workshop found — as opposed to what was reported."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
              <Field label="Work done">
                <textarea
                  rows={2}
                  value={form.workDone}
                  onChange={(e) => set({ workDone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
              <Field label="Notes">
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => set({ notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
            </div>
          </Panel>

          <div className="flex justify-end gap-2 pb-6">
            <button
              type="button"
              onClick={() => navigate(isEdit ? `/maintenance/repairs/${id}` : '/maintenance/repairs')}
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
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Raise request'}
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
