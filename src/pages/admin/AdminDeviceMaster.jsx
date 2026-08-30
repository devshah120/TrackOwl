import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Edit2, Trash2, X, Cpu, Smartphone, RadioTower, Copy, Check, AlertCircle } from 'lucide-react';
import { Topbar } from '../../components/Topbar';
import { admin } from '../../services/api';
import {
  DEVICE_LIFECYCLE_STATUSES,
  SIM_PROVIDERS,
  getLifecycleColor,
  getTelemetryColor,
  formatDate,
  toDateInput,
} from '../../constants/device';

// The device master: the tracking hardware itself, as an asset register.
// Fleet Oversight answers "what vehicles exist"; this answers "what units are
// fitted to them, with which SIM, since when, on what firmware" — the record an
// operator needs when a truck stops reporting and someone has to work out
// whether it is the box, the SIM or the vehicle.

const emptyForm = {
  owner: '',
  name: '',
  deviceType: 'hardware',
  uniqueId: '',
  imei: '',
  model: '',
  manufacturer: '',
  firmwareVersion: '',
  simNumber: '',
  simIccid: '',
  simProvider: '',
  simPlan: '',
  simValidTill: '',
  vehicle: '',
  installedAt: '',
  installedBy: '',
  lifecycleStatus: 'Active',
  notes: '',
};

const formFromDevice = (device) => ({
  owner: device.owner?._id || device.owner || '',
  name: device.name || '',
  deviceType: device.deviceType || 'hardware',
  uniqueId: device.uniqueId || '',
  imei: device.imei || '',
  model: device.model || '',
  manufacturer: device.manufacturer || '',
  firmwareVersion: device.firmwareVersion || '',
  simNumber: device.sim?.number || '',
  simIccid: device.sim?.iccid || '',
  simProvider: device.sim?.provider || '',
  simPlan: device.sim?.plan || '',
  simValidTill: toDateInput(device.sim?.validTill),
  vehicle: device.vehicle?._id || device.vehicle || '',
  installedAt: toDateInput(device.installedAt),
  installedBy: device.installedBy || '',
  lifecycleStatus: device.lifecycleStatus || 'Active',
  notes: device.notes || '',
});

// The master fields, shaped for the API. Shared by create and edit so the two
// paths cannot drift on what a SIM or an install date looks like on the wire.
const masterPayload = (form) => ({
  imei: form.imei.trim(),
  model: form.model.trim(),
  manufacturer: form.manufacturer.trim(),
  firmwareVersion: form.firmwareVersion.trim(),
  sim: {
    number: form.simNumber.trim(),
    iccid: form.simIccid.trim(),
    provider: form.simProvider.trim(),
    plan: form.simPlan.trim(),
    validTill: form.simValidTill || null,
  },
  vehicle: form.vehicle || null,
  installedAt: form.installedAt || null,
  installedBy: form.installedBy.trim(),
  lifecycleStatus: form.lifecycleStatus,
  notes: form.notes.trim(),
});

const Field = ({ label, hint, children }) => (
  <div>
    <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
    {children}
    {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
  </div>
);

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500';

function DeviceModal({ clients, trucks, devices, editingDevice, onClose, onSaved }) {
  const [form, setForm] = useState(() => (editingDevice ? formFromDevice(editingDevice) : emptyForm));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Set once a new device is registered: the gateway settings to type into the
  // unit. Editing an existing device never produces one.
  const [setup, setSetup] = useState(null);
  const [copied, setCopied] = useState(null);

  const isEdit = Boolean(editingDevice);
  const isHardware = form.deviceType === 'hardware';

  const change = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  // Only the owner's own trucks can be fitted, and a truck already carrying a
  // different device is shown as taken rather than hidden — an operator moving
  // a unit between trucks needs to see why the slot is unavailable.
  const ownerTrucks = trucks.filter((t) => (t.owner?._id || t.owner) === form.owner);
  const deviceOnTruck = useMemo(() => {
    const map = new Map();
    devices.forEach((d) => {
      const truckId = d.vehicle?._id || d.vehicle;
      if (truckId) map.set(String(truckId), d);
    });
    return map;
  }, [devices]);

  const changeOwner = (e) => {
    const owner = e.target.value;
    // The previously chosen truck belongs to a different client.
    setForm((prev) => ({ ...prev, owner, vehicle: '' }));
  };

  const changeType = (deviceType) =>
    setForm((prev) => ({ ...prev, deviceType, uniqueId: '', imei: '' }));

  // For hardware the IMEI is the gateway identity, so the two fields are one:
  // typing the IMEI fills the device id and vice versa.
  const changeImei = (e) => {
    const imei = e.target.value.replace(/\D/g, '');
    setForm((prev) => ({ ...prev, imei, ...(isHardware && !isEdit ? { uniqueId: imei } : {}) }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.owner) return setError('Select the client this device belongs to');
    if (!form.name.trim()) return setError('Give the device a name');
    if (form.imei && !/^\d{15,17}$/.test(form.imei)) return setError('IMEI must be 15-17 digits');
    if (!isEdit && isHardware && !/^\d{15,17}$/.test(form.imei)) {
      return setError('A GPS device needs a valid IMEI (15-17 digits)');
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        await admin.updateDevice(editingDevice._id || editingDevice.id, {
          owner: form.owner,
          name: form.name.trim(),
          ...masterPayload(form),
        });
        onSaved();
      } else {
        const res = await admin.createDevice(
          form.owner,
          form.name.trim(),
          (isHardware ? form.imei : form.uniqueId.trim()) || undefined,
          form.deviceType,
          masterPayload(form)
        );
        // Keep the modal open on the setup panel — the operator still has to
        // configure the physical unit — and refresh the table behind it.
        setSetup(res.setup);
        onSaved({ keepOpen: true });
      }
    } catch (err) {
      setError(err.message || 'Failed to save device');
    } finally {
      setSubmitting(false);
    }
  };

  const copy = async (value, key) => {
    await navigator.clipboard.writeText(String(value));
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  };

  const setupRows =
    setup?.type === 'hardware'
      ? [
          ['Domain', setup.domain, 'domain'],
          ['Port', setup.port, 'port'],
          ['Protocol', setup.protocol, 'protocol'],
          ['IMEI (device ID)', setup.deviceIdentifier, 'id'],
        ]
      : [
          ['Server URL', setup?.serverUrl, 'url'],
          ['Device identifier', setup?.deviceIdentifier, 'id'],
        ];

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {setup ? 'Set up the device' : isEdit ? 'Edit Device' : 'Add Device'}
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {setup ? (
          <div className="space-y-4 p-6">
            <p className="text-sm text-slate-600">
              {setup.type === 'hardware'
                ? 'On the device configurator, open Server Settings and enter:'
                : 'Install Traccar Client on the phone and enter these two settings:'}
            </p>

            {setupRows.map(([label, value, key]) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  {label}
                </label>
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2">
                  <code className="min-w-0 flex-1 truncate text-sm text-slate-800">{value}</code>
                  <button onClick={() => copy(value, key)} className="shrink-0 text-slate-500 hover:text-blue-600">
                    {copied === key ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}

            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              {setup.type === 'hardware' ? (
                <>
                  <p className="font-medium">Also check on the device:</p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    <li>TLS Encryption set to <strong>None</strong></li>
                    <li>A working data SIM with the correct <strong>APN</strong></li>
                    <li>Save the config to the device, then power-cycle it</li>
                  </ul>
                </>
              ) : (
                <>
                  <p className="font-medium">Then, on the phone:</p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    <li>Set location accuracy to <strong>High</strong> and frequency to 30s</li>
                    <li>Turn <strong>Service status ON</strong></li>
                    <li>Set battery usage to <strong>Unrestricted</strong></li>
                  </ul>
                </>
              )}
            </div>

            <button
              onClick={onClose}
              className="w-full rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5 p-6">
            {error && (
              <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* --- Identity --- */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">Identity</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Client (owner)">
                  <select value={form.owner} onChange={changeOwner} className={inputClass}>
                    <option value="">Select a client...</option>
                    {clients.map((c) => (
                      <option key={c._id || c.id} value={c._id || c.id}>
                        {c.company} — {c.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Device name" hint="How the unit is labelled on the map, e.g. the truck number.">
                  <input value={form.name} onChange={change('name')} className={inputClass} />
                </Field>
              </div>

              <Field label="Unit type">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['hardware', RadioTower, 'GPS device'],
                    ['phone', Smartphone, 'Phone app'],
                  ].map(([value, Icon, label]) => (
                    <button
                      key={value}
                      type="button"
                      disabled={isEdit}
                      onClick={() => changeType(value)}
                      className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        form.deviceType === value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="IMEI"
                  hint={
                    isHardware
                      ? "The 15-digit number printed on the unit. It is the device's fixed identity in the gateway."
                      : "The handset's IMEI, for your records. The phone is identified by its device ID below."
                  }
                >
                  <input
                    value={form.imei}
                    onChange={changeImei}
                    inputMode="numeric"
                    placeholder="353201359881965"
                    disabled={isEdit && isHardware}
                    className={inputClass}
                  />
                </Field>

                {isHardware ? (
                  <Field label="Device ID (gateway)" hint="Fixed once registered — it is the IMEI.">
                    <input value={form.uniqueId || form.imei} disabled className={inputClass} />
                  </Field>
                ) : (
                  <Field
                    label={isEdit ? 'Device ID (gateway)' : 'Device ID (optional)'}
                    hint={isEdit ? 'Fixed once registered.' : 'Typed into the phone app. Leave blank to generate one.'}
                  >
                    <input
                      value={form.uniqueId}
                      onChange={change('uniqueId')}
                      disabled={isEdit}
                      placeholder="Leave blank to generate one"
                      className={inputClass}
                    />
                  </Field>
                )}
              </div>
            </div>

            {/* --- Hardware --- */}
            <div className="space-y-4 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-900">Hardware</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Model">
                  <input value={form.model} onChange={change('model')} placeholder="FMB920" className={inputClass} />
                </Field>
                <Field label="Manufacturer">
                  <input
                    value={form.manufacturer}
                    onChange={change('manufacturer')}
                    placeholder="Teltonika"
                    className={inputClass}
                  />
                </Field>
                <Field label="Firmware version">
                  <input
                    value={form.firmwareVersion}
                    onChange={change('firmwareVersion')}
                    placeholder="03.27.07"
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>

            {/* --- SIM --- */}
            <div className="space-y-4 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-900">SIM</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="SIM number">
                  <input
                    value={form.simNumber}
                    onChange={change('simNumber')}
                    placeholder="9876543210"
                    className={inputClass}
                  />
                </Field>
                <Field label="Provider">
                  <input
                    list="device-sim-providers"
                    value={form.simProvider}
                    onChange={change('simProvider')}
                    placeholder="Airtel"
                    className={inputClass}
                  />
                  <datalist id="device-sim-providers">
                    {SIM_PROVIDERS.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </Field>
                <Field label="ICCID" hint="The long number printed on the SIM itself.">
                  <input value={form.simIccid} onChange={change('simIccid')} className={inputClass} />
                </Field>
                <Field label="Plan">
                  <input
                    value={form.simPlan}
                    onChange={change('simPlan')}
                    placeholder="M2M 1GB / year"
                    className={inputClass}
                  />
                </Field>
                <Field label="Valid till">
                  <input type="date" value={form.simValidTill} onChange={change('simValidTill')} className={inputClass} />
                </Field>
              </div>
            </div>

            {/* --- Fitment --- */}
            <div className="space-y-4 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-900">Fitment</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Vehicle"
                  hint={
                    form.owner && ownerTrucks.length === 0
                      ? 'This client has no trucks yet — add one on Fleet Oversight first.'
                      : 'The truck this unit is fitted to. Leave unassigned for a spare.'
                  }
                >
                  <select
                    value={form.vehicle}
                    onChange={change('vehicle')}
                    disabled={!form.owner}
                    className={inputClass}
                  >
                    <option value="">{form.owner ? 'Not fitted' : 'Pick a client first'}</option>
                    {ownerTrucks.map((t) => {
                      const id = String(t._id || t.id);
                      const fitted = deviceOnTruck.get(id);
                      const takenByOther =
                        fitted && String(fitted._id || fitted.id) !== String(editingDevice?._id || editingDevice?.id);
                      return (
                        <option key={id} value={id} disabled={takenByOther}>
                          {t.number} — {t.model}
                          {takenByOther ? ` (fitted with ${fitted.name})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </Field>

                <Field label="Status">
                  <select value={form.lifecycleStatus} onChange={change('lifecycleStatus')} className={inputClass}>
                    {DEVICE_LIFECYCLE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Install date">
                  <input type="date" value={form.installedAt} onChange={change('installedAt')} className={inputClass} />
                </Field>

                <Field label="Installed by">
                  <input
                    value={form.installedBy}
                    onChange={change('installedBy')}
                    placeholder="Technician or vendor"
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Notes">
                <textarea rows={2} value={form.notes} onChange={change('notes')} className={inputClass} />
              </Field>
            </div>

            <div className="flex gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Register Device'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function AdminDeviceMaster() {
  const [devices, setDevices] = useState([]);
  const [clients, setClients] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modal, setModal] = useState(null); // null | 'add' | device being edited

  const load = async () => {
    try {
      const [devicesRes, usersRes, trucksRes] = await Promise.all([
        admin.listDevices(),
        admin.listUsers(),
        admin.listTrucks(),
      ]);
      setDevices(devicesRes.devices || []);
      setClients(usersRes.users || []);
      setTrucks(trucksRes.trucks || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (device) => {
    const id = device._id || device.id;
    if (!confirm(`Remove device ${device.name}? Its vehicle will be left without a tracker.`)) return;
    try {
      await admin.removeDevice(id);
      setDevices((prev) => prev.filter((d) => (d._id || d.id) !== id));
    } catch (err) {
      setError(err.message || 'Failed to remove device');
    }
  };

  const filtered = devices.filter((d) => {
    if (statusFilter !== 'all' && (d.lifecycleStatus || 'Active') !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [
      d.name,
      d.imei,
      d.uniqueId,
      d.model,
      d.manufacturer,
      d.sim?.number,
      d.sim?.provider,
      d.vehicle?.number,
      d.owner?.company,
      d.owner?.name,
    ].some((v) => String(v || '').toLowerCase().includes(q));
  });

  // Headline counts run off the full list, not the filtered one — they describe
  // the estate, and would be circular if they moved with the filter.
  const counts = useMemo(() => {
    const byStatus = devices.reduce((acc, d) => {
      const s = d.lifecycleStatus || 'Active';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
    return {
      total: devices.length,
      active: byStatus.Active || 0,
      unfitted: devices.filter((d) => !d.vehicle).length,
      offline: devices.filter((d) => d.status === 'offline').length,
    };
  }, [devices]);

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <Topbar />
      <main className="flex-1 overflow-y-auto">
        <div className="w-full space-y-6 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Device Master</h1>
              <p className="mt-1 text-slate-600">Every tracking unit, its SIM and the vehicle it is fitted to</p>
            </div>
            <button
              onClick={() => setModal('add')}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Device
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Total devices', counts.total, 'text-slate-900'],
              ['Active', counts.active, 'text-green-600'],
              ['Not fitted', counts.unfitted, 'text-amber-600'],
              ['Offline now', counts.offline, 'text-red-600'],
            ].map(([label, value, tone]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-500">{label}</p>
                <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by IMEI, model, SIM, vehicle, or client..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 sm:w-48"
            >
              <option value="all">All statuses</option>
              {DEVICE_LIFECYCLE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {loading && <div className="py-12 text-center text-slate-500">Loading devices...</div>}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {!loading && (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      {['Device', 'IMEI', 'Model', 'SIM', 'Provider', 'Installed', 'Firmware', 'Vehicle', 'Status', 'Actions'].map(
                        (h) => (
                          <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-slate-900">
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filtered.map((device) => {
                      const id = device._id || device.id;
                      return (
                        <tr key={id} className="align-top transition-colors hover:bg-slate-50">
                          <td className="px-4 py-4 text-sm">
                            <div className="flex items-center gap-2">
                              {device.deviceType === 'phone' ? (
                                <Smartphone className="h-4 w-4 shrink-0 text-slate-400" />
                              ) : (
                                <Cpu className="h-4 w-4 shrink-0 text-slate-400" />
                              )}
                              <div className="min-w-0">
                                <p className="font-medium text-blue-600">{device.name}</p>
                                <p className="text-xs text-slate-500">
                                  {device.owner?.company || 'Unclaimed'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 font-mono text-xs text-slate-700">
                            {device.imei || device.uniqueId || '—'}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            <p>{device.model || '—'}</p>
                            {device.manufacturer && (
                              <p className="text-xs text-slate-500">{device.manufacturer}</p>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                            {device.sim?.number || '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                            <p>{device.sim?.provider || '—'}</p>
                            {device.sim?.validTill && (
                              <p className="text-xs text-slate-500">till {formatDate(device.sim.validTill)}</p>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                            <p>{formatDate(device.installedAt)}</p>
                            {device.installedBy && (
                              <p className="text-xs text-slate-500">by {device.installedBy}</p>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                            {device.firmwareVersion || '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm">
                            {device.vehicle ? (
                              <>
                                <p className="text-slate-900">{device.vehicle.number}</p>
                                <p className="text-xs text-slate-500">{device.vehicle.model}</p>
                              </>
                            ) : (
                              <span className="text-xs text-amber-600">Not fitted</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm">
                            <div className="flex flex-col items-start gap-1">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${getLifecycleColor(
                                  device.lifecycleStatus
                                )}`}
                              >
                                {device.lifecycleStatus || 'Active'}
                              </span>
                              {/* Live telemetry, next to the lifecycle status:
                                  an "Active" unit that is "offline" is exactly
                                  what an operator is looking for. */}
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${getTelemetryColor(
                                  device.status
                                )}`}
                              >
                                {device.status}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setModal(device)}
                                className="rounded p-2 text-slate-600 transition-colors hover:bg-slate-200"
                                title="Edit device"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => remove(device)}
                                className="rounded p-2 text-red-600 transition-colors hover:bg-red-50"
                                title="Remove device"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 && (
                <p className="p-6 text-center text-sm text-slate-500">No devices found.</p>
              )}
            </div>
          )}
        </div>
      </main>

      {modal && (
        <DeviceModal
          clients={clients}
          trucks={trucks}
          devices={devices}
          editingDevice={modal === 'add' ? null : modal}
          onClose={() => {
            setModal(null);
            load();
          }}
          onSaved={(opts) => {
            if (!opts?.keepOpen) setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}
