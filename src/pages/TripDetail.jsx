import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Edit2, Play, Square, AlertTriangle, CheckCircle2, XCircle,
  PauseCircle, Truck, MapPin, Package, IndianRupee, TrendingUp, Navigation,
  Bell, ClipboardCheck, FileSignature, Paperclip, History, LayoutGrid,
} from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { usePermissions } from '../hooks/usePermissions';
import { tripOrders } from '../services/api';
import {
  TRIP_STATUS_LABELS, TRIP_STATUS_COLORS, TRIP_TYPE_LABELS,
  TERMINAL_STATUSES, formatCurrency, formatNumber, formatDate,
} from '../constants/trip';
import { TripOverviewTab } from '../components/trip/TripOverviewTab';
import { TripAssignmentTab } from '../components/trip/TripAssignmentTab';
import { TripStopsTab } from '../components/trip/TripStopsTab';
import { TripCargoTab } from '../components/trip/TripCargoTab';
import { TripMoneyTab } from '../components/trip/TripMoneyTab';
import { TripProfitabilityTab } from '../components/trip/TripProfitabilityTab';
import { TripTrackingTab } from '../components/trip/TripTrackingTab';
import { TripEventsTab } from '../components/trip/TripEventsTab';
import { TripChecklistTab } from '../components/trip/TripChecklistTab';
import { TripPodTab } from '../components/trip/TripPodTab';
import { TripDocumentsTab } from '../components/trip/TripDocumentsTab';
import { TripActivityTab } from '../components/trip/TripActivityTab';
import { StartEndTripModal } from '../components/trip/StartEndTripModal';

// The trip detail page — everything about one job, in tabs.
//
// The page holds the trip and passes a `reload` down to every tab. Each tab
// calls its own endpoint and then reloads, rather than the tabs mutating a
// shared local copy: the server recomputes totals, status and derived
// distances on every write, so re-reading is the only way the screen is
// guaranteed to match the record.
const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'assignment', label: 'Vehicle & Driver', icon: Truck },
  { id: 'stops', label: 'Stops', icon: MapPin },
  { id: 'cargo', label: 'Cargo', icon: Package },
  { id: 'money', label: 'Revenue & Expenses', icon: IndianRupee },
  { id: 'profitability', label: 'Profitability', icon: TrendingUp },
  { id: 'tracking', label: 'Tracking', icon: Navigation },
  { id: 'events', label: 'Events', icon: Bell },
  { id: 'checklist', label: 'Dispatch Checklist', icon: ClipboardCheck },
  { id: 'pod', label: 'POD', icon: FileSignature },
  { id: 'documents', label: 'Documents', icon: Paperclip },
  { id: 'activity', label: 'Activity', icon: History },
];

export function TripDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { can } = usePermissions();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // A banner for the outcome of the last action, so a status change or an
  // override says what happened instead of the page silently re-rendering.
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [startEndMode, setStartEndMode] = useState(null); // 'start' | 'end' | null

  const load = useCallback(async () => {
    try {
      const res = await tripOrders.get(id);
      setData(res);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load the trip');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  const trip = data?.trip;
  const canEdit = can('trips', 'update') && trip && !TERMINAL_STATUSES.includes(trip.status);

  const changeStatus = async (status, reason = '') => {
    setBusy(true);
    setNotice(null);
    try {
      await tripOrders.setStatus(id, status, { reason });
      await load();
      setNotice({ kind: 'success', text: `Trip moved to ${TRIP_STATUS_LABELS[status]}` });
    } catch (err) {
      // The API explains refusals in full — an incomplete checklist names the
      // items that are missing — so the message is shown rather than replaced
      // with something generic.
      setNotice({
        kind: 'error',
        text: err.message || 'Could not change the status',
        detail: err.data?.missingChecklistItems?.length
          ? `Outstanding: ${err.data.missingChecklistItems.join(', ')}`
          : null,
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <Topbar />
        <div className="flex-1 flex items-center justify-center text-slate-500">Loading trip...</div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <Topbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-slate-600">{error || 'Trip not found'}</p>
          <button
            onClick={() => navigate('/trips')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to trips
          </button>
        </div>
      </div>
    );
  }

  const allowed = data.allowedTransitions || [];
  const isRunning = Boolean(trip.start?.at) && !trip.end?.at;

  // The primary actions, decided by what the server says this trip may do next
  // rather than by the page's own reading of the status. `allowedTransitions`
  // comes straight from the state machine, so a button can never offer a move
  // the API would refuse.
  const actions = [];
  if (canEdit) {
    if (allowed.includes('planned')) actions.push({ label: 'Mark Planned', status: 'planned', icon: CheckCircle2, style: 'secondary' });
    if (allowed.includes('assigned')) actions.push({ label: 'Mark Assigned', status: 'assigned', icon: CheckCircle2, style: 'secondary' });
    if (allowed.includes('ready')) actions.push({ label: 'Mark Ready', status: 'ready', icon: CheckCircle2, style: 'secondary' });
    if (allowed.includes('dispatched')) actions.push({ label: 'Dispatch', status: 'dispatched', icon: Truck, style: 'primary' });
    if (allowed.includes('completed')) actions.push({ label: 'Complete Trip', status: 'completed', icon: CheckCircle2, style: 'primary' });
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-start gap-4">
              <button
                onClick={() => navigate('/trips')}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors mt-1"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-3xl font-bold text-slate-900">{trip.tripNumber}</h1>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      TRIP_STATUS_COLORS[trip.status] || 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {TRIP_STATUS_LABELS[trip.status]}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                    {TRIP_TYPE_LABELS[trip.tripType] || trip.tripType}
                  </span>
                </div>
                <p className="text-slate-600 mt-1">
                  {formatDate(trip.tripDate)}
                  {trip.customer?.name && <> · {trip.customer.name}</>}
                  {' · '}
                  {trip.pickup?.city || trip.pickup?.name || '—'}
                  <span className="text-slate-400 mx-1">→</span>
                  {trip.destination?.city || trip.destination?.name || '—'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {canEdit && (
                <button
                  onClick={() => navigate(`/trips/${id}/edit`)}
                  className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-white transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
              )}

              {/* Start and End are separate from the status buttons: they
                  capture odometer and fuel readings, which is a form, not a
                  one-click transition. */}
              {canEdit && !trip.start?.at && ['ready', 'dispatched'].includes(trip.status) && (
                <button
                  onClick={() => setStartEndMode('start')}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Start Trip
                </button>
              )}
              {canEdit && isRunning && (
                <button
                  onClick={() => setStartEndMode('end')}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Square className="w-4 h-4" />
                  End Trip
                </button>
              )}

              {actions.map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.status}
                    onClick={() => changeStatus(a.status)}
                    disabled={busy}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 ${
                      a.style === 'primary'
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'border border-slate-200 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {a.label}
                  </button>
                );
              })}

              {canEdit && allowed.includes('on_hold') && (
                <button
                  onClick={() => {
                    const reason = window.prompt('Why is this trip going on hold?');
                    if (reason !== null) changeStatus('on_hold', reason);
                  }}
                  disabled={busy}
                  className="flex items-center gap-2 px-3 py-2 border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-50"
                >
                  <PauseCircle className="w-4 h-4" />
                  Hold
                </button>
              )}

              {trip.status === 'on_hold' && can('trips', 'update') && trip.heldFrom && (
                <button
                  onClick={() => changeStatus(trip.heldFrom)}
                  disabled={busy}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  Resume ({TRIP_STATUS_LABELS[trip.heldFrom]})
                </button>
              )}

              {can('trips', 'update') && allowed.includes('cancelled') && (
                <button
                  onClick={() => {
                    const reason = window.prompt('Why is this trip being cancelled?');
                    if (reason !== null) changeStatus('cancelled', reason);
                  }}
                  disabled={busy}
                  className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  Cancel
                </button>
              )}
            </div>
          </div>

          {notice && (
            <div
              className={`flex items-start gap-3 text-sm rounded-lg px-4 py-3 border ${
                notice.kind === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {notice.kind === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0" />
              )}
              <div>
                <p>{notice.text}</p>
                {notice.detail && <p className="mt-1 opacity-80">{notice.detail}</p>}
              </div>
              <button onClick={() => setNotice(null)} className="ml-auto opacity-60 hover:opacity-100">
                ×
              </button>
            </div>
          )}

          {TERMINAL_STATUSES.includes(trip.status) && (
            <div className="bg-slate-100 border border-slate-200 text-slate-700 text-sm rounded-lg px-4 py-3">
              This trip is {TRIP_STATUS_LABELS[trip.status].toLowerCase()} and is kept as a record.
              It can no longer be changed.
            </div>
          )}

          {/* Headline numbers */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <SummaryTile label="Revenue" value={formatCurrency(trip.totals?.revenue)} />
            <SummaryTile label="Expenses" value={formatCurrency(trip.totals?.expenses)} />
            <SummaryTile
              label="Profit"
              value={formatCurrency(trip.totals?.profit)}
              tone={trip.totals?.profit > 0 ? 'good' : trip.totals?.profit < 0 ? 'bad' : 'neutral'}
            />
            <SummaryTile
              label="Margin"
              value={trip.totals?.revenue ? `${formatNumber(trip.totals?.marginPct)}%` : '—'}
            />
            <SummaryTile
              label="Distance"
              value={
                trip.actualKm != null
                  ? `${formatNumber(trip.actualKm)} km`
                  : trip.plannedKm != null
                    ? `~${formatNumber(trip.plannedKm)} km`
                    : '—'
              }
              hint={trip.actualKm != null ? 'Actual' : trip.plannedKm != null ? 'Planned' : null}
            />
          </div>

          {/* Tabs */}
          <div className="border-b border-slate-200 overflow-x-auto">
            <div className="flex gap-1 min-w-max">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 font-medium text-sm whitespace-nowrap transition-colors ${
                      active
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab body */}
          <div className="pb-8">
            {activeTab === 'overview' && <TripOverviewTab data={data} />}
            {activeTab === 'assignment' && (
              <TripAssignmentTab trip={trip} reload={load} canEdit={canEdit} />
            )}
            {activeTab === 'stops' && <TripStopsTab trip={trip} reload={load} canEdit={canEdit} />}
            {activeTab === 'cargo' && <TripCargoTab trip={trip} reload={load} canEdit={canEdit} />}
            {activeTab === 'money' && <TripMoneyTab trip={trip} reload={load} canEdit={canEdit} />}
            {activeTab === 'profitability' && <TripProfitabilityTab data={data} />}
            {activeTab === 'tracking' && <TripTrackingTab tripId={id} />}
            {activeTab === 'events' && <TripEventsTab trip={trip} reload={load} canEdit={can('trips', 'update')} />}
            {activeTab === 'checklist' && (
              <TripChecklistTab trip={trip} reload={load} canEdit={canEdit} />
            )}
            {activeTab === 'pod' && (
              <TripPodTab trip={trip} data={data} reload={load} canEdit={can('trips', 'update')} />
            )}
            {activeTab === 'documents' && (
              <TripDocumentsTab trip={trip} reload={load} canEdit={can('trips', 'update')} />
            )}
            {activeTab === 'activity' && <TripActivityTab tripId={id} />}
          </div>
        </div>
      </main>

      {startEndMode && (
        <StartEndTripModal
          mode={startEndMode}
          trip={trip}
          onClose={() => setStartEndMode(null)}
          onDone={async (message) => {
            setStartEndMode(null);
            await load();
            setNotice({ kind: 'success', text: message });
          }}
        />
      )}
    </div>
  );
}

function SummaryTile({ label, value, tone = 'neutral', hint }) {
  const toneClass =
    tone === 'good' ? 'text-green-600' : tone === 'bad' ? 'text-red-600' : 'text-slate-900';
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`text-xl font-bold mt-1 ${toneClass}`}>{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
    </div>
  );
}
