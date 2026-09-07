import { useState } from 'react';
import { Package, Plus, Trash2, Save, AlertTriangle } from 'lucide-react';
import { Card, Field, EmptyState, ErrorNote, FindingList } from './shared';
import { inputClass } from './helpers';
import { tripOrders } from '../../services/api';
import { CARGO_UNITS, formatNumber } from '../../constants/trip';

// The load: what is being carried, and whether the assigned vehicle can take it.
//
// Saving an over-capacity load is allowed here on purpose — the operator may be
// entering the cargo before choosing a bigger vehicle, and refusing the save
// would leave them nowhere to put the information. The block happens at
// assignment, which is the point at which an overloaded truck would actually go
// out. The warning is shown here either way.
export function TripCargoTab({ trip, reload, canEdit }) {
  const [cargo, setCargo] = useState(() =>
    (trip.cargo || []).map((c) => ({
      cargoType: c.cargoType || '',
      description: c.description || '',
      quantity: c.quantity ?? '',
      unit: c.unit || 'Boxes',
      weightKg: c.weightKg ?? '',
      volumeM3: c.volumeM3 ?? '',
      packages: c.packages ?? '',
      boxes: c.boxes ?? '',
      specialInstructions: c.specialInstructions || '',
    }))
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [capacityCheck, setCapacityCheck] = useState(null);

  const update = (i, patch) =>
    setCargo((list) => list.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const totals = cargo.reduce(
    (acc, c) => ({
      quantity: acc.quantity + (Number(c.quantity) || 0),
      weightKg: acc.weightKg + (Number(c.weightKg) || 0),
      volumeM3: acc.volumeM3 + (Number(c.volumeM3) || 0),
      packages: acc.packages + (Number(c.packages) || 0),
    }),
    { quantity: 0, weightKg: 0, volumeM3: 0, packages: 0 }
  );

  const capacityKg = trip.truck?.capacity?.weightKg;
  const capacityM3 = trip.truck?.capacity?.volumeM3;
  const overWeight = capacityKg > 0 && totals.weightKg > capacityKg;
  const overVolume = capacityM3 > 0 && totals.volumeM3 > capacityM3;

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await tripOrders.saveCargo(
        trip._id,
        cargo.map((c) => ({
          ...c,
          quantity: c.quantity === '' ? 0 : Number(c.quantity),
          weightKg: c.weightKg === '' ? 0 : Number(c.weightKg),
          volumeM3: c.volumeM3 === '' ? 0 : Number(c.volumeM3),
          packages: c.packages === '' ? 0 : Number(c.packages),
          boxes: c.boxes === '' ? 0 : Number(c.boxes),
        }))
      );
      setCapacityCheck(res.capacityCheck || null);
      await reload();
    } catch (err) {
      setError(err.message || 'Failed to save the cargo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <ErrorNote>{error}</ErrorNote>

      {/* Totals against capacity, computed live as the operator types so the
          consequence of a line is visible before saving. The authoritative
          check still runs on the server at assignment. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <TotalTile label="Total Quantity" value={formatNumber(totals.quantity)} />
        <TotalTile
          label="Total Weight"
          value={`${formatNumber(totals.weightKg)} kg`}
          hint={capacityKg ? `of ${formatNumber(capacityKg)} kg capacity` : 'No capacity recorded'}
          tone={overWeight ? 'bad' : capacityKg && totals.weightKg > capacityKg * 0.9 ? 'warn' : 'neutral'}
        />
        <TotalTile
          label="Total Volume"
          value={`${formatNumber(totals.volumeM3)} m³`}
          hint={capacityM3 ? `of ${formatNumber(capacityM3)} m³ capacity` : 'No capacity recorded'}
          tone={overVolume ? 'bad' : 'neutral'}
        />
        <TotalTile label="Packages" value={formatNumber(totals.packages)} />
      </div>

      {(overWeight || overVolume) && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-medium">This load exceeds the assigned vehicle's capacity.</p>
            <p className="mt-1">
              You can still record it, but the vehicle assignment will be blocked until either the
              load or the vehicle changes.
            </p>
          </div>
        </div>
      )}

      {capacityCheck && (
        <FindingList blockers={capacityCheck.blockers} warnings={capacityCheck.warnings} />
      )}

      <Card
        title={`Cargo (${cargo.length})`}
        action={
          canEdit && (
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setCargo((c) => [
                    ...c,
                    { cargoType: '', description: '', quantity: '', unit: 'Boxes', weightKg: '', volumeM3: '', packages: '', boxes: '', specialInstructions: '' },
                  ])
                }
                className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Cargo'}
              </button>
            </div>
          )
        }
      >
        {cargo.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No cargo recorded"
            hint="Add what this trip is carrying. An empty-return leg legitimately carries none."
          />
        ) : (
          <div className="space-y-4">
            {cargo.map((item, i) => (
              <div key={i} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-medium text-slate-900">Item {i + 1}</p>
                  {canEdit && (
                    <button
                      onClick={() => setCargo((c) => c.filter((_, j) => j !== i))}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field label="Cargo Type">
                    <input
                      type="text"
                      value={item.cargoType}
                      onChange={(e) => update(i, { cargoType: e.target.value })}
                      disabled={!canEdit}
                      placeholder="e.g. Textiles, Cement"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Description">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => update(i, { description: e.target.value })}
                      disabled={!canEdit}
                      className={inputClass}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Quantity">
                      <input
                        type="number"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => update(i, { quantity: e.target.value })}
                        disabled={!canEdit}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Unit">
                      <select
                        value={item.unit}
                        onChange={(e) => update(i, { unit: e.target.value })}
                        disabled={!canEdit}
                        className={inputClass}
                      >
                        {CARGO_UNITS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  <Field label="Weight (kg)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.weightKg}
                      onChange={(e) => update(i, { weightKg: e.target.value })}
                      disabled={!canEdit}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Volume (m³)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.volumeM3}
                      onChange={(e) => update(i, { volumeM3: e.target.value })}
                      disabled={!canEdit}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Packages">
                    <input
                      type="number"
                      min="0"
                      value={item.packages}
                      onChange={(e) => update(i, { packages: e.target.value })}
                      disabled={!canEdit}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Boxes">
                    <input
                      type="number"
                      min="0"
                      value={item.boxes}
                      onChange={(e) => update(i, { boxes: e.target.value })}
                      disabled={!canEdit}
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="mt-3">
                  <Field label="Special Instructions">
                    <input
                      type="text"
                      value={item.specialInstructions}
                      onChange={(e) => update(i, { specialInstructions: e.target.value })}
                      disabled={!canEdit}
                      placeholder="Fragile, keep upright, temperature controlled..."
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function TotalTile({ label, value, hint, tone = 'neutral' }) {
  const toneClass =
    tone === 'bad' ? 'text-red-600' : tone === 'warn' ? 'text-amber-600' : 'text-slate-900';
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`text-xl font-bold mt-1 ${toneClass}`}>{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
    </div>
  );
}
