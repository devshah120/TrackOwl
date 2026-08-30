// Mirror of the backend's models/Device.js device master vocabularies, for
// populating dropdowns and colouring status badges.
//
// Duplicated rather than fetched for the same reason as constants/vehicle.js:
// the form has to render before any request resolves. `/api/admin/devices/options`
// serves the authoritative copy and the model validates against it either way,
// so drift here surfaces as a rejected save, never as a silently wrong record.

export const DEVICE_TYPES = ['hardware', 'phone'];

export const DEVICE_TYPE_LABELS = {
  hardware: 'GPS device',
  phone: 'Phone app',
};

// Lifecycle of the physical unit — what the box *is*, as opposed to the live
// telemetry status (moving/idle/offline) the map shows.
export const DEVICE_LIFECYCLE_STATUSES = ['In Stock', 'Active', 'Faulty', 'Repair', 'Retired'];

const LIFECYCLE_STYLES = {
  Active: 'bg-green-100 text-green-800',
  'In Stock': 'bg-blue-100 text-blue-800',
  Faulty: 'bg-red-100 text-red-800',
  Repair: 'bg-orange-100 text-orange-800',
  Retired: 'bg-slate-200 text-slate-700',
};

// Live telemetry status, as computed by the Device model's `status` virtual.
const TELEMETRY_STYLES = {
  moving: 'bg-green-100 text-green-800',
  idle: 'bg-yellow-100 text-yellow-800',
  offline: 'bg-slate-200 text-slate-600',
};

const FALLBACK = 'bg-slate-100 text-slate-800';

export const getLifecycleColor = (status) => LIFECYCLE_STYLES[status] || FALLBACK;
export const getTelemetryColor = (status) => TELEMETRY_STYLES[status] || FALLBACK;

// Common Indian data-SIM providers, offered as suggestions rather than an enum:
// the backend stores free text, so an operator with a provider we have not
// listed can still type it in.
export const SIM_PROVIDERS = ['Airtel', 'Jio', 'Vi', 'BSNL', 'MTNL', 'Other'];

// Dates come back as ISO strings; these render them for the table and prefill
// the <input type="date"> fields, and return an em dash when never filled in.
export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const toDateInput = (iso) => (iso ? String(iso).slice(0, 10) : '');
