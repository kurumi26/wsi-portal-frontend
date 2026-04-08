import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, Eye, MessageSquare, LayoutGrid, List, CheckCircle2, XCircle, CircleOff, Percent, CreditCard, PencilLine } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import UserAvatar from '../../components/common/UserAvatar';
import { usePortal } from '../../context/PortalContext';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format';
import { getCancellationReasonValue, getCustomerCommentValue, getDesiredDomainValue, isDomainOrder } from '../../utils/orders';
import StatusBadge from '../../components/common/StatusBadge';

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
  const SERVICES_PER_PAGE = 6;


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

  useEffect(() => {
    setServicesPage(1);
  }, [servicesSearchQuery, servicesStatusFilter, servicesViewMode, sortedServicesForPanel.length]);

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
                    {sortedServicesForPanel.length ? sortedServicesForPanel.map((service) => {
                      const hasPendingCancellation = service.cancellationRequest?.statusKey === 'pending';
                      const canQueueCancellation = !hasPendingCancellation && service.status !== 'Expired';

                      return (
                        <tr key={service.id} className="table-row-hoverable">
                          <td className="px-5 py-4 align-top">
                            <p className="font-semibold text-white">{service.name}</p>
                            <p className="mt-1 text-sm text-slate-400">{service.category} · {service.plan}</p>
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
                  <table className="min-w-full divide-y divide-white/10 text-left">
                    <thead className="bg-white/5 text-sm text-slate-400">
                      <tr>
                        <th className="px-5 py-4 font-semibold text-white">Service</th>
                        <th className="px-5 py-4 font-semibold text-white">Client</th>
                        <th className="px-5 py-4 font-semibold text-white">Base Price</th>
                        <th className="px-5 py-4 font-semibold text-white">Add-ons</th>
                        <th className="px-5 py-4 font-semibold text-white">Status</th>
                        <th className="px-5 py-4 font-semibold text-white">Update Status</th>
                        <th className="px-5 py-4 font-semibold text-white">Cancellation</th>
                        <th className="px-5 py-4 font-semibold text-white">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 bg-transparent text-sm text-slate-200">
                      {sortedServicesForPanel.map((service) => (
                        <tr key={`panel-${service.id}`} className="table-row-hoverable">
                          <td className="px-5 py-4 align-top">
                            <p className="font-semibold text-white">{service.name}</p>
                            <p className="mt-1 text-sm text-slate-400">{service.category} · {service.plan}</p>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <p className="font-medium text-white">{service.client || 'No client assigned'}</p>
                            {service.clientEmail ? <p className="mt-1 text-sm text-slate-400">{service.clientEmail}</p> : null}
                          </td>
                          <td className="px-5 py-4 align-top">{typeof service.basePrice === 'number' ? <p className="font-semibold text-sky-300">{formatCurrency(service.basePrice)}</p> : <span className="text-sm text-slate-500">—</span>}</td>
                          <td className="px-5 py-4 align-top">{service.addons?.length ? <span className="text-sm text-slate-300">{service.addons.length} add-ons</span> : <span className="text-sm text-slate-500">No add-ons</span>}</td>
                          <td className="px-5 py-4 align-top"><StatusBadge status={service.status} /></td>
                          <td className="px-5 py-4 align-top"><select className="input w-40" value={service.status} onChange={(e) => updateServiceStatus(service.id, e.target.value)}>{statuses.map((st) => <option key={st} value={st}>{st}</option>)}</select></td>
                          <td className="px-5 py-4 align-top">{service.cancellationRequest ? <span className="text-sm text-orange-200">{service.cancellationRequest.status}</span> : <span className="text-sm text-slate-500">No request</span>}</td>
                          <td className="px-5 py-4 align-top">
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => openOrderModal({ serviceName: service.name, id: service.id })} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100" title="View"><Eye size={16} /></button>
                              <button type="button" onClick={() => openCancellationModal(service)} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/10 text-orange-100" title="Queue cancellation"><CircleOff size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {sortedServicesForPanel.map((service) => (
                    <div key={`card-${service.id}`} className="panel p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-medium text-white">{service.name}</p>
                          <p className="mt-1 text-sm text-slate-400">{service.category} · {service.plan}</p>
                        </div>
                        <StatusBadge status={service.status} />
                      </div>

                      <div className="mt-4">
                        <p className="text-sm text-slate-400">{service.addons?.length ? `${service.addons.length} add-ons` : 'No add-ons'}</p>
                        <p className="mt-2 text-xs text-slate-500">{typeof service.basePrice === 'number' ? formatCurrency(service.basePrice) : '—'}</p>
                      </div>

                      <div className="mt-4 flex justify-end gap-2">
                        <button type="button" onClick={() => openOrderModal({ serviceName: service.name, id: service.id })} className="btn-secondary px-3"><Eye size={16} /></button>
                        <button type="button" onClick={() => openCancellationModal(service)} className="btn-secondary border-orange-400/20 bg-orange-400/10 px-3 text-orange-100"><CircleOff size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="panel mt-6 px-5 py-12 text-center text-sm text-slate-400">No services match the current filters.</div>
            )}
          </>
        ) : (
          viewMode === 'list' ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10 text-left">
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
                        <div className="flex items-center justify-center gap-3">
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
                              ) : null}
                              <button type="button" onClick={() => openOrderModal(row.raw)} className="btn-secondary">View</button>
                              <button type="button" onClick={() => handleApproveOrder(row.raw.id)} disabled={processingOrderId === row.raw.id} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 text-white px-4 py-2 disabled:opacity-60 hover:bg-emerald-500">
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
                              ) : null}
                              <button type="button" onClick={() => handleRejectCancellation(row.raw.id)} disabled={processingCancellationId === row.raw.id} className="inline-flex items-center gap-2 rounded-2xl bg-rose-400 text-white px-4 py-2 disabled:opacity-60 hover:bg-rose-500">
                                <XCircle size={16} /> Keep Service
                              </button>
                              <button type="button" onClick={() => handleApproveCancellation(row.raw.id)} disabled={processingCancellationId === row.raw.id} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 text-white px-4 py-2 disabled:opacity-60 hover:bg-emerald-500">
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

                  <div className="mt-4 flex justify-end gap-2">
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
                        <button type="button" onClick={() => openOrderModal(row.raw)} className="btn-secondary px-3">View</button>
                        <button type="button" onClick={() => handleApproveOrder(row.raw.id)} disabled={processingOrderId === row.raw.id} className="btn-primary px-3">{processingOrderId === row.raw.id ? 'Approving...' : 'Approve'}</button>
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
                        <button type="button" onClick={() => handleRejectCancellation(row.raw.id)} disabled={processingCancellationId === row.raw.id} className="btn-secondary px-3">Keep</button>
                        <button type="button" onClick={() => handleApproveCancellation(row.raw.id)} disabled={processingCancellationId === row.raw.id} className="btn-primary px-3">{processingCancellationId === row.raw.id ? 'Approving...' : 'Approve'}</button>
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

      {/* All services management section with search, filter, and grid/list toggle */}

      <div className="mt-4 panel p-8">
         <PageHeader eyebrow="Clients Services" />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid flex-1 gap-4 md:grid-cols-[1fr_180px]">
            <label className="relative block">
              <span className="sr-only">Search services</span>
              <input type="text" value={servicesSearchQuery} onChange={e => setServicesSearchQuery(e.target.value)} placeholder="Search service, client, plan, or category" className="input pl-11" />
            </label>
            <select className="input" value={servicesStatusFilter} onChange={e => setServicesStatusFilter(e.target.value)}>
              <option value="All">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
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
                      <span>Base Price</span>
                      {renderServicesSortIndicator('price')}
                    </button>
                  </th>
                  <th className="px-5 py-4 font-semibold text-white">Add-ons</th>
                  <th className="px-5 py-4 font-semibold text-white">
                    <button type="button" onClick={() => handleServicesTableSort('status')} className="inline-flex items-center gap-1 hover:text-sky-200">
                      <span>Status</span>
                      {renderServicesSortIndicator('status')}
                    </button>
                  </th>
                  <th className="px-5 py-4 font-semibold text-white">Update Status</th>
                  <th className="px-5 py-4 font-semibold text-white">Cancellation</th>
                  <th className="px-5 py-4 font-semibold text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-transparent text-sm text-slate-200">
                {sortedServicesForPanel.length ? sortedServicesForPanel.map((service) => {
                  const hasPendingCancellation = service.cancellationRequest?.statusKey === 'pending';
                  const canQueueCancellation = !hasPendingCancellation && service.status !== 'Expired';
                  return (
                    <tr key={`svc-${service.id}`} className="table-row-hoverable">
                      <td className="px-5 py-4 align-top">
                        <p className="font-semibold text-white">{service.name}</p>
                        <p className="mt-1 text-sm text-slate-400">{service.category} · {service.plan}</p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="font-medium text-white">{service.client || 'John Doe'}</p>
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
                          <div className="inline-flex items-center gap-2">
                            <button className="inline-flex items-center rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">{service.addons.length} add-ons</button>
                          </div>
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
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-4 align-top">
                        {service.cancellationRequest ? (
                          <div>
                            <span className="text-sm text-orange-200">{service.cancellationRequest.status}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-500">No request</span>
                        )}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex justify-end gap-2">
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
                    <td colSpan={8} className="px-5 py-12 text-center text-slate-400">No services available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedServicesForPanel.length ? sortedServicesForPanel.map((service) => {
              const hasPendingCancellation = service.cancellationRequest?.statusKey === 'pending';
              const canQueueCancellation = !hasPendingCancellation && service.status !== 'Expired';
              return (
                <div key={`svc-card-${service.id}`} className="panel p-5 flex flex-col justify-between">
                  <div>
                    <p className="text-lg font-medium text-white">{service.name}</p>
                    <p className="mt-1 text-sm text-slate-400">{service.category} · {service.plan}</p>
                    <p className="mt-2 text-xs text-slate-500">{service.client || 'John Doe'}</p>
                    {service.clientEmail && <p className="text-xs text-slate-500">{service.clientEmail}</p>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 items-center">
                    <StatusBadge status={service.status} />
                    <span className="text-xs text-slate-400">{typeof service.basePrice === 'number' ? formatCurrency(service.basePrice) : '—'}</span>
                    {service.addons?.length ? <span className="text-xs text-slate-400">{service.addons.length} add-ons</span> : <span className="text-xs text-slate-500">No add-ons</span>}
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
                      {relatedServices.length ? relatedServices.map((service) => (
                        <div key={service.id} className="panel-muted rounded-3xl p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="font-medium text-white">{service.name}</p>
                              <p className="mt-1 text-sm text-slate-400">{service.category} • {service.plan}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                              <StatusBadge status={service.status} />
                              <span className="text-xs text-slate-500">Renews {formatDate(service.renewsOn)}</span>
                            </div>
                          </div>
                        </div>
                      )) : (
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
