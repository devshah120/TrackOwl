import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Save, Trash2, Edit2, Star, IndianRupee, Users, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PageShell, PageHeader, Panel, Banner, Button, Pill, Modal, StatTile, EmptyState, Th, Td } from '../../components/business/BusinessUI';
import { formatCurrency, formatDate, formatDateTime, inputClass, toISODate } from '../../components/business/helpers';
import { adminBilling } from '../../services/api';

// Plans & Billing (Super Admin). Four tabs:
//   Plans      what is sold: prices, limits, the feature lines on the pricing
//              page, the "Most Popular" badge, on/off
//   Settings   free-trial length, grace days, enforcement, renewal reminders
//   Clients    every account's plan and status, with extend-trial, grant a
//              plan (offline payment, pilot), suspend and reactivate
//   Payments   the Razorpay payment log
const TABS = [
  { key: 'plans', label: 'Plans' },
  { key: 'settings', label: 'Trial & Settings' },
  { key: 'clients', label: 'Client Subscriptions' },
  { key: 'payments', label: 'Payments' },
];

const STATUS = {
  trialing: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  grace: 'bg-amber-100 text-amber-800',
  expired: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-200 text-slate-600',
};

export function AdminPlans() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'plans';
  return (
    <PageShell>
      <PageHeader title="Plans & Billing" subtitle="What TrackOwl sells, the free trial, and every client's subscription" />
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setParams(t.key === 'plans' ? {} : { tab: t.key })} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'plans' && <PlansTab />}
      {tab === 'settings' && <SettingsTab />}
      {tab === 'clients' && <ClientsTab />}
      {tab === 'payments' && <PaymentsTab />}
    </PageShell>
  );
}

// --- Plans --------------------------------------------------------------------

function PlansTab() {
  const [plans, setPlans] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await adminBilling.plans();
      setPlans(r.plans || []);
      setCatalog(r.catalog || []);
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  return (
    <>
      <Banner message={error} onDismiss={() => setError('')} />
      <Banner tone="success" message={notice} onDismiss={() => setNotice('')} />
      <div className="flex justify-end">
        <Button icon={Plus} onClick={() => setEditing({})}>New plan</Button>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {plans.map((p) => (
          <div key={p._id} className={`bg-white rounded-xl border p-5 flex flex-col ${p.highlight ? 'border-blue-600' : 'border-slate-200'} ${p.active ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  {p.name}
                  {p.highlight && <Star className="w-4 h-4 text-amber-500 fill-amber-400" />}
                </h3>
                <p className="text-xs text-slate-500">{p.key} · {p.description}</p>
              </div>
              <Pill className={p.active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'}>{p.active ? 'On sale' : 'Hidden'}</Pill>
            </div>
            <p className="mt-3 text-slate-900">
              <span className="text-2xl font-bold">{formatCurrency(p.monthlyPrice)}</span>/month · <span className="font-semibold">{formatCurrency(p.yearlyPrice)}</span>/year
            </p>
            <p className="text-sm text-slate-600 mt-1">
              {p.maxVehicles ? `${p.maxVehicles} vehicles` : 'Unlimited vehicles'} · {p.maxUsers ? `${p.maxUsers} users` : 'unlimited users'} · {p.subscribers} subscriber(s)
            </p>
            {/* Generated from the plan's limits and modules — what the
                customer actually gets — plus any extra lines. */}
            <ul className="mt-3 text-sm text-slate-600 space-y-1 flex-1">
              {(p.displayFeatures || []).map((f) => <li key={f}>✓ {f}</li>)}
            </ul>
            <p className="text-xs text-slate-500 mt-2">{(p.modules || []).length} of {catalog.length} modules</p>
            <div className="flex gap-2 mt-4">
              <Button variant="secondary" icon={Edit2} onClick={() => setEditing(p)}>Edit</Button>
              {!p.subscribers && (
                <Button
                  variant="danger"
                  icon={Trash2}
                  onClick={() => window.confirm(`Delete plan ${p.name}?`) && adminBilling.removePlan(p._id).then(() => { setNotice('Plan deleted'); load(); }).catch((e) => setError(e.message))}
                />
              )}
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <PlanModal
          key={editing._id || 'new'}
          plan={editing}
          catalog={catalog}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            setNotice(msg);
            load();
          }}
        />
      )}
    </>
  );
}

// What the pricing page will list, built the same way the server builds it
// (services/planCatalog.js displayFeatures): limits, then modules, then extras.
const previewFeatures = (form, catalog) => {
  const limit = (n, one, many) => (n ? `Up to ${Number(n).toLocaleString('en-IN')} ${Number(n) === 1 ? one : many}` : `Unlimited ${many}`);
  return [
    limit(form.maxVehicles, 'vehicle', 'vehicles'),
    limit(form.maxUsers, 'user', 'users'),
    ...catalog.filter((m) => form.modules.includes(m.key)).map((m) => m.label),
    ...form.extraFeatures.split('\n').map((l) => l.trim()).filter(Boolean),
  ];
};

function PlanModal({ plan, catalog, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    key: plan.key || '',
    name: plan.name || '',
    description: plan.description || '',
    monthlyPrice: plan.monthlyPrice ?? '',
    yearlyPrice: plan.yearlyPrice ?? '',
    maxVehicles: plan.maxVehicles ?? '',
    maxUsers: plan.maxUsers ?? '',
    modules: plan._id ? plan.modules || [] : catalog.map((m) => m.key),
    extraFeatures: (plan.extraFeatures || []).join('\n'),
    highlight: Boolean(plan.highlight),
    active: plan.active !== false,
    sortOrder: plan.sortOrder ?? 0,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (key) => set('modules', form.modules.includes(key) ? form.modules.filter((m) => m !== key) : [...form.modules, key]);
  const groups = [...new Set(catalog.map((m) => m.group))];

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const payload = { ...form, extraFeatures: form.extraFeatures.split('\n') };
      if (plan._id) {
        const res = await adminBilling.updatePlan(plan._id, payload);
        onSaved(`${form.name} saved. ${res.note || ''}`);
      } else {
        await adminBilling.createPlan(payload);
        onSaved(`${form.name} created`);
      }
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal open wide title={plan._id ? `Edit ${plan.name}` : 'New plan'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} icon={Save} onClick={save}>Save plan</Button></>}>
      <div className="space-y-4">
        <Banner message={error} />
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-sm text-slate-700">Name<input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputClass} /></label>
          <label className="text-sm text-slate-700">Code (in links)<input value={form.key} onChange={(e) => set('key', e.target.value.toLowerCase())} className={inputClass} placeholder="professional" /></label>
          <label className="text-sm text-slate-700">Display order<input type="number" value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} className={inputClass} /></label>
        </div>
        <label className="text-sm text-slate-700 block">Tagline<input value={form.description} onChange={(e) => set('description', e.target.value)} className={inputClass} placeholder="For growing businesses" /></label>
        <div className="grid sm:grid-cols-4 gap-3">
          <label className="text-sm text-slate-700">Monthly price (₹)<input type="number" min={0} value={form.monthlyPrice} onChange={(e) => set('monthlyPrice', e.target.value)} className={inputClass} /></label>
          <label className="text-sm text-slate-700">Yearly price (₹)<input type="number" min={0} value={form.yearlyPrice} onChange={(e) => set('yearlyPrice', e.target.value)} className={inputClass} /></label>
          <label className="text-sm text-slate-700">Vehicle limit<input type="number" min={1} value={form.maxVehicles} onChange={(e) => set('maxVehicles', e.target.value)} className={inputClass} placeholder="Blank = unlimited" /></label>
          <label className="text-sm text-slate-700">User limit<input type="number" min={1} value={form.maxUsers} onChange={(e) => set('maxUsers', e.target.value)} className={inputClass} placeholder="Blank = unlimited" /></label>
        </div>

        <div className="grid lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Modules included <span className="font-normal text-slate-500">— customers on this plan get exactly these</span></p>
              <div className="flex gap-2 text-xs">
                <button type="button" className="text-blue-600 hover:underline" onClick={() => set('modules', catalog.map((m) => m.key))}>All</button>
                <button type="button" className="text-blue-600 hover:underline" onClick={() => set('modules', [])}>None</button>
              </div>
            </div>
            {groups.map((group) => (
              <div key={group}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{group}</p>
                <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
                  {catalog.filter((m) => m.group === group).map((m) => (
                    <label key={m.key} className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={form.modules.includes(m.key)} onChange={() => toggle(m.key)} />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-xs text-slate-500">Always included in every plan: dashboard, vehicles, drivers, customers, users, company settings and notifications.</p>
            <label className="text-sm text-slate-700 block">
              Extra lines for the pricing page <span className="text-slate-500">(not enforced — support level, onboarding…)</span>
              <textarea rows={3} value={form.extraFeatures} onChange={(e) => set('extraFeatures', e.target.value)} className={`${inputClass} text-sm`} placeholder={'Priority support\nFree onboarding call'} />
            </label>
          </div>
          <div className="lg:col-span-2">
            <p className="text-sm font-medium text-slate-700 mb-1">Pricing page will show</p>
            <ul className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 text-sm text-slate-700">
              {previewFeatures(form, catalog).map((f) => (
                <li key={f} className="flex gap-2"><span className="text-emerald-600">✓</span>{f}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex gap-6 text-sm text-slate-700 flex-wrap">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.highlight} onChange={(e) => set('highlight', e.target.checked)} /> &quot;Most Popular&quot; badge</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} /> On sale (shown on the pricing page)</label>
        </div>
        <p className="text-xs text-slate-500">Limits and modules apply to every subscriber of this plan as soon as you save. A price change applies from each subscriber&apos;s next payment.</p>
      </div>
    </Modal>
  );
}

// --- Settings -----------------------------------------------------------------

function SettingsTab() {
  const [s, setS] = useState(null);
  const [rzp, setRzp] = useState(null);
  const [reminders, setReminders] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await adminBilling.settings();
        setS(r.settings);
        setReminders((r.settings.reminderDays || []).join(', '));
        setRzp(r.razorpay);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  if (!s) return <Banner message={error} />;
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await adminBilling.saveSettings({ trialDays: Number(s.trialDays), graceDays: Number(s.graceDays), enforce: s.enforce, reminderDays: reminders });
      setS(r.settings);
      setNotice(`Saved. ${r.note || ''}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 w-full">
      <Banner message={error} onDismiss={() => setError('')} />
      <Banner tone="success" message={notice} onDismiss={() => setNotice('')} />
      <div className="grid gap-6 xl:grid-cols-2 items-start">
        {rzp && <RazorpayPanel status={rzp} onChange={setRzp} onNotice={setNotice} onError={setError} />}
        <Panel title="Trial & access">
          <div className="p-4 space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm text-slate-700">Free trial (days)<input type="number" min={0} max={365} value={s.trialDays} onChange={(e) => setS({ ...s, trialDays: e.target.value })} className={inputClass} /></label>
              <label className="text-sm text-slate-700">Grace after expiry (days)<input type="number" min={0} max={60} value={s.graceDays} onChange={(e) => setS({ ...s, graceDays: e.target.value })} className={inputClass} /></label>
            </div>
            <label className="text-sm text-slate-700 block">Renewal reminders (days before expiry)<input value={reminders} onChange={(e) => setReminders(e.target.value)} className={inputClass} placeholder="7, 3, 1" /></label>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" className="mt-1" checked={s.enforce} onChange={(e) => setS({ ...s, enforce: e.target.checked })} />
              <span>
                Block accounts without an active plan, and enforce plan limits
                <span className="block text-xs text-slate-500">Untick only as an emergency switch: nobody is blocked and limits are ignored while it is off.</span>
              </span>
            </label>
            <Button icon={Save} busy={busy} onClick={save}>Save settings</Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// The Razorpay connection, managed here rather than in the server's .env.
// Secrets are write-only: the panel shows that one is set (its last 4
// characters), never the value, and a blank secret field keeps the saved one.
function RazorpayPanel({ status, onChange, onNotice, onError }) {
  const [form, setForm] = useState(() => ({ keyId: status.keyId || '', keySecret: '' }));
  const [busy, setBusy] = useState(null);

  const run = async (kind, fn) => {
    setBusy(kind);
    onError('');
    try {
      const r = await fn();
      onChange(r.razorpay);
      onNotice(r.message);
      setForm((f) => ({ ...f, keyId: r.razorpay.keyId || '', keySecret: '' }));
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const ok = (good, text) => (
    <p className="flex items-center gap-2 text-sm">
      {good ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
      <span>{text}</span>
    </p>
  );

  return (
    <Panel
      title="Razorpay connection"
      action={
        status.mode ? (
          <Pill className={status.mode === 'live' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>{status.mode === 'live' ? 'Live mode' : 'Test mode'}</Pill>
        ) : null
      }
    >
      <div className="p-4 space-y-4">
        <div className="space-y-1.5">
          {ok(status.configured, status.configured ? `Connected with ${status.keyId} (secret ${status.keySecretHint})${status.source === 'env' ? ' — from the server .env; save here to manage it from the panel' : ''}` : 'Not connected — enter your API keys below')}
          {status.verifiedAt && <p className="text-xs text-slate-500 pl-6">Last checked with Razorpay {formatDateTime(status.verifiedAt)}</p>}
          {status.unreadable && <p className="text-sm text-red-600">The saved secret can no longer be read (the server key changed). Enter it again.</p>}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm text-slate-700 sm:col-span-2">
            Key Id
            <input value={form.keyId} onChange={(e) => setForm({ ...form, keyId: e.target.value.trim() })} className={`${inputClass} font-mono`} placeholder="rzp_test_… or rzp_live_…" autoComplete="off" />
          </label>
          <label className="text-sm text-slate-700 sm:col-span-2">
            Key Secret
            <input type="password" value={form.keySecret} onChange={(e) => setForm({ ...form, keySecret: e.target.value })} className={`${inputClass} font-mono`} placeholder={status.configured ? 'Leave blank to keep the saved one' : 'From Razorpay → API Keys'} autoComplete="new-password" />
          </label>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
          <p>
            <span className="font-medium text-slate-700">Where to find them:</span> Razorpay Dashboard → Account &amp; Settings → API Keys. Start with Test mode keys, switch to Live after a test payment.
          </p>
          <p>
            <span className="font-medium text-slate-700">No webhook needed:</span> a payment is confirmed the moment Checkout finishes, and if a customer closes the tab first, TrackOwl checks with Razorpay every few minutes and activates the plan itself.
          </p>
          <p>Keys are checked with Razorpay before saving and the secret is stored encrypted — it is never shown again.</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button icon={Save} busy={busy === 'save'} disabled={Boolean(busy) || !form.keyId} onClick={() => run('save', () => adminBilling.saveRazorpay(form))}>Save &amp; verify keys</Button>
          {status.configured && (
            <Button variant="secondary" busy={busy === 'test'} disabled={Boolean(busy)} onClick={() => run('test', () => adminBilling.testRazorpay())}>Test connection</Button>
          )}
          {status.source === 'panel' && (
            <Button
              variant="danger"
              icon={Trash2}
              disabled={Boolean(busy)}
              onClick={() => window.confirm('Remove the Razorpay keys? Customers will not be able to pay until new keys are saved.') && run('remove', () => adminBilling.removeRazorpay())}
            >
              Remove keys
            </Button>
          )}
        </div>
      </div>
    </Panel>
  );
}

// --- Clients ------------------------------------------------------------------

function ClientsTab() {
  const [rows, setRows] = useState([]);
  const [plans, setPlans] = useState([]);
  const [status, setStatus] = useState('');
  const [action, setAction] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([adminBilling.subscriptions(status), adminBilling.plans()]);
      setRows(s.subscriptions || []);
      setPlans(p.plans || []);
    } catch (e) {
      setError(e.message);
    }
  }, [status]);
  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  const counts = rows.reduce((acc, r) => ({ ...acc, [r.subscription.status]: (acc[r.subscription.status] || 0) + 1 }), {});

  return (
    <>
      <Banner message={error} onDismiss={() => setError('')} />
      <Banner tone="success" message={notice} onDismiss={() => setNotice('')} />
      {!status && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile label="Paying" value={counts.active || 0} icon={CheckCircle2} bg="bg-green-50" fg="text-green-600" onClick={() => setStatus('active')} />
          <StatTile label="On trial" value={counts.trialing || 0} icon={Clock} bg="bg-blue-50" fg="text-blue-600" onClick={() => setStatus('trialing')} />
          <StatTile label="In grace" value={counts.grace || 0} icon={AlertTriangle} bg="bg-amber-50" fg="text-amber-600" onClick={() => setStatus('grace')} />
          <StatTile label="Blocked" value={(counts.expired || 0) + (counts.cancelled || 0)} icon={Users} bg="bg-red-50" fg="text-red-600" onClick={() => setStatus('expired')} />
        </div>
      )}
      <div className="flex items-center gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          <option value="">All clients</option>
          <option value="active">Active</option>
          <option value="trialing">On trial</option>
          <option value="grace">Grace</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Suspended</option>
        </select>
      </div>
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <Th>Client</Th>
                <Th>Plan</Th>
                <Th>Status</Th>
                <Th>Ends</Th>
                <Th right>Vehicles</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState title="No clients match" />
                  </td>
                </tr>
              )}
              {rows.map(({ owner, usage, subscription: s }) => (
                <tr key={owner._id}>
                  <Td>
                    <span className="font-medium text-slate-900">{owner.company || owner.name}</span>
                    <span className="block text-xs text-slate-500">{owner.email}</span>
                  </Td>
                  <Td>{s.status === 'trialing' ? 'Trial' : s.plan?.name || '—'}{s.cycle ? ` · ${s.cycle}` : ''}</Td>
                  <Td><Pill className={STATUS[s.status]}>{s.status}</Pill></Td>
                  <Td>{formatDate(s.status === 'grace' ? s.graceEndsAt : s.endsAt)}{s.daysLeft !== null && s.daysLeft >= 0 ? <span className="block text-xs text-slate-500">{s.daysLeft} day(s)</span> : null}</Td>
                  <Td right>{usage.vehicles}{s.limits?.maxVehicles ? ` / ${s.limits.maxVehicles}` : ''}</Td>
                  <Td>
                    <div className="flex gap-1 justify-end flex-wrap">
                      <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => setAction({ owner, kind: 'extend_trial' })}>Extend trial</Button>
                      <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => setAction({ owner, kind: 'grant' })}>Grant plan</Button>
                      {s.status === 'cancelled' ? (
                        <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => adminBilling.act(owner._id, { action: 'reactivate' }).then((r) => { setNotice(r.message); load(); }).catch((e) => setError(e.message))}>Reactivate</Button>
                      ) : (
                        <Button variant="danger" className="!px-2 !py-1 text-xs" onClick={() => window.confirm(`Suspend ${owner.company || owner.name}? They will be locked out immediately.`) && adminBilling.act(owner._id, { action: 'cancel' }).then((r) => { setNotice(r.message); load(); }).catch((e) => setError(e.message))}>Suspend</Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {action && (
        <ActionModal
          key={`${action.owner._id}-${action.kind}`}
          action={action}
          plans={plans}
          onClose={() => setAction(null)}
          onDone={(msg) => {
            setAction(null);
            setNotice(msg);
            load();
          }}
        />
      )}
    </>
  );
}

function ActionModal({ action, plans, onClose, onDone }) {
  const inMonth = new Date();
  inMonth.setMonth(inMonth.getMonth() + 1);
  const [form, setForm] = useState(() => ({ days: 7, plan: plans.find((p) => p.active)?._id || '', cycle: 'monthly', until: toISODate(inMonth), note: '' }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const name = action.owner.company || action.owner.name;
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const payload =
        action.kind === 'extend_trial'
          ? { action: 'extend_trial', days: Number(form.days) }
          : { action: 'grant', plan: form.plan, cycle: form.cycle, until: form.until, note: form.note };
      const r = await adminBilling.act(action.owner._id, payload);
      onDone(`${name}: ${r.message}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };
  return (
    <Modal open title={action.kind === 'extend_trial' ? `Extend trial — ${name}` : `Grant a plan — ${name}`} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} onClick={submit}>Apply</Button></>}>
      <div className="space-y-3">
        <Banner message={error} />
        {action.kind === 'extend_trial' ? (
          <label className="text-sm text-slate-700 block">Add days to the trial<input type="number" min={1} max={365} value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} className={inputClass} /></label>
        ) : (
          <>
            <label className="text-sm text-slate-700 block">Plan
              <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} className={inputClass}>
                {plans.map((p) => <option key={p._id} value={p._id}>{p.name}{p.active ? '' : ' (hidden)'}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-slate-700">Billing cycle
                <select value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value })} className={inputClass}>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </label>
              <label className="text-sm text-slate-700">Valid until<input type="date" value={form.until} onChange={(e) => setForm({ ...form, until: e.target.value })} className={inputClass} /></label>
            </div>
            <label className="text-sm text-slate-700 block">Note (why — offline payment, pilot…)<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={inputClass} /></label>
            <p className="text-xs text-slate-500">No money is taken. Use this for bank transfers, cheques, pilots or partners.</p>
          </>
        )}
      </div>
    </Modal>
  );
}

// --- Payments -----------------------------------------------------------------

function PaymentsTab() {
  const [status, setStatus] = useState('paid');
  const [data, setData] = useState({ payments: [], totals: {} });
  const [error, setError] = useState('');
  useEffect(() => {
    (async () => {
      try {
        setData(await adminBilling.payments(status));
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [status]);
  return (
    <>
      <Banner message={error} onDismiss={() => setError('')} />
      <div className="flex items-center gap-4 flex-wrap">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          <option value="paid">Paid</option>
          <option value="created">Started, not paid</option>
          <option value="failed">Failed</option>
          <option value="">All</option>
        </select>
        {status === 'paid' && (
          <p className="text-sm text-slate-700 flex items-center gap-1">
            <IndianRupee className="w-4 h-4" /> {data.totals.paidCount || 0} payments · {formatCurrency(data.totals.paidAmount)} (last 300 shown)
          </p>
        )}
      </div>
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <Th>When</Th>
                <Th>Client</Th>
                <Th>Plan</Th>
                <Th>Status</Th>
                <Th>Razorpay</Th>
                <Th right>Amount</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.payments.length === 0 && (
                <tr>
                  <td colSpan={6}><EmptyState title="No payments" /></td>
                </tr>
              )}
              {data.payments.map((p) => (
                <tr key={p._id}>
                  <Td>{formatDateTime(p.paidAt || p.createdAt)}</Td>
                  <Td>{p.owner?.company || p.owner?.name || '—'}</Td>
                  <Td>{p.planName} · {p.cycle}</Td>
                  <Td>
                    <Pill className={p.status === 'paid' ? 'bg-green-100 text-green-800' : p.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}>{p.status}</Pill>
                    {p.failureReason && <span className="block text-xs text-red-600">{p.failureReason}</span>}
                  </Td>
                  <Td className="text-xs">{p.razorpayPaymentId || p.razorpayOrderId}{p.method ? <span className="block uppercase text-slate-500">{p.method}</span> : null}</Td>
                  <Td right className="font-medium">{formatCurrency(p.amount)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
