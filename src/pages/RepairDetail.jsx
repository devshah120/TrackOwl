import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Check, Clock, Wrench, Trash2, Edit2, X, AlertTriangle, IndianRupee,
} from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { usePermissions } from '../hooks/usePermissions';
import { maintenance as api } from '../services/api';
import {
  Panel, Banner, RepairStatusPill, PriorityPill, EmptyState,
} from '../components/maintenance/MaintenanceUI';
import {
  REPAIR_FLOW, REPAIR_STATUS_LABELS, REPAIR_TRANSITIONS,
  formatMoney, formatDate, formatDateTime, formatHours, formatOdometer,
} from '../constants/maintenance';

// M3-M05 — one repair, and the workflow that moves it.
//
// The status buttons are built from REPAIR_TRANSITIONS rather than being a
// fixed set, so the user is only ever offered a move the server would accept.
// The server checks it again regardless — the UI reading the same table is a
// convenience, not the enforcement.
//
// The timeline below is the job's own history, not the audit trail. How long a
// vehicle sat waiting for a part is a maintenance question the reports answer,
// so it lives on the record where it can be queried.
export function RepairDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { can } = usePermissions();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [moving, setMoving] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.repairs.get(id);
      setRequest(res.request);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load that repair request');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  const move = async (status, note) => {
    try {
      const res = await api.repairs.setStatus(id, status, note);
      setRequest(res.request);
      setMoving(null);
      setNotice(
        status === 'Completed'
          ? 'Repair completed. The vehicle is released unless another job is still open on it.'
          : `Moved to ${REPAIR_STATUS_LABELS[status] || status}.`
      );
    } catch (err) {
      setError(err.message || 'Could not move the repair');
      setMoving(null);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete repair ${request.requestNumber}? This cannot be undone.`)) return;
    try {
      await api.repairs.remove(id);
      navigate('/maintenance/repairs');
    } catch (err) {
      setError(err.message || 'Could not delete that repair request');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <Topbar />
        <main className="flex-1 flex items-center justify-center text-slate-500">
          Loading the repair request…
        </main>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <Topbar />
        <main className="flex-1 p-6">
          <Banner tone="error" message={error || 'That repair request could not be found'} />
        </main>
      </div>
    );
  }

  const nextStates = REPAIR_TRANSITIONS[request.status] || [];
  const overEstimate =
    request.estimatedCost && request.totalCost > request.estimatedCost
      ? request.totalCost - request.estimatedCost
      : 0;

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full max-w-5xl mx-auto space-y-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-start gap-3">
              <button
                onClick={() => navigate('/maintenance/repairs')}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-3xl font-bold text-slate-900">{request.requestNumber}</h1>
                  <RepairStatusPill status={request.status} />
                  <PriorityPill priority={request.priority} />
                </div>
                <p className="text-slate-600 mt-1">
                  {request.vehicleNumber}
                  {request.truck?.model ? ` · ${request.truck.model}` : ''} · reported{' '}
                  {formatDate(request.reportedAt)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {can('maintenance', 'update') && (
                <button
                  onClick={() => navigate(`/maintenance/repairs/${id}/edit`)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  <Edit2 className="w-4 h-4" /> Edit
                </button>
              )}
              {can('maintenance', 'delete') && (
                <button
                  onClick={remove}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              )}
            </div>
          </div>

          <Banner tone="error" message={error} onDismiss={() => setError('')} />
          <Banner tone="success" message={notice} onDismiss={() => setNotice('')} />

          {/* M3-M05 — the workflow. */}
          <Panel title="Progress">
            <div className="p-4 space-y-4">
              <Stepper status={request.status} />

              {can('maintenance', 'update') && nextStates.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                  <span className="text-sm text-slate-600">Move to:</span>
                  {nextStates.map((state) => (
                    <button
                      key={state}
                      onClick={() => setMoving(state)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        state === 'Cancelled'
                          ? 'border border-red-200 text-red-600 hover:bg-red-50'
                          : state === 'Completed'
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {REPAIR_STATUS_LABELS[state] || state}
                    </button>
                  ))}
                </div>
              )}

              {nextStates.length === 0 && (
                <p className="text-sm text-slate-500 pt-2 border-t border-slate-100">
                  This repair is {REPAIR_STATUS_LABELS[request.status]?.toLowerCase()} and cannot be
                  moved again. A fault that comes back is a new request, so the two visits stay
                  separate in the cost history.
                </p>
              )}
            </div>
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* What is wrong, and what was found. */}
              <Panel title="The fault">
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Reported issue</p>
                    <p className="text-sm text-slate-900 mt-1 whitespace-pre-wrap">{request.issue}</p>
                  </div>
                  {request.diagnosis ? (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">Diagnosis</p>
                      <p className="text-sm text-slate-900 mt-1 whitespace-pre-wrap">{request.diagnosis}</p>
                    </div>
                  ) : null}
                  {request.workDone ? (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">Work done</p>
                      <p className="text-sm text-slate-900 mt-1 whitespace-pre-wrap">{request.workDone}</p>
                    </div>
                  ) : null}
                  {request.notes ? (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">Notes</p>
                      <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{request.notes}</p>
                    </div>
                  ) : null}
                </div>
              </Panel>

              {/* Parts and labour. */}
              <Panel title="Parts and labour">
                {request.parts?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Part</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Qty</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Rate</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {request.parts.map((part, i) => (
                          <tr key={part._id || i}>
                            <td className="px-4 py-2">
                              <p className="text-sm text-slate-900">{part.name}</p>
                              {part.partNumber ? (
                                <p className="text-xs text-slate-500">{part.partNumber}</p>
                              ) : null}
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-slate-700">{part.quantity}</td>
                            <td className="px-4 py-2 text-right text-sm text-slate-700">
                              {formatMoney(part.unitPrice, { decimals: 2 })}
                            </td>
                            <td className="px-4 py-2 text-right text-sm font-medium text-slate-900">
                              {formatMoney(part.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState icon={Wrench} title="No parts recorded" hint="This was labour-only work." />
                )}
              </Panel>

              {/* The job's own timeline (M3-M05). */}
              <Panel title="Timeline" subtitle="Every state this job has been in">
                <div className="p-4">
                  <ol className="space-y-3">
                    {(request.history || []).map((entry, i) => (
                      <li key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                          {i < request.history.length - 1 && (
                            <div className="w-px flex-1 bg-slate-200 my-1" />
                          )}
                        </div>
                        <div className="pb-2 min-w-0">
                          <p className="text-sm font-medium text-slate-900">
                            {REPAIR_STATUS_LABELS[entry.status] || entry.status}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDateTime(entry.at)}
                            {entry.byName ? ` · ${entry.byName}` : ''}
                          </p>
                          {entry.note ? (
                            <p className="text-sm text-slate-700 mt-1">{entry.note}</p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </Panel>
            </div>

            {/* The money and the facts, down the side. */}
            <div className="space-y-6">
              <Panel title="Cost">
                <div className="p-4 space-y-2">
                  <Line label="Parts" value={formatMoney(request.partsTotal)} />
                  <Line label="Labour" value={formatMoney(request.labourCost)} />
                  {request.taxAmount ? <Line label="Tax" value={formatMoney(request.taxAmount)} /> : null}
                  {request.discount ? (
                    <Line label="Discount" value={`− ${formatMoney(request.discount)}`} />
                  ) : null}
                  <div className="pt-2 border-t border-slate-200">
                    <Line label="Total" value={formatMoney(request.totalCost)} strong />
                  </div>

                  {request.estimatedCost ? (
                    <div className="pt-2 mt-2 border-t border-slate-100">
                      <Line label="Estimated" value={formatMoney(request.estimatedCost)} />
                      {/* The variance is the number somebody has to explain, so
                          it is called out rather than left to be worked out. */}
                      {overEstimate > 0 ? (
                        <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                          <AlertTriangle className="w-3 h-3" />
                          {formatMoney(overEstimate)} over estimate
                        </p>
                      ) : request.totalCost > 0 ? (
                        <p className="text-xs text-green-700 flex items-center gap-1 mt-1">
                          <Check className="w-3 h-3" /> within estimate
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {request.paymentMode ? (
                    <p className="text-xs text-slate-500 pt-2 flex items-center gap-1">
                      <IndianRupee className="w-3 h-3" />
                      paid by {request.paymentMode}
                      {request.invoiceNumber ? ` · invoice ${request.invoiceNumber}` : ''}
                    </p>
                  ) : null}
                </div>
              </Panel>

              <Panel title="Details">
                <div className="p-4 space-y-3 text-sm">
                  <Detail label="Vehicle" value={request.vehicleNumber} />
                  <Detail label="Odometer" value={formatOdometer(request.odometer)} />
                  <Detail label="Reported by" value={request.reportedByName || '—'} />
                  <Detail label="Reported" value={formatDateTime(request.reportedAt)} />
                  <Detail label="Workshop" value={request.workshop?.name || '—'} />
                  {request.workshop?.city ? (
                    <Detail label="Location" value={request.workshop.city} />
                  ) : null}
                  {request.approvedAt ? (
                    <Detail label="Approved" value={formatDateTime(request.approvedAt)} />
                  ) : null}
                  {request.completedAt ? (
                    <Detail label="Completed" value={formatDateTime(request.completedAt)} />
                  ) : null}
                  {request.downtimeHours !== null && request.downtimeHours !== undefined ? (
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Downtime
                      </p>
                      <p className="text-lg font-semibold text-slate-900">
                        {formatHours(request.downtimeHours)}
                      </p>
                      <p className="text-xs text-slate-400">measured from approval</p>
                    </div>
                  ) : null}
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </main>

      {moving && (
        <StatusModal
          status={moving}
          onClose={() => setMoving(null)}
          onSubmit={(note) => move(moving, note)}
        />
      )}
    </div>
  );
}

// The workflow as a line. Cancelled is deliberately not drawn: it is an exit,
// not a step, and putting it in the line would suggest every job goes through
// it.
function Stepper({ status }) {
  if (status === 'Cancelled') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
        This request was cancelled — the fault was raised in error, or cleared on its own.
      </div>
    );
  }

  const current = REPAIR_FLOW.indexOf(status);

  return (
    <ol className="flex items-center gap-1 overflow-x-auto">
      {REPAIR_FLOW.map((state, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={state} className="flex items-center gap-1 shrink-0">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
                active
                  ? 'bg-blue-600 text-white'
                  : done
                    ? 'bg-green-50 text-green-700'
                    : 'bg-slate-50 text-slate-400'
              }`}
            >
              {done ? <Check className="w-3 h-3" /> : null}
              {REPAIR_STATUS_LABELS[state]}
            </div>
            {i < REPAIR_FLOW.length - 1 && (
              <div className={`w-4 h-px ${done ? 'bg-green-300' : 'bg-slate-200'}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Line({ label, value, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={`text-sm ${strong ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
        {label}
      </span>
      <span className={strong ? 'text-lg font-bold text-slate-900' : 'text-sm text-slate-800'}>
        {value}
      </span>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="text-slate-900 text-right">{value}</span>
    </div>
  );
}

// Moving a job asks for a note. Not required — plenty of transitions need no
// explanation — but the prompt is there because "waiting for the part, ETA
// Tuesday" is exactly what the next person to open this needs.
function StatusModal({ status, onClose, onSubmit }) {
  const [note, setNote] = useState('');

  const prompts = {
    Approved: 'e.g. Quote accepted at ₹12,000 — go ahead.',
    'In Repair': 'e.g. Vehicle in at Sharma Motors this morning.',
    'Waiting Parts': 'e.g. Waiting on the clutch plate, ETA Tuesday.',
    Completed: 'e.g. Clutch replaced and road tested.',
    Cancelled: 'e.g. Fault cleared on its own — no work needed.',
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Move to {REPAIR_STATUS_LABELS[status] || status}
            </h2>
            {status === 'Completed' && (
              <p className="text-sm text-slate-600 mt-1">
                Downtime is measured from approval to now, and the vehicle is released unless
                another job is still open on it.
              </p>
            )}
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Note <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder={prompts[status] || ''}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            This is added to the job’s timeline, where anyone reading the repair can see it.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(note)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
