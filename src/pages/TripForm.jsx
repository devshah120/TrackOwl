import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, MapPin, Package, FileText, User } from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { usePermissions } from '../hooks/usePermissions';
import { tripOrders, customers as customersApi } from '../services/api';
import { TRIP_TYPES, TRIP_TYPE_LABELS } from '../constants/trip';

// Create and edit the trip's own details: what it is, who it is for, and where
// it goes.
//
// Deliberately does not cover assignment, cargo, money, dispatch or POD. Each
// of those has its own validation on the server (a vehicle already out, a load
// over capacity, an odometer that runs backwards) and its own place on the trip
// detail page. Putting them in this form would mean either duplicating that
// validation in the browser or letting the operator fill in six sections before
// discovering the first one was refused.
//
// So: this creates the trip, then the detail page is where it is built up.
export function TripForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { can } = usePermissions();

  const [form, setForm] = useState({
    tripDate: new Date().toISOString().slice(0, 10),
    tripType: 'one_way',
    customer: '',
    customerReferences: { po: '', bookingNumber: '', customerRef: '', invoiceRef: '' },
    pickup: emptyLocation(),
    destination: emptyLocation(),
    pickupPlannedAt: '',
    destinationExpectedAt: '',
    consignment: {
      lrNumber: '', consignmentNumber: '', ewayBill: '',
      invoiceNumber: '', challanNumber: '', poNumber: '', deliveryOrder: '',
    },
    plannedKm: '',
    plannedMinutes: '',
    notes: '',
  });

  const [customerList, setCustomerList] = useState([]);
  const [tripNumber, setTripNumber] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // The selected customer's own record, so the form can show the terms and
  // GSTIN the trip will be billed under without the operator opening another
  // screen. Read-only here — the master is edited in its own module.
  const selectedCustomer = customerList.find((c) => c._id === form.customer) || null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [customerRes, numberRes] = await Promise.allSettled([
          customersApi.list({ status: 'Active' }),
          isEdit ? Promise.resolve(null) : tripOrders.nextNumber(),
        ]);
        if (cancelled) return;
        if (customerRes.status === 'fulfilled') setCustomerList(customerRes.value.customers || []);
        if (numberRes.status === 'fulfilled' && numberRes.value) {
          setTripNumber(numberRes.value.tripNumber);
        }

        if (isEdit) {
          const res = await tripOrders.get(id);
          if (cancelled) return;
          const t = res.trip;
          setTripNumber(t.tripNumber);
          setForm({
            tripDate: t.tripDate ? new Date(t.tripDate).toISOString().slice(0, 10) : '',
            tripType: t.tripType || 'one_way',
            customer: t.customer?._id || t.customer || '',
            customerReferences: {
              po: t.customerReferences?.po || '',
              bookingNumber: t.customerReferences?.bookingNumber || '',
              customerRef: t.customerReferences?.customerRef || '',
              invoiceRef: t.customerReferences?.invoiceRef || '',
            },
            pickup: { ...emptyLocation(), ...(t.pickup || {}) },
            destination: { ...emptyLocation(), ...(t.destination || {}) },
            pickupPlannedAt: toLocalInput(t.pickupPlannedAt),
            destinationExpectedAt: toLocalInput(t.destinationExpectedAt),
            consignment: {
              lrNumber: t.consignment?.lrNumber || '',
              consignmentNumber: t.consignment?.consignmentNumber || '',
              ewayBill: t.consignment?.ewayBill || '',
              invoiceNumber: t.consignment?.invoiceNumber || '',
              challanNumber: t.consignment?.challanNumber || '',
              poNumber: t.consignment?.poNumber || '',
              deliveryOrder: t.consignment?.deliveryOrder || '',
            },
            plannedKm: t.plannedKm ?? '',
            plannedMinutes: t.plannedMinutes ?? '',
            notes: t.notes || '',
          });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load the trip');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isEdit]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setNested = (key, patch) =>
    setForm((f) => ({ ...f, [key]: { ...f[key], ...patch } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.pickup.city && !form.pickup.name) {
      setError('A pickup location is required');
      return;
    }
    if (!form.destination.city && !form.destination.name) {
      setError('A destination is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        // Empty strings would be stored as 0 by a Number() cast; null is what
        // "not planned yet" actually means, and the server distinguishes them.
        plannedKm: form.plannedKm === '' ? null : Number(form.plannedKm),
        plannedMinutes: form.plannedMinutes === '' ? null : Number(form.plannedMinutes),
        customer: form.customer || null,
        pickupPlannedAt: form.pickupPlannedAt || null,
        destinationExpectedAt: form.destinationExpectedAt || null,
      };

      const res = isEdit
        ? await tripOrders.update(id, payload)
        : await tripOrders.create(payload);

      // Straight to the detail page: creating the trip is only the first step,
      // and assignment, cargo and dispatch all live there.
      navigate(`/trips/${res.trip._id}`);
    } catch (err) {
      setError(err.message || 'Failed to save the trip');
      setSaving(false);
    }
  };

  const readOnly = isEdit ? !can('trips', 'update') : !can('trips', 'create');

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <Topbar />
        <div className="flex-1 flex items-center justify-center text-slate-500">
          Loading trip...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />

      <main className="flex-1 overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6 w-full max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate(isEdit ? `/trips/${id}` : '/trips')}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                {isEdit ? 'Edit Trip' : 'Create Trip'}
              </h1>
              <p className="text-slate-600 mt-1">
                {tripNumber ? (
                  <>
                    Trip number{' '}
                    <span className="font-medium text-slate-900">{tripNumber}</span>
                    {!isEdit && (
                      <span className="text-slate-500"> — allocated when you save</span>
                    )}
                  </>
                ) : (
                  'Trip details'
                )}
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Trip details */}
          <Section icon={FileText} title="Trip Details">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Trip Date" required>
                <input
                  type="date"
                  value={form.tripDate}
                  onChange={(e) => set({ tripDate: e.target.value })}
                  required
                  disabled={readOnly}
                  className={inputClass}
                />
              </Field>
              <Field label="Trip Type">
                <select
                  value={form.tripType}
                  onChange={(e) => set({ tripType: e.target.value })}
                  disabled={readOnly}
                  className={inputClass}
                >
                  {TRIP_TYPES.map((t) => (
                    <option key={t} value={t}>{TRIP_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Customer">
                <select
                  value={form.customer}
                  onChange={(e) => set({ customer: e.target.value })}
                  disabled={readOnly}
                  className={inputClass}
                >
                  <option value="">No customer yet</option>
                  {customerList.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}{c.code ? ` (${c.code})` : ''}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* What the trip inherits from the customer master, shown so the
                operator can see the terms before booking rather than after. */}
            {selectedCustomer && (
              <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">GSTIN</p>
                  <p className="font-medium text-slate-900">{selectedCustomer.gstin || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Payment Terms</p>
                  <p className="font-medium text-slate-900">{selectedCustomer.paymentTerms || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Credit Limit</p>
                  <p className="font-medium text-slate-900">
                    {selectedCustomer.creditLimit != null
                      ? `₹${Number(selectedCustomer.creditLimit).toLocaleString('en-IN')}`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Billing City</p>
                  <p className="font-medium text-slate-900">
                    {selectedCustomer.billingAddress?.city || '—'}
                  </p>
                </div>
              </div>
            )}
          </Section>

          {/* Customer references */}
          <Section icon={User} title="Customer References">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Field label="PO Number">
                <input
                  type="text"
                  value={form.customerReferences.po}
                  onChange={(e) => setNested('customerReferences', { po: e.target.value })}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Field>
              <Field label="Booking Number">
                <input
                  type="text"
                  value={form.customerReferences.bookingNumber}
                  onChange={(e) => setNested('customerReferences', { bookingNumber: e.target.value })}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Field>
              <Field label="Customer Reference">
                <input
                  type="text"
                  value={form.customerReferences.customerRef}
                  onChange={(e) => setNested('customerReferences', { customerRef: e.target.value })}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Field>
              <Field label="Invoice Reference">
                <input
                  type="text"
                  value={form.customerReferences.invoiceRef}
                  onChange={(e) => setNested('customerReferences', { invoiceRef: e.target.value })}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Field>
            </div>
          </Section>

          {/* Pickup */}
          <Section icon={MapPin} title="Pickup">
            <LocationFields
              value={form.pickup}
              onChange={(patch) => setNested('pickup', patch)}
              disabled={readOnly}
              notesLabel="Loading Notes"
            />
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Planned Pickup Date & Time">
                <input
                  type="datetime-local"
                  value={form.pickupPlannedAt}
                  onChange={(e) => set({ pickupPlannedAt: e.target.value })}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Field>
            </div>
          </Section>

          {/* Destination */}
          <Section icon={MapPin} title="Destination">
            <LocationFields
              value={form.destination}
              onChange={(patch) => setNested('destination', patch)}
              disabled={readOnly}
              notesLabel="Unloading Notes"
            />
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Expected Delivery Date & Time">
                <input
                  type="datetime-local"
                  value={form.destinationExpectedAt}
                  onChange={(e) => set({ destinationExpectedAt: e.target.value })}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Field>
            </div>
          </Section>

          {/* Plan */}
          <Section icon={MapPin} title="Planned Distance & Time">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label="Planned KM"
                hint="What the route is expected to cover. Actual distance is measured from the odometer readings at start and end."
              >
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.plannedKm}
                  onChange={(e) => set({ plannedKm: e.target.value })}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Field>
              <Field label="Planned Time (minutes)">
                <input
                  type="number"
                  min="0"
                  value={form.plannedMinutes}
                  onChange={(e) => set({ plannedMinutes: e.target.value })}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Field>
            </div>
          </Section>

          {/* LR / consignment */}
          <Section icon={Package} title="LR / Consignment">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                ['lrNumber', 'LR Number'],
                ['consignmentNumber', 'Consignment Number'],
                ['ewayBill', 'E-way Bill'],
                ['invoiceNumber', 'Invoice Number'],
                ['challanNumber', 'Challan Number'],
                ['poNumber', 'PO Number'],
                ['deliveryOrder', 'Delivery Order'],
              ].map(([key, label]) => (
                <Field key={key} label={label}>
                  <input
                    type="text"
                    value={form.consignment[key]}
                    onChange={(e) => setNested('consignment', { [key]: e.target.value })}
                    disabled={readOnly}
                    className={inputClass}
                  />
                </Field>
              ))}
            </div>
          </Section>

          {/* Notes */}
          <Section icon={FileText} title="Notes">
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              disabled={readOnly}
              placeholder="Anything the dispatcher or driver should know about this trip"
              className={inputClass}
            />
          </Section>

          {/* Actions */}
          <div className="flex items-center justify-between gap-4 pb-8">
            <p className="text-sm text-slate-500">
              {isEdit
                ? 'Vehicle, cargo, money and dispatch are managed on the trip page.'
                : 'You will assign a vehicle, cargo and pricing after saving.'}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(isEdit ? `/trips/${id}` : '/trips')}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || readOnly}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Trip'}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}

// --- small building blocks, local to this form -----------------------------

const inputClass =
  'w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500';

function emptyLocation() {
  return {
    name: '', address: '', city: '', state: '', pincode: '',
    contactName: '', contactPhone: '', lat: null, lng: null, notes: '',
  };
}

// A datetime-local input needs 'YYYY-MM-DDTHH:mm' in local time; an ISO string
// from the API is UTC and would display an hour or more off.
function toLocalInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

// The address block shared by pickup and destination. Coordinates are optional
// throughout: an operator can type an address the map has never heard of, and
// the trip still saves — it simply is not drawable until coordinates exist.
function LocationFields({ value, onChange, disabled, notesLabel }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Location Name">
          <input
            type="text"
            value={value.name || ''}
            onChange={(e) => onChange({ name: e.target.value })}
            disabled={disabled}
            placeholder="e.g. Bhiwandi Warehouse"
            className={inputClass}
          />
        </Field>
        <Field label="Address">
          <input
            type="text"
            value={value.address || ''}
            onChange={(e) => onChange({ address: e.target.value })}
            disabled={disabled}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="City">
          <input
            type="text"
            value={value.city || ''}
            onChange={(e) => onChange({ city: e.target.value })}
            disabled={disabled}
            className={inputClass}
          />
        </Field>
        <Field label="State">
          <input
            type="text"
            value={value.state || ''}
            onChange={(e) => onChange({ state: e.target.value })}
            disabled={disabled}
            className={inputClass}
          />
        </Field>
        <Field label="PIN Code">
          <input
            type="text"
            value={value.pincode || ''}
            onChange={(e) => onChange({ pincode: e.target.value })}
            disabled={disabled}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Field label="Contact Person">
          <input
            type="text"
            value={value.contactName || ''}
            onChange={(e) => onChange({ contactName: e.target.value })}
            disabled={disabled}
            className={inputClass}
          />
        </Field>
        <Field label="Contact Phone">
          <input
            type="text"
            value={value.contactPhone || ''}
            onChange={(e) => onChange({ contactPhone: e.target.value })}
            disabled={disabled}
            className={inputClass}
          />
        </Field>
        <Field label="Latitude" hint="Optional — needed to draw the route">
          <input
            type="number"
            step="any"
            value={value.lat ?? ''}
            onChange={(e) => onChange({ lat: e.target.value === '' ? null : Number(e.target.value) })}
            disabled={disabled}
            className={inputClass}
          />
        </Field>
        <Field label="Longitude">
          <input
            type="number"
            step="any"
            value={value.lng ?? ''}
            onChange={(e) => onChange({ lng: e.target.value === '' ? null : Number(e.target.value) })}
            disabled={disabled}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label={notesLabel}>
        <textarea
          rows={2}
          value={value.notes || ''}
          onChange={(e) => onChange({ notes: e.target.value })}
          disabled={disabled}
          className={inputClass}
        />
      </Field>
    </div>
  );
}
