import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench, AlertTriangle, IndianRupee, Truck, Disc3, BatteryCharging,
  Plus, BarChart3, Settings2, CalendarClock, Clock, ClipboardList,
} from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { usePermissions } from '../hooks/usePermissions';
import { maintenance as api } from '../services/api';
import {
  StatTile, Panel, ReminderRow, RepairRow, EmptyState, Banner,
} from '../components/maintenance/MaintenanceUI';
import { formatMoney, formatNumber, formatHours, formatDate } from '../constants/maintenance';

// M3-M01 — the maintenance dashboard.
//
// Upcoming service, overdue service, vehicles under repair, maintenance cost,
// and tyre/battery status. One API call builds all of it: the figures have to
// describe the same moment, and six independent requests would let the cost
// tile and the reminder list disagree about what today is.
//
// Every number here arrives computed. Nothing on this page divides one figure
// by another or decides for itself whether a service is overdue — that
// judgement lives in services/maintenanceReminders.js, where the thresholds
// are, so the dashboard and the reminders screen can never reach different
// verdicts about the same vehicle.
export function MaintenanceDashboard() {
  const navigate = useNavigate();
  const { can } = usePermissions();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.dashboard();
      setData(res);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load the maintenance dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  // Wrapped in an async IIFE so the loader's first setState lands in a
  // continuation rather than synchronously in the effect body.
  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  // Where a reminder leads. Each kind has its own register, and the vehicle
  // filter carries across so the user lands on the rows they clicked, not on
  // the whole list.
  const openReminder = (reminder) => {
    if (reminder.kind === 'service') navigate(`/maintenance/services?truck=${reminder.truck || ''}`);
    else if (reminder.kind === 'tyre') navigate(`/maintenance/tyres/${reminder.sourceId}`);
    else navigate(`/maintenance/batteries?truck=${reminder.truck || ''}`);
  };

  const counts = data?.reminders?.counts;
  const cost = data?.cost;
  const repairs = data?.repairs;

  // Tyre and battery status arrive as a status-keyed map, since a fleet may
  // hold none of a given status and the server does not pad it out.
  const tyres = data?.tyres || {};
  const batteries = data?.batteries || {};
  const tyreCount = (status) => tyres[status]?.count || 0;
  const batteryCount = (status) => batteries[status]?.count || 0;

  // How much of the fleet is actually available. The one figure on this page
  // that a manager acts on immediately.
  const grounded = repairs?.groundedVehicles ?? 0;
  const fleetSize = repairs?.fleetSize ?? 0;

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Maintenance</h1>
              <p className="text-slate-600 mt-1">
                Service schedule, repairs, and the tyres and batteries on the fleet
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => navigate('/maintenance/reports')}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                Reports
              </button>
              {can('maintenance', 'manage') && (
                <button
                  onClick={() => navigate('/maintenance/settings')}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  title="Reminder thresholds"
                >
                  <Settings2 className="w-4 h-4" />
                  Reminders
                </button>
              )}
              {can('maintenance', 'create') && (
                <>
                  <button
                    onClick={() => navigate('/maintenance/repairs/new')}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <Wrench className="w-4 h-4" />
                    Report Fault
                  </button>
                  <button
                    onClick={() => navigate('/maintenance/services/new')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Record Service
                  </button>
                </>
              )}
            </div>
          </div>

          <Banner tone="error" message={error} onDismiss={() => setError('')} />

          {loading && !data ? (
            <div className="bg-white rounded-lg border border-slate-200 p-10 text-center text-slate-500">
              Loading the maintenance dashboard…
            </div>
          ) : (
            <>
              {/* The stat strip. Overdue leads, because it is the only one of
                  these that means something is already wrong. */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatTile
                  label="Overdue"
                  value={counts ? counts.overdue : '—'}
                  hint="past due date or reading"
                  icon={AlertTriangle}
                  bg={counts?.overdue ? 'bg-red-50' : 'bg-slate-50'}
                  fg={counts?.overdue ? 'text-red-600' : 'text-slate-400'}
                  onClick={() => navigate('/maintenance/reminders?status=overdue')}
                />
                <StatTile
                  label="Due soon"
                  value={counts ? counts.due : '—'}
                  hint="inside the reminder window"
                  icon={CalendarClock}
                  bg={counts?.due ? 'bg-amber-50' : 'bg-slate-50'}
                  fg={counts?.due ? 'text-amber-600' : 'text-slate-400'}
                  onClick={() => navigate('/maintenance/reminders?status=due')}
                />
                <StatTile
                  label="Under repair"
                  value={repairs ? grounded : '—'}
                  // Vehicles, not jobs: one truck with three open faults is one
                  // truck off the road.
                  hint={fleetSize ? `of ${fleetSize} vehicles` : 'vehicles off the road'}
                  icon={Truck}
                  bg={grounded ? 'bg-orange-50' : 'bg-slate-50'}
                  fg={grounded ? 'text-orange-600' : 'text-slate-400'}
                  onClick={() => navigate('/maintenance/repairs?open=true')}
                />
                <StatTile
                  label="Open jobs"
                  value={repairs ? repairs.open : '—'}
                  hint={cost ? `${formatHours(cost.downtimeHours)} downtime, 12 mo` : ''}
                  icon={ClipboardList}
                  bg="bg-indigo-50"
                  fg="text-indigo-600"
                  onClick={() => navigate('/maintenance/repairs?open=true')}
                />
                <StatTile
                  label="Spend, 12 months"
                  value={cost ? formatMoney(cost.total) : '—'}
                  hint={
                    cost
                      ? `${formatMoney(cost.services)} service · ${formatMoney(cost.repairs)} repair`
                      : ''
                  }
                  icon={IndianRupee}
                  bg="bg-green-50"
                  fg="text-green-600"
                  onClick={() => navigate('/maintenance/reports')}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* M3-M10 — what needs doing, worst first. */}
                <Panel
                  title="Needs attention"
                  subtitle={
                    counts
                      ? `${counts.total} outstanding · ${counts.service} service, ${counts.tyre} tyre, ${counts.battery} battery`
                      : ''
                  }
                  action={
                    <button
                      onClick={() => navigate('/maintenance/reminders')}
                      className="text-sm text-blue-600 hover:text-blue-700 shrink-0"
                    >
                      View all
                    </button>
                  }
                >
                  {data?.reminders?.items?.length ? (
                    <div>
                      {data.reminders.items.map((reminder) => (
                        <ReminderRow
                          key={`${reminder.kind}-${reminder.sourceId}`}
                          reminder={reminder}
                          onOpen={openReminder}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={CalendarClock}
                      title="Nothing is due"
                      hint="Every vehicle is inside its service window, and no tyre or battery needs replacing."
                    />
                  )}
                </Panel>

                {/* M3-M04 — the workshop queue. */}
                <Panel
                  title="Open repairs"
                  subtitle={repairs ? `${repairs.active} in progress of ${repairs.open} open` : ''}
                  action={
                    <button
                      onClick={() => navigate('/maintenance/repairs?open=true')}
                      className="text-sm text-blue-600 hover:text-blue-700 shrink-0"
                    >
                      View all
                    </button>
                  }
                >
                  {repairs?.items?.length ? (
                    <div>
                      {repairs.items.map((request) => (
                        <RepairRow
                          key={request._id}
                          request={request}
                          onOpen={(r) => navigate(`/maintenance/repairs/${r._id}`)}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Wrench}
                      title="No open repairs"
                      hint="Every reported fault has been dealt with."
                    />
                  )}
                </Panel>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* M3-M06 — tyre stock at a glance. */}
                <Panel
                  title="Tyres"
                  action={
                    <button
                      onClick={() => navigate('/maintenance/tyres')}
                      className="text-sm text-blue-600 hover:text-blue-700 shrink-0"
                    >
                      Open register
                    </button>
                  }
                >
                  <div className="p-4 grid grid-cols-2 gap-3">
                    <Figure label="On vehicles" value={tyreCount('Fitted') + tyreCount('Retreaded')} icon={Disc3} />
                    <Figure label="In stock" value={tyreCount('In Stock')} />
                    <Figure label="Removed" value={tyreCount('Removed')} />
                    <Figure label="Scrapped" value={tyreCount('Scrapped') + tyreCount('Sold')} />
                  </div>
                </Panel>

                {/* M3-M09 — battery stock at a glance. */}
                <Panel
                  title="Batteries"
                  action={
                    <button
                      onClick={() => navigate('/maintenance/batteries')}
                      className="text-sm text-blue-600 hover:text-blue-700 shrink-0"
                    >
                      Open register
                    </button>
                  }
                >
                  <div className="p-4 grid grid-cols-2 gap-3">
                    <Figure label="Fitted" value={batteryCount('Fitted')} icon={BatteryCharging} />
                    <Figure label="In stock" value={batteryCount('In Stock')} />
                    <Figure label="Removed" value={batteryCount('Removed')} />
                    <Figure label="Warranty claims" value={batteryCount('Warranty Claim')} />
                  </div>
                </Panel>

                {/* The cost split. Where the money went, and how much of it was
                    work nobody planned for. */}
                <Panel title="Cost, last 12 months" subtitle={data?.period ? `${formatDate(data.period.from)} — ${formatDate(data.period.to)}` : ''}>
                  <div className="p-4 space-y-3">
                    <CostLine
                      label="Scheduled service"
                      value={cost ? formatMoney(cost.services) : '—'}
                      hint={cost ? `${cost.serviceCount} visits` : ''}
                    />
                    <CostLine
                      label="Repairs"
                      value={cost ? formatMoney(cost.repairs) : '—'}
                      hint={cost ? `${cost.repairCount} completed` : ''}
                    />
                    <div className="pt-3 border-t border-slate-200">
                      <CostLine
                        label="Total"
                        value={cost ? formatMoney(cost.total) : '—'}
                        strong
                      />
                    </div>
                    {/* The most telling number on the page: a fleet whose repair
                        spend dwarfs its service spend is one that is not
                        servicing enough. */}
                    {cost && cost.total > 0 ? (
                      <div className="pt-2">
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                          <span>Unplanned share</span>
                          <span>{formatNumber((cost.repairs / cost.total) * 100, { decimals: 0 })}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded overflow-hidden">
                          <div
                            className="h-full bg-orange-400"
                            style={{ width: `${Math.min(100, (cost.repairs / cost.total) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : null}
                    {cost?.downtimeHours ? (
                      <p className="text-xs text-slate-500 flex items-center gap-1 pt-1">
                        <Clock className="w-3 h-3" />
                        {formatHours(cost.downtimeHours)} of vehicle downtime
                      </p>
                    ) : null}
                  </div>
                </Panel>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// A count with an optional icon, for the tyre and battery panels.
function Figure({ label, value, icon: Icon }) {
  return (
    <div>
      <p className="text-xs text-slate-500 flex items-center gap-1">
        {Icon ? <Icon className="w-3 h-3" /> : null}
        {label}
      </p>
      <p className="text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function CostLine({ label, value, hint, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <p className={`text-sm truncate ${strong ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
          {label}
        </p>
        {hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
      </div>
      <p className={`shrink-0 ${strong ? 'text-lg font-bold text-slate-900' : 'text-sm font-medium text-slate-800'}`}>
        {value}
      </p>
    </div>
  );
}
