import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, CircleOff, Clock3, Eye, LayoutGrid, List, PencilLine, Percent, ReceiptText } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import UserAvatar from '../../components/common/UserAvatar';
import StatusBadge from '../../components/common/StatusBadge';
import { usePortal } from '../../context/PortalContext';
import { clientMatchesRecord, findClientByRecord } from '../../utils/clients';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { getAddonBillingCycle, getAddonBillingCycleLabel, getAddonExpirationMeta } from '../../utils/addons';
import { getCancellationReasonValue } from '../../utils/orders';
import { formatRenewalCountdownTimer, getAdminServiceExpirationMeta, getServiceDisplayStatus } from '../../utils/services';

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
  const serviceBillingCycle = service?.billingCycle ?? service?.billing?.cycle ?? service?.billing ?? '';

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
      billingCycle: getAddonBillingCycle(option, serviceBillingCycle) || null,
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
        billingCycle: getAddonBillingCycle(entry, catalogMatch?.billingCycle ?? '') || (catalogMatch?.billingCycle ?? null),
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

  return (bestMatch ?? []).map(({ label, price, billingCycle }) => ({ label, price, billingCycle }));
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

const EXPIRING_SOON_MS = 7 * 24 * 60 * 60 * 1000;
const EXPIRING_URGENT_MS = 3 * 24 * 60 * 60 * 1000;
const PENDING_ORDER_STATUSES = new Set(['pending', 'pending review', 'pending approval']);
const ATTENTION_FILTER_LABELS = {
  all: 'All services',
  'needs-attention': 'services needing attention',
  'expiring-soon': 'services expiring soon',
  'pending-orders': 'services with pending customer orders',
};

const getServiceClientLabel = (service) => service?.client || service?.clientEmail || 'No client assigned';

const getServiceClientIdentity = (service) => normalizeMatchText(service?.clientEmail ?? service?.client ?? service?.id ?? '');

const purchaseMatchesService = (service, purchase) => {
  if (!clientMatchesPurchase(service, purchase)) {
    return false;
  }

  const lineItems = collectPurchaseLineItems(purchase);

  return lineItems.some((entry) => serviceMatchesPurchaseRecord(service, entry)) || serviceMatchesPurchaseRecord(service, purchase);
};

const getServiceAttentionMeta = (service, pendingOrders = [], now = Date.now()) => {
  const expirationMeta = getAdminServiceExpirationMeta(service, now);
  const serviceDisplayStatus = getServiceDisplayStatus(service, now);
  const renewalTime = service?.renewsOn ? new Date(service.renewsOn).getTime() : null;
  const hasRenewalSchedule = renewalTime !== null && !Number.isNaN(renewalTime) && serviceDisplayStatus !== 'Undergoing Provisioning';
  const timeUntilExpiry = hasRenewalSchedule ? renewalTime - now : null;
  const isExpiringSoon = serviceDisplayStatus === 'Expiring Soon';
  const isUrgentExpiration = isExpiringSoon && timeUntilExpiry !== null && timeUntilExpiry > 0 && timeUntilExpiry <= EXPIRING_URGENT_MS;
  const pendingOrderCount = pendingOrders.length;

  return {
    expirationMeta,
    serviceDisplayStatus,
    timeUntilExpiry,
    isExpiringSoon,
    isUrgentExpiration,
    expirationCountdown: isExpiringSoon ? formatRenewalCountdownTimer(service?.renewsOn, now) : expirationMeta.value,
    hasPendingOrder: pendingOrderCount > 0,
    pendingOrderCount,
    pendingOrderLabel: pendingOrderCount === 1 ? '1 pending order' : `${pendingOrderCount} pending orders`,
    needsAttention: isExpiringSoon || pendingOrderCount > 0,
  };
};

const AttentionPill = ({ tone = 'info', children }) => {
  const toneClasses = {
    danger: 'border-rose-200 bg-rose-50 text-rose-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    info: 'border-sky-200 bg-sky-50 text-sky-700',
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${toneClasses[tone] ?? toneClasses.info}`}>
      {children}
    </span>
  );
};

const AttentionSummaryCard = ({ title, count, description, icon: Icon, tone = 'info', isActive, onClick }) => {
  const iconToneClasses = {
    danger: 'border-rose-200 bg-rose-50 text-rose-600',
    warning: 'border-amber-200 bg-amber-50 text-amber-600',
    info: 'border-sky-200 bg-sky-50 text-sky-600',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={`rounded-3xl border p-5 text-left transition ${isActive ? 'border-sky-300/30 bg-sky-300/10 shadow-sm shadow-sky-950/5' : 'border-white/10 bg-white/5 hover:border-sky-300/20 hover:bg-white/10'}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-semibold text-white">{count}</p>
        </div>
        <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border ${iconToneClasses[tone] ?? iconToneClasses.info}`}>
          <Icon size={18} strokeWidth={2.25} />
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-300">{description}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">{isActive ? 'Focused view' : 'Click to show all'}</span>
        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${isActive ? 'bg-sky-400 text-white' : 'bg-white/10 text-slate-300'}`}>
          {isActive ? 'Showing' : 'Show all'}
        </span>
      </div>
    </button>
  );
};

const ServiceAttentionBadges = ({ attentionMeta, className = '' }) => {
  if (!attentionMeta?.needsAttention) {
    return null;
  }

  return (
    <div className={`${className} flex flex-wrap gap-2`.trim()}>
      {attentionMeta.isExpiringSoon ? (
        <AttentionPill tone={attentionMeta.isUrgentExpiration ? 'danger' : 'warning'}>
          {attentionMeta.expirationCountdown}
        </AttentionPill>
      ) : null}
      {attentionMeta.hasPendingOrder ? (
        <AttentionPill tone="info">
          {attentionMeta.pendingOrderLabel}
        </AttentionPill>
      ) : null}
    </div>
  );
};

export default function ClientServicesPage() {
  const { adminPurchases, clients, adminServices, requestServiceCancellation, updateClientBilling, updateServiceStatus } = usePortal();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountTargetService, setDiscountTargetService] = useState(null);
  const [discountForm, setDiscountForm] = useState({ type: 'percentage', value: '', expiresOn: '' });
  const [showPricingLogsModal, setShowPricingLogsModal] = useState(false);
  const [pricingLogsService, setPricingLogsService] = useState(null);
  const [selectedServiceBreakdown, setSelectedServiceBreakdown] = useState(null);
  const [selectedCancellationService, setSelectedCancellationService] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isQueueingCancellation, setIsQueueingCancellation] = useState(false);
  const [cancellationMessage, setCancellationMessage] = useState('');
  const [cancellationError, setCancellationError] = useState('');
  const [showClientProfile, setShowClientProfile] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [billingModalClient, setBillingModalClient] = useState(null);
  const [billingForm, setBillingForm] = useState({ company: '', email: '', address: '', tin: '', mobileNumber: '' });
  const [isSavingBilling, setIsSavingBilling] = useState(false);
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const [servicesSearchQuery, setServicesSearchQuery] = useState('');
  const [servicesStatusFilter, setServicesStatusFilter] = useState('All');
  const [attentionFilter, setAttentionFilter] = useState('all');
  const [servicesViewMode, setServicesViewMode] = useState('grid');
  const [servicesTableSort, setServicesTableSort] = useState({ key: 'service', direction: 'asc' });
  const [servicesPage, setServicesPage] = useState(1);
  const SERVICES_PER_PAGE = 10;
  const filterStatuses = ['Active', 'Expiring Soon', 'Expired', 'Unpaid', 'Undergoing Provisioning'];
  const updateStatuses = ['Active', 'Expired', 'Unpaid', 'Undergoing Provisioning'];

  useEffect(() => {
    if (!adminServices.some((service) => service?.renewsOn)) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 60 * 1000);

    return () => window.clearInterval(timerId);
  }, [adminServices]);

  const filteredServicesForPanel = useMemo(() => {
    const normalized = servicesSearchQuery.trim().toLowerCase();

    return adminServices.filter((service) => {
      const serviceDisplayStatus = getServiceDisplayStatus(service, countdownNow);
      const matchesSearch = !normalized || [service.name, service.category, service.plan, service.client, service.clientEmail]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalized));
      const matchesStatus = servicesStatusFilter === 'All' || serviceDisplayStatus === servicesStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [adminServices, countdownNow, servicesSearchQuery, servicesStatusFilter]);

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

  const sortedFilteredServicesForPanel = useMemo(() => {
    const list = [...filteredServicesForPanel];
    const directionMultiplier = servicesTableSort.direction === 'asc' ? 1 : -1;
    const getPrice = (service) => (typeof service.basePrice === 'number' ? service.basePrice : 0);

    return list.sort((left, right) => {
      if (servicesTableSort.key === 'client') {
        return String(left.client ?? left.clientEmail ?? '').localeCompare(String(right.client ?? right.clientEmail ?? '')) * directionMultiplier;
      }

      if (servicesTableSort.key === 'price') {
        return (getPrice(left) - getPrice(right)) * directionMultiplier;
      }

      if (servicesTableSort.key === 'status') {
        return getServiceDisplayStatus(left, countdownNow).localeCompare(getServiceDisplayStatus(right, countdownNow)) * directionMultiplier;
      }

      return String(left.name ?? '').localeCompare(String(right.name ?? '')) * directionMultiplier;
    });
  }, [countdownNow, filteredServicesForPanel, servicesTableSort]);

  const servicePurchaseDetailsById = useMemo(() => {
    return new Map(
      adminServices.map((service) => [String(service.id), buildServicePurchaseDetails(service, adminPurchases)]),
    );
  }, [adminPurchases, adminServices]);

  const getServicePurchaseDetails = (service) => servicePurchaseDetailsById.get(String(service.id)) ?? buildServicePurchaseDetails(service, []);

  const pendingOrdersByServiceId = useMemo(() => {
    const pendingPurchases = adminPurchases.filter((purchase) => PENDING_ORDER_STATUSES.has(normalizeMatchText(purchase?.status)));

    return new Map(
      adminServices.map((service) => [
        String(service.id),
        pendingPurchases.filter((purchase) => purchaseMatchesService(service, purchase)),
      ]),
    );
  }, [adminPurchases, adminServices]);

  const serviceAttentionById = useMemo(() => {
    return new Map(
      adminServices.map((service) => [
        String(service.id),
        getServiceAttentionMeta(service, pendingOrdersByServiceId.get(String(service.id)) ?? [], countdownNow),
      ]),
    );
  }, [adminServices, countdownNow, pendingOrdersByServiceId]);

  const attentionSummary = useMemo(() => {
    const entries = filteredServicesForPanel.map((service) => ({
      service,
      attentionMeta: serviceAttentionById.get(String(service.id)) ?? getServiceAttentionMeta(service, [], countdownNow),
    }));

    const needsAttentionEntries = entries.filter(({ attentionMeta }) => attentionMeta.needsAttention);
    const expiringSoonEntries = entries
      .filter(({ attentionMeta }) => attentionMeta.isExpiringSoon)
      .sort((left, right) => (left.attentionMeta.timeUntilExpiry ?? Number.MAX_SAFE_INTEGER) - (right.attentionMeta.timeUntilExpiry ?? Number.MAX_SAFE_INTEGER));
    const pendingOrderEntries = entries.filter(({ attentionMeta }) => attentionMeta.hasPendingOrder);
    const affectedClients = new Set(needsAttentionEntries.map(({ service }) => getServiceClientIdentity(service)).filter(Boolean));
    const nextExpiring = expiringSoonEntries[0] ?? null;
    const totalPendingOrders = pendingOrderEntries.reduce((sum, { attentionMeta }) => sum + attentionMeta.pendingOrderCount, 0);

    return {
      needsAttentionCount: needsAttentionEntries.length,
      affectedClientCount: affectedClients.size,
      expiringSoonCount: expiringSoonEntries.length,
      nextExpiringLabel: nextExpiring
        ? `${getServiceClientLabel(nextExpiring.service)} • ${nextExpiring.attentionMeta.expirationCountdown}`
        : 'No services due in the next 7 days.',
      totalPendingOrders,
      servicesWithPendingOrdersCount: pendingOrderEntries.length,
      pendingOrdersLabel: pendingOrderEntries.length
        ? `${pendingOrderEntries.length} service${pendingOrderEntries.length === 1 ? '' : 's'} linked to ${totalPendingOrders} pending customer order${totalPendingOrders === 1 ? '' : 's'}.`
        : 'No matched customer orders waiting for review.',
    };
  }, [filteredServicesForPanel, serviceAttentionById]);

  const visibleServicesForPanel = useMemo(() => {
    if (attentionFilter === 'all') {
      return sortedFilteredServicesForPanel;
    }

    return sortedFilteredServicesForPanel.filter((service) => {
      const attentionMeta = serviceAttentionById.get(String(service.id)) ?? getServiceAttentionMeta(service, [], countdownNow);

      if (attentionFilter === 'needs-attention') {
        return attentionMeta.needsAttention;
      }

      if (attentionFilter === 'expiring-soon') {
        return attentionMeta.isExpiringSoon;
      }

      if (attentionFilter === 'pending-orders') {
        return attentionMeta.hasPendingOrder;
      }

      return true;
    });
  }, [attentionFilter, serviceAttentionById, sortedFilteredServicesForPanel]);

  const servicesTotalPages = Math.max(1, Math.ceil(visibleServicesForPanel.length / SERVICES_PER_PAGE));

  const paginatedServicesForPanel = useMemo(() => {
    const startIndex = (servicesPage - 1) * SERVICES_PER_PAGE;
    return visibleServicesForPanel.slice(startIndex, startIndex + SERVICES_PER_PAGE);
  }, [visibleServicesForPanel, servicesPage]);

  useEffect(() => {
    setServicesPage(1);
  }, [servicesSearchQuery, servicesStatusFilter, servicesViewMode, attentionFilter, visibleServicesForPanel.length]);

  const findClientForService = (service) => findClientByRecord(clients, service.client, service.clientEmail);

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

  const handleApplyDiscount = (event) => {
    event.preventDefault();
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

  const handleAttentionFilterChange = (nextFilter) => {
    setAttentionFilter((current) => (current === nextFilter ? 'all' : nextFilter));
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

    if (!billingModalClient) {
      return;
    }

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
    event.preventDefault();

    if (!selectedCancellationService) {
      return;
    }

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

  const clientServicesHeaderAction = (
    <div className="flex w-full justify-end">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <label className="block w-full sm:w-[320px]">
          <span className="sr-only">Search services</span>
          <input
            type="text"
            value={servicesSearchQuery}
            onChange={(event) => setServicesSearchQuery(event.target.value)}
            placeholder="Search service, client, plan, or category"
            className="input w-full"
          />
        </label>

        <select className="input w-full sm:w-[180px]" value={servicesStatusFilter} onChange={(event) => setServicesStatusFilter(event.target.value)}>
          <option value="All">All statuses</option>
          {filterStatuses.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>

        <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/70 p-1">
          <button type="button" onClick={() => setServicesViewMode('grid')} className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${servicesViewMode === 'grid' ? 'bg-orange-400 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`} aria-label="Grid view" title="Grid view">
            <LayoutGrid size={16} />
          </button>
          <button type="button" onClick={() => setServicesViewMode('list')} className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${servicesViewMode === 'list' ? 'bg-orange-400 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`} aria-label="List view" title="List view">
            <List size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Client Services"
        action={clientServicesHeaderAction}
      />

      {error ? <div className="mt-6 rounded-2xl border border-orange-400/30 bg-orange-400/10 px-4 py-3 text-sm text-orange-100">{error}</div> : null}
      {message ? <div className="mt-6 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-sm text-sky-100">{message}</div> : null}
      {cancellationError ? <div className="mt-3 rounded-2xl border border-orange-400/30 bg-orange-400/10 px-4 py-2 text-sm text-orange-100">{cancellationError}</div> : null}
      {cancellationMessage ? <div className="mt-3 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-4 py-2 text-sm text-sky-100">{cancellationMessage}</div> : null}

      <div className="mt-4 panel p-8">
        <div className="grid gap-4 md:grid-cols-3">
          <AttentionSummaryCard
            title="Needs Attention"
            count={attentionSummary.needsAttentionCount}
            description={attentionSummary.needsAttentionCount
              ? `${attentionSummary.affectedClientCount} client${attentionSummary.affectedClientCount === 1 ? '' : 's'} need a closer review.`
              : 'No services currently need a closer review.'}
            icon={AlertTriangle}
            tone="warning"
            isActive={attentionFilter === 'needs-attention'}
            onClick={() => handleAttentionFilterChange('needs-attention')}
          />

          <AttentionSummaryCard
            title="Expiring Soon"
            count={attentionSummary.expiringSoonCount}
            description={attentionSummary.nextExpiringLabel}
            icon={Clock3}
            tone="danger"
            isActive={attentionFilter === 'expiring-soon'}
            onClick={() => handleAttentionFilterChange('expiring-soon')}
          />

          <AttentionSummaryCard
            title="Pending Customer Orders"
            count={attentionSummary.totalPendingOrders}
            description={attentionSummary.pendingOrdersLabel}
            icon={ReceiptText}
            tone="info"
            isActive={attentionFilter === 'pending-orders'}
            onClick={() => handleAttentionFilterChange('pending-orders')}
          />
        </div>

        {attentionFilter !== 'all' ? (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-200">
              Showing {ATTENTION_FILTER_LABELS[attentionFilter] ?? ATTENTION_FILTER_LABELS.all}.
            </p>
            <button type="button" onClick={() => setAttentionFilter('all')} className="btn-secondary px-4 py-2">
              Show all services
            </button>
          </div>
        ) : null}

        {servicesViewMode === 'list' ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left">
              <thead className="bg-white/5 text-sm text-slate-400">
                <tr>
                  <th className="px-5 py-4 font-semibold text-white">
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
                      <span>Total Paid</span>
                      {renderServicesSortIndicator('price')}
                    </button>
                  </th>
                  <th className="w-[172px] min-w-[172px] px-4 py-4 font-semibold text-white whitespace-nowrap">Selected Add-ons</th>
                  <th className="px-5 py-4 font-semibold text-white">
                    <button type="button" onClick={() => handleServicesTableSort('status')} className="inline-flex items-center gap-1 hover:text-sky-200">
                      <span>Status</span>
                      {renderServicesSortIndicator('status')}
                    </button>
                  </th>
                  <th className="px-5 py-4 font-semibold text-white whitespace-nowrap">Plan Expiry</th>
                  <th className="px-5 py-4 font-semibold text-white whitespace-nowrap">Update Status</th>
                  <th className="px-5 py-4 font-semibold text-white whitespace-nowrap">Cancellation</th>
                  <th className="px-5 py-4 font-semibold text-white whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-transparent text-sm text-slate-200">
                {visibleServicesForPanel.length ? paginatedServicesForPanel.map((service) => {
                  const hasPendingCancellation = service.cancellationRequest?.statusKey === 'pending';
                  const serviceDisplayStatus = getServiceDisplayStatus(service, countdownNow);
                  const canQueueCancellation = !hasPendingCancellation && serviceDisplayStatus !== 'Expired';
                  const expirationMeta = getAdminServiceExpirationMeta(service, countdownNow);
                  const purchaseDetails = getServicePurchaseDetails(service);
                  const attentionMeta = serviceAttentionById.get(String(service.id)) ?? getServiceAttentionMeta(service, [], countdownNow);

                  return (
                    <tr key={`svc-${service.id}`} className="table-row-hoverable">
                      <td className="px-5 py-4 align-top">
                        <p className="font-semibold text-white">{service.name}</p>
                        {getServiceSubtitle(service) ? <p className="mt-1 text-sm text-slate-400">{getServiceSubtitle(service)}</p> : null}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="font-medium text-white">{service.client || 'John Doe'}</p>
                        {service.clientEmail ? <p className="mt-1 text-sm text-slate-400">{service.clientEmail}</p> : null}
                        <ServiceAttentionBadges attentionMeta={attentionMeta} className="mt-2" />
                      </td>
                      <td className="px-5 py-4 align-top">
                        {purchaseDetails.totalPaid !== null ? (
                          <button type="button" onClick={() => openServiceBreakdownModal(service)} className="text-left transition hover:text-sky-200">
                            <p className="font-semibold text-sky-300 whitespace-nowrap">{formatCurrency(purchaseDetails.totalPaid)}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{service.billing ?? '—'}</p>
                          </button>
                        ) : (
                          <span className="text-sm text-slate-500">—</span>
                        )}
                      </td>
                      <td className="w-[172px] min-w-[172px] px-4 py-4 align-top">
                        <AddonSummaryButton addonEntries={purchaseDetails.addonEntries} onClick={() => openServiceBreakdownModal(service)} />
                      </td>
                      <td className="px-5 py-4 align-top">
                        <StatusBadge status={serviceDisplayStatus} />
                      </td>
                      <td className="px-5 py-4 align-top">
                        <ExpirationMetaCell expirationMeta={expirationMeta} />
                      </td>
                      <td className="px-5 py-4 align-top">
                        <select className="input w-48 whitespace-nowrap" value={service.status} onChange={(event) => updateServiceStatus(service.id, event.target.value)}>
                          {updateStatuses.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-4 align-top">
                        {service.cancellationRequest ? (
                          <div>
                            <span className="text-sm text-orange-200 whitespace-nowrap">{service.cancellationRequest.status}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-500 whitespace-nowrap">No request</span>
                        )}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex justify-end gap-2 whitespace-nowrap">
                          <button type="button" onClick={() => openDiscountModal(service)} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-emerald-600/10 text-emerald-100 transition hover:bg-emerald-600/20" title="Apply discount" aria-label={`Apply discount to ${service.name}`}><Percent size={16} /></button>
                          <button type="button" onClick={() => openPricingLogs(service)} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10" title="Pricing logs" aria-label={`Pricing logs for ${service.name}`}><CheckCircle2 size={16} /></button>
                          <button type="button" onClick={() => handleViewClientFromService(service)} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10" title="View client profile" aria-label={`View client profile for ${service.name}`}><Eye size={16} /></button>
                          {canQueueCancellation ? (
                            <button type="button" onClick={() => openCancellationModal(service)} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/10 text-orange-100 transition hover:bg-orange-400/20" title="Queue cancellation" aria-label={`Queue cancellation for ${service.name}`}><CircleOff size={16} /></button>
                          ) : hasPendingCancellation ? (
                            <span className="inline-flex items-center rounded-2xl border border-orange-400/20 bg-orange-400/10 px-3 py-2 text-xs text-orange-100">Pending</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-slate-400">No services available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleServicesForPanel.length ? paginatedServicesForPanel.map((service) => {
              const hasPendingCancellation = service.cancellationRequest?.statusKey === 'pending';
              const serviceDisplayStatus = getServiceDisplayStatus(service, countdownNow);
              const canQueueCancellation = !hasPendingCancellation && serviceDisplayStatus !== 'Expired';
              const expirationMeta = getAdminServiceExpirationMeta(service, countdownNow);
              const purchaseDetails = getServicePurchaseDetails(service);
              const attentionMeta = serviceAttentionById.get(String(service.id)) ?? getServiceAttentionMeta(service, [], countdownNow);

              return (
                <div key={`svc-card-${service.id}`} className={`panel p-5 flex flex-col justify-between ${attentionMeta.needsAttention ? 'border-amber-300/20' : ''}`}>
                  <div>
                    <p className="text-lg font-medium text-white">{service.name}</p>
                    {getServiceSubtitle(service) ? <p className="mt-1 text-sm text-slate-400">{getServiceSubtitle(service)}</p> : null}
                    <p className="mt-2 text-xs text-slate-500">{service.client || 'John Doe'}</p>
                    {service.clientEmail ? <p className="text-xs text-slate-500">{service.clientEmail}</p> : null}
                    <ServiceAttentionBadges attentionMeta={attentionMeta} className="mt-3" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 items-center">
                    <StatusBadge status={serviceDisplayStatus} />
                    <button type="button" onClick={() => openServiceBreakdownModal(service)} className="text-xs text-sky-300 transition hover:text-sky-200">
                      {purchaseDetails.totalPaid !== null ? formatCurrency(purchaseDetails.totalPaid) : '—'}
                    </button>
                    <button type="button" onClick={() => openServiceBreakdownModal(service)} className="text-xs text-slate-400 transition hover:text-slate-200">
                      {getAddonSummaryLabel(purchaseDetails.addonEntries)}
                    </button>
                  </div>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{expirationMeta.label}</p>
                    <p className="mt-2 text-sm font-medium text-white">{expirationMeta.value}</p>
                    <p className={`mt-1 text-xs ${expirationMeta.isExpired ? 'text-rose-300' : 'text-slate-500'}`}>{expirationMeta.helper}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 justify-end">
                    <button type="button" onClick={() => openDiscountModal(service)} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-emerald-600/10 text-emerald-100 transition hover:bg-emerald-600/20" title="Apply discount" aria-label={`Apply discount to ${service.name}`}><Percent size={16} /></button>
                    <button type="button" onClick={() => openPricingLogs(service)} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10" title="Pricing logs" aria-label={`Pricing logs for ${service.name}`}><CheckCircle2 size={16} /></button>
                    <button type="button" onClick={() => handleViewClientFromService(service)} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10" title="View client profile" aria-label={`View client profile for ${service.name}`}><Eye size={16} /></button>
                    {canQueueCancellation ? (
                      <button type="button" onClick={() => openCancellationModal(service)} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/10 text-orange-100 transition hover:bg-orange-400/20" title="Queue cancellation" aria-label={`Queue cancellation for ${service.name}`}><CircleOff size={16} /></button>
                    ) : hasPendingCancellation ? (
                      <span className="inline-flex items-center rounded-2xl border border-orange-400/20 bg-orange-400/10 px-3 py-2 text-xs text-orange-100">Pending</span>
                    ) : null}
                  </div>
                </div>
              );
            }) : (
              <div className="panel-muted rounded-3xl p-4 text-sm text-slate-400 mt-4">No services available.</div>
            )}
          </div>
        )}

        <Pagination currentPage={servicesPage} totalPages={servicesTotalPages} onPageChange={setServicesPage} />
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
                <select className="input mt-2" value={discountForm.type} onChange={(event) => setDiscountForm((current) => ({ ...current, type: event.target.value }))}>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount</option>
                </select>
              </label>

              <label className="block text-sm text-slate-300">
                Value
                <input className="input mt-2" value={discountForm.value} onChange={(event) => setDiscountForm((current) => ({ ...current, value: event.target.value }))} placeholder="e.g. 10" />
              </label>

              <label className="block text-sm text-slate-300">
                Expiry Date
                <input type="date" className="input mt-2" value={discountForm.expiresOn} onChange={(event) => setDiscountForm((current) => ({ ...current, expiresOn: event.target.value }))} />
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
                    {pricingLogsService.priceHistory.map((row, index) => (
                      <tr key={index} className="border-t border-white/6">
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
        const expirationMeta = getAdminServiceExpirationMeta(selectedServiceBreakdown, countdownNow);
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
                      <div key={`${selectedServiceBreakdown.id}-${addonEntry.label}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-sm font-medium text-white">{addonEntry.label}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{getAddonBillingCycleLabel(addonEntry.billingCycle, 'Recurring')}</p>
                            <p className={`mt-2 text-xs ${getAddonExpirationMeta(addonEntry, selectedServiceBreakdown, countdownNow).isExpired ? 'text-rose-300' : 'text-slate-500'}`}>{getAddonExpirationMeta(addonEntry, selectedServiceBreakdown, countdownNow).value}</p>
                            <p className={`mt-1 text-xs ${getAddonExpirationMeta(addonEntry, selectedServiceBreakdown, countdownNow).isExpired ? 'text-rose-300' : 'text-slate-500'}`}>{getAddonExpirationMeta(addonEntry, selectedServiceBreakdown, countdownNow).helper}</p>
                          </div>
                          <p className="text-sm font-semibold text-sky-300">{typeof addonEntry.price === 'number' ? formatCurrency(addonEntry.price) : '—'}</p>
                        </div>
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
        const client = clients.find((entry) => entry.id === selectedClientId);

        if (!client) {
          return null;
        }

        const relatedServices = adminServices.filter((service) => clientMatchesRecord(client, service.client, service.clientEmail));
        const relatedPurchases = adminPurchases.filter((purchase) => clientMatchesRecord(client, purchase.client, purchase.clientEmail));
        const totalSpent = relatedPurchases.reduce((sum, purchase) => sum + (purchase.amount || 0), 0);

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
                        const expirationMeta = getAdminServiceExpirationMeta(service, countdownNow);
                        const purchaseDetails = getServicePurchaseDetails(service);
                        const serviceDisplayStatus = getServiceDisplayStatus(service, countdownNow);

                        return (
                          <div key={service.id} className="panel-muted rounded-3xl p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="font-medium text-white">{service.name}</p>
                                {getServiceSubtitle(service) ? <p className="mt-1 text-sm text-slate-400">{getServiceSubtitle(service)}</p> : null}
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
                                <StatusBadge status={serviceDisplayStatus} />
                                <div className="text-left md:text-right">
                                  <p className="text-xs text-slate-500">{expirationMeta.value}</p>
                                  <p className={`mt-1 text-xs ${expirationMeta.isExpired ? 'text-rose-300' : 'text-slate-500'}`}>{expirationMeta.helper}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }) : (
                        <div className="panel-muted rounded-3xl p-4 text-sm text-slate-400">No services linked to this client yet.</div>
                      )}
                    </div>
                  </section>

                  <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Billing Profile</p>
                      <h3 className="mt-2 text-lg font-semibold text-white">Saved billing details</h3>
                    </div>

                    <div className="mt-4 space-y-3 text-sm text-slate-300">
                      <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <span>Company</span>
                        <span className="font-medium text-white">{client.company || 'Not set'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <span>Email</span>
                        <span className="font-medium text-white">{client.email || 'Not set'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <span>Address</span>
                        <span className="font-medium text-white">{client.address || 'Not set'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <span>TIN</span>
                        <span className="font-medium text-white">{client.tin || 'Not set'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <span>Mobile Number</span>
                        <span className="font-medium text-white">{client.mobileNumber || 'Not set'}</span>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>,
          document.body,
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
                <input className="input mt-2" value={billingForm.company} onChange={(event) => setBillingForm((current) => ({ ...current, company: event.target.value }))} />
              </label>

              <label className="block text-sm text-slate-300">
                Email
                <input className="input mt-2" value={billingForm.email} onChange={(event) => setBillingForm((current) => ({ ...current, email: event.target.value }))} />
              </label>

              <label className="block text-sm text-slate-300 md:col-span-2">
                Address
                <input className="input mt-2" value={billingForm.address} onChange={(event) => setBillingForm((current) => ({ ...current, address: event.target.value }))} />
              </label>

              <label className="block text-sm text-slate-300">
                TIN
                <input className="input mt-2" value={billingForm.tin} onChange={(event) => setBillingForm((current) => ({ ...current, tin: event.target.value }))} />
              </label>

              <label className="block text-sm text-slate-300">
                Mobile Number
                <input className="input mt-2" value={billingForm.mobileNumber} onChange={(event) => setBillingForm((current) => ({ ...current, mobileNumber: event.target.value }))} />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeBillingModal} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={isSavingBilling} className="btn-primary disabled:opacity-60">{isSavingBilling ? 'Saving...' : 'Save Billing Details'}</button>
            </div>
          </form>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
