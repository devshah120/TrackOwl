import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Fuel, Upload, X } from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { usePermissions } from '../hooks/usePermissions';
import {
  fuel as fuelApi, fleet, drivers as driversApi, tripOrders,
} from '../services/api';
import {
  FUEL_TYPES, FUEL_TYPE_LABELS, FILL_TYPES, FILL_TYPE_LABELS, PAYMENT_MODES,
  unitFor, formatOdometer, formatMoney, formatDateTime, toDateTimeLocal, PROPULSION_FUEL_TYPES,
} from '../constants/fuel';

// Record or correct a filling (M3-F01).
//
// Two things this form does that a plain CRUD form would not:
//
//   1. It shows the vehicle's previous odometer reading as soon as a vehicle is
//      picked, so a transposed digit is caught at the keyboard rather than
//      flagged as an efficiency outlier a week later.
//
//   2. It reconciles quantity, rate and amount as they are typed. The pump
//      prints all three and any two give the third, so whichever pair the
//      operator has is enough — the server does the same arithmetic and is the
//      authority; this is only so the number appears before saving.

// A receipt photo is downscaled in the browser before it is sent, the same way
// the vehicle and driver document uploads do it. A phone camera JPEG is several
// megabytes and none of that detail survives being read as a fuel bill.
const MAX_RECEIPT_BYTES = 3 * 1024 * 1024;

export function FuelForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { can } = usePermissions();

  const [form, setForm] = useState({
    truck: '', driver: '', filledAt: toDateTimeLocal(), fuelType: 'Diesel',
    quantity: '', rate: '', amount: '', fillType: 'full', odometer: '',
    paymentMode: 'Cash', billNumber: '', trip: '', remarks: '',
    station: { name: '', code: '', city: '', state: '' },
    receipt: { dataUrl: '', filename: '', mimeType: '' },
  });

  const [trucks, setTrucks] = useState([]);
  const [driverList, setDriverList] = useState([]);
  const [trips, setTrips] = useState([]);
  const [stations, setStations] = useState([]);
  const [lastEntry, setLastEntry] = useState(null);
  const [vehicleOdometer, setVehicleOdometer] = useState(null);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const unit = unitFor(form.fuelType);

  // --- reference data ------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const [truckRes, driverRes, tripRes, stationRes] = await Promise.all([
          fleet.list(),
          driversApi.list(),
          // Only trips still running can sensibly take a new fuel bill; a
          // completed trip is a record of what happened.
          tripOrders.list({ limit: 100, sortBy: 'tripDate', sortDir: 'desc' }),
          fuelApi.stations(),
        ]);
        setTrucks(truckRes.trucks || []);
        setDriverList(driverRes.drivers || []);
        setTrips(tripRes.trips || []);
        setStations(stationRes.stations || []);
      } catch {
        // The pickers are a convenience; the form still saves without them.
      }
    })();
  }, []);

  // --- existing entry ------------------------------------------------------
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await fuelApi.get(id);
        const e = res.entry;
        setForm({
          truck: e.truck?._id || e.truck || '',
          driver: e.driver?._id || e.driver || '',
          filledAt: toDateTimeLocal(e.filledAt),
          fuelType: e.fuelType || 'Diesel',
          quantity: e.quantity ?? '',
          rate: e.rate ?? '',
          amount: e.amount ?? '',
          fillType: e.fillType || 'full',
          odometer: e.odometer ?? '',
          paymentMode: e.paymentMode || 'Cash',
          billNumber: e.billNumber || '',
          trip: e.trip?._id || e.trip || '',
          remarks: e.remarks || '',
          station: {
            name: e.station?.name || '', code: e.station?.code || '',
            city: e.station?.city || '', state: e.station?.state || '',
          },
          receipt: e.receipt || { dataUrl: '', filename: '', mimeType: '' },
        });
      } catch (err) {
        setError(err.message || 'Failed to load that fuel entry');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit]);

  // --- the vehicle's previous filling --------------------------------------
  // Fetched whenever the vehicle changes so the odometer field has something to
  // be checked against while it is being typed.
  // The whole body runs inside an async IIFE, including the "no vehicle
  // selected" reset, so no setState lands synchronously in the effect body and
  // cascades a render.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!form.truck) {
        if (!cancelled) {
          setLastEntry(null);
          setVehicleOdometer(null);
        }
        return;
      }
      try {
        const res = await fuelApi.lastEntry(form.truck);
        // Switching vehicles quickly must not let a slow response for the
        // previous one overwrite the reading shown for the current one.
        if (cancelled) return;
        setLastEntry(res.lastEntry || null);
        setVehicleOdometer(res.vehicleOdometer ?? null);
      } catch {
        if (!cancelled) setLastEntry(null);
      }
    })();
    return () => { cancelled = true; };
  }, [form.truck]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setStation = (patch) => setForm((f) => ({ ...f, station: { ...f.station, ...patch } }));

  // --- quantity / rate / amount --------------------------------------------
  //
  // Whichever two the operator fills, the third follows. The server reconciles
  // the same way and is the authority — this only saves a round trip to see
  // the number.
  const onQuantity = (value) => {
    const patch = { quantity: value };
    const q = Number(value);
    const r = Number(form.rate);
    if (Number.isFinite(q) && q > 0 && Number.isFinite(r) && r > 0) {
      patch.amount = String(Math.round(q * r * 100) / 100);
    }
    set(patch);
  };

  const onRate = (value) => {
    const patch = { rate: value };
    const q = Number(form.quantity);
    const r = Number(value);
    if (Number.isFinite(q) && q > 0 && Number.isFinite(r) && r > 0) {
      patch.amount = String(Math.round(q * r * 100) / 100);
    }
    set(patch);
  };

  // Amount is what was actually paid, so typing it derives the rate rather than
  // the other way round — the bill is the fact, the rate is inferred from it.
  const onAmount = (value) => {
    const patch = { amount: value };
    const q = Number(form.quantity);
    const a = Number(value);
    if (Number.isFinite(q) && q > 0 && Number.isFinite(a) && a > 0) {
      patch.rate = String(Math.round((a / q) * 1000) / 1000);
    }
    set(patch);
  };

  // --- odometer sanity, shown while typing ---------------------------------
  const odometerHint = useMemo(() => {
    const entered = Number(form.odometer);
    if (!Number.isFinite(entered) || !form.odometer) return null;

    const previous = lastEntry?.odometer;
    if (Number.isFinite(previous)) {
      if (entered < previous) {
        return {
          tone: 'error',
          text: `Lower than the previous filling (${formatOdometer(previous)}). Check the reading.`,
        };
      }
      return {
        tone: 'ok',
        text: `${(entered - previous).toLocaleString('en-IN')} km since the last filling on ${formatDateTime(lastEntry.filledAt)}.`,
      };
    }

    if (Number.isFinite(vehicleOdometer) && entered < vehicleOdometer) {
      return {
        tone: 'warn',
        text: `The vehicle master reads ${formatOdometer(vehicleOdometer)}, which is higher.`,
      };
    }
    return null;
  }, [form.odometer, lastEntry, vehicleOdometer]);

  // The mileage this filling would report, shown before saving so the operator
  // can see whether the numbers look right. Deliberately labelled as an
  // estimate: the server measures against the full odometer chain, applies the
  // full-to-full rule and may legitimately land somewhere else.
  const previewMileage = useMemo(() => {
    if (form.fillType !== 'full') return null;
    if (!PROPULSION_FUEL_TYPES.includes(form.fuelType)) return null;
    const entered = Number(form.odometer);
    const previous = lastEntry?.odometer;
    const quantity = Number(form.quantity);
    if (!Number.isFinite(entered) || !Number.isFinite(previous)) return null;
    if (!Number.isFinite(quantity) || quantity <= 0) return null;
    const distance = entered - previous;
    if (distance <= 0) return null;
    return {
      distance,
      kmPerUnit: Math.round((distance / quantity) * 100) / 100,
    };
  }, [form, lastEntry]);

  const onFile = (file) => {
    if (!file) return;
    if (file.size > MAX_RECEIPT_BYTES) {
      setError('That receipt is too large — please keep it under 3 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      set({ receipt: { dataUrl: reader.result, filename: file.name, mimeType: file.type } });
    reader.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    // Sent as-is: the server validates, reconciles and computes. Empty strings
    // for the optional references mean "none", which the API reads as a clear.
    const payload = {
      ...form,
      quantity: form.quantity === '' ? null : Number(form.quantity),
      rate: form.rate === '' ? null : Number(form.rate),
      amount: form.amount === '' ? null : Number(form.amount),
      odometer: form.odometer === '' ? null : Number(form.odometer),
      driver: form.driver || null,
      trip: form.trip || null,
    };

    try {
      const res = isEdit ? await fuelApi.update(id, payload) : await fuelApi.create(payload);
      // A trip that could not be updated is reported rather than swallowed —
      // the person who typed the bill is the one who can fix it.
      if (res.warning) window.alert(res.warning);
      navigate('/fuel');
    } catch (err) {
      setError(err.message || 'Failed to save the fuel entry');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <Topbar />
        <div className="flex-1 flex items-center justify-center text-slate-500">Loading…</div>
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
              onClick={() => navigate('/fuel')}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                {isEdit ? 'Edit Fuel Entry' : 'Record Filling'}
              </h1>
              <p className="text-slate-600 mt-1">
                Vehicle, fuel, quantity and odometer — mileage is worked out from these
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* --- Vehicle & driver --- */}
          <Section title="Vehicle" icon={Fuel}>
            <Field label="Vehicle" required>
              <select
                required value={form.truck}
                onChange={(e) => set({ truck: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a vehicle</option>
                {trucks.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.number} {t.model ? `· ${t.model}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Driver" hint="Optional — a bill with no driver against it is still valid">
              <select
                value={form.driver}
                onChange={(e) => set({ driver: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No driver recorded</option>
                {driverList.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Filled at" required>
              <input
                type="datetime-local" required value={form.filledAt}
                onChange={(e) => set({ filledAt: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>

            <Field
              label="Trip"
              hint="Optional. When set, the cost is added to that trip's expenses automatically."
            >
              <select
                value={form.trip}
                onChange={(e) => set({ trip: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Not linked to a trip</option>
                {trips.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.tripNumber} · {t.pickup?.city || '—'} → {t.destination?.city || '—'}
                  </option>
                ))}
              </select>
            </Field>
          </Section>

          {/* --- Fuel & money --- */}
          <Section title="Fuel and cost">
            <Field label="Fuel type" required>
              <select
                required value={form.fuelType}
                onChange={(e) => set({ fuelType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {FUEL_TYPES.map((t) => (
                  <option key={t} value={t}>{FUEL_TYPE_LABELS[t]}</option>
                ))}
              </select>
              {!PROPULSION_FUEL_TYPES.includes(form.fuelType) && (
                <p className="text-xs text-slate-500 mt-1">
                  {FUEL_TYPE_LABELS[form.fuelType]} is costed but does not affect mileage — it is not
                  burnt by the engine.
                </p>
              )}
            </Field>

            <Field label="Fill type" hint="Mileage can only be measured between full tanks">
              <select
                value={form.fillType}
                onChange={(e) => set({ fillType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {FILL_TYPES.map((t) => (
                  <option key={t} value={t}>{FILL_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </Field>

            <Field label={`Quantity (${unit})`} required>
              <input
                type="number" step="0.001" min="0" required
                value={form.quantity} onChange={(e) => onQuantity(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>

            <Field label={`Rate (₹ per ${unit})`} hint="Fill any two of quantity, rate and amount">
              <input
                type="number" step="0.001" min="0"
                value={form.rate} onChange={(e) => onRate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>

            <Field label="Amount paid (₹)" required>
              <input
                type="number" step="0.01" min="0" required
                value={form.amount} onChange={(e) => onAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>

            <Field label="Payment mode">
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
          </Section>

          {/* --- Odometer --- */}
          <Section title="Odometer">
            <Field label="Reading at the pump (km)">
              <input
                type="number" step="1" min="0"
                value={form.odometer} onChange={(e) => set({ odometer: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {odometerHint && (
                <p className={`text-xs mt-1 ${
                  odometerHint.tone === 'error' ? 'text-red-600'
                    : odometerHint.tone === 'warn' ? 'text-amber-600' : 'text-slate-500'
                }`}>
                  {odometerHint.text}
                </p>
              )}
              {!form.odometer && (
                <p className="text-xs text-slate-500 mt-1">
                  Without a reading this filling is costed but cannot measure mileage.
                </p>
              )}
            </Field>

            <div className="space-y-2">
              {lastEntry && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                  <p className="text-slate-500 text-xs uppercase font-semibold">Previous filling</p>
                  <p className="text-slate-900 mt-1">
                    {formatOdometer(lastEntry.odometer)} · {formatDateTime(lastEntry.filledAt)}
                  </p>
                  <p className="text-slate-600 text-xs">
                    {lastEntry.quantity} {unitFor(lastEntry.fuelType)} · {formatMoney(lastEntry.amount)}
                  </p>
                </div>
              )}

              {previewMileage && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                  <p className="text-blue-900">
                    ≈ {previewMileage.kmPerUnit} km/{unit} over{' '}
                    {previewMileage.distance.toLocaleString('en-IN')} km
                  </p>
                  <p className="text-blue-700 text-xs mt-1">
                    An estimate. The saved figure is measured against the full odometer chain.
                  </p>
                </div>
              )}
            </div>
          </Section>

          {/* --- Station --- */}
          <Section title="Fuel station">
            <Field label="Station name">
              <input
                type="text" list="fuel-stations" value={form.station.name}
                onChange={(e) => {
                  const name = e.target.value;
                  // Picking a station already used fills in its city and code,
                  // which keeps the station-wise report from fragmenting.
                  const known = stations.find((s) => s.name === name);
                  if (known) setStation({ name, city: known.city, state: known.state, code: known.code });
                  else setStation({ name });
                }}
                placeholder="e.g. HP Highway Pump"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="fuel-stations">
                {stations.map((s) => (
                  <option key={s.name} value={s.name}>
                    {[s.city, `${s.uses} fillings`].filter(Boolean).join(' · ')}
                  </option>
                ))}
              </datalist>
            </Field>

            <Field label="City">
              <input
                type="text" value={form.station.city}
                onChange={(e) => setStation({ city: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>

            <Field label="Bill number">
              <input
                type="text" value={form.billNumber}
                onChange={(e) => set({ billNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>

            <Field label="Receipt">
              {form.receipt?.dataUrl ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-700 truncate flex-1">
                    {form.receipt.filename || 'Receipt attached'}
                  </span>
                  <button
                    type="button"
                    onClick={() => set({ receipt: { dataUrl: '', filename: '', mimeType: '' } })}
                    className="p-2 hover:bg-red-50 text-red-600 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
                    onChange={(e) => onFile(e.target.files?.[0])}
                  />
                  <button
                    type="button" onClick={() => fileRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                  >
                    <Upload className="w-4 h-4" />
                    Attach the bill
                  </button>
                </>
              )}
            </Field>
          </Section>

          <Section title="Notes">
            <div className="md:col-span-2">
              <textarea
                rows={3} value={form.remarks}
                onChange={(e) => set({ remarks: e.target.value })}
                placeholder="Anything worth recording about this filling"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </Section>

          <div className="flex items-center justify-end gap-3 pb-8">
            <button
              type="button" onClick={() => navigate('/fuel')}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={saving || !can('fuel', isEdit ? 'update' : 'create')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Record filling'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
        {Icon && <Icon className="w-5 h-5 text-slate-400" />}
        {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}
