import { useState, useEffect } from 'react';
import { Truck, UserRound, Plus, Trash2, ShieldAlert, Check } from 'lucide-react';
import { Card, Detail, Field, ErrorNote, FindingList } from './shared';
import { inputClass } from './helpers';
import { tripOrders } from '../../services/api';
import { CREW_ROLE_LABELS, formatNumber, formatDate } from '../../constants/trip';

// Vehicle, driver and crew assignment.
//
// The checks that decide whether an assignment is allowed all live on the
// server; this screen asks for the verdict, shows it, and offers an override
// only when the server says the seat may use one. It never decides for itself
// whether a vehicle is available.
export function TripAssignmentTab({ trip, reload, canEdit }) {
  const [options, setOptions] = useState({ trucks: [], drivers: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [truckId, setTruckId] = useState(trip.truck?._id || trip.truck || '');
  const [driverId, setDriverId] = useState(trip.driver?._id || trip.driver || '');

  const [truckCheck, setTruckCheck] = useState(null);
  const [driverCheck, setDriverCheck] = useState(null);
  const [saving, setSaving] = useState('');

  const [crew, setCrew] = useState(
    (trip.crew || []).map((c) => ({
      role: c.role,
      employee: c.employee?._id || c.employee || '',
      name: c.name || '',
      mobile: c.mobile || '',
    }))
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await tripOrders.assignmentOptions(trip._id);
        if (!cancelled) setOptions({ trucks: res.trucks || [], drivers: res.drivers || [] });
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load the fleet and roster');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [trip._id]);

  // Check the selection as soon as it changes, so the operator sees the
  // blockers before pressing Assign rather than after.
  useEffect(() => {
    if (!truckId) { setTruckCheck(null); return; }
    let cancelled = false;
    tripOrders
      .checkVehicle(trip._id, truckId)
      .then((res) => { if (!cancelled) setTruckCheck(res); })
      .catch(() => { if (!cancelled) setTruckCheck(null); });
    return () => { cancelled = true; };
  }, [truckId, trip._id]);

  useEffect(() => {
    if (!driverId) { setDriverCheck(null); return; }
    let cancelled = false;
    tripOrders
      .checkDriver(trip._id, driverId)
      .then((res) => { if (!cancelled) setDriverCheck(res); })
      .catch(() => { if (!cancelled) setDriverCheck(null); });
    return () => { cancelled = true; };
  }, [driverId, trip._id]);

  const assign = async (kind, { override = false } = {}) => {
    setSaving(kind);
    setError('');
    try {
      if (kind === 'vehicle') {
        await tripOrders.assignVehicle(trip._id, truckId, { allowOverride: override });
      } else {
        await tripOrders.assignDriver(trip._id, driverId, { allowOverride: override });
      }
      await reload();
    } catch (err) {
      setError(err.message || 'The assignment was refused');
      // A refusal carries the full finding list, which is more useful than the
      // single headline message.
      if (err.data?.blockers) {
        const setter = kind === 'vehicle' ? setTruckCheck : setDriverCheck;
        setter((prev) => ({
          ...(prev || {}),
          ok: false,
          blockers: err.data.blockers,
          warnings: err.data.warnings || [],
          canOverride: err.data.canOverride,
        }));
      }
    } finally {
      setSaving('');
    }
  };

  const saveCrew = async () => {
    setSaving('crew');
    setError('');
    try {
      await tripOrders.saveCrew(trip._id, crew.filter((c) => c.employee || c.name));
      await reload();
    } catch (err) {
      setError(err.message || 'Failed to save the crew');
    } finally {
      setSaving('');
    }
  };

  const selectedTruck = options.trucks.find((t) => t._id === truckId);
  const selectedDriver = options.drivers.find((d) => d._id === driverId);

  if (loading) return <p className="text-slate-500">Loading fleet and roster...</p>;

  return (
    <div className="space-y-6">
      <ErrorNote>{error}</ErrorNote>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vehicle */}
        <Card title="Vehicle">
          <div className="space-y-4">
            <Field label="Assign Vehicle">
              <select
                value={truckId}
                onChange={(e) => setTruckId(e.target.value)}
                disabled={!canEdit}
                className={inputClass}
              >
                <option value="">Select a vehicle</option>
                {options.trucks.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.number} — {t.model}
                    {/* Busy vehicles stay in the list, labelled. Hiding them
                        would leave the operator wondering where the truck went. */}
                    {t.busyOnTrip ? ` (on ${t.busyOnTrip})` : ''}
                    {t.status === 'Maintenance' ? ' (maintenance)' : ''}
                  </option>
                ))}
              </select>
            </Field>

            {selectedTruck && (
              <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
                <Detail label="Status" value={selectedTruck.status} />
                <Detail label="Type" value={selectedTruck.vehicleType} />
                <Detail
                  label="Odometer"
                  value={selectedTruck.odometer != null ? `${formatNumber(selectedTruck.odometer)} km` : null}
                />
                <Detail label="Fuel Type" value={selectedTruck.fuelType} />
                <Detail
                  label="Capacity"
                  value={
                    selectedTruck.capacity?.weightKg
                      ? `${formatNumber(selectedTruck.capacity.weightKg)} kg`
                      : null
                  }
                />
                <Detail label="Body" value={selectedTruck.capacity?.bodyType} />
                <Detail
                  label="Tracker"
                  value={selectedTruck.device ? 'Fitted' : 'None'}
                />
                <Detail
                  label="Currently"
                  value={selectedTruck.busyOnTrip ? `On trip ${selectedTruck.busyOnTrip}` : 'Available'}
                />
              </div>
            )}

            {truckCheck && (
              <FindingList blockers={truckCheck.blockers} warnings={truckCheck.warnings} />
            )}

            {truckCheck?.detail?.capacityCheck && (
              <p className="text-sm text-slate-600">
                Cargo on this trip: {formatNumber(truckCheck.detail.capacityCheck.totalWeight)} kg
                {selectedTruck?.capacity?.weightKg
                  ? ` of ${formatNumber(selectedTruck.capacity.weightKg)} kg capacity`
                  : ''}
              </p>
            )}

            {canEdit && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => assign('vehicle')}
                  disabled={!truckId || saving === 'vehicle' || (truckCheck && !truckCheck.ok)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Truck className="w-4 h-4" />
                  {saving === 'vehicle' ? 'Assigning...' : 'Assign Vehicle'}
                </button>

                {/* Only offered when the server says this seat may override.
                    The button is not a client-side decision. */}
                {truckCheck && !truckCheck.ok && truckCheck.canOverride && (
                  <button
                    onClick={() => {
                      if (window.confirm(
                        'This assignment is blocked:\n\n' +
                        truckCheck.blockers.join('\n') +
                        '\n\nAssign anyway? This is recorded against the trip and in the audit log.'
                      )) assign('vehicle', { override: true });
                    }}
                    disabled={saving === 'vehicle'}
                    className="flex items-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    Override
                  </button>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Driver */}
        <Card title="Driver">
          <div className="space-y-4">
            <Field label="Assign Driver">
              <select
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                disabled={!canEdit}
                className={inputClass}
              >
                <option value="">Select a driver</option>
                {options.drivers.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                    {d.busyOnTrip ? ` (on ${d.busyOnTrip})` : ''}
                    {d.status !== 'Available' && !d.busyOnTrip ? ` (${d.status})` : ''}
                  </option>
                ))}
              </select>
            </Field>

            {selectedDriver && (
              <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
                <Detail label="Mobile" value={selectedDriver.mobile} />
                <Detail label="Status" value={selectedDriver.status} />
                <Detail label="Licence" value={selectedDriver.licenseNumber} />
                <Detail
                  label="Licence Expiry"
                  value={selectedDriver.licenseExpiry ? formatDate(selectedDriver.licenseExpiry) : null}
                />
                <Detail
                  label="Currently"
                  value={selectedDriver.busyOnTrip ? `On trip ${selectedDriver.busyOnTrip}` : 'Available'}
                />
              </div>
            )}

            {driverCheck && (
              <FindingList blockers={driverCheck.blockers} warnings={driverCheck.warnings} />
            )}

            {canEdit && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => assign('driver')}
                  disabled={!driverId || saving === 'driver' || (driverCheck && !driverCheck.ok)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <UserRound className="w-4 h-4" />
                  {saving === 'driver' ? 'Assigning...' : 'Assign Driver'}
                </button>

                {driverCheck && !driverCheck.ok && driverCheck.canOverride && (
                  <button
                    onClick={() => {
                      if (window.confirm(
                        'This assignment is blocked:\n\n' +
                        driverCheck.blockers.join('\n') +
                        '\n\nAssign anyway? This is recorded against the trip and in the audit log.'
                      )) assign('driver', { override: true });
                    }}
                    disabled={saving === 'driver'}
                    className="flex items-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    Override
                  </button>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Crew */}
      <Card
        title="Crew"
        action={
          canEdit && (
            <button
              onClick={() => setCrew((c) => [...c, { role: 'helper', employee: '', name: '', mobile: '' }])}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Crew
            </button>
          )
        }
      >
        {crew.length === 0 ? (
          <p className="text-slate-500 text-sm">
            No additional crew on this trip. Add a second driver, helper or cleaner if one is
            travelling.
          </p>
        ) : (
          <div className="space-y-3">
            {crew.map((member, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <Field label="Role">
                  <select
                    value={member.role}
                    onChange={(e) =>
                      setCrew((c) => c.map((m, j) => (j === i ? { ...m, role: e.target.value } : m)))
                    }
                    disabled={!canEdit}
                    className={inputClass}
                  >
                    {Object.entries(CREW_ROLE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </Field>

                <Field label="From Roster">
                  <select
                    value={member.employee}
                    onChange={(e) =>
                      setCrew((c) =>
                        c.map((m, j) => (j === i ? { ...m, employee: e.target.value } : m))
                      )
                    }
                    disabled={!canEdit}
                    className={inputClass}
                  >
                    <option value="">Not on the roster</option>
                    {options.drivers.map((d) => (
                      <option key={d._id} value={d._id}>{d.name}</option>
                    ))}
                  </select>
                </Field>

                {/* Name and mobile cover a casual helper who is not on the
                    driver roster — recording them should not mean creating a
                    driver master record for someone hired for one day. */}
                <Field label="Name (if not on roster)">
                  <input
                    type="text"
                    value={member.name}
                    onChange={(e) =>
                      setCrew((c) => c.map((m, j) => (j === i ? { ...m, name: e.target.value } : m)))
                    }
                    disabled={!canEdit || Boolean(member.employee)}
                    className={inputClass}
                  />
                </Field>

                <div className="flex gap-2">
                  <Field label="Mobile">
                    <input
                      type="text"
                      value={member.mobile}
                      onChange={(e) =>
                        setCrew((c) => c.map((m, j) => (j === i ? { ...m, mobile: e.target.value } : m)))
                      }
                      disabled={!canEdit || Boolean(member.employee)}
                      className={inputClass}
                    />
                  </Field>
                  {canEdit && (
                    <button
                      onClick={() => setCrew((c) => c.filter((_, j) => j !== i))}
                      className="p-2 mb-0.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {canEdit && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <button
              onClick={saveCrew}
              disabled={saving === 'crew'}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Check className="w-4 h-4" />
              {saving === 'crew' ? 'Saving...' : 'Save Crew'}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
