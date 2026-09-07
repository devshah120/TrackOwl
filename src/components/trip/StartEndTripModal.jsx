import { useState } from 'react';
import { X, Play, Square, MapPin, Loader2 } from 'lucide-react';
import { Field, ErrorNote } from './shared';
import { inputClass } from './helpers';
import { tripOrders } from '../../services/api';
import { formatNumber } from '../../constants/trip';

// Starting and ending a trip both capture the same readings — odometer, fuel,
// where and when — so they share one form.
//
// The odometer is the important field: actual distance is computed from the
// pair of readings, and every per-kilometre figure on the trip divides by it.
// The server refuses a final reading below the starting one; this warns before
// the round trip, but does not decide.
export function StartEndTripModal({ mode, trip, onClose, onDone }) {
  const isStart = mode === 'start';

  const [form, setForm] = useState({
    // Defaults to the vehicle master's odometer at start, so the driver
    // corrects a number rather than hunting for one.
    odometer: isStart
      ? (trip.start?.odometer ?? trip.truck?.odometer ?? '')
      : (trip.end?.odometer ?? ''),
    fuelLevel: '',
    location: '',
    lat: null,
    lng: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // GPS is used when the browser offers it and the operator asks. It is never
  // required: this form is often filled in at a desk from a phone call, where
  // the browser's location would be the office, not the vehicle.
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('This browser cannot provide a location');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setError('Could not get the current location');
        setLocating(false);
      },
      { timeout: 10000 }
    );
  };

  const startOdometer = trip.start?.odometer;
  const enteredOdometer = form.odometer === '' ? null : Number(form.odometer);
  const wouldGoBackwards =
    !isStart && startOdometer != null && enteredOdometer != null && enteredOdometer < startOdometer;

  const submit = async () => {
    if (form.odometer === '') {
      setError(`A ${isStart ? 'starting' : 'final'} odometer reading is required`);
      return;
    }
    if (wouldGoBackwards) {
      setError(
        `The final odometer (${formatNumber(enteredOdometer)} km) cannot be lower than the starting reading (${formatNumber(startOdometer)} km)`
      );
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        odometer: Number(form.odometer),
        fuelLevel: form.fuelLevel === '' ? null : Number(form.fuelLevel),
        location: form.location,
        lat: form.lat,
        lng: form.lng,
        at: new Date().toISOString(),
      };

      if (isStart) {
        await tripOrders.start(trip._id, payload);
        onDone('Trip started — it is now In Transit');
      } else {
        const res = await tripOrders.end(trip._id, payload);
        const km = res.trip?.actualKm;
        onDone(
          km != null
            ? `Trip ended — ${formatNumber(km)} km driven`
            : 'Trip ended and marked Delivered'
        );
      }
    } catch (err) {
      setError(err.message || `Could not ${isStart ? 'start' : 'end'} the trip`);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            {isStart ? <Play className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-blue-600" />}
            {isStart ? 'Start Trip' : 'End Trip'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <ErrorNote>{error}</ErrorNote>

          <p className="text-sm text-slate-600">
            {isStart
              ? `Recording the odometer now is what makes the trip's actual distance measurable when it ends.`
              : `Actual distance is the difference between this reading and the ${
                  startOdometer != null ? `${formatNumber(startOdometer)} km` : 'starting reading'
                } recorded at the start.`}
          </p>

          <Field
            label={isStart ? 'Starting Odometer (km)' : 'Final Odometer (km)'}
            required
            hint={
              isStart && trip.truck?.odometer != null
                ? `The vehicle master shows ${formatNumber(trip.truck.odometer)} km`
                : null
            }
          >
            <input
              type="number"
              min="0"
              value={form.odometer}
              onChange={(e) => set({ odometer: e.target.value })}
              autoFocus
              className={inputClass}
            />
          </Field>

          {wouldGoBackwards && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              This is below the starting reading of {formatNumber(startOdometer)} km.
            </div>
          )}

          {!isStart && enteredOdometer != null && startOdometer != null && !wouldGoBackwards && (
            <div className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-2">
              Distance for this trip: <span className="font-semibold">
                {formatNumber(enteredOdometer - startOdometer)} km
              </span>
              {trip.plannedKm != null && (
                <span className="text-slate-500"> · planned {formatNumber(trip.plannedKm)} km</span>
              )}
            </div>
          )}

          <Field label="Fuel Level (%)">
            <input
              type="number"
              min="0"
              max="100"
              value={form.fuelLevel}
              onChange={(e) => set({ fuelLevel: e.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label={isStart ? 'Starting Location' : 'End Location'}>
            <input
              type="text"
              value={form.location}
              onChange={(e) => set({ location: e.target.value })}
              placeholder={
                isStart
                  ? trip.pickup?.city || trip.pickup?.name || 'Where the trip is starting from'
                  : trip.destination?.city || trip.destination?.name || 'Where the trip ended'
              }
              className={inputClass}
            />
          </Field>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locating}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {locating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MapPin className="w-4 h-4" />
              )}
              Use current location
            </button>
            {form.lat != null && (
              <span className="text-sm text-slate-600">
                {form.lat.toFixed(4)}, {form.lng.toFixed(4)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || form.odometer === '' || wouldGoBackwards}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : isStart ? 'Start Trip' : 'End Trip'}
          </button>
        </div>
      </div>
    </div>
  );
}
