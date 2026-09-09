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

// Builds a query string from a filter object, dropping empty values so a
// cleared filter leaves the URL rather than sending `entity=`.
const toQuery = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, value);
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
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

  // The dashboard's headline numbers — total vehicles, online/offline,
  // active trips, vehicles in maintenance and open alerts — counted on the
  // server so the browser doesn't need the tracking and trips grants (nor four
  // round trips) just to render the strip.
  summary: () => apiCall('/trucks/fleet-summary'),

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
  // Optional filters: { truck: '<truckId>' }, { unassigned: true } or
  // { status: 'On Trip' }.
  list: ({ truck, unassigned, status } = {}) => {
    const params = new URLSearchParams();
    if (truck) params.set('truck', truck);
    if (unassigned) params.set('unassigned', '1');
    if (status) params.set('status', status);
    const qs = params.toString();
    return apiCall(`/drivers${qs ? `?${qs}` : ''}`);
  },

  // The roster vocabulary (statuses). constants/driver.js holds a copy for the
  // first render; this is the authoritative list.
  options: () => apiCall('/drivers/options'),

  create: (payload) =>
    apiCall('/drivers', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id, payload) =>
    apiCall(`/drivers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  remove: (id) => apiCall(`/drivers/${id}`, { method: 'DELETE' }),
};

// Vehicle Documents — the statutory paperwork for one truck (RC, insurance,
// PUC, fitness, permit, road tax), each with its own number, issue/expiry dates
// and an optional scanned copy.
//
// Like the ledger's receipts, list responses omit the file itself:
// `hasAttachment` tells you one exists, and getAttachment(id) fetches it when
// the user actually opens it. Every document also comes back with an
// `expiryState` of 'expired' | 'expiring' | 'valid' | 'none'.
export const vehicleDocuments = {
  // Filters: { truck: '<truckId>' }, { docType: 'PUC' },
  // { state: 'expired' | 'expiring' | 'valid' }.
  list: ({ truck, docType, state } = {}) => {
    const params = new URLSearchParams();
    if (truck) params.set('truck', truck);
    if (docType) params.set('docType', docType);
    if (state && state !== 'all') params.set('state', state);
    const qs = params.toString();
    return apiCall(`/vehicle-documents${qs ? `?${qs}` : ''}`);
  },

  // The paperwork vocabulary (types and their labels). constants/documents.js
  // holds a copy for the first render; this is the authoritative list.
  options: () => apiCall('/vehicle-documents/options'),

  create: (payload) =>
    apiCall('/vehicle-documents', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id, payload) =>
    apiCall(`/vehicle-documents/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  remove: (id) => apiCall(`/vehicle-documents/${id}`, { method: 'DELETE' }),

  // The stored scan as { dataUrl, filename, mimeType, uploadedAt }.
  getAttachment: (id) => apiCall(`/vehicle-documents/${id}/attachment`),
};

// Driver Documents — the same, for a driver: licence, identity proof, training
// endorsements, medical and police verification.
export const driverDocuments = {
  // Filters: { driver: '<driverId>' }, { docType: 'Licence' },
  // { state: 'expired' | 'expiring' | 'valid' }.
  list: ({ driver, docType, state } = {}) => {
    const params = new URLSearchParams();
    if (driver) params.set('driver', driver);
    if (docType) params.set('docType', docType);
    if (state && state !== 'all') params.set('state', state);
    const qs = params.toString();
    return apiCall(`/driver-documents${qs ? `?${qs}` : ''}`);
  },

  options: () => apiCall('/driver-documents/options'),

  create: (payload) =>
    apiCall('/driver-documents', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id, payload) =>
    apiCall(`/driver-documents/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  remove: (id) => apiCall(`/driver-documents/${id}`, { method: 'DELETE' }),

  getAttachment: (id) => apiCall(`/driver-documents/${id}/attachment`),
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
// Company Master — the transporter's own company record: identity (name, legal
// name, GSTIN/PAN), registered address, points of contact, logo, timezone and
// whether the record is active. It is what the generated LRs and invoices are
// headed with, so it lives apart from the login profile in `user` below.
export const companies = {
  // Resolves to { success, company } where company is null until the first save.
  get: () => apiCall('/companies'),

  // PUT creates the record on first save, so the form never has to pick a verb.
  save: (payload) =>
    apiCall('/companies', { method: 'PUT', body: JSON.stringify(payload) }),

  remove: () => apiCall('/companies', { method: 'DELETE' }),
};

export const user = {
  getProfile: () => apiCall('/user/profile'),

  updateProfile: (payload) =>
    apiCall('/user/profile', { method: 'PUT', body: JSON.stringify(payload) }),
};

// The team roster inside one account: the Company Admin plus the Fleet
// Managers, Accountants, Viewers and Drivers they have added. Everything here
// is scoped server-side to the caller's account — a company can only ever see
// and change its own seats. Distinct from `admin.listUsers`, which is the
// platform operator's cross-account view of account owners.
export const users = {
  list: () => apiCall('/users'),

  // The roles this account may assign, with the permission list each carries.
  // Fetched rather than hardcoded so the labels cannot drift from the server's
  // enum.
  roles: () => apiCall('/users/roles'),

  create: (payload) =>
    apiCall('/users', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id, payload) =>
    apiCall(`/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  setStatus: (id, isActive) =>
    apiCall(`/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),

  // Admin-set password — the counterpart to the user's own OTP reset flow.
  resetPassword: (id, newPassword) =>
    apiCall(`/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    }),

  remove: (id) => apiCall(`/users/${id}`, { method: 'DELETE' }),
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
// The audit trail — who changed what, from what to what, and when.
//
// Read-only by design: entries are written server-side as a side effect of the
// change they describe, so there is nothing here to create, edit or delete.
export const audit = {
  // Filters are passed through as-is; anything the server does not recognise is
  // ignored there rather than erroring, so a stale saved filter still loads.
  // Accepts { entity, action, actor, search, from, to, page, limit }.
  list: (filters = {}) => apiCall(`/audit${toQuery(filters)}`),

  // The vocabularies the filter bar is built from, including the people who
  // actually appear in this account's trail.
  options: () => apiCall('/audit/options'),

  // Headline counts for the strip above the table.
  stats: () => apiCall('/audit/stats'),

  // Everything that has happened to one record — the History panel on a truck
  // or a trip.
  forRecord: (entity, id) => apiCall(`/audit/entity/${entity}/${id}`),

  // Downloads the current view as CSV.
  //
  // Not an apiCall: that parses every response as JSON, and this one is a file.
  // The token cannot ride in a header on a plain navigation, so the response is
  // fetched with auth and handed to the browser as a blob instead.
  exportCsv: async (filters = {}) => {
    const response = await fetch(`${API_BASE_URL}/audit/export${toQuery(filters)}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}` },
    });
    if (!response.ok) {
      throw { status: response.status, message: 'Failed to export the audit log' };
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Released on the next tick — revoking it synchronously can cancel the
    // download in Safari before it has started reading the blob.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

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

  // The device master's vocabularies (unit types, lifecycle statuses), served
  // from the same lists the model validates against.
  deviceOptions: () => apiCall('/admin/devices/options'),

  // Registers a vehicle in the Traccar gateway and assigns it to `owner` (a
  // client id) in one call — the admin equivalent of tracking.registerDevice.
  // `master` carries the optional device-master fields (model, SIM, firmware,
  // install date, fitted vehicle); the Live Tracking quick-add omits it.
  createDevice: (owner, name, uniqueId, type = 'phone', master = {}) =>
    apiCall('/admin/devices', {
      method: 'POST',
      body: JSON.stringify({ owner, name, type, ...(uniqueId ? { uniqueId } : {}), ...master }),
    }),

  // Edits one device's master record. The gateway identity (uniqueId) is fixed
  // and is not part of the payload.
  updateDevice: (id, payload) =>
    apiCall(`/admin/devices/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  removeDevice: (id) => apiCall(`/admin/devices/${id}`, { method: 'DELETE' }),

  getStats: () => apiCall('/admin/stats'),

  // The platform-wide role permission matrix. Editing this changes what every
  // customer's Fleet Manager, Accountant, Viewer and Driver may do — the two
  // admin roles are fixed in code and come back read-only under `matrix.locked`.
  getPermissions: () => apiCall('/admin/permissions'),

  // Replaces one role's grants outright; the editor holds the full list, so a
  // replace makes clearing the last tick unambiguous.
  savePermissions: (role, grants) =>
    apiCall(`/admin/permissions/${role}`, {
      method: 'PUT',
      body: JSON.stringify({ grants }),
    }),

  resetPermissions: (role) =>
    apiCall(`/admin/permissions/${role}/reset`, { method: 'POST' }),

  // The platform-wide audit trail — every client's activity, plus the entries
  // that belong to no account at all (a failed sign-in against an unknown
  // email, a role-matrix edit, a deleted client). Same filters as audit.list,
  // plus `account` to narrow to one client.
  auditLog: (filters = {}) => apiCall(`/admin/audit${toQuery(filters)}`),
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

// Customers — the customer master a trip is booked against. Distinct from the
// consignor/consignee blocks embedded on a billing trip, which stay as they are
// so historic LRs and invoices keep rendering from what was typed at the time.
export const customers = {
  // Filters: { search: 'acme' } for the trip form's picker,
  // { status: 'Active' } for the master list. `signal` is forwarded rather
  // than filtered into the query string so the picker can cancel a search that
  // a newer keystroke has superseded.
  list: ({ search, status, signal } = {}) =>
    apiCall(`/customers${toQuery({ search, status })}`, signal ? { signal } : {}),

  // One customer, plus a small summary of their trips.
  get: (id) => apiCall(`/customers/${id}`),

  options: () => apiCall('/customers/options'),

  create: (payload) =>
    apiCall('/customers', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id, payload) =>
    apiCall(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  // Refused with a 409 while trips still reference the customer; the error
  // says how many and suggests marking them Inactive instead.
  remove: (id) => apiCall(`/customers/${id}`, { method: 'DELETE' }),
};

// Trip Management — the operational trip: who it is for, what it carries, who
// drives it, what it earned and what it cost.
//
// Three trip-shaped things now exist in this API and they are not the same:
//   tripOrders (here)  the job the office dispatches
//   trips              the GPS route and the trail actually driven
//   billing            the LR and tax invoice paperwork
//
// Every money and distance figure below is computed by the server. Nothing in
// the UI recalculates a total — a browser-side number is one nobody can audit,
// and two screens disagreeing about a trip's profit is worse than either being
// a moment stale.
export const tripOrders = {
  // The trip list. All filtering, sorting and pagination happen server-side:
  // a fleet accumulates thousands of trips and the browser should never hold
  // them all. Returns { trips, pagination }.
  list: ({
    page, limit, search, status, tripType,
    customer, truck, driver, from, to, sortBy, sortDir,
  } = {}) =>
    apiCall(`/trip-orders${toQuery({
      page, limit, search,
      // Multi-select filters go as comma-separated lists.
      status: Array.isArray(status) ? status.join(',') : status,
      tripType: Array.isArray(tripType) ? tripType.join(',') : tripType,
      customer, truck, driver, from, to, sortBy, sortDir,
    })}`),

  // Counts by status and the money totals behind the list's stat strip,
  // aggregated in the database rather than by loading every trip.
  summary: () => apiCall('/trip-orders/summary'),

  // The dropdown vocabulary — types, statuses, categories, checklist items.
  // Authoritative; constants/trip.js holds a copy for the first render.
  options: () => apiCall('/trip-orders/options'),

  // What the next trip number would be. A preview only: the number is actually
  // allocated at save time, so two people on the form at once still get
  // distinct numbers.
  nextNumber: () => apiCall('/trip-orders/next-number'),

  // One trip in full, with { profitability, variance, allowedTransitions }.
  // `allowedTransitions` is what the detail page's action buttons are built
  // from, so the UI can never offer a move the server would refuse.
  get: (id) => apiCall(`/trip-orders/${id}`),

  create: (payload) =>
    apiCall('/trip-orders', { method: 'POST', body: JSON.stringify(payload) }),

  // Edits the trip's own fields only. Assignment, stops, cargo, money and
  // status each have their own call below, because each has validation a
  // generic update cannot perform.
  update: (id, payload) =>
    apiCall(`/trip-orders/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  // Only a draft can be deleted. A dispatched trip is a record of something
  // that happened, so it is cancelled instead — the API returns a 409 saying so.
  remove: (id) => apiCall(`/trip-orders/${id}`, { method: 'DELETE' }),

  // Move the trip through its lifecycle. Rejected with a 409 and a plain-English
  // reason when the transition is not legal, or when the dispatch checklist is
  // incomplete (the response then carries `missingChecklistItems`).
  setStatus: (id, status, { reason, lat, lng } = {}) =>
    apiCall(`/trip-orders/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, reason, lat, lng }),
    }),

  // --- Assignment -------------------------------------------------------
  // The fleet and roster for this trip, each row marked with the trip already
  // holding it (`busyOnTrip`), so the picker can show why rather than hide it.
  assignmentOptions: (id) => apiCall(`/trip-orders/${id}/assignment-options`),

  // The verdict for one vehicle or driver without committing:
  // { ok, blockers, warnings, detail }. Blockers refuse the assignment;
  // warnings are shown and the assignment proceeds.
  checkVehicle: (id, truckId) => apiCall(`/trip-orders/${id}/vehicle-check/${truckId}`),
  checkDriver: (id, driverId) => apiCall(`/trip-orders/${id}/driver-check/${driverId}`),

  // `allowOverride` pushes past a blocker. Only a seat holding trips:manage may;
  // for anyone else the API refuses and returns canOverride: false. Every
  // override is recorded on the trip and in the audit log.
  assignVehicle: (id, truck, { allowOverride = false } = {}) =>
    apiCall(`/trip-orders/${id}/assign-vehicle`, {
      method: 'POST',
      body: JSON.stringify({ truck, allowOverride }),
    }),

  assignDriver: (id, driver, { allowOverride = false } = {}) =>
    apiCall(`/trip-orders/${id}/assign-driver`, {
      method: 'POST',
      body: JSON.stringify({ driver, allowOverride }),
    }),

  saveCrew: (id, crew) =>
    apiCall(`/trip-orders/${id}/crew`, { method: 'PUT', body: JSON.stringify({ crew }) }),

  // --- Stops ------------------------------------------------------------
  // Replaces the whole list in travel order — this is also how a reorder is
  // saved. Stops that already exist keep their arrival times and POD; only the
  // planning fields are taken from what is sent.
  saveStops: (id, stops) =>
    apiCall(`/trip-orders/${id}/stops`, { method: 'PUT', body: JSON.stringify({ stops }) }),

  addStop: (id, stop) =>
    apiCall(`/trip-orders/${id}/stops`, { method: 'POST', body: JSON.stringify(stop) }),

  // `action` of 'arrive' | 'depart' | 'complete' | 'skip' stamps the times;
  // omitting it edits the stop's planning fields instead.
  updateStop: (id, stopId, payload) =>
    apiCall(`/trip-orders/${id}/stops/${stopId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  saveStopPod: (id, stopId, pod) =>
    apiCall(`/trip-orders/${id}/stops/${stopId}/pod`, {
      method: 'PUT',
      body: JSON.stringify(pod),
    }),

  // A stop the vehicle already reached is marked skipped rather than deleted —
  // the response says which happened via `skipped`.
  removeStop: (id, stopId) =>
    apiCall(`/trip-orders/${id}/stops/${stopId}`, { method: 'DELETE' }),

  // --- Cargo ------------------------------------------------------------
  // Replaces the cargo list and returns `capacityCheck` against the assigned
  // vehicle. Over-capacity does not fail this call — it is the assignment that
  // blocks, which is where an overloaded vehicle would actually be dispatched.
  saveCargo: (id, cargo) =>
    apiCall(`/trip-orders/${id}/cargo`, { method: 'PUT', body: JSON.stringify({ cargo }) }),

  // --- Money ------------------------------------------------------------
  // Each of these returns the recomputed `totals` alongside the lines, so the
  // UI updates its figures from the server's arithmetic rather than its own.
  addRevenue: (id, line) =>
    apiCall(`/trip-orders/${id}/revenue`, { method: 'POST', body: JSON.stringify(line) }),

  updateRevenue: (id, lineId, line) =>
    apiCall(`/trip-orders/${id}/revenue/${lineId}`, { method: 'PUT', body: JSON.stringify(line) }),

  removeRevenue: (id, lineId) =>
    apiCall(`/trip-orders/${id}/revenue/${lineId}`, { method: 'DELETE' }),

  addExpense: (id, line) =>
    apiCall(`/trip-orders/${id}/expenses`, { method: 'POST', body: JSON.stringify(line) }),

  updateExpense: (id, lineId, line) =>
    apiCall(`/trip-orders/${id}/expenses/${lineId}`, { method: 'PUT', body: JSON.stringify(line) }),

  removeExpense: (id, lineId) =>
    apiCall(`/trip-orders/${id}/expenses/${lineId}`, { method: 'DELETE' }),

  // Expense lists omit the scanned bill; `hasReceipt` says one exists and this
  // fetches it when the user opens it. Same pattern as the ledger's receipts.
  getReceipt: (id, lineId) => apiCall(`/trip-orders/${id}/expenses/${lineId}/receipt`),

  // Revenue - expenses = profit, plus the per-km rates and margin. Server-side.
  profitability: (id) => apiCall(`/trip-orders/${id}/profitability`),

  // --- Execution --------------------------------------------------------
  saveChecklist: (id, checklist) =>
    apiCall(`/trip-orders/${id}/checklist`, {
      method: 'PUT',
      body: JSON.stringify({ checklist }),
    }),

  // Starting odometer is required. Moves the trip to In Transit, going through
  // Dispatched (and its checklist gate) if it was only Ready.
  start: (id, reading) =>
    apiCall(`/trip-orders/${id}/start`, { method: 'POST', body: JSON.stringify(reading) }),

  // Final odometer is required and must not be below the starting one — the API
  // refuses with a 400 naming both readings.
  end: (id, reading) =>
    apiCall(`/trip-orders/${id}/end`, { method: 'POST', body: JSON.stringify(reading) }),

  // --- POD, documents, events ------------------------------------------
  savePod: (id, pod) =>
    apiCall(`/trip-orders/${id}/pod`, { method: 'PUT', body: JSON.stringify(pod) }),

  // The signature and photo behind a POD, fetched only when it is opened. Pass
  // { stopId } for a per-stop POD.
  getPodMedia: (id, { stopId } = {}) =>
    apiCall(`/trip-orders/${id}/pod/media${toQuery({ stopId })}`),

  listDocuments: (id) => apiCall(`/trip-orders/${id}/documents`),

  addDocument: (id, document) =>
    apiCall(`/trip-orders/${id}/documents`, { method: 'POST', body: JSON.stringify(document) }),

  getDocument: (id, docId) => apiCall(`/trip-orders/${id}/documents/${docId}`),

  removeDocument: (id, docId) =>
    apiCall(`/trip-orders/${id}/documents/${docId}`, { method: 'DELETE' }),

  addEvent: (id, event) =>
    apiCall(`/trip-orders/${id}/events`, { method: 'POST', body: JSON.stringify(event) }),

  // Status changes, events, stop arrivals and the POD merged into one ordered
  // list by the server, so the Activity tab renders it directly.
  timeline: (id) => apiCall(`/trip-orders/${id}/timeline`),

  // Where the vehicle is and how it is doing against the plan. When there is no
  // tracker or no linked route this returns { available: false, reason } — the
  // UI shows that reason rather than an invented position or ETA.
  tracking: (id) => apiCall(`/trip-orders/${id}/tracking`),
};

// Fuel Management — the fuelling register and its efficiency reports.
//
// Fuel is vehicle-centric: an entry needs a vehicle but not a trip, because a
// yard top-up between jobs is still a filling and the fleet's mileage history
// is only continuous if it is recorded. Where an entry does name a trip, the
// server maintains that trip's fuel expense line from it, so the bill is typed
// once and the trip's profit still accounts for it.
//
// Every KM/L, cost/km and L/100KM figure below is computed by the server.
// Nothing in the UI recalculates one — a browser-side number is one nobody can
// audit, and a null means "not known", which is rendered as a dash and never
// as a zero.
export const fuel = {
  // The register. All filtering, sorting and pagination happen server-side: a
  // fleet records a filling per vehicle every few days and the browser should
  // never hold them all. Returns { entries, pagination }.
  list: ({
    page, limit, search, truck, driver, trip, fuelType, station,
    from, to, flagged, unreviewed, sortBy, sortDir,
  } = {}) =>
    apiCall(`/fuel${toQuery({
      page, limit, search, truck, driver, trip, fuelType, station,
      from, to, sortBy, sortDir,
      // Only sent when true: `flagged=false` would read as a filter for
      // unflagged entries, which is not what an unticked box means.
      flagged: flagged ? 'true' : undefined,
      unreviewed: unreviewed ? 'true' : undefined,
    })}`),

  // One entry in full, receipt image included. The list omits the image.
  get: (id) => apiCall(`/fuel/${id}`),

  // The dropdown vocabulary — fuel types with their units, payment modes, fill
  // types, flag reasons. Authoritative; constants/fuel.js holds a copy for the
  // first render.
  options: () => apiCall('/fuel/options'),

  // Station names this account has already used, most-used first, for the
  // entry form's autocomplete. Typing a pump that already exists should be one
  // keystroke rather than a re-spelling that splits the station-wise report.
  stations: ({ search } = {}) => apiCall(`/fuel/stations${toQuery({ search })}`),

  // The previous filling for a vehicle, so the form can show the last odometer
  // reading while the operator types the new one — catching a transposed digit
  // at the keyboard beats flagging it afterwards.
  lastEntry: (truckId) => apiCall(`/fuel/last-entry/${truckId}`),

  create: (payload) => apiCall('/fuel', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id, payload) =>
    apiCall(`/fuel/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  remove: (id) => apiCall(`/fuel/${id}`, { method: 'DELETE' }),

  // Dismiss an entry's outlier flags after looking into them (M3-F06). The
  // flags stay on the record — they were genuinely raised — but it stops
  // counting as outstanding.
  review: (id, note) =>
    apiCall(`/fuel/${id}/review`, { method: 'POST', body: JSON.stringify({ note }) }),

  // --- M3-F07 reports ----------------------------------------------------
  // All of these take the same filter set as `list`.

  // The stat strip: bought, spent, burnt, and how much needs looking at.
  summary: (filters = {}) => apiCall(`/fuel/summary${toQuery(filters)}`),

  // Grouped consumption, cost and efficiency. `groupBy` is one of
  // vehicle | driver | station | trip.
  report: (groupBy, filters = {}) => apiCall(`/fuel/reports/${groupBy}${toQuery(filters)}`),

  // Spend and efficiency over time, bucketed by day, month or year.
  trend: ({ granularity = 'month', ...filters } = {}) =>
    apiCall(`/fuel/trend${toQuery({ granularity, ...filters })}`),

  // Vehicles ranked by efficiency, each against the fleet average for its own
  // fuel type — the fleet-wide view behind M3-F06.
  efficiency: (filters = {}) => apiCall(`/fuel/efficiency${toQuery(filters)}`),

  // --- M3-F06 thresholds -------------------------------------------------

  getSettings: () => apiCall('/fuel/settings'),

  saveSettings: (payload) =>
    apiCall('/fuel/settings', { method: 'PUT', body: JSON.stringify(payload) }),

  // Re-measure and re-judge one vehicle's whole history against the current
  // thresholds. Deliberately explicit and per vehicle: saving the settings does
  // not silently rewrite every entry the account has ever recorded.
  recompute: (truck) =>
    apiCall('/fuel/recompute', { method: 'POST', body: JSON.stringify({ truck }) }),
};

// Maintenance Management — services, repairs, and the tyre and battery masters.
//
// Vehicle-centric like fuel: a service, a repair, a tyre and a battery all
// belong to a vehicle and to no trip. Where the module differs is that it
// tracks *fitted components* — a tyre is an asset that moves between positions
// and is eventually scrapped, not an event that happens once.
//
// Every job total, cost per kilometre and due-date verdict below is computed by
// the server. Nothing in the UI recalculates one, and a null means "not known",
// rendered as a dash and never as a zero.
export const maintenance = {
  // The dropdown vocabulary — service types with their intervals, the repair
  // workflow and what each state may move to, tyre positions, battery health.
  // Authoritative; constants/maintenance.js holds a copy for the first render.
  options: () => apiCall('/maintenance/options'),

  // M3-M01. Upcoming and overdue service, vehicles under repair, maintenance
  // cost, and tyre/battery status — one call, so the screen makes one request
  // rather than six.
  dashboard: (filters = {}) => apiCall(`/maintenance/dashboard${toQuery(filters)}`),

  // M3-M10. What is due or overdue across services, tyres and batteries, worst
  // first. Filterable by `kind` (service | tyre | battery) and `status`
  // (overdue | due).
  reminders: ({ truck, kind, status } = {}) =>
    apiCall(`/maintenance/reminders${toQuery({ truck, kind, status })}`),

  // Workshop names this account has already used, most-used first, for the job
  // card autocomplete. Typing a garage that already exists should be one
  // keystroke rather than a re-spelling that splits the vendor report.
  workshops: ({ search } = {}) => apiCall(`/maintenance/workshops${toQuery({ search })}`),

  // What the form should suggest for "next service", given a type and a
  // reading. A suggestion only — the record stores whatever the workshop
  // actually specified.
  nextServiceSuggestion: ({ serviceType, servicedAt, odometer } = {}) =>
    apiCall(`/maintenance/next-service-suggestion${toQuery({ serviceType, servicedAt, odometer })}`),

  // One vehicle's service and repair history, plus the newest service of each
  // type — what each reminder clock hangs off.
  vehicleHistory: (truckId) => apiCall(`/maintenance/vehicle/${truckId}/history`),

  // --- M3-M02: service records -------------------------------------------

  services: {
    // The register. Filtering, sorting and pagination are all server-side.
    // Returns { records, pagination }.
    list: ({ page, limit, search, truck, serviceType, workshop, from, to, sortBy, sortDir } = {}) =>
      apiCall(`/maintenance/services${toQuery({
        page, limit, search, truck, serviceType, workshop, from, to, sortBy, sortDir,
      })}`),

    // One record in full, invoice image included. The list omits the image.
    get: (id) => apiCall(`/maintenance/services/${id}`),

    create: (payload) =>
      apiCall('/maintenance/services', { method: 'POST', body: JSON.stringify(payload) }),

    update: (id, payload) =>
      apiCall(`/maintenance/services/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

    remove: (id) => apiCall(`/maintenance/services/${id}`, { method: 'DELETE' }),
  },

  // --- M3-M04 / M3-M05: repair requests ----------------------------------

  repairs: {
    // `open: true` narrows to everything not yet finished — the workshop queue.
    list: ({ page, limit, search, truck, status, priority, workshop, from, to, open, sortBy, sortDir } = {}) =>
      apiCall(`/maintenance/repairs${toQuery({
        page, limit, search, truck, status, priority, workshop, from, to, sortBy, sortDir,
        // Only sent when true: `open=false` would read as a filter for closed
        // jobs, which is not what an unticked box means.
        open: open ? 'true' : undefined,
      })}`),

    get: (id) => apiCall(`/maintenance/repairs/${id}`),

    // The number the next request would take, for the form to show before
    // anything is saved. A preview: it is not reserved.
    nextNumber: () => apiCall('/maintenance/repairs/next-number'),

    create: (payload) =>
      apiCall('/maintenance/repairs', { method: 'POST', body: JSON.stringify(payload) }),

    update: (id, payload) =>
      apiCall(`/maintenance/repairs/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

    // M3-M05. The only way a repair status changes: the server checks the
    // transition is legal, appends to the job history and stamps the
    // milestones the downtime figure is measured between. It also moves the
    // vehicle own status to Maintenance while work is in progress.
    setStatus: (id, status, note = '') =>
      apiCall(`/maintenance/repairs/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, note }),
      }),

    remove: (id) => apiCall(`/maintenance/repairs/${id}`, { method: 'DELETE' }),
  },

  // --- M3-M11: reports ---------------------------------------------------
  // All of these take the same filter set as the lists.

  // The stat strip: what was spent, on what, and how much of it was unplanned.
  summary: (filters = {}) => apiCall(`/maintenance/summary${toQuery(filters)}`),

  // Grouped cost and activity. `groupBy` is one of
  // vehicle | service | vendor | part | tyre | battery | repair.
  report: (groupBy, filters = {}) =>
    apiCall(`/maintenance/reports/${groupBy}${toQuery(filters)}`),

  // Spend over time, bucketed by day, month or year.
  trend: ({ granularity = 'month', ...filters } = {}) =>
    apiCall(`/maintenance/trend${toQuery({ granularity, ...filters })}`),

  // --- M3-M10: reminder thresholds ---------------------------------------

  getSettings: () => apiCall('/maintenance/settings'),

  saveSettings: (payload) =>
    apiCall('/maintenance/settings', { method: 'PUT', body: JSON.stringify(payload) }),
};

// The tyre and battery masters (M3-M06 to M3-M09).
//
// Separate from `maintenance` above because these are asset registers with a
// fit/remove/scrap lifecycle rather than job cards, though both sit behind the
// same `maintenance` permission resource.
//
// A tyre or battery is always created into stock and reaches a vehicle through
// `fit` / `install`. That is not a formality: those endpoints open the stint the
// component life is measured over, and a record that skipped them would have no
// distance and therefore no cost per kilometre, ever.
export const components = {
  tyres: {
    // `dueForReplacement: true` narrows to fitted tyres at or below the
    // account minimum tread — the replacement queue.
    list: ({ page, limit, search, truck, status, position, brand, dueForReplacement, sortBy, sortDir } = {}) =>
      apiCall(`/components/tyres${toQuery({
        page, limit, search, truck, status, position, brand, sortBy, sortDir,
        dueForReplacement: dueForReplacement ? 'true' : undefined,
      })}`),

    // One tyre in full, fitment and retread history included. The list omits
    // both — a tyre with twenty fitments is rows of data no table cell shows.
    get: (id) => apiCall(`/components/tyres/${id}`),

    // M3-M07. A vehicle current tyre layout, keyed by position so the UI can
    // draw an axle diagram without deciding which tyre is at which corner.
    layout: (truckId) => apiCall(`/components/tyres/layout/${truckId}`),

    create: (payload) =>
      apiCall('/components/tyres', { method: 'POST', body: JSON.stringify(payload) }),

    update: (id, payload) =>
      apiCall(`/components/tyres/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

    // Put a tyre on a vehicle at a position. The odometer reading is required:
    // it anchors the distance the tyre cost per km is measured from.
    fit: (id, { truck, position, odometer, fittedAt, notes } = {}) =>
      apiCall(`/components/tyres/${id}/fit`, {
        method: 'POST',
        body: JSON.stringify({ truck, position, odometer, fittedAt, notes }),
      }),

    // Take it off, closing the stint and banking its distance.
    remove: (id, { odometer, removedAt, treadAtRemovalMm, reason, status, notes } = {}) =>
      apiCall(`/components/tyres/${id}/remove`, {
        method: 'POST',
        body: JSON.stringify({ odometer, removedAt, treadAtRemovalMm, reason, status, notes }),
      }),

    // Record a retread. The casing keeps its accumulated distance and the cost
    // is folded into its per-km figure — a tyre retreaded once has cost its
    // price plus the retread over its whole life.
    retread: (id, { date, vendor, cost, notes } = {}) =>
      apiCall(`/components/tyres/${id}/retread`, {
        method: 'POST',
        body: JSON.stringify({ date, vendor, cost, notes }),
      }),

    destroy: (id) => apiCall(`/components/tyres/${id}`, { method: 'DELETE' }),
  },

  batteries: {
    list: ({ page, limit, search, truck, status, brand, health, inWarranty, dueForReplacement, sortBy, sortDir } = {}) =>
      apiCall(`/components/batteries${toQuery({
        page, limit, search, truck, status, brand, health, sortBy, sortDir,
        inWarranty: inWarranty ? 'true' : undefined,
        dueForReplacement: dueForReplacement ? 'true' : undefined,
      })}`),

    get: (id) => apiCall(`/components/batteries/${id}`),

    create: (payload) =>
      apiCall('/components/batteries', { method: 'POST', body: JSON.stringify(payload) }),

    update: (id, payload) =>
      apiCall(`/components/batteries/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

    // Fit it to a vehicle. Where the named position is already occupied, the
    // server retires the battery that was there and links the two, so a
    // vehicle battery history reads as a chain.
    install: (id, { truck, position, odometer, installedAt } = {}) =>
      apiCall(`/components/batteries/${id}/install`, {
        method: 'POST',
        body: JSON.stringify({ truck, position, odometer, installedAt }),
      }),

    // Take it off. `status` distinguishes a battery put back in the store from
    // one scrapped or sent back under warranty.
    remove: (id, { status, reason } = {}) =>
      apiCall(`/components/batteries/${id}/remove`, {
        method: 'POST',
        body: JSON.stringify({ status, reason }),
      }),

    // M3-M09. A voltage/health check. Health is the tester verdict, not
    // something derived from the voltage — a tired battery reads fine at rest
    // and collapses under load.
    check: (id, { date, voltage, health, specificGravity, checkedBy, notes } = {}) =>
      apiCall(`/components/batteries/${id}/check`, {
        method: 'POST',
        body: JSON.stringify({ date, voltage, health, specificGravity, checkedBy, notes }),
      }),

    destroy: (id) => apiCall(`/components/batteries/${id}`, { method: 'DELETE' }),
  },
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
