import { useState } from 'react';
import {
  MapPin, Plus, Trash2, ChevronUp, ChevronDown, Check, LogIn, LogOut,
  SkipForward, FileSignature, Save,
} from 'lucide-react';
import { Card, Field, EmptyState, ErrorNote } from './shared';
import { inputClass } from './helpers';
import { tripOrders } from '../../services/api';
import {
  STOP_TYPE_LABELS, STOP_STATUS_LABELS, STOP_STATUS_COLORS, formatDateTime,
} from '../../constants/trip';
import { StopPodModal } from './StopPodModal';

// Multi-stop planning and execution.
//
// Editing and reordering are saved together through one PUT that replaces the
// list in travel order — the server renumbers from array position, so the
// sequence can never disagree with what is on screen. Stops that have already
// been reached keep their arrival times and POD through that save; only the
// planning fields are taken from the form.
export function TripStopsTab({ trip, reload, canEdit }) {
  const [stops, setStops] = useState(() =>
    (trip.stops || []).map((s) => ({
      _id: s._id,
      stopType: s.stopType,
      location: { ...s.location },
      eta: toLocalInput(s.eta),
      loadingQuantity: s.loadingQuantity ?? '',
      unloadingQuantity: s.unloadingQuantity ?? '',
      status: s.status,
      notes: s.notes || '',
      arrivedAt: s.arrivedAt,
      departedAt: s.departedAt,
      sequence: s.sequence,
      hasPod: Boolean(s.pod?.receiverName || s.pod?.capturedAt),
    }))
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [podStop, setPodStop] = useState(null);

  const update = (i, patch) =>
    setStops((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const updateLocation = (i, patch) =>
    setStops((list) =>
      list.map((s, j) => (j === i ? { ...s, location: { ...s.location, ...patch } } : s))
    );

  const move = (i, direction) => {
    const target = i + direction;
    if (target < 0 || target >= stops.length) return;
    setStops((list) => {
      const next = [...list];
      [next[i], next[target]] = [next[target], next[i]];
      return next;
    });
  };

  const addStop = () =>
    setStops((list) => [
      ...list,
      {
        stopType: 'via',
        location: { name: '', address: '', city: '', state: '', pincode: '', contactName: '', contactPhone: '', lat: null, lng: null },
        eta: '',
        loadingQuantity: '',
        unloadingQuantity: '',
        status: 'pending',
        notes: '',
      },
    ]);

  const saveAll = async () => {
    setSaving(true);
    setError('');
    try {
      await tripOrders.saveStops(
        trip._id,
        stops.map((s) => ({
          _id: s._id,
          stopType: s.stopType,
          location: s.location,
          eta: s.eta || null,
          loadingQuantity: s.loadingQuantity === '' ? null : Number(s.loadingQuantity),
          unloadingQuantity: s.unloadingQuantity === '' ? null : Number(s.unloadingQuantity),
          notes: s.notes,
        }))
      );
      await reload();
    } catch (err) {
      setError(err.message || 'Failed to save the stops');
    } finally {
      setSaving(false);
    }
  };

  const act = async (stopId, action) => {
    setError('');
    try {
      await tripOrders.updateStop(trip._id, stopId, { action });
      await reload();
    } catch (err) {
      setError(err.message || 'Could not update the stop');
    }
  };

  const removeStop = async (i) => {
    const stop = stops[i];
    // An unsaved row is only in local state, so it just disappears.
    if (!stop._id) {
      setStops((list) => list.filter((_, j) => j !== i));
      return;
    }
    setError('');
    try {
      const res = await tripOrders.removeStop(trip._id, stop._id);
      // A stop the vehicle already reached is marked skipped rather than
      // deleted; the server says which happened and the operator is told.
      if (res.skipped) setError(res.message);
      await reload();
    } catch (err) {
      setError(err.message || 'Could not remove the stop');
    }
  };

  return (
    <div className="space-y-6">
      <ErrorNote>{error}</ErrorNote>

      <Card
        title={`Stops (${stops.length})`}
        action={
          canEdit && (
            <div className="flex items-center gap-2">
              <button
                onClick={addStop}
                className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Stop
              </button>
              <button
                onClick={saveAll}
                disabled={saving}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Stops'}
              </button>
            </div>
          )
        }
      >
        {stops.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No intermediate stops"
            hint="This trip runs straight from pickup to destination. Add a stop if it calls anywhere on the way."
          />
        ) : (
          <div className="space-y-4">
            {stops.map((stop, i) => (
              <div key={stop._id || `new-${i}`} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-medium text-slate-900">
                        {stop.location.name || stop.location.city || `Stop ${i + 1}`}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            STOP_STATUS_COLORS[stop.status] || 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {STOP_STATUS_LABELS[stop.status]}
                        </span>
                        {stop.arrivedAt && (
                          <span className="text-xs text-slate-500">
                            Arrived {formatDateTime(stop.arrivedAt)}
                          </span>
                        )}
                        {stop.departedAt && (
                          <span className="text-xs text-slate-500">
                            Departed {formatDateTime(stop.departedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        className="p-1.5 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30 transition-colors"
                        title="Move up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => move(i, 1)}
                        disabled={i === stops.length - 1}
                        className="p-1.5 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30 transition-colors"
                        title="Move down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeStop(i)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Field label="Stop Type">
                    <select
                      value={stop.stopType}
                      onChange={(e) => update(i, { stopType: e.target.value })}
                      disabled={!canEdit}
                      className={inputClass}
                    >
                      {Object.entries(STOP_TYPE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Location Name">
                    <input
                      type="text"
                      value={stop.location.name || ''}
                      onChange={(e) => updateLocation(i, { name: e.target.value })}
                      disabled={!canEdit}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="City">
                    <input
                      type="text"
                      value={stop.location.city || ''}
                      onChange={(e) => updateLocation(i, { city: e.target.value })}
                      disabled={!canEdit}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="ETA">
                    <input
                      type="datetime-local"
                      value={stop.eta}
                      onChange={(e) => update(i, { eta: e.target.value })}
                      disabled={!canEdit}
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
                  <Field label="Address">
                    <input
                      type="text"
                      value={stop.location.address || ''}
                      onChange={(e) => updateLocation(i, { address: e.target.value })}
                      disabled={!canEdit}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="State">
                    <input
                      type="text"
                      value={stop.location.state || ''}
                      onChange={(e) => updateLocation(i, { state: e.target.value })}
                      disabled={!canEdit}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="PIN">
                    <input
                      type="text"
                      value={stop.location.pincode || ''}
                      onChange={(e) => updateLocation(i, { pincode: e.target.value })}
                      disabled={!canEdit}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Contact">
                    <input
                      type="text"
                      value={stop.location.contactName || ''}
                      onChange={(e) => updateLocation(i, { contactName: e.target.value })}
                      disabled={!canEdit}
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
                  <Field label="Phone">
                    <input
                      type="text"
                      value={stop.location.contactPhone || ''}
                      onChange={(e) => updateLocation(i, { contactPhone: e.target.value })}
                      disabled={!canEdit}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Loading Qty">
                    <input
                      type="number"
                      min="0"
                      value={stop.loadingQuantity}
                      onChange={(e) => update(i, { loadingQuantity: e.target.value })}
                      disabled={!canEdit}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Unloading Qty">
                    <input
                      type="number"
                      min="0"
                      value={stop.unloadingQuantity}
                      onChange={(e) => update(i, { unloadingQuantity: e.target.value })}
                      disabled={!canEdit}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Notes">
                    <input
                      type="text"
                      value={stop.notes}
                      onChange={(e) => update(i, { notes: e.target.value })}
                      disabled={!canEdit}
                      className={inputClass}
                    />
                  </Field>
                </div>

                {/* Execution actions, only for a stop that has been saved —
                    there is nothing on the server to act against otherwise. */}
                {stop._id && canEdit && (
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-200 flex-wrap">
                    {stop.status === 'pending' && (
                      <ActionButton icon={LogIn} onClick={() => act(stop._id, 'arrive')}>
                        Mark Arrived
                      </ActionButton>
                    )}
                    {stop.status === 'arrived' && (
                      <ActionButton icon={LogOut} onClick={() => act(stop._id, 'depart')}>
                        Mark Departed
                      </ActionButton>
                    )}
                    {stop.status !== 'completed' && stop.status !== 'skipped' && (
                      <>
                        <ActionButton icon={Check} onClick={() => act(stop._id, 'complete')}>
                          Complete
                        </ActionButton>
                        <ActionButton icon={SkipForward} onClick={() => act(stop._id, 'skip')}>
                          Skip
                        </ActionButton>
                      </>
                    )}
                    <ActionButton icon={FileSignature} onClick={() => setPodStop(stop)}>
                      {stop.hasPod ? 'Update POD' : 'Capture POD'}
                    </ActionButton>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {podStop && (
        <StopPodModal
          tripId={trip._id}
          stop={podStop}
          onClose={() => setPodStop(null)}
          onSaved={async () => {
            setPodStop(null);
            await reload();
          }}
        />
      )}
    </div>
  );
}

function ActionButton({ icon: Icon, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
    >
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}

function toLocalInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
