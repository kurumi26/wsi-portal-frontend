import { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  CircleOff,
  CreditCard,
  Eye,
  LayoutGrid,
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
import StatusBadge from '../../components/common/StatusBadge';
import UserAvatar from '../../components/common/UserAvatar';
import { usePortal } from '../../context/PortalContext';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format';

const statuses = ['Active', 'Expired', 'Unpaid', 'Undergoing Provisioning'];

export default function ManageServicesPage() {
  const {
    adminServices,
    adminPurchases,
    clients,
    createCatalogService,
    updateServiceStatus,
    requestServiceCancellation,
    approveServiceCancellation,
    rejectServiceCancellation,
    approveAdminOrder,
    updateClientBilling,
  } = usePortal();
  const [servicesSearch, setServicesSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [viewMode, setViewMode] = useState('list');
  const [showAddModal, setShowAddModal] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [showClientProfile, setShowClientProfile] = useState(false);
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
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'Domains',
    price: '',
    billingCycle: 'monthly',
    addonLines: '',
  });

  const eligibleClients = useMemo(
    () => clients.filter((client) => client.registrationApproval?.statusKey !== 'pending' && client.registrationApproval?.statusKey !== 'rejected'),
    [clients],
  );

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
      (service) => service.clientEmail === selectedClient.email || service.client === selectedClient.name,
    );
    const relatedPurchases = adminPurchases.filter((purchase) => purchase.client === selectedClient.name);

    return {
      relatedServices,
      relatedPurchases,
      totalSpent: relatedPurchases.reduce((sum, purchase) => sum + purchase.amount, 0),
    };
  }, [adminPurchases, adminServices, selectedClient]);

  const BACKEND_ORIGIN = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/api\/?$/i, '');

  const filteredServices = useMemo(() => {
    return adminServices.filter((service) => {
      const matchesSearch = [service.name, service.category, service.plan, service.client, service.clientEmail]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(servicesSearch.toLowerCase()));

      const matchesStatus = statusFilter === 'All' || service.status === statusFilter;
      const matchesClient = !selectedClient || service.clientEmail === selectedClient.email || service.client === selectedClient.name;

      return matchesSearch && matchesStatus && matchesClient;
    });
  }, [adminServices, selectedClient, servicesSearch, statusFilter]);

  const pendingOrders = useMemo(
    () => adminPurchases.filter((purchase) => purchase.status === 'Pending Review' && (!selectedClient || purchase.client === selectedClient.name)),
    [adminPurchases, selectedClient],
  );

  const pendingCancellationServices = useMemo(
    () => adminServices.filter((service) => service.cancellationRequest?.statusKey === 'pending' && (!selectedClient || service.clientEmail === selectedClient.email || service.client === selectedClient.name)),
    [adminServices, selectedClient],
  );

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      category: 'Domains',
      price: '',
      billingCycle: 'monthly',
      addonLines: '',
    });
    setError('');
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    resetForm();
  };

  const openAddModal = () => {
    setMessage('');
    setError('');
    setShowAddModal(true);
  };

  const handleAddService = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsCreating(true);

    try {
      const response = await createCatalogService({
        name: form.name,
        description: form.description,
        category: form.category,
        price: Number(form.price),
        billingCycle: form.billingCycle,
        addons: form.addonLines
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [label, price] = line.split('|').map((part) => part.trim());

            return {
              label,
              price: price ? Number(price) : 0,
            };
          }),
      });
      setMessage(response.message);
      closeAddModal();
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

  return (
    <div>
      {showAddModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <form onSubmit={handleAddService} className="panel w-full max-w-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Service Management</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Add New Service</h2>
                <p className="mt-2 text-sm text-slate-400">Create a new service offering for the portal catalog.</p>
              </div>
              <button type="button" onClick={closeAddModal} className="btn-secondary px-4">Close</button>
            </div>

            {error ? <div className="mt-6 rounded-2xl border border-orange-400/30 bg-orange-400/10 px-4 py-3 text-sm text-orange-100">{error}</div> : null}

            <div className="mt-6 grid gap-x-4 gap-y-3 md:grid-cols-2 items-start">
              <label className="block text-sm text-slate-300">
                Service Name
                <input className="input mt-2" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Enterprise Cloud VPS" required />
              </label>

              <label className="block text-sm text-slate-300">
                Amount
                <input type="number" min="0" step="0.01" className="input mt-2" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} placeholder="0.00" required />
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
                <select className="input mt-2" value={form.billingCycle} onChange={(event) => setForm((current) => ({ ...current, billingCycle: event.target.value }))} required>
                  {[
                    { value: 'monthly', label: 'Monthly' },
                    { value: 'yearly', label: 'Yearly' },
                    { value: 'one_time', label: 'One-time' },
                  ].map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-slate-300 md:col-span-2">
                Add-ons (optional)
                <textarea
                  className="input mt-2 min-h-28 resize-y"
                  value={form.addonLines}
                  onChange={(event) => setForm((current) => ({ ...current, addonLines: event.target.value }))}
                  placeholder={"One add-on per line\nExample: WhoIs|780\nExample: Static IP|3000"}
                />
                <p className="mt-2 text-xs text-slate-500">Use one line per add-on in the format Name|Price.</p>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeAddModal} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={isCreating} className="btn-primary disabled:opacity-60">
                {isCreating ? 'Adding...' : 'Add New Service'}
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

      {showClientProfile && selectedClient && selectedClientSummary ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="panel max-h-[88vh] w-full max-w-5xl overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 md:flex-row md:items-start md:justify-between">
              <div className="flex items-center gap-4">
                <UserAvatar user={selectedClient} size="h-16 w-16" textSize="text-2xl" />
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Client Profile</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{selectedClient.name}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
                    <span>Joined {formatDateTime(selectedClient.joinedAt)}</span>
                    <StatusBadge status={selectedClient.status} />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => openBillingModal(selectedClient)} className="btn-secondary">
                  <PencilLine size={16} /> Edit Billing Details
                </button>
                <button type="button" onClick={() => setShowClientProfile(false)} className="btn-secondary px-4">Close</button>
              </div>
            </div>

            <div className="max-h-[calc(88vh-110px)] space-y-6 overflow-y-auto px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {[
                  { icon: UserCircle2, label: 'Client Name', value: selectedClient.name },
                  { icon: Mail, label: 'Email', value: selectedClient.email },
                  { icon: Building2, label: 'Company', value: selectedClient.company || 'Not set' },
                  { icon: MapPin, label: 'Address', value: selectedClient.address || 'Not set' },
                  { icon: Phone, label: 'Contact Info', value: selectedClient.mobileNumber || 'Not set' },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="panel-muted rounded-3xl p-4">
                    <Icon className="text-sky-300" size={18} />
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
                    <p className="mt-2 text-sm font-medium text-white">{value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="panel-muted rounded-3xl p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Services Availed</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{selectedClientSummary.relatedServices.length}</p>
                  <p className="mt-2 text-sm text-slate-400">Current and historical service records.</p>
                </div>
                <div className="panel-muted rounded-3xl p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Orders</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{selectedClientSummary.relatedPurchases.length}</p>
                  <p className="mt-2 text-sm text-slate-400">Recorded purchase transactions for this client.</p>
                </div>
                <div className="panel-muted rounded-3xl p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total Spent</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(selectedClientSummary.totalSpent)}</p>
                  <p className="mt-2 text-sm text-slate-400">Combined amount from approved and logged orders.</p>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Client Services</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">Services availed</h3>
                  </div>

                  <div className="mt-4 space-y-3">
                    {selectedClientSummary.relatedServices.length ? selectedClientSummary.relatedServices.map((service) => (
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
                      { label: 'Billing Email', value: selectedClient.email },
                      { label: 'Billing Address', value: selectedClient.address || 'Not set' },
                      { label: 'TIN', value: selectedClient.tin || 'Not set' },
                      { label: 'Contact Number', value: selectedClient.mobileNumber || 'Not set' },
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
              <button type="button" onClick={closeOrderModal} className="btn-secondary">Close</button>
              <button type="button" onClick={async () => { await handleApproveOrder(selectedOrderForReview.id); closeOrderModal(); }} className="btn-primary">
                <ShieldCheck size={16} /> Approve Order
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PageHeader
        eyebrow="Service Operations"
        title="Manage services"
        description="Search clients, review their services, update billing details, approve new orders, and manage service cancellations from one workspace."
      />

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

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid flex-1 gap-4 md:grid-cols-[1fr_320px]">
            <label className="relative block">
              <span className="sr-only">Search and select client</span>
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Search and select client" className="input pl-11" />
            </label>

            <select className="input" value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>
              <option value="">All clients</option>
              {matchedClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} · {client.email}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={openAddModal} className="btn-primary inline-flex items-center gap-2">
              <Plus size={16} />
              Add New Service
            </button>
            {selectedClient ? (
              <>
                <button type="button" onClick={() => setShowClientProfile(true)} className="btn-secondary inline-flex items-center gap-2">
                  <Eye size={16} />
                  View Client Profile
                </button>
                <button type="button" onClick={() => openBillingModal(selectedClient)} className="btn-secondary inline-flex items-center gap-2">
                  <PencilLine size={16} />
                  Edit Billing Details
                </button>
              </>
            ) : null}
          </div>
        </div>

        {selectedClient && selectedClientSummary ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="panel-muted rounded-3xl p-5">
              <div className="flex items-start gap-4">
                <UserAvatar user={selectedClient} size="h-14 w-14" textSize="text-xl" />
                <div>
                  <p className="text-lg font-semibold text-white">{selectedClient.name}</p>
                  <p className="mt-1 text-sm text-slate-400">{selectedClient.company || 'No company listed'}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <StatusBadge status={selectedClient.status} />
                    <span className="text-xs text-slate-500">Joined {formatDateTime(selectedClient.joinedAt)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  { icon: Mail, label: 'Email', value: selectedClient.email },
                  { icon: Phone, label: 'Contact', value: selectedClient.mobileNumber || 'Not set' },
                  { icon: MapPin, label: 'Address', value: selectedClient.address || 'Not set' },
                  { icon: CreditCard, label: 'TIN', value: selectedClient.tin || 'Not set' },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                    <Icon size={16} className="text-sky-300" />
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
                    <p className="mt-2 text-sm font-medium text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="panel-muted rounded-3xl p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Services Availed</p>
                <p className="mt-3 text-3xl font-semibold text-white">{selectedClientSummary.relatedServices.length}</p>
                <p className="mt-2 text-sm text-slate-400">Linked service records for the selected client.</p>
              </div>
              <div className="panel-muted rounded-3xl p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Pending Orders</p>
                <p className="mt-3 text-3xl font-semibold text-white">{pendingOrders.length}</p>
                <p className="mt-2 text-sm text-slate-400">Orders currently waiting for admin approval.</p>
              </div>
              <div className="panel-muted rounded-3xl p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total Spent</p>
                <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(selectedClientSummary.totalSpent)}</p>
                <p className="mt-2 text-sm text-slate-400">Recorded order value for this client.</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Admin Actions</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Approve new orders</h2>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
              {pendingOrders.length} pending
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {pendingOrders.length ? pendingOrders.map((order) => (
              <div key={order.id} className="panel-muted rounded-3xl p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-medium text-white">{order.serviceName}</p>
                    <p className="mt-1 text-sm text-slate-400">{order.client} • {order.id}</p>
                    <p className="mt-1 text-sm text-slate-500">{formatDate(order.date)} • {order.paymentMethod}</p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-base font-semibold text-sky-200">{formatCurrency(order.amount)}</p>
                    <div className="mt-2"><StatusBadge status={order.status} /></div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => openOrderModal(order)} className="btn-secondary">
                      <Eye size={14} /> View details
                    </button>
                    <button type="button" onClick={() => handleApproveOrder(order.id)} disabled={processingOrderId === order.id} className="btn-primary disabled:opacity-60">
                      <ShieldCheck size={16} />
                      {processingOrderId === order.id ? 'Approving...' : 'Approve Order'}
                    </button>
                  </div>
                </div>
              </div>
            )) : (
              <div className="panel-muted rounded-3xl p-4 text-sm text-slate-400">No pending orders require approval right now.</div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Admin Actions</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Approve service cancellations</h2>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
              {pendingCancellationServices.length} pending
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {pendingCancellationServices.length ? pendingCancellationServices.map((service) => (
              <div key={service.id} className="panel-muted rounded-3xl p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-medium text-white">{service.name}</p>
                    <p className="mt-1 text-sm text-slate-400">{service.client || 'No client assigned'} • {service.plan}</p>
                    <p className="mt-1 text-sm text-slate-500">Requested {formatDateTime(service.cancellationRequest?.requestedAt)}</p>
                    {service.cancellationRequest?.reason ? <p className="mt-2 text-sm text-slate-300">{service.cancellationRequest.reason}</p> : null}
                  </div>
                  <StatusBadge status={service.cancellationRequest?.status ?? 'Pending Approval'} />
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-3">
                  <button type="button" onClick={() => handleRejectCancellation(service.id)} disabled={processingCancellationId === service.id} className="btn-secondary border-white/10 disabled:opacity-60">
                    <XCircle size={16} /> Keep Service
                  </button>
                  <button type="button" onClick={() => handleApproveCancellation(service.id)} disabled={processingCancellationId === service.id} className="btn-primary disabled:opacity-60">
                    <CheckCircle2 size={16} />
                    {processingCancellationId === service.id ? 'Approving...' : 'Approve Cancellation'}
                  </button>
                </div>
              </div>
            )) : (
              <div className="panel-muted rounded-3xl p-4 text-sm text-slate-400">No service cancellations are waiting for approval.</div>
            )}
          </div>
        </section>
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative block flex-1">
            <span className="sr-only">Search services</span>
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" value={servicesSearch} onChange={(event) => setServicesSearch(event.target.value)} placeholder="Search service, client, plan, or category" className="input pl-11" />
          </label>

          <select className="input lg:w-56" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="All">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/70 p-1">
          <button type="button" onClick={() => setViewMode('grid')} className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${viewMode === 'grid' ? 'bg-orange-400 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`} aria-label="Grid view" title="Grid view">
            <LayoutGrid size={16} />
          </button>
          <button type="button" onClick={() => setViewMode('list')} className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${viewMode === 'list' ? 'bg-orange-400 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`} aria-label="List view" title="List view">
            <List size={16} />
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="panel mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left">
              <thead className="bg-white/5 text-sm text-slate-400">
                <tr>
                  <th className="px-5 py-4 font-semibold text-white text-center">Service</th>
                  <th className="px-5 py-4 font-semibold text-white text-center">Client</th>
                  <th className="px-5 py-4 font-semibold text-white text-center">Base Price</th>
                  <th className="px-5 py-4 font-semibold text-white text-center">Add-ons</th>
                  <th className="px-5 py-4 font-semibold text-white text-center">Status</th>
                  <th className="px-5 py-4 font-semibold text-white text-center w-40">Update Status</th>
                  <th className="px-5 py-4 font-semibold text-white text-center">Cancellation</th>
                  <th className="px-5 py-4 font-semibold text-white text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-transparent text-sm text-slate-200">
                {filteredServices.length ? filteredServices.map((service) => {
                  const hasPendingCancellation = service.cancellationRequest?.statusKey === 'pending';
                  const canQueueCancellation = !hasPendingCancellation && service.status !== 'Expired';

                  return (
                    <tr key={service.id} className="hover:bg-white/[0.03]">
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
                          <button
                            type="button"
                            onClick={() => openDiscountModal(service)}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-emerald-600/10 text-emerald-100 transition hover:bg-emerald-600/20"
                            title="Apply discount"
                            aria-label={`Apply discount to ${service.name}`}
                          >
                            <CreditCard size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openPricingLogs(service)}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10"
                            title="Pricing logs"
                            aria-label={`Pricing logs for ${service.name}`}
                          >
                            <CheckCircle2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleViewClientFromService(service)}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10"
                            title="View client profile"
                            aria-label={`View client profile for ${service.name}`}
                          >
                            <Eye size={16} />
                          </button>
                          {canQueueCancellation ? (
                            <button
                              type="button"
                              onClick={() => openCancellationModal(service)}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/10 text-orange-100 transition hover:bg-orange-400/20"
                              title="Queue cancellation"
                              aria-label={`Queue cancellation for ${service.name}`}
                            >
                              <CircleOff size={16} />
                            </button>
                          ) : hasPendingCancellation ? (
                            <span className="inline-flex items-center rounded-2xl border border-orange-400/20 bg-orange-400/10 px-3 py-2 text-xs text-orange-100">
                              Pending
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-slate-400">No services match the current search and filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : filteredServices.length ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredServices.map((service) => {
            const hasPendingCancellation = service.cancellationRequest?.statusKey === 'pending';
            const canQueueCancellation = !hasPendingCancellation && service.status !== 'Expired';

            return (
              <div key={service.id} className="panel p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-medium text-white">{service.name}</p>
                    <p className="mt-1 text-sm text-slate-400">{service.category} · {service.plan}</p>
                  </div>
                  <StatusBadge status={service.status} />
                </div>

                <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Client</p>
                  <p className="mt-2 text-sm text-slate-300">{service.client || 'No client assigned'}</p>
                  {service.clientEmail ? <p className="mt-1 break-all text-sm text-slate-500">{service.clientEmail}</p> : null}
                </div>

                {service.cancellationRequest ? (
                  <div className="mt-4 rounded-2xl border border-orange-400/20 bg-orange-400/10 px-4 py-3 text-sm text-orange-100">
                    Cancellation {service.cancellationRequest.status.toLowerCase()}
                  </div>
                ) : null}

                <div className="mt-4">
                  <select className="input w-full" value={service.status} onChange={(event) => updateServiceStatus(service.id, event.target.value)}>
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => openDiscountModal(service)} className="btn-secondary px-3">
                    <CreditCard size={16} />
                  </button>
                  <button type="button" onClick={() => openPricingLogs(service)} className="btn-secondary px-3">
                    <CheckCircle2 size={16} />
                  </button>
                  <button type="button" onClick={() => handleViewClientFromService(service)} className="btn-secondary px-3">
                    <Eye size={16} />
                  </button>
                  {canQueueCancellation ? (
                    <button type="button" onClick={() => openCancellationModal(service)} className="btn-secondary border-orange-400/20 bg-orange-400/10 px-3 text-orange-100 hover:bg-orange-400/20">
                      <CircleOff size={16} />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="panel mt-6 px-5 py-12 text-center text-sm text-slate-400">No services match the current search and filters.</div>
      )}
    </div>
  );
}
