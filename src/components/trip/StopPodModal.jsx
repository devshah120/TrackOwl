import { useState } from 'react';
import { X, FileSignature } from 'lucide-react';
import { PodForm } from './PodForm';
import { tripOrders } from '../../services/api';

// Proof of delivery for one stop on a multi-drop trip. Uses the same form as
// the trip-level POD, so a drop is signed for exactly the way the whole job is.
//
// Saving a stop POD also completes that stop on the server — capturing a
// signature is the proof the drop happened, and making the operator then tick
// "complete" separately would be a second click for something already proven.
export function StopPodModal({ tripId, stop, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (payload) => {
    setSaving(true);
    setError('');
    try {
      await tripOrders.saveStopPod(tripId, stop._id, payload);
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to save the proof of delivery');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
          <div>
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-blue-600" />
              Proof of Delivery — Stop {stop.sequence}
            </h3>
            <p className="text-sm text-slate-600 mt-0.5">
              {stop.location?.name || stop.location?.city || 'This stop'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <PodForm
            initial={{
              // The stop's own recorded times seed the form, so the operator
              // confirms what the system already knows rather than retyping it.
              arrivedAt: stop.arrivedAt,
              unloadingStartedAt: stop.arrivedAt,
              deliveredQuantity: stop.unloadingQuantity,
            }}
            cargoTotal={0}
            saving={saving}
            onSubmit={save}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}
