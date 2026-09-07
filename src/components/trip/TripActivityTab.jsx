import { useState, useEffect } from 'react';
import { History, MapPin } from 'lucide-react';
import { Card, EmptyState } from './shared';
import { tripOrders } from '../../services/api';
import { formatDateTime } from '../../constants/trip';

// The trip's own history: status changes, events, stop arrivals and the POD,
// merged into one ordered narrative.
//
// The merge happens on the server so the ordering is decided once, and so this
// tab does not have to reconcile four arrays whose timestamps come from
// different places. This is the trip's story; the account-wide audit log in
// Settings is the separate record of who changed what.
const KIND_STYLES = {
  status: { dot: 'bg-blue-500', label: 'Status' },
  event: { dot: 'bg-amber-500', label: 'Event' },
  stop: { dot: 'bg-indigo-500', label: 'Stop' },
  pod: { dot: 'bg-green-500', label: 'POD' },
};

export function TripActivityTab({ tripId }) {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await tripOrders.timeline(tripId);
        if (!cancelled) setTimeline(res.timeline || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load the activity history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tripId]);

  if (loading) return <p className="text-slate-500">Loading activity...</p>;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card title="Activity History">
        {timeline.length === 0 ? (
          <EmptyState icon={History} title="Nothing recorded yet" />
        ) : (
          <ol className="relative space-y-6">
            {/* The rail the markers sit on. Purely decorative, so it is hidden
                from assistive tech rather than read out as content. */}
            <span
              aria-hidden="true"
              className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200"
            />

            {timeline.map((entry, i) => {
              const style = KIND_STYLES[entry.kind] || KIND_STYLES.event;
              return (
                <li key={i} className="relative pl-8">
                  <span
                    className={`absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full border-2 border-white ${style.dot}`}
                  />
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{entry.title}</p>
                      {entry.detail && (
                        <p className="text-sm text-slate-600 mt-0.5">{entry.detail}</p>
                      )}
                      <p className="text-xs text-slate-500 mt-1">
                        {formatDateTime(entry.at)}
                        {entry.by && <> · {entry.by}</>}
                        {entry.source === 'manual' && <> · recorded by hand</>}
                        {entry.lat != null && entry.lng != null && (
                          <span className="inline-flex items-center gap-1 ml-2">
                            <MapPin className="w-3 h-3" />
                            {entry.lat.toFixed(4)}, {entry.lng.toFixed(4)}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{style.label}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <p className="text-xs text-slate-500">
        This is the trip's own history. Every edit to a trip — who changed a price, who assigned a
        vehicle, who overrode a blocked assignment — is also written to the account audit log under
        Settings.
      </p>
    </div>
  );
}
