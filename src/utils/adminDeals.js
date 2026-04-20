import {
  PURCHASE_ADDON_KEYS,
  SERVICE_SELECTED_ADDON_KEYS,
  buildAddonCatalogMap,
  extractAddonEntries,
  matchCatalogService,
} from './addons';
import { getDesiredDomainValue } from './orders';

export const PURCHASE_LINE_ITEM_KEYS = ['orderItems', 'order_items', 'orderItem', 'order_item', 'lineItems', 'line_items', 'lineItem', 'line_item', 'cart', 'cartItems', 'cart_items', 'items', 'item'];

const normalizeMatchText = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ');

const getNormalizedIds = (values = []) => values
  .filter((value) => value !== null && value !== undefined && value !== '')
  .map((value) => String(value));

const getNormalizedStrings = (values = []) => values
  .map((value) => normalizeMatchText(value))
  .filter(Boolean);

const getNumericValue = (...values) => {
  const found = values.find((value) => value !== null && value !== undefined && value !== '' && !Number.isNaN(Number(value)));
  return found === undefined ? null : Number(found);
};

const getFirstDisplayValue = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === 'object') {
      const nestedValue = getFirstDisplayValue(value.label, value.name, value.title, value.value);
      if (nestedValue !== '—') {
        return nestedValue;
      }
      continue;
    }

    const normalizedValue = String(value).trim();
    if (normalizedValue) {
      return normalizedValue;
    }
  }

  return '—';
};

const formatStatusLabel = (value, fallback = '—') => {
  const normalizedValue = String(value ?? '').trim();
  if (!normalizedValue) {
    return fallback;
  }

  return normalizedValue
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const statusMatches = (value, candidates = []) => {
  const normalizedValue = normalizeMatchText(value);
  if (!normalizedValue) {
    return false;
  }

  return candidates.some((candidate) => normalizedValue === candidate || normalizedValue.includes(candidate));
};

export const getPurchaseStage = (purchase) => {
  const explicitStage = getFirstDisplayValue(
    purchase?.stage,
    purchase?.dealStage,
    purchase?.deal_stage,
    purchase?.salesStage,
    purchase?.sales_stage,
    purchase?.pipelineStage,
    purchase?.pipeline_stage,
  );

  if (explicitStage !== '—') {
    return explicitStage;
  }

  const statusValue = getFirstDisplayValue(purchase?.status, purchase?.statusKey, purchase?.status_key, '');

  if (statusMatches(statusValue, ['paid', 'approved', 'completed', 'active', 'success'])) {
    return 'Closed Won';
  }

  if (statusMatches(statusValue, ['pending review', 'pending approval', 'pending', 'processing'])) {
    return 'Pending Review';
  }

  if (statusMatches(statusValue, ['cancelled', 'canceled', 'rejected', 'declined', 'expired', 'failed'])) {
    return 'Closed Lost';
  }

  return formatStatusLabel(statusValue, 'Open');
};

const getDealStatus = (purchase, linkedServices = []) => {
  const explicitStatus = getFirstDisplayValue(
    purchase?.dealStatus,
    purchase?.deal_status,
    purchase?.salesStatus,
    purchase?.sales_status,
    purchase?.lifecycleStatus,
    purchase?.lifecycle_status,
  );

  if (explicitStatus !== '—') {
    return explicitStatus;
  }

  const linkedStatusValues = linkedServices
    .map((service) => normalizeMatchText(service?.status))
    .filter(Boolean);

  if (linkedStatusValues.includes('active')) {
    return 'Active';
  }

  if (linkedStatusValues.includes('undergoing provisioning')) {
    return 'Undergoing Provisioning';
  }

  if (linkedStatusValues.includes('expired')) {
    return 'Expired';
  }

  if (linkedStatusValues.includes('unpaid')) {
    return 'Unpaid';
  }

  return getFirstDisplayValue(purchase?.status, purchase?.statusKey, purchase?.status_key, 'Pending');
};

const purchaseMatchesClient = (purchase, clientName, clientEmail) => {
  const normalizedClientEmail = normalizeMatchText(clientEmail);
  const normalizedClientName = normalizeMatchText(clientName);
  const purchaseEmail = normalizeMatchText(getPurchaseClientEmail(purchase));
  const purchaseName = normalizeMatchText(getPurchaseClientName(purchase));

  return Boolean(
    (normalizedClientEmail && purchaseEmail && normalizedClientEmail === purchaseEmail)
    || (normalizedClientName && purchaseName && normalizedClientName === purchaseName)
  );
};

const purchaseMatchesCategory = (purchase, categoryValue) => {
  const normalizedCategory = normalizeMatchText(categoryValue);
  if (!normalizedCategory) {
    return false;
  }

  const lineItems = collectPurchaseLineItems(purchase);
  const categoryCandidates = getNormalizedStrings([
    purchase?.category,
    purchase?.serviceCategory,
    purchase?.service_category,
    ...lineItems.flatMap((lineItem) => [
      lineItem?.category,
      lineItem?.serviceCategory,
      lineItem?.service_category,
    ]),
  ]);

  return categoryCandidates.some((candidate) => candidate === normalizedCategory || candidate.includes(normalizedCategory) || normalizedCategory.includes(candidate));
};

const purchaseMatchesProductName = (purchase, productName) => {
  const normalizedProductName = normalizeMatchText(productName);
  if (!normalizedProductName) {
    return false;
  }

  const lineItems = collectPurchaseLineItems(purchase);
  const productCandidates = getNormalizedStrings([
    purchase?.serviceName,
    purchase?.service_name,
    purchase?.name,
    purchase?.title,
    ...lineItems.flatMap((lineItem) => [
      lineItem?.serviceName,
      lineItem?.service_name,
      lineItem?.name,
      lineItem?.title,
    ]),
  ]);

  return productCandidates.some((candidate) => candidate === normalizedProductName || candidate.includes(normalizedProductName) || normalizedProductName.includes(candidate));
};

export const getDealOwner = (purchase, clientRecord) => getFirstDisplayValue(
  purchase?.dealOwner,
  purchase?.deal_owner,
  purchase?.owner,
  purchase?.assignedTo,
  purchase?.assigned_to,
  purchase?.salesOwner,
  purchase?.sales_owner,
  purchase?.accountManager,
  purchase?.account_manager,
  clientRecord?.accountManager,
  clientRecord?.account_manager,
);

export const getBillingInCharge = (purchase, clientRecord) => getFirstDisplayValue(
  purchase?.billingInCharge,
  purchase?.billing_in_charge,
  purchase?.billingContact,
  purchase?.billing_contact,
  purchase?.billingName,
  purchase?.billing_name,
  purchase?.billingOfficer,
  purchase?.billing_officer,
  clientRecord?.billingInCharge,
  clientRecord?.billing_in_charge,
  clientRecord?.billingContact,
  clientRecord?.billing_contact,
  clientRecord?.billingName,
  clientRecord?.billing_name,
);

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

const inferAddonEntriesFromTotal = (service, totalPaid, basePlanPrice = null) => {
  if (totalPaid === null || totalPaid === undefined || Number.isNaN(Number(totalPaid))) {
    return [];
  }

  const catalogEntries = Array.from(buildAddonCatalogMap(service).values())
    .filter((entry) => typeof entry?.price === 'number' && entry.price > 0)
    .map((entry) => ({
      label: entry.label,
      price: entry.price,
    }));

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

const findClientRecord = (clients = [], nameCandidates = [], emailCandidates = []) => {
  const normalizedEmails = getNormalizedStrings(emailCandidates);
  if (normalizedEmails.length) {
    const matchedByEmail = clients.find((client) => normalizedEmails.includes(normalizeMatchText(client?.email)));
    if (matchedByEmail) {
      return matchedByEmail;
    }
  }

  const normalizedNames = getNormalizedStrings(nameCandidates);
  if (!normalizedNames.length) {
    return null;
  }

  return clients.find((client) => {
    const candidates = getNormalizedStrings([client?.name, client?.company]);
    return candidates.some((candidate) => normalizedNames.includes(candidate));
  }) ?? null;
};

export const getPurchaseDisplayId = (purchase) => purchase?.orderNumber
  ?? purchase?.order_number
  ?? purchase?.invoiceNumber
  ?? purchase?.invoice_number
  ?? purchase?.reference
  ?? purchase?.id
  ?? '—';

export const getPurchaseDateValue = (purchase) => purchase?.date
  ?? purchase?.createdAt
  ?? purchase?.created_at
  ?? purchase?.updatedAt
  ?? purchase?.updated_at
  ?? null;

export const getPurchaseRecordTime = (record) => {
  const rawValue = getPurchaseDateValue(record) ?? 0;
  const time = new Date(rawValue).getTime();
  return Number.isNaN(time) ? 0 : time;
};

export const getPurchaseClientName = (purchase) => purchase?.client
  ?? purchase?.customer
  ?? purchase?.clientName
  ?? purchase?.customerName
  ?? purchase?.name
  ?? 'Unknown client';

export const getPurchaseClientEmail = (purchase) => purchase?.clientEmail
  ?? purchase?.customerEmail
  ?? purchase?.email
  ?? null;

export const getServiceClientName = (service) => service?.client
  ?? service?.clientName
  ?? service?.customer
  ?? service?.customerName
  ?? 'Unknown client';

export const getServiceClientEmail = (service) => service?.clientEmail
  ?? service?.customerEmail
  ?? service?.email
  ?? null;

export const buildDealDisplayName = (catalogService, purchase, matchedLineItems = []) => {
  const explicitName = purchase?.dealName
    ?? purchase?.deal_name
    ?? purchase?.orderName
    ?? purchase?.order_name
    ?? purchase?.title;

  if (String(explicitName ?? '').trim()) {
    return String(explicitName).trim();
  }

  const derivedServiceName = matchedLineItems[0]?.serviceName
    ?? matchedLineItems[0]?.service_name
    ?? catalogService?.name
    ?? purchase?.serviceName
    ?? purchase?.service_name;
  const clientName = getPurchaseClientName(purchase);

  if (clientName && derivedServiceName) {
    return `${clientName} · ${derivedServiceName}`;
  }

  if (derivedServiceName) {
    return `${derivedServiceName} Deal`;
  }

  return `Deal ${getPurchaseDisplayId(purchase)}`;
};

export const collectPurchaseLineItems = (record) => {
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

export const catalogServiceMatchesRecord = (catalogService, record) => {
  if (!catalogService || !record || typeof record !== 'object') {
    return false;
  }

  const catalogServiceIds = getNormalizedIds([catalogService?.id, catalogService?.serviceId, catalogService?.service_id]);
  const recordServiceIds = getNormalizedIds([
    record?.serviceId,
    record?.service_id,
    record?.service?.id,
    record?.service?.serviceId,
    record?.service?.service_id,
  ]);

  if (catalogServiceIds.length && recordServiceIds.some((value) => catalogServiceIds.includes(value))) {
    return true;
  }

  const catalogName = normalizeMatchText(catalogService?.name ?? catalogService?.serviceName);
  const catalogCategory = normalizeMatchText(catalogService?.category);
  const recordNames = getNormalizedStrings([
    record?.serviceName,
    record?.service_name,
    record?.name,
    record?.service,
    record?.title,
    record?.service?.name,
  ]);

  if (!catalogName || !recordNames.some((value) => value === catalogName || value.includes(catalogName) || catalogName.includes(value))) {
    return false;
  }

  const recordCategories = getNormalizedStrings([
    record?.category,
    record?.serviceCategory,
    record?.service_category,
    record?.service?.category,
  ]);

  if (!catalogCategory || !recordCategories.length) {
    return true;
  }

  return recordCategories.some((value) => value === catalogCategory || value.includes(catalogCategory) || catalogCategory.includes(value));
};

export const catalogServiceMatchesPurchase = (catalogService, purchase) => {
  if (!purchase || typeof purchase !== 'object') {
    return false;
  }

  const lineItemMatches = collectPurchaseLineItems(purchase).some((entry) => catalogServiceMatchesRecord(catalogService, entry));
  return lineItemMatches || catalogServiceMatchesRecord(catalogService, purchase);
};

export const catalogServiceMatchesService = (catalogService, serviceInstance, catalogServices = []) => {
  if (!catalogService || !serviceInstance || typeof serviceInstance !== 'object') {
    return false;
  }

  const matchedCatalogService = matchCatalogService(serviceInstance, catalogServices);
  if (matchedCatalogService && String(matchedCatalogService.id) === String(catalogService.id)) {
    return true;
  }

  const catalogServiceIds = getNormalizedIds([catalogService?.id]);
  const instanceServiceIds = getNormalizedIds([serviceInstance?.serviceId, serviceInstance?.service_id]);

  if (catalogServiceIds.length && instanceServiceIds.some((value) => catalogServiceIds.includes(value))) {
    return true;
  }

  return catalogServiceMatchesRecord(catalogService, serviceInstance);
};

export const serviceMatchesPurchaseRecord = (service, record) => {
  if (!record || typeof record !== 'object') {
    return false;
  }

  const serviceOrderItemIds = getNormalizedIds([service?.orderItemId, service?.order_item_id]);
  const recordOrderItemIds = getNormalizedIds([record?.id, record?.orderItemId, record?.order_item_id, record?.itemId, record?.item_id]);

  if (serviceOrderItemIds.length && recordOrderItemIds.some((value) => serviceOrderItemIds.includes(value))) {
    return true;
  }

  const serviceIds = getNormalizedIds([service?.id, service?.serviceId, service?.service_id]);
  const recordIds = getNormalizedIds([
    record?.serviceId,
    record?.service_id,
    record?.customerServiceId,
    record?.customer_service_id,
  ]);

  if (serviceIds.length && recordIds.some((value) => serviceIds.includes(value))) {
    return true;
  }

  const serviceName = normalizeMatchText(service?.name ?? service?.serviceName);
  const recordNames = getNormalizedStrings([record?.serviceName, record?.service_name, record?.name, record?.service, record?.title]);

  if (serviceName && recordNames.some((value) => value === serviceName || value.includes(serviceName) || serviceName.includes(value))) {
    return true;
  }

  const servicePlan = normalizeMatchText(service?.plan ?? service?.configuration);
  const recordPlans = getNormalizedStrings([record?.plan, record?.configuration, record?.config, record?.option]);

  return Boolean(servicePlan) && recordPlans.some((value) => value === servicePlan || value.includes(servicePlan) || servicePlan.includes(value));
};

export const clientMatchesPurchase = (service, purchase) => {
  const serviceClient = normalizeMatchText(getServiceClientName(service));
  const serviceEmail = normalizeMatchText(getServiceClientEmail(service));
  const purchaseClient = normalizeMatchText(getPurchaseClientName(purchase));
  const purchaseEmail = normalizeMatchText(getPurchaseClientEmail(purchase));

  if (serviceEmail && purchaseEmail && serviceEmail === purchaseEmail) {
    return true;
  }

  if (serviceClient && purchaseClient && serviceClient === purchaseClient) {
    return true;
  }

  return !serviceClient && !serviceEmail;
};

export const buildServicePurchaseDetails = (service, purchases = []) => {
  const serviceAddonEntries = mergeAddonEntries(
    extractAddonEntries(service, { catalogService: service, addonKeys: SERVICE_SELECTED_ADDON_KEYS, fallbackToAddonsKey: true }),
    ...collectPurchaseLineItems(service).map((lineItem) => extractAddonEntries(lineItem, { catalogService: service, addonKeys: PURCHASE_ADDON_KEYS, fallbackToAddonsKey: true })),
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

      const totalPaid = getNumericValue(
        lineItem?.price,
        lineItem?.amount,
        purchase?.amount,
        purchase?.price,
        service?.totalPaid,
        service?.total_paid,
        service?.amount,
        service?.price,
        service?.basePrice,
      );
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
        extractAddonEntries(lineItem, { catalogService: service, addonKeys: PURCHASE_ADDON_KEYS, fallbackToAddonsKey: true }),
        extractAddonEntries(purchase, { catalogService: service, addonKeys: PURCHASE_ADDON_KEYS, fallbackToAddonsKey: true }),
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

  const fallbackTotalPaid = getNumericValue(
    service?.totalPaid,
    service?.total_paid,
    service?.amount,
    service?.price,
    service?.basePrice,
  );
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

export const getServiceSubtitle = (service) => {
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

export const getCatalogServiceRelatedServices = (catalogService, adminServices = [], catalogServices = []) => adminServices
  .filter((service) => catalogServiceMatchesService(catalogService, service, catalogServices))
  .sort((left, right) => getPurchaseRecordTime(right) - getPurchaseRecordTime(left));

export const getCatalogServiceRelatedPurchases = (catalogService, adminPurchases = []) => adminPurchases
  .filter((purchase) => catalogServiceMatchesPurchase(catalogService, purchase))
  .sort((left, right) => getPurchaseRecordTime(right) - getPurchaseRecordTime(left));

export const getCatalogServiceMatchedLineItems = (catalogService, purchase) => {
  const matchedLineItems = collectPurchaseLineItems(purchase).filter((entry) => catalogServiceMatchesRecord(catalogService, entry));

  if (matchedLineItems.length) {
    return matchedLineItems;
  }

  return catalogServiceMatchesRecord(catalogService, purchase) ? [purchase] : [];
};

export const getPurchaseLinkedServices = ({ catalogService, purchase, adminServices = [], catalogServices = [] }) => {
  const relatedServices = getCatalogServiceRelatedServices(catalogService, adminServices, catalogServices);

  return relatedServices.filter((service) => Boolean(buildServicePurchaseDetails(service, [purchase]).purchase));
};

export const buildCatalogServiceDealRows = ({
  catalogService,
  adminPurchases = [],
  adminServices = [],
  clients = [],
  catalogServices = [],
}) => {
  const relatedServices = getCatalogServiceRelatedServices(catalogService, adminServices, catalogServices);

  return getCatalogServiceRelatedPurchases(catalogService, adminPurchases).map((purchase) => {
    const matchedLineItems = getCatalogServiceMatchedLineItems(catalogService, purchase);
    const linkedServices = relatedServices.filter((service) => Boolean(buildServicePurchaseDetails(service, [purchase]).purchase));
    const clientRecord = findClientRecord(
      clients,
      [
        getPurchaseClientName(purchase),
        ...linkedServices.map((service) => getServiceClientName(service)),
      ],
      [
        getPurchaseClientEmail(purchase),
        ...linkedServices.map((service) => getServiceClientEmail(service)),
      ],
    );
    const primaryLineItem = matchedLineItems[0] ?? null;
    const amount = getNumericValue(
      primaryLineItem?.price,
      primaryLineItem?.amount,
      purchase?.amount,
      purchase?.price,
    );
    const productCategory = getFirstDisplayValue(
      primaryLineItem?.category,
      primaryLineItem?.serviceCategory,
      primaryLineItem?.service_category,
      purchase?.category,
      purchase?.serviceCategory,
      purchase?.service_category,
      catalogService?.category,
    );
    const productName = getFirstDisplayValue(
      primaryLineItem?.serviceName,
      primaryLineItem?.service_name,
      primaryLineItem?.name,
      purchase?.serviceName,
      purchase?.service_name,
      catalogService?.name,
    );
    const clientName = clientRecord?.name ?? getPurchaseClientName(purchase);
    const clientEmail = clientRecord?.email ?? getPurchaseClientEmail(purchase) ?? '—';
    const currentPurchaseTime = getPurchaseRecordTime(purchase);
    const clientPurchaseHistory = adminPurchases.filter((candidatePurchase) => {
      if (String(candidatePurchase?.id ?? '') === String(purchase?.id ?? '')) {
        return false;
      }

      if (!purchaseMatchesClient(candidatePurchase, clientName, clientEmail)) {
        return false;
      }

      return getPurchaseRecordTime(candidatePurchase) <= currentPurchaseTime;
    });
    const matchingServicePurchases = clientPurchaseHistory.filter((candidatePurchase) => getCatalogServiceMatchedLineItems(catalogService, candidatePurchase).length > 0);
    const sameCategoryPurchases = clientPurchaseHistory.filter((candidatePurchase) => {
      if (!purchaseMatchesCategory(candidatePurchase, productCategory)) {
        return false;
      }

      return !purchaseMatchesProductName(candidatePurchase, productName);
    });
    const dealType = clientPurchaseHistory.length ? 'Existing Client' : 'New Client';
    const explicitDealSubType = getFirstDisplayValue(
      purchase?.dealSubType,
      purchase?.deal_sub_type,
      purchase?.deal_subtype,
      purchase?.subType,
      purchase?.sub_type,
      purchase?.subtype,
    );
    const dealSubType = explicitDealSubType !== '—'
      ? explicitDealSubType
      : matchingServicePurchases.length
        ? 'Renewal'
        : sameCategoryPurchases.length
          ? 'Upgrade'
          : 'New Service';

    return {
      dealId: String(purchase?.id ?? getPurchaseDisplayId(purchase)),
      dealName: buildDealDisplayName(catalogService, purchase, matchedLineItems),
      orderLabel: getPurchaseDisplayId(purchase),
      date: getPurchaseDateValue(purchase),
      amount,
      status: purchase?.status ?? 'Pending',
      stage: getPurchaseStage(purchase),
      dealStatus: getDealStatus(purchase, linkedServices),
      dealType,
      dealSubType,
      productCategory,
      productName,
      dealOwner: getDealOwner(purchase, clientRecord),
      billingInCharge: getBillingInCharge(purchase, clientRecord),
      purchase,
      matchedLineItems,
      linkedServices,
      lineItemCount: matchedLineItems.length,
      linkedServiceCount: linkedServices.length,
      clientRecord,
      clientName,
      clientEmail,
      customerNote: getDesiredDomainValue(purchase),
    };
  });
};
