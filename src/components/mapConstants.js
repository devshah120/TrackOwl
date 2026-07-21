// Shared map constants. These live outside GoogleFleetMap.jsx because a file
// that exports both components and plain values breaks React Fast Refresh.

export const INDIA_CENTER = { lat: 22.9868, lng: 72.61 };

export const STATUS_COLOR = {
  moving: '#22c55e',
  idle: '#f59e0b',
  offline: '#64748b',
};
