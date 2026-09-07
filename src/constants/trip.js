// Mirror of the backend's utils/tripOrders.js, for the first render and for
// labelling. The server's /api/trip-orders/options is authoritative and the
// pages fetch it, exactly as the vehicle and driver screens do with their own
// options endpoints — this copy exists so a dropdown is not empty for the
// moment before that call returns.
//
// The status *rules* are deliberately not duplicated here. Which transitions
// are legal is decided by the server and returned per trip as
// `allowedTransitions`, so the buttons a page shows can never disagree with
// what the API will accept.

export const TRIP_TYPE_LABELS = {
  local: 'Local',
  one_way: 'One-way',
  round_trip: 'Round-trip',
  multi_stop: 'Multi-stop',
  dedicated: 'Dedicated',
  return_load: 'Return-load',
  empty_return: 'Empty-return',
  delivery: 'Delivery',
  pickup: 'Pickup',
  intercity: 'Intercity',
  interstate: 'Interstate',
};

export const TRIP_TYPES = Object.keys(TRIP_TYPE_LABELS);

export const TRIP_STATUS_LABELS = {
  draft: 'Draft',
  planned: 'Planned',
  assigned: 'Assigned',
  ready: 'Ready',
  dispatched: 'Dispatched',
  in_transit: 'In Transit',
  at_pickup: 'At Pickup',
  loading: 'Loading',
  loaded: 'Loaded',
  at_destination: 'At Destination',
  unloading: 'Unloading',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
  on_hold: 'On Hold',
};

export const TRIP_STATUSES = Object.keys(TRIP_STATUS_LABELS);

// Badge colours, in the same slate/blue/green/amber/red family the rest of the
// app uses for status pills. Grouped by what the status means rather than given
// fifteen separate colours, so the list reads at a glance:
//   slate  — not yet moving        blue  — being prepared
//   indigo — on the road           green — done
//   amber  — needs attention       red   — stopped
export const TRIP_STATUS_COLORS = {
  draft: 'bg-slate-100 text-slate-700',
  planned: 'bg-slate-100 text-slate-700',
  assigned: 'bg-blue-100 text-blue-800',
  ready: 'bg-blue-100 text-blue-800',
  dispatched: 'bg-indigo-100 text-indigo-800',
  in_transit: 'bg-indigo-100 text-indigo-800',
  at_pickup: 'bg-indigo-100 text-indigo-800',
  loading: 'bg-indigo-100 text-indigo-800',
  loaded: 'bg-indigo-100 text-indigo-800',
  at_destination: 'bg-indigo-100 text-indigo-800',
  unloading: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  on_hold: 'bg-amber-100 text-amber-800',
};

// The statuses that mean the vehicle is out on the job. Used to colour the list
// and to decide whether a trip shows a live-tracking panel.
export const ACTIVE_STATUSES = [
  'dispatched',
  'in_transit',
  'at_pickup',
  'loading',
  'loaded',
  'at_destination',
  'unloading',
];

export const TERMINAL_STATUSES = ['completed', 'cancelled'];

export const STOP_TYPE_LABELS = {
  pickup: 'Pickup',
  delivery: 'Delivery',
  via: 'Via',
  rest: 'Rest',
  fuel: 'Fuel',
  checkpoint: 'Checkpoint',
};

export const STOP_STATUS_LABELS = {
  pending: 'Pending',
  arrived: 'Arrived',
  completed: 'Completed',
  skipped: 'Skipped',
};

export const STOP_STATUS_COLORS = {
  pending: 'bg-slate-100 text-slate-700',
  arrived: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  skipped: 'bg-amber-100 text-amber-800',
};

export const CARGO_UNITS = [
  'Boxes', 'Bags', 'Pallets', 'Drums', 'Crates', 'Rolls',
  'Bundles', 'Pieces', 'Nos', 'Kg', 'Litres', 'Tonnes',
];

export const REVENUE_CATEGORY_LABELS = {
  freight: 'Freight',
  loading: 'Loading',
  unloading: 'Unloading',
  detention: 'Detention',
  waiting: 'Waiting',
  extra_km: 'Extra KM',
  other: 'Other',
  discount: 'Discount',
  tax: 'Tax',
};

export const EXPENSE_CATEGORY_LABELS = {
  fuel: 'Fuel',
  toll: 'Toll',
  parking: 'Parking',
  driver_allowance: 'Driver Allowance',
  food: 'Food',
  hotel: 'Hotel',
  loading: 'Loading',
  unloading: 'Unloading',
  repair: 'Repair',
  tyre: 'Tyre',
  permit: 'Permit',
  challan: 'Challan',
  miscellaneous: 'Miscellaneous',
};

export const PAYMENT_MODES = [
  'Cash', 'UPI', 'Card', 'Bank Transfer', 'Fuel Card', 'Credit', 'Company Account',
];

export const EVENT_TYPE_LABELS = {
  overspeed: 'Overspeed',
  idle: 'Idle',
  geofence: 'Geofence',
  route_deviation: 'Route Deviation',
  unexpected_stop: 'Unexpected Stop',
  offline: 'Offline',
  status_change: 'Status Change',
  manual: 'Manual Event',
};

export const EVENT_SEVERITY_COLORS = {
  info: 'bg-slate-100 text-slate-700',
  warning: 'bg-amber-100 text-amber-800',
  critical: 'bg-red-100 text-red-800',
};

export const TRIP_DOCUMENT_TYPE_LABELS = {
  lr: 'Lorry Receipt',
  invoice: 'Invoice',
  eway_bill: 'E-way Bill',
  pod: 'Proof of Delivery',
  challan: 'Challan',
  po: 'Purchase Order',
  receipt: 'Receipt',
  other: 'Other',
};

export const CREW_ROLE_LABELS = {
  secondary_driver: 'Secondary Driver',
  helper: 'Helper',
  cleaner: 'Cleaner',
  other: 'Other Crew',
};

export const PAYMENT_TERMS = [
  'Advance', 'Cash on Delivery', 'Net 7', 'Net 15',
  'Net 30', 'Net 45', 'Net 60', 'Net 90', 'Credit',
];

export const CUSTOMER_STATUSES = ['Active', 'Inactive', 'Blacklisted'];

export const CUSTOMER_STATUS_COLORS = {
  Active: 'bg-green-100 text-green-800',
  Inactive: 'bg-slate-100 text-slate-700',
  Blacklisted: 'bg-red-100 text-red-800',
};

// Rupees, the way the rest of the app prints them. Kept here so every trip
// screen formats money identically.
export const formatCurrency = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

// A number that may legitimately be unknown. Renders an em dash rather than 0,
// because "not measured yet" and "zero" are different facts — the server is
// careful to send null for the first, and the UI must not flatten that.
export const formatNumber = (value, suffix = '') => {
  const n = Number(value);
  if (value === null || value === undefined || !Number.isFinite(n)) return '—';
  return `${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}${suffix}`;
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
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// Minutes as "3h 20m", for durations that are usually hours long.
export const formatDuration = (minutes) => {
  const n = Number(minutes);
  if (!Number.isFinite(n)) return '—';
  const h = Math.floor(Math.abs(n) / 60);
  const m = Math.round(Math.abs(n) % 60);
  const sign = n < 0 ? '-' : '';
  return h ? `${sign}${h}h ${m}m` : `${sign}${m}m`;
};
