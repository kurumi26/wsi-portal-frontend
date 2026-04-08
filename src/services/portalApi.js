const API_BASE_URL = import.meta.env.VITE_API_URL;
const TOKEN_STORAGE_KEY = 'wsi-auth-token';

let authToken = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;

function getHeaders(customHeaders = {}) {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return headers;
}

async function apiRequest(path, options = {}) {
  let response;
  console.log('BASE URL: '+API_BASE_URL)
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: getHeaders(options.headers),
    });
  } catch (err) {
    console.error('Network request failed:', err);
    throw new Error(err.message || 'Network request failed');
  }

  if (response.status === 204) {
    return null;
  }

  const rawText = await response.text();
  let data = {};

  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { message: rawText };
    }
  }

  if (!response.ok) {
    const validationMessage = data.errors ? Object.values(data.errors).flat().join(' ') : null;
    console.error('API error', { path: path, status: response.status, data });

    throw new Error(validationMessage || data.message || `Request failed with status ${response.status}`);
  }

  return data;
}

export const portalApi = {
  setAuthToken(token) {
    authToken = token;

    if (typeof window === 'undefined') {
      return;
    }

    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      return;
    }

    localStorage.removeItem(TOKEN_STORAGE_KEY);
  },

  getStoredToken() {
    return authToken;
  },

  clearAuthToken() {
    this.setAuthToken(null);
  },

  async login(payload) {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async register(payload) {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getCurrentUser() {
    const data = await apiRequest('/auth/me');
    return data.user;
  },

  async getSecuritySettings() {
    return apiRequest('/auth/security');
  },

  async updateProfile(payload) {
    return apiRequest('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async updatePassword(payload) {
    return apiRequest('/auth/password', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async updateTwoFactor(payload) {
    return apiRequest('/auth/two-factor', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async revokeSession(sessionId) {
    return apiRequest(`/auth/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  },

  async revokeOtherSessions() {
    return apiRequest('/auth/sessions/others', {
      method: 'DELETE',
    });
  },

  async getServices() {
    return apiRequest('/services');
  },

  async getOrders() {
    return apiRequest('/orders/me');
  },

  async getMyServices() {
    return apiRequest('/customer-services/me');
  },

  async getNotifications() {
    return apiRequest('/notifications/me');
  },

  async updateNotification(notificationId, isRead) {
    return apiRequest(`/notifications/${notificationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isRead }),
    });
  },

  async markAllNotificationsRead() {
    return apiRequest('/notifications/mark-all-read', {
      method: 'POST',
    });
  },

  async dismissNotification(notificationId) {
    return apiRequest(`/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  },

  async uploadPaymentProof(orderNumberOrId, file) {
    // orderNumberOrId may be the order_number (route key) or internal id
    const form = new FormData();
    form.append('proof', file);

    const path = typeof orderNumberOrId === 'string' ? `/orders/${orderNumberOrId}/upload-proof` : `/orders/${orderNumberOrId}/upload-proof`;

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        // leave out Content-Type so browser sets multipart boundary
        Authorization: authToken ? `Bearer ${authToken}` : undefined,
        Accept: 'application/json',
      },
      body: form,
    });

    if (response.status === 204) return null;

    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : {};
    if (!response.ok) throw new Error(data.message || 'Upload failed');
    return data;
  },

  async checkout(payload) {
    return apiRequest('/orders/checkout', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getClients() {
    return apiRequest('/admin/clients');
  },

  async getAdminUsers() {
    return apiRequest('/admin/users');
  },

  async getAdminPurchases() {
    return apiRequest('/admin/purchases');
  },

  async approveAdminOrder(orderId) {
    return apiRequest(`/admin/purchases/${orderId}/approve`, {
      method: 'PATCH',
    });
  },

  async getAdminServices() {
    return apiRequest('/admin/customer-services');
  },

  async createCatalogService(payload) {
    return apiRequest('/admin/catalog-services', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateCatalogService(serviceId, payload) {
    return apiRequest(`/admin/catalog-services/${serviceId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async createAdminService(payload) {
    return apiRequest('/admin/customer-services', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async requestServiceCancellation(serviceId, reason) {
    const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
    const payload = {
      reason: normalizedReason,
      ...(normalizedReason ? {
        customerNote: normalizedReason,
        customer_note: normalizedReason,
        note: normalizedReason,
        comment: normalizedReason,
      } : {}),
    };

    return apiRequest(`/admin/customer-services/${serviceId}/request-cancellation`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async requestCustomerServiceCancellation(serviceId, reason) {
    const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
    const payload = {
      reason: normalizedReason,
      ...(normalizedReason ? {
        customerNote: normalizedReason,
        customer_note: normalizedReason,
        note: normalizedReason,
        comment: normalizedReason,
      } : {}),
    };

    return apiRequest(`/customer-services/${serviceId}/request-cancellation`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async reportServiceIssue(serviceId, message) {
    return apiRequest(`/customer-services/${serviceId}/report-issue`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  async approveServiceCancellation(serviceId) {
    return apiRequest(`/admin/customer-services/${serviceId}/approve-cancellation`, {
      method: 'PATCH',
    });
  },

  async rejectServiceCancellation(serviceId) {
    return apiRequest(`/admin/customer-services/${serviceId}/reject-cancellation`, {
      method: 'PATCH',
    });
  },

  async updateServiceStatus(serviceId, status) {
    return apiRequest(`/admin/customer-services/${serviceId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async approveProfileUpdateRequest(requestId, note) {
    return apiRequest(`/admin/profile-update-requests/${requestId}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ note }),
    });
  },

  async rejectProfileUpdateRequest(requestId, note) {
    return apiRequest(`/admin/profile-update-requests/${requestId}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ note }),
    });
  },

  async updateAdminUser(userId, payload) {
    return apiRequest(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async createAdminUser(payload) {
    return apiRequest('/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async resetAdminUserPassword(userId, payload) {
    return apiRequest(`/admin/users/${userId}/password`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async updateAdminUserStatus(userId, enabled) {
    return apiRequest(`/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    });
  },

  async approveClientRegistration(userId, note) {
    return apiRequest(`/admin/clients/${userId}/approve-registration`, {
      method: 'PATCH',
      body: JSON.stringify({ note }),
    });
  },

  async rejectClientRegistration(userId, note) {
    return apiRequest(`/admin/clients/${userId}/reject-registration`, {
      method: 'PATCH',
      body: JSON.stringify({ note }),
    });
  },

  async updateClientBilling(userId, payload) {
    return apiRequest(`/admin/clients/${userId}/billing`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async updateClientAccount(userId, payload) {
    return apiRequest(`/admin/clients/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async updateClientAccountStatus(userId, enabled) {
    return apiRequest(`/admin/clients/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    });
  },
};
