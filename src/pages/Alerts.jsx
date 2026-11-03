import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bell, CheckCircle2, MapPinned, Plus, Save, Trash2, Undo2 } from 'lucide-react';
import { PageShell, PageHeader, Panel, Banner, Button, Pill, Pager, EmptyState, StatTile } from '../components/business/BusinessUI';
import { formatDateTime, inputClass, SEVERITY_COLORS } from '../components/business/helpers';
import { GeofenceMap } from '../components/GeofenceMap';
import { alerts as alertsApi, fleet as fleetApi, customers as customersApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';

// Alerts & Notifications (brief §10, §4). Three tabs:
//   Alerts      everything the bell has ever shown, filterable, with
//               "acknowledge" for the ones somebody has dealt with
//   Geofences   named areas on the map, assigned to vehicles, with entry /
//               exit / long-stay alerts
//   Settings    the GPS alert thresholds and the document reminder stages
const TABS = [
  { key: 'alerts', label: 'Alerts' },
  { key: 'geofences', label: 'Geofences' },
  { key: 'settings', label: 'Alert Settings' },
];

export function Alerts() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'alerts';
  const [options, setOptions] = useState(null);

  useEffect(() => {
    alertsApi.options().then(setOptions).catch(() => {});
  }, []);

  return (
    <PageShell>
      <PageHeader title="Alerts & Notifications" subtitle="GPS alerts, geofences, document expiry and maintenance reminders" />
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setParams(t.key === 'alerts' ? {} : { tab: t.key })} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'alerts' && <AlertList options={options} />}
      {tab === 'geofences' && <Geofences options={options} />}
      {tab === 'settings' && <AlertSettings />}
    </PageShell>
  );
}

function AlertList({ options }) {
  const [filters, setFilters] = useState({ status: 'open', category: '', severity: '', vehicle: '', page: 1 });
  const [data, setData] = useState({ alerts: [], total: 0, pages: 1, open: 0 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setData(await alertsApi.list(filters));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  const ack = async (a) => {
    try {
      const { alert } = await alertsApi.acknowledge(a._id);
      setData((d) => ({
        ...d,
        open: Math.max(0, d.open - 1),
        alerts: filters.status === 'open' ? d.alerts.filter((x) => x._id !== a._id) : d.alerts.map((x) => (x._id === a._id ? alert : x)),
      }));
    } catch (err) {
      setError(err.message);
    }
  };

  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v, page: 1 }));

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Open alerts" value={data.open} hint="Not yet acknowledged" icon={Bell} bg="bg-red-50" fg="text-red-600" onClick={() => set('status', 'open')} />
        <StatTile label="Shown" value={data.total} hint="Matching the filters" icon={CheckCircle2} />
      </div>
      <div className="bg-white rounded-lg border border-slate-200 p-3 flex flex-wrap gap-3">
        <select value={filters.status} onChange={(e) => set('status', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="unread">Unread</option>
          <option value="">All</option>
        </select>
        <select value={filters.category} onChange={(e) => set('category', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          <option value="">All types</option>
          {(options?.alertCategories || []).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          <option value="maintenance">Maintenance due</option>
        </select>
        <select value={filters.severity} onChange={(e) => set('severity', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          <option value="">Any severity</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <input value={filters.vehicle} onChange={(e) => set('vehicle', e.target.value)} placeholder="Vehicle or driver" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
      </div>
      <Banner message={error} onDismiss={() => setError('')} />
      <Panel>
        <div className="divide-y divide-slate-100">
          {loading && <p className="px-4 py-8 text-center text-sm text-slate-500">Loading alerts…</p>}
          {!loading && data.alerts.length === 0 && <EmptyState icon={CheckCircle2} title="No alerts here" hint="Nothing matches these filters." />}
          {!loading &&
            data.alerts.map((a) => (
              <div key={a._id} className="flex items-start gap-3 px-4 py-3">
                <Pill className={SEVERITY_COLORS[a.severity] || 'bg-slate-100 text-slate-700'}>{a.severity || 'info'}</Pill>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{a.title}</p>
                  <p className="text-sm text-slate-600">{a.message}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatDateTime(a.createdAt)}
                    {a.lat && a.lng ? (
                      <>
                        {' · '}
                        <a href={`https://www.google.com/maps?q=${a.lat},${a.lng}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                          location
                        </a>
                      </>
                    ) : null}
                    {a.acknowledgedAt ? ` · acknowledged by ${a.acknowledgedByName || 'a user'} ${formatDateTime(a.acknowledgedAt)}` : ''}
                  </p>
                </div>
                {!a.acknowledgedAt && (
                  <Button variant="secondary" className="!px-3 !py-1" onClick={() => ack(a)}>
                    Acknowledge
                  </Button>
                )}
              </div>
            ))}
        </div>
        <Pager page={filters.page} pages={data.pages} total={data.total} onPage={(p) => setFilters((f) => ({ ...f, page: p }))} />
      </Panel>
    </>
  );
}

const blankFence = () => ({ name: '', category: 'customer', color: '#2563eb', shape: 'circle', center: null, radiusM: 500, polygon: [], vehicles: [], customer: '', alertOnEntry: true, alertOnExit: true, dwellAlertMinutes: '', active: true, notes: '' });

function Geofences({ options }) {
  const { can } = usePermissions();
  const [fences, setFences] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => alertsApi.geofences().then((r) => setFences(r.geofences || [])).catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
    fleetApi.list().then((r) => setTrucks(r.trucks || [])).catch(() => {});
    customersApi.list().then((r) => setCustomers(r.customers || [])).catch(() => {});
  }, [load]);

  const editable = can('tracking', draft?._id ? 'update' : 'create');

  const onMapClick = (pt) => {
    if (!draft || !editable) return;
    if (draft.shape === 'circle') setDraft({ ...draft, center: pt });
    else setDraft({ ...draft, polygon: [...draft.polygon, pt] });
  };

  const edit = (f) =>
    setDraft({
      ...blankFence(),
      ...f,
      vehicles: (f.vehicles || []).map((v) => v._id || v),
      customer: f.customer?._id || f.customer || '',
      dwellAlertMinutes: f.dwellAlertMinutes ?? '',
    });

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const payload = { ...draft, dwellAlertMinutes: draft.dwellAlertMinutes === '' ? null : Number(draft.dwellAlertMinutes), radiusM: Number(draft.radiusM), customer: draft.customer || null };
      if (draft._id) await alertsApi.updateGeofence(draft._id, payload);
      else await alertsApi.createGeofence(payload);
      setNotice(`Geofence ${draft.name} saved`);
      setDraft(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete geofence ${draft.name}?`)) return;
    try {
      await alertsApi.removeGeofence(draft._id);
      setDraft(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-3">
        <Banner message={error} onDismiss={() => setError('')} />
        <Banner tone="success" message={notice} onDismiss={() => setNotice('')} />
        {draft && (
          <Banner
            tone="warning"
            message={draft.shape === 'circle' ? 'Click the map to place the centre of the geofence, then set the radius.' : `Click the map to add corner points (${draft.polygon.length} so far — at least 3).`}
          />
        )}
        <div className="rounded-lg overflow-hidden border border-slate-200">
          <GeofenceMap fences={fences} draft={draft} onMapClick={draft ? onMapClick : undefined} onSelect={edit} selectedId={draft?._id} />
        </div>
      </div>

      <div className="space-y-4">
        {!draft && (
          <Panel
            title="Geofences"
            subtitle="Click one on the map or in the list to edit"
            action={can('tracking', 'create') ? <Button icon={Plus} onClick={() => setDraft(blankFence())}>New</Button> : null}
          >
            <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
              {fences.length === 0 && <EmptyState icon={MapPinned} title="No geofences yet" hint="Fence your yard and customer sites to get arrival and departure alerts." />}
              {fences.map((f) => (
                <button key={f._id} type="button" onClick={() => edit(f)} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-start gap-3">
                  <span className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ background: f.color }} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-900">
                      {f.name} {f.active === false ? <Pill className="bg-slate-100 text-slate-500">Off</Pill> : null}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {options?.categories.find((c) => c.value === f.category)?.label || f.category}
                      {f.shape === 'circle' ? ` · ${f.radiusM} m radius` : ` · ${f.polygon.length}-point area`}
                      {' · '}
                      {f.vehicles?.length ? `${f.vehicles.length} vehicle(s)` : 'all vehicles'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </Panel>
        )}

        {draft && (
          <Panel title={draft._id ? `Edit ${draft.name}` : 'New geofence'}>
            <div className="p-4 space-y-3">
              <label className="text-sm text-slate-700 block">Name *<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} placeholder="e.g. Reliance DC Bhiwandi" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-slate-700">Type
                  <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className={inputClass}>
                    {(options?.categories || []).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </label>
                <label className="text-sm text-slate-700">Colour<input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} className="block mt-1 h-9 w-full rounded border border-slate-200" /></label>
              </div>
              <div className="flex gap-2">
                {['circle', 'polygon'].map((s) => (
                  <button key={s} type="button" onClick={() => setDraft({ ...draft, shape: s })} className={`flex-1 px-3 py-2 rounded-lg text-sm border ${draft.shape === s ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'}`}>
                    {s === 'circle' ? 'Circle' : 'Polygon'}
                  </button>
                ))}
              </div>
              {draft.shape === 'circle' ? (
                <label className="text-sm text-slate-700 block">
                  Radius: {draft.radiusM} m
                  <input type="range" min={50} max={5000} step={50} value={draft.radiusM} onChange={(e) => setDraft({ ...draft, radiusM: Number(e.target.value) })} className="w-full" />
                </label>
              ) : (
                draft.polygon.length > 0 && (
                  <Button variant="secondary" icon={Undo2} onClick={() => setDraft({ ...draft, polygon: draft.polygon.slice(0, -1) })}>
                    Remove last point
                  </Button>
                )
              )}
              <label className="text-sm text-slate-700 block">Customer (optional)
                <select value={draft.customer} onChange={(e) => setDraft({ ...draft, customer: e.target.value })} className={inputClass}>
                  <option value="">None</option>
                  {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </label>
              <div className="text-sm text-slate-700">
                Applies to
                <div className="mt-1 max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                  <p className="text-xs text-slate-500">None ticked = every vehicle</p>
                  {trucks.map((t) => (
                    <label key={t._id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.vehicles.includes(t._id)}
                        onChange={(e) => setDraft({ ...draft, vehicles: e.target.checked ? [...draft.vehicles, t._id] : draft.vehicles.filter((v) => v !== t._id) })}
                      />
                      {t.number}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1 text-sm text-slate-700">
                <label className="flex items-center gap-2"><input type="checkbox" checked={draft.alertOnEntry} onChange={(e) => setDraft({ ...draft, alertOnEntry: e.target.checked })} /> Alert on entry</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={draft.alertOnExit} onChange={(e) => setDraft({ ...draft, alertOnExit: e.target.checked })} /> Alert on exit</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Active</label>
              </div>
              <label className="text-sm text-slate-700 block">Alert if a vehicle stays longer than (minutes)<input type="number" min={1} value={draft.dwellAlertMinutes} onChange={(e) => setDraft({ ...draft, dwellAlertMinutes: e.target.value })} className={inputClass} placeholder="Leave blank for no stay alert" /></label>
              <div className="flex gap-2 pt-2 flex-wrap">
                <Button icon={Save} busy={busy} disabled={!editable || !draft.name.trim() || (draft.shape === 'circle' ? !draft.center : draft.polygon.length < 3)} onClick={save}>Save</Button>
                <Button variant="secondary" onClick={() => setDraft(null)}>Cancel</Button>
                {draft._id && can('tracking', 'delete') && <Button variant="danger" icon={Trash2} onClick={remove}>Delete</Button>}
              </div>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

function AlertSettings() {
  const { can } = usePermissions();
  const [s, setS] = useState(null);
  const [days, setDays] = useState('');
  const [recipients, setRecipients] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    alertsApi
      .settings()
      .then((r) => {
        setS(r.settings);
        setDays((r.settings.compliance?.reminderDays || [30, 15, 7, 0]).join(', '));
        setRecipients((r.settings.email?.recipients || []).join(', '));
      })
      .catch((e) => setError(e.message));
  }, []);

  if (!s) return <Banner message={error} />;
  const set = (group, key, value) => setS((x) => ({ ...x, [group]: { ...x[group], [key]: value } }));
  const disabled = !can('tracking', 'update');

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const reminderDays = days.split(',').map((d) => Number(d.trim())).filter((n) => Number.isFinite(n));
      const res = await alertsApi.saveSettings({
        ...s,
        compliance: { reminderDays },
        email: { ...(s.email || {}), recipients: recipients.split(',').map((e) => e.trim()).filter(Boolean) },
      });
      setS(res.settings);
      setDays(res.settings.compliance.reminderDays.join(', '));
      setRecipients((res.settings.email?.recipients || []).join(', '));
      setNotice('Alert settings saved — they apply from the next GPS update');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <Banner message={error} onDismiss={() => setError('')} />
      <Banner tone="success" message={notice} onDismiss={() => setNotice('')} />
      <Panel title="GPS alerts">
        <div className="divide-y divide-slate-100">
          <SettingRow checked={Boolean(s.overspeed?.enabled)} onToggle={(v) => set('overspeed', 'enabled', v)} disabled={disabled} label="Overspeed" hint="Once when a vehicle goes over the limit">
            Limit <input type="number" min={10} max={200} disabled={disabled} value={s.overspeed.limitKmh} onChange={(e) => set('overspeed', 'limitKmh', Number(e.target.value))} className="w-20 px-2 py-1 border border-slate-200 rounded" /> km/h
          </SettingRow>
          <SettingRow checked={Boolean(s.idle?.enabled)} onToggle={(v) => set('idle', 'enabled', v)} disabled={disabled} label="Prolonged idling" hint="Engine on, not moving">
            After <input type="number" min={1} disabled={disabled} value={s.idle.minutes} onChange={(e) => set('idle', 'minutes', Number(e.target.value))} className="w-20 px-2 py-1 border border-slate-200 rounded" /> min
          </SettingRow>
          <SettingRow checked={Boolean(s.ignition?.enabled)} onToggle={(v) => set('ignition', 'enabled', v)} disabled={disabled} label="Ignition on / off" hint="Every start and stop — busy for a large fleet" />
          <SettingRow checked={Boolean(s.afterHours?.enabled)} onToggle={(v) => set('afterHours', 'enabled', v)} disabled={disabled} label="Unauthorised movement" hint="Vehicle moving during hours it should be parked">
            <input type="time" disabled={disabled} value={s.afterHours.from} onChange={(e) => set('afterHours', 'from', e.target.value)} className="px-2 py-1 border border-slate-200 rounded" />
            to
            <input type="time" disabled={disabled} value={s.afterHours.to} onChange={(e) => set('afterHours', 'to', e.target.value)} className="px-2 py-1 border border-slate-200 rounded" />
          </SettingRow>
          <SettingRow checked={Boolean(s.geofence?.enabled)} onToggle={(v) => set('geofence', 'enabled', v)} disabled={disabled} label="Geofence alerts" hint="Entry, exit and long-stay alerts for the fences you draw" />
          <SettingRow checked={s.routeDeviation?.enabled !== false} onToggle={(v) => set('routeDeviation', 'enabled', v)} disabled={disabled} label="Route deviation" hint="Vehicle leaves the planned road route of its active trip">
            More than <input type="number" min={200} max={20000} step={100} disabled={disabled} value={s.routeDeviation?.thresholdM ?? 1000} onChange={(e) => set('routeDeviation', 'thresholdM', Number(e.target.value))} className="w-24 px-2 py-1 border border-slate-200 rounded" /> m
            for <input type="number" min={0} max={120} disabled={disabled} value={s.routeDeviation?.minMinutes ?? 3} onChange={(e) => set('routeDeviation', 'minMinutes', Number(e.target.value))} className="w-16 px-2 py-1 border border-slate-200 rounded" /> min
          </SettingRow>
          <label className="flex items-center gap-3 px-4 py-4 text-sm">
            <input type="checkbox" disabled={disabled} checked={s.logToTrip} onChange={(e) => setS({ ...s, logToTrip: e.target.checked })} />
            Also record GPS alerts on the vehicle&apos;s active trip timeline
          </label>
        </div>
      </Panel>
      <Panel title="Reminders">
        <div className="p-4 space-y-4">
          <label className="text-sm text-slate-700 block">
            Document expiry reminders — days before expiry
            <input value={days} disabled={disabled} onChange={(e) => setDays(e.target.value)} className={inputClass} placeholder="30, 15, 7, 0" />
            <span className="text-xs text-slate-500">One reminder at each stage, never repeated; 0 means on the expiry date. Covers insurance, PUC, fitness, permit, road tax, FASTag and driver licences.</span>
          </label>
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input type="checkbox" disabled={disabled} checked={s.maintenanceInBell !== false} onChange={(e) => setS({ ...s, maintenanceInBell: e.target.checked })} />
            Show due and overdue services, tyres and batteries in the notification bell
          </label>
        </div>
      </Panel>
      <Panel title="Email alerts">
        <div className="p-4 space-y-4">
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input type="checkbox" disabled={disabled} checked={Boolean(s.email?.enabled)} onChange={(e) => set('email', 'enabled', e.target.checked)} />
            Email new alerts — sent as one summary every minute while there are new ones, even when nobody has TrackOwl open
          </label>
          <label className="text-sm text-slate-700 block">
            Send to (comma-separated)
            <input value={recipients} disabled={disabled} onChange={(e) => setRecipients(e.target.value)} className={inputClass} placeholder="owner@company.com, ops@company.com" />
          </label>
          <label className="text-sm text-slate-700 block">
            Which alerts
            <select value={s.email?.minSeverity || 'critical'} disabled={disabled} onChange={(e) => set('email', 'minSeverity', e.target.value)} className={inputClass}>
              <option value="critical">Critical only (expired documents, offline devices, unauthorised movement, driver needs help)</option>
              <option value="warning">Warnings and critical</option>
              <option value="info">Everything</option>
            </select>
          </label>
          <p className="text-xs text-slate-500">To send alerts to WhatsApp, SMS or another system, add a webhook under Settings → Integrations.</p>
        </div>
      </Panel>
      {!disabled && <Button icon={Save} busy={busy} onClick={save}>Save settings</Button>}
    </div>
  );
}

// One switchable alert with its threshold controls. At module level so its
// inputs keep focus while typing (a component defined inside the parent would
// be a new type on every render and remount).
function SettingRow({ checked, onToggle, disabled, label, hint, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-4">
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1" disabled={disabled} checked={checked} onChange={(e) => onToggle(e.target.checked)} />
        <span>
          <span className="block text-sm font-medium text-slate-900">{label}</span>
          <span className="block text-xs text-slate-500">{hint}</span>
        </span>
      </label>
      <div className="flex items-center gap-2 text-sm text-slate-700">{children}</div>
    </div>
  );
}
