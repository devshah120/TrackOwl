// Mirror of the backend's utils/maintenance.js, for the first render and for
// labelling. The server's /api/maintenance/options is authoritative and the
// pages fetch it, exactly as the fuel and trip screens do — this copy exists so
// a dropdown is not empty for the moment before that call returns.
//
// The cost and life *arithmetic* is deliberately not duplicated here. Every job
// total, tyre cost-per-km and due-date verdict is computed by the server and
// rendered as given; a number the browser derives for itself is one nobody can
// audit, and two screens disagreeing about whether a service is overdue is
// worse than either being a moment stale.

export const SERVICE_TYPE_LABELS = {
  General: 'General service',
  Oil: 'Oil change',
  Filters: 'Filters',
  Brakes: 'Brakes',
  AC: 'Air conditioning',
  Battery: 'Battery',
  Suspension: 'Suspension',
  Alignment: 'Wheel alignment',
  Electrical: 'Electrical',
  Engine: 'Engine',
  Transmission: 'Transmission',
  Clutch: 'Clutch',
  Other: 'Other',
};

export const SERVICE_TYPES = Object.keys(SERVICE_TYPE_LABELS);

// Typical intervals, shown beside the service type on the form so the user can
// see what the suggestion is based on. The server computes the actual suggested
// date and reading — this is only the caption.
export const SERVICE_INTERVALS = {
  General: { km: 20000, months: 12 },
  Oil: { km: 10000, months: 6 },
  Filters: { km: 20000, months: 12 },
  Brakes: { km: 30000, months: 12 },
  AC: { km: null, months: 12 },
  Battery: { km: null, months: 24 },
  Suspension: { km: 50000, months: 24 },
  Alignment: { km: 20000, months: 6 },
  Electrical: { km: null, months: 12 },
  Engine: { km: 100000, months: 36 },
  Transmission: { km: 80000, months: 36 },
  Clutch: { km: 80000, months: 24 },
  Other: { km: null, months: null },
};

// --------------------------------------------------------------------------
// M3-M05 — the repair workflow
// --------------------------------------------------------------------------

export const REPAIR_STATUS_LABELS = {
  Reported: 'Reported',
  Approved: 'Approved',
  'In Repair': 'In repair',
  'Waiting Parts': 'Waiting for parts',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
};

export const REPAIR_STATUSES = Object.keys(REPAIR_STATUS_LABELS);

// The stepper's spine: the happy path, in order. Cancelled is deliberately
// absent — it is an exit, not a step, and drawing it in the line would suggest
// every job passes through it.
export const REPAIR_FLOW = ['Reported', 'Approved', 'In Repair', 'Waiting Parts', 'Completed'];

// Which states may follow which. The server enforces this; the UI reads it to
// decide which buttons to offer, so a user is never shown a move that would be
// refused. Kept in step with utils/maintenance.js REPAIR_TRANSITIONS.
export const REPAIR_TRANSITIONS = {
  Reported: ['Approved', 'Cancelled'],
  Approved: ['In Repair', 'Waiting Parts', 'Cancelled'],
  'In Repair': ['Waiting Parts', 'Completed', 'Cancelled'],
  'Waiting Parts': ['In Repair', 'Completed', 'Cancelled'],
  Completed: [],
  Cancelled: [],
};

export const ACTIVE_REPAIR_STATUSES = ['Approved', 'In Repair', 'Waiting Parts'];
export const OPEN_REPAIR_STATUSES = ['Reported', ...ACTIVE_REPAIR_STATUSES];

// Status pills, in the same family the rest of the app uses. Grouped by what
// the state means rather than given six unrelated colours:
//   slate — nothing is happening yet
//   blue  — the job is moving
//   amber — the job is stalled
//   green — done
//   red   — abandoned
export const REPAIR_STATUS_COLORS = {
  Reported: 'bg-slate-100 text-slate-700',
  Approved: 'bg-blue-100 text-blue-800',
  'In Repair': 'bg-indigo-100 text-indigo-800',
  'Waiting Parts': 'bg-amber-100 text-amber-800',
  Completed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
};

export const REPAIR_PRIORITY_LABELS = {
  Low: 'Low',
  Medium: 'Medium',
  High: 'High',
  Critical: 'Critical — vehicle grounded',
};

export const REPAIR_PRIORITIES = Object.keys(REPAIR_PRIORITY_LABELS);

export const REPAIR_PRIORITY_COLORS = {
  Low: 'bg-slate-100 text-slate-600',
  Medium: 'bg-blue-100 text-blue-800',
  High: 'bg-orange-100 text-orange-800',
  Critical: 'bg-red-100 text-red-800',
};

// --------------------------------------------------------------------------
// M3-M06 / M3-M07 — tyres
// --------------------------------------------------------------------------

export const TYRE_POSITIONS = [
  'Front Left',
  'Front Right',
  'Axle 2 Left Outer',
  'Axle 2 Left Inner',
  'Axle 2 Right Inner',
  'Axle 2 Right Outer',
  'Axle 3 Left Outer',
  'Axle 3 Left Inner',
  'Axle 3 Right Inner',
  'Axle 3 Right Outer',
  'Rear Left',
  'Rear Right',
  'Spare',
  'Stock',
];

// The axle diagram's shape: which positions sit on which row, so the layout can
// be drawn without hardcoding coordinates in the component. A vehicle with no
// third axle simply has no tyres in that row, and the row is not rendered.
export const TYRE_AXLES = [
  { label: 'Front axle', positions: ['Front Left', 'Front Right'] },
  {
    label: 'Second axle',
    positions: [
      'Axle 2 Left Outer',
      'Axle 2 Left Inner',
      'Axle 2 Right Inner',
      'Axle 2 Right Outer',
    ],
  },
  {
    label: 'Third axle',
    positions: [
      'Axle 3 Left Outer',
      'Axle 3 Left Inner',
      'Axle 3 Right Inner',
      'Axle 3 Right Outer',
    ],
  },
  { label: 'Rear axle', positions: ['Rear Left', 'Rear Right'] },
  { label: 'Spare', positions: ['Spare'] },
];

export const NON_RUNNING_TYRE_POSITIONS = ['Spare', 'Stock'];

export const TYRE_STATUS_LABELS = {
  'In Stock': 'In stock',
  Fitted: 'Fitted',
  Removed: 'Removed',
  Retreaded: 'Retreaded',
  Scrapped: 'Scrapped',
  Sold: 'Sold',
};

export const TYRE_STATUSES = Object.keys(TYRE_STATUS_LABELS);

export const ON_VEHICLE_TYRE_STATUSES = ['Fitted', 'Retreaded'];

export const TYRE_STATUS_COLORS = {
  'In Stock': 'bg-slate-100 text-slate-700',
  Fitted: 'bg-green-100 text-green-800',
  Removed: 'bg-amber-100 text-amber-800',
  Retreaded: 'bg-indigo-100 text-indigo-800',
  Scrapped: 'bg-red-100 text-red-800',
  Sold: 'bg-slate-100 text-slate-500',
};

// --------------------------------------------------------------------------
// M3-M09 — batteries
// --------------------------------------------------------------------------

export const BATTERY_STATUS_LABELS = {
  'In Stock': 'In stock',
  Fitted: 'Fitted',
  Removed: 'Removed',
  Scrapped: 'Scrapped',
  'Warranty Claim': 'Warranty claim',
};

export const BATTERY_STATUSES = Object.keys(BATTERY_STATUS_LABELS);

export const BATTERY_STATUS_COLORS = {
  'In Stock': 'bg-slate-100 text-slate-700',
  Fitted: 'bg-green-100 text-green-800',
  Removed: 'bg-amber-100 text-amber-800',
  Scrapped: 'bg-red-100 text-red-800',
  'Warranty Claim': 'bg-blue-100 text-blue-800',
};

export const BATTERY_HEALTH = ['Good', 'Fair', 'Weak', 'Dead'];

export const BATTERY_HEALTH_COLORS = {
  Good: 'bg-green-100 text-green-800',
  Fair: 'bg-blue-100 text-blue-800',
  Weak: 'bg-amber-100 text-amber-800',
  Dead: 'bg-red-100 text-red-800',
};

export const BATTERY_VOLTAGES = [12, 24, 48];

// --------------------------------------------------------------------------
// Shared vocabulary
// --------------------------------------------------------------------------

export const PAYMENT_MODES = [
  'Cash',
  'UPI',
  'Card',
  'Bank Transfer',
  'Credit',
  'Company Account',
];

export const WORKSHOP_TYPES = ['In-house', 'Authorised', 'Local', 'Roadside'];

// How a due item reads. The server decides the status; these are only the
// colours and words for it.
export const DUE_STATUS_LABELS = {
  overdue: 'Overdue',
  due: 'Due soon',
  ok: 'On schedule',
  unknown: 'Not scheduled',
};

export const DUE_STATUS_COLORS = {
  overdue: 'bg-red-100 text-red-800',
  due: 'bg-amber-100 text-amber-800',
  ok: 'bg-green-100 text-green-800',
  unknown: 'bg-slate-100 text-slate-600',
};

// The shipped thresholds, shown on the settings screen as the "reset to
// defaults" target. The server sends its own copy with
// /api/maintenance/options; this is only for the first paint.
export const DEFAULT_SETTINGS = {
  serviceDueDays: 15,
  serviceDueKm: 1000,
  overdueGraceDays: 90,
  tyreMinTreadMm: 3,
  batteryLifeMonths: 36,
  warrantyWarnDays: 30,
};

// --------------------------------------------------------------------------
// Display helpers
// --------------------------------------------------------------------------
//
// These format numbers the server has already computed. None of them derives a
// figure — a null from the API means "not known" and is rendered as a dash,
// never as a zero, because a tyre that has not run anywhere has no cost per
// kilometre, which is not the same as a cost of nought.

const NBSP = ' ';

export const formatMoney = (value, { decimals = 0 } = {}) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `₹${Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
};

export const formatNumber = (value, { decimals = 2, suffix = '' } = {}) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const n = Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return suffix ? `${n}${NBSP}${suffix}` : n;
};

export const formatOdometer = (value) =>
  value === null || value === undefined ? '—' : `${Number(value).toLocaleString('en-IN')}${NBSP}km`;

// M3-M08. Reads "₹0.27/km" — three decimals, because a tyre's per-km figure is
// small enough that two would round most of the fleet to the same number.
export const formatCostPerKm = (value) =>
  value === null || value === undefined
    ? '—'
    : `${formatMoney(value, { decimals: 3 })}/km`;

export const formatTread = (value) =>
  value === null || value === undefined ? '—' : `${formatNumber(value, { decimals: 1 })}${NBSP}mm`;

export const formatHours = (value) => {
  if (value === null || value === undefined) return '—';
  const hours = Number(value);
  if (!Number.isFinite(hours)) return '—';
  // Past two days, hours stop being readable — "58.4 hours" is a number people
  // have to convert in their head before it means anything.
  if (hours >= 48) return `${formatNumber(hours / 24, { decimals: 1 })}${NBSP}days`;
  return `${formatNumber(hours, { decimals: 1 })}${NBSP}hrs`;
};

export const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// How a reminder's remaining time reads. The server sends the day and kilometre
// counts; this only turns them into the phrase a person would use.
export const formatDueIn = ({ status, by, days, km }) => {
  if (status === 'overdue') {
    if (by === 'km' && km !== null) return `${Math.abs(km).toLocaleString('en-IN')} km over`;
    if (days !== null) return `${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} over`;
    return 'Overdue';
  }
  if (by === 'km' && km !== null) return `in ${km.toLocaleString('en-IN')} km`;
  if (days !== null) return days === 0 ? 'today' : `in ${days} ${days === 1 ? 'day' : 'days'}`;
  return '—';
};

// The value a date input needs, in the browser's own timezone. toISOString()
// would shift by the UTC offset and quietly record a service on the wrong day.
export const toDateInput = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const toDateTimeLocal = (value) => {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
