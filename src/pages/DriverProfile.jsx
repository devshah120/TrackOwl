import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit2, Route, Gauge, Wallet, HandCoins, AlertTriangle, FileText, Plus, Paperclip, Trash2, CheckCircle2 } from 'lucide-react';
import { PageShell, PageHeader, StatTile, Panel, Banner, Button, Pill, EmptyState, Modal, Th, Td } from '../components/business/BusinessUI';
import { formatCurrency, formatDate, formatNumber, inputClass, toISODate, readFileAsDataUrl } from '../components/business/helpers';
import { TRIP_STATUS_LABELS, TRIP_STATUS_COLORS } from '../constants/trip';
import { driverInsights } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';

// One driver's complete record (brief §6): trips, distance, allowances,
// advances and what is still owed, plus their documents. The balance per trip
// uses the same arithmetic as the trip's Settlement tab.
const KIND_LABELS = { advance: 'Advance', settlement_payment: 'Balance paid', recovery: 'Recovered' };

const expiryTone = (date) => {
  if (!date) return { label: 'No expiry', cls: 'bg-slate-100 text-slate-600' };
  const days = Math.ceil((new Date(date) - Date.now()) / 86400000);
  if (days < 0) return { label: `Expired ${-days}d ago`, cls: 'bg-red-100 text-red-700' };
  if (days <= 30) return { label: `${days}d left`, cls: 'bg-amber-100 text-amber-800' };
  return { label: 'Valid', cls: 'bg-green-100 text-green-800' };
};

export function DriverProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [incidentDraft, setIncidentDraft] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await driverInsights.profile(id));
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  if (!data) {
    return (
      <PageShell>
        <Banner message={error} />
        {!error && <p className="text-sm text-slate-500">Loading driver…</p>}
      </PageShell>
    );
  }

  const { driver, totals, trips, payments, documents, performance = [], incidents = [], incidentTypes = [] } = data;
  const typeLabel = (v) => incidentTypes.find((t) => t.value === v)?.label || v;
  const licence = expiryTone(driver.licenseExpiry);

  return (
    <PageShell>
      <button type="button" onClick={() => navigate('/drivers')} className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="w-4 h-4" /> Drivers
      </button>
      <PageHeader
        title={driver.name}
        subtitle={[driver.mobile, driver.licenseNumber && `DL ${driver.licenseNumber}`, driver.truck?.number && `on ${driver.truck.number}`, driver.status].filter(Boolean).join(' · ')}
        actions={
          can('drivers', 'update') ? (
            <Button variant="secondary" icon={Edit2} onClick={() => navigate(`/add-new-driver/${driver._id}`)}>
              Edit driver
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatTile label="Trips" value={totals.trips} icon={Route} bg="bg-blue-50" fg="text-blue-600" />
        <StatTile label="Distance" value={`${formatNumber(totals.km)} km`} icon={Gauge} />
        <StatTile label="Allowances" value={formatCurrency(totals.allowance)} icon={HandCoins} />
        <StatTile label="Pending balance" value={formatCurrency(totals.pendingBalance)} hint={totals.pendingBalance > 0 ? 'Owed to the driver' : totals.pendingBalance < 0 ? 'Driver holds unspent advance' : 'Settled'} icon={Wallet} bg={totals.pendingBalance ? 'bg-amber-50' : 'bg-green-50'} fg={totals.pendingBalance ? 'text-amber-600' : 'text-green-600'} />
        <StatTile
          label="Incidents"
          value={totals.incidents + (totals.recordedIncidents || 0)}
          hint={`${totals.incidents} GPS · ${totals.recordedIncidents || 0} recorded${totals.toRecover ? ` · ${formatCurrency(totals.toRecover)} to recover` : ''}`}
          icon={AlertTriangle}
          bg={totals.incidents || totals.recordedIncidents ? 'bg-red-50' : 'bg-slate-50'}
          fg={totals.incidents || totals.recordedIncidents ? 'text-red-600' : 'text-slate-600'}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Panel
          title="Incidents & violations"
          subtitle="Challans, accidents, damage and complaints recorded against this driver"
          className="lg:col-span-2"
          action={can('drivers', 'update') ? <Button icon={Plus} onClick={() => setIncidentDraft({})}>Record</Button> : null}
        >
          <div className="divide-y divide-slate-100">
            {incidents.length === 0 && <EmptyState icon={CheckCircle2} title="Nothing recorded" hint="A clean record." />}
            {incidents.map((inc) => (
              <div key={inc._id} className="px-4 py-3 flex items-start gap-3">
                <Pill className={inc.severity === 'critical' ? 'bg-red-100 text-red-700' : inc.severity === 'major' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}>{inc.severity}</Pill>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {typeLabel(inc.type)}
                    {inc.status === 'resolved' ? <Pill className="ml-2 bg-green-100 text-green-800">Resolved</Pill> : null}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(inc.occurredAt)}
                    {inc.location ? ` · ${inc.location}` : ''}
                    {inc.truck?.number ? ` · ${inc.truck.number}` : ''}
                    {inc.tripOrder?.tripNumber ? ` · trip ${inc.tripOrder.tripNumber}` : ''}
                    {inc.reference ? ` · ref ${inc.reference}` : ''}
                  </p>
                  {inc.description && <p className="text-sm text-slate-600 mt-0.5">{inc.description}</p>}
                  {inc.fineAmount > 0 && (
                    <p className="text-xs text-slate-600 mt-0.5">
                      Fine {formatCurrency(inc.fineAmount)}
                      {inc.recoverableAmount > 0 ? ` · driver bears ${formatCurrency(inc.recoverableAmount)}, recovered ${formatCurrency(inc.recoveredAmount)}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  {inc.attachment?.filename && (
                    <button type="button" aria-label="Open document" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" onClick={() => driverInsights.incidentAttachment(driver._id, inc._id).then((r) => window.open(r.attachment.dataUrl, '_blank', 'noopener')).catch((e) => setError(e.message))}>
                      <Paperclip className="w-4 h-4" />
                    </button>
                  )}
                  {can('drivers', 'update') && (
                    <button type="button" aria-label="Edit" className="p-1.5 text-slate-600 hover:bg-slate-100 rounded" onClick={() => setIncidentDraft(inc)}>
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {can('drivers', 'delete') && (
                    <button type="button" aria-label="Delete" className="p-1.5 text-red-600 hover:bg-red-50 rounded" onClick={() => window.confirm('Remove this incident?') && driverInsights.removeIncident(driver._id, inc._id).then(load).catch((e) => setError(e.message))}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Performance — last 6 months">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <Th>Month</Th>
                  <Th right>Trips</Th>
                  <Th right>KM</Th>
                  <Th right>GPS events</Th>
                  <Th right>Incidents</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {performance.map((m) => (
                  <tr key={m.month}>
                    <Td>{m.label}</Td>
                    <Td right>{m.trips}</Td>
                    <Td right>{formatNumber(m.km)}</Td>
                    <Td right className={m.gpsEvents ? 'text-amber-700' : ''}>{m.gpsEvents}</Td>
                    <Td right className={m.incidents ? 'text-red-600 font-medium' : ''}>{m.incidents}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2 text-xs text-slate-500">GPS events: overspeed, prolonged idling and route deviations logged on the driver&apos;s trips.</p>
        </Panel>
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <Panel title="Trip history" className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <Th>Trip</Th>
                  <Th>Date</Th>
                  <Th>Route</Th>
                  <Th>Status</Th>
                  <Th right>KM</Th>
                  <Th right>Allowance</Th>
                  <Th right>Advance</Th>
                  <Th right>Balance</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trips.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState icon={Route} title="No trips yet" />
                    </td>
                  </tr>
                )}
                {trips.map((t) => (
                  <tr key={t._id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/trips/${t._id}`)}>
                    <Td className="font-medium text-blue-700">
                      {t.tripNumber}
                      {t.incidents ? <AlertTriangle className="w-3.5 h-3.5 inline ml-1 text-red-500" /> : null}
                    </Td>
                    <Td>{formatDate(t.tripDate)}</Td>
                    <Td>{t.route}</Td>
                    <Td>
                      <Pill className={TRIP_STATUS_COLORS[t.status]}>{TRIP_STATUS_LABELS[t.status] || t.status}</Pill>
                    </Td>
                    <Td right>{formatNumber(t.actualKm)}</Td>
                    <Td right>{formatCurrency(t.allowance)}</Td>
                    <Td right>{formatCurrency(t.advances)}</Td>
                    <Td right className={t.balance ? 'font-semibold text-amber-700' : ''}>{formatCurrency(t.balance)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Documents">
            <div className="divide-y divide-slate-100">
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <span>Driving licence</span>
                <Pill className={licence.cls}>{driver.licenseExpiry ? `${formatDate(driver.licenseExpiry)} · ${licence.label}` : licence.label}</Pill>
              </div>
              {documents.map((d) => {
                const tone = expiryTone(d.expiryDate);
                return (
                  <div key={d._id} className="flex items-center justify-between px-4 py-3 text-sm gap-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate">{d.docType}{d.documentNumber ? ` · ${d.documentNumber}` : ''}</span>
                    </span>
                    <Pill className={tone.cls}>{tone.label}</Pill>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Payments to / from driver">
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {payments.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-500">None recorded.</p>}
              {payments.map((p) => (
                <div key={p._id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span>
                    {KIND_LABELS[p.kind]} · {formatDate(p.paidAt)}
                    <span className="block text-xs text-slate-500">Trip {p.tripNumber}{p.reference ? ` · ${p.reference}` : ''}</span>
                  </span>
                  <span className={`tabular-nums ${p.kind === 'recovery' ? 'text-green-700' : 'text-slate-900'}`}>{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
      {incidentDraft && (
        <IncidentModal
          key={incidentDraft._id || 'new'}
          draft={incidentDraft}
          types={incidentTypes}
          onClose={() => setIncidentDraft(null)}
          onSave={async (payload) => {
            if (incidentDraft._id) await driverInsights.updateIncident(driver._id, incidentDraft._id, payload);
            else await driverInsights.addIncident(driver._id, payload);
            setIncidentDraft(null);
            await load();
          }}
        />
      )}
    </PageShell>
  );
}

// Record or edit one incident. Mounted only while open and keyed by record, so
// the form starts from the record via the useState initialiser.
function IncidentModal({ draft, types, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    type: draft.type || 'traffic_challan',
    severity: draft.severity || 'minor',
    occurredAt: toISODate(draft.occurredAt || new Date()),
    location: draft.location || '',
    reference: draft.reference || '',
    description: draft.description || '',
    fineAmount: draft.fineAmount ?? '',
    recoverableAmount: draft.recoverableAmount ?? '',
    recoveredAmount: draft.recoveredAmount ?? '',
    status: draft.status || 'open',
    resolution: draft.resolution || '',
    attachment: null,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await onSave({
        ...form,
        fineAmount: Number(form.fineAmount) || 0,
        recoverableAmount: Number(form.recoverableAmount) || 0,
        recoveredAmount: Number(form.recoveredAmount) || 0,
        attachment: form.attachment || undefined,
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      wide
      title={draft._id ? 'Edit incident' : 'Record an incident'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button busy={busy} onClick={save}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Banner message={error} />
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-sm text-slate-700 sm:col-span-2">
            What happened
            <select value={form.type} onChange={(e) => set('type', e.target.value)} className={inputClass}>
              {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Severity
            <select value={form.severity} onChange={(e) => set('severity', e.target.value)} className={inputClass}>
              <option value="minor">Minor</option>
              <option value="major">Major</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">Date<input type="date" value={form.occurredAt} onChange={(e) => set('occurredAt', e.target.value)} className={inputClass} /></label>
          <label className="text-sm text-slate-700">Place<input value={form.location} onChange={(e) => set('location', e.target.value)} className={inputClass} /></label>
          <label className="text-sm text-slate-700">Challan / FIR / claim no.<input value={form.reference} onChange={(e) => set('reference', e.target.value)} className={inputClass} /></label>
        </div>
        <label className="text-sm text-slate-700 block">Details<textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} className={inputClass} /></label>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-sm text-slate-700">Fine / cost (₹)<input type="number" min={0} value={form.fineAmount} onChange={(e) => set('fineAmount', e.target.value)} className={inputClass} /></label>
          <label className="text-sm text-slate-700">Driver to bear (₹)<input type="number" min={0} value={form.recoverableAmount} onChange={(e) => set('recoverableAmount', e.target.value)} className={inputClass} /></label>
          <label className="text-sm text-slate-700">Recovered so far (₹)<input type="number" min={0} value={form.recoveredAmount} onChange={(e) => set('recoveredAmount', e.target.value)} className={inputClass} /></label>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-sm text-slate-700">
            Status
            <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputClass}>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
          <label className="text-sm text-slate-700 sm:col-span-2">Resolution<input value={form.resolution} onChange={(e) => set('resolution', e.target.value)} className={inputClass} placeholder="e.g. Challan paid online, deducted from salary" /></label>
        </div>
        <label className="text-sm text-slate-700 block">
          Challan / photo (optional)
          <input type="file" accept="image/*,application/pdf" className="block mt-1 text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (f) set('attachment', await readFileAsDataUrl(f)); }} />
        </label>
      </div>
    </Modal>
  );
}
