import {
  collectPurchaseLineItems,
  getPurchaseClientEmail,
  getPurchaseClientName,
  getPurchaseDateValue,
  getPurchaseDisplayId,
} from './adminDeals';
import { getServiceDisplayStatus } from './services';

export const REPORT_TEMPLATE_STORAGE_KEY = 'wsi-admin-report-templates-v1';
export const CUSTOMER_REPORT_TEMPLATE_STORAGE_KEY = 'wsi-customer-report-templates-v1';
export const REPORT_FOCUS_OPTIONS = [
  { value: 'all', label: 'All Reports' },
  { value: 'sales', label: 'Sales Reports' },
  { value: 'services', label: 'Service Lifecycle' },
  { value: 'receivables', label: 'Receivables & Payments' },
  { value: 'tax', label: 'Tax & Accounting' },
];
export const REPORT_VISIBILITY_OPTIONS = [
  { value: 'own', label: 'Own' },
  { value: 'public', label: 'Public' },
];
export const DEFAULT_REPORT_FILTERS = {
  reportFocus: 'all',
  searchTerm: '',
  startDate: '',
  endDate: '',
  minAmount: '',
  maxAmount: '',
  productType: 'All Products',
  dealType: 'All Deals',
};
export const REPORT_FOCUS_VALUES = REPORT_FOCUS_OPTIONS.map((option) => option.value);
export const DETAILED_REPORT_FOCUS_OPTIONS = REPORT_FOCUS_OPTIONS.filter((option) => option.value !== DEFAULT_REPORT_FILTERS.reportFocus);

export const normalizeReportFocus = (value) => {
  const normalizedValue = String(value ?? '').trim().toLowerCase();

  return REPORT_FOCUS_VALUES.includes(normalizedValue)
    ? normalizedValue
    : DEFAULT_REPORT_FILTERS.reportFocus;
};

export const buildReportFocusPath = (value, basePath = '/admin/reports') => {
  const normalizedValue = normalizeReportFocus(value);

  return normalizedValue === DEFAULT_REPORT_FILTERS.reportFocus
    ? basePath
    : `${basePath}/${normalizedValue}`;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const PAID_STATUS_TOKENS = ['paid', 'approved', 'completed', 'success', 'active'];
const PENDING_STATUS_TOKENS = ['pending', 'pending review', 'processing', 'awaiting'];
const CANCELLED_STATUS_TOKENS = ['cancelled', 'canceled', 'rejected', 'declined', 'failed', 'expired'];

const normalizeText = (value) => String(value ?? '').trim();

const normalizeMatchText = (value) => normalizeText(value)
  .toLowerCase()
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ');

const statusMatches = (value, candidates = []) => {
  const normalized = normalizeMatchText(value);

  if (!normalized) {
    return false;
  }

  return candidates.some((candidate) => normalized === candidate || normalized.includes(candidate));
};

const isPaidStatus = (value) => statusMatches(value, PAID_STATUS_TOKENS);
const isPendingStatus = (value) => statusMatches(value, PENDING_STATUS_TOKENS);
const isCancelledStatus = (value) => statusMatches(value, CANCELLED_STATUS_TOKENS);

const getNumber = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined || value === '') {
      continue;
    }

    const numeric = Number(value);

    if (!Number.isNaN(numeric)) {
      return numeric;
    }
  }

  return 0;
};

const toDate = (value, fallback = null) => {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
};

const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

const startOfDay = (value) => {
  if (!value) return null;
  const date = toDate(`${value}T00:00:00`);
  return date;
};

const endOfDay = (value) => {
  if (!value) return null;
  const date = toDate(`${value}T23:59:59.999`);
  return date;
};

const findCatalogService = (purchaseOrService, catalogServices = []) => {
  const directId = normalizeText(
    purchaseOrService?.serviceId
      ?? purchaseOrService?.service_id
      ?? purchaseOrService?.id,
  );
  const directName = normalizeMatchText(
    purchaseOrService?.serviceName
      ?? purchaseOrService?.service_name
      ?? purchaseOrService?.name,
  );

  return catalogServices.find((service) => {
    const serviceId = normalizeText(service?.id);
    const serviceName = normalizeMatchText(service?.name);

    if (directId && directId === serviceId) {
      return true;
    }

    if (directName && serviceName && (serviceName === directName || serviceName.includes(directName) || directName.includes(serviceName))) {
      return true;
    }

    return false;
  }) ?? null;
};

const getProductType = (record, catalogServices = []) => {
  const lineItems = collectPurchaseLineItems(record);
  const firstItem = lineItems[0] ?? null;
  const matchedCatalogService = findCatalogService(firstItem ?? record, catalogServices);

  return normalizeText(
    firstItem?.category
    ?? firstItem?.serviceCategory
    ?? firstItem?.service_category
    ?? record?.category
    ?? record?.serviceCategory
    ?? record?.service_category
    ?? matchedCatalogService?.category,
  ) || 'Uncategorized';
};

const getProductName = (record, catalogServices = []) => {
  const lineItems = collectPurchaseLineItems(record);
  const firstItem = lineItems[0] ?? null;
  const matchedCatalogService = findCatalogService(firstItem ?? record, catalogServices);

  return normalizeText(
    firstItem?.serviceName
    ?? firstItem?.service_name
    ?? firstItem?.name
    ?? record?.serviceName
    ?? record?.service_name
    ?? record?.name
    ?? matchedCatalogService?.name,
  ) || 'Service';
};

const getInvoiceNumber = (purchase, index) => normalizeText(
  purchase?.invoiceNumber
  ?? purchase?.invoice_number
  ?? purchase?.receiptNumber
  ?? purchase?.receipt_number,
) || `INV-${normalizeText(getPurchaseDisplayId(purchase) || purchase?.id) || index + 1}`;

const getDueDate = (purchase, purchaseDate) => (
  toDate(
    purchase?.dueDate
    ?? purchase?.due_date
    ?? purchase?.paymentDueDate
    ?? purchase?.payment_due_date,
    addDays(purchaseDate, 7),
  )
);

const getPaidAt = (purchase, purchaseDate) => {
  const explicit = toDate(
    purchase?.paidAt
    ?? purchase?.paid_at
    ?? purchase?.paymentDate
    ?? purchase?.payment_date
    ?? purchase?.approvedAt
    ?? purchase?.approved_at
    ?? purchase?.updatedAt
    ?? purchase?.updated_at,
  );

  return explicit ?? purchaseDate;
};

const getServiceLifecycleStatus = (service) => {
  const displayStatus = getServiceDisplayStatus(service);
  const cancellationStatus = normalizeMatchText(
    service?.cancellationRequest?.status
    ?? service?.cancellationRequest?.statusKey
    ?? service?.cancellationRequest?.status_key,
  );

  if (cancellationStatus === 'approved' || isCancelledStatus(displayStatus)) {
    return 'Cancelled';
  }

  if (displayStatus === 'Active' || displayStatus === 'Expiring Soon') {
    return 'Active';
  }

  return 'Pending';
};

const matchesDateRange = (dateValue, filters) => {
  if (!dateValue) {
    return !filters.startDate && !filters.endDate;
  }

  const start = startOfDay(filters.startDate);
  const end = endOfDay(filters.endDate);

  if (start && dateValue < start) {
    return false;
  }

  if (end && dateValue > end) {
    return false;
  }

  return true;
};

const matchesAmountRange = (amount, filters) => {
  const minimum = normalizeText(filters.minAmount);
  const maximum = normalizeText(filters.maxAmount);

  if (minimum && amount < Number(minimum)) {
    return false;
  }

  if (maximum && amount > Number(maximum)) {
    return false;
  }

  return true;
};

const matchesSearch = (row, filters) => {
  const normalized = normalizeMatchText(filters.searchTerm);

  if (!normalized) {
    return true;
  }

  return normalizeMatchText(row.searchText).includes(normalized);
};

const createRowSearchText = (values = []) => values
  .map((value) => normalizeText(value))
  .filter(Boolean)
  .join(' ');

export const readReportTemplates = (storageKey = REPORT_TEMPLATE_STORAGE_KEY) => {
  try {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const writeReportTemplates = (templates, storageKey = REPORT_TEMPLATE_STORAGE_KEY) => {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(Array.isArray(templates) ? templates : []));
  } catch {
    // ignore storage write failures in the UI layer
  }
};

const getMonthKey = (value) => {
  const date = toDate(value);
  if (!date) return 'Unknown';

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const getMonthLabel = (value) => {
  const date = toDate(value);
  if (!date) return 'Unknown';

  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date);
};

const uniqueValues = (values = []) => [...new Set(values.filter(Boolean))];

export const buildAdminReportDataset = ({
  purchases = [],
  services = [],
  catalogServices = [],
  clients = [],
  filters = DEFAULT_REPORT_FILTERS,
  now = new Date(),
}) => {
  const nowDate = now instanceof Date ? now : new Date(now);
  const sortedPurchases = [...purchases].sort((left, right) => {
    const leftTime = toDate(getPurchaseDateValue(left) ?? left?.createdAt ?? left?.updatedAt, new Date(0)).getTime();
    const rightTime = toDate(getPurchaseDateValue(right) ?? right?.createdAt ?? right?.updatedAt, new Date(0)).getTime();

    return leftTime - rightTime;
  });
  const clientHistoryMap = new Map();
  const productHistoryMap = new Map();
  const categoryHistoryMap = new Map();

  const salesRows = sortedPurchases.map((purchase, index) => {
    const purchaseDate = toDate(
      getPurchaseDateValue(purchase)
      ?? purchase?.createdAt
      ?? purchase?.created_at
      ?? purchase?.updatedAt
      ?? purchase?.updated_at,
      nowDate,
    );
    const clientName = normalizeText(getPurchaseClientName(purchase) ?? purchase?.client ?? purchase?.customer) || 'Unknown Client';
    const clientEmail = normalizeText(getPurchaseClientEmail(purchase) ?? purchase?.email ?? purchase?.customerEmail ?? purchase?.customer_email);
    const clientKey = normalizeMatchText(clientEmail || clientName || purchase?.id || index);
    const amount = getNumber(
      purchase?.amount,
      purchase?.totalAmount,
      purchase?.total_amount,
      purchase?.price,
      purchase?.total,
      collectPurchaseLineItems(purchase)[0]?.amount,
      collectPurchaseLineItems(purchase)[0]?.price,
    );
    const productType = getProductType(purchase, catalogServices);
    const productName = getProductName(purchase, catalogServices);
    const hadClientHistory = clientHistoryMap.get(clientKey) > 0;
    const previousProducts = productHistoryMap.get(clientKey) ?? new Set();
    const previousCategories = categoryHistoryMap.get(clientKey) ?? new Set();
    const normalizedProductName = normalizeMatchText(productName);
    const normalizedProductType = normalizeMatchText(productType);
    const explicitDealSubType = normalizeText(
      purchase?.dealSubType
      ?? purchase?.deal_sub_type
      ?? purchase?.deal_subtype
      ?? purchase?.subType
      ?? purchase?.sub_type
      ?? purchase?.subtype,
    );
    const dealSubType = explicitDealSubType
      || (previousProducts.has(normalizedProductName)
        ? 'Renewal'
        : previousCategories.has(normalizedProductType)
          ? 'Upgrade'
          : 'New Service');
    const status = normalizeText(purchase?.status ?? purchase?.paymentStatus ?? purchase?.payment_status) || 'Pending Review';
    const dueDate = getDueDate(purchase, purchaseDate);
    const paid = isPaidStatus(status);
    const paidAt = paid ? getPaidAt(purchase, purchaseDate) : null;
    const paymentTiming = paid
      ? (paidAt && dueDate && paidAt.getTime() <= dueDate.getTime() ? 'On Time' : 'Late')
      : (dueDate.getTime() < nowDate.getTime() ? 'Overdue' : 'Open');
    const row = {
      id: String(purchase?.id ?? getPurchaseDisplayId(purchase) ?? index + 1),
      orderLabel: normalizeText(getPurchaseDisplayId(purchase) ?? purchase?.id) || `Order ${index + 1}`,
      date: purchaseDate.toISOString(),
      amount,
      status,
      paymentMethod: normalizeText(
        purchase?.paymentMethod
        ?? purchase?.payment_method
        ?? purchase?.paymentType
        ?? purchase?.payment_type,
      ) || 'Unspecified',
      clientName,
      clientEmail: clientEmail || '—',
      productType,
      productName,
      dealType: hadClientHistory ? 'Existing Client' : 'New Client',
      dealSubType,
      invoiceNumber: getInvoiceNumber(purchase, index),
      dueDate: dueDate.toISOString(),
      paidAt: paidAt ? paidAt.toISOString() : null,
      paymentTiming,
      isPaid: paid,
      isUnpaid: !paid,
      isOverdue: !paid && dueDate.getTime() < nowDate.getTime(),
      searchText: createRowSearchText([
        clientName,
        clientEmail,
        productType,
        productName,
        status,
        purchase?.paymentMethod,
        purchase?.payment_method,
        getPurchaseDisplayId(purchase),
        getInvoiceNumber(purchase, index),
        dealSubType,
      ]),
    };

    clientHistoryMap.set(clientKey, (clientHistoryMap.get(clientKey) ?? 0) + 1);
    previousProducts.add(normalizedProductName);
    previousCategories.add(normalizedProductType);
    productHistoryMap.set(clientKey, previousProducts);
    categoryHistoryMap.set(clientKey, previousCategories);

    return row;
  }).sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());

  const filteredSalesRows = salesRows.filter((row) => {
    if (!matchesDateRange(toDate(row.date), filters)) {
      return false;
    }

    if (!matchesAmountRange(row.amount, filters)) {
      return false;
    }

    if (filters.productType && filters.productType !== 'All Products' && row.productType !== filters.productType) {
      return false;
    }

    if (filters.dealType && filters.dealType !== 'All Deals' && row.dealType !== filters.dealType) {
      return false;
    }

    return matchesSearch(row, filters);
  });

  const serviceRows = services.map((service, index) => {
    const matchedCatalogService = findCatalogService(service, catalogServices);
    const matchedSalesRow = salesRows.find((row) => normalizeMatchText(row.productName) === normalizeMatchText(service?.name));
    const recordedAt = toDate(
      service?.createdAt
      ?? service?.created_at
      ?? service?.updatedAt
      ?? service?.updated_at
      ?? service?.renewsOn,
      nowDate,
    );
    const renewsOn = toDate(service?.renewsOn ?? service?.renewalDate ?? service?.renewal_date);
    const lifecycleStatus = getServiceLifecycleStatus(service);
    const daysUntilRenewal = renewsOn ? Math.ceil((renewsOn.getTime() - nowDate.getTime()) / DAY_MS) : null;

    return {
      id: String(service?.id ?? service?.serviceId ?? `service-${index + 1}`),
      serviceName: normalizeText(service?.name ?? service?.serviceName) || 'Service',
      clientName: normalizeText(service?.clientName ?? service?.client ?? service?.customerName ?? service?.customer) || matchedSalesRow?.clientName || 'Unknown Client',
      productType: normalizeText(service?.category ?? matchedCatalogService?.category ?? matchedSalesRow?.productType) || 'Uncategorized',
      status: getServiceDisplayStatus(service, nowDate.getTime()),
      lifecycleStatus,
      renewsOn: renewsOn ? renewsOn.toISOString() : null,
      daysUntilRenewal,
      isUpcomingRenewal: Boolean(renewsOn && daysUntilRenewal !== null && daysUntilRenewal >= 0 && daysUntilRenewal <= 30 && lifecycleStatus !== 'Cancelled'),
      cancellationStatus: normalizeText(
        service?.cancellationRequest?.status
        ?? service?.cancellationRequest?.statusKey
        ?? service?.cancellationRequest?.status_key,
      ) || '—',
      recordedAt: recordedAt.toISOString(),
      searchText: createRowSearchText([
        service?.name,
        service?.serviceName,
        service?.clientName,
        service?.client,
        service?.category,
        lifecycleStatus,
        getServiceDisplayStatus(service, nowDate.getTime()),
      ]),
    };
  }).sort((left, right) => {
    const leftTime = new Date(left.renewsOn ?? left.recordedAt).getTime();
    const rightTime = new Date(right.renewsOn ?? right.recordedAt).getTime();
    return leftTime - rightTime;
  });

  const filteredServiceRows = serviceRows.filter((row) => {
    if (filters.productType && filters.productType !== 'All Products' && row.productType !== filters.productType) {
      return false;
    }

    const relevantDate = row.renewsOn ? toDate(row.renewsOn) : toDate(row.recordedAt);

    if (!matchesDateRange(relevantDate, filters)) {
      return false;
    }

    return matchesSearch(row, filters);
  });

  const overdueInvoiceRows = filteredSalesRows.filter((row) => row.isOverdue);
  const openInvoiceRows = filteredSalesRows.filter((row) => row.paymentTiming === 'Open');
  const unpaidInvoiceRows = filteredSalesRows.filter((row) => row.isUnpaid);
  const onTimePaymentRows = filteredSalesRows.filter((row) => row.paymentTiming === 'On Time');
  const latePaymentRows = filteredSalesRows.filter((row) => row.paymentTiming === 'Late');
  const upcomingRenewalRows = filteredServiceRows.filter((row) => row.isUpcomingRenewal);

  const paidSalesRows = filteredSalesRows.filter((row) => row.isPaid);
  const taxRows = Array.from(
    paidSalesRows.reduce((collection, row) => {
      const key = getMonthKey(row.date);
      const entry = collection.get(key) ?? {
        id: key,
        period: getMonthLabel(row.date),
        grossSales: 0,
        taxDue: 0,
        netRevenue: 0,
        receivables: 0,
      };
      const taxDue = row.amount * 0.12;

      entry.grossSales += row.amount;
      entry.taxDue += taxDue;
      entry.netRevenue += row.amount - taxDue;
      collection.set(key, entry);
      return collection;
    }, new Map()).values(),
  ).map((row) => ({
    ...row,
    receivables: unpaidInvoiceRows
      .filter((invoice) => getMonthKey(invoice.date) === row.id)
      .reduce((sum, invoice) => sum + invoice.amount, 0),
  })).sort((left, right) => left.id.localeCompare(right.id));

  const renewalCount = filteredSalesRows.filter((row) => row.dealSubType === 'Renewal').length;
  const cancellationCount = filteredServiceRows.filter((row) => row.lifecycleStatus === 'Cancelled').length;
  const lifecycleTotal = renewalCount + cancellationCount;
  const filteredRevenue = filteredSalesRows.reduce((sum, row) => sum + row.amount, 0);
  const unpaidAmount = unpaidInvoiceRows.reduce((sum, row) => sum + row.amount, 0);
  const overdueAmount = overdueInvoiceRows.reduce((sum, row) => sum + row.amount, 0);
  const grossPaidRevenue = paidSalesRows.reduce((sum, row) => sum + row.amount, 0);
  const taxDue = taxRows.reduce((sum, row) => sum + row.taxDue, 0);

  return {
    productTypeOptions: ['All Products', ...uniqueValues(salesRows.map((row) => row.productType))],
    dealTypeOptions: ['All Deals', ...uniqueValues(salesRows.map((row) => row.dealType))],
    salesRows,
    filteredSalesRows,
    serviceRows,
    filteredServiceRows,
    overdueInvoiceRows,
    openInvoiceRows,
    unpaidInvoiceRows,
    onTimePaymentRows,
    latePaymentRows,
    upcomingRenewalRows,
    taxRows,
    summary: {
      filteredRevenue,
      filteredDeals: filteredSalesRows.length,
      renewalCount,
      cancellationCount,
      renewalRate: lifecycleTotal ? (renewalCount / lifecycleTotal) * 100 : 0,
      cancellationRate: lifecycleTotal ? (cancellationCount / lifecycleTotal) * 100 : 0,
      activeServices: filteredServiceRows.filter((row) => row.lifecycleStatus === 'Active').length,
      pendingServices: filteredServiceRows.filter((row) => row.lifecycleStatus === 'Pending').length,
      cancelledServices: cancellationCount,
      openInvoices: openInvoiceRows.length,
      overdueInvoices: overdueInvoiceRows.length,
      overdueAmount,
      unpaidInvoices: unpaidInvoiceRows.length,
      unpaidAmount,
      onTimePayments: onTimePaymentRows.length,
      latePayments: latePaymentRows.length,
      upcomingRenewals: upcomingRenewalRows.length,
      grossPaidRevenue,
      taxDue,
      netRevenue: grossPaidRevenue - taxDue,
    },
  };
};
