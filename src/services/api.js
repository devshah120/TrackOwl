const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://103.212.121.139:1964';

export const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const token = localStorage.getItem('auth_token');
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw {
      status: response.status,
      message: data.error || 'An error occurred',
      data,
    };
  }

  return data;
};

export const auth = {
  register: (payload) =>
    apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (email, password) =>
    apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  verifyToken: () =>
    apiCall('/auth/verify', {
      method: 'POST',
    }),

  getCurrentUser: () =>
    apiCall('/auth/me', {
      method: 'GET',
    }),
};

// Live tracking — devices fed by the Traccar gateway, and the short-lived
// public share links handed to clients.
export const tracking = {
  getDevices: () => apiCall('/track/devices'),

  // Registers the vehicle in the Traccar gateway and claims it in one call.
  // type is 'phone' (Traccar Client app) or 'hardware' (Teltonika FMB920 etc.).
  // Resolves with { device, setup } — for a phone, setup is
  // { serverUrl, deviceIdentifier }; for hardware, { domain, port, protocol,
  // deviceIdentifier } — i.e. exactly the fields to enter on each device.
  registerDevice: (name, uniqueId, type = 'phone') =>
    apiCall('/track/devices', {
      method: 'POST',
      body: JSON.stringify({ name, type, ...(uniqueId ? { uniqueId } : {}) }),
    }),

  deleteDevice: (id) =>
    apiCall(`/track/devices/${id}`, { method: 'DELETE' }),

  createShareLink: (deviceId, ttlMinutes = 120, label = '') =>
    apiCall('/track/tokens', {
      method: 'POST',
      body: JSON.stringify({ deviceId, ttlMinutes, label }),
    }),

  getShareLinks: () => apiCall('/track/tokens'),

  revokeShareLink: (id) =>
    apiCall(`/track/tokens/${id}`, { method: 'DELETE' }),
};

// Trips — a planned journey (From → To) for a device, drawn as a road route on
// the map alongside the live vehicle.
export const trips = {
  list: () => apiCall('/trips'),

  // origin/destination are { name, lat, lng } from geo.searchPlaces; route is the
  // OSRM result from geo.getRoute (may be null if routing was unavailable).
  create: ({ deviceId, origin, destination, route, note = '' }) =>
    apiCall('/trips', {
      method: 'POST',
      body: JSON.stringify({
        deviceId,
        origin,
        destination,
        note,
        routePolyline: route?.polyline,
        distanceKm: route?.distanceKm,
        durationMin: route?.durationMin,
      }),
    }),

  update: (id, patch) =>
    apiCall(`/trips/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  remove: (id) => apiCall(`/trips/${id}`, { method: 'DELETE' }),
};

// Geo helpers backed by the free OSM ecosystem — same map data as the Leaflet
// tiles, no API key, no billing. These call third-party services directly from
// the browser (not through our API), so they're grouped separately.
export const geo = {
  // Place autocomplete via Nominatim. Returns [{ name, lat, lng }]. Nominatim
  // asks callers to identify themselves; the browser sends a Referer, which
  // satisfies its usage policy for light interactive use.
  searchPlaces: async (query, { limit = 5, signal } = {}) => {
    const q = query.trim();
    if (q.length < 3) return [];
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.search = new URLSearchParams({
      q,
      format: 'json',
      limit: String(limit),
      addressdetails: '0',
      countrycodes: 'in', // bias to India; drop this line to search worldwide
    }).toString();

    const res = await fetch(url, { signal, headers: { 'Accept-Language': 'en' } });
    if (!res.ok) throw new Error('Place search failed');
    const rows = await res.json();
    return rows.map((r) => ({
      name: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
    }));
  },

  // Road route between two { lat, lng } points via the public OSRM demo server.
  // Returns { polyline: [[lat,lng],...], distanceKm, durationMin } or null.
  getRoute: async (from, to, { signal } = {}) => {
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}` +
      `?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error('Routing failed');
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;
    return {
      // GeoJSON is [lng, lat]; Leaflet wants [lat, lng].
      polyline: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      durationMin: Math.round(route.duration / 60),
    };
  },
};

// Public (no auth): the trip behind a share token, for the client map page.
export const publicTrip = (token) => apiCall(`/trips/public/${token}`);

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
};

export const getAuthToken = () => {
  return localStorage.getItem('auth_token');
};

export const clearAuthToken = () => {
  localStorage.removeItem('auth_token');
};
