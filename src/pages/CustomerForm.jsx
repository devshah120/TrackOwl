import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Building2, MapPin, Users, Plus, Trash2, Star } from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { usePermissions } from '../hooks/usePermissions';
import { customers as customersApi } from '../services/api';
import {
  PAYMENT_TERMS, CUSTOMER_STATUSES, TRIP_STATUS_LABELS,
  formatCurrency, formatDate,
} from '../constants/trip';

// Create and edit one customer.
export function CustomerForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { can } = usePermissions();

  const [form, setForm] = useState({
    name: '', legalName: '', code: '', gstin: '', pan: '',
    billingAddress: emptyAddress(),
    shippingAddress: emptyAddress(),
    contacts: [],
    paymentTerms: 'Net 30',
    creditLimit: '',
    gstRate: '',
    status: 'Active',
    notes: '',
  });
  const [summary, setSummary] = useState(null);
  const [recentTrips, setRecentTrips] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await customersApi.get(id);
        if (cancelled) return;
        const c = res.customer;
        setForm({
          name: c.name || '',
          legalName: c.legalName || '',
          code: c.code || '',
          gstin: c.gstin || '',
          pan: c.pan || '',
          billingAddress: { ...emptyAddress(), ...(c.billingAddress || {}) },
          shippingAddress: { ...emptyAddress(), ...(c.shippingAddress || {}) },
          contacts: c.contacts || [],
          paymentTerms: c.paymentTerms || 'Net 30',
          creditLimit: c.creditLimit ?? '',
          gstRate: c.gstRate ?? '',
          status: c.status || 'Active',
          notes: c.notes || '',
        });
        setSummary(res.summary);
        setRecentTrips(res.recentTrips || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load the customer');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isEdit]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setAddress = (key, patch) =>
    setForm((f) => ({ ...f, [key]: { ...f[key], ...patch } }));

  const setContact = (i, patch) =>
    setForm((f) => ({
      ...f,
      contacts: f.contacts.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    }));

  // Exactly one primary contact, the same rule the server enforces on save.
  const makePrimary = (i) =>
    setForm((f) => ({
      ...f,
      contacts: f.contacts.map((c, j) => ({ ...c, isPrimary: j === i })),
    }));

  // Copies the billing address across, which is what it is most of the time.
  const copyBillingToShipping = () =>
    setForm((f) => ({ ...f, shippingAddress: { ...f.billingAddress } }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('A customer name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        creditLimit: form.creditLimit === '' ? null : Number(form.creditLimit),
        gstRate: form.gstRate === '' ? 0 : Number(form.gstRate),
      };
      if (isEdit) {
        await customersApi.update(id, payload);
      } else {
        await customersApi.create(payload);
      }
      navigate('/customers');
    } catch (err) {
      setError(err.message || 'Failed to save the customer');
      setSaving(false);
    }
  };

  const readOnly = isEdit ? !can('customers', 'update') : !can('customers', 'create');

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <Topbar />
        <div className="flex-1 flex items-center justify-center text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />

      <main className="flex-1 overflow-y-auto">
        <form onSubmit={submit} className="p-6 w-full max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/customers')}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                {isEdit ? 'Edit Customer' : 'Add Customer'}
              </h1>
              {summary && (
                <p className="text-slate-600 mt-1">
                  {summary.tripCount} trip{summary.tripCount === 1 ? '' : 's'}
                  {summary.activeCount > 0 && ` · ${summary.activeCount} currently running`}
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <Section icon={Building2} title="Identity">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Trading Name" required>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  required
                  disabled={readOnly}
                  className={inputClass}
                />
              </Field>
              <Field label="Legal Name" hint="If different — this goes on the tax invoice">
                <input
                  type="text"
                  value={form.legalName}
                  onChange={(e) => set({ legalName: e.target.value })}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Field>
              <Field label="Code" hint="Generated from the name if left blank">
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => set({ code: e.target.value.toUpperCase() })}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Field>
              <Field label="GSTIN">
                <input
                  type="text"
                  value={form.gstin}
                  onChange={(e) => set({ gstin: e.target.value.toUpperCase() })}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Field>
              <Field label="PAN">
                <input
                  type="text"
                  value={form.pan}
                  onChange={(e) => set({ pan: e.target.value.toUpperCase() })}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Field>
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) => set({ status: e.target.value })}
                  disabled={readOnly}
                  className={inputClass}
                >
                  {CUSTOMER_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
            {form.status === 'Blacklisted' && (
              <p className="text-sm text-red-600 mt-3">
                New trips cannot be booked against a blacklisted customer.
              </p>
            )}
          </Section>

          <Section icon={Building2} title="Commercial Terms">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Payment Terms">
                <select
                  value={form.paymentTerms}
                  onChange={(e) => set({ paymentTerms: e.target.value })}
                  disabled={readOnly}
                  className={inputClass}
                >
                  {PAYMENT_TERMS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field
                label="Credit Limit"
                hint="Advisory — the trip screen warns but does not block"
              >
                <input
                  type="number"
                  min="0"
                  value={form.creditLimit}
                  onChange={(e) => set({ creditLimit: e.target.value })}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Field>
              <Field label="Default GST Rate (%)">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.gstRate}
                  onChange={(e) => set({ gstRate: e.target.value })}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Field>
            </div>
          </Section>

          <Section icon={MapPin} title="Billing Address">
            <AddressFields
              value={form.billingAddress}
              onChange={(patch) => setAddress('billingAddress', patch)}
              disabled={readOnly}
            />
          </Section>

          <Section
            icon={MapPin}
            title="Shipping Address"
            action={
              !readOnly && (
                <button
                  type="button"
                  onClick={copyBillingToShipping}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Same as billing
                </button>
              )
            }
          >
            <AddressFields
              value={form.shippingAddress}
              onChange={(patch) => setAddress('shippingAddress', patch)}
              disabled={readOnly}
            />
          </Section>

          <Section
            icon={Users}
            title="Contacts"
            action={
              !readOnly && (
                <button
                  type="button"
                  onClick={() =>
                    set({
                      contacts: [
                        ...form.contacts,
                        { name: '', designation: '', mobile: '', email: '', isPrimary: form.contacts.length === 0 },
                      ],
                    })
                  }
                  className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Contact
                </button>
              )
            }
          >
            {form.contacts.length === 0 ? (
              <p className="text-slate-500 text-sm">
                No contacts yet. The billing contact and the person who receives the goods are often
                different people — add both.
              </p>
            ) : (
              <div className="space-y-3">
                {form.contacts.map((contact, i) => (
                  <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                    <Field label="Name">
                      <input
                        type="text"
                        value={contact.name}
                        onChange={(e) => setContact(i, { name: e.target.value })}
                        disabled={readOnly}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Designation">
                      <input
                        type="text"
                        value={contact.designation}
                        onChange={(e) => setContact(i, { designation: e.target.value })}
                        disabled={readOnly}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Mobile">
                      <input
                        type="text"
                        value={contact.mobile}
                        onChange={(e) => setContact(i, { mobile: e.target.value })}
                        disabled={readOnly}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Email">
                      <input
                        type="email"
                        value={contact.email}
                        onChange={(e) => setContact(i, { email: e.target.value })}
                        disabled={readOnly}
                        className={inputClass}
                      />
                    </Field>
                    <div className="flex gap-2 pb-0.5">
                      <button
                        type="button"
                        onClick={() => makePrimary(i)}
                        disabled={readOnly}
                        className={`p-2 rounded-lg transition-colors ${
                          contact.isPrimary
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-slate-400 hover:bg-slate-100'
                        }`}
                        title={contact.isPrimary ? 'Primary contact' : 'Make primary'}
                      >
                        <Star className={`w-4 h-4 ${contact.isPrimary ? 'fill-current' : ''}`} />
                      </button>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() =>
                            set({ contacts: form.contacts.filter((_, j) => j !== i) })
                          }
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section icon={Building2} title="Notes">
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              disabled={readOnly}
              className={inputClass}
            />
          </Section>

          {recentTrips.length > 0 && (
            <Section icon={Building2} title="Recent Trips">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-sm font-semibold text-slate-900">Trip</th>
                      <th className="px-3 py-2 text-left text-sm font-semibold text-slate-900">Date</th>
                      <th className="px-3 py-2 text-left text-sm font-semibold text-slate-900">Route</th>
                      <th className="px-3 py-2 text-left text-sm font-semibold text-slate-900">Status</th>
                      <th className="px-3 py-2 text-right text-sm font-semibold text-slate-900">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentTrips.map((trip) => (
                      <tr
                        key={trip._id}
                        onClick={() => navigate(`/trips/${trip._id}`)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="px-3 py-2 text-sm text-blue-600 font-medium">{trip.tripNumber}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{formatDate(trip.tripDate)}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">
                          {trip.pickup?.city || '—'} → {trip.destination?.city || '—'}
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-700">
                          {TRIP_STATUS_LABELS[trip.status] || trip.status}
                        </td>
                        <td className="px-3 py-2 text-sm text-right text-slate-900">
                          {formatCurrency(trip.totals?.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          <div className="flex items-center justify-end gap-3 pb-8">
            <button
              type="button"
              onClick={() => navigate('/customers')}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || readOnly}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Customer'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

const inputClass =
  'w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500';

function emptyAddress() {
  return { line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' };
}

function Section({ icon: Icon, title, action, children }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        </div>
        {action}
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

function AddressFields({ value, onChange, disabled }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Address Line 1">
          <input
            type="text"
            value={value.line1}
            onChange={(e) => onChange({ line1: e.target.value })}
            disabled={disabled}
            className={inputClass}
          />
        </Field>
        <Field label="Address Line 2">
          <input
            type="text"
            value={value.line2}
            onChange={(e) => onChange({ line2: e.target.value })}
            disabled={disabled}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Field label="City">
          <input
            type="text"
            value={value.city}
            onChange={(e) => onChange({ city: e.target.value })}
            disabled={disabled}
            className={inputClass}
          />
        </Field>
        <Field label="State" hint="Decides IGST vs CGST/SGST">
          <input
            type="text"
            value={value.state}
            onChange={(e) => onChange({ state: e.target.value })}
            disabled={disabled}
            className={inputClass}
          />
        </Field>
        <Field label="PIN Code">
          <input
            type="text"
            value={value.pincode}
            onChange={(e) => onChange({ pincode: e.target.value })}
            disabled={disabled}
            className={inputClass}
          />
        </Field>
        <Field label="Country">
          <input
            type="text"
            value={value.country}
            onChange={(e) => onChange({ country: e.target.value })}
            disabled={disabled}
            className={inputClass}
          />
        </Field>
      </div>
    </div>
  );
}
