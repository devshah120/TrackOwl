import { AlertTriangle, Wrench, Disc3, BatteryCharging, CalendarClock } from 'lucide-react';
import {
  REPAIR_STATUS_COLORS, REPAIR_STATUS_LABELS,
  REPAIR_PRIORITY_COLORS, REPAIR_PRIORITY_LABELS,
  TYRE_STATUS_COLORS, TYRE_STATUS_LABELS,
  BATTERY_STATUS_COLORS, BATTERY_STATUS_LABELS, BATTERY_HEALTH_COLORS,
  DUE_STATUS_COLORS, DUE_STATUS_LABELS,
  SERVICE_TYPE_LABELS, formatDueIn, formatOdometer,
} from '../../constants/maintenance';

// The small pieces the maintenance screens share.
//
// These live here rather than being copied into each page because a status pill
// that means one thing on the dashboard and another on the register is worse
// than no pill at all — and there are five screens rendering the same six
// vocabularies.

// A labelled figure with an icon. The same shape as the fuel register's stat
// strip, so the two modules read as one product.
export function StatTile({ label, value, hint, icon: Icon, bg = 'bg-slate-50', fg = 'text-slate-600', onClick }) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      {...(onClick ? { onClick, type: 'button' } : {})}
      className={`bg-white rounded-lg border border-slate-200 p-4 text-left ${
        onClick ? 'hover:border-slate-300 transition-colors w-full' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-600">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 truncate">{value}</p>
          {hint ? <p className="text-xs text-slate-500 mt-1 truncate">{hint}</p> : null}
        </div>
        {Icon ? (
          <div className={`${bg} ${fg} p-2 rounded-lg shrink-0`}>
            <Icon className="w-5 h-5" />
          </div>
        ) : null}
      </div>
    </Wrapper>
  );
}

// A coloured pill. Every status in this module renders through one of the four
// wrappers below rather than each page choosing its own colours.
function Pill({ className = 'bg-slate-100 text-slate-700', children, title }) {
  return (
    <span
      title={title}
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  );
}

export const RepairStatusPill = ({ status }) => (
  <Pill className={REPAIR_STATUS_COLORS[status]}>{REPAIR_STATUS_LABELS[status] || status}</Pill>
);

export const PriorityPill = ({ priority }) => (
  <Pill className={REPAIR_PRIORITY_COLORS[priority]} title={REPAIR_PRIORITY_LABELS[priority]}>
    {priority}
  </Pill>
);

export const TyreStatusPill = ({ status }) => (
  <Pill className={TYRE_STATUS_COLORS[status]}>{TYRE_STATUS_LABELS[status] || status}</Pill>
);

export const BatteryStatusPill = ({ status }) => (
  <Pill className={BATTERY_STATUS_COLORS[status]}>{BATTERY_STATUS_LABELS[status] || status}</Pill>
);

export const HealthPill = ({ health }) =>
  health ? <Pill className={BATTERY_HEALTH_COLORS[health]}>{health}</Pill> : <span className="text-slate-400">—</span>;

export const DuePill = ({ status }) => (
  <Pill className={DUE_STATUS_COLORS[status]}>{DUE_STATUS_LABELS[status] || status}</Pill>
);

// One reminder row (M3-M10).
//
// The three kinds are rendered by one component on purpose: to whoever reads
// this list, an overdue brake service and an illegal tyre are the same job —
// get the vehicle in — and splitting them into three differently-shaped lists
// would hide that.
const REMINDER_ICONS = {
  service: CalendarClock,
  tyre: Disc3,
  battery: BatteryCharging,
};

export function ReminderRow({ reminder, onOpen }) {
  const Icon = REMINDER_ICONS[reminder.kind] || AlertTriangle;
  const overdue = reminder.status === 'overdue';

  return (
    <button
      type="button"
      onClick={() => onOpen?.(reminder)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-100 last:border-b-0"
    >
      <div className={`p-2 rounded-lg shrink-0 ${overdue ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
        <Icon className="w-4 h-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 truncate">{reminder.label}</p>
        <p className="text-xs text-slate-500 truncate">
          {reminder.vehicleNumber}
          {/* Which clock decided it — a service can be due on date or on
              distance, and "in 400 km" is a different instruction from
              "in 3 days". */}
          {reminder.by ? ` · by ${reminder.by}` : ''}
          {reminder.currentOdometer !== null && reminder.currentOdometer !== undefined
            ? ` · now at ${formatOdometer(reminder.currentOdometer)}`
            : ''}
        </p>
      </div>

      <div className="text-right shrink-0">
        <DuePill status={reminder.status} />
        <p className={`text-xs mt-1 ${overdue ? 'text-red-600' : 'text-slate-500'}`}>
          {formatDueIn(reminder)}
        </p>
      </div>
    </button>
  );
}

// One open repair (M3-M04), as it appears on the dashboard board.
export function RepairRow({ request, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(request)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-100 last:border-b-0"
    >
      <div className="p-2 rounded-lg bg-slate-100 text-slate-600 shrink-0">
        <Wrench className="w-4 h-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 truncate">{request.issue}</p>
        <p className="text-xs text-slate-500 truncate">
          {request.requestNumber} · {request.vehicleNumber}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <PriorityPill priority={request.priority} />
        <RepairStatusPill status={request.status} />
      </div>
    </button>
  );
}

// A card wrapper with a title and an optional action, used for every panel on
// the dashboard and the detail screens.
export function Panel({ title, subtitle, action, children, className = '' }) {
  return (
    <div className={`bg-white rounded-lg border border-slate-200 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-slate-200">
          <div className="min-w-0">
            {title ? <h2 className="font-semibold text-slate-900 truncate">{title}</h2> : null}
            {subtitle ? <p className="text-xs text-slate-500 truncate">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// What a list shows when it has nothing in it. A blank panel reads as a broken
// screen; this says which it is.
export function EmptyState({ icon: Icon = AlertTriangle, title, hint }) {
  return (
    <div className="px-4 py-10 text-center">
      <Icon className="w-8 h-8 text-slate-300 mx-auto" />
      <p className="text-sm font-medium text-slate-700 mt-3">{title}</p>
      {hint ? <p className="text-xs text-slate-500 mt-1">{hint}</p> : null}
    </div>
  );
}

// The error and success bars every screen in this module uses.
export function Banner({ tone = 'error', message, onDismiss }) {
  if (!message) return null;
  const tones = {
    error: 'bg-red-50 border-red-200 text-red-700',
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
  };
  return (
    <div className={`border rounded-lg px-4 py-3 flex items-start justify-between gap-4 ${tones[tone]}`}>
      <span className="text-sm">{message}</span>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className="text-sm underline shrink-0">
          Dismiss
        </button>
      ) : null}
    </div>
  );
}

export { SERVICE_TYPE_LABELS };
