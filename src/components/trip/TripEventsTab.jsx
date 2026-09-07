import { useState } from 'react';
import { Bell, Plus, Check, X, MapPin } from 'lucide-react';
import { Card, Field, EmptyState, ErrorNote } from './shared';
import { inputClass } from './helpers';
import { tripOrders } from '../../services/api';
import { EVENT_TYPE_LABELS, EVENT_SEVERITY_COLORS, formatDateTime } from '../../constants/trip';

// What happened on the trip. System events are written by the server as the
// trip moves; this is where an operator adds the ones only a person knows about
// — a breakdown, a police check, a customer calling to reschedule.
//
// A hand-added event is always stored as `manual` regardless of what the form
// says, so a typed note can never be presented as a machine observation.
export function TripEventsTab({ trip, reload, canEdit }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ eventType: 'manual', severity: 'info', message: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!draft.message.trim()) return;
    setSaving(true);
    setError('');
    try {
      await tripOrders.addEvent(trip._id, draft);
      setDraft({ eventType: 'manual', severity: 'info', message: '' });
      setAdding(false);
      await reload();
    } catch (err) {
      setError(err.message || 'Could not record the event');
    } finally {
      setSaving(false);
    }
  };

  // Newest first: on an active trip the most recent event is the one being
  // acted on.
  const events = [...(trip.events || [])].sort(
    (a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)
  );

  return (
    <div className="space-y-6">
      <ErrorNote>{error}</ErrorNote>

      <Card
        title={`Events (${events.length})`}
        action={
          canEdit && !adding && (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Record Event
            </button>
          )
        }
      >
        {adding && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end mb-4 pb-4 border-b border-slate-200">
            <Field label="Type">
              <select
                value={draft.eventType}
                onChange={(e) => setDraft((d) => ({ ...d, eventType: e.target.value }))}
                className={inputClass}
              >
                {Object.entries(EVENT_TYPE_LABELS)
                  // A status change is written by the system when the status
                  // actually changes; offering it here would let someone log one
                  // that never happened.
                  .filter(([v]) => v !== 'status_change')
                  .map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
              </select>
            </Field>
            <Field label="Severity">
              <select
                value={draft.severity}
                onChange={(e) => setDraft((d) => ({ ...d, severity: e.target.value }))}
                className={inputClass}
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </Field>
            <Field label="What happened">
              <input
                type="text"
                value={draft.message}
                onChange={(e) => setDraft((d) => ({ ...d, message: e.target.value }))}
                placeholder="e.g. Tyre puncture near Nashik, delayed 2 hours"
                className={inputClass}
              />
            </Field>
            <div className="flex gap-2">
              <button
                onClick={submit}
                disabled={saving || !draft.message.trim()}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Check className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={() => setAdding(false)}
                className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {events.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No events recorded"
            hint="Status changes are logged automatically. Add anything else worth knowing about this trip."
          />
        ) : (
          <ul className="space-y-3">
            {events.map((event, i) => (
              <li
                key={event._id || i}
                className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0"
              >
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                    EVENT_SEVERITY_COLORS[event.severity] || 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {EVENT_TYPE_LABELS[event.eventType] || event.eventType}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">{event.message}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatDateTime(event.occurredAt)}
                    {' · '}
                    {event.source === 'manual' ? 'Recorded by hand' : 'System'}
                    {event.lat != null && event.lng != null && (
                      <span className="inline-flex items-center gap-1 ml-2">
                        <MapPin className="w-3 h-3" />
                        {event.lat.toFixed(4)}, {event.lng.toFixed(4)}
                      </span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-xs text-slate-500">
        Overspeed, idle, geofence and route-deviation events are generated automatically only where a
        tracking integration supplies them. On a trip without a tracker, this list holds the status
        history and whatever is recorded by hand.
      </p>
    </div>
  );
}
