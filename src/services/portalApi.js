import { jsPDF } from 'jspdf';

const API_BASE_URL = import.meta.env.VITE_API_URL;
const TOKEN_STORAGE_KEY = 'wsi-auth-token';
const CONTENT_DISPOSITION_FILENAME_STAR_PATTERN = /filename\*=(?:UTF-8'')?([^;]+)/i;
const CONTENT_DISPOSITION_FILENAME_PATTERN = /filename="?([^";]+)"?/i;
const PDF_SIGNATURE = '%PDF-';

let authToken = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;

function sanitizeFileName(value, fallback = 'download') {
  const normalized = typeof value === 'string' ? value.trim() : '';
  const safeName = normalized.replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '-').replace(/\s+/g, ' ').trim();

  return safeName || fallback;
}

function parseDownloadFileName(contentDisposition) {
  if (!contentDisposition) {
    return '';
  }

  const encodedMatch = contentDisposition.match(CONTENT_DISPOSITION_FILENAME_STAR_PATTERN);

  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1].trim().replace(/^"|"$/g, ''));
    } catch {
      return encodedMatch[1].trim().replace(/^"|"$/g, '');
    }
  }

  const plainMatch = contentDisposition.match(CONTENT_DISPOSITION_FILENAME_PATTERN);
  return plainMatch?.[1]?.trim() ?? '';
}

function stripFileExtension(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized.replace(/\.[^./\\]+$/i, '');
}

function ensurePdfFileName(value) {
  const safeName = sanitizeFileName(value, 'agreement-copy.pdf');

  if (/\.pdf$/i.test(safeName)) {
    return safeName;
  }

  const baseName = stripFileExtension(safeName) || 'agreement-copy';
  return `${baseName}.pdf`;
}

function isTextualResponse(contentType) {
  const normalized = String(contentType || '').toLowerCase();

  return normalized.startsWith('text/')
    || normalized.includes('json')
    || normalized.includes('xml');
}

function extractAgreementText(payload) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const candidates = [
    payload.content,
    payload.agreement,
    payload.agreementText,
    payload.agreement_text,
    payload.document,
    payload.documentText,
    payload.document_text,
    payload.text,
    payload.body,
    payload.contract?.content,
    payload.contract?.agreement,
    payload.contract?.agreementText,
    payload.contract?.agreement_text,
    payload.contract?.document,
    payload.contract?.text,
    payload.data?.content,
    payload.data?.agreement,
    payload.data?.agreementText,
    payload.data?.agreement_text,
    payload.data?.document,
    payload.data?.text,
  ];

  return candidates.find((value) => typeof value === 'string' && value.trim()) ?? '';
}

function downloadBlob(blob, fileName) {
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    window.URL.revokeObjectURL(objectUrl);
  }, 0);
}

function createPdfFromText(text, fileName) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxWidth = pageWidth - (margin * 2);
  const pageBottom = pageHeight - margin;
  const title = stripFileExtension(fileName) || 'Agreement Copy';
  const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n');
  let cursorY = margin;

  const writeWrappedLines = (wrappedLines, lineHeight) => {
    wrappedLines.forEach((line) => {
      if (cursorY > pageBottom) {
        pdf.addPage();
        cursorY = margin;
      }

      if (line) {
        pdf.text(line, margin, cursorY);
      }

      cursorY += lineHeight;
    });
  };

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  writeWrappedLines(pdf.splitTextToSize(title, maxWidth), 20);
  cursorY += 8;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);

  lines.forEach((line) => {
    const normalizedLine = line.trimEnd();
    const wrappedLines = normalizedLine ? pdf.splitTextToSize(normalizedLine, maxWidth) : [''];
    writeWrappedLines(wrappedLines, 16);

    if (!normalizedLine) {
      cursorY += 6;
    }
  });

  return pdf.output('blob');
}

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

  async downloadFile(fileUrl, fallbackFileName = 'agreement-copy.pdf', options = {}) {
    const normalizedUrl = typeof fileUrl === 'string' ? fileUrl.trim() : '';
    const { renderTextAsPdf = true } = options;

    if (!normalizedUrl) {
      throw new Error('Download URL is unavailable');
    }

    let response;

    try {
      response = await fetch(normalizedUrl, {
        method: 'GET',
        headers: {
          Authorization: authToken ? `Bearer ${authToken}` : undefined,
          Accept: '*/*',
        },
      });
    } catch (err) {
      throw new Error(err.message || 'Download request failed');
    }

    if (!response.ok) {
      const rawText = await response.text();
      let message = `Download failed with status ${response.status}`;

      if (rawText) {
        try {
          const data = JSON.parse(rawText);
          message = data.message || message;
        } catch {
          message = rawText;
        }
      }

      throw new Error(message);
    }

    const contentDisposition = response.headers.get('content-disposition');
    const requestedFileName = sanitizeFileName(parseDownloadFileName(contentDisposition) || fallbackFileName, 'agreement-copy.pdf');
    const responseBlob = await response.blob();
    const contentType = String(response.headers.get('content-type') || responseBlob.type || '').toLowerCase();
    const signature = await responseBlob.slice(0, 5).text();

    if (contentType.includes('application/pdf') || signature.startsWith(PDF_SIGNATURE)) {
      const fileName = ensurePdfFileName(requestedFileName);
      downloadBlob(responseBlob, fileName);
      return { fileName };
    }

    if (!renderTextAsPdf || !isTextualResponse(contentType)) {
      const fileName = sanitizeFileName(parseDownloadFileName(contentDisposition) || fallbackFileName, 'download');
      downloadBlob(responseBlob, fileName);

      return { fileName };
    }

    const rawText = await responseBlob.text();
    let agreementText = rawText;

    if (contentType.includes('application/json')) {
      try {
        const payload = JSON.parse(rawText);
        agreementText = extractAgreementText(payload) || rawText;
      } catch {
        agreementText = rawText;
      }
    }

    const normalizedText = agreementText.replace(/^\uFEFF/, '').trim();

    if (!normalizedText) {
      throw new Error('Downloaded agreement is empty.');
    }

    const fileName = ensurePdfFileName(requestedFileName);
    const pdfBlob = createPdfFromText(normalizedText, fileName);
    downloadBlob(pdfBlob, fileName);

    return {
      fileName,
      generatedFromText: true,
    };
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

  async getMyContracts() {
    return apiRequest('/contracts/me');
  },

  async getAdminContracts() {
    return apiRequest('/admin/contracts');
  },

  async recordContractDecision(contractId, payload) {
    return apiRequest(`/contracts/${encodeURIComponent(contractId)}/decision`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async verifyAdminContract(contractId, payload) {
    return apiRequest(`/admin/contracts/${encodeURIComponent(contractId)}/verify`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async uploadSignedContract(contractId, file) {
    const form = new FormData();
    form.append('signedDocument', file);

    const response = await fetch(`${API_BASE_URL}/contracts/${encodeURIComponent(contractId)}/signed-document`, {
      method: 'POST',
      headers: {
        Authorization: authToken ? `Bearer ${authToken}` : undefined,
        Accept: 'application/json',
      },
      body: form,
    });

    if (response.status === 204) return null;

    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : {};

    if (!response.ok) {
      throw new Error(data.message || 'Upload failed');
    }

    return data;
  },

  async uploadAdminSignedContract(contractId, file) {
    const form = new FormData();
    form.append('signedDocument', file);

    const response = await fetch(`${API_BASE_URL}/admin/contracts/${encodeURIComponent(contractId)}/signed-document`, {
      method: 'POST',
      headers: {
        Authorization: authToken ? `Bearer ${authToken}` : undefined,
        Accept: 'application/json',
      },
      body: form,
    });

    if (response.status === 204) return null;

    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : {};

    if (!response.ok) {
      throw new Error(data.message || 'Upload failed');
    }

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

  async markAdminPurchasePaid(orderId, payload = {}) {
    return apiRequest(`/admin/purchases/${orderId}/mark-paid`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
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
