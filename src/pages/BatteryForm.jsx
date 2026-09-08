import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, BatteryCharging } from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { usePermissions } from '../hooks/usePermissions';
import { components as api } from '../services/api';
import { Panel, Banner, BatteryStatusPill, EmptyState, HealthPill } from '../components/maintenance/MaintenanceUI';
import {
  BATTERY_VOLTAGES, formatDate, formatDateTime, formatMoney, formatNumber,
} from '../constants/maintenance';

// M3-M09 — add or correct a battery.
//
// Installing, removing and checking are done from the register, where the
// vehicle is in view — those actions stamp readings and retire the battery they
// replace, so they are not plain field edits. This form owns only what the
// battery *is*: its identity, its specification and what it cost.
export function BatteryForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = id === 'new';
  const { can } = usePermissions();

  const [battery, setBattery] = useState(null);
  const [form, setForm] = useState({
    serialNumber: '', brand: '', model: '', voltage: 12, capacityAh: '',
    purchaseDate: '', purchaseFrom: '', invoiceNumber: '', cost: '',
    warrantyMonths: '', expectedReplacementDate: '', notes: '',
  });

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const res = await api.batteries.get(id);
        const b = res.battery;
        setBattery(b);
        setForm({
          serialNumber: b.serialNumber || '',
          brand: b.brand || '',
          model: b.model || '',
          voltage: b.voltage ?? 12,
          capacityAh: b.capacityAh ?? '',
          purchaseDate: b.purchaseDate ? b.purchaseDate.slice(0, 10) : '',
          purchaseFrom: b.purchaseFrom || '',
          invoiceNumber: b.invoiceNumber || '',
          cost: b.cost ?? '',
          warrantyMonths: b.warrantyMonths ?? '',
          expectedReplacementDate: b.expectedReplacementDate
            ? b.expectedReplacementDate.slice(0, 10)
            : '',
          notes: b.notes || '',
        });
      } catch (err) {
        setError(err.message || 'Failed to load that battery');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isNew]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      serialNumber: form.serialNumber,
      brand: form.brand,
      model: form.model,
      voltage: form.voltage === '' ? 12 : Number(form.voltage),
      capacityAh: form.capacityAh === '' ? null : Number(form.capacityAh),
      purchaseDate: form.purchaseDate || null,
      purchaseFrom: form.purchaseFrom,
      invoiceNumber: form.invoiceNumber,
      cost: form.cost === '' ? 0 : Number(form.cost),
      warrantyMonths: form.warrantyMonths === '' ? null : Number(form.warrantyMonths),
      expectedReplacementDate: form.expectedReplacementDate || null,
      notes: form.notes,
    };

    try {
      if (isNew) {
        const res = await api.batteries.create(payload);
        navigate(`/maintenance/batteries/${res.battery._id}`, { replace: true });
      } else {
        const res = await api.batteries.update(id, payload);
        setBattery(res.battery);
        setNotice('Battery saved.');
      }
    } catch (err) {
      setError(err.message || 'Could not save the battery');
    } finally {
      setSaving(false);
    }
  };

  const destroy = async () => {
    if (!window.confirm(`Delete battery ${battery.serialNumber}? This cannot be undone.`)) return;
    try {
      await api.batteries.destroy(id);
      navigate('/maintenance/batteries');
    } catch (err) {
      setError(err.message || 'Could not delete that battery');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <Topbar />
        <main className="flex-1 flex items-center justify-center text-slate-500">
          Loading the battery…
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full max-w-4xl mx-auto space-y-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-start gap-3">
              <button
                onClick={() => navigate('/maintenance/batteries')}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-3xl font-bold text-slate-900">
                    {isNew ? 'Add a Battery' : battery?.serialNumber}
                  </h1>
                  {battery ? <BatteryStatusPill status={battery.status} /> : null}
                  {battery?.health ? <HealthPill health={battery.health} /> : null}
                </div>
                <p className="text-slate-600 mt-1">
                  {isNew
                    ? 'Into stock first — install it on a vehicle from the register'
                    : `${battery?.brand || ''}${
                        battery?.vehicleNumber
                          ? ` · on ${battery.vehicleNumber} at ${battery.position || 'a position'}`
                          : ''
                      }`}
                </p>
              </div>
            </div>

            {!isNew && can('maintenance', 'delete') && battery?.status !== 'Fitted' && (
              <button
                onClick={destroy}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )}
          </div>

          <Banner tone="error" message={error} onDismiss={() => setError('')} />
          <Banner tone="success" message={notice} onDismiss={() => setNotice('')} />

          {/* The warranty position, which is the fact that changes decisions:
              a failure inside warranty is a claim, not a purchase. */}
          {battery?.warrantyExpiry ? (
            <Banner
              tone={battery.warrantyDaysLeft >= 0 ? 'success' : 'warning'}
              message={
                battery.warrantyDaysLeft >= 0
                  ? `Under warranty until ${formatDate(battery.warrantyExpiry)} — ${battery.warrantyDaysLeft} days left. A failure now is a claim.`
                  : `Warranty expired on ${formatDate(battery.warrantyExpiry)}.`
              }
            />
          ) : null}

          <form onSubmit={save} className="space-y-6">
            <Panel title="Identity and specification">
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Serial number" required>
                  <input
                    type="text" required
                    value={form.serialNumber}
                    onChange={(e) => set({ serialNumber: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    what a warranty claim is made against
                  </p>
                </Field>
                <Field label="Brand">
                  <input
                    type="text" value={form.brand}
                    onChange={(e) => set({ brand: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
                <Field label="Model">
                  <input
                    type="text" value={form.model}
                    onChange={(e) => set({ model: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
                <Field label="Voltage">
                  <select
                    value={form.voltage}
                    onChange={(e) => set({ voltage: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {BATTERY_VOLTAGES.map((v) => (
                      <option key={v} value={v}>{v}V</option>
                    ))}
                  </select>
                </Field>
                <Field label="Capacity (Ah)">
                  <input
                    type="number" min="0" step="1"
                    value={form.capacityAh}
                    onChange={(e) => set({ capacityAh: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
                <Field label="Expected replacement">
                  <input
                    type="date"
                    value={form.expectedReplacementDate}
                    onChange={(e) => set({ expectedReplacementDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    left blank, the account’s expected battery life is used
                  </p>
                </Field>
              </div>
            </Panel>

            <Panel title="Purchase and warranty">
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Purchase date">
                  <input
                    type="date" value={form.purchaseDate}
                    onChange={(e) => set({ purchaseDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
                <Field label="Bought from">
                  <input
                    type="text" value={form.purchaseFrom}
                    onChange={(e) => set({ purchaseFrom: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
                <Field label="Cost">
                  <input
                    type="number" min="0" step="0.01"
                    value={form.cost}
                    onChange={(e) => set({ cost: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
                <Field label="Invoice number">
                  <input
                    type="text" value={form.invoiceNumber}
                    onChange={(e) => set({ invoiceNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
                <Field label="Warranty (months)">
                  <input
                    type="number" min="0" step="1"
                    value={form.warrantyMonths}
                    onChange={(e) => set({ warrantyMonths: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    the expiry date follows from this and the purchase date
                  </p>
                </Field>
              </div>
            </Panel>

            <Panel title="Notes">
              <div className="p-4">
                <textarea
                  rows={2} value={form.notes}
                  onChange={(e) => set({ notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </Panel>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => navigate('/maintenance/batteries')}
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
                {saving ? 'Saving…' : isNew ? 'Add battery' : 'Save changes'}
              </button>
            </div>
          </form>

          {/* M3-M09 — the check history. A single reading says little; three
              readings falling over six weeks says the battery is finished. */}
          {battery && !isNew && (
            <Panel
              title="Check history"
              subtitle="Voltage and health over time — the decline is the signal"
              className="mb-6"
            >
              {battery.checks?.length ? (
                <div className="divide-y divide-slate-100">
                  {[...battery.checks].reverse().map((check) => (
                    <div key={check._id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-slate-900">
                          {check.voltage !== null && check.voltage !== undefined
                            ? `${formatNumber(check.voltage, { decimals: 1 })}V`
                            : 'No reading'}
                          {check.specificGravity
                            ? ` · SG ${formatNumber(check.specificGravity, { decimals: 3 })}`
                            : ''}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {formatDateTime(check.date)}
                          {check.checkedBy ? ` · ${check.checkedBy}` : ''}
                          {check.notes ? ` · ${check.notes}` : ''}
                        </p>
                      </div>
                      <HealthPill health={check.health} />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={BatteryCharging}
                  title="Never checked"
                  hint="Record a check from the register to start tracking this battery’s condition."
                />
              )}
            </Panel>
          )}

          {battery?.cost ? (
            <p className="text-xs text-slate-500 pb-6">
              Bought for {formatMoney(battery.cost)}
              {battery.installedAt ? ` · installed ${formatDate(battery.installedAt)}` : ''}
            </p>
          ) : null}
        </div>
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
