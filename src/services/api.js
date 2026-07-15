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
