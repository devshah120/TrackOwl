// Mirror of the backend's models/Driver.js roster vocabulary, for populating
// the driver form's dropdowns and colouring status badges.
//
// Duplicated rather than fetched for the same reason as constants/vehicle.js:
// the form must render before any request resolves. `/api/drivers/options`
// serves the authoritative copy and the model validates against it, so drift
// surfaces as a rejected save rather than a silently wrong record.

export const DRIVER_STATUSES = [
  'Available',
  'On Trip',
  'Off Duty',
  'Leave',
  'Inactive',
];

const STATUS_STYLES = {
  Available: { badge: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  'On Trip': { badge: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  'Off Duty': { badge: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
  Leave: { badge: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  Inactive: { badge: 'bg-slate-200 text-slate-700', dot: 'bg-slate-400' },
};

const FALLBACK = { badge: 'bg-slate-100 text-slate-800', dot: 'bg-slate-500' };

// Records predating the driver master fall back to neutral grey rather than
// rendering an unstyled badge.
export const getDriverStatusColor = (status) => (STATUS_STYLES[status] || FALLBACK).badge;
export const getDriverStatusDot = (status) => (STATUS_STYLES[status] || FALLBACK).dot;

// Licence validity, mirroring how the fleet table reads insurance expiry.
// A driver with no expiry on file is treated as "unknown", not expired — the
// field is optional and an empty one should not raise a false alarm.
export const LICENCE_WARN_DAYS = 30;

export const licenceState = (expiry) => {
  if (!expiry) return 'unknown';
  const days = Math.ceil((new Date(expiry) - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'expired';
  if (days <= LICENCE_WARN_DAYS) return 'expiring';
  return 'valid';
};

// Dates come back from the API as ISO strings; <input type="date"> wants
// yyyy-mm-dd, and the table wants something readable.
export const toDateInput = (value) => (value ? String(value).slice(0, 10) : '');

export const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
