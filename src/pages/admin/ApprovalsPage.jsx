import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, Eye, MessageSquare, LayoutGrid, List, CheckCircle2, XCircle, CircleOff, Percent, CreditCard, PencilLine } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import UserAvatar from '../../components/common/UserAvatar';
import { usePortal } from '../../context/PortalContext';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format';
import { getCancellationReasonValue, getCustomerCommentValue, getDesiredDomainValue, isDomainOrder } from '../../utils/orders';
import { getAdminServiceExpirationMeta } from '../../utils/services';
import StatusBadge from '../../components/common/StatusBadge';

const PURCHASE_LINE_ITEM_KEYS = ['orderItems', 'order_items', 'orderItem', 'order_item', 'lineItems', 'line_items', 'lineItem', 'line_item', 'cart', 'cartItems', 'cart_items', 'items', 'item'];
const PURCHASE_ADDON_KEYS = ['selectedAddons', 'selected_addons', 'addons', 'add_ons', 'addon'];
const SERVICE_SELECTED_ADDON_KEYS = ['selectedAddons', 'selected_addons', 'selectedAddon', 'selected_addon', 'chosenAddons', 'chosen_addons', 'purchasedAddons', 'purchased_addons', 'customerAddons', 'customer_addons', 'add_ons', 'addon'];

const normalizeMatchText = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ');

const getPurchaseRecordTime = (record) => {
  const rawValue = record?.date ?? record?.createdAt ?? record?.created_at ?? record?.updatedAt ?? record?.updated_at ?? 0;
  const time = new Date(rawValue).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const buildAddonCatalogMap = (service) => {
  const catalog = new Map();

  (Array.isArray(service?.addons) ? service.addons : []).forEach((option) => {
    if (option === null || option === undefined) {
      return;
    }

    const label = typeof option === 'object'
      ? String(option.label ?? option.name ?? '').trim()
      : String(option).trim();

    if (!label) {
      return;
    }

    catalog.set(normalizeMatchText(label), {
      label,
      price: typeof option === 'object' && typeof option.price === 'number' ? Number(option.price) : null,
    });
  });

  return catalog;
};

const buildAddonCatalogEntries = (service) => Array.from(buildAddonCatalogMap(service).values())
  .filter((entry) => typeof entry?.price === 'number' && entry.price > 0);

const normalizeAddonValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeAddonValue(entry));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    if (
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
      || (trimmed.startsWith('{') && trimmed.endsWith('}'))
    ) {
      try {
        return normalizeAddonValue(JSON.parse(trimmed));
      } catch {
        // Fall back to comma-separated parsing below.
      }
    }

    return trimmed
      .split(',')
      .map((entry) => entry.trim().replace(/^[\[\]"']+|[\[\]"']+$/g, '').trim())
      .filter(Boolean);
  }

  return [value];
};

const getAddonEntryLabel = (entry) => {
  if (entry === null || entry === undefined) {
    return '';
  }

  if (typeof entry !== 'object') {
    return String(entry).trim();
  }

  const nestedAddon = entry.serviceAddon ?? entry.service_addon ?? entry.addonDetail ?? entry.addon_detail ?? null;
  const label = entry.label
    ?? entry.name
    ?? entry.value
    ?? entry.addon
    ?? entry.addon_name
    ?? entry.title
    ?? nestedAddon?.label
    ?? nestedAddon?.name
    ?? nestedAddon?.title
    ?? '';

  return String(label).trim();
};

const getAddonEntryPrice = (entry, catalogMatch) => {
  if (entry && typeof entry === 'object') {
    const nestedAddon = entry.serviceAddon ?? entry.service_addon ?? entry.addonDetail ?? entry.addon_detail ?? null;
    const rawPrice = entry.price
      ?? entry.extra_price
      ?? entry.extraPrice
      ?? entry.amount
      ?? nestedAddon?.price
      ?? nestedAddon?.extra_price
      ?? nestedAddon?.extraPrice;

    if (rawPrice !== null && rawPrice !== undefined && rawPrice !== '' && !Number.isNaN(Number(rawPrice))) {
      return Number(rawPrice);
    }
  }

  return catalogMatch?.price ?? null;
};

const extractAddonEntriesFromRecord = (record, addonCatalog, addonKeys = PURCHASE_ADDON_KEYS) => {
  if (!record || typeof record !== 'object') {
    return [];
  }

  const seen = new Set();
  const entries = [];

  const pushEntry = (rawValue) => {
    normalizeAddonValue(rawValue).forEach((entry) => {
      if (entry === null || entry === undefined) {
        return;
      }

      const label = getAddonEntryLabel(entry);

      if (!label) {
        return;
      }

      const key = normalizeMatchText(label);
      if (seen.has(key)) {
        return;
      }

      seen.add(key);

      const catalogMatch = addonCatalog.get(key);
      entries.push({
        label: catalogMatch?.label ?? label,
        price: getAddonEntryPrice(entry, catalogMatch),
      });
    });
  };

  addonKeys.forEach((key) => pushEntry(record[key]));

  return entries;
};

const mergeAddonEntries = (...entryLists) => {
  const seen = new Set();

  return entryLists
    .flatMap((entries) => (Array.isArray(entries) ? entries : []))
    .filter((entry) => {
      const key = normalizeMatchText(entry?.label);

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
};

const getNumericValue = (...values) => {
  const found = values.find((value) => value !== null && value !== undefined && value !== '' && !Number.isNaN(Number(value)));
  return found === undefined ? null : Number(found);
};

const inferAddonEntriesFromTotal = (service, totalPaid, basePlanPrice = null) => {
  if (totalPaid === null || totalPaid === undefined || Number.isNaN(Number(totalPaid))) {
    return [];
  }

  const catalogEntries = buildAddonCatalogEntries(service);
  if (!catalogEntries.length) {
    return [];
  }

  const resolvedBasePlanPrice = getNumericValue(
    basePlanPrice,
    service?.basePrice,
    service?.base_price,
    service?.servicePrice,
    service?.service_price,
  );

  if (resolvedBasePlanPrice === null) {
    return [];
  }

  const addonBudget = Math.round((Number(totalPaid) - resolvedBasePlanPrice) * 100);
  if (addonBudget <= 0) {
    return [];
  }

  const pricedEntries = catalogEntries
    .map((entry) => ({ ...entry, cents: Math.round(Number(entry.price) * 100) }))
    .filter((entry) => entry.cents > 0)
    .sort((left, right) => right.cents - left.cents);

  let bestMatch = null;

  const search = (startIndex, remainingBudget, chosenEntries) => {
    if (remainingBudget === 0) {
      bestMatch = [...chosenEntries];
      return true;
    }

    for (let index = startIndex; index < pricedEntries.length; index += 1) {
      const entry = pricedEntries[index];
      if (entry.cents > remainingBudget) {
        continue;
      }

      chosenEntries.push(entry);
      if (search(index + 1, remainingBudget - entry.cents, chosenEntries)) {
        return true;
      }
      chosenEntries.pop();
    }

    return false;
  };

  search(0, addonBudget, []);

  return (bestMatch ?? []).map(({ label, price }) => ({ label, price }));
};

const collectPurchaseLineItems = (record) => {
  if (!record || typeof record !== 'object') {
    return [];
  }

  const queue = [record];
  const seen = new Set();
  const lineItems = [];

  while (queue.length) {
    const current = queue.shift();

    if (!current || typeof current !== 'object' || seen.has(current)) {
      continue;
    }

    seen.add(current);

    PURCHASE_LINE_ITEM_KEYS.forEach((key) => {
      const value = current[key];

      if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry && typeof entry === 'object') {
            lineItems.push(entry);
            queue.push(entry);
          }
        });
        return;
      }

      if (value && typeof value === 'object') {
        lineItems.push(value);
        queue.push(value);
      }
    });
  }

  return lineItems;
};

const serviceMatchesPurchaseRecord = (service, record) => {
  if (!record || typeof record !== 'object') {
    return false;
  }

  const serviceOrderItemIds = [service?.orderItemId, service?.order_item_id]
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value));

  const recordOrderItemIds = [record?.id, record?.orderItemId, record?.order_item_id, record?.itemId, record?.item_id]
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value));

  if (serviceOrderItemIds.length && recordOrderItemIds.some((value) => serviceOrderItemIds.includes(value))) {
    return true;
  }

  const serviceIds = [service?.id, service?.serviceId, service?.service_id]
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value));

  const recordIds = ['serviceId', 'service_id', 'customerServiceId', 'customer_service_id']
    .map((key) => record[key])
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value));

  if (serviceIds.length && recordIds.some((value) => serviceIds.includes(value))) {
    return true;
  }

  const serviceName = normalizeMatchText(service?.name ?? service?.serviceName);
  const recordNames = [record?.serviceName, record?.service_name, record?.name, record?.service, record?.title]
    .map((value) => normalizeMatchText(value))
    .filter(Boolean);

  if (Boolean(serviceName) && recordNames.some((value) => value === serviceName || value.includes(serviceName) || serviceName.includes(value))) {
    return true;
  }

  const servicePlan = normalizeMatchText(service?.plan ?? service?.configuration);
  const recordPlans = [record?.plan, record?.configuration, record?.config, record?.option]
    .map((value) => normalizeMatchText(value))
    .filter(Boolean);

  return Boolean(servicePlan) && recordPlans.some((value) => value === servicePlan || value.includes(servicePlan) || servicePlan.includes(value));
};

const clientMatchesPurchase = (service, purchase) => {
  const serviceClient = normalizeMatchText(service?.client);
  const serviceEmail = normalizeMatchText(service?.clientEmail);
  const purchaseClient = normalizeMatchText(purchase?.client ?? purchase?.customer ?? purchase?.clientName);
  const purchaseEmail = normalizeMatchText(purchase?.clientEmail ?? purchase?.customerEmail ?? purchase?.email);

  if (serviceEmail && purchaseEmail && serviceEmail === purchaseEmail) {
    return true;
  }

  if (serviceClient && purchaseClient && serviceClient === purchaseClient) {
    return true;
  }

  return !serviceClient && !serviceEmail;
};

const buildServicePurchaseDetails = (service, purchases) => {
  const addonCatalog = buildAddonCatalogMap(service);
  const serviceAddonEntries = mergeAddonEntries(
    extractAddonEntriesFromRecord(service, addonCatalog, SERVICE_SELECTED_ADDON_KEYS),
    ...collectPurchaseLineItems(service).map((lineItem) => extractAddonEntriesFromRecord(lineItem, addonCatalog)),
  );

  const matches = purchases
    .map((purchase) => {
      if (!clientMatchesPurchase(service, purchase)) {
        return null;
      }

      const lineItems = collectPurchaseLineItems(purchase);
      const lineItem = lineItems.find((entry) => serviceMatchesPurchaseRecord(service, entry)) ?? null;

      if (!lineItem && !serviceMatchesPurchaseRecord(service, purchase)) {
        return null;
      }

      const totalPaidCandidate = lineItem?.price ?? lineItem?.amount ?? purchase?.amount ?? purchase?.price ?? service?.totalPaid ?? service?.total_paid ?? service?.amount ?? service?.price ?? service?.basePrice ?? null;
      const totalPaid = totalPaidCandidate !== null && totalPaidCandidate !== undefined && !Number.isNaN(Number(totalPaidCandidate))
        ? Number(totalPaidCandidate)
        : null;
      const inferredAddonEntries = inferAddonEntriesFromTotal(
        service,
        totalPaid,
        getNumericValue(
          lineItem?.basePrice,
          lineItem?.base_price,
          lineItem?.servicePrice,
          lineItem?.service_price,
          service?.basePrice,
          service?.base_price,
        ),
      );
      const addonEntries = mergeAddonEntries(
        extractAddonEntriesFromRecord(lineItem, addonCatalog),
        extractAddonEntriesFromRecord(purchase, addonCatalog),
        serviceAddonEntries,
        inferredAddonEntries,
      );
      const addonTotal = addonEntries.reduce((sum, entry) => sum + (typeof entry.price === 'number' ? entry.price : 0), 0);
      const basePlanPrice = totalPaid !== null && addonTotal > 0 && totalPaid >= addonTotal
        ? totalPaid - addonTotal
        : null;

      return {
        purchase,
        lineItem,
        addonEntries,
        addonTotal,
        basePlanPrice,
        totalPaid,
      };
    })
    .filter(Boolean)
    .sort((left, right) => getPurchaseRecordTime(right.lineItem ?? right.purchase) - getPurchaseRecordTime(left.lineItem ?? left.purchase));

  const fallbackTotalPaid = typeof service?.totalPaid === 'number'
    ? Number(service.totalPaid)
    : typeof service?.total_paid === 'number'
      ? Number(service.total_paid)
      : typeof service?.amount === 'number'
        ? Number(service.amount)
        : typeof service?.price === 'number'
          ? Number(service.price)
          : (typeof service?.basePrice === 'number' ? Number(service.basePrice) : null);
  const fallbackAddonEntries = mergeAddonEntries(
    serviceAddonEntries,
    inferAddonEntriesFromTotal(service, fallbackTotalPaid, getNumericValue(service?.basePrice, service?.base_price)),
  );
  const fallbackAddonTotal = fallbackAddonEntries.reduce((sum, entry) => sum + (typeof entry.price === 'number' ? entry.price : 0), 0);
  const fallbackBasePlanPrice = fallbackTotalPaid !== null && fallbackAddonTotal > 0 && fallbackTotalPaid >= fallbackAddonTotal
    ? fallbackTotalPaid - fallbackAddonTotal
    : null;

  return matches[0] ?? {
    purchase: null,
    lineItem: null,
    addonEntries: fallbackAddonEntries,
    addonTotal: fallbackAddonTotal,
    basePlanPrice: fallbackBasePlanPrice,
    totalPaid: fallbackTotalPaid,
  };
};

const getAddonSummaryLabel = (addonEntries) => {
  if (!addonEntries.length) {
    return 'No add-ons';
  }

  if (addonEntries.length === 1) {
    return addonEntries[0].label;
  }

  return `${addonEntries[0].label} +${addonEntries.length - 1} more`;
};

const getAddonSummaryMeta = (addonEntries) => {
  const entries = Array.isArray(addonEntries)
    ? addonEntries.filter((entry) => Boolean(entry?.label))
    : [];
  const count = entries.length;

  if (!count) {
    return {
      count: 0,
      extraCount: 0,
      hasAddons: false,
      primaryLabel: 'No add-ons',
      secondaryLabel: 'None selected',
      tooltip: 'No add-ons selected',
    };
  }

  return {
    count,
    extraCount: Math.max(count - 1, 0),
    hasAddons: true,
    primaryLabel: entries[0].label,
    secondaryLabel: count === 1 ? '1 selected' : `${count} selected`,
    tooltip: entries.map((entry) => entry.label).join(', '),
  };
};

const getServiceSubtitle = (service) => {
  const serviceNameKey = normalizeMatchText(service?.name);
  const parts = [service?.category, service?.plan]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .filter((value, index, values) => {
      const valueKey = normalizeMatchText(value);

      if (!valueKey || valueKey === serviceNameKey) {
        return false;
      }

      return values.findIndex((entry) => normalizeMatchText(entry) === valueKey) === index;
    });

  return parts.join(' · ');
};

const AddonSummaryButton = ({ addonEntries, onClick }) => {
  const summaryMeta = getAddonSummaryMeta(addonEntries);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex min-h-[44px] w-[164px] max-w-full items-center gap-2 rounded-2xl border px-2 py-1.5 text-left transition ${summaryMeta.hasAddons ? 'border-sky-300/20 bg-sky-400/10 hover:bg-sky-400/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
      title={summaryMeta.tooltip}
      aria-label={`View add-on breakdown for ${summaryMeta.tooltip}`}
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border text-[11px] font-semibold ${summaryMeta.hasAddons ? 'border-sky-300/20 bg-sky-300/10 text-sky-200' : 'border-white/10 bg-white/5 text-slate-400'}`}>
        {summaryMeta.count}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[13px] font-semibold leading-5 ${summaryMeta.hasAddons ? 'text-white' : 'text-slate-200'}`}>
          {summaryMeta.primaryLabel}
        </span>
        <span className="mt-0.5 block text-[9px] uppercase tracking-[0.18em] text-slate-500">
          {summaryMeta.secondaryLabel}
        </span>
      </span>
      {summaryMeta.extraCount > 0 ? (
        <span className="shrink-0 rounded-full bg-sky-300/10 px-1.5 py-0.5 text-[9px] font-semibold text-sky-200">
          +{summaryMeta.extraCount}
        </span>
      ) : null}
    </button>
  );
};

const ExpirationMetaCell = ({ expirationMeta }) => (
  <div className="min-w-[150px]">
    <p className={`text-sm font-medium ${expirationMeta.isExpired ? 'text-rose-300' : 'text-white'}`}>
      {expirationMeta.value}
    </p>
    <p className={`mt-1 text-xs ${expirationMeta.isExpired ? 'text-rose-300' : 'text-slate-500'}`}>
      {expirationMeta.helper}
    </p>
  </div>
);

export default function ApprovalsPage() {
  const { adminPurchases, approveAdminOrder, clients, adminServices, approveServiceCancellation, rejectServiceCancellation, updateServiceStatus, requestServiceCancellation } = usePortal();
  const [processingOrderId, setProcessingOrderId] = useState('');
  const [selectedOrderForReview, setSelectedOrderForReview] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedOrderForNote, setSelectedOrderForNote] = useState(null);
  const [showOrderNoteModal, setShowOrderNoteModal] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [typeFilter, setTypeFilter] = useState('all');
  const [processingCancellationId, setProcessingCancellationId] = useState('');
  const [cancellationMessage, setCancellationMessage] = useState('');
  const [cancellationError, setCancellationError] = useState('');

  // --- copied states from ManageServicesPage for actions/modals ---
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountTargetService, setDiscountTargetService] = useState(null);
  const [discountForm, setDiscountForm] = useState({ type: 'percentage', value: '', expiresOn: '' });
  const [showPricingLogsModal, setShowPricingLogsModal] = useState(false);
  const [pricingLogsService, setPricingLogsService] = useState(null);
  const [selectedServiceBreakdown, setSelectedServiceBreakdown] = useState(null);
  const [selectedCancellationService, setSelectedCancellationService] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isQueueingCancellation, setIsQueueingCancellation] = useState(false);
  const [showClientProfile, setShowClientProfile] = useState(false);
  const [billingModalClient, setBillingModalClient] = useState(null);
  const [billingForm, setBillingForm] = useState({ company: '', email: '', address: '', tin: '', mobileNumber: '' });
  const [isSavingBilling, setIsSavingBilling] = useState(false);
  // All services section states
  const [servicesSearchQuery, setServicesSearchQuery] = useState('');
  const [servicesStatusFilter, setServicesStatusFilter] = useState('All');
  const [servicesViewMode, setServicesViewMode] = useState('grid');
  const [servicesTableSort, setServicesTableSort] = useState({ key: 'service', direction: 'asc' });
  const [pendingTableSort, setPendingTableSort] = useState({ key: 'service', direction: 'asc' });
  const [servicesPage, setServicesPage] = useState(1);
  const SERVICES_PER_PAGE = 10;


  const eligibleClients = useMemo(
    () => clients.filter((client) => client.registrationApproval?.statusKey !== 'pending' && client.registrationApproval?.statusKey !== 'rejected'),
    [clients],
  );

  const matchedClients = useMemo(() => {
    const normalizedSearch = clientSearch.trim().toLowerCase();

    return eligibleClients.filter((client) => {
      if (!normalizedSearch) return true;

      return [client.name, client.company, client.email]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [clientSearch, eligibleClients]);



  const pendingOrders = useMemo(
    () => adminPurchases.filter((p) => p.status === 'Pending Review' && (!selectedClientId || p.client === eligibleClients.find((c) => c.id === selectedClientId)?.name)),
    [adminPurchases, selectedClientId, eligibleClients],
  );

  const pendingCancellationServices = useMemo(
    () => adminServices.filter((service) => service.cancellationRequest?.statusKey === 'pending' && (!selectedClientId || service.clientEmail === eligibleClients.find((c) => c.id === selectedClientId)?.email || service.client === eligibleClients.find((c) => c.id === selectedClientId)?.name)),
    [adminServices, selectedClientId, eligibleClients],
  );

  const combinedPending = useMemo(() => {
    const orders = pendingOrders.map((o) => {
      const customerNote = getDesiredDomainValue(o);

      return {
        id: `order-${o.id}`,
        type: 'order',
        serviceName: o.serviceName,
        client: o.client,
        clientId: null,
        amount: o.amount,
        status: o.status,
        raw: o,
        customerNote,
        meta: { date: o.date, paymentMethod: o.paymentMethod },
      };
    });

    const cancels = pendingCancellationServices.map((s) => ({
      id: `cancel-${s.id}`,
      type: 'cancellation',
      serviceName: s.name,
      client: s.client || s.clientEmail || 'No client assigned',
      clientId: null,
      amount: null,
      status: s.cancellationRequest?.status ?? 'Pending Approval',
      raw: s,
      customerNote: getCancellationReasonValue(s),
      meta: { requestedAt: s.cancellationRequest?.requestedAt },
    }));

    return [...orders, ...cancels];
  }, [pendingOrders, pendingCancellationServices]);

  const statuses = ['Active', 'Expired', 'Unpaid', 'Undergoing Provisioning'];

  const filteredServices = useMemo(() => {
    return adminServices.filter((service) => {
      if (!selectedClientId) return true;

      const client = eligibleClients.find((c) => c.id === selectedClientId);
      if (!client) return true;

      return service.clientEmail === client.email || service.client === client.name;
    });
  }, [adminServices, selectedClientId, eligibleClients]);

  // All services search/filter logic
  const filteredServicesForPanel = useMemo(() => {
    const normalized = servicesSearchQuery.trim().toLowerCase();
    return adminServices.filter((service) => {
      const matchesSearch = !normalized || [service.name, service.category, service.plan, service.client, service.clientEmail]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(normalized));
      const matchesStatus = servicesStatusFilter === 'All' || service.status === servicesStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [adminServices, servicesSearchQuery, servicesStatusFilter]);

  const handleServicesTableSort = (key) => {
    setServicesTableSort((current) => (
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    ));
  };

  const renderServicesSortIndicator = (key) => {
    const isSorted = servicesTableSort.key === key;
    return (
      <span className="ml-1 flex flex-col items-center gap-0">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`sort-svg sort-icon ${isSorted && servicesTableSort.direction === 'asc' ? 'active' : 'inactive'}`}
        >
          <path d="M7 14l5-5 5 5" />
        </svg>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`sort-svg sort-icon ${isSorted && servicesTableSort.direction === 'desc' ? 'active' : 'inactive'}`}
        >
          <path d="M7 10l5 5 5-5" />
        </svg>
      </span>
    );
  };

  const sortedServicesForPanel = useMemo(() => {
    const list = [...filteredServicesForPanel];
    const directionMultiplier = servicesTableSort.direction === 'asc' ? 1 : -1;
    const getPrice = (service) => (typeof service.basePrice === 'number' ? service.basePrice : 0);

    return list.sort((a, b) => {
      if (servicesTableSort.key === 'client') {
        return String(a.client ?? a.clientEmail ?? '').localeCompare(String(b.client ?? b.clientEmail ?? '')) * directionMultiplier;
      }

      if (servicesTableSort.key === 'price') {
        return (getPrice(a) - getPrice(b)) * directionMultiplier;
      }

      if (servicesTableSort.key === 'status') {
        return String(a.status ?? '').localeCompare(String(b.status ?? '')) * directionMultiplier;
      }

      return String(a.name ?? '').localeCompare(String(b.name ?? '')) * directionMultiplier;
    });
  }, [filteredServicesForPanel, servicesTableSort]);

  const servicesTotalPages = Math.max(1, Math.ceil(sortedServicesForPanel.length / SERVICES_PER_PAGE));

  const paginatedServicesForPanel = useMemo(() => {
    const startIndex = (servicesPage - 1) * SERVICES_PER_PAGE;

    return sortedServicesForPanel.slice(startIndex, startIndex + SERVICES_PER_PAGE);
  }, [sortedServicesForPanel, servicesPage]);

  useEffect(() => {
    setServicesPage(1);
  }, [servicesSearchQuery, servicesStatusFilter, servicesViewMode, sortedServicesForPanel.length]);

  const servicePurchaseDetailsById = useMemo(() => {
    return new Map(
      adminServices.map((service) => [String(service.id), buildServicePurchaseDetails(service, adminPurchases)]),
    );
  }, [adminPurchases, adminServices]);

  const getServicePurchaseDetails = (service) => servicePurchaseDetailsById.get(String(service.id)) ?? buildServicePurchaseDetails(service, []);

  const filteredCombinedPending = useMemo(
    () => combinedPending.filter((row) => (typeFilter === 'all' ? true : row.type === typeFilter)),
    [combinedPending, typeFilter],
  );

  const handlePendingTableSort = (key) => {
    setPendingTableSort((current) => (
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    ));
  };

  const renderPendingSortIndicator = (key) => {
    const isSorted = pendingTableSort.key === key;
    return (
      <span className="ml-1 flex flex-col items-center gap-0">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`sort-svg sort-icon ${isSorted && pendingTableSort.direction === 'asc' ? 'active' : 'inactive'}`}>
          <path d="M7 14l5-5 5 5" />
        </svg>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`sort-svg sort-icon ${isSorted && pendingTableSort.direction === 'desc' ? 'active' : 'inactive'}`}>
          <path d="M7 10l5 5 5-5" />
        </svg>
      </span>
    );
  };

  const sortedCombinedPending = useMemo(() => {
    const list = [...filteredCombinedPending];
    const directionMultiplier = pendingTableSort.direction === 'asc' ? 1 : -1;

    return list.sort((a, b) => {
      if (pendingTableSort.key === 'client') {
        return String(a.client ?? '').localeCompare(String(b.client ?? '')) * directionMultiplier;
      }

      if (pendingTableSort.key === 'amount') {
        return ((a.amount ?? 0) - (b.amount ?? 0)) * directionMultiplier;
      }

      if (pendingTableSort.key === 'status') {
        return String(a.status ?? '').localeCompare(String(b.status ?? '')) * directionMultiplier;
      }

      if (pendingTableSort.key === 'date') {
        const timeA = a.type === 'order' ? new Date(a.meta?.date ?? 0).getTime() : new Date(a.meta?.requestedAt ?? 0).getTime();
        const timeB = b.type === 'order' ? new Date(b.meta?.date ?? 0).getTime() : new Date(b.meta?.requestedAt ?? 0).getTime();
        return (timeA - timeB) * directionMultiplier;
      }

      return String(a.serviceName ?? '').localeCompare(String(b.serviceName ?? '')) * directionMultiplier;
    });
  }, [filteredCombinedPending, pendingTableSort]);

  const selectedOrderReviewNote = getDesiredDomainValue(selectedOrderForReview);
  const selectedOrderActionNote = getCustomerCommentValue(selectedOrderForNote);
  const shouldShowCommentAction = (row) => {
    if (row.type === 'order') {
      return isDomainOrder(row.raw);
    }

    return Boolean(row.customerNote || getCancellationReasonValue(row.raw));
  };
  const selectedOrderForNoteTitle = selectedOrderForNote?.serviceName ?? selectedOrderForNote?.name ?? 'Customer Comment';
  const selectedOrderForNoteIsCancellation = Boolean(selectedOrderForNote?.cancellationRequest);

  const findClientForService = (service) => clients.find((client) => client.email === service.clientEmail || client.name === service.client) ?? null;

  const handleViewClientFromService = (service) => {
    const client = findClientForService(service);

    if (!client) {
      setError('Unable to locate the linked client profile for this service.');
      return;
    }

    setSelectedClientId(client.id);
    setShowClientProfile(true);
  };

  const openDiscountModal = (service) => {
    setDiscountTargetService(service);
    setDiscountForm({ type: 'percentage', value: '', expiresOn: '' });
    setShowDiscountModal(true);
  };

  const closeDiscountModal = () => {
    setShowDiscountModal(false);
    setDiscountTargetService(null);
  };

  const handleApplyDiscount = (e) => {
    e.preventDefault();
    setMessage(`Discount applied to ${discountTargetService?.name || 'service'}`);
    closeDiscountModal();
  };

  const openPricingLogs = (service) => {
    setPricingLogsService(service);
    setShowPricingLogsModal(true);
  };

  const closePricingLogs = () => {
    setShowPricingLogsModal(false);
    setPricingLogsService(null);
  };

  const openServiceBreakdownModal = (service) => {
    setSelectedServiceBreakdown(service);
  };

  const closeServiceBreakdownModal = () => {
    setSelectedServiceBreakdown(null);
  };

  const openCancellationModal = (service) => {
    setSelectedCancellationService(service);
    setCancellationReason(getCancellationReasonValue(service));
  };

  const closeCancellationModal = () => {
    setSelectedCancellationService(null);
    setCancellationReason('');
  };

  const openBillingModal = (client) => {
    setBillingModalClient(client);
    setBillingForm({
      company: client.company === '—' ? '' : (client.company ?? ''),
      email: client.email ?? '',
      address: client.address ?? '',
      tin: client.tin ?? '',
      mobileNumber: client.mobileNumber ?? '',
    });
    setError('');
  };

  const closeBillingModal = () => {
    setBillingModalClient(null);
  };

  const handleSaveBilling = async (event) => {
    event.preventDefault();

    if (!billingModalClient) return;

    setIsSavingBilling(true);
    setError('');

    try {
      const response = await updateClientBilling(billingModalClient.id, billingForm);
      setMessage(response.message);
      closeBillingModal();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSavingBilling(false);
    }
  };

  const handleQueueCancellation = async (event) => {
    // If called as a button with service object, allow that
    if (event && typeof event === 'object' && event.id) {
      // open modal for confirmation/reason
      openCancellationModal(event);
      return;
    }

    // Otherwise assume form submit
    if (!selectedCancellationService) return;

    event.preventDefault?.();
    setIsQueueingCancellation(true);
    setCancellationError('');

    try {
      const response = await requestServiceCancellation(selectedCancellationService.id, cancellationReason.trim());
      setCancellationMessage(response.message);
      closeCancellationModal();
    } catch (requestError) {
      setCancellationError(requestError.message);
    } finally {
      setIsQueueingCancellation(false);
    }
  };

  const handleApproveOrder = async (orderId) => {
    setProcessingOrderId(orderId);
    setError('');

    try {
      const response = await approveAdminOrder(orderId);
      setMessage(response.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setProcessingOrderId('');
    }
  };

  const openOrderModal = (order) => {
    setSelectedOrderForNote(null);
    setShowOrderNoteModal(false);
    setSelectedOrderForReview(order);
    setShowOrderModal(true);
  };

  const closeOrderModal = () => {
    setSelectedOrderForReview(null);
    setShowOrderModal(false);
  };

  const openOrderNoteModal = (order) => {
    setSelectedOrderForReview(null);
    setShowOrderModal(false);
    setSelectedOrderForNote(order);
    setShowOrderNoteModal(true);
  };

  const closeOrderNoteModal = () => {
    setSelectedOrderForNote(null);
    setShowOrderNoteModal(false);
  };

  const handleApproveCancellation = async (serviceId) => {
    setProcessingCancellationId(serviceId);
    setCancellationError('');

    try {
      const response = await approveServiceCancellation(serviceId);
      setCancellationMessage(response.message);
    } catch (requestError) {
      setCancellationError(requestError.message);
    } finally {
      setProcessingCancellationId('');
    }
  };

  const handleRejectCancellation = async (serviceId) => {
    setProcessingCancellationId(serviceId);
    setCancellationError('');

    try {
      const response = await rejectServiceCancellation(serviceId);
      setCancellationMessage(response.message);
    } catch (requestError) {
      setCancellationError(requestError.message);
    } finally {
      setProcessingCancellationId('');
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Operations" title="Approve New Orders" />

      {error ? <div className="mt-6 rounded-2xl border border-orange-400/30 bg-orange-400/10 px-4 py-3 text-sm text-orange-100">{error}</div> : null}
      {message ? <div className="mt-6 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-sm text-sky-100">{message}</div> : null}
      {cancellationError ? <div className="mt-3 rounded-2xl border border-orange-400/30 bg-orange-400/10 px-4 py-2 text-sm text-orange-100">{cancellationError}</div> : null}
      {cancellationMessage ? <div className="mt-3 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-4 py-2 text-sm text-sky-100">{cancellationMessage}</div> : null}


          <div className="mt-6 panel p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Admin Queue</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Pending Orders</h2>
              </div>

              <div className="flex-1 pl-5">
                <div className="grid gap-4 md:grid-cols-1 items-center">
                  <label className="relative block">
                    <span className="sr-only">Search and select client</span>
                    <input type="text" value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Search and select client" className="input pl-11" />
                  </label>
                </div>
              </div>

                  <div className="flex items-center gap-4 ml-4 md:ml-6">
                    <select className="input w-44 md:w-56" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                      <option value="all">All</option>
                      <option value="order">Orders</option>
                      <option value="cancellation">Cancellations</option>
                    </select>

                    <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/70 p-1">
                      <button type="button" onClick={() => setViewMode('grid')} className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${viewMode === 'grid' ? 'bg-orange-400 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`} aria-label="Grid view" title="Grid view">
                        <LayoutGrid size={16} />
                      </button>
                      <button type="button" onClick={() => setViewMode('list')} className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${viewMode === 'list' ? 'bg-orange-400 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`} aria-label="List view" title="List view">
                        <List size={16} />
                      </button>
                    </div>
                  </div>
            </div>

        {typeFilter === 'services' ? (
          <>
            {viewMode === 'list' ? (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-left">
                  <thead className="bg-white/5 text-sm text-slate-400">
                    <tr>
                      <th className="px-5 py-4 font-semibold text-white text-center">
                        <button type="button" onClick={() => handleServicesTableSort('service')} className="inline-flex items-center gap-1 hover:text-sky-200">
                          <span>Service</span>
                          {renderServicesSortIndicator('service')}
                        </button>
                      </th>
                      <th className="px-5 py-4 font-semibold text-white">
                        <button type="button" onClick={() => handleServicesTableSort('client')} className="inline-flex items-center gap-1 hover:text-sky-200">
                          <span>Client</span>
                          {renderServicesSortIndicator('client')}
                        </button>
                      </th>
                      <th className="px-5 py-4 font-semibold text-white">
                        <button type="button" onClick={() => handleServicesTableSort('price')} className="inline-flex items-center gap-1 hover:text-sky-200">
                          <span>Base Price</span>
                          {renderServicesSortIndicator('price')}
                        </button>
                      </th>
                      <th className="px-5 py-4 font-semibold text-white">Add-ons</th>
                      <th className="px-5 py-4 font-semibold text-whit">
                        <button type="button" onClick={() => handleServicesTableSort('status')} className="inline-flex items-center gap-1 hover:text-sky-200">
                          <span>Status</span>
                          {renderServicesSortIndicator('status')}
                        </button>
                      </th>
                      <th className="px-5 py-4 font-semibold text-white text-center w-40">Update Status</th>
                      <th className="px-5 py-4 font-semibold text-white text-center">Cancellation</th>
                      <th className="px-5 py-4 font-semibold text-white text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 bg-transparent text-sm text-slate-200">
                    {sortedServicesForPanel.length ? paginatedServicesForPanel.map((service) => {
                      const hasPendingCancellation = service.cancellationRequest?.statusKey === 'pending';
                      const canQueueCancellation = !hasPendingCancellation && service.status !== 'Expired';

                      return (
                        <tr key={service.id} className="table-row-hoverable">
                          <td className="px-5 py-4 align-top">
                            <p className="font-semibold text-white">{service.name}</p>
                            {getServiceSubtitle(service) ? <p className="mt-1 text-sm text-slate-400">{getServiceSubtitle(service)}</p> : null}
                          </td>
                          <td className="px-5 py-4 align-top">
                            <p className="font-medium text-white">{service.client || 'No client assigned'}</p>
                            {service.clientEmail ? <p className="mt-1 text-sm text-slate-400">{service.clientEmail}</p> : null}
                          </td>
                          <td className="px-5 py-4 align-top">
                            {typeof service.basePrice === 'number' ? (
                              <div>
                                <p className="font-semibold text-sky-300">{formatCurrency(service.basePrice)}</p>
                                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{service.billing ?? '—'}</p>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-500">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4 align-top">
                            {service.addons?.length ? (
                              (() => {
                                const raw = service.addons ?? [];
                                const addons = raw.map((a) => (typeof a === 'string' ? { label: a, price: 0 } : a));

                                return (
                                  <select className="input bg-slate-900 text-slate-200 w-44" defaultValue="" aria-label={`View add-ons for ${service.name}`}>
                                    <option value="" disabled>{`${addons.length} add-on${addons.length > 1 ? 's' : ''}`}</option>
                                    {addons.map((addon, idx) => (
                                      <option key={`${service.id}-addon-${idx}`} value={addon.label}>{addon.label}</option>
                                    ))}
                                  </select>
                                );
                              })()
                            ) : (
                              <span className="text-sm text-slate-500">No add-ons</span>
                            )}
                          </td>

                          <td className="px-5 py-4 align-top">
                            <StatusBadge status={service.status} />
                          </td>
                          <td className="px-5 py-4 align-top">
                            <select className="input w-40" value={service.status} onChange={(event) => updateServiceStatus(service.id, event.target.value)}>
                              {statuses.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-5 py-4 align-top">
                            {service.cancellationRequest ? (
                              <div>
                                <span className="text-sm text-orange-200">{service.cancellationRequest.status}</span>
                                {service.cancellationRequest.reason ? <p className="mt-1 max-w-xs text-xs text-slate-500">{service.cancellationRequest.reason}</p> : null}
                              </div>
                            ) : (
                              <span className="text-sm text-slate-500">No request</span>
                            )}
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => openOrderModal({ serviceName: service.name, id: service.id })} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10" title="View service">
                                <Eye size={16} />
                              </button>
                              <button type="button" onClick={() => handleQueueCancellation(service)} className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border ${canQueueCancellation ? 'border-orange-400/20 bg-orange-400/10 text-orange-100 hover:bg-orange-400/20' : 'border-white/10 bg-white/5 text-slate-100'}`} title="Queue cancellation">
                                <CircleOff size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={8} className="px-5 py-12 text-center text-slate-400">No services match the current filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : sortedServicesForPanel.length ? (
              servicesViewMode === 'list' ? (

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-[1180px] divide-y divide-white/10 text-left">
                    <thead className="bg-white/5 text-sm text-slate-400">
                      <tr>
                        <th className="px-5 py-4 font-semibold text-white whitespace-nowrap">Service</th>
                        <th className="px-5 py-4 font-semibold text-white whitespace-nowrap">Client</th>
                        <th className="px-5 py-4 font-semibold text-white whitespace-nowrap">Total Paid</th>
                        <th className="w-[172px] min-w-[172px] px-4 py-4 font-semibold text-white whitespace-nowrap">Selected Add-ons</th>
                        <th className="px-5 py-4 font-semibold text-white whitespace-nowrap">Status</th>
                        <th className="px-5 py-4 font-semibold text-white whitespace-nowrap">Plan Expiry</th>
                        <th className="px-5 py-4 font-semibold text-white whitespace-nowrap">Update Status</th>
                        <th className="px-5 py-4 font-semibold text-white whitespace-nowrap">Cancellation</th>
                        <th className="px-5 py-4 font-semibold text-white whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 bg-transparent text-sm text-slate-200">
                      {paginatedServicesForPanel.map((service) => {
                        const expirationMeta = getAdminServiceExpirationMeta(service);
                        const purchaseDetails = getServicePurchaseDetails(service);

                        return (
                        <tr key={`panel-${service.id}`} className="table-row-hoverable">
                          <td className="px-5 py-4 align-top">
                            <p className="font-semibold text-white">{service.name}</p>
                            {getServiceSubtitle(service) ? <p className="mt-1 text-sm text-slate-400">{getServiceSubtitle(service)}</p> : null}
                          </td>
                          <td className="px-5 py-4 align-top">
                            <p className="font-medium text-white">{service.client || 'No client assigned'}</p>
                            {service.clientEmail ? <p className="mt-1 text-sm text-slate-400">{service.clientEmail}</p> : null}
                          </td>
                          <td className="px-5 py-4 align-top">
                            {purchaseDetails.totalPaid !== null ? (
                              <button type="button" onClick={() => openServiceBreakdownModal(service)} className="text-left transition hover:text-sky-200">
                                <p className="font-semibold text-sky-300 whitespace-nowrap">{formatCurrency(purchaseDetails.totalPaid)}</p>
                              </button>
                            ) : <span className="text-sm text-slate-500">—</span>}
                          </td>
                          <td className="w-[172px] min-w-[172px] px-4 py-4 align-top">
                            <AddonSummaryButton addonEntries={purchaseDetails.addonEntries} onClick={() => openServiceBreakdownModal(service)} />
                          </td>
                          <td className="px-5 py-4 align-top"><StatusBadge status={service.status} /></td>
                          <td className="px-5 py-4 align-top">
                            <ExpirationMetaCell expirationMeta={expirationMeta} />
                          </td>
                          <td className="px-5 py-4 align-top"><select className="input w-48 whitespace-nowrap" value={service.status} onChange={(e) => updateServiceStatus(service.id, e.target.value)}>{statuses.map((st) => <option key={st} value={st}>{st}</option>)}</select></td>
                          <td className="px-5 py-4 align-top">{service.cancellationRequest ? <span className="text-sm text-orange-200 whitespace-nowrap">{service.cancellationRequest.status}</span> : <span className="text-sm text-slate-500 whitespace-nowrap">No request</span>}</td>
                          <td className="px-5 py-4 align-top">
                            <div className="flex justify-end gap-2 whitespace-nowrap">
                              <button type="button" onClick={() => openOrderModal({ serviceName: service.name, id: service.id })} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100" title="View"><Eye size={16} /></button>
                              <button type="button" onClick={() => openCancellationModal(service)} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/10 text-orange-100" title="Queue cancellation"><CircleOff size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {paginatedServicesForPanel.map((service) => {
                    const purchaseDetails = getServicePurchaseDetails(service);

                    return (
                    <div key={`card-${service.id}`} className="panel p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-medium text-white">{service.name}</p>
                          <p className="mt-1 text-sm text-slate-400">{service.category} · {service.plan}</p>
                        </div>
                        <StatusBadge status={service.status} />
                      </div>

                      <div className="mt-4">
                        <button type="button" onClick={() => openServiceBreakdownModal(service)} className="text-sm text-slate-400 transition hover:text-slate-200">{getAddonSummaryLabel(purchaseDetails.addonEntries)}</button>
                        <button type="button" onClick={() => openServiceBreakdownModal(service)} className="mt-2 block text-xs text-sky-300 transition hover:text-sky-200">{purchaseDetails.totalPaid !== null ? formatCurrency(purchaseDetails.totalPaid) : '—'}</button>
                      </div>

                      <div className="mt-4 flex justify-end gap-2">
                        <button type="button" onClick={() => openOrderModal({ serviceName: service.name, id: service.id })} className="btn-secondary px-3"><Eye size={16} /></button>
                        <button type="button" onClick={() => openCancellationModal(service)} className="btn-secondary border-orange-400/20 bg-orange-400/10 px-3 text-orange-100"><CircleOff size={16} /></button>
                      </div>
                    </div>
                  );})}
                </div>
              )
            ) : (
              <div className="panel mt-6 px-5 py-12 text-center text-sm text-slate-400">No services match the current filters.</div>
            )}
          </>
        ) : (
          viewMode === 'list' ? (
            <div className="mt-4 overflow-x-auto">
            <table className="min-w-[1320px] divide-y divide-white/10 text-left">
                <thead className="bg-white/5 text-sm text-slate-400">
                  <tr>
                    <th className="px-5 py-4 font-semibold text-white">
                      <button type="button" onClick={() => handlePendingTableSort('service')} className="inline-flex items-center gap-1 hover:text-sky-200">
                        <span>Service</span>
                        {renderPendingSortIndicator('service')}
                      </button>
                    </th>
                    <th className="px-5 py-4 font-semibold text-white">
                      <button type="button" onClick={() => handlePendingTableSort('client')} className="inline-flex items-center gap-1 hover:text-sky-200">
                        <span>Client</span>
                        {renderPendingSortIndicator('client')}
                      </button>
                    </th>
                    <th className="px-5 py-4 font-semibold text-white">
                      <button type="button" onClick={() => handlePendingTableSort('amount')} className="inline-flex items-center gap-1 hover:text-sky-200">
                        <span>Amount</span>
                        {renderPendingSortIndicator('amount')}
                      </button>
                    </th>
                    <th className="px-5 py-4 font-semibold text-white">
                      <button type="button" onClick={() => handlePendingTableSort('status')} className="inline-flex items-center gap-1 hover:text-sky-200">
                        <span>Status</span>
                        {renderPendingSortIndicator('status')}
                      </button>
                    </th>
                    <th className="px-5 py-4 font-semibold text-white text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-transparent text-sm text-slate-200">
                  {sortedCombinedPending.length ? sortedCombinedPending.map((row) => (
                    <tr key={row.id} className="table-row-hoverable">
                      <td className="px-5 py-4 align-middle">
                        <p className="font-semibold text-white">{row.serviceName}</p>
                        {row.type === 'order' && row.meta?.date ? <p className="mt-1 text-sm text-slate-400">{formatDate(row.meta.date)} • {row.meta.paymentMethod}</p> : null}
                        {row.type === 'cancellation' && row.meta?.requestedAt ? <p className="mt-1 text-sm text-slate-400">Requested {formatDateTime(row.meta.requestedAt)}</p> : null}
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <p className="font-medium text-white">{row.client}</p>
                      </td>
                      <td className="px-5 py-4 align-middler">
                        {row.amount != null ? <p className="font-semibold text-sky-300">{formatCurrency(row.amount)}</p> : <span className="text-sm text-slate-500">—</span>}
                      </td>
                      <td className="px-5 py-4 align-middle"><StatusBadge status={row.status} /></td>
                      <td className="px-5 py-4 align-middle">
                        <div className="ml-auto grid w-fit grid-cols-[44px_minmax(96px,auto)_minmax(156px,auto)] items-center justify-end gap-3">
                          {row.type === 'order' ? (
                            <>
                              {shouldShowCommentAction(row) ? (
                                <button
                                  type="button"
                                  onClick={() => openOrderNoteModal(row.raw)}
                                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-100 transition hover:bg-sky-400/20"
                                  title="View desired domain comment"
                                  aria-label={`View desired domain comment for ${row.serviceName}`}
                                >
                                  <MessageSquare size={16} />
                                </button>
                              ) : <span className="h-11 w-11" aria-hidden="true" />}
                              <button type="button" onClick={() => openOrderModal(row.raw)} className="btn-secondary min-w-[96px] justify-center">View</button>
                              <button type="button" onClick={() => handleApproveOrder(row.raw.id)} disabled={processingOrderId === row.raw.id} className="inline-flex min-w-[156px] items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-2 text-white disabled:opacity-60 hover:bg-emerald-500">
                                <ShieldCheck size={16} /> {processingOrderId === row.raw.id ? 'Approving...' : 'Approve'}
                              </button>
                            </>
                          ) : (
                            <>
                              {shouldShowCommentAction(row) ? (
                                <button
                                  type="button"
                                  onClick={() => openOrderNoteModal(row.raw)}
                                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-100 transition hover:bg-sky-400/20"
                                  title="View cancellation reason"
                                  aria-label={`View cancellation reason for ${row.serviceName}`}
                                >
                                  <MessageSquare size={16} />
                                </button>
                              ) : <span className="h-11 w-11" aria-hidden="true" />}
                              <button type="button" onClick={() => handleRejectCancellation(row.raw.id)} disabled={processingCancellationId === row.raw.id} className="inline-flex min-w-[156px] items-center justify-center gap-2 rounded-2xl bg-rose-400 px-4 py-2 text-white disabled:opacity-60 hover:bg-rose-500">
                                <XCircle size={16} /> Keep Service
                              </button>
                              <button type="button" onClick={() => handleApproveCancellation(row.raw.id)} disabled={processingCancellationId === row.raw.id} className="inline-flex min-w-[156px] items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-2 text-white disabled:opacity-60 hover:bg-emerald-500">
                                <CheckCircle2 size={16} /> {processingCancellationId === row.raw.id ? 'Approving...' : 'Approve Cancellation'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-slate-400">No pending items match the current filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : sortedCombinedPending.length ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sortedCombinedPending.map((row) => (
                <div key={row.id} className="panel p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-medium text-white">{row.serviceName}</p>
                      <p className="mt-1 text-sm text-slate-400">{row.client}</p>
                    </div>
                    <StatusBadge status={row.status} />
                  </div>
                  <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{row.type === 'order' ? 'Amount' : 'Requested'}</p>
                    <p className="mt-2 text-sm text-sky-200">{row.type === 'order' ? formatCurrency(row.amount) : (row.meta.requestedAt ? formatDateTime(row.meta.requestedAt) : '—')}</p>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2 text-right">
                    {row.type === 'order' ? (
                      <>
                        {shouldShowCommentAction(row) ? (
                          <button
                            type="button"
                            onClick={() => openOrderNoteModal(row.raw)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-100 transition hover:bg-sky-400/20"
                            title="View desired domain comment"
                            aria-label={`View desired domain comment for ${row.serviceName}`}
                          >
                            <MessageSquare size={16} />
                          </button>
                        ) : null}
                        <button type="button" onClick={() => openOrderModal(row.raw)} className="btn-secondary min-w-[96px] justify-center px-3">View</button>
                        <button type="button" onClick={() => handleApproveOrder(row.raw.id)} disabled={processingOrderId === row.raw.id} className="btn-primary min-w-[140px] justify-center px-3">{processingOrderId === row.raw.id ? 'Approving...' : 'Approve'}</button>
                      </>
                    ) : (
                      <>
                        {shouldShowCommentAction(row) ? (
                          <button
                            type="button"
                            onClick={() => openOrderNoteModal(row.raw)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-100 transition hover:bg-sky-400/20"
                            title="View cancellation reason"
                            aria-label={`View cancellation reason for ${row.serviceName}`}
                          >
                            <MessageSquare size={16} />
                          </button>
                        ) : null}
                        <button type="button" onClick={() => handleRejectCancellation(row.raw.id)} disabled={processingCancellationId === row.raw.id} className="btn-secondary min-w-[140px] justify-center px-3">Keep Service</button>
                        <button type="button" onClick={() => handleApproveCancellation(row.raw.id)} disabled={processingCancellationId === row.raw.id} className="btn-primary min-w-[140px] justify-center px-3">{processingCancellationId === row.raw.id ? 'Approving...' : 'Approve'}</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="panel-muted rounded-3xl p-4 text-sm text-slate-400 mt-4">No pending items match the current filters.</div>
          )
        )}
          </div>

      {showDiscountModal && discountTargetService ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <form onSubmit={handleApplyDiscount} className="panel w-full max-w-md p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Apply Product Discount</p>
                <h2 className="mt-2 text-lg font-semibold text-white">{discountTargetService.name}</h2>
              </div>
              <button type="button" onClick={closeDiscountModal} className="btn-secondary px-3">Close</button>
            </div>

            <div className="mt-4 grid gap-4">
              <label className="block text-sm text-slate-300">
                Discount Type
                <select className="input mt-2" value={discountForm.type} onChange={(e) => setDiscountForm((c) => ({ ...c, type: e.target.value }))}>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount</option>
                </select>
              </label>

              <label className="block text-sm text-slate-300">
                Value
                <input className="input mt-2" value={discountForm.value} onChange={(e) => setDiscountForm((c) => ({ ...c, value: e.target.value }))} placeholder="e.g. 10" />
              </label>

              <label className="block text-sm text-slate-300">
                Expiry Date
                <input type="date" className="input mt-2" value={discountForm.expiresOn} onChange={(e) => setDiscountForm((c) => ({ ...c, expiresOn: e.target.value }))} />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeDiscountModal} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Activate Discount</button>
            </div>
          </form>
        </div>
      ) : null}

      {showPricingLogsModal && pricingLogsService ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="panel w-full max-w-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Pricing Logs</p>
                <h2 className="mt-2 text-lg font-semibold text-white">{pricingLogsService.name}</h2>
              </div>
              <button type="button" onClick={closePricingLogs} className="btn-secondary px-3">Close</button>
            </div>

            <div className="mt-6 overflow-auto">
              {Array.isArray(pricingLogsService.priceHistory) && pricingLogsService.priceHistory.length ? (
                <table className="min-w-full text-left text-sm text-slate-200">
                  <thead className="text-slate-400">
                    <tr>
                      <th className="px-4 py-2">Change Date</th>
                      <th className="px-4 py-2">Old Price</th>
                      <th className="px-4 py-2">New Price</th>
                      <th className="px-4 py-2">Changed By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricingLogsService.priceHistory.map((row, idx) => (
                      <tr key={idx} className="border-t border-white/6">
                        <td className="px-4 py-3 text-slate-300">{row.date}</td>
                        <td className="px-4 py-3">{row.old}</td>
                        <td className="px-4 py-3">{row.new}</td>
                        <td className="px-4 py-3">{row.by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-sm text-slate-400">No pricing logs available for this service.</div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button type="button" onClick={closePricingLogs} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedServiceBreakdown ? (() => {
        const breakdownDetails = getServicePurchaseDetails(selectedServiceBreakdown);
        const expirationMeta = getAdminServiceExpirationMeta(selectedServiceBreakdown);
        const purchaseRecord = breakdownDetails.lineItem ?? breakdownDetails.purchase;

        return (
          <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onClick={closeServiceBreakdownModal}>
            <div className="panel max-h-[88vh] w-full max-w-3xl overflow-hidden p-6" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Client Service Details</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{selectedServiceBreakdown.name}</h2>
                  <p className="mt-2 text-sm text-slate-400">{selectedServiceBreakdown.client || selectedServiceBreakdown.clientEmail || 'No client assigned'} • {selectedServiceBreakdown.category} • {selectedServiceBreakdown.plan}</p>
                  {purchaseRecord ? <p className="mt-1 text-xs text-slate-500">Recorded {formatDateTime(purchaseRecord.date ?? purchaseRecord.createdAt ?? purchaseRecord.updatedAt)}</p> : null}
                </div>
                <button type="button" onClick={closeServiceBreakdownModal} className="btn-secondary px-4">Close</button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="panel-muted rounded-3xl p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Customer Paid Total</p>
                  <p className="mt-2 text-xl font-semibold text-sky-300">{breakdownDetails.totalPaid !== null ? formatCurrency(breakdownDetails.totalPaid) : '—'}</p>
                  <p className="mt-2 text-xs text-slate-500">{selectedServiceBreakdown.billing ?? 'Billing cycle not set'}</p>
                </div>
                <div className="panel-muted rounded-3xl p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Plan Expiry Countdown</p>
                  <p className={`mt-2 text-xl font-semibold ${expirationMeta.isExpired ? 'text-rose-300' : 'text-white'}`}>{expirationMeta.value}</p>
                  <p className={`mt-2 text-xs ${expirationMeta.isExpired ? 'text-rose-300' : 'text-slate-500'}`}>{expirationMeta.helper}</p>
                </div>
                <div className="panel-muted rounded-3xl p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Selected Add-ons</p>
                  <p className="mt-2 text-xl font-semibold text-white">{breakdownDetails.addonEntries.length}</p>
                  <p className="mt-2 text-xs text-slate-500">{getAddonSummaryLabel(breakdownDetails.addonEntries)}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-[0.95fr_1.05fr]">
                <div className="panel-muted rounded-3xl p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Pricing Summary</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-4">
                      <span>Base plan</span>
                      <span className="font-medium text-white">{breakdownDetails.basePlanPrice !== null ? formatCurrency(breakdownDetails.basePlanPrice) : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Add-ons total</span>
                      <span className="font-medium text-white">{breakdownDetails.addonEntries.length ? formatCurrency(breakdownDetails.addonTotal) : formatCurrency(0)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-3">
                      <span className="font-semibold text-white">Customer paid</span>
                      <span className="font-semibold text-sky-300">{breakdownDetails.totalPaid !== null ? formatCurrency(breakdownDetails.totalPaid) : '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="panel-muted rounded-3xl p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Selected Add-ons</p>
                  <div className="mt-4 space-y-3">
                    {breakdownDetails.addonEntries.length ? breakdownDetails.addonEntries.map((addonEntry) => (
                      <div key={`${selectedServiceBreakdown.id}-${addonEntry.label}`} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-white">{addonEntry.label}</p>
                          <p className="mt-1 text-xs text-slate-500">Included in the customer order</p>
                        </div>
                        <p className="text-sm font-semibold text-sky-300">{typeof addonEntry.price === 'number' ? formatCurrency(addonEntry.price) : '—'}</p>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-400">
                        No selected add-ons were recorded for this service.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })() : null}

      {selectedCancellationService ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <form onSubmit={handleQueueCancellation} className="panel w-full max-w-xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Cancellation Queue</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{selectedCancellationService.name}</h2>
                <p className="mt-2 text-sm text-slate-400">Queue this service for cancellation approval and add context for the review team.</p>
              </div>
              <button type="button" onClick={closeCancellationModal} className="btn-secondary px-4">Close</button>
            </div>

            <label className="mt-6 block text-sm text-slate-300">
              Cancellation reason (optional)
              <textarea rows={4} value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} className="input mt-2 min-h-28 resize-y" placeholder="Add a short note explaining why this service should be cancelled." />
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeCancellationModal} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={isQueueingCancellation} className="btn-primary disabled:opacity-60">
                {isQueueingCancellation ? 'Queueing...' : 'Queue Cancellation'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {showClientProfile && (function renderClientProfile() {
        const client = clients.find((c) => c.id === selectedClientId);
        if (!client) return null;

        const relatedServices = adminServices.filter((s) => s.clientEmail === client.email || s.client === client.name);
        const relatedPurchases = adminPurchases.filter((p) => p.client === client.name);
        const totalSpent = relatedPurchases.reduce((sum, p) => sum + (p.amount || 0), 0);

        return createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
            <div className="panel max-h-[88vh] w-full max-w-5xl overflow-hidden">
              <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 md:flex-row md:items-start md:justify-between">
                <div className="flex items-center gap-4">
                  <UserAvatar user={client} size="h-16 w-16" textSize="text-2xl" />
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Client Profile</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">{client.name}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
                      <span>Joined {formatDateTime(client.joinedAt)}</span>
                      <StatusBadge status={client.status} />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => openBillingModal(client)} className="btn-secondary">
                    <PencilLine size={16} /> Edit Billing Details
                  </button>
                  <button type="button" onClick={() => setShowClientProfile(false)} className="btn-secondary px-4">Close</button>
                </div>
              </div>

              <div className="max-h-[calc(88vh-110px)] space-y-6 overflow-y-auto px-6 py-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <div className="panel-muted rounded-3xl p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Client Name</p>
                    <p className="mt-2 text-sm font-medium text-white">{client.name}</p>
                  </div>
                  <div className="panel-muted rounded-3xl p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Email</p>
                    <p className="mt-2 text-sm font-medium text-white">{client.email}</p>
                  </div>
                  <div className="panel-muted rounded-3xl p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Company</p>
                    <p className="mt-2 text-sm font-medium text-white">{client.company || 'Not set'}</p>
                  </div>
                  <div className="panel-muted rounded-3xl p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Address</p>
                    <p className="mt-2 text-sm font-medium text-white">{client.address || 'Not set'}</p>
                  </div>
                  <div className="panel-muted rounded-3xl p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Contact</p>
                    <p className="mt-2 text-sm font-medium text-white">{client.mobileNumber || 'Not set'}</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="panel-muted rounded-3xl p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Services Availed</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{relatedServices.length}</p>
                  </div>
                  <div className="panel-muted rounded-3xl p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Orders</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{relatedPurchases.length}</p>
                  </div>
                  <div className="panel-muted rounded-3xl p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total Spent</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(totalSpent)}</p>
                  </div>
                </div>
                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Client Services</p>
                      <h3 className="mt-2 text-lg font-semibold text-white">Services availed</h3>
                    </div>

                    <div className="mt-4 space-y-3">
                      {relatedServices.length ? relatedServices.map((service) => {
                        const expirationMeta = getAdminServiceExpirationMeta(service);
                        const purchaseDetails = getServicePurchaseDetails(service);

                        return (
                          <div key={service.id} className="panel-muted rounded-3xl p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="font-medium text-white">{service.name}</p>
                                <p className="mt-1 text-sm text-slate-400">{service.category} • {service.plan}</p>
                                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                                  <button type="button" onClick={() => openServiceBreakdownModal(service)} className="text-sky-300 transition hover:text-sky-200">
                                    Total paid: {purchaseDetails.totalPaid !== null ? formatCurrency(purchaseDetails.totalPaid) : '—'}
                                  </button>
                                  <button type="button" onClick={() => openServiceBreakdownModal(service)} className="transition hover:text-slate-200">
                                    Add-ons: {getAddonSummaryLabel(purchaseDetails.addonEntries)}
                                  </button>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-3 md:justify-end">
                                <StatusBadge status={service.status} />
                                <div className="text-left md:text-right">
                                  <p className="text-xs text-slate-500">{expirationMeta.value}</p>
                                  <p className={`mt-1 text-xs ${expirationMeta.isExpired ? 'text-rose-300' : 'text-slate-500'}`}>{expirationMeta.helper}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }) : (
                        <div className="panel-muted rounded-3xl p-4 text-sm text-slate-400">No services are currently linked to this client.</div>
                      )}
                    </div>
                  </section>

                  <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Billing Profile</p>
                      <h3 className="mt-2 text-lg font-semibold text-white">Client information</h3>
                    </div>

                    <div className="mt-4 space-y-3">
                      {[
                        { label: 'Billing Email', value: client.email },
                        { label: 'Billing Address', value: client.address || 'Not set' },
                        { label: 'TIN', value: client.tin || 'Not set' },
                        { label: 'Contact Number', value: client.mobileNumber || 'Not set' },
                      ].map((item) => (
                        <div key={item.label} className="panel-muted rounded-3xl p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                          <p className="mt-2 text-sm font-medium text-white">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>, document.body
        );
      })()}

      {billingModalClient ? createPortal(
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <form onSubmit={handleSaveBilling} className="panel w-full max-w-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Billing Profile</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{billingModalClient.name}</h2>
                <p className="mt-2 text-sm text-slate-400">Update billing details for this client.</p>
              </div>
              <button type="button" onClick={closeBillingModal} className="btn-secondary px-4">Close</button>
            </div>

            <div className="mt-6 grid gap-x-4 gap-y-3 md:grid-cols-2 items-start">
              <label className="block text-sm text-slate-300">
                Company
                <input className="input mt-2" value={billingForm.company} onChange={(e) => setBillingForm((c) => ({ ...c, company: e.target.value }))} />
              </label>

              <label className="block text-sm text-slate-300">
                Email
                <input className="input mt-2" value={billingForm.email} onChange={(e) => setBillingForm((c) => ({ ...c, email: e.target.value }))} />
              </label>

              <label className="block text-sm text-slate-300 md:col-span-2">
                Address
                <input className="input mt-2" value={billingForm.address} onChange={(e) => setBillingForm((c) => ({ ...c, address: e.target.value }))} />
              </label>

              <label className="block text-sm text-slate-300">
                TIN
                <input className="input mt-2" value={billingForm.tin} onChange={(e) => setBillingForm((c) => ({ ...c, tin: e.target.value }))} />
              </label>

              <label className="block text-sm text-slate-300">
                Mobile Number
                <input className="input mt-2" value={billingForm.mobileNumber} onChange={(e) => setBillingForm((c) => ({ ...c, mobileNumber: e.target.value }))} />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeBillingModal} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={isSavingBilling} className="btn-primary disabled:opacity-60">{isSavingBilling ? 'Saving...' : 'Save Billing Details'}</button>
            </div>
          </form>
        </div>, document.body) : null}

      {showOrderNoteModal && selectedOrderForNote ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="panel w-full max-w-lg p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Customer Comment</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{selectedOrderForNoteTitle}</h2>
                <p className="mt-2 text-sm text-slate-400">{selectedOrderForNoteIsCancellation ? 'Cancellation reason submitted by the customer.' : 'Desired domain details submitted during checkout.'}</p>
              </div>
              <button type="button" onClick={closeOrderNoteModal} className="btn-secondary px-4">Close</button>
            </div>

            <div className="panel-muted mt-6 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{selectedOrderForNoteIsCancellation ? 'Cancellation Reason / Customer Note' : 'Desired Domain / Customer Note'}</p>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-300">
                {selectedOrderActionNote || (selectedOrderForNoteIsCancellation ? 'No cancellation reason was saved for this request.' : 'No desired domain comment was saved for this order.')}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {showOrderModal && selectedOrderForReview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="panel w-full max-w-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Order Review</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{selectedOrderForReview.serviceName}</h2>
                <p className="mt-2 text-sm text-slate-400">Review order details and uploaded proof before approving.</p>
              </div>
              <button type="button" onClick={closeOrderModal} className="btn-secondary px-4">Close</button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="panel-muted p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Order ID</p>
                <p className="mt-2 text-lg font-medium text-white">{selectedOrderForReview.id}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">Client</p>
                <p className="mt-2 text-sm text-slate-300">{selectedOrderForReview.client}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">Amount</p>
                <p className="mt-2 text-lg font-semibold text-sky-200">{formatCurrency(selectedOrderForReview.amount)}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">Payment Method</p>
                <p className="mt-2 text-sm text-slate-300">{selectedOrderForReview.paymentMethod}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">Recorded Date</p>
                <p className="mt-2 text-sm text-slate-300">{formatDate(selectedOrderForReview.date)}</p>
              </div>

              <div className="panel-muted p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Payment proof</p>
                <p className="mt-2 text-sm text-slate-400">Open external proof links from the orders list to review uploaded files.</p>
              </div>
            </div>

            {selectedOrderReviewNote ? (
              <div className="panel-muted mt-4 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Customer Note / Desired Domain</p>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-300">{selectedOrderReviewNote}</p>
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={async () => { await handleApproveOrder(selectedOrderForReview.id); closeOrderModal(); }} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 text-white px-4 py-2 hover:bg-emerald-500">
                <ShieldCheck size={16} /> Approve Order
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
