// Mirror of the backend's models/VehicleDocument.js and models/DriverDocument.js
// paperwork vocabularies, plus the expiry thresholds from
// utils/vehicleDocuments.js.
//
// Duplicated rather than fetched for the same reason as constants/vehicle.js
// and constants/driver.js: the form must render before any request resolves.
// `/api/vehicle-documents/options` and `/api/driver-documents/options` serve the
// authoritative copies and the models validate against them, so drift surfaces
// as a rejected save rather than a silently wrong record.

export const VEHICLE_DOCUMENT_TYPES = [
  'RC',
  'Insurance',
  'PUC',
  'Fitness',
  'Permit',
  'Tax',
  'Other',
];

export const VEHICLE_DOCUMENT_LABELS = {
  RC: 'Registration Certificate (RC)',
  Insurance: 'Insurance',
  PUC: 'Pollution Certificate (PUC)',
  Fitness: 'Fitness Certificate',
  Permit: 'Permit',
  Tax: 'Road Tax',
  Other: 'Other',
};

export const DRIVER_DOCUMENT_TYPES = [
  'Licence',
  'ID',
  'Training',
  'Medical',
  'Police Verification',
  'Other',
];

export const DRIVER_DOCUMENT_LABELS = {
  Licence: 'Driving Licence',
  ID: 'Identity Proof',
  Training: 'Training / Endorsement',
  Medical: 'Medical Certificate',
  'Police Verification': 'Police Verification',
  Other: 'Other',
};

// Matches EXPIRY_WARN_DAYS in the backend's utils/vehicleDocuments.js.
export const EXPIRY_WARN_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

// Whole days until `expiry`, negative once past. Null when there is nothing to
// measure — a document without an expiry never lapses, which is not the same as
// expiring today.
export const daysUntil = (expiry) => {
  if (!expiry) return null;
  const time = new Date(expiry).getTime();
  if (Number.isNaN(time)) return null;
  return Math.ceil((time - Date.now()) / DAY_MS);
};

// The API already returns `expiryState` on every document; this re-derives it
// for rows the form is holding before a save, so a freshly filled expiry date
// colours correctly without a round trip.
export const expiryState = (expiry) => {
  const days = daysUntil(expiry);
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  if (days <= EXPIRY_WARN_DAYS) return 'expiring';
  return 'valid';
};

// One place for the expiry palette, so the vehicle form, the driver form and
// any future documents view cannot disagree about what "expiring" looks like.
const STATE_STYLES = {
  expired: { badge: 'bg-red-100 text-red-800', dot: 'bg-red-500', label: 'Expired' },
  expiring: { badge: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500', label: 'Expiring soon' },
  valid: { badge: 'bg-green-100 text-green-800', dot: 'bg-green-500', label: 'Valid' },
  none: { badge: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400', label: 'No expiry' },
};

const FALLBACK = STATE_STYLES.none;

export const getExpiryColor = (state) => (STATE_STYLES[state] || FALLBACK).badge;
export const getExpiryDot = (state) => (STATE_STYLES[state] || FALLBACK).dot;

// The badge text. An expiring document says how long is left, because "expires
// in 6 days" is what actually prompts someone to act; a plain "Expiring soon"
// does not distinguish six days from thirty.
export const expiryLabel = (expiry, state = expiryState(expiry)) => {
  const days = daysUntil(expiry);
  if (state === 'expired') return `Expired ${Math.abs(days)}d ago`;
  if (state === 'expiring') return days === 0 ? 'Expires today' : `${days}d left`;
  return (STATE_STYLES[state] || FALLBACK).label;
};
