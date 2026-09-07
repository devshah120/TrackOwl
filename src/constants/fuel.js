// Mirror of the backend's utils/fuel.js, for the first render and for
// labelling. The server's /api/fuel/options is authoritative and the pages
// fetch it, exactly as the trip and vehicle screens do — this copy exists so a
// dropdown is not empty for the moment before that call returns.
//
// The efficiency *arithmetic* is deliberately not duplicated here. Every KM/L,
// cost/km and L/100KM figure is computed by the server and rendered as given;
// a number the browser derives for itself is one nobody can audit, and two
// screens disagreeing about a vehicle's mileage is worse than either being a
// moment stale.

export const FUEL_TYPE_LABELS = {
  Diesel: 'Diesel',
  Petrol: 'Petrol',
  CNG: 'CNG',
  LNG: 'LNG',
  Electric: 'EV Charging',
  AdBlue: 'AdBlue / DEF',
  Other: 'Other',
};

export const FUEL_TYPES = Object.keys(FUEL_TYPE_LABELS);

// What each fuel is sold in. Drives the unit shown beside every quantity, so a
// CNG entry reads "42 kg" rather than "42 L".
export const FUEL_UNITS = {
  Diesel: 'L',
  Petrol: 'L',
  CNG: 'kg',
  LNG: 'kg',
  Electric: 'kWh',
  AdBlue: 'L',
  Other: 'L',
};

export const unitFor = (fuelType) => FUEL_UNITS[fuelType] || 'L';

// Fuels that move the vehicle, and so the only ones with a mileage figure.
// AdBlue is costed but never produces KM/L — it feeds the emissions system,
// not the engine.
export const PROPULSION_FUEL_TYPES = ['Diesel', 'Petrol', 'CNG', 'LNG', 'Electric'];

export const PAYMENT_MODES = [
  'Cash',
  'UPI',
  'Card',
  'Bank Transfer',
  'Fuel Card',
  'Credit',
  'Company Account',
];

export const FILL_TYPE_LABELS = {
  full: 'Full tank',
  partial: 'Partial fill',
};

export const FILL_TYPES = Object.keys(FILL_TYPE_LABELS);

export const BASELINE_MODE_LABELS = {
  vehicle: "This vehicle's own history",
  fleet: 'Fleet average for the same fuel type',
};

export const FLAG_REASON_LABELS = {
  low_efficiency: 'Low efficiency',
  high_efficiency: 'Unusually high efficiency',
  odometer_rollback: 'Odometer went backwards',
  quantity_spike: 'Quantity spike',
  rate_outlier: 'Unusual rate',
};

// Badge colours, in the same family the rest of the app uses for status pills.
// Grouped by what the flag means rather than given five separate colours:
//   red   — the number is probably wrong
//   amber — the number is probably right and worth investigating
export const FLAG_REASON_COLORS = {
  low_efficiency: 'bg-amber-100 text-amber-800',
  high_efficiency: 'bg-red-100 text-red-800',
  odometer_rollback: 'bg-red-100 text-red-800',
  quantity_spike: 'bg-red-100 text-red-800',
  rate_outlier: 'bg-amber-100 text-amber-800',
};

export const FUEL_TYPE_COLORS = {
  Diesel: 'bg-slate-100 text-slate-700',
  Petrol: 'bg-blue-100 text-blue-800',
  CNG: 'bg-green-100 text-green-800',
  LNG: 'bg-teal-100 text-teal-800',
  Electric: 'bg-indigo-100 text-indigo-800',
  AdBlue: 'bg-cyan-100 text-cyan-800',
  Other: 'bg-slate-100 text-slate-700',
};

// The shipped thresholds, shown on the settings screen as the "reset to
// defaults" target. The server sends its own copy with /api/fuel/options; this
// is only for the first paint.
export const DEFAULT_SETTINGS = {
  baselineMode: 'vehicle',
  lowEfficiencyPct: 20,
  highEfficiencyPct: 30,
  minSamples: 3,
  baselineWindowDays: 180,
  rateOutlierPct: 25,
  maxQuantityPerFill: 600,
};

// --------------------------------------------------------------------------
// Display helpers
// --------------------------------------------------------------------------
//
// These format numbers the server has already computed. None of them derives a
// figure — a null from the API means "not known" and is rendered as a dash,
// never as a zero, because a vehicle whose odometer has not been read has no
// mileage, which is not the same as a mileage of nought.

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

// A quantity with the unit its fuel type is sold in.
export const formatQuantity = (value, fuelType) =>
  formatNumber(value, { decimals: 2, suffix: unitFor(fuelType) });

// M3-F03. Reads "8.2 km/L" for diesel, "14.1 km/kg" for CNG.
export const formatKmPerUnit = (value, fuelType) =>
  value === null || value === undefined ? '—' : `${formatNumber(value)}${NBSP}km/${unitFor(fuelType)}`;

// M3-F04.
export const formatCostPerKm = (value) =>
  value === null || value === undefined ? '—' : `${formatMoney(value, { decimals: 2 })}/km`;

// M3-F05. Named for litres by convention even where the unit is kg or kWh —
// "L/100KM" is what the requirement and the industry call it.
export const formatPer100Km = (value, fuelType) =>
  value === null || value === undefined
    ? '—'
    : `${formatNumber(value)}${NBSP}${unitFor(fuelType)}/100km`;

export const formatOdometer = (value) =>
  value === null || value === undefined ? '—' : `${Number(value).toLocaleString('en-IN')}${NBSP}km`;

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

// The value a datetime-local input needs, in the browser's own timezone.
// toISOString() would shift the time by the UTC offset and quietly record a
// filling at the wrong hour.
export const toDateTimeLocal = (value) => {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
