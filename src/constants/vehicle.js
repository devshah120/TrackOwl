// Mirror of the backend's models/Truck.js vehicle master vocabularies, for
// populating dropdowns and for colouring status badges.
//
// The lists are duplicated rather than fetched because they are needed to
// render the form before any request resolves; `/api/trucks/options` serves the
// authoritative copy, and the model validates against it either way, so a drift
// here shows up as a rejected save rather than a silently wrong record.

export const VEHICLE_TYPES = [
  'Truck',
  'Trailer',
  'Tanker',
  'Container',
  'Tipper',
  'Pickup',
  'Van',
  'Bus',
  'Other',
];

export const FUEL_TYPES = ['Diesel', 'Petrol', 'CNG', 'LNG', 'Electric', 'Hybrid'];

export const BODY_TYPES = [
  'Open',
  'Closed',
  'Flatbed',
  'Tanker',
  'Container',
  'Tipper',
  'Refrigerated',
  'Other',
];

export const VEHICLE_STATUSES = [
  'Active',
  'Idle',
  'In Transit',
  'Maintenance',
  'Offline',
  'Inactive',
];

// One place for the badge palette, so the fleet table, the dashboard and the
// admin views cannot disagree about what colour "Maintenance" is.
const STATUS_STYLES = {
  Active: { badge: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  'In Transit': { badge: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  Idle: { badge: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
  Maintenance: { badge: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  Offline: { badge: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
  Inactive: { badge: 'bg-slate-200 text-slate-700', dot: 'bg-slate-400' },
};

const FALLBACK = { badge: 'bg-slate-100 text-slate-800', dot: 'bg-slate-500' };

// Unrecognised values (a record predating the vehicle master, say) fall back to
// neutral grey rather than rendering an unstyled badge.
export const getStatusColor = (status) => (STATUS_STYLES[status] || FALLBACK).badge;
export const getStatusDot = (status) => (STATUS_STYLES[status] || FALLBACK).dot;

// The statuses that count as "on the road" for dashboard tallies.
export const ACTIVE_STATUSES = ['Active', 'In Transit'];

// Capacity is stored in fixed units (kg, m³); these format it for display and
// return an em dash when the figure was never filled in.
export const formatWeight = (kg) =>
  kg === null || kg === undefined || kg === '' ? '—' : `${Number(kg).toLocaleString()} kg`;

export const formatVolume = (m3) =>
  m3 === null || m3 === undefined || m3 === '' ? '—' : `${Number(m3).toLocaleString()} m³`;

export const formatOdometer = (km) =>
  km === null || km === undefined || km === '' ? '—' : `${Number(km).toLocaleString()} km`;
