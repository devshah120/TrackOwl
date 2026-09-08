import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Trash2, X, Disc3, ArrowDownToLine, ArrowUpFromLine, RefreshCw,
} from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { usePermissions } from '../hooks/usePermissions';
import { components as api, fleet } from '../services/api';
import { Panel, Banner, TyreStatusPill, EmptyState } from '../components/maintenance/MaintenanceUI';
import {
  TYRE_POSITIONS, ON_VEHICLE_TYRE_STATUSES,
  formatMoney, formatCostPerKm, formatTread, formatNumber, formatDate, formatOdometer,
} from '../constants/maintenance';

// M3-M06 / M3-M08 — one tyre, its life, and what it has cost per kilometre.
//
// The three lifecycle actions — fit, remove, retread — are buttons rather than
// fields, because each opens or closes the stint the tyre's distance is
// measured over. Editing `position` as a plain field would move a tyre between
// axles with no record of the reading it moved at, and the cost-per-km figure
// would then describe a journey it never made.
//
// New tyres are created here too: the same form, with no history to show yet.
export function TyreDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = id === 'new';
  const { can } = usePermissions();

  const [tyre, setTyre] = useState(null);
  const [form, setForm] = useState({
    tyreNumber: '', brand: '', model: '', size: '', serialNumber: '',
    purchaseDate: '', purchaseFrom: '', invoiceNumber: '', price: '',
    warrantyMonths: '', ratedKm: '', treadDepthMm: '', notes: '',
  });

  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [action, setAction] = useState(null); // 'fit' | 'remove' | 'retread'

  const load = useCallback(async () => {
    if (isNew) return;
    try {
      const res = await api.tyres.get(id);
      const t = res.tyre;
      setTyre(t);
      setForm({
        tyreNumber: t.tyreNumber || '',
        brand: t.brand || '',
        model: t.model || '',
        size: t.size || '',
        serialNumber: t.serialNumber || '',
        purchaseDate: t.purchaseDate ? t.purchaseDate.slice(0, 10) : '',
        purchaseFrom: t.purchaseFrom || '',
        invoiceNumber: t.invoiceNumber || '',
        price: t.price ?? '',
        warrantyMonths: t.warrantyMonths ?? '',
        ratedKm: t.ratedKm ?? '',
        treadDepthMm: t.treadDepthMm ?? '',
        notes: t.notes || '',
      });
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load that tyre');
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fleet.list();
        setTrucks(res.trucks || []);
      } catch {
        // The picker is a convenience.
      }
    })();
  }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      tyreNumber: form.tyreNumber,
      brand: form.brand,
      model: form.model,
      size: form.size,
      serialNumber: form.serialNumber,
      purchaseDate: form.purchaseDate || null,
      purchaseFrom: form.purchaseFrom,
      invoiceNumber: form.invoiceNumber,
      price: form.price === '' ? 0 : Number(form.price),
      warrantyMonths: form.warrantyMonths === '' ? null : Number(form.warrantyMonths),
      ratedKm: form.ratedKm === '' ? null : Number(form.ratedKm),
      treadDepthMm: form.treadDepthMm === '' ? null : Number(form.treadDepthMm),
      notes: form.notes,
    };

    try {
      if (isNew) {
        const res = await api.tyres.create(payload);
        navigate(`/maintenance/tyres/${res.tyre._id}`, { replace: true });
      } else {
        await api.tyres.update(id, payload);
        setNotice('Tyre saved.');
        await load();
      }
    } catch (err) {
      setError(err.message || 'Could not save the tyre');
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (kind, payload) => {
    try {
      if (kind === 'fit') await api.tyres.fit(id, payload);
      else if (kind === 'remove') await api.tyres.remove(id, payload);
      else await api.tyres.retread(id, payload);
      setAction(null);
      setNotice(
        kind === 'fit'
          ? 'Tyre fitted. Its distance is now measured from the vehicle’s odometer.'
          : kind === 'remove'
            ? 'Tyre removed. The stint is closed and its distance banked.'
            : 'Retread recorded. The cost is folded into this tyre’s cost per kilometre.'
      );
      await load();
    } catch (err) {
      setError(err.message || 'That action could not be completed');
      setAction(null);
    }
  };

  const destroy = async () => {
    if (!window.confirm(`Delete tyre ${tyre.tyreNumber}? This cannot be undone.`)) return;
    try {
      await api.tyres.destroy(id);
      navigate('/maintenance/tyres');
    } catch (err) {
      setError(err.message || 'Could not delete that tyre');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <Topbar />
        <main className="flex-1 flex items-center justify-center text-slate-500">Loading the tyre…</main>
      </div>
    );
  }

  const onVehicle = tyre && ON_VEHICLE_TYRE_STATUSES.includes(tyre.status) && tyre.truck;
  const terminal = tyre && ['Scrapped', 'Sold'].includes(tyre.status);

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full max-w-5xl mx-auto space-y-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-start gap-3">
              <button
                onClick={() => navigate('/maintenance/tyres')}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-3xl font-bold text-slate-900">
                    {isNew ? 'Add a Tyre' : tyre?.tyreNumber}
                  </h1>
                  {tyre ? <TyreStatusPill status={tyre.status} /> : null}
                </div>
                <p className="text-slate-600 mt-1">
                  {isNew
                    ? 'Into stock first — fit it to a vehicle to start measuring its distance'
                    : `${tyre?.brand || ''} ${tyre?.size || ''}${
                        tyre?.vehicleNumber ? ` · on ${tyre.vehicleNumber} at ${tyre.position}` : ''
                      }`}
                </p>
              </div>
            </div>

            {!isNew && can('maintenance', 'update') && (
              <div className="flex items-center gap-2 flex-wrap">
                {!onVehicle && !terminal && (
                  <button
                    onClick={() => setAction('fit')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <ArrowDownToLine className="w-4 h-4" /> Fit to vehicle
                  </button>
                )}
                {onVehicle && (
                  <button
                    onClick={() => setAction('remove')}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
                  >
                    <ArrowUpFromLine className="w-4 h-4" /> Remove
                  </button>
                )}
                {!onVehicle && !terminal && (
                  <button
                    onClick={() => setAction('retread')}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
                  >
                    <RefreshCw className="w-4 h-4" /> Retread
                  </button>
                )}
                {can('maintenance', 'delete') && !onVehicle && (
                  <button
                    onClick={destroy}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          <Banner tone="error" message={error} onDismiss={() => setError('')} />
          <Banner tone="success" message={notice} onDismiss={() => setNotice('')} />

          {/* M3-M08 — the figure the whole master exists to produce. */}
          {tyre && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Stat label="Distance run" value={formatNumber(tyre.runningKm, { decimals: 0, suffix: 'km' })} />
              <Stat
                label="Cost per km"
                value={formatCostPerKm(tyre.costPerKm)}
                hint={tyre.costPerKm === null ? 'not run anywhere yet' : ''}
              />
              <Stat
                label="Total cost"
                value={formatMoney((tyre.price || 0) + (tyre.retreadCost || 0))}
                hint={tyre.retreadCost ? `${formatMoney(tyre.retreadCost)} of it retreads` : ''}
              />
              <Stat
                label="Tread"
                value={formatTread(tyre.treadDepthMm)}
                hint={tyre.treadCheckedAt ? `checked ${formatDate(tyre.treadCheckedAt)}` : 'not measured'}
              />
            </div>
          )}

          <form onSubmit={save} className="space-y-6">
            <Panel title="Tyre details">
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Tyre number" required>
                  <input
                    type="text" required
                    value={form.tyreNumber}
                    onChange={(e) => set({ tyreNumber: e.target.value.toUpperCase() })}
                    placeholder="e.g. T-014"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">the fleet’s own tag, stencilled on the sidewall</p>
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
                <Field label="Size">
                  <input
                    type="text" value={form.size}
                    onChange={(e) => set({ size: e.target.value })}
                    placeholder="e.g. 295/80 R22.5"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
                <Field label="Serial / DOT">
                  <input
                    type="text" value={form.serialNumber}
                    onChange={(e) => set({ serialNumber: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
                <Field label="Current tread (mm)">
                  <input
                    type="number" min="0" max="30" step="0.1"
                    value={form.treadDepthMm}
                    onChange={(e) => set({ treadDepthMm: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">dated today when you save it</p>
                </Field>
              </div>
            </Panel>

            <Panel title="Purchase">
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
                <Field label="Price">
                  <input
                    type="number" min="0" step="0.01"
                    value={form.price}
                    onChange={(e) => set({ price: e.target.value })}
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
                </Field>
                <Field label="Rated life (km)">
                  <input
                    type="number" min="0" step="1000"
                    value={form.ratedKm}
                    onChange={(e) => set({ ratedKm: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">what the supplier quotes — for comparison only</p>
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
                onClick={() => navigate('/maintenance/tyres')}
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
                {saving ? 'Saving…' : isNew ? 'Add tyre' : 'Save changes'}
              </button>
            </div>
          </form>

          {/* The life history. Each stint is where it ran and how far. */}
          {tyre && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
              <Panel title="Fitment history" subtitle="Every vehicle and position this tyre has run at">
                {tyre.fitments?.length ? (
                  <div className="divide-y divide-slate-100">
                    {[...tyre.fitments].reverse().map((f) => (
                      <div key={f._id} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-slate-900">
                            {f.vehicleNumber} · {f.position}
                          </p>
                          <p className="text-sm text-slate-700">
                            {f.removedAt
                              ? formatNumber(f.distanceKm, { decimals: 0, suffix: 'km' })
                              : 'running'}
                          </p>
                        </div>
                        <p className="text-xs text-slate-500">
                          {formatDate(f.fittedAt)} at {formatOdometer(f.fittedOdometer)}
                          {f.removedAt
                            ? ` → ${formatDate(f.removedAt)} at ${formatOdometer(f.removedOdometer)}`
                            : ' → still fitted'}
                        </p>
                        {f.reason ? <p className="text-xs text-slate-500 mt-1">{f.reason}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={Disc3} title="Never fitted" hint="This tyre is still in stock." />
                )}
              </Panel>

              <Panel title="Retreads" subtitle="Each one costs money and buys more life">
                {tyre.retreads?.length ? (
                  <div className="divide-y divide-slate-100">
                    {[...tyre.retreads].reverse().map((r) => (
                      <div key={r._id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-slate-900">{r.vendor || 'Retread'}</p>
                          <p className="text-xs text-slate-500">
                            {formatDate(r.date)}
                            {r.atKm !== null && r.atKm !== undefined
                              ? ` · at ${formatNumber(r.atKm, { decimals: 0, suffix: 'km' })}`
                              : ''}
                          </p>
                        </div>
                        <p className="text-sm font-medium text-slate-900">{formatMoney(r.cost)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={RefreshCw} title="No retreads" hint="This is still the original casing." />
                )}
              </Panel>
            </div>
          )}
        </div>
      </main>

      {action === 'fit' && (
        <FitModal
          trucks={trucks}
          onClose={() => setAction(null)}
          onSubmit={(payload) => runAction('fit', payload)}
        />
      )}
      {action === 'remove' && (
        <RemoveModal
          tyre={tyre}
          onClose={() => setAction(null)}
          onSubmit={(payload) => runAction('remove', payload)}
        />
      )}
      {action === 'retread' && (
        <RetreadModal
          onClose={() => setAction(null)}
          onSubmit={(payload) => runAction('retread', payload)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      {hint ? <p className="text-xs text-slate-500 mt-1">{hint}</p> : null}
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

function Modal({ title, subtitle, onClose, onSubmit, submitLabel, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
        className="bg-white rounded-lg p-6 w-full max-w-md space-y-4"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            {subtitle ? <p className="text-sm text-slate-600 mt-1">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        {children}
        <div className="flex justify-end gap-2">
          <button
            type="button" onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

function FitModal({ trucks, onClose, onSubmit }) {
  const [truck, setTruck] = useState('');
  const [position, setPosition] = useState('');
  const [odometer, setOdometer] = useState('');

  const vehicle = trucks.find((t) => t._id === truck);

  return (
    <Modal
      title="Fit to a vehicle"
      subtitle="The odometer reading anchors the distance this tyre’s cost per kilometre is measured from."
      onClose={onClose}
      submitLabel="Fit tyre"
      onSubmit={() => onSubmit({ truck, position, odometer: Number(odometer) })}
    >
      <Field label="Vehicle" required>
        <select
          required value={truck}
          onChange={(e) => {
            setTruck(e.target.value);
            // The vehicle's current reading is the sensible default — the tyre
            // is going on now, at the reading it is on now.
            const t = trucks.find((x) => x._id === e.target.value);
            if (t?.odometer) setOdometer(String(t.odometer));
          }}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a vehicle</option>
          {trucks.map((t) => (
            <option key={t._id} value={t._id}>{t.number}</option>
          ))}
        </select>
      </Field>

      <Field label="Position" required>
        <input
          required list="tyre-positions" value={position}
          onChange={(e) => setPosition(e.target.value)}
          placeholder="e.g. Front Left"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {/* A free-text list, not a fixed dropdown: axle counts vary across a
            mixed fleet, so a position outside the common set is accepted. */}
        <datalist id="tyre-positions">
          {TYRE_POSITIONS.map((p) => <option key={p} value={p} />)}
        </datalist>
      </Field>

      <Field label="Odometer at fitment (km)" required>
        <input
          type="number" required min="0" step="1"
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {vehicle?.odometer ? (
          <p className="text-xs text-slate-500 mt-1">
            {vehicle.number} currently reads {formatOdometer(vehicle.odometer)}
          </p>
        ) : null}
      </Field>
    </Modal>
  );
}

function RemoveModal({ tyre, onClose, onSubmit }) {
  const [odometer, setOdometer] = useState('');
  const [tread, setTread] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState('Removed');

  return (
    <Modal
      title="Remove from vehicle"
      subtitle={`Closes the stint on ${tyre?.vehicleNumber || 'the vehicle'} and banks the distance it ran.`}
      onClose={onClose}
      submitLabel="Remove tyre"
      onSubmit={() =>
        onSubmit({
          odometer: Number(odometer),
          treadAtRemovalMm: tread === '' ? null : Number(tread),
          reason,
          status,
        })
      }
    >
      <Field label="Odometer at removal (km)" required>
        <input
          type="number" required min="0" step="1"
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Field>

      <Field label="Tread at removal (mm)">
        <input
          type="number" min="0" max="30" step="0.1"
          value={tread}
          onChange={(e) => setTread(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Field>

      <Field label="Where does it go?">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="Removed">Back to the store</option>
          <option value="Scrapped">Scrapped</option>
          <option value="Sold">Sold on</option>
        </select>
      </Field>

      <Field label="Reason">
        <input
          type="text" value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Worn to the markers on the inner shoulder"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Field>
    </Modal>
  );
}

function RetreadModal({ onClose, onSubmit }) {
  const [vendor, setVendor] = useState('');
  const [cost, setCost] = useState('');

  return (
    <Modal
      title="Record a retread"
      subtitle="The casing keeps its accumulated distance, and this cost is folded into its cost per kilometre."
      onClose={onClose}
      submitLabel="Record retread"
      onSubmit={() => onSubmit({ vendor, cost: cost === '' ? 0 : Number(cost) })}
    >
      <Field label="Vendor">
        <input
          type="text" value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Field>
      <Field label="Cost">
        <input
          type="number" min="0" step="0.01"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Field>
    </Modal>
  );
}
