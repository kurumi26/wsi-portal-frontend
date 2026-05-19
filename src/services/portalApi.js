import { jsPDF } from 'jspdf';

const API_BASE_URL = import.meta.env.VITE_API_URL;
const TOKEN_STORAGE_KEY = 'wsi-auth-token';
const CONTENT_DISPOSITION_FILENAME_STAR_PATTERN = /filename\*=(?:UTF-8'')?([^;]+)/i;
const CONTENT_DISPOSITION_FILENAME_PATTERN = /filename="?([^";]+)"?/i;
const PDF_SIGNATURE = '%PDF-';
const LOGO_WATERMARK_PATH = '/logo-light.png';

let authToken = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
let logoAssetPromise = null;

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

function loadImageAsset(src) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window is unavailable.'));
      return;
    }

    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load image: ${src}`));
    image.src = src;
  });
}

function createImageDataUrl(image, opacity = 1) {
  if (typeof document === 'undefined') {
    return null;
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    return null;
  }

  canvas.width = image.naturalWidth || image.width || 1;
  canvas.height = image.naturalHeight || image.height || 1;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.globalAlpha = opacity;
  context.drawImage(image, 0, 0);

  return canvas.toDataURL('image/png');
}

async function loadLogoAsset() {
  if (logoAssetPromise) {
    return logoAssetPromise;
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  logoAssetPromise = (async () => {
    try {
      const image = await loadImageAsset(LOGO_WATERMARK_PATH);
      const dataUrl = createImageDataUrl(image, 1);
      const watermarkDataUrl = createImageDataUrl(image, 0.08);

      if (!dataUrl) {
        return null;
      }

      return {
        dataUrl,
        watermarkDataUrl: watermarkDataUrl || dataUrl,
        width: image.naturalWidth || image.width || 1,
        height: image.naturalHeight || image.height || 1,
      };
    } catch {
      return null;
    }
  })();

  return logoAssetPromise;
}

async function createStyledContractPdf(templateDocument, fileName) {
  if (!templateDocument || typeof templateDocument !== 'object') {
    return createPdfFromText(templateDocument, fileName);
  }

  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });

  // ── Layout constants ──────────────────────────────────────────
  const margin = 52;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const headerBarH = 22;
  const contentTop = 90;
  const pageBottom = pageHeight - 50;

  // ── Template fields ───────────────────────────────────────────
  const title = String(templateDocument.title || stripFileExtension(fileName) || 'Agreement Copy').trim();
  const subtitle = String(templateDocument.subtitle || '').trim();
  const badge = String(templateDocument.badge || '').trim();
  const overview = String(templateDocument.overview || '').trim();
  const note = String(templateDocument.note || '').trim();
  const signatureStatement = String(templateDocument.signatureStatement || '').trim();
  const metadata = Array.isArray(templateDocument.metadata)
    ? templateDocument.metadata.filter((item) => item?.label || item?.value)
    : [];
  const sections = Array.isArray(templateDocument.sections)
    ? templateDocument.sections.filter((s) => s?.title || s?.body)
    : [];
  const documents = Array.isArray(templateDocument.documents)
    ? templateDocument.documents.filter((d) => d?.title || d?.description)
    : [];
  const signatories = Array.isArray(templateDocument.signatories)
    ? templateDocument.signatories.filter((s) => s?.title)
    : [];

  const logoAsset = await loadLogoAsset();
  let cursorY = contentTop;

  // ── Primitive helpers ─────────────────────────────────────────
  const addImageSafe = (dataUrl, x, y, w, h) => {
    if (!dataUrl) {
      return;
    }

    try {
      pdf.addImage(dataUrl, 'PNG', x, y, w, h);
    } catch {
      // Branding image failures must not stop contract generation.
    }
  };

  const txt = (text, x, y, opts = {}) => {
    const {
      size = 10,
      family = 'helvetica',
      style = 'normal',
      color = [30, 41, 59],
      align,
    } = opts;
    pdf.setFont(family, style);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    pdf.text(String(text ?? ''), x, y, align ? { align } : undefined);
  };

  const wrap = (text, width, opts = {}) => {
    const { size = 10, family = 'helvetica', style = 'normal' } = opts;
    const normalized = String(text || '').trim();

    if (!normalized) {
      return [];
    }

    pdf.setFont(family, style);
    pdf.setFontSize(size);
    return pdf.splitTextToSize(normalized, width).filter(Boolean);
  };

  const drawLines = (lines, x, startY, lh, opts = {}) => {
    const { size = 10, family = 'helvetica', style = 'normal', color = [30, 41, 59] } = opts;
    pdf.setFont(family, style);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    lines.forEach((line, i) => pdf.text(line, x, startY + i * lh));

    return lines.length * lh;
  };

  const ensureSpace = (height) => {
    if (cursorY + height <= pageBottom) {
      return;
    }

    pdf.addPage();
    cursorY = contentTop;
    drawPageHeader();
  };

  // ── Page header (called once per page) ───────────────────────
  const drawPageHeader = () => {
    // Navy top bar
    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 0, pageWidth, headerBarH, 'F');

    // Logo on left of top bar
    if (logoAsset?.dataUrl) {
      const lw = 88;
      const lh = lw * (logoAsset.height / logoAsset.width);
      addImageSafe(logoAsset.dataUrl, margin, headerBarH + 6, lw, lh);
    }

    // Right-side label
    txt('WSI PORTAL — SERVICE AGREEMENT', pageWidth - margin, headerBarH + 14, {
      size: 7.5,
      style: 'bold',
      color: [100, 116, 139],
      align: 'right',
    });
    txt(stripFileExtension(fileName), pageWidth - margin, headerBarH + 26, {
      size: 7.5,
      color: [148, 163, 184],
      align: 'right',
    });

    // Separator
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.5);
    pdf.line(margin, contentTop - 8, pageWidth - margin, contentTop - 8);

    // Full-page faint watermark
    if (logoAsset?.watermarkDataUrl) {
      const ww = Math.min(contentWidth * 0.52, 260);
      const wh = ww * (logoAsset.height / logoAsset.width);
      addImageSafe(logoAsset.watermarkDataUrl, (pageWidth - ww) / 2, (pageHeight - wh) / 2 - 20, ww, wh);
    }
  };

  drawPageHeader();

  // ── COVER TITLE CARD ─────────────────────────────────────────
  const titleLines = wrap(title, contentWidth - 32, { size: 22, family: 'times', style: 'bold' });
  const subtitleLines = subtitle ? wrap(subtitle, contentWidth - 32, { size: 9.5 }) : [];
  const coverH = Math.max(108, 20 + (badge ? 22 : 0) + titleLines.length * 28 + (subtitleLines.length ? 10 + subtitleLines.length * 13 : 0) + 22);

  ensureSpace(coverH);

  // Dark navy card
  pdf.setFillColor(15, 23, 42);
  pdf.roundedRect(margin, cursorY, contentWidth, coverH, 12, 12, 'F');

  // Orange left accent strip
  pdf.setFillColor(249, 115, 22);
  pdf.roundedRect(margin, cursorY, 5, coverH, 4, 4, 'F');
  pdf.rect(margin + 2, cursorY, 3, coverH, 'F');

  let cy = cursorY + 20;

  if (badge) {
    const bw = Math.min(260, Math.max(160, badge.length * 6 + 26));
    pdf.setFillColor(249, 115, 22);
    pdf.roundedRect(margin + 16, cy - 4, bw, 16, 8, 8, 'F');
    txt(badge.toUpperCase(), margin + 26, cy + 7, { size: 7, style: 'bold', color: [255, 255, 255] });
    cy += 23;
  }

  drawLines(titleLines, margin + 16, cy, 28, {
    size: 22,
    family: 'times',
    style: 'bold',
    color: [255, 255, 255],
  });
  cy += titleLines.length * 28;

  if (subtitleLines.length) {
    cy += 8;
    drawLines(subtitleLines, margin + 16, cy, 13, { size: 9.5, color: [148, 163, 184] });
  }

  cursorY += coverH + 22;

  // ── METADATA GRID ─────────────────────────────────────────────
  if (metadata.length) {
    const cols = 2;
    const colGap = 16;
    const pad = 18;
    const colW = (contentWidth - pad * 2 - colGap) / cols;
    const rowH = 40;
    const rows = Math.ceil(metadata.length / cols);
    const tableH = pad + rows * rowH + pad * 0.6;

    ensureSpace(tableH);
    pdf.setDrawColor(226, 232, 240);
    pdf.setFillColor(249, 250, 251);
    pdf.roundedRect(margin, cursorY, contentWidth, tableH, 10, 10, 'FD');

    // Column divider line
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.5);
    pdf.line(margin + pad + colW + colGap / 2, cursorY + 10, margin + pad + colW + colGap / 2, cursorY + tableH - 10);

    metadata.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const ix = margin + pad + col * (colW + colGap);
      const iy = cursorY + pad + row * rowH;

      txt(String(item.label || '').toUpperCase(), ix, iy, {
        size: 7,
        style: 'bold',
        color: [148, 163, 184],
      });

      const valLines = wrap(String(item.value || '—'), colW, { size: 10, style: 'bold' }).slice(0, 2);
      drawLines(valLines, ix, iy + 12, 13, { size: 10, style: 'bold', color: [15, 23, 42] });
    });

    cursorY += tableH + 20;
  }

  // ── STATEMENT OF AGREEMENT (overview) ────────────────────────
  if (overview) {
    const ovLines = wrap(overview, contentWidth - 42, { size: 10.5 });
    const ovH = 14 + ovLines.length * 15 + 14;

    ensureSpace(ovH);

    // Warm amber-tinted background
    pdf.setFillColor(255, 247, 237);
    pdf.roundedRect(margin, cursorY, contentWidth, ovH, 8, 8, 'F');

    // Orange left bar
    pdf.setFillColor(249, 115, 22);
    pdf.roundedRect(margin, cursorY, 4, ovH, 4, 4, 'F');
    pdf.rect(margin + 2, cursorY, 2, ovH, 'F');

    txt('STATEMENT OF AGREEMENT', margin + 14, cursorY + 12, {
      size: 7,
      style: 'bold',
      color: [194, 65, 12],
    });

    drawLines(ovLines, margin + 14, cursorY + 26, 15, { size: 10.5, color: [67, 56, 46] });

    cursorY += ovH + 20;
  }

  // ── Section divider helper ────────────────────────────────────
  const drawSectionDivider = (label) => {
    ensureSpace(28);
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(margin, cursorY, contentWidth, 22, 6, 6, 'FD');
    pdf.setFillColor(249, 115, 22);
    pdf.roundedRect(margin, cursorY, 4, 22, 3, 3, 'F');
    pdf.rect(margin + 2, cursorY, 2, 22, 'F');
    txt(label.toUpperCase(), margin + 14, cursorY + 14.5, {
      size: 8,
      style: 'bold',
      color: [71, 85, 105],
    });
    cursorY += 28;
  };

  // ── CORE TERMS ────────────────────────────────────────────────
  drawSectionDivider('Core Terms');

  sections.forEach((section, index) => {
    const heading = `${index + 1}.  ${String(section.title || '').trim()}`;
    const bodyLines = wrap(section.body, contentWidth - 18, { size: 10.5 });
    const blockH = 20 + bodyLines.length * 15 + 12;

    ensureSpace(blockH);
    txt(heading, margin, cursorY, { size: 11, family: 'times', style: 'bold', color: [15, 23, 42] });
    cursorY += 17;
    cursorY += drawLines(bodyLines, margin + 16, cursorY, 15, { size: 10.5, color: [51, 65, 85] });
    cursorY += 12;
  });

  // ── SCHEDULES ─────────────────────────────────────────────────
  if (documents.length) {
    drawSectionDivider('Schedules and Incorporated Documents');

    documents.forEach((doc, index) => {
      const docTitle = `${index + 1}.  ${String(doc.title || '').trim()}`;
      const descLines = doc.description ? wrap(doc.description, contentWidth - 26, { size: 9.5 }) : [];
      const itemH = 17 + descLines.length * 13 + 8;

      ensureSpace(itemH);
      txt(docTitle, margin, cursorY, { size: 10.5, style: 'bold', color: [15, 23, 42] });
      cursorY += 15;

      if (descLines.length) {
        cursorY += drawLines(descLines, margin + 16, cursorY, 13, { size: 9.5, color: [100, 116, 139] });
      }

      cursorY += 8;
    });
  }

  // ── SIGNATURE BLOCKS ─────────────────────────────────────────
  if (signatories.length) {
    drawSectionDivider('Execution and Signatures');

    if (signatureStatement) {
      const stLines = wrap(signatureStatement, contentWidth, { size: 10.5, family: 'times', style: 'italic' });
      ensureSpace(stLines.length * 15 + 16);
      cursorY += drawLines(stLines, margin, cursorY, 15, {
        size: 10.5,
        family: 'times',
        style: 'italic',
        color: [71, 85, 105],
      });
      cursorY += 16;
    }

    const sigCols = 2;
    const sigGap = 16;
    const sigCardW = (contentWidth - sigGap) / sigCols;

    for (let si = 0; si < signatories.length; si += sigCols) {
      const rowSigs = signatories.slice(si, si + sigCols).map((sig) => {
        const fields = Array.isArray(sig.fields) && sig.fields.length
          ? sig.fields
          : ['Printed Name', 'Signature', 'Date'];
        const helperLines = sig.helper ? wrap(sig.helper, sigCardW - 36, { size: 9 }) : [];
        const prefilledFields = (sig.prefilledFields && typeof sig.prefilledFields === 'object') ? sig.prefilledFields : {};
        // Signature image fields need extra height; all other fields use standard 28pt
        const fieldH = (label) => {
          const val = prefilledFields[label];
          return (typeof val === 'string' && val.startsWith('data:image')) ? 52 : 28;
        };
        const cardH = 28 + 8 + (helperLines.length ? helperLines.length * 12 + 6 : 0) + fields.reduce((sum, f) => sum + fieldH(f), 0) + 14;

        return { ...sig, fields, helperLines, prefilledFields, cardH };
      });

      const rowH = Math.max(...rowSigs.map((s) => s.cardH));
      ensureSpace(rowH + 8);

      rowSigs.forEach((sig, ci) => {
        const cx = margin + ci * (sigCardW + sigGap);
        const innerX = cx + 18;
        const lineEnd = cx + sigCardW - 18;

        // Card background
        pdf.setDrawColor(203, 213, 225);
        pdf.setFillColor(252, 253, 254);
        pdf.roundedRect(cx, cursorY, sigCardW, rowH, 10, 10, 'FD');

        // Dark title bar
        pdf.setFillColor(30, 41, 59);
        pdf.roundedRect(cx, cursorY, sigCardW, 28, 10, 10, 'F');
        // Square off bottom corners of title bar
        pdf.rect(cx, cursorY + 18, sigCardW, 10, 'F');

        txt(sig.title, innerX, cursorY + 18, {
          size: 9.5,
          family: 'times',
          style: 'bold',
          color: [255, 255, 255],
        });

        // E-signed badge on the title bar
        if (sig.eSignedAt) {
          const eBadgeW = 72;
          const eBadgeX = cx + sigCardW - 18 - eBadgeW;
          pdf.setFillColor(16, 185, 129);
          pdf.roundedRect(eBadgeX, cursorY + 7, eBadgeW, 14, 7, 7, 'F');
          txt('✓ E-SIGNED', cx + sigCardW - 21, cursorY + 16, {
            size: 6.5,
            style: 'bold',
            color: [255, 255, 255],
            align: 'right',
          });
        }

        let fy = cursorY + 38;

        if (sig.helperLines.length) {
          fy += drawLines(sig.helperLines, innerX, fy, 12, { size: 9, color: [100, 116, 139] });
          fy += 6;
        }

        fy += 4;

        sig.fields.forEach((label) => {
          const prefilled = sig.prefilledFields[String(label)];
          const isSignatureImg = typeof prefilled === 'string' && prefilled.startsWith('data:image');

          // Label
          txt(String(label).toUpperCase(), innerX, fy, { size: 7.5, color: [148, 163, 184] });
          fy += 10;

          if (isSignatureImg) {
            // Draw the signature image in the field area
            const imgW = lineEnd - innerX;
            const imgH = 38;
            addImageSafe(prefilled, innerX, fy - 2, imgW, imgH);
            pdf.setDrawColor(203, 213, 225);
            pdf.setLineWidth(0.5);
            pdf.line(innerX, fy + imgH, lineEnd, fy + imgH);
            fy += imgH + 6;
          } else if (prefilled) {
            // Pre-filled text value
            txt(String(prefilled), innerX, fy + 1, { size: 9.5, style: 'bold', color: [15, 23, 42] });
            pdf.setDrawColor(203, 213, 225);
            pdf.setLineWidth(0.5);
            pdf.line(innerX, fy + 4, lineEnd, fy + 4);
            fy += 18;
          } else {
            // Blank writing line
            pdf.setDrawColor(148, 163, 184);
            pdf.setLineWidth(0.75);
            pdf.line(innerX, fy, lineEnd, fy);
            fy += 18;
          }
        });
      });

      cursorY += rowH + 16;
    }
  }

  // ── ADDITIONAL NOTES ─────────────────────────────────────────
  if (note) {
    const noteLines = wrap(note, contentWidth - 32, { size: 9.5 });
    const noteH = 14 + noteLines.length * 13 + 12;

    ensureSpace(noteH);
    pdf.setDrawColor(186, 230, 253);
    pdf.setFillColor(240, 249, 255);
    pdf.roundedRect(margin, cursorY, contentWidth, noteH, 8, 8, 'FD');
    txt('ADDITIONAL NOTES', margin + 14, cursorY + 11, { size: 7, style: 'bold', color: [3, 105, 161] });
    drawLines(noteLines, margin + 14, cursorY + 23, 13, { size: 9.5, color: [12, 74, 110] });
    cursorY += noteH;
  }

  // ── PAGE FOOTER ───────────────────────────────────────────────
  const pageCount = pdf.getNumberOfPages();

  for (let p = 1; p <= pageCount; p += 1) {
    pdf.setPage(p);
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.5);
    pdf.line(margin, pageHeight - 32, pageWidth - margin, pageHeight - 32);
    txt('WSI Portal — Confidential Agreement Document', margin, pageHeight - 18, {
      size: 7.5,
      color: [148, 163, 184],
    });
    txt(`Page ${p} of ${pageCount}`, pageWidth - margin, pageHeight - 18, {
      size: 7.5,
      color: [148, 163, 184],
      align: 'right',
    });
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

const buildESignedContractDocument = (templateDocument, signerData, options = {}) => {
  if (!templateDocument || !signerData) {
    throw new Error('Template document and signer data are required.');
  }

  const { signatoryIndex = 0 } = options;
  const signedDateFormatted = new Date(signerData.signedAt || Date.now()).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const signatories = Array.isArray(templateDocument.signatories)
    ? templateDocument.signatories.map((sig, index) => {
        if (index !== signatoryIndex) {
          return sig;
        }

        const prefilledFields = sig?.prefilledFields && typeof sig.prefilledFields === 'object'
          ? { ...sig.prefilledFields }
          : {};

        (Array.isArray(sig.fields) ? sig.fields : []).forEach((label) => {
          const normalized = String(label).toLowerCase();

          if (normalized.includes('company') || normalized.includes('organization')) {
            if (signerData.signerCompany) {
              prefilledFields[label] = signerData.signerCompany;
            }
          } else if (normalized.includes('printed') || normalized.includes('name')) {
            if (signerData.signerName) {
              prefilledFields[label] = signerData.signerName;
            }
          } else if (normalized.includes('title') || normalized.includes('role')) {
            if (signerData.signerTitle) {
              prefilledFields[label] = signerData.signerTitle;
            }
          } else if (normalized.includes('signature')) {
            if (signerData.signatureDataUrl) {
              prefilledFields[label] = signerData.signatureDataUrl;
            }
          } else if (normalized.includes('date')) {
            prefilledFields[label] = signedDateFormatted;
          }
        });

        return { ...sig, prefilledFields, eSignedAt: signerData.signedAt };
      })
    : templateDocument.signatories;

  return {
    ...templateDocument,
    badge: 'Electronically Signed — Official Copy',
    signatories,
  };
};

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

  async downloadContractPdf(templateDocument, fallbackFileName = 'agreement-copy.pdf') {
    const fileName = ensurePdfFileName(fallbackFileName);
    const pdfBlob = await createStyledContractPdf(templateDocument, fileName);
    downloadBlob(pdfBlob, fileName);

    return {
      fileName,
      generatedFromTemplate: true,
    };
  },

  buildESignedContractDocument(templateDocument, signerData, options = {}) {
    return buildESignedContractDocument(templateDocument, signerData, options);
  },

  async generateESignedContractBlob(templateDocument, signerData, options = {}) {
    const signedDocument = buildESignedContractDocument(templateDocument, signerData, options);

    const fileName = ensurePdfFileName('signed-agreement.pdf');
    return createStyledContractPdf(signedDocument, fileName);
  },

  async downloadESignedContractPdf(templateDocument, signerData, fallbackFileName = 'signed-agreement.pdf', options = {}) {
    const blob = await portalApi.generateESignedContractBlob(templateDocument, signerData, options);
    const fileName = ensurePdfFileName(fallbackFileName);
    downloadBlob(blob, fileName);

    return { fileName, eSigned: true };
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
