import { useState } from 'react';
import { Save, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, ErrorNote } from './shared';
import { inputClass } from './helpers';
import { tripOrders } from '../../services/api';
import { formatDateTime } from '../../constants/trip';

// The pre-departure checklist. The mandatory items are the gate: the server
// refuses to dispatch a trip while any of them is unticked, and this screen
// shows which are outstanding rather than leaving the operator to discover it
// when the Dispatch button fails.
//
// The item definitions come from the server (which ones are mandatory is its
// decision), carried on the trip's own checklist array.
const ITEM_LABELS = {
  vehicle: 'Vehicle inspected and roadworthy',
  driver: 'Driver briefed and fit to drive',
  documents: 'Vehicle and driver documents valid',
  fuel: 'Fuel level recorded',
  odometer: 'Starting odometer recorded',
  inspection: 'Pre-trip inspection completed',
  cargo: 'Cargo loaded and secured',
  acknowledgement: 'Driver acknowledgement taken',
};

// Mirrors MANDATORY_CHECKLIST_KEYS on the server. Presentational only — the
// server enforces the gate regardless of what this shows.
const MANDATORY = ['vehicle', 'driver', 'documents', 'odometer', 'acknowledgement'];

export function TripChecklistTab({ trip, reload, canEdit }) {
  const [items, setItems] = useState(() =>
    (trip.checklist || []).map((i) => ({
      key: i.key,
      checked: Boolean(i.checked),
      notes: i.notes || '',
      checkedAt: i.checkedAt,
    }))
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const toggle = (key) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, checked: !i.checked } : i)));

  const setNotes = (key, notes) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, notes } : i)));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await tripOrders.saveChecklist(trip._id, items);
      await reload();
    } catch (err) {
      setError(err.message || 'Failed to save the checklist');
    } finally {
      setSaving(false);
    }
  };

  const outstanding = MANDATORY.filter(
    (key) => !items.find((i) => i.key === key)?.checked
  );
  const ready = outstanding.length === 0 && Boolean(trip.truck) && Boolean(trip.driver);

  return (
    <div className="space-y-6">
      <ErrorNote>{error}</ErrorNote>

      {/* Dispatch readiness, stated plainly. This is the question the tab
          exists to answer. */}
      <div
        className={`flex items-start gap-3 rounded-lg px-4 py-3 border text-sm ${
          ready
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}
      >
        {ready ? (
          <CheckCircle2 className="w-5 h-5 shrink-0" />
        ) : (
          <AlertTriangle className="w-5 h-5 shrink-0" />
        )}
        <div>
          {ready ? (
            <p className="font-medium">This trip is ready to dispatch.</p>
          ) : (
            <>
              <p className="font-medium">This trip cannot be dispatched yet.</p>
              <ul className="mt-1 list-disc list-inside space-y-0.5">
                {!trip.truck && <li>No vehicle is assigned</li>}
                {!trip.driver && <li>No driver is assigned</li>}
                {outstanding.map((key) => (
                  <li key={key}>{ITEM_LABELS[key] || key}</li>
                ))}
              </ul>
              <p className="mt-2 opacity-80">
                Tick the outstanding items and save. Items marked required must be complete before
                the vehicle can leave.
              </p>
            </>
          )}
        </div>
      </div>

      <Card
        title="Dispatch Checklist"
        action={
          canEdit && (
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Checklist'}
            </button>
          )
        }
      >
        <div className="space-y-3">
          {items.map((item) => {
            const mandatory = MANDATORY.includes(item.key);
            return (
              <div
                key={item.key}
                className={`border rounded-lg p-4 transition-colors ${
                  item.checked ? 'border-green-200 bg-green-50/50' : 'border-slate-200'
                }`}
              >
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => toggle(item.key)}
                    disabled={!canEdit}
                    className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900">
                        {ITEM_LABELS[item.key] || item.key}
                      </span>
                      {mandatory && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          Required
                        </span>
                      )}
                    </div>
                    {item.checked && item.checkedAt && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Checked {formatDateTime(item.checkedAt)}
                      </p>
                    )}
                  </div>
                </label>

                <input
                  type="text"
                  value={item.notes}
                  onChange={(e) => setNotes(item.key, e.target.value)}
                  disabled={!canEdit}
                  placeholder="Notes (optional)"
                  className={`${inputClass} mt-3 text-sm`}
                />
              </div>
            );
          })}
        </div>
      </Card>

      {/* The readings the checklist refers to, so the operator can see whether
          the odometer item is truthful without switching tabs. */}
      <Card title="Related Readings">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Vehicle</p>
            <p className="font-medium text-slate-900">
              {trip.vehicleNumber || trip.truck?.number || '—'}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Driver</p>
            <p className="font-medium text-slate-900">
              {trip.driverName || trip.driver?.name || '—'}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Starting Odometer</p>
            <p className="font-medium text-slate-900">
              {trip.start?.odometer != null ? `${trip.start.odometer} km` : '—'}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Starting Fuel</p>
            <p className="font-medium text-slate-900">
              {trip.start?.fuelLevel != null ? `${trip.start.fuelLevel}%` : '—'}
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          The odometer and fuel readings are captured when you start the trip.
        </p>
      </Card>
    </div>
  );
}
