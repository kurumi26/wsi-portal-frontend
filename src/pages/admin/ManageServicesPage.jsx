import { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  CircleOff,
  CreditCard,
  Percent,
  Eye,
  LayoutGrid,
  ChevronDown,
  List,
  Mail,
  MapPin,
  PencilLine,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UserCircle2,
  XCircle,
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import StatusBadge from '../../components/common/StatusBadge';
import UserAvatar from '../../components/common/UserAvatar';
import { usePortal } from '../../context/PortalContext';
import { clientMatchesRecord, getClientDisplayName } from '../../utils/clients';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format';
import { getDesiredDomainValue } from '../../utils/orders';

const serviceCategories = ['Shared Hosting', 'Domains', 'Dedicated server'];
const SERVICES_PER_PAGE = 5;
const BILLING_CYCLE_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'one_time', label: 'One-time' },
];
const BILLING_CYCLE_LABELS = BILLING_CYCLE_OPTIONS.reduce((accumulator, option) => {
  accumulator[option.value] = option.label;
  return accumulator;
}, {});

const normalizeBillingCycle = (value, fallback = '') => {
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

  if (normalized === 'one_time' || normalized === 'onetime' || normalized === 'oneoff' || normalized === 'one_off' || normalized === 'once') {
    return 'one_time';
  }

  return normalizedFallback;
};

const getBillingCycleLabel = (value, fallback = '—') => {
  const normalized = normalizeBillingCycle(value);
  return BILLING_CYCLE_LABELS[normalized] ?? fallback;
};

const getAddonBillingCycle = (addon, fallback = '') => {
  if (!addon || typeof addon !== 'object') {
    return normalizeBillingCycle('', fallback);
  }

  return normalizeBillingCycle(
    addon.billingCycle
      ?? addon.billing_cycle
      ?? addon.duration
      ?? addon.interval
      ?? addon.cycle
      ?? addon.period
      ?? addon.term
      ?? addon.billing?.cycle
      ?? (typeof addon.billing === 'string' ? addon.billing : ''),
    fallback,
  );
};

const getAddonPersistedId = (addon) => {
  if (!addon || typeof addon !== 'object') {
    return null;
  }

  return addon.id
    ?? addon.addonId
    ?? addon.addon_id
    ?? addon.serviceAddonId
    ?? addon.service_addon_id
    ?? addon.serviceAddon?.id
    ?? addon.service_addon?.id
    ?? null;
};

const createAddonDraft = (overrides = {}) => ({
  id: overrides.id ?? `addon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  persistedId: overrides.persistedId ?? overrides.addonId ?? overrides.addon_id ?? overrides.serviceAddonId ?? overrides.service_addon_id ?? null,
  label: overrides.label ?? '',
  price: overrides.price ?? '',
  billingCycle: normalizeBillingCycle(overrides.billingCycle, 'monthly') || 'monthly',
});

const isAddonDraftEmpty = (addonDraft) => {
  const label = typeof addonDraft?.label === 'string' ? addonDraft.label.trim() : '';
  const price = addonDraft?.price === null || addonDraft?.price === undefined ? '' : String(addonDraft.price).trim();

  return !label && !price;
};

const getNextRenewalDate = (billingCycle) => {
  const renewalDate = new Date();
  const normalizedBillingCycle = normalizeBillingCycle(billingCycle, 'yearly') || 'yearly';

  if (normalizedBillingCycle === 'monthly') {
    renewalDate.setMonth(renewalDate.getMonth() + 1);
    return renewalDate.toISOString();
  }

  renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  return renewalDate.toISOString();
};

export default function ManageServicesPage() {
  const {
    services,
    adminServices,
    adminPurchases,
    clients,
    createCatalogService,
    createAdminService,
    updateCatalogService,
    updateServiceStatus,
    requestServiceCancellation,
    approveServiceCancellation,
    rejectServiceCancellation,
    approveAdminOrder,
    updateClientBilling,
  } = usePortal();
  const [servicesSearch, setServicesSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priceFilter, setPriceFilter] = useState('Price: Low to High');
  const [viewMode, setViewMode] = useState('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [tableSort, setTableSort] = useState({ key: 'name', direction: 'asc' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [showClientProfile, setShowClientProfile] = useState(false);
  const [selectedServiceSubscribers, setSelectedServiceSubscribers] = useState(null);
  const [billingModalClient, setBillingModalClient] = useState(null);
  const [billingForm, setBillingForm] = useState({
    company: '',
    email: '',
    address: '',
    tin: '',
    mobileNumber: '',
  });
  const [isSavingBilling, setIsSavingBilling] = useState(false);
  const [selectedCancellationService, setSelectedCancellationService] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isQueueingCancellation, setIsQueueingCancellation] = useState(false);
  const [processingOrderId, setProcessingOrderId] = useState('');
  const [processingCancellationId, setProcessingCancellationId] = useState('');
  const [selectedOrderForReview, setSelectedOrderForReview] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountTargetService, setDiscountTargetService] = useState(null);
  const [discountForm, setDiscountForm] = useState({ type: 'percentage', value: '', expiresOn: '' });
  const [showPricingLogsModal, setShowPricingLogsModal] = useState(false);
  const [pricingLogsService, setPricingLogsService] = useState(null);
  const [addonsPreviewService, setAddonsPreviewService] = useState(null);
  const [statusUpdatingServiceId, setStatusUpdatingServiceId] = useState('');
  const [editingService, setEditingService] = useState(null);
  const [localCatalogServices, setLocalCatalogServices] = useState([]);
  const [form, setForm] = useState({
    clientId: '',
    name: '',
    description: '',
    category: 'Domains',
    price: '',
    billingCycle: 'yearly',
    addonEntries: [createAddonDraft()],
  });

  const [selectedCatalogServiceId, setSelectedCatalogServiceId] = useState('');
  const [isPriceCustomized, setIsPriceCustomized] = useState(true);
  const [isCatalogMenuOpen, setIsCatalogMenuOpen] = useState(false);
  const catalogMenuRef = useRef(null);
  const catalogButtonRef = useRef(null);

  const eligibleClients = useMemo(
    () => clients.filter((client) => client.registrationApproval?.statusKey !== 'pending' && client.registrationApproval?.statusKey !== 'rejected'),
    [clients],
  );

  useEffect(() => {
    if (!isCatalogMenuOpen) return undefined;

    const handleClickOutside = (event) => {
      if (
        catalogMenuRef.current
        && !catalogMenuRef.current.contains(event.target)
        && catalogButtonRef.current
        && !catalogButtonRef.current.contains(event.target)
      ) {
        setIsCatalogMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCatalogMenuOpen]);

  const matchedClients = useMemo(() => {
    const normalizedSearch = clientSearch.trim().toLowerCase();

    return eligibleClients.filter((client) => {
      if (!normalizedSearch) {
        return true;
      }

      return [client.name, client.company, client.email]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [clientSearch, eligibleClients]);

  const selectedClient = useMemo(
    () => eligibleClients.find((client) => client.id === selectedClientId) ?? null,
    [eligibleClients, selectedClientId],
  );

  const selectedClientSummary = useMemo(() => {
    if (!selectedClient) {
      return null;
    }

    const relatedServices = adminServices.filter(
      (service) => clientMatchesRecord(selectedClient, service.client, service.clientEmail),
    );
    const relatedPurchases = adminPurchases.filter((purchase) => clientMatchesRecord(selectedClient, purchase.client, purchase.clientEmail));

    return {
      relatedServices,
      relatedPurchases,
      totalSpent: relatedPurchases.reduce((sum, purchase) => sum + purchase.amount, 0),
    };
  }, [adminPurchases, adminServices, selectedClient]);

  const subscribedClients = useMemo(() => {
    if (!selectedServiceSubscribers) {
      return [];
    }

    const relatedServices = adminServices.filter((service) => (
      service.name === selectedServiceSubscribers.name
      && (service.category ?? '') === (selectedServiceSubscribers.category ?? '')
    ));

    const uniqueSubscribers = new Map();
    relatedServices.forEach((service) => {
      const key = service.clientEmail || service.client || service.id;
      if (!key || uniqueSubscribers.has(key)) {
        return;
      }

      uniqueSubscribers.set(key, {
        key,
        name: service.client || 'Unknown client',
        email: service.clientEmail || 'No email',
        renewsOn: service.renewsOn,
        status: service.status,
      });
    });

    return Array.from(uniqueSubscribers.values());
  }, [adminServices, selectedServiceSubscribers]);

  const BACKEND_ORIGIN = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/api\/?$/i, '');

  const catalogServices = useMemo(() => {
    const merged = [...services, ...localCatalogServices];
    const deduped = new Map();

    merged.forEach((service) => {
      const key = String(service.id ?? `${service.name}-${service.category}-${service.price ?? service.basePrice}`);
      deduped.set(key, service);
    });

    return Array.from(deduped.values());
  }, [localCatalogServices, services]);

  const filteredServices = useMemo(() => {
    return catalogServices.filter((service) => {
      const matchesSearch = [service.name, service.category, service.description, service.billingCycle]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(servicesSearch.toLowerCase()));

      const normalizedFilter = statusFilter.toLowerCase();
      const normalizedCategory = (service.category ?? '').toLowerCase();
      const matchesStatus = statusFilter === 'All' || normalizedCategory === normalizedFilter;

      return matchesSearch && matchesStatus;
    });
  }, [catalogServices, servicesSearch, statusFilter]);
  const getServiceBasePrice = (service) => (
    typeof service.basePrice === 'number'
      ? service.basePrice
      : (typeof service.price === 'number' ? service.price : null)
  );

  const getServiceAnnualPrice = (service) => {
    const base = getServiceBasePrice(service);
    if (typeof base !== 'number') return null;

    const cycle = normalizeBillingCycle(
      service?.billingCycle ?? service?.billing_cycle ?? service?.billing ?? service?.period ?? service?.term ?? service?.duration ?? service?.interval ?? service?.cycle,
      'monthly',
    );

    if (cycle === 'yearly' || cycle === 'one_time') return base;
    return base * 12;
  };

  const displayedServices = useMemo(() => {
    const list = [...filteredServices];
    const isNew = (service) => {
      if (!service?.createdAt) return false;
      const createdTime = new Date(service.createdAt).getTime();
      if (!Number.isFinite(createdTime)) return false;
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      return Date.now() - createdTime <= SEVEN_DAYS_MS;
    };
    const getPrice = (service) => {
      const annual = getServiceAnnualPrice(service);
      return typeof annual === 'number' ? annual : 0;
    };

    // Always keep newly added services at the top.
    list.sort((a, b) => Number(isNew(b)) - Number(isNew(a)));

    if (priceFilter === 'Price: High to Low') {
      return list.sort((a, b) => {
        const newPriority = Number(isNew(b)) - Number(isNew(a));
        if (newPriority !== 0) return newPriority;
        return getPrice(b) - getPrice(a);
      });
    }

    if (priceFilter === 'Most Popular') {
      const popularityMap = adminServices.reduce((accumulator, service) => {
        const key = `${service.name ?? ''}::${service.category ?? ''}`;
        accumulator.set(key, (accumulator.get(key) ?? 0) + 1);
        return accumulator;
      }, new Map());

      return list.sort((a, b) => {
        const newPriority = Number(isNew(b)) - Number(isNew(a));
        if (newPriority !== 0) return newPriority;
        const aKey = `${a.name ?? ''}::${a.category ?? ''}`;
        const bKey = `${b.name ?? ''}::${b.category ?? ''}`;
        return (popularityMap.get(bKey) ?? 0) - (popularityMap.get(aKey) ?? 0);
      });
    }

    return list.sort((a, b) => {
      const newPriority = Number(isNew(b)) - Number(isNew(a));
      if (newPriority !== 0) return newPriority;
      return getPrice(a) - getPrice(b);
    });
  }, [adminServices, filteredServices, priceFilter]);

  const isNewCatalogService = (service) => {
    if (!service?.createdAt) {
      return false;
    }

    const createdTime = new Date(service.createdAt).getTime();
    if (!Number.isFinite(createdTime)) {
      return false;
    }

    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - createdTime <= SEVEN_DAYS_MS;
  };

  const handleTableSort = (key) => {
    setTableSort((current) => (
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    ));
  };

  const renderTableSortIndicator = (key) => {
    const isSorted = tableSort.key === key;
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
          className={`sort-svg sort-icon ${isSorted && tableSort.direction === 'asc' ? 'active' : 'inactive'}`}
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
          className={`sort-svg sort-icon ${isSorted && tableSort.direction === 'desc' ? 'active' : 'inactive'}`}
        >
          <path d="M7 10l5 5 5-5" />
        </svg>
      </span>
    );
  };

  const sortedDisplayedServices = useMemo(() => {
    const list = [...displayedServices];
    const directionMultiplier = tableSort.direction === 'asc' ? 1 : -1;
    const getPrice = (service) => {
      const annual = getServiceAnnualPrice(service);
      return typeof annual === 'number' ? annual : 0;
    };
    const getAddonCount = (service) => {
      const raw = Array.isArray(service?.addons)
        ? service.addons
        : Array.isArray(service?.addOns)
          ? service.addOns
          : [];
      return raw.length;
    };

    return list.sort((a, b) => {
      const newPriority = Number(isNewCatalogService(b)) - Number(isNewCatalogService(a));
      if (newPriority !== 0) return newPriority;

      if (tableSort.key === 'price') {
        return (getPrice(a) - getPrice(b)) * directionMultiplier;
      }

      if (tableSort.key === 'addons') {
        return (getAddonCount(a) - getAddonCount(b)) * directionMultiplier;
      }

      if (tableSort.key === 'migrations') {
        const migrationsA = Array.isArray(a.migrationPaths) ? a.migrationPaths.length : 0;
        const migrationsB = Array.isArray(b.migrationPaths) ? b.migrationPaths.length : 0;
        return (migrationsA - migrationsB) * directionMultiplier;
      }

      const valueA = String(a.name ?? '').toLowerCase();
      const valueB = String(b.name ?? '').toLowerCase();
      return valueA.localeCompare(valueB) * directionMultiplier;
    });
  }, [displayedServices, tableSort]);

  const totalPages = Math.max(1, Math.ceil(sortedDisplayedServices.length / SERVICES_PER_PAGE));
  const paginatedServices = useMemo(
    () => sortedDisplayedServices.slice((currentPage - 1) * SERVICES_PER_PAGE, currentPage * SERVICES_PER_PAGE),
    [currentPage, sortedDisplayedServices],
  );
  const hasManageServicesModalOpen = Boolean(
    showAddModal
    || billingModalClient
    || (showDiscountModal && discountTargetService)
    || (showPricingLogsModal && pricingLogsService)
    || addonsPreviewService
    || selectedCancellationService
    || (showClientProfile && selectedServiceSubscribers)
    || (showOrderModal && selectedOrderForReview),
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [servicesSearch, statusFilter, priceFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    const modalClassName = 'manage-services-modal-open';

    if (!hasManageServicesModalOpen) {
      document.body.classList.remove(modalClassName);
      return undefined;
    }

    document.body.classList.add(modalClassName);

    return () => {
      document.body.classList.remove(modalClassName);
    };
  }, [hasManageServicesModalOpen]);

  const pendingOrders = useMemo(
    () => adminPurchases.filter((purchase) => purchase.status === 'Pending Review' && (!selectedClient || clientMatchesRecord(selectedClient, purchase.client, purchase.clientEmail))),
    [adminPurchases, selectedClient],
  );

  const pendingCancellationServices = useMemo(
    () => adminServices.filter((service) => service.cancellationRequest?.statusKey === 'pending' && (!selectedClient || clientMatchesRecord(selectedClient, service.client, service.clientEmail))),
    [adminServices, selectedClient],
  );

  const resetForm = () => {
    setForm({
      clientId: '',
      name: '',
      description: '',
      category: 'Domains',
      price: '',
      billingCycle: 'monthly',
      addonEntries: [createAddonDraft()],
    });
    setError('');
    setSelectedCatalogServiceId('');
    setIsPriceCustomized(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setEditingService(null);
    resetForm();
  };

  const openAddModal = (service = null) => {
    setMessage('');
    setError('');
    if (service) {
      const existingAddons = getServiceAddons(service);
      const serviceBillingCycle = normalizeBillingCycle(
        service.billingCycle ?? service.billing_cycle ?? service.billing?.cycle ?? service.billing,
        'yearly',
      ) || 'yearly';
      const addonEntries = existingAddons.length
        ? existingAddons.map((addon, index) => createAddonDraft({
            id: `addon-${service.id ?? 'service'}-${index}`,
            persistedId: addon.persistedId,
            label: addon.label,
            price: typeof addon.price === 'number' ? String(addon.price) : '',
            billingCycle: addon.billingCycle ?? serviceBillingCycle,
          }))
        : [createAddonDraft({ billingCycle: serviceBillingCycle })];

      setEditingService(service);
      setForm({
        clientId: '',
        name: service.name ?? '',
        description: service.description ?? '',
        category: service.category ?? 'Domains',
        price: String(getServiceAnnualPrice(service) ?? ''),
        billingCycle: 'yearly',
        addonEntries,
      });
      // Try to pre-select the matching catalog service for quick reuse
      const matchedIndex = catalogServices.findIndex((s) => String(s.id) === String(service.id) || (s.name && s.name === service.name));
      setSelectedCatalogServiceId(matchedIndex !== -1 ? String(matchedIndex) : '');
      setIsPriceCustomized(true);
    } else {
      setEditingService(null);
      resetForm();
    }
    setShowAddModal(true);
  };

  const handleAddService = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsCreating(true);

    try {
      const linkedClient = eligibleClients.find((client) => String(client.id) === String(form.clientId)) ?? null;

      if (!editingService && !linkedClient) {
        throw new Error('Select a client company before adding a new service.');
      }

      const normalizedDefaultCycle = normalizeBillingCycle(form.billingCycle, 'yearly') || 'yearly';
      const addonPayload = form.addonEntries
        .map((addonEntry, index) => {
          if (isAddonDraftEmpty(addonEntry)) {
            return null;
          }

          const label = String(addonEntry.label ?? '').trim();
          const rawPrice = String(addonEntry.price ?? '').trim();

          if (!label) {
            throw new Error(`Add-on row ${index + 1} is missing a name.`);
          }

          if (!rawPrice) {
            throw new Error(`Add-on row ${index + 1} is missing an amount.`);
          }

          const parsedPrice = Number(rawPrice);
          if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
            throw new Error(`Add-on row ${index + 1} has an invalid amount. Use a numeric value like 780 or 3000.`);
          }

          const normalizedAddonCycle = normalizeBillingCycle(addonEntry.billingCycle, normalizedDefaultCycle) || normalizedDefaultCycle;
          const persistedId = addonEntry.persistedId ?? null;

          return {
            ...(persistedId ? {
              id: persistedId,
              addonId: persistedId,
              addon_id: persistedId,
              serviceAddonId: persistedId,
              service_addon_id: persistedId,
            } : {}),
            label,
            name: label,
            price: parsedPrice,
            extraPrice: parsedPrice,
            extra_price: parsedPrice,
            billingCycle: normalizedAddonCycle,
            billing_cycle: normalizedAddonCycle,
          };
        })
        .filter(Boolean);

      const payload = {
        name: form.name,
        description: form.description,
        category: form.category,
        price: Number(form.price),
        billingCycle: normalizedDefaultCycle,
        billing_cycle: normalizedDefaultCycle,
        ...(addonPayload.length ? {
          addons: addonPayload,
          add_ons: addonPayload,
        } : {}),
      };
      const response = editingService
        ? await updateCatalogService(editingService.id, payload)
        : await createCatalogService(payload);
      const createdCatalogServiceId = response?.service?.id ?? response?.serviceId ?? response?.service_id ?? response?.id ?? null;
      let postSaveWarning = '';
      let successMessage = response?.message ?? (editingService ? 'Service updated successfully.' : 'Service created successfully.');

      if (!editingService && linkedClient) {
        if (createdCatalogServiceId === null || createdCatalogServiceId === undefined || createdCatalogServiceId === '') {
          postSaveWarning = `Catalog service saved, but it could not be linked to ${getClientDisplayName(linkedClient)} because the new service ID was missing from the response.`;
        } else {
          const renewalDate = getNextRenewalDate(normalizedDefaultCycle);
          const clientLabel = getClientDisplayName(linkedClient);
          const linkedServiceStatus = 'undergoing_provisioning';

          try {
            await createAdminService({
              userId: linkedClient.id,
              user_id: linkedClient.id,
              serviceId: createdCatalogServiceId,
              service_id: createdCatalogServiceId,
              name: payload.name,
              category: payload.category,
              plan: payload.name,
              status: linkedServiceStatus,
              renewsOn: renewalDate,
              renews_on: renewalDate,
              billing: normalizedDefaultCycle,
              billingCycle: normalizedDefaultCycle,
              billing_cycle: normalizedDefaultCycle,
              client: clientLabel,
              clientName: clientLabel,
              customer: clientLabel,
              company: linkedClient.company ?? clientLabel,
              clientEmail: linkedClient.email ?? '',
              customerEmail: linkedClient.email ?? '',
              email: linkedClient.email ?? '',
            });
            successMessage = `${successMessage} Linked to ${clientLabel}.`;
          } catch (linkError) {
            postSaveWarning = `Catalog service saved, but linking it to ${clientLabel} failed: ${linkError.message}`;
          }
        }
      }

      // Ensure immediate visibility in the table while backend list sync catches up.
      if (editingService) {
        setLocalCatalogServices((current) => {
          const nextService = {
            ...editingService,
            ...payload,
            basePrice: payload.price,
            addons: payload.addons,
            updatedAt: new Date().toISOString(),
          };

          const existingIndex = current.findIndex((service) => String(service.id) === String(editingService.id));
          if (existingIndex === -1) {
            return [nextService, ...current];
          }

          return current.map((service) => (
            String(service.id) === String(editingService.id)
              ? nextService
              : service
          ));
        });
      } else {
        const fallbackId = `local-${Date.now()}`;
        const createdService = {
          id: response?.service?.id ?? response?.id ?? fallbackId,
          name: payload.name,
          description: payload.description,
          category: payload.category,
          price: payload.price,
          basePrice: payload.price,
          billingCycle: payload.billingCycle,
          addons: payload.addons,
          createdAt: response?.service?.createdAt ?? response?.createdAt ?? new Date().toISOString(),
        };

        setLocalCatalogServices((current) => [createdService, ...current]);
      }

      closeAddModal();

      if (postSaveWarning) {
        setError(postSaveWarning);
      } else {
        setMessage(successMessage);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsCreating(false);
    }
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

  const handleViewClientFromService = (service) => {
    setSelectedServiceSubscribers(service);
    setShowClientProfile(true);
  };

  const openCancellationModal = (service) => {
    setSelectedCancellationService(service);
    setCancellationReason(service.cancellationRequest?.reason ?? '');
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

  const closeCancellationModal = () => {
    setSelectedCancellationService(null);
    setCancellationReason('');
  };

  const handleQueueCancellation = async (event) => {
    event.preventDefault();

    if (!selectedCancellationService) {
      return;
    }

    setIsQueueingCancellation(true);
    setError('');

    try {
      const response = await requestServiceCancellation(selectedCancellationService.id, cancellationReason.trim());
      setMessage(response.message);
      closeCancellationModal();
    } catch (requestError) {
      setError(requestError.message);
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
    setSelectedOrderForReview(order);
    setShowOrderModal(true);
  };

  const closeOrderModal = () => {
    setSelectedOrderForReview(null);
    setShowOrderModal(false);
  };

  const handleApproveCancellation = async (serviceId) => {
    setProcessingCancellationId(serviceId);
    setError('');

    try {
      const response = await approveServiceCancellation(serviceId);
      setMessage(response.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setProcessingCancellationId('');
    }
  };

  const handleRejectCancellation = async (serviceId) => {
    setProcessingCancellationId(serviceId);
    setError('');

    try {
      const response = await rejectServiceCancellation(serviceId);
      setMessage(response.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setProcessingCancellationId('');
    }
  };

  const openAddonsPreview = (service) => {
    setAddonsPreviewService(service);
  };

  const closeAddonsPreview = () => {
    setAddonsPreviewService(null);
  };

  const handleAddAddonRow = () => {
    setForm((current) => ({
      ...current,
      addonEntries: [...current.addonEntries, createAddonDraft({ billingCycle: current.billingCycle })],
    }));
  };

  const handleAddonFieldChange = (addonId, field, value) => {
    setForm((current) => ({
      ...current,
      addonEntries: current.addonEntries.map((addonEntry) => (
        addonEntry.id === addonId
          ? { ...addonEntry, [field]: value }
          : addonEntry
      )),
    }));
  };

  const handleRemoveAddonRow = (addonId) => {
    setForm((current) => {
      const nextEntries = current.addonEntries.filter((addonEntry) => addonEntry.id !== addonId);

      return {
        ...current,
        addonEntries: nextEntries.length ? nextEntries : [createAddonDraft({ billingCycle: current.billingCycle })],
      };
    });
  };

  const selectCatalogByIndex = (idx) => {
    const index = Number(idx);
    if (!Number.isFinite(index) || index < 0) {
      setSelectedCatalogServiceId('');
      setIsPriceCustomized(true);
      setForm((current) => ({ ...current, price: '' }));
      return;
    }

    const svc = catalogServices[index];
    if (!svc) {
      setSelectedCatalogServiceId('');
      setIsPriceCustomized(true);
      return;
    }

    const price = getServiceAnnualPrice(svc);
    const billingCycle = 'yearly';
    const serviceAddons = getServiceAddons(svc);
    const addonEntries = serviceAddons.length
      ? serviceAddons.map((addon, addonIndex) => createAddonDraft({
          id: `catalog-addon-${svc.id ?? 'service'}-${addonIndex}`,
          persistedId: addon.persistedId,
          label: addon.label,
          price: typeof addon.price === 'number' ? String(addon.price) : '',
          billingCycle: addon.billingCycle ?? billingCycle,
        }))
      : [createAddonDraft({ billingCycle })];

    setSelectedCatalogServiceId(String(index));
    setForm((current) => ({
      ...current,
      name: svc.name ?? current.name,
      description: svc.description ?? current.description,
      price: price !== null && price !== undefined ? String(price) : '',
      category: svc.category ?? current.category,
      billingCycle,
      addonEntries,
    }));
    setIsPriceCustomized(false);
  };

  const handleSelectCatalogService = (event) => {
    const idx = Number(event.target.value);
    selectCatalogByIndex(Number.isFinite(idx) ? idx : -1);
  };

  const handleToggleServiceStatus = async (service) => {
    const currentStatus = (service.status ?? '').toLowerCase();
    const nextStatus = currentStatus === 'active' ? 'Expired' : 'Active';

    setStatusUpdatingServiceId(service.id);
    setError('');

    try {
      await updateServiceStatus(service.id, nextStatus);
      setMessage(`${service.name} is now ${nextStatus}.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setStatusUpdatingServiceId('');
    }
  };

  const getServiceAddons = (service) => {
    const serviceBillingCycle = normalizeBillingCycle(
      service?.billingCycle ?? service?.billing_cycle ?? service?.billing?.cycle ?? service?.billing,
      '',
    );
    const rawAddons = Array.isArray(service?.addons)
      ? service.addons
      : Array.isArray(service?.addOns)
        ? service.addOns
        : [];

    return rawAddons
      .map((addon) => {
        if (typeof addon === 'string') {
          const [rawLabel, rawPrice = '', rawBillingCycle = ''] = addon.split('|').map((part) => part.trim());
          const parsedPrice = rawPrice === '' ? Number.NaN : Number(rawPrice);
          const billingCycle = normalizeBillingCycle(rawBillingCycle, serviceBillingCycle);
          const label = rawLabel || addon.trim();

          return label
            ? {
                persistedId: null,
                label,
                price: Number.isFinite(parsedPrice) ? parsedPrice : null,
                billingCycle: billingCycle || null,
              }
            : null;
        }

        if (!addon || typeof addon !== 'object') {
          return null;
        }

        const label = addon.label ?? addon.name ?? addon.title ?? addon.addon ?? '';
        if (!label) {
          return null;
        }

        const rawPrice = addon.price ?? addon.extraPrice ?? addon.extra_price;
        const parsedPrice = typeof rawPrice === 'number' ? rawPrice : Number(rawPrice);

        return {
          persistedId: getAddonPersistedId(addon),
          label,
          price: Number.isFinite(parsedPrice) ? parsedPrice : null,
          billingCycle: getAddonBillingCycle(addon, serviceBillingCycle) || null,
        };
      })
      .filter(Boolean);
  };

  const manageServicesHeaderAction = (
    <div className="flex w-full justify-end">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="relative w-full sm:w-[280px] xl:w-[320px]">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            value={servicesSearch}
            onChange={(event) => setServicesSearch(event.target.value)}
            placeholder="Search services"
            className="input w-full pl-11"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-2 text-sm text-slate-200 outline-none sm:w-auto"
        >
          <option value="All">All categories</option>
          {serviceCategories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <select
          value={priceFilter}
          onChange={(event) => setPriceFilter(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-2 text-sm text-slate-200 outline-none sm:w-auto"
        >
          <option value="Price: Low to High">Price: Low to High</option>
          <option value="Price: High to Low">Price: High to Low</option>
          <option value="Most Popular">Most Popular</option>
        </select>

        <button type="button" onClick={() => openAddModal()} className="btn-primary gap-2 px-3 py-2">
          <Plus size={16} /> Add Service
        </button>

        <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/70 p-1">
          <button type="button" onClick={() => setViewMode('grid')} className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${viewMode === 'grid' ? 'bg-orange-400 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`} aria-label="Grid view">
            <LayoutGrid size={16} />
          </button>
          <button type="button" onClick={() => setViewMode('list')} className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${viewMode === 'list' ? 'bg-orange-400 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`} aria-label="List view">
            <List size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {showAddModal ? (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm">
          <form onSubmit={handleAddService} className="panel my-4 w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Service Management</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{editingService ? 'Edit Service' : 'Add New Service'}</h2>
                <p className="mt-2 text-sm text-slate-400">{editingService ? 'Update service details and add-ons.' : 'Create a new service offering and link it to a client company.'}</p>
              </div>
              <button type="button" onClick={closeAddModal} className="btn-secondary px-4">Close</button>
            </div>

            {error ? <div className="mt-6 rounded-2xl border border-orange-400/30 bg-orange-400/10 px-4 py-3 text-sm text-orange-100">{error}</div> : null}

            <div className="mt-6 grid gap-x-4 gap-y-3 md:grid-cols-2 items-start">
              <label className="block text-sm text-slate-300 md:col-span-2">
                Choose from Catalog (optional)
                <div className="relative mt-2">
                  <button
                    type="button"
                    ref={catalogButtonRef}
                    onClick={() => setIsCatalogMenuOpen((s) => !s)}
                    aria-haspopup="menu"
                    aria-expanded={isCatalogMenuOpen}
                    className="input mt-0 w-full flex items-center justify-between"
                  >
                    <span className={selectedCatalogServiceId ? 'text-white' : 'text-slate-500'}>
                      {selectedCatalogServiceId
                        ? (catalogServices[Number(selectedCatalogServiceId)]?.name ?? 'Selected')
                        : '— Select a catalog service to auto-fill —'}
                    </span>
                    <ChevronDown size={16} />
                  </button>

                  {isCatalogMenuOpen ? (
                    <div ref={catalogMenuRef} className="absolute z-50 mt-2 w-full rounded-xl border border-white/10 bg-slate-900/95 shadow-lg max-h-60 overflow-auto">
                      <ul className="divide-y divide-white/6">
                        <li>
                          <button
                            type="button"
                            onClick={() => { selectCatalogByIndex(-1); setIsCatalogMenuOpen(false); }}
                            className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
                          >
                            Clear selection
                          </button>
                        </li>
                        {catalogServices.map((svc, idx) => (
                          <li key={svc.id ?? `${svc.name}-${idx}`}>
                            <button
                              type="button"
                              onClick={() => { selectCatalogByIndex(idx); setIsCatalogMenuOpen(false); }}
                              className="w-full text-left px-3 py-3 hover:bg-white/5"
                            >
                              <div className="flex justify-between">
                                <div className="text-sm text-white">{svc.name}{svc.category ? ` • ${svc.category}` : ''}</div>
                                <div className="text-sm text-slate-400">{formatCurrency(getServiceAnnualPrice(svc) ?? 0)} <span className="text-[11px] text-slate-400">per annum</span></div>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </label>

              {!editingService ? (
                <label className="block text-sm text-slate-300 md:col-span-2">
                  Client Name
                  <select
                    className="input mt-2"
                    value={form.clientId}
                    onChange={(event) => setForm((current) => ({ ...current, clientId: event.target.value }))}
                    required
                    disabled={!eligibleClients.length}
                  >
                    <option value="">{eligibleClients.length ? 'Select the company account for this service' : 'No approved clients available'}</option>
                    {eligibleClients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {getClientDisplayName(client)}{client.email ? ` • ${client.email}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">Services are linked to the client company selected here.</p>
                </label>
              ) : null}

              <label className="block text-sm text-slate-300">
                Service Name
                <input
                  className="input mt-2"
                  value={form.name}
                  onChange={(event) => {
                    setSelectedCatalogServiceId('');
                    setIsPriceCustomized(true);
                    setForm((current) => ({ ...current, name: event.target.value }));
                  }}
                  placeholder="e.g. Enterprise Cloud VPS"
                  required
                />
              </label>

              <label className="block text-sm text-slate-300">
                Amount
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input flex-1"
                    value={form.price}
                    onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                    placeholder="0.00"
                    required
                    readOnly={!isPriceCustomized}
                  />
                  {!isPriceCustomized ? (
                    <button type="button" onClick={() => setIsPriceCustomized(true)} className="btn-secondary px-3 py-2">
                      Customize
                    </button>
                  ) : (selectedCatalogServiceId ? (
                    <button
                      type="button"
                      onClick={() => {
                        const idx = Number(selectedCatalogServiceId);
                        const svc = catalogServices[idx];
                        const price = getServiceAnnualPrice(svc);
                        setForm((current) => ({ ...current, price: price !== null && price !== undefined ? String(price) : '', billingCycle: 'yearly' }));
                        setIsPriceCustomized(false);
                      }}
                      className="btn-secondary px-3 py-2"
                    >
                      Use Catalog Price
                    </button>
                  ) : null)}
                </div>
              </label>

              <label className="block text-sm text-slate-300 md:col-span-2">
                Description
                <textarea className="input mt-2 min-h-28 resize-y" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Briefly describe the service offering..." />
              </label>

              <label className="block text-sm text-slate-300">
                Category
                <select className="input mt-2" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} required>
                  {['Domains', 'Shared Hosting', 'Dedicated Server'].map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-slate-300">
                Billing Cycle
                <select
                  className="input mt-2"
                  value={form.billingCycle}
                  onChange={(event) => {
                    const nextBillingCycle = event.target.value;
                    setForm((current) => ({
                      ...current,
                      billingCycle: nextBillingCycle,
                      addonEntries: current.addonEntries.map((addonEntry) => (
                        isAddonDraftEmpty(addonEntry)
                          ? { ...addonEntry, billingCycle: nextBillingCycle }
                          : addonEntry
                      )),
                    }));
                  }}
                  required
                >
                  {BILLING_CYCLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="block text-sm text-slate-300 md:col-span-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p>Add-ons (optional)</p>
                    <p className="mt-1 text-xs text-slate-500">Add each add-on with its amount and billing cycle. Empty rows are ignored.</p>
                  </div>
                  <button type="button" onClick={handleAddAddonRow} className="btn-secondary gap-2 px-3 py-2 text-xs">
                    <Plus size={14} /> Add Add-on
                  </button>
                </div>

                <div className="mt-3 space-y-3">
                  {form.addonEntries.map((addonEntry, index) => (
                    <div key={addonEntry.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Add-on {index + 1}</p>
                        {form.addonEntries.length > 1 || !isAddonDraftEmpty(addonEntry) ? (
                          <button type="button" onClick={() => handleRemoveAddonRow(addonEntry.id)} className="text-xs font-medium text-slate-400 transition hover:text-white">
                            Remove
                          </button>
                        ) : null}
                      </div>

                      <div className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_0.9fr]">
                        <label className="block text-xs uppercase tracking-[0.16em] text-slate-500">
                          Add-on Name
                          <input
                            className="input mt-2"
                            value={addonEntry.label}
                            onChange={(event) => handleAddonFieldChange(addonEntry.id, 'label', event.target.value)}
                            placeholder="e.g. Whois Privacy"
                          />
                        </label>

                        <label className="block text-xs uppercase tracking-[0.16em] text-slate-500">
                          Amount
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="input mt-2"
                            value={addonEntry.price}
                            onChange={(event) => handleAddonFieldChange(addonEntry.id, 'price', event.target.value)}
                            placeholder="0.00"
                          />
                        </label>

                        <label className="block text-xs uppercase tracking-[0.16em] text-slate-500">
                          Billing Cycle
                          <select
                            className="input mt-2"
                            value={addonEntry.billingCycle}
                            onChange={(event) => handleAddonFieldChange(addonEntry.id, 'billingCycle', event.target.value)}
                          >
                            {BILLING_CYCLE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeAddModal} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={isCreating} className="btn-primary disabled:opacity-60">
                {isCreating ? (editingService ? 'Saving...' : 'Adding...') : (editingService ? 'Save Changes' : 'Add New Service')}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {billingModalClient ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <form onSubmit={handleSaveBilling} className="panel w-full max-w-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Billing Details</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{billingModalClient.name}</h2>
                <p className="mt-2 text-sm text-slate-400">Update address, TIN, and contact information for this client.</p>
              </div>
              <button type="button" onClick={closeBillingModal} className="btn-secondary px-4">Close</button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-slate-300">
                Company
                <input className="input mt-2" value={billingForm.company} onChange={(event) => setBillingForm((current) => ({ ...current, company: event.target.value }))} />
              </label>
              <label className="block text-sm text-slate-300">
                Billing Email
                <input type="email" className="input mt-2" value={billingForm.email} onChange={(event) => setBillingForm((current) => ({ ...current, email: event.target.value }))} required />
              </label>
              <label className="block text-sm text-slate-300 md:col-span-2">
                Billing Address
                <input className="input mt-2" value={billingForm.address} onChange={(event) => setBillingForm((current) => ({ ...current, address: event.target.value }))} />
              </label>
              <label className="block text-sm text-slate-300">
                TIN
                <input className="input mt-2" value={billingForm.tin} onChange={(event) => setBillingForm((current) => ({ ...current, tin: event.target.value }))} placeholder="000-000-000-000" />
              </label>
              <label className="block text-sm text-slate-300">
                Contact Number
                <input className="input mt-2" value={billingForm.mobileNumber} onChange={(event) => setBillingForm((current) => ({ ...current, mobileNumber: event.target.value }))} />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeBillingModal} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={isSavingBilling} className="btn-primary disabled:opacity-60">
                {isSavingBilling ? 'Saving...' : 'Save Billing Details'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

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

      {addonsPreviewService ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="panel w-full max-w-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Service Add-ons</p>
                <h2 className="mt-2 text-lg font-semibold text-white">{addonsPreviewService.name}</h2>
              </div>
              <button type="button" onClick={closeAddonsPreview} className="btn-secondary px-3">Close</button>
            </div>

            <div className="mt-6 overflow-auto">
              {getServiceAddons(addonsPreviewService).length ? (
                <table className="min-w-full text-left text-sm text-slate-200">
                  <thead className="text-slate-400">
                    <tr>
                      <th className="px-4 py-2">Add-on</th>
                      <th className="px-4 py-2">Price</th>
                      <th className="px-4 py-2">Billing Cycle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getServiceAddons(addonsPreviewService).map((addon, index) => (
                      <tr key={`addons-preview-${index}`} className="border-t border-white/6">
                        <td className="px-4 py-3 text-slate-300">{addon.label}</td>
                        <td className="px-4 py-3">{typeof addon.price === 'number' ? formatCurrency(addon.price) : '—'}</td>
                        <td className="px-4 py-3">{getBillingCycleLabel(addon.billingCycle)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-sm text-slate-400">No add-ons available for this service.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

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

      {showClientProfile && selectedServiceSubscribers ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="panel max-h-[82vh] w-full max-w-2xl overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Service Subscribers</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Active Subscribers: {selectedServiceSubscribers.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowClientProfile(false);
                  setSelectedServiceSubscribers(null);
                }}
                className="btn-secondary px-4"
              >
                Close
              </button>
            </div>

            <div className="max-h-[calc(82vh-92px)] space-y-3 overflow-y-auto px-6 py-5">
              {subscribedClients.length ? subscribedClients.map((subscriber) => (
                <div key={subscriber.key} className="panel-muted rounded-2xl p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-white">{subscriber.name}</p>
                      <p className="mt-1 text-sm text-slate-400">{subscriber.email}</p>
                      <p className="mt-2 text-xs text-slate-500">Renewing: {formatDate(subscriber.renewsOn)}</p>
                    </div>
                    <StatusBadge status={subscriber.status} />
                  </div>
                </div>
              )) : (
                <div className="panel-muted rounded-2xl p-4 text-sm text-slate-400">
                  No subscribed clients found for this service.
                </div>
              )}
            </div>
          </div>
        </div>, document.body
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
                {getDesiredDomainValue(selectedOrderForReview) ? (
                  <>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">Customer Note / Desired Domain</p>
                    <p className="mt-2 break-all text-sm text-slate-300">{getDesiredDomainValue(selectedOrderForReview)}</p>
                  </>
                ) : null}
              </div>

              <div className="panel-muted p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Payment proof</p>
                {selectedOrderForReview.payments && selectedOrderForReview.payments.length ? (
                  (() => {
                    const proof = selectedOrderForReview.payments.find((p) => p.transactionRef);
                    if (!proof) return <p className="mt-2 text-sm text-slate-400">No proof uploaded.</p>;
                    const proofPath = proof.transactionRef?.startsWith('payment_proofs/') ? proof.transactionRef : `payment_proofs/${proof.transactionRef}`;
                    const proofUrl = `${BACKEND_ORIGIN}/storage/${proofPath}`;

                    return (
                      <div className="mt-2 flex items-start gap-4">
                        <div className="flex flex-col items-start gap-3">
                          <a href={proofUrl} target="_blank" rel="noreferrer" className="block max-w-[320px] overflow-hidden rounded-lg border border-white/8">
                            <img src={proofUrl} alt="Payment proof" className="h-28 w-48 object-cover" />
                          </a>
                          <div className="flex items-center gap-3">
                            <a href={proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-200 hover:bg-white/[0.06]">
                              View / Download
                            </a>
                            <p className="text-sm text-slate-300">Uploaded {proof.createdAt ? formatDate(proof.createdAt) : '—'}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <p className="mt-2 text-sm text-slate-400">No proof uploaded.</p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">

              <button type="button" onClick={async () => { await handleApproveOrder(selectedOrderForReview.id); closeOrderModal(); }} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 text-white px-4 py-2 hover:bg-emerald-500">
                <ShieldCheck size={16} /> Approve Order
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PageHeader eyebrow="Manage Services" title="All Services" action={manageServicesHeaderAction} />

      {error ? (
        <div className="mt-6 rounded-2xl border border-orange-400/30 bg-orange-400/10 px-4 py-3 text-sm text-orange-100">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="mt-6 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-sm text-sky-100">
          {message}
        </div>
      ) : null}


      <div className="mt-8">
        {viewMode === 'list' ? (
          <div className="panel mt-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10 text-left">
                <thead className="bg-white/5 text-sm text-slate-400">
                <tr>
                  <th className="px-5 py-4 text-center font-semibold text-white">
                    <button type="button" onClick={() => handleTableSort('name')} className="inline-flex items-center gap-1 hover:text-sky-200">
                      <span>Service Name</span>
                      {renderTableSortIndicator('name')}
                    </button>
                  </th>
                  <th className="px-5 py-4 text-center font-semibold text-white">
                    <button type="button" onClick={() => handleTableSort('price')} className="inline-flex items-center gap-1 hover:text-sky-200">
                      <span>Base Price</span>
                      {renderTableSortIndicator('price')}
                    </button>
                  </th>
                  {/* Add-ons shown under Service Name; no separate column */}
                  <th className="px-5 py-4 text-center font-semibold text-white">
                    <button type="button" onClick={() => handleTableSort('migrations')} className="inline-flex items-center gap-1 hover:text-sky-200">
                      <span>Migration Paths</span>
                      {renderTableSortIndicator('migrations')}
                    </button>
                  </th>
                  <th className="px-5 py-4 text-center font-semibold text-white">Actions</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-transparent text-sm text-slate-200">
                  {paginatedServices.length ? paginatedServices.map((service) => {
                    const addons = getServiceAddons(service);
                    const visibleAddons = addons.slice(0, 2);
                    const remainingAddonCount = addons.length - visibleAddons.length;

                    return (
                    <tr key={`all-${service.id}`} className="table-row-hoverable">
                      <td className="px-5 py-4 align-top">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/admin/services/${service.id}`}
                            state={{ service }}
                            className="font-semibold text-sky-300 transition hover:text-sky-200"
                          >
                            {service.name}
                          </Link>
                          {isNewCatalogService(service) ? <StatusBadge status="New" /> : null}
                        </div>
                        <p className="mt-1 text-sm text-slate-400">{service.category}</p>
                        <div className="mt-2">
                          <div className="flex flex-wrap gap-2">
                            {addons.length ? visibleAddons.map((addon, i) => (
                              <span key={`addon-${service.id}-${i}`} title={`${addon.label}${typeof addon.price === 'number' ? ` • ${formatCurrency(addon.price)}` : ''}${addon.billingCycle ? ` • ${getBillingCycleLabel(addon.billingCycle)}` : ''}`} className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
                                {addon.label.length > 28 ? `${addon.label.slice(0, 28)}...` : addon.label}
                              </span>
                            )) : (
                              <span className="text-sm text-slate-500">—</span>
                            )}
                            {remainingAddonCount > 0 ? (
                              <button
                                type="button"
                                onClick={() => openAddonsPreview(service)}
                                className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-white/10"
                              >
                                +{remainingAddonCount} more
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        {typeof getServiceAnnualPrice(service) === 'number' ? (
                          <p className="font-semibold text-sky-300">{formatCurrency(getServiceAnnualPrice(service))} <span className="text-sm text-slate-400">per annum</span></p>
                        ) : (
                          <span className="text-sm text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 align-top">
                        {service.migrationPaths && service.migrationPaths.length ? (
                          <div className="flex flex-col gap-2">
                            {service.migrationPaths.map((m, i) => (
                              <span key={`mig-${service.id}-${i}`} className="inline-flex items-center rounded-md bg-white/5 px-3 py-1 text-sm text-slate-300">→ {m}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleViewClientFromService(service)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-300 bg-white text-slate-800 shadow-sm transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
                            title="View client"
                            aria-label={`View client for ${service.name}`}
                          >
                            <Eye size={16} color="#111827" strokeWidth={2.3} className="dark:!text-slate-100" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDiscountModal(service)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-300 bg-emerald-100 text-emerald-800 shadow-sm transition hover:bg-emerald-200 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-100 dark:hover:bg-emerald-400/20"
                            title="Apply discount"
                            aria-label={`Apply discount to ${service.name}`}
                          >
                            <Percent size={16} color="#111827" strokeWidth={2.3} className="dark:!text-emerald-100" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openPricingLogs(service)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-300 bg-sky-100 text-sky-800 shadow-sm transition hover:bg-sky-200 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-100 dark:hover:bg-sky-400/20"
                            title="View pricing logs"
                            aria-label={`View pricing logs for ${service.name}`}
                          >
                            <CreditCard size={16} color="#111827" strokeWidth={2.3} className="dark:!text-sky-100" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleServiceStatus(service)}
                            disabled={statusUpdatingServiceId === service.id}
                            className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition disabled:bg-white/10 disabled:border-white/6 disabled:text-slate-400 disabled:opacity-80 ${service.status === 'Active' ? 'bg-rose-400 text-white hover:bg-rose-500' : 'bg-emerald-400 text-white hover:bg-emerald-500'}`}
                            title={service.status === 'Active' ? 'Disable service' : 'Enable service'}
                            aria-label={`${service.status === 'Active' ? 'Disable' : 'Enable'} ${service.name}`}
                          >
                            {service.status === 'Active'
                              ? <XCircle size={16} strokeWidth={2.3} />
                              : <CheckCircle2 size={16} strokeWidth={2.3} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => openAddModal(service)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-violet-300 bg-violet-100 text-violet-800 shadow-sm transition hover:bg-violet-200 dark:border-violet-400/25 dark:bg-violet-400/10 dark:text-violet-100 dark:hover:bg-violet-400/20"
                            title="Edit service"
                            aria-label={`Edit ${service.name}`}
                          >
                            <PencilLine size={16} color="#111827" strokeWidth={2.3} className="dark:!text-violet-100" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={4} className="px-5 py-12 text-center text-slate-400">No services match your filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paginatedServices.length ? paginatedServices.map((service) => {
              const addons = getServiceAddons(service);
              const visibleAddons = addons.slice(0, 2);
              const remainingAddonCount = addons.length - visibleAddons.length;

              return (
              <div key={`card-${service.id}`} className="panel-muted rounded-3xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/admin/services/${service.id}`}
                        state={{ service }}
                        className="text-base font-semibold text-sky-300 transition hover:text-sky-200"
                      >
                        {service.name}
                      </Link>
                      {isNewCatalogService(service) ? <StatusBadge status="New" /> : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{service.category}</p>
                  </div>
                  <StatusBadge status={service.status} />
                </div>

                <p className="mt-4 text-xl font-semibold text-sky-300">
                  {typeof getServiceAnnualPrice(service) === 'number' ? `${formatCurrency(getServiceAnnualPrice(service))} per annum` : '—'}
                </p>

                <div className="mt-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Add-ons</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {addons.length ? visibleAddons.map((addon, index) => (
                      <span key={`addon-card-${service.id}-${index}`} title={`${addon.label}${typeof addon.price === 'number' ? ` • ${formatCurrency(addon.price)}` : ''}${addon.billingCycle ? ` • ${getBillingCycleLabel(addon.billingCycle)}` : ''}`} className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-medium text-sky-700">
                        {addon.label.length > 24 ? `${addon.label.slice(0, 24)}...` : addon.label}
                      </span>
                    )) : (
                      <span className="text-sm text-slate-500">—</span>
                    )}
                    {remainingAddonCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => openAddonsPreview(service)}
                        className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-200 transition hover:bg-white/10"
                      >
                        +{remainingAddonCount} more
                      </button>
                    ) : (
                      null
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Migration Paths</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {service.migrationPaths && service.migrationPaths.length ? service.migrationPaths.map((path, index) => (
                      <span key={`migration-card-${service.id}-${index}`} className="inline-flex items-center rounded-md bg-white/5 px-2.5 py-1 text-xs text-slate-300">→ {path}</span>
                    )) : (
                      <span className="text-sm text-slate-500">—</span>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button type="button" onClick={() => handleViewClientFromService(service)} className="btn-secondary px-3 py-1.5 text-xs">
                    <Eye size={14} /> View Client
                  </button>
                  <button type="button" onClick={() => openDiscountModal(service)} className="btn-secondary px-3 py-1.5 text-xs">
                    <Percent size={14} /> Discount
                  </button>
                  <button type="button" onClick={() => openPricingLogs(service)} className="btn-secondary px-3 py-1.5 text-xs">
                    <CreditCard size={14} /> Logs
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleServiceStatus(service)}
                    disabled={statusUpdatingServiceId === service.id}
                    className={`btn-secondary px-3 py-1.5 text-xs disabled:opacity-60 ${service.status === 'Active' ? 'bg-rose-400 text-white hover:bg-rose-500' : 'bg-emerald-400 text-white hover:bg-emerald-500'}`}
                  >
                    {service.status === 'Active' ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                    {service.status === 'Active' ? 'Disable' : 'Enable'}
                  </button>
                  <button type="button" onClick={() => openAddModal(service)} className="btn-secondary px-3 py-1.5 text-xs">
                    <PencilLine size={14} /> Edit
                  </button>
                </div>
              </div>
              );
            }) : (
              <div className="panel col-span-full p-8 text-center text-sm text-slate-400">
                No services match your filters.
              </div>
            )}
          </div>
        )}

        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      </div>
    </div>
  );
}
