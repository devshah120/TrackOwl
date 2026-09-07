import { useState } from 'react';
import { FileSignature, Eye } from 'lucide-react';
import { Card, Detail, EmptyState, ErrorNote } from './shared';
import { PodForm } from './PodForm';
import { tripOrders } from '../../services/api';
import { STOP_STATUS_LABELS, formatDateTime, formatNumber } from '../../constants/trip';

// Trip-level proof of delivery, plus a read-only summary of the per-stop PODs
// captured on the Stops tab. A multi-drop trip signs per drop; this is the
// final signature for the job as a whole.
export function TripPodTab({ trip, data, reload, canEdit }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [media, setMedia] = useState(null);

  const pod = trip.pod || {};
  const hasPod = Boolean(pod.capturedAt || pod.receiverName);
  const cargoTotal = (trip.cargo || []).reduce((s, c) => s + (Number(c.quantity) || 0), 0);

  const save = async (payload) => {
    setSaving(true);
    setError('');
    try {
      await tripOrders.savePod(trip._id, payload);
      setEditing(false);
      await reload();
    } catch (err) {
      setError(err.message || 'Failed to save the proof of delivery');
    } finally {
      setSaving(false);
    }
  };

  // Signature and photo are not in the detail payload — they would add
  // megabytes to every page load — so they are fetched when actually viewed.
  const viewMedia = async () => {
    try {
      const res = await tripOrders.getPodMedia(trip._id);
      setMedia(res);
    } catch (err) {
      setError(err.message || 'Could not load the signature');
    }
  };

  const stopsWithPod = (trip.stops || []).filter(
    (s) => s.pod?.receiverName || s.pod?.hasSignature || s.pod?.capturedAt
  );

  return (
    <div className="space-y-6">
      <ErrorNote>{error}</ErrorNote>

      <Card
        title="Proof of Delivery"
        action={
          canEdit && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <FileSignature className="w-4 h-4" />
              {hasPod ? 'Update POD' : 'Capture POD'}
            </button>
          )
        }
      >
        {editing ? (
          <PodForm
            initial={pod}
            cargoTotal={cargoTotal}
            saving={saving}
            onSubmit={save}
            onCancel={() => setEditing(false)}
          />
        ) : hasPod ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Detail label="Received By" value={pod.receiverName} />
              <Detail label="Receiver Phone" value={pod.receiverPhone} />
              <Detail label="Captured" value={pod.capturedAt ? formatDateTime(pod.capturedAt) : null} />
              <Detail label="Arrived" value={pod.arrivedAt ? formatDateTime(pod.arrivedAt) : null} />
              <Detail
                label="Unloading Started"
                value={pod.unloadingStartedAt ? formatDateTime(pod.unloadingStartedAt) : null}
              />
              <Detail
                label="Unloading Ended"
                value={pod.unloadingEndedAt ? formatDateTime(pod.unloadingEndedAt) : null}
              />
              <Detail
                label="Delivered Quantity"
                value={pod.deliveredQuantity != null ? formatNumber(pod.deliveredQuantity) : null}
              />
              <Detail
                label="Loaded Quantity"
                value={cargoTotal ? formatNumber(cargoTotal) : null}
              />
            </div>

            {/* A shortage or damage is the exception that costs money, so it is
                given its own emphasis rather than being one number among eight. */}
            {(pod.shortage > 0 || pod.damage > 0) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <p className="text-sm font-medium text-amber-800">Discrepancy recorded</p>
                <div className="flex gap-6 mt-2 text-sm text-amber-900">
                  {pod.shortage > 0 && <span>Shortage: {formatNumber(pod.shortage)}</span>}
                  {pod.damage > 0 && <span>Damage: {formatNumber(pod.damage)}</span>}
                </div>
              </div>
            )}

            {pod.remarks && (
              <div>
                <p className="text-sm text-slate-500 mb-1">Remarks</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{pod.remarks}</p>
              </div>
            )}

            {(data?.podMedia?.hasSignature || data?.podMedia?.hasPhoto) && (
              <div className="pt-4 border-t border-slate-200">
                {media ? (
                  <div className="flex flex-wrap gap-6">
                    {media.signature && (
                      <div>
                        <p className="text-sm text-slate-500 mb-2">Signature</p>
                        <img
                          src={media.signature}
                          alt="Receiver signature"
                          className="max-h-32 border border-slate-200 rounded-lg bg-white p-2"
                        />
                      </div>
                    )}
                    {media.photo && (
                      <div>
                        <p className="text-sm text-slate-500 mb-2">Delivery Photo</p>
                        <img
                          src={media.photo}
                          alt="Delivery"
                          className="max-h-48 border border-slate-200 rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={viewMedia}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    View signature and photo
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            icon={FileSignature}
            title="No proof of delivery yet"
            hint="Capture the receiver's signature and any shortage or damage when the goods are handed over."
          />
        )}
      </Card>

      {stopsWithPod.length > 0 && (
        <Card title={`Stop PODs (${stopsWithPod.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-slate-900">Stop</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-slate-900">Location</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-slate-900">Received By</th>
                  <th className="px-3 py-2 text-right text-sm font-semibold text-slate-900">Delivered</th>
                  <th className="px-3 py-2 text-right text-sm font-semibold text-slate-900">Short / Damaged</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-slate-900">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stopsWithPod.map((stop) => (
                  <tr key={stop._id}>
                    <td className="px-3 py-2 text-sm text-slate-700">{stop.sequence}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">
                      {stop.location?.name || stop.location?.city || '—'}
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-700">
                      {stop.pod?.receiverName || '—'}
                    </td>
                    <td className="px-3 py-2 text-sm text-right text-slate-700">
                      {stop.pod?.deliveredQuantity != null
                        ? formatNumber(stop.pod.deliveredQuantity)
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-sm text-right text-slate-700">
                      {stop.pod?.shortage || 0} / {stop.pod?.damage || 0}
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-600">
                      {STOP_STATUS_LABELS[stop.status] || stop.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Stop PODs are captured on the Stops tab, against the drop they belong to.
          </p>
        </Card>
      )}
    </div>
  );
}
