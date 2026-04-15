import { formatDate } from './format';
import { formatRenewalTimeRemaining } from './services';

export const PURCHASE_ADDON_KEYS = ['selectedAddons', 'selected_addons', 'addons', 'add_ons', 'addon'];
export const SERVICE_SELECTED_ADDON_KEYS = ['selectedAddons', 'selected_addons', 'selectedAddon', 'selected_addon', 'chosenAddons', 'chosen_addons', 'purchasedAddons', 'purchased_addons', 'customerAddons', 'customer_addons', 'add_ons', 'addon'];

const normalizeMatchText = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ');

const getRenewalTimestamp = (value) => {
  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
};

export const normalizeAddonBillingCycle = (value, fallback = '') => {
  const normalizedFallback = typeof fallback === 'string' ? fallback.trim() : '';

  if (value === null || value === undefined || String(value).trim() === '') {
    return normalizedFallback;
  }

  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (normalized === 'monthly' || normalized === 'month' || normalized === 'per_month') {
    return 'monthly';
  }

  if (normalized === 'yearly' || normalized === 'year' || normalized === 'annual' || normalized === 'annually' || normalized === 'per_year') {
    return 'yearly';
  }

  if (normalized === 'one_time' || normalized === 'one-time' || normalized === 'onetime' || normalized === 'oneoff' || normalized === 'one_off' || normalized === 'once') {
    return 'one_time';
  }

  return normalizedFallback;
};

export const getAddonBillingCycleLabel = (value, fallback = '—') => {
  const normalized = normalizeAddonBillingCycle(value);

  if (normalized === 'monthly') {
    return 'Monthly';
  }

  if (normalized === 'yearly') {
    return 'Yearly';
  }

  if (normalized === 'one_time') {
    return 'One-time';
  }

  return fallback;
};

const getAddonStringSegments = (value) => {
  if (typeof value !== 'string') {
    return [];
  }

  return value.split('|').map((part) => part.trim());
};

export const getAddonLabel = (entry) => {
  if (entry === null || entry === undefined) {
    return '';
  }

  if (typeof entry !== 'object') {
    const [label] = getAddonStringSegments(String(entry));
    return String(label ?? entry).trim();
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

export const getAddonPrice = (entry, catalogMatch = null) => {
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

  if (typeof entry === 'string') {
    const [, rawPrice = ''] = getAddonStringSegments(entry);
    if (rawPrice !== '' && !Number.isNaN(Number(rawPrice))) {
      return Number(rawPrice);
    }
  }

  return typeof catalogMatch?.price === 'number' ? catalogMatch.price : null;
};

export const getAddonBillingCycle = (entry, fallback = '', catalogMatch = null) => {
  if (entry && typeof entry === 'object') {
    const nestedAddon = entry.serviceAddon ?? entry.service_addon ?? entry.addonDetail ?? entry.addon_detail ?? null;
    const rawCycle = entry.billingCycle
      ?? entry.billing_cycle
      ?? entry.duration
      ?? entry.interval
      ?? entry.cycle
      ?? entry.period
      ?? entry.term
      ?? entry.renewalCycle
      ?? entry.renewal_cycle
      ?? nestedAddon?.billingCycle
      ?? nestedAddon?.billing_cycle
      ?? nestedAddon?.duration
      ?? nestedAddon?.interval
      ?? nestedAddon?.cycle
      ?? nestedAddon?.period
      ?? nestedAddon?.term
      ?? nestedAddon?.billing?.cycle
      ?? (typeof nestedAddon?.billing === 'string' ? nestedAddon.billing : '')
      ?? entry.billing?.cycle
      ?? (typeof entry.billing === 'string' ? entry.billing : '');

    const normalized = normalizeAddonBillingCycle(rawCycle);
    if (normalized) {
      return normalized;
    }
  }

  if (typeof entry === 'string') {
    const [, , rawCycle = ''] = getAddonStringSegments(entry);
    const normalized = normalizeAddonBillingCycle(rawCycle);
    if (normalized) {
      return normalized;
    }
  }

  return normalizeAddonBillingCycle(catalogMatch?.billingCycle ?? fallback);
};

const getAddonExplicitRenewalValue = (entry) => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  return entry.renewsOn
    ?? entry.renews_on
    ?? entry.expiresAt
    ?? entry.expires_at
    ?? entry.expiryDate
    ?? entry.expiry_date
    ?? entry.endsOn
    ?? entry.ends_on
    ?? null;
};

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

    if (trimmed.includes('|')) {
      return [trimmed];
    }

    return trimmed
      .split(',')
      .map((entry) => entry.trim().replace(/^[\[\]"']+|[\[\]"']+$/g, '').trim())
      .filter(Boolean);
  }

  return [value];
};

export const matchCatalogService = (service, catalogServices = []) => {
  if (!service || !Array.isArray(catalogServices) || !catalogServices.length) {
    return null;
  }

  const serviceIds = [service.id, service.service_id, service.serviceId]
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value));

  const directMatch = catalogServices.find((catalogService) => serviceIds.includes(String(catalogService?.id)));
  if (directMatch) {
    return directMatch;
  }

  const serviceName = normalizeMatchText(service.name ?? service.serviceName);
  const serviceCategory = normalizeMatchText(service.category);

  return catalogServices.find((catalogService) => {
    const catalogName = normalizeMatchText(catalogService?.name);
    const catalogCategory = normalizeMatchText(catalogService?.category);

    if (!serviceName || !catalogName || serviceName !== catalogName) {
      return false;
    }

    if (!serviceCategory || !catalogCategory) {
      return true;
    }

    return serviceCategory === catalogCategory;
  }) ?? null;
};

export const buildAddonCatalogMap = (serviceDefinition) => {
  const catalog = new Map();
  const fallbackCycle = normalizeAddonBillingCycle(
    serviceDefinition?.billingCycle ?? serviceDefinition?.billing?.cycle ?? serviceDefinition?.billing,
    '',
  );

  (Array.isArray(serviceDefinition?.addons) ? serviceDefinition.addons : []).forEach((option) => {
    const label = getAddonLabel(option);

    if (!label) {
      return;
    }

    catalog.set(normalizeMatchText(label), {
      label,
      price: getAddonPrice(option),
      billingCycle: getAddonBillingCycle(option, fallbackCycle),
      raw: option,
    });
  });

  return catalog;
};

const valuesMatchCatalog = (rawValues, catalogMap) => {
  if (!rawValues.length || !catalogMap.size) {
    return false;
  }

  const normalizedValues = rawValues
    .map((entry) => normalizeMatchText(getAddonLabel(entry)))
    .filter(Boolean);

  if (!normalizedValues.length) {
    return false;
  }

  return normalizedValues.every((value) => catalogMap.has(value));
};

export const extractAddonEntries = (record, options = {}) => {
  if (!record || typeof record !== 'object') {
    return [];
  }

  const {
    catalogService = null,
    addonKeys = SERVICE_SELECTED_ADDON_KEYS,
    fallbackBillingCycle = '',
    fallbackToAddonsKey = false,
  } = options;

  const catalogMap = buildAddonCatalogMap(catalogService ?? record);
  const normalizedFallbackCycle = normalizeAddonBillingCycle(
    fallbackBillingCycle
      || catalogService?.billingCycle
      || catalogService?.billing?.cycle
      || catalogService?.billing
      || record?.billingCycle
      || record?.billing?.cycle
      || record?.billing,
    '',
  );
  const seen = new Set();
  const entries = [];

  const pushEntry = (rawValue) => {
    normalizeAddonValue(rawValue).forEach((entry) => {
      const label = getAddonLabel(entry);

      if (!label) {
        return;
      }

      const key = normalizeMatchText(label);
      if (seen.has(key)) {
        return;
      }

      seen.add(key);

      const catalogMatch = catalogMap.get(key);
      entries.push({
        label: catalogMatch?.label ?? label,
        price: getAddonPrice(entry, catalogMatch),
        billingCycle: getAddonBillingCycle(entry, normalizedFallbackCycle, catalogMatch) || null,
        renewalValue: getAddonExplicitRenewalValue(entry) ?? null,
      });
    });
  };

  addonKeys.forEach((key) => pushEntry(record[key]));

  if (!entries.length && fallbackToAddonsKey && Array.isArray(record?.addons)) {
    const rawValues = normalizeAddonValue(record.addons);

    if (!valuesMatchCatalog(rawValues, catalogMap) || !catalogMap.size) {
      pushEntry(record.addons);
    }
  }

  return entries;
};

export const getAddonExpirationMeta = (addonEntry, service, now = Date.now()) => {
  const fallbackCycle = normalizeAddonBillingCycle(
    service?.billingCycle ?? service?.billing?.cycle ?? service?.billing,
    '',
  );
  const billingCycle = getAddonBillingCycle(addonEntry, fallbackCycle);
  const explicitRenewalValue = addonEntry?.renewalValue ?? getAddonExplicitRenewalValue(addonEntry);
  const serviceRenewalValue = service?.renewsOn;
  const effectiveRenewalValue = explicitRenewalValue || (billingCycle !== 'one_time' ? serviceRenewalValue : null);

  if (effectiveRenewalValue) {
    const countdown = formatRenewalTimeRemaining(effectiveRenewalValue, now);
    const helperParts = [];
    const billingCycleLabel = getAddonBillingCycleLabel(billingCycle, 'Recurring');

    if (billingCycleLabel !== '—') {
      helperParts.push(billingCycleLabel);
    }

    helperParts.push(formatDate(effectiveRenewalValue));

    if (!explicitRenewalValue && serviceRenewalValue) {
      helperParts.push('follows service renewal');
    }

    return {
      label: 'Add-on Expiry',
      value: countdown,
      helper: helperParts.join(' • '),
      isExpired: countdown === 'Expired',
    };
  }

  if (service?.status === 'Undergoing Provisioning') {
    return {
      label: 'Add-on Expiry',
      value: 'Shown after setup',
      helper: `${getAddonBillingCycleLabel(billingCycle, 'Add-on')} • schedule appears after go-live.`,
      isExpired: false,
    };
  }

  if (billingCycle === 'one_time') {
    return {
      label: 'Add-on Expiry',
      value: 'One-time add-on',
      helper: serviceRenewalValue ? `No recurring renewal • service term ends ${formatDate(serviceRenewalValue)}` : 'No recurring renewal.',
      isExpired: false,
    };
  }

  return {
    label: 'Add-on Expiry',
    value: 'Not scheduled',
    helper: `${getAddonBillingCycleLabel(billingCycle, 'Add-on')} • waiting for schedule.`,
    isExpired: false,
  };
};
