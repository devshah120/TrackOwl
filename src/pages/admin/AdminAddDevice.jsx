import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Smartphone, RadioTower, Copy, Check } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Topbar } from '../../components/Topbar';
import { admin } from '../../services/api';
import { DEVICE_LIFECYCLE_STATUSES, SIM_PROVIDERS, toDateInput } from '../../constants/device';

// Add / edit one tracking unit, as a full page rather than a dialog — the
// device master carries four sections of fields, which is more than a modal
// can show without its own scrollbar. Mirrors AddNewTruck: same back-button
// header, same white section cards, same footer actions, so the two masters
// are edited the same way.

// Every field wears the same box; naming it keeps four sections of markup
// readable.
const inputClass =
  'w-full px-4 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500';

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
    <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
    {children}
    {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
  </div>
);

const Section = ({ title, children }) => (
  <div className="bg-white rounded-lg border border-slate-200 p-6">
    <h2 className="text-lg font-semibold text-slate-900 mb-4">{title}</h2>
    {children}
  </div>
);

export function AdminAddDevice() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [form, setForm] = useState(emptyForm);
  const [clients, setClients] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [devices, setDevices] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Set once a new unit is registered: the gateway settings to type into it.
  // Editing an existing device never produces one.
  const [setup, setSetup] = useState(null);
  const [copied, setCopied] = useState(null);

  const isHardware = form.deviceType === 'hardware';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [usersRes, trucksRes, devicesRes] = await Promise.all([
          admin.listUsers(),
          admin.listTrucks(),
          admin.listDevices(),
        ]);
        if (cancelled) return;
        setClients(usersRes.users || []);
        setTrucks(trucksRes.trucks || []);
        setDevices(devicesRes.devices || []);

        if (isEditing) {
          const device = (devicesRes.devices || []).find((d) => (d._id || d.id) === id);
          if (device) setForm(formFromDevice(device));
          else setError('That device no longer exists.');
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load device');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isEditing]);

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
    // The previously chosen truck belongs to a different client.
    setForm((prev) => ({ ...prev, owner: e.target.value, vehicle: '' }));
  };

  const changeType = (deviceType) =>
    setForm((prev) => ({ ...prev, deviceType, uniqueId: '', imei: '' }));

  // For hardware the IMEI is the gateway identity, so the two fields are one:
  // typing the IMEI fills the device id too.
  const changeImei = (e) => {
    const imei = e.target.value.replace(/\D/g, '');
    setForm((prev) => ({ ...prev, imei, ...(isHardware && !isEditing ? { uniqueId: imei } : {}) }));
  };

  const cancel = () => navigate('/admin/devices');

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.owner) return setError('Select the client this device belongs to');
    if (!form.name.trim()) return setError('Give the device a name');
    if (form.imei && !/^\d{15,17}$/.test(form.imei)) return setError('IMEI must be 15-17 digits');
    if (!isEditing && isHardware && !/^\d{15,17}$/.test(form.imei)) {
      return setError('A GPS device needs a valid IMEI (15-17 digits)');
    }

    setSubmitting(true);
    try {
      if (isEditing) {
        await admin.updateDevice(id, {
          owner: form.owner,
          name: form.name.trim(),
          ...masterPayload(form),
        });
        navigate('/admin/devices');
      } else {
        const res = await admin.createDevice(
          form.owner,
          form.name.trim(),
          (isHardware ? form.imei : form.uniqueId.trim()) || undefined,
          form.deviceType,
          masterPayload(form)
        );
        // Stay on the page to show the gateway settings — the operator still
        // has to configure the physical unit before it will report.
        setSetup(res.setup);
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
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full max-w-6xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <button
              onClick={cancel}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                {setup ? 'Set up the device' : isEditing ? 'Edit Device' : 'Add New Device'}
              </h1>
              <p className="text-slate-600 mt-1">
                {setup
                  ? 'Enter these settings on the unit so it starts reporting'
                  : isEditing
                    ? 'Update this tracking unit'
                    : 'Register a tracking unit and fit it to a vehicle'}
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {setup ? (
            <div className="space-y-6">
              <Section title={setup.type === 'hardware' ? 'Server settings' : 'Traccar Client settings'}>
                <p className="text-sm text-slate-600 mb-4">
                  {setup.type === 'hardware'
                    ? "On the device's configurator, open Server Settings and enter:"
                    : 'Install Traccar Client on the phone and enter these two settings:'}
                </p>
                <div className="space-y-4">
                  {setupRows.map(([label, value, key]) => (
                    <div key={key}>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                        {label}
                      </label>
                      <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2">
                        <code className="min-w-0 flex-1 truncate text-sm text-slate-800">{value}</code>
                        <button
                          onClick={() => copy(value, key)}
                          className="shrink-0 text-slate-500 hover:text-blue-600"
                        >
                          {copied === key ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
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
              </Section>

              <button
                onClick={() => navigate('/admin/devices')}
                className="w-full px-4 py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-6">
              <Section title="Identity">
                <div className="grid grid-cols-2 gap-4">
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

                  <Field
                    label="Device name"
                    hint="How the unit is labelled on the map, e.g. the truck number."
                  >
                    <input value={form.name} onChange={change('name')} className={inputClass} />
                  </Field>
                </div>

                <div className="mt-4">
                  <Field label="Unit type">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ['hardware', RadioTower, 'GPS device'],
                        ['phone', Smartphone, 'Phone app'],
                      ].map(([value, Icon, label]) => (
                        <button
                          key={value}
                          type="button"
                          disabled={isEditing}
                          onClick={() => changeType(value)}
                          className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            form.deviceType === value
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Field
                    label="IMEI"
                    hint={
                      isHardware
                        ? "The 15-digit number printed on the unit. It is the device's fixed identity in the gateway."
                        : "The handset's IMEI, for your records. The phone is identified by its device ID."
                    }
                  >
                    <input
                      value={form.imei}
                      onChange={changeImei}
                      inputMode="numeric"
                      placeholder="353201359881965"
                      disabled={isEditing && isHardware}
                      className={inputClass}
                    />
                  </Field>

                  {isHardware ? (
                    <Field label="Device ID (gateway)" hint="Fixed once registered — it is the IMEI.">
                      <input value={form.uniqueId || form.imei} disabled className={inputClass} />
                    </Field>
                  ) : (
                    <Field
                      label={isEditing ? 'Device ID (gateway)' : 'Device ID (optional)'}
                      hint={
                        isEditing
                          ? 'Fixed once registered.'
                          : 'Typed into the phone app. Leave blank to generate one.'
                      }
                    >
                      <input
                        value={form.uniqueId}
                        onChange={change('uniqueId')}
                        disabled={isEditing}
                        placeholder="Leave blank to generate one"
                        className={inputClass}
                      />
                    </Field>
                  )}
                </div>
              </Section>

              <Section title="Hardware">
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Model">
                    <input
                      value={form.model}
                      onChange={change('model')}
                      placeholder="FMB920"
                      className={inputClass}
                    />
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
              </Section>

              <Section title="SIM">
                <div className="grid grid-cols-2 gap-4">
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
                    <input
                      type="date"
                      value={form.simValidTill}
                      onChange={change('simValidTill')}
                      className={inputClass}
                    />
                  </Field>
                </div>
              </Section>

              <Section title="Fitment">
                <div className="grid grid-cols-2 gap-4">
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
                        const truckId = String(t._id || t.id);
                        const fitted = deviceOnTruck.get(truckId);
                        const takenByOther = fitted && String(fitted._id || fitted.id) !== String(id);
                        return (
                          <option key={truckId} value={truckId} disabled={takenByOther}>
                            {t.number} — {t.model}
                            {takenByOther ? ` (fitted with ${fitted.name})` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </Field>

                  <Field label="Status">
                    <select
                      value={form.lifecycleStatus}
                      onChange={change('lifecycleStatus')}
                      className={inputClass}
                    >
                      {DEVICE_LIFECYCLE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Install date">
                    <input
                      type="date"
                      value={form.installedAt}
                      onChange={change('installedAt')}
                      className={inputClass}
                    />
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

                <div className="mt-4">
                  <Field label="Notes">
                    <textarea rows={3} value={form.notes} onChange={change('notes')} className={inputClass} />
                  </Field>
                </div>
              </Section>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={cancel}
                  className="flex-1 px-4 py-3 border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Device'}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
