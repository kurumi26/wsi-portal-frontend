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

function createStyledContractPdf(templateDocument, fileName) {
  if (!templateDocument || typeof templateDocument !== 'object') {
    return createPdfFromText(templateDocument, fileName);
  }

  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxWidth = pageWidth - (margin * 2);
  const pageBottom = pageHeight - margin;
  const title = String(templateDocument.title || stripFileExtension(fileName) || 'Agreement Copy').trim();
  const subtitle = String(templateDocument.subtitle || '').trim();
  const badge = String(templateDocument.badge || '').trim();
  const overview = String(templateDocument.overview || '').trim();
  const note = String(templateDocument.note || '').trim();
  const metadata = Array.isArray(templateDocument.metadata)
    ? templateDocument.metadata.filter((item) => item?.label || item?.value)
    : [];
  const sections = Array.isArray(templateDocument.sections)
    ? templateDocument.sections.filter((section) => section?.title || section?.body)
    : [];
  const documents = Array.isArray(templateDocument.documents)
    ? templateDocument.documents.filter((document) => document?.title || document?.description)
    : [];
  const signatories = Array.isArray(templateDocument.signatories)
    ? templateDocument.signatories.filter((signatory) => signatory?.title)
    : [];
  let cursorY = margin;

  const ensureSpace = (height = 48) => {
    if (cursorY + height <= pageBottom) {
      return;
    }

    pdf.addPage();
    cursorY = margin;
  };

  const wrapText = (text, width, fontSize = 11) => {
    const normalized = String(text || '').trim();

    if (!normalized) {
      return [];
    }

    pdf.setFontSize(fontSize);
    return pdf.splitTextToSize(normalized, width).filter(Boolean);
  };

  const drawWrappedLines = (lines, options = {}) => {
    const {
      x = margin,
      y = cursorY,
      lineHeight = 16,
      fontSize = 11,
      fontStyle = 'normal',
      color = [15, 23, 42],
    } = options;
    let localY = y;

    pdf.setFont('helvetica', fontStyle);
    pdf.setFontSize(fontSize);
    pdf.setTextColor(...color);

    lines.forEach((line) => {
      pdf.text(line, x, localY);
      localY += lineHeight;
    });

    return localY - y;
  };

  const drawSectionLabel = (label) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(71, 85, 105);
    pdf.text(label.toUpperCase(), margin, cursorY);
    cursorY += 18;
  };

  const titleLines = wrapText(title, maxWidth - 40, 22);
  const subtitleLines = subtitle ? wrapText(subtitle, maxWidth - 40, 11) : [];
  const headerHeight = Math.max(110, 24 + (badge ? 26 : 0) + (titleLines.length * 24) + (subtitleLines.length * 14) + 18);
  ensureSpace(headerHeight);

  pdf.setFillColor(15, 23, 42);
  pdf.roundedRect(margin, cursorY, maxWidth, headerHeight, 24, 24, 'F');

  let headerY = cursorY + 24;

  if (badge) {
    const badgeWidth = Math.min(200, Math.max(120, (badge.length * 5.6) + 24));

    pdf.setFillColor(14, 165, 233);
    pdf.roundedRect(margin + 18, headerY - 4, badgeWidth, 22, 11, 11, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(255, 255, 255);
    pdf.text(badge.toUpperCase(), margin + 30, headerY + 10);
    headerY += 30;
  }

  drawWrappedLines(titleLines, {
    x: margin + 20,
    y: headerY,
    lineHeight: 24,
    fontSize: 22,
    fontStyle: 'bold',
    color: [255, 255, 255],
  });
  headerY += titleLines.length * 24;

  if (subtitleLines.length) {
    headerY += 4;
    drawWrappedLines(subtitleLines, {
      x: margin + 20,
      y: headerY,
      lineHeight: 14,
      fontSize: 11,
      color: [191, 219, 254],
    });
  }

  cursorY += headerHeight + 22;

  if (metadata.length) {
    const columnCount = 2;
    const gutter = 16;
    const innerPadding = 16;
    const rowHeight = 52;
    const rows = Math.ceil(metadata.length / columnCount);
    const cardHeight = 20 + (rows * rowHeight) + 12;
    const columnWidth = (maxWidth - (innerPadding * 2) - gutter) / columnCount;

    ensureSpace(cardHeight);
    pdf.setDrawColor(226, 232, 240);
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(margin, cursorY, maxWidth, cardHeight, 18, 18, 'FD');

    metadata.forEach((item, index) => {
      const row = Math.floor(index / columnCount);
      const column = index % columnCount;
      const itemX = margin + innerPadding + (column * (columnWidth + gutter));
      const itemY = cursorY + 24 + (row * rowHeight);
      const valueLines = wrapText(item.value, columnWidth, 11).slice(0, 2);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(String(item.label || '').toUpperCase(), itemX, itemY);
      drawWrappedLines(valueLines, {
        x: itemX,
        y: itemY + 16,
        lineHeight: 14,
        fontSize: 11,
        fontStyle: 'bold',
        color: [15, 23, 42],
      });
    });

    cursorY += cardHeight + 22;
  }

  if (overview) {
    const overviewLines = wrapText(overview, maxWidth, 11);
    ensureSpace(28 + (overviewLines.length * 16));
    drawSectionLabel('Agreement Summary');
    cursorY += drawWrappedLines(overviewLines, {
      y: cursorY,
      lineHeight: 16,
      fontSize: 11,
      color: [51, 65, 85],
    });
    cursorY += 16;
  }

  sections.forEach((section, index) => {
    const heading = `${index + 1}. ${String(section.title || '').trim()}`;
    const bodyLines = wrapText(section.body, maxWidth, 11);
    const blockHeight = 20 + (bodyLines.length * 16) + 12;

    ensureSpace(blockHeight);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(15, 23, 42);
    pdf.text(heading, margin, cursorY);
    cursorY += 20;
    cursorY += drawWrappedLines(bodyLines, {
      y: cursorY,
      lineHeight: 16,
      fontSize: 11,
      color: [51, 65, 85],
    });
    cursorY += 12;
  });

  if (documents.length) {
    drawSectionLabel('Included Documents');

    documents.forEach((document, index) => {
      const itemTitle = `${index + 1}. ${String(document.title || '').trim()}`;
      const itemDescription = String(document.description || '').trim();
      const titleLines = wrapText(itemTitle, maxWidth, 11);
      const descriptionLines = itemDescription ? wrapText(itemDescription, maxWidth - 18, 10) : [];
      const itemHeight = (titleLines.length * 14) + (descriptionLines.length * 13) + 12;

      ensureSpace(itemHeight);
      cursorY += drawWrappedLines(titleLines, {
        y: cursorY,
        lineHeight: 14,
        fontSize: 11,
        fontStyle: 'bold',
        color: [15, 23, 42],
      });

      if (descriptionLines.length) {
        cursorY += drawWrappedLines(descriptionLines, {
          x: margin + 14,
          y: cursorY + 2,
          lineHeight: 13,
          fontSize: 10,
          color: [71, 85, 105],
        });
      }

      cursorY += 10;
    });
  }

  if (signatories.length) {
    drawSectionLabel('Signature Blocks');

    signatories.forEach((signatory) => {
      const fields = Array.isArray(signatory.fields) && signatory.fields.length
        ? signatory.fields
        : ['Printed Name', 'Signature', 'Date'];
      const helperLines = signatory.helper ? wrapText(signatory.helper, maxWidth - 36, 10) : [];
      const cardHeight = 72 + (helperLines.length * 12) + (fields.length * 22);
      const cardX = margin;
      const cardWidth = maxWidth;
      const lineStartX = cardX + 18;
      const lineEndX = cardX + cardWidth - 18;

      ensureSpace(cardHeight);
      pdf.setDrawColor(226, 232, 240);
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(cardX, cursorY, cardWidth, cardHeight, 18, 18, 'FD');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(15, 23, 42);
      pdf.text(signatory.title, lineStartX, cursorY + 24);

      let helperStartY = cursorY + 40;

      if (helperLines.length) {
        drawWrappedLines(helperLines, {
          x: lineStartX,
          y: helperStartY,
          lineHeight: 12,
          fontSize: 10,
          color: [71, 85, 105],
        });
        helperStartY += helperLines.length * 12;
      }

      fields.forEach((label, index) => {
        const labelY = helperStartY + 16 + (index * 22);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(100, 116, 139);
        pdf.text(label, lineStartX, labelY);
        pdf.setDrawColor(148, 163, 184);
        pdf.line(lineStartX, labelY + 10, lineEndX, labelY + 10);
      });

      cursorY += cardHeight + 14;
    });
  }

  if (note) {
    const noteLines = wrapText(note, maxWidth - 32, 10);
    const noteHeight = 28 + (noteLines.length * 14) + 10;

    ensureSpace(noteHeight);
    pdf.setDrawColor(186, 230, 253);
    pdf.setFillColor(240, 249, 255);
    pdf.roundedRect(margin, cursorY, maxWidth, noteHeight, 18, 18, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(12, 74, 110);
    pdf.text('Additional Notes', margin + 16, cursorY + 20);
    drawWrappedLines(noteLines, {
      x: margin + 16,
      y: cursorY + 36,
      lineHeight: 14,
      fontSize: 10,
      color: [12, 74, 110],
    });
    cursorY += noteHeight;
  }

  const pageCount = pdf.getNumberOfPages();

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    pdf.setPage(pageNumber);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Generated by WSI Portal`, margin, pageHeight - 20);
    pdf.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - margin, pageHeight - 20, { align: 'right' });
  }

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

  downloadTextAsPdf(text, fallbackFileName = 'agreement-copy.pdf') {
    const normalizedText = String(text ?? '').replace(/^\uFEFF/, '').trim();

    if (!normalizedText) {
      throw new Error('Agreement template is empty.');
    }

    const fileName = ensurePdfFileName(fallbackFileName);
    const pdfBlob = createPdfFromText(normalizedText, fileName);
    downloadBlob(pdfBlob, fileName);

    return {
      fileName,
      generatedFromText: true,
    };
  },

  downloadContractPdf(templateDocument, fallbackFileName = 'agreement-copy.pdf') {
    const fileName = ensurePdfFileName(fallbackFileName);
    const pdfBlob = createStyledContractPdf(templateDocument, fileName);
    downloadBlob(pdfBlob, fileName);

    return {
      fileName,
      generatedFromTemplate: true,
    };
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
