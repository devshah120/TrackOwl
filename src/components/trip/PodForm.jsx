import { useState, useRef } from 'react';
import { Camera, X } from 'lucide-react';
import { Field, ErrorNote } from './shared';
import { inputClass, readFileAsDataUrl } from './helpers';
import { SignaturePad } from '../SignaturePad';

// The proof-of-delivery form, shared by the trip-level POD and the per-stop one
// so a multi-drop trip signs for each drop exactly the way it signs for the
// whole job.
//
// Shortage and damage are recorded rather than derived: a receiver can sign for
// a short delivery without anyone knowing which cargo line it came out of, and
// the office needs the number they actually wrote down.
export function PodForm({ initial = {}, onSubmit, onCancel, saving, cargoTotal }) {
  const signatureRef = useRef(null);

  const [form, setForm] = useState({
    arrivedAt: toLocalInput(initial.arrivedAt),
    unloadingStartedAt: toLocalInput(initial.unloadingStartedAt),
    unloadingEndedAt: toLocalInput(initial.unloadingEndedAt),
    deliveredQuantity: initial.deliveredQuantity ?? '',
    shortage: initial.shortage ?? '',
    damage: initial.damage ?? '',
    receiverName: initial.receiverName || '',
    receiverPhone: initial.receiverPhone || '',
    remarks: initial.remarks || '',
  });
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState('');

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const pickPhoto = async (file) => {
    if (!file) return;
    setError('');
    try {
      const result = await readFileAsDataUrl(file);
      setPhoto(result.dataUrl);
    } catch (err) {
      setError(err.message || 'Could not read that image');
    }
  };

  const submit = () => {
    setError('');

    const delivered = form.deliveredQuantity === '' ? null : Number(form.deliveredQuantity);
    // Caught here as well as on the server so the operator is told before the
    // round trip; the server check is the one that actually protects the data.
    if (cargoTotal > 0 && delivered !== null && delivered > cargoTotal) {
      setError(`The delivered quantity cannot be more than the ${cargoTotal} loaded`);
      return;
    }

    onSubmit({
      ...form,
      deliveredQuantity: delivered,
      shortage: form.shortage === '' ? 0 : Number(form.shortage),
      damage: form.damage === '' ? 0 : Number(form.damage),
      arrivedAt: form.arrivedAt || null,
      unloadingStartedAt: form.unloadingStartedAt || null,
      unloadingEndedAt: form.unloadingEndedAt || null,
      signature: signatureRef.current?.toDataUrl() || '',
      photo: photo || '',
    });
  };

  return (
    <div className="space-y-4">
      <ErrorNote>{error}</ErrorNote>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Arrived At">
          <input
            type="datetime-local"
            value={form.arrivedAt}
            onChange={(e) => set({ arrivedAt: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Unloading Started">
          <input
            type="datetime-local"
            value={form.unloadingStartedAt}
            onChange={(e) => set({ unloadingStartedAt: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Unloading Ended">
          <input
            type="datetime-local"
            value={form.unloadingEndedAt}
            onChange={(e) => set({ unloadingEndedAt: e.target.value })}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field
          label="Delivered Quantity"
          hint={cargoTotal > 0 ? `${cargoTotal} loaded on this trip` : null}
        >
          <input
            type="number"
            min="0"
            value={form.deliveredQuantity}
            onChange={(e) => set({ deliveredQuantity: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Shortage">
          <input
            type="number"
            min="0"
            value={form.shortage}
            onChange={(e) => set({ shortage: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Damage">
          <input
            type="number"
            min="0"
            value={form.damage}
            onChange={(e) => set({ damage: e.target.value })}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Received By">
          <input
            type="text"
            value={form.receiverName}
            onChange={(e) => set({ receiverName: e.target.value })}
            placeholder="Name of the person signing"
            className={inputClass}
          />
        </Field>
        <Field label="Receiver Phone">
          <input
            type="text"
            value={form.receiverPhone}
            onChange={(e) => set({ receiverPhone: e.target.value })}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Remarks">
        <textarea
          rows={2}
          value={form.remarks}
          onChange={(e) => set({ remarks: e.target.value })}
          placeholder="Anything noted at delivery — condition, delays, disputes"
          className={inputClass}
        />
      </Field>

      <Field label="Receiver Signature">
        <SignaturePad ref={signatureRef} height={150} />
      </Field>

      <Field label="Delivery Photo">
        {photo ? (
          <div className="relative inline-block">
            <img
              src={photo}
              alt="Delivery"
              className="max-h-48 rounded-lg border border-slate-200"
            />
            <button
              type="button"
              onClick={() => setPhoto(null)}
              className="absolute top-2 right-2 p-1 bg-white/90 rounded-full hover:bg-white transition-colors"
            >
              <X className="w-4 h-4 text-slate-700" />
            </button>
          </div>
        ) : (
          <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
            <Camera className="w-5 h-5 text-slate-400" />
            <span className="text-sm text-slate-600">Add a photo of the delivery</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => pickPhoto(e.target.files?.[0])}
              className="hidden"
            />
          </label>
        )}
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Proof of Delivery'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function toLocalInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
