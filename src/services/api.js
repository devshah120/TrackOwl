const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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

  // `options` is spread wholesale, so an AbortSignal passed by the caller
  // (place autocomplete cancels in-flight searches) reaches fetch untouched.
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

  // origin/destination are { name, lat, lng } from geo.searchPlaces; stops is an
  // ordered array of the same shape for intermediate waypoints; route is the
  // OSRM result from geo.getRoute (may be null if routing was unavailable).
  // routePolyline/distanceKm/durationMin may also be passed at the top level;
  // an explicit value wins over the one carried on `route`.
  create: ({ deviceId, origin, destination, stops, route, note = '', routePolyline, distanceKm, durationMin }) =>
    apiCall('/trips', {
      method: 'POST',
      body: JSON.stringify({
        deviceId,
        origin,
        destination,
        stops,
        note,
        routePolyline: routePolyline ?? route?.polyline,
        distanceKm: distanceKm ?? route?.distanceKm,
        durationMin: durationMin ?? route?.durationMin,
      }),
    }),

  update: (id, patch) =>
    apiCall(`/trips/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  // The path the vehicle actually drove for this trip, as [[lat, lng], ...] in
  // travel order — distinct from the planned routePolyline saved at creation.
  getTrail: (id) => apiCall(`/trips/${id}/trail`),

  remove: (id) => apiCall(`/trips/${id}`, { method: 'DELETE' }),
};

// Fleet — a truck roster. Each truck comes back with a `drivers` array; the
// `driver` field on it is the primary driver, kept for screens that only have
// room for one. Send the whole `drivers` array back on create/update and the
// server replaces the truck's roster with it.
export const fleet = {
  list: () => apiCall('/trucks'),

  create: (payload) =>
    apiCall('/trucks', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id, payload) =>
    apiCall(`/trucks/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  remove: (id) => apiCall(`/trucks/${id}`, { method: 'DELETE' }),
};

// Drivers — their own roster, so one truck can carry several and a driver can
// be reassigned between trucks. Editing a truck's whole roster at once goes
// through `fleet.update`; these are for one driver at a time.
export const drivers = {
  // Optional filters: { truck: '<truckId>' } or { unassigned: true }.
  list: ({ truck, unassigned } = {}) => {
    const params = new URLSearchParams();
    if (truck) params.set('truck', truck);
    if (unassigned) params.set('unassigned', '1');
    const qs = params.toString();
    return apiCall(`/drivers${qs ? `?${qs}` : ''}`);
  },

  create: (payload) =>
    apiCall('/drivers', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id, payload) =>
    apiCall(`/drivers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  remove: (id) => apiCall(`/drivers/${id}`, { method: 'DELETE' }),
};

// Daily Ledger — income/expense entries, each optionally tied to a truck and
// driver and backed by a scanned receipt.
export const ledger = {
  // Entries come back without the receipt image — `receipt.filename` tells you
  // one exists; call getReceipt(id) to actually load it.
  list: () => apiCall('/ledger'),

  create: (payload) =>
    apiCall('/ledger', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id, payload) =>
    apiCall(`/ledger/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  remove: (id) => apiCall(`/ledger/${id}`, { method: 'DELETE' }),

  // The stored receipt as { dataUrl, filename, mimeType, uploadedAt }.
  getReceipt: (id) => apiCall(`/ledger/${id}/receipt`),
};

// Trips & Documents — freight/billing records (party, LR, bill, payment status).
// Distinct from `trips` above, which is route-planning (origin/destination/device).
export const billing = {
  list: () => apiCall('/billing-trips'),

  create: (payload) =>
    apiCall('/billing-trips', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id, payload) =>
    apiCall(`/billing-trips/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  remove: (id) => apiCall(`/billing-trips/${id}`, { method: 'DELETE' }),

  // Downloads a generated document. The PDF is fetched as a blob rather than
  // opened by navigation because the endpoint is token-protected and a plain
  // browser navigation cannot send the Authorization header.
  // kind is 'lr' | 'invoice' | 'goods'.
  downloadDocument: async (id, kind) => {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/billing-trips/${id}/documents/${kind}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      // Errors come back as JSON even though the success path is a PDF.
      const err = await response.json().catch(() => ({}));
      throw { status: response.status, message: err.error || 'Failed to generate document' };
    }

    const blob = await response.blob();
    const match = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') || '');
    const filename = match ? match[1] : `${kind}.pdf`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};

// Authenticated user's profile — company/bank details shown in Settings.
export const user = {
  getProfile: () => apiCall('/user/profile'),

  updateProfile: (payload) =>
    apiCall('/user/profile', { method: 'PUT', body: JSON.stringify(payload) }),
};

// Notification bell — alerts (insurance expiry, device offline) and events
// (truck added, trip added/completed), scoped to the caller.
export const notifications = {
  list: () => apiCall('/notifications'),

  markRead: (id) =>
    apiCall(`/notifications/${id}/read`, { method: 'POST' }),

  markAllRead: () =>
    apiCall('/notifications/read-all', { method: 'POST' }),
};

// Geo helpers backed by Google Maps. These go through our own /api/geo proxy
// rather than calling Google from the browser, so the billable API key stays on
// the server and out of the JS bundle. The return shapes are unchanged from the
// previous OSM implementation, so callers did not have to change.
export const geo = {
  // Place autocomplete. Returns [{ name, lat, lng }].
  searchPlaces: async (query, { signal } = {}) => {
    const q = query.trim();
    if (q.length < 3) return [];
    const res = await apiCall(`/geo/places?q=${encodeURIComponent(q)}`, { signal });
    return res.places || [];
  },

  // Reverse geocode a { lat, lng } into a named place. Turns a raw GPS fix from
  // the browser into the same { name, lat, lng } shape searchPlaces returns.
  // Falls back to the plain coordinates if the lookup fails, so a good GPS fix
  // is never lost to a flaky network call.
  reverseGeocode: async ({ lat, lng }, { signal } = {}) => {
    try {
      const res = await apiCall(`/geo/reverse?lat=${lat}&lng=${lng}`, { signal });
      return res.place;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      return { name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng };
    }
  },

  // Road route between two { lat, lng } points via the Directions API, routed
  // through an optional ordered list of { lat, lng } intermediate stops.
  // Returns { polyline: [[lat,lng],...], distanceKm, durationMin } or null.
  getRoute: async (from, to, { signal, waypoints = [] } = {}) => {
    const params = new URLSearchParams({
      fromLat: from.lat, fromLng: from.lng, toLat: to.lat, toLng: to.lng,
    });
    if (waypoints.length) {
      params.set('waypoints', waypoints.map((w) => `${w.lat},${w.lng}`).join('|'));
    }
    const res = await apiCall(`/geo/route?${params}`, { signal });
    return res.route;
  },
};

// Superadmin — platform-wide views across every client. All calls 403 for a
// regular client; the frontend also hides these routes/pages from them.
export const admin = {
  listUsers: () => apiCall('/admin/users'),

  setUserStatus: (id, isActive) =>
    apiCall(`/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),

  updateUser: (id, payload) =>
    apiCall(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  removeUser: (id) => apiCall(`/admin/users/${id}`, { method: 'DELETE' }),

  listTrucks: () => apiCall('/admin/trucks'),

  createTruck: (payload) =>
    apiCall('/admin/trucks', { method: 'POST', body: JSON.stringify(payload) }),

  updateTruck: (id, payload) =>
    apiCall(`/admin/trucks/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  removeTruck: (id) => apiCall(`/admin/trucks/${id}`, { method: 'DELETE' }),

  listDevices: () => apiCall('/admin/devices'),

  // Registers a vehicle in the Traccar gateway and assigns it to `owner` (a
  // client id) in one call — the admin equivalent of tracking.registerDevice.
  createDevice: (owner, name, uniqueId, type = 'phone') =>
    apiCall('/admin/devices', {
      method: 'POST',
      body: JSON.stringify({ owner, name, type, ...(uniqueId ? { uniqueId } : {}) }),
    }),

  getStats: () => apiCall('/admin/stats'),
};

// Public (no auth): the trip behind a share token, for the client map page.
// Day-by-day movement history for one GPS device: where it drove, where it held
// and for how long, and distance covered. Distinct from `trips.getTrail`, which
// is scoped to a single planned job rather than a calendar day.
//
// The browser's timezone offset goes with every call so a "day" means the
// operator's local day — without it an IST fleet's early-morning running is
// filed under the previous date.
export const history = {
  day: (deviceId, date) =>
    apiCall(`/history/${deviceId}?date=${date}&tz=${new Date().getTimezoneOffset()}`),

  summary: (deviceId, from, to) =>
    apiCall(
      `/history/${deviceId}/summary?from=${from}&to=${to}&tz=${new Date().getTimezoneOffset()}`
    ),
};

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
