const getFirstString = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }

    const normalized = String(value).trim();

    if (normalized) {
      return normalized;
    }
  }

  return '';
};

const normalizeToken = (value) => getFirstString(value)
  .toLowerCase()
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ');

const statusIncludes = (value, tokens) => {
  const normalized = normalizeToken(value);
  return tokens.some((token) => normalized === token || normalized.includes(token));
};

const getExplicitInvoiceStatus = (record) => getFirstString(
  record?.invoiceStatus,
  record?.invoice_status,
  record?.invoice?.status,
  record?.invoice?.status_key,
  record?.billingStatus,
  record?.billing_status,
  record?.invoiceState,
  record?.invoice_state,
);

const getExplicitPaymentStatus = (record) => getFirstString(
  record?.paymentStatus,
  record?.payment_status,
  record?.payment?.status,
  record?.payment?.state,
);

const getInvoicePaidAtValue = (record) => getFirstString(
  record?.paidAt,
  record?.paid_at,
  record?.invoicePaidAt,
  record?.invoice_paid_at,
  record?.invoice?.paidAt,
  record?.invoice?.paid_at,
);

const hasSubmittedPayment = (record) => {
  const payments = Array.isArray(record?.payments) ? record.payments : [];

  if (payments.some((payment) => statusIncludes(
    payment?.status ?? payment?.state,
    ['pending', 'review', 'verification', 'success', 'completed', 'submitted', 'processing', 'uploaded'],
  ))) {
    return true;
  }

  return statusIncludes(
    getExplicitPaymentStatus(record),
    ['pending', 'review', 'verification', 'success', 'completed', 'submitted', 'processing', 'uploaded'],
  );
};

export const getInvoiceNumber = (record) => getFirstString(
  record?.invoiceNumber,
  record?.invoice_number,
  record?.serviceInvoiceNumber,
  record?.service_invoice_number,
  record?.invoice?.number,
  record?.invoice?.invoice_number,
  record?.invoice?.reference,
  record?.soaNumber,
  record?.soa_number,
  record?.receiptNumber,
  record?.receipt_number,
);

export const hasInvoiceRecord = (record) => Boolean(getInvoiceNumber(record));

export const getInvoiceDueDateValue = (record) => (
  record?.dueDate
  ?? record?.due_date
  ?? record?.invoiceDueDate
  ?? record?.invoice_due_date
  ?? record?.invoice?.dueDate
  ?? record?.invoice?.due_date
  ?? null
);

export const getInvoiceStatusKey = (record) => {
  const rawStatus = getExplicitInvoiceStatus(record);

  if (getInvoicePaidAtValue(record)) {
    return 'paid';
  }

  // A customer-submitted payment still requires an explicit admin-paid confirmation.
  if (hasSubmittedPayment(record)) {
    return 'pending_review';
  }

  if (statusIncludes(rawStatus, ['paid', 'settled', 'cleared'])) {
    return 'paid';
  }

  if (statusIncludes(rawStatus, ['pending review', 'pending approval', 'awaiting review', 'under review', 'pending verification'])) {
    return 'pending_review';
  }

  if (statusIncludes(rawStatus, ['overdue', 'late', 'past due'])) {
    return 'overdue';
  }

  if (statusIncludes(rawStatus, ['unpaid', 'open', 'due'])) {
    return 'unpaid';
  }

  if (statusIncludes(rawStatus, ['cancelled', 'canceled', 'void', 'rejected'])) {
    return 'cancelled';
  }

  if (hasInvoiceRecord(record)) {
    if (!rawStatus) {
      const dueDateValue = getInvoiceDueDateValue(record);
      const dueDateTime = dueDateValue ? new Date(dueDateValue).getTime() : Number.NaN;

      if (!Number.isNaN(dueDateTime) && dueDateTime < Date.now()) {
        return 'overdue';
      }

      return 'unpaid';
    }

    return 'unknown';
  }

  return 'missing';
};

export const getInvoiceStatusLabel = (record) => {
  switch (getInvoiceStatusKey(record)) {
    case 'paid':
      return 'Paid';
    case 'pending_review':
      return 'Pending Review';
    case 'unpaid':
      return 'Unpaid';
    case 'overdue':
      return 'Overdue';
    case 'cancelled':
      return 'Cancelled';
    case 'unknown':
      return 'Unavailable';
    default:
      return 'Pending Sync';
  }
};

export const isInvoicePaid = (record) => getInvoiceStatusKey(record) === 'paid';

export const canApproveOrderProvisioning = (record) => isInvoicePaid(record);

export const getInvoiceApprovalBlockReason = (record) => {
  switch (getInvoiceStatusKey(record)) {
    case 'paid':
      return '';
    case 'pending_review':
      return 'Submitted payment is awaiting admin review.';
    case 'unpaid':
      return 'Linked invoice is not yet marked paid.';
    case 'overdue':
      return 'Linked invoice is overdue and still unpaid.';
    case 'cancelled':
      return 'Linked invoice was cancelled or rejected.';
    case 'unknown':
      return 'Linked invoice status is unavailable from the current API payload.';
    default:
      return 'Linked invoice is not yet available from the billing API.';
  }
};

export const getInvoiceStatusHelperText = (record) => {
  switch (getInvoiceStatusKey(record)) {
    case 'paid':
      return 'An admin confirmed this invoice as paid.';
    case 'pending_review':
      return 'Customer payment was submitted and is awaiting admin review.';
    case 'unpaid':
      return 'Waiting for an admin to mark the linked invoice as paid.';
    case 'overdue':
      return 'The linked invoice is overdue and must be settled before provisioning.';
    case 'cancelled':
      return 'The linked invoice was cancelled or rejected.';
    case 'unknown':
      return 'Invoice status is unavailable from the current API payload.';
    default:
      return 'Invoice data is still pending backend sync.';
  }
};

export const getInvoiceDocumentUrl = (record, backendOrigin = '') => {
  const rawValue = getFirstString(
    record?.invoiceUrl,
    record?.invoice_url,
    record?.invoiceFileUrl,
    record?.invoice_file_url,
    record?.invoicePath,
    record?.invoice_path,
    record?.invoice?.url,
    record?.invoice?.file_url,
    record?.invoice?.path,
    record?.invoice?.file,
  );

  if (!rawValue) {
    return null;
  }

  if (/^https?:\/\//i.test(rawValue)) {
    return rawValue;
  }

  if (!backendOrigin) {
    return rawValue;
  }

  const normalized = rawValue.replace(/^\/+/, '');

  if (normalized.startsWith('storage/')) {
    return `${backendOrigin.replace(/\/$/, '')}/${normalized}`;
  }

  return `${backendOrigin.replace(/\/$/, '')}/storage/${normalized}`;
};
