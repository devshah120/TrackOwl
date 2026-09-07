import { useState, useEffect } from 'react';
import { Navigation, SatelliteDish, Clock, MapPin } from 'lucide-react';
import { Card, Detail, EmptyState } from './shared';
import { tripOrders, trips as tripsApi } from '../../services/api';
import { formatNumber, formatDateTime, formatDuration } from '../../constants/trip';

// Live tracking for the trip.
//
// The important rule here is that nothing is invented. When there is no tracker
// on the vehicle, or no route being followed, this says exactly that and stops.
// A blank map with a plausible-looking marker would be worse than an honest
// "not available" — an operator would act on it.
//
// The trail itself comes from the existing /api/trips/:id/trail endpoint, which
// already handles windowing to the trip's own lifetime, thinning long journeys
// and detecting where the vehicle stood still. This tab points at it rather
// than reimplementing any of that.
export function TripTrackingTab({ tripId }) {
  const [tracking, setTracking] = useState(null);
  const [trail, setTrail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await tripOrders.tracking(tripId);
        if (cancelled) return;
        setTracking(res);

        // Only fetch the trail when the server says there is one to fetch.
        if (res.available && res.routeId) {
          try {
            const t = await tripsApi.getTrail(res.routeId);
            if (!cancelled) setTrail(t);
          } catch {
            // The trail is an enrichment; losing it should not blank the tab.
            if (!cancelled) setTrail(null);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load tracking');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tripId]);

  if (loading) return <p className="text-slate-500">Loading tracking...</p>;
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
        {error}
      </div>
    );
  }

  const variance = tracking?.variance || {};

  return (
    <div className="space-y-6">
      {!tracking?.available ? (
        <Card>
          <EmptyState
            icon={SatelliteDish}
            title="Live tracking is not available for this trip"
            hint={tracking?.reason}
          />
          <p className="text-sm text-slate-500 text-center max-w-xl mx-auto">
            The planned distance and time below still apply. Actual figures are measured from the
            odometer readings taken when the trip starts and ends, so they do not depend on GPS.
          </p>
        </Card>
      ) : (
        <>
          <Card title="Route">
            <p className="text-sm text-slate-600 mb-4">
              This trip is following a tracked route. The full map and the driven path are on the
              Trip Routes screen, which draws the planned route alongside the live vehicle.
            </p>
            <a
              href="/trip-routes"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Navigation className="w-4 h-4" />
              Open on the map
            </a>
          </Card>

          {trail && (
            <Card title="Driven Path">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Detail
                  label="Points Recorded"
                  value={trail.diagnostics?.fixCount ? formatNumber(trail.diagnostics.fixCount) : null}
                />
                <Detail
                  label="First Fix"
                  value={trail.startedAt ? formatDateTime(trail.startedAt) : null}
                />
                <Detail
                  label="Last Fix"
                  value={trail.endedAt ? formatDateTime(trail.endedAt) : null}
                />
                <Detail
                  label="Stops Detected"
                  value={trail.stops?.length ?? null}
                />
              </div>

              {/* Untracked time is reported separately from stops, exactly as
                  the API sends it: a gap in coverage is not an observation that
                  the vehicle was stationary, and presenting it as one would be
                  a guess. */}
              {trail.coverage?.untrackedMs > 0 && (
                <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
                  <p className="font-medium">
                    {formatDuration(Math.round(trail.coverage.untrackedMs / 60000))} of this trip was
                    not tracked.
                  </p>
                  <p className="mt-1">
                    The tracker reported nothing during that time, so what the vehicle was doing is
                    unknown. This is not counted as a stop.
                  </p>
                </div>
              )}

              {trail.stops?.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-slate-700 mb-2">Where it stood still</p>
                  <ul className="space-y-2">
                    {trail.stops.map((stop, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <span className="text-slate-700">
                          {stop.address || `${stop.lat?.toFixed(4)}, ${stop.lng?.toFixed(4)}`}
                          {stop.durationMs && (
                            <span className="text-slate-500">
                              {' — '}
                              {formatDuration(Math.round(stop.durationMs / 60000))}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      <Card title="ETA">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Detail
            label="Planned Arrival"
            value={
              tracking?.eta?.plannedArrival ? formatDateTime(tracking.eta.plannedArrival) : null
            }
          />
          <Detail
            label="Estimated Arrival"
            value={tracking?.eta?.estimatedArrival ? formatDateTime(tracking.eta.estimatedArrival) : null}
          />
          <Detail label="Source" value={tracking?.eta?.source === 'planned' ? 'Schedule' : null} />
        </div>
        {tracking?.eta?.note && (
          <p className="text-sm text-slate-500 mt-4 flex items-start gap-2">
            <Clock className="w-4 h-4 shrink-0 mt-0.5" />
            {tracking.eta.note}. The planned arrival above is the schedule, not a prediction.
          </p>
        )}
      </Card>

      <Card title="Planned vs Actual">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Detail
            label="Planned Distance"
            value={variance.plannedKm != null ? `${formatNumber(variance.plannedKm)} km` : null}
          />
          <Detail
            label="Actual Distance"
            value={variance.actualKm != null ? `${formatNumber(variance.actualKm)} km` : null}
          />
          <Detail
            label="Deviation"
            value={
              variance.kmDeviation != null
                ? `${variance.kmDeviation > 0 ? '+' : ''}${formatNumber(variance.kmDeviation)} km`
                : null
            }
          />
          <Detail
            label="Average Speed"
            value={
              variance.averageSpeedKmph != null
                ? `${formatNumber(variance.averageSpeedKmph)} km/h`
                : null
            }
          />
        </div>
      </Card>
    </div>
  );
}
