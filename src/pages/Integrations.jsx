import { useCallback, useEffect, useState } from 'react';
import { Plus, Webhook, Send, Trash2, RotateCcw, Copy, Mail } from 'lucide-react';
import { PageShell, PageHeader, Panel, Banner, Button, Pill, EmptyState } from '../components/business/BusinessUI';
import { formatDateTime, inputClass } from '../components/business/helpers';
import { integrations as api } from '../services/api';

// Integrations (brief P3): outbound webhooks. TrackOwl POSTs a signed JSON
// event to each URL when something happens — the hook for an ERP or Tally
// bridge, a WhatsApp/SMS gateway, Zapier/Make, or a customer portal. Company
// Admin only: it sends the account's data out of TrackOwl.
export function Integrations() {
  const [hooks, setHooks] = useState([]);
  const [events, setEvents] = useState([]);
  const [draft, setDraft] = useState(null);
  const [secret, setSecret] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [list, opts] = await Promise.all([api.list(), api.options()]);
      setHooks(list.webhooks || []);
      setEvents(opts.events || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.create(draft);
      setSecret({ name: res.webhook.name, value: res.webhook.secret });
      setDraft(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const act = async (fn, message) => {
    setError('');
    try {
      const res = await fn();
      if (res?.webhook?.secret && !res.webhook.secret.startsWith('••••')) setSecret({ name: res.webhook.name, value: res.webhook.secret });
      if (message) setNotice(typeof message === 'function' ? message(res) : message);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Integrations"
        subtitle="Send trip, invoice and alert events to your other systems as they happen"
        actions={<Button icon={Plus} onClick={() => setDraft({ name: '', url: '', events: ['alert.created'] })}>Add webhook</Button>}
      />
      <Banner message={error} onDismiss={() => setError('')} />
      <Banner tone="success" message={notice} onDismiss={() => setNotice('')} />

      {secret && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
          <p className="font-medium text-amber-900">Signing secret for {secret.name} — copy it now, it will not be shown again.</p>
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 bg-white border border-amber-200 rounded px-3 py-2 font-mono text-xs break-all">{secret.value}</code>
            <Button variant="secondary" icon={Copy} onClick={() => navigator.clipboard?.writeText(secret.value)}>Copy</Button>
          </div>
          <button type="button" className="text-xs underline mt-2 text-amber-800" onClick={() => setSecret(null)}>I have saved it</button>
        </div>
      )}

      {draft && (
        <Panel title="New webhook">
          <div className="p-4 space-y-3 max-w-2xl">
            <label className="text-sm text-slate-700 block">Name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} placeholder="e.g. WhatsApp alerts via Zapier" /></label>
            <label className="text-sm text-slate-700 block">URL<input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} className={inputClass} placeholder="https://…" /></label>
            <div className="text-sm text-slate-700">
              Send these events
              <div className="mt-1 space-y-1">
                {events.map((ev) => (
                  <label key={ev.value} className="flex items-center gap-2">
                    <input type="checkbox" checked={draft.events.includes(ev.value)} onChange={(e) => setDraft({ ...draft, events: e.target.checked ? [...draft.events, ev.value] : draft.events.filter((x) => x !== ev.value) })} />
                    <span>{ev.label} <code className="text-xs text-slate-500">{ev.value}</code></span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button busy={busy} disabled={!draft.name.trim() || !draft.url.trim() || !draft.events.length} onClick={save}>Create</Button>
              <Button variant="secondary" onClick={() => setDraft(null)}>Cancel</Button>
            </div>
          </div>
        </Panel>
      )}

      <Panel title="Webhooks">
        <div className="divide-y divide-slate-100">
          {hooks.length === 0 && <EmptyState icon={Webhook} title="No webhooks yet" hint="Add one to push events to another system." />}
          {hooks.map((h) => (
            <div key={h._id} className="px-4 py-4 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 flex items-center gap-2 flex-wrap">
                  {h.name}
                  <Pill className={h.active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'}>{h.active ? 'Active' : 'Off'}</Pill>
                  {h.failures > 0 && <Pill className="bg-red-100 text-red-700">{h.failures} failure(s)</Pill>}
                </p>
                <p className="text-sm text-slate-600 truncate">{h.url}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {h.events.join(', ')} · secret {h.secret}
                  {h.lastDeliveredAt ? ` · last ${formatDateTime(h.lastDeliveredAt)} → ${h.lastStatus ?? 'no response'}${h.lastError ? ` (${h.lastError})` : ''}` : ' · never delivered'}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="secondary" icon={Send} onClick={() => act(() => api.test(h._id), (r) => (r.result.ok ? `Test delivered (HTTP ${r.result.status})` : `Test failed: ${r.result.error}`))}>Test</Button>
                <Button variant="secondary" onClick={() => act(() => api.update(h._id, { active: !h.active }), h.active ? 'Webhook switched off' : 'Webhook switched on')}>{h.active ? 'Turn off' : 'Turn on'}</Button>
                <Button variant="secondary" icon={RotateCcw} onClick={() => window.confirm('Issue a new signing secret? The receiver must be updated with it.') && act(() => api.update(h._id, { rotateSecret: true }))}>New secret</Button>
                <Button variant="danger" icon={Trash2} onClick={() => window.confirm(`Delete ${h.name}?`) && act(() => api.remove(h._id), 'Webhook deleted')} />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="How a delivery looks">
        <div className="p-4 text-sm text-slate-700 space-y-2">
          <p>Each event is an HTTPS <code>POST</code> with a JSON body <code>{'{ event, occurredAt, data }'}</code> and these headers:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><code>X-TrackOwl-Event</code> — e.g. <code>trip.closed</code></li>
            <li><code>X-TrackOwl-Signature</code> — <code>sha256=</code> HMAC of the raw body with your signing secret. Verify it before trusting the request.</li>
            <li><code>X-TrackOwl-Delivery</code> — a unique id, to ignore a retried duplicate.</li>
          </ul>
          <p>Answer with any 2xx within 8 seconds. Failures are retried once; after 20 failures in a row the webhook switches itself off.</p>
          <p className="flex items-center gap-2 text-slate-600"><Mail className="w-4 h-4" /> Alert emails are set up under Tracking → Alerts &amp; Geofences → Alert Settings.</p>
        </div>
      </Panel>
    </PageShell>
  );
}
