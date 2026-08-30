import { useState } from 'react';
import { X, Smartphone, RadioTower, Copy, Check, Loader2, AlertCircle, Cpu, Plus } from 'lucide-react';
import { admin } from '../services/api';

// Same two-step device registration as AddDeviceModal, but for superadmin:
// step 0 picks which client owns the new vehicle, since the admin API needs
// an explicit owner (there's no "caller's own fleet" the way there is for a
// client). The vehicle "name" is one of that client's existing trucks (added
// on Fleet Oversight) rather than free text, so the tracking device always
// lines up with a real truck number instead of drifting from it.
//
// Two ways in, because a unit usually reaches the platform before it reaches a
// truck: it is added to the Device Master when it is bought, then fitted later.
//   'existing' — pick a spare from the master and fit it. No gateway round-trip
//                and no setup panel: the unit is already registered, so this
//                only records which truck it now sits in.
//   'new'      — register a unit that is not in the master yet, exactly as
//                before, ending on the configure-the-device panel.
export function AdminAddDeviceModal({ clients, trucks, devices = [], onClose, onRegistered }) {
  const [mode, setMode] = useState('existing');
  const [owner, setOwner] = useState('');
  const [truckId, setTruckId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [type, setType] = useState('phone');
  const [customId, setCustomId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [setup, setSetup] = useState(null);
  const [copied, setCopied] = useState(null);

  const ownerTrucks = trucks.filter((t) => (t.owner?._id || t.owner) === owner);
  const selectedTruck = ownerTrucks.find((t) => (t._id || t.id) === truckId);

  // Spares: this client's devices that are not fitted to a truck yet. A device
  // already on a truck is left out — moving one between trucks is a Device
  // Master edit, not something to do by accident from the map screen.
  const spareDevices = devices.filter(
    (d) => (d.owner?._id || d.owner) === owner && !d.vehicle
  );

  const isExisting = mode === 'existing';
  const isHardware = type === 'hardware';
  const canSubmit =
    owner && truckId && !busy && (isExisting ? Boolean(deviceId) : !isHardware || customId.trim());

  const changeOwner = (value) => {
    setOwner(value);
    // Both belong to the previously chosen client.
    setTruckId('');
    setDeviceId('');
  };

  const changeMode = (value) => {
    setMode(value);
    setError(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit || !selectedTruck) return;

    setBusy(true);
    setError(null);
    try {
      if (isExisting) {
        // Already registered in the gateway — this only records the fitment,
        // so there is no setup block to show and the modal can just close.
        const res = await admin.updateDevice(deviceId, { vehicle: truckId });
        onRegistered?.(res.device);
        onClose();
      } else {
        const res = await admin.createDevice(owner, selectedTruck.number, customId.trim() || undefined, type);
        setSetup(res.setup);
        onRegistered?.(res.device);
      }
    } catch (err) {
      setError(err.message || 'Could not add the vehicle');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (value, key) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  };

  const setupIsHardware = setup?.type === 'hardware';

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900">
            {!setup
              ? 'Add a vehicle for a client'
              : setupIsHardware
                ? 'Set up the GPS device'
                : 'Set up the phone'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!setup && (
          <form onSubmit={submit} className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
              {[
                ['existing', Cpu, 'Existing device'],
                ['new', Plus, 'Register new'],
              ].map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => changeMode(value)}
                  className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                    mode === value
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Client (owner)
              </label>
              <select
                value={owner}
                onChange={(e) => changeOwner(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              >
                <option value="">Select a client...</option>
                {clients.map((c) => (
                  <option key={c._id || c.id} value={c._id || c.id}>
                    {c.company} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            {!isExisting && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Tracking device
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('phone')}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      !isHardware
                        ? 'border-sky-500 bg-sky-50 text-sky-700'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Smartphone className="h-4 w-4" />
                    Phone app
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('hardware')}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      isHardware
                        ? 'border-sky-500 bg-sky-50 text-sky-700'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <RadioTower className="h-4 w-4" />
                    GPS device
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Truck
              </label>
              <select
                value={truckId}
                onChange={(e) => setTruckId(e.target.value)}
                disabled={!owner}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">
                  {owner ? 'Select a truck...' : 'Pick a client first'}
                </option>
                {ownerTrucks.map((t) => (
                  <option key={t._id || t.id} value={t._id || t.id}>
                    {t.number} — {t.model}
                  </option>
                ))}
              </select>
              {owner && ownerTrucks.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  This client has no trucks yet — add one on Fleet Oversight first.
                </p>
              )}
            </div>

            {isExisting && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Device
                </label>
                <select
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  disabled={!owner}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">
                    {owner ? 'Select a device...' : 'Pick a client first'}
                  </option>
                  {spareDevices.map((d) => {
                    const id = d._id || d.id;
                    return (
                      <option key={id} value={id}>
                        {d.name}
                        {d.imei || d.uniqueId ? ` — ${d.imei || d.uniqueId}` : ''}
                        {d.model ? ` (${d.model})` : ''}
                      </option>
                    );
                  })}
                </select>
                {owner && spareDevices.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">
                    No spare devices for this client — every one is already fitted to a truck.
                    Register a new one, or add it on Device Master first.
                  </p>
                )}
              </div>
            )}

            {!isExisting && (isHardware ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  IMEI
                </label>
                <input
                  value={customId}
                  onChange={(e) => setCustomId(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  placeholder="353201359881965"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
                <p className="mt-1 text-xs text-slate-500">
                  The 15-digit number printed on the device (and shown on its config screen). This
                  is the device's fixed identity — it can't be changed.
                </p>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Device ID <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  value={customId}
                  onChange={(e) => setCustomId(e.target.value)}
                  placeholder="Leave blank to generate one"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
                <p className="mt-1 text-xs text-slate-500">
                  This is typed into the phone app. Use the number plate if you like — it must be unique.
                </p>
              </div>
            ))}

            {error && (
              <div className="flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : isExisting ? <Cpu className="h-4 w-4" />
                : isHardware ? <RadioTower className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
              {busy
                ? (isExisting ? 'Fitting…' : 'Registering…')
                : (isExisting ? 'Fit to truck' : 'Register vehicle')}
            </button>
          </form>
        )}

        {setup && setupIsHardware && (
          <div className="space-y-4 p-4">
            <p className="text-sm text-slate-600">
              On the device's configurator, open <strong>Server Settings</strong> and enter:
            </p>

            {[
              ['Domain', setup.domain, 'domain'],
              ['Port', setup.port, 'port'],
              ['Protocol', setup.protocol, 'protocol'],
              ['IMEI (device ID)', setup.deviceIdentifier, 'id'],
            ].map(([label, value, key]) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  {label}
                </label>
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2">
                  <code className="min-w-0 flex-1 truncate text-sm text-slate-800">{value}</code>
                  <button
                    onClick={() => copy(String(value), key)}
                    className="shrink-0 text-slate-500 hover:text-sky-600"
                  >
                    {copied === key
                      ? <Check className="h-4 w-4 text-green-600" />
                      : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}

            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-medium">Also check on the device:</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                <li>TLS Encryption set to <strong>None</strong></li>
                <li>A working data SIM with the correct <strong>APN</strong></li>
                <li>Save the config to the device, then power-cycle it</li>
              </ul>
            </div>

            <p className="text-xs text-slate-500">
              The vehicle appears on the map within a minute or two of the first GPS fix.
            </p>

            <button
              onClick={onClose}
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        )}

        {setup && !setupIsHardware && (
          <div className="space-y-4 p-4">
            <p className="text-sm text-slate-600">
              Install <strong>Traccar Client</strong> on the phone and enter these two settings:
            </p>

            {[
              ['Server URL', setup.serverUrl, 'url'],
              ['Device identifier', setup.deviceIdentifier, 'id'],
            ].map(([label, value, key]) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  {label}
                </label>
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2">
                  <code className="min-w-0 flex-1 truncate text-sm text-slate-800">{value}</code>
                  <button
                    onClick={() => copy(value, key)}
                    className="shrink-0 text-slate-500 hover:text-sky-600"
                  >
                    {copied === key
                      ? <Check className="h-4 w-4 text-green-600" />
                      : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}

            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-medium">Then, on the phone:</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                <li>Set location accuracy to <strong>High</strong> and frequency to 30s</li>
                <li>Turn <strong>Service status ON</strong></li>
                <li>
                  Set the app's battery usage to <strong>Unrestricted</strong>, or Android stops it
                  when the screen locks
                </li>
              </ul>
            </div>

            <p className="text-xs text-slate-500">
              The vehicle appears on the map within a few seconds of the first GPS fix.
            </p>

            <button
              onClick={onClose}
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
