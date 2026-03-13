import { useMemo, useState } from 'react';
import { Building2, CheckCircle2, Eye, FileText, LayoutGrid, List, Mail, MapPin, Phone, Search, UserCircle2, XCircle } from 'lucide-react';
import DataTable from '../../components/common/DataTable';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import UserAvatar from '../../components/common/UserAvatar';
import { usePortal } from '../../context/PortalContext';
import { formatCurrency, formatDate } from '../../utils/format';

export default function ClientsPage() {
  const { clients, adminPurchases, adminServices, approveProfileUpdateRequest, rejectProfileUpdateRequest, approveClientRegistration, rejectClientRegistration } = usePortal();
  const [selectedAuditTrail, setSelectedAuditTrail] = useState(null);
  const [selectedClientAccount, setSelectedClientAccount] = useState(null);
  const [selectedProfileRequest, setSelectedProfileRequest] = useState(null);
  const [approvalDecision, setApprovalDecision] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [clientsSearch, setClientsSearch] = useState('');
  const [clientsStatusFilter, setClientsStatusFilter] = useState('All');
  const [clientsApprovalFilter, setClientsApprovalFilter] = useState('All');
  const [clientsView, setClientsView] = useState('list');

  const buildAuditTrailLines = (client) => {
    const relatedPurchases = adminPurchases.filter((purchase) => purchase.client === client.name);
    const relatedServices = adminServices.filter(
      (service) => service.client === client.name || service.clientEmail === client.email,
    );

    return [
      'WSI Portal Customer Audit Trail',
      '===============================',
      `Generated: ${new Date().toLocaleString('en-PH')}`,
      '',
      'Client Summary',
      `Name: ${client.name}`,
      `Company: ${client.company}`,
      `Email: ${client.email}`,
      `Status: ${client.status}`,
      `Registered Services: ${client.services}`,
      '',
      'Phase 1 Services',
      ...(relatedServices.length
        ? relatedServices.flatMap((service, index) => [
            `${index + 1}. ${service.name}`,
            `   Category: ${service.category}`,
            `   Plan: ${service.plan}`,
            `   Status: ${service.status}`,
            `   Renewal: ${formatDate(service.renewsOn)}`,
          ])
        : ['No phase 1 services recorded.']),
      '',
      'Phase 1 Purchases',
      ...(relatedPurchases.length
        ? relatedPurchases.flatMap((purchase, index) => [
            `${index + 1}. ${purchase.id}`,
            `   Service: ${purchase.serviceName}`,
            `   Amount: ${formatCurrency(purchase.amount)}`,
            `   Payment Method: ${purchase.paymentMethod}`,
            `   Status: ${purchase.status}`,
            `   Date: ${formatDate(purchase.date)}`,
          ])
        : ['No phase 1 purchases recorded.']),
      '',
      'End of Audit Trail',
    ];
  };

  const buildAuditTrailData = (client) => {
    const relatedPurchases = adminPurchases.filter((purchase) => purchase.client === client.name);
    const relatedServices = adminServices.filter(
      (service) => service.client === client.name || service.clientEmail === client.email,
    );

    return {
      generatedAt: new Date().toLocaleString('en-PH'),
      summary: {
        name: client.name,
        company: client.company,
        email: client.email,
        status: client.status,
        services: client.services,
        purchaseCount: relatedPurchases.length,
        totalSpent: relatedPurchases.reduce((sum, purchase) => sum + purchase.amount, 0),
      },
      services: relatedServices,
      purchases: relatedPurchases,
    };
  };

  const openAuditTrailModal = (client) => {
    setSelectedAuditTrail({
      client,
      lines: buildAuditTrailLines(client),
      data: buildAuditTrailData(client),
    });
  };

  const openProfileRequestModal = (client) => {
    setSelectedProfileRequest(client);
    setReviewNote(client.profileUpdateRequest?.adminNotes ?? '');
    setReviewMessage('');
    setReviewError('');
  };

  const openRegistrationRequestModal = (client) => {
    setSelectedClientAccount(client);
    setReviewNote(client.registrationApproval?.adminNotes ?? '');
    setReviewMessage('');
    setReviewError('');
  };

  const openClientAccountModal = (client) => {
    setSelectedClientAccount(client);
  };

  const downloadAuditTrailPdf = (client) => {
    const lines = buildAuditTrailLines(client);
    const safeName = client.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const printWindow = window.open('', '_blank', 'width=900,height=700');

    if (!printWindow) {
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${safeName || 'customer'}-audit-trail</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 32px;
              color: #0f172a;
              line-height: 1.6;
            }
            h1 {
              margin: 0 0 8px;
              font-size: 24px;
            }
            pre {
              white-space: pre-wrap;
              word-break: break-word;
              font-family: inherit;
              font-size: 14px;
              margin: 24px 0 0;
            }
          </style>
        </head>
        <body>
          <h1>WSI Portal Customer Audit Trail</h1>
          <pre>${lines.join('\n')}</pre>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const formatDateTime = (value) => {
    if (!value) {
      return '—';
    }

    return new Intl.DateTimeFormat('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  };

  const handleProfileRequestDecision = async (client, decision) => {
    const hasPendingRegistration = client.registrationApproval?.statusKey === 'pending';
    const requestId = client.profileUpdateRequest?.id;

    if (!hasPendingRegistration && !requestId) {
      return;
    }

    setReviewNote(hasPendingRegistration ? (client.registrationApproval?.adminNotes ?? '') : (client.profileUpdateRequest?.adminNotes ?? ''));
    setReviewError('');
    setReviewMessage('');
    setApprovalDecision({
      client,
      decision,
      type: hasPendingRegistration ? 'registration' : 'profile',
    });
  };

  const confirmProfileRequestDecision = async () => {
    if (!approvalDecision) {
      return;
    }

    const approved = approvalDecision.decision === 'approve';

    setIsReviewing(true);
    setReviewError('');
    setReviewMessage('');

    try {
      const response = approvalDecision.type === 'registration'
        ? (approved
            ? await approveClientRegistration(approvalDecision.client.id, reviewNote.trim())
            : await rejectClientRegistration(approvalDecision.client.id, reviewNote.trim()))
        : (approved
            ? await approveProfileUpdateRequest(approvalDecision.client.profileUpdateRequest.id, reviewNote.trim())
            : await rejectProfileUpdateRequest(approvalDecision.client.profileUpdateRequest.id, reviewNote.trim()));

      setReviewMessage(response.message);
      setReviewNote('');
      setApprovalDecision(null);
      if (approvalDecision.type === 'profile') {
        setSelectedProfileRequest(null);
      }
    } catch (error) {
      setReviewError(error.message);
    } finally {
      setIsReviewing(false);
    }
  };

  const profileRequestPreview = useMemo(() => {
    if (!selectedProfileRequest?.profileUpdateRequest) {
      return [];
    }

    const requestedProfile = selectedProfileRequest.profileUpdateRequest.requestedProfile;

    return [
      { label: 'Full Name', current: selectedProfileRequest.name, requested: requestedProfile.name },
      { label: 'Email', current: selectedProfileRequest.email, requested: requestedProfile.email },
      { label: 'Company', current: selectedProfileRequest.company, requested: requestedProfile.company },
      { label: 'Address', current: selectedProfileRequest.address || 'Not set', requested: requestedProfile.address || 'Not set' },
      { label: 'Mobile Number', current: selectedProfileRequest.mobileNumber || 'Not set', requested: requestedProfile.mobileNumber || 'Not set' },
      {
        label: 'Profile Picture URL',
        current: selectedProfileRequest.profilePhotoUrl ? 'Set' : 'Not set',
        requested: requestedProfile.profilePhotoUrl ? 'Set' : 'Not set',
      },
    ];
  }, [selectedProfileRequest]);

  const selectedClientAccountSummary = useMemo(() => {
    if (!selectedClientAccount) {
      return null;
    }

    const relatedPurchases = adminPurchases.filter((purchase) => purchase.client === selectedClientAccount.name);
    const relatedServices = adminServices.filter(
      (service) => service.client === selectedClientAccount.name || service.clientEmail === selectedClientAccount.email,
    );

    return {
      relatedPurchases,
      relatedServices,
      totalSpent: relatedPurchases.reduce((sum, purchase) => sum + purchase.amount, 0),
    };
  }, [adminPurchases, adminServices, selectedClientAccount]);

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const matchesSearch = [client.name, client.company, client.email]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(clientsSearch.toLowerCase()));

      const matchesStatus = clientsStatusFilter === 'All' || client.status === clientsStatusFilter;

      const approvalKey = client.registrationApproval?.statusKey === 'pending'
        ? 'pending'
        : (client.profileUpdateRequest?.statusKey ?? (client.registrationApproval?.statusKey ?? 'none'));
      const matchesApproval = clientsApprovalFilter === 'All'
        || (clientsApprovalFilter === 'No request' && approvalKey === 'none')
        || (clientsApprovalFilter === 'Pending' && approvalKey === 'pending')
        || (clientsApprovalFilter === 'Approved' && approvalKey === 'approved')
        || (clientsApprovalFilter === 'Rejected' && approvalKey === 'rejected');

      return matchesSearch && matchesStatus && matchesApproval;
    });
  }, [clients, clientsApprovalFilter, clientsSearch, clientsStatusFilter]);

  const renderClientApprovals = (row) => (
    row.registrationApproval?.statusKey === 'pending' ? (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => openRegistrationRequestModal(row)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
          title="Review registration request"
          aria-label={`Review registration request for ${row.name}`}
        >
          <FileText size={16} />
        </button>
        <button
          type="button"
          onClick={() => handleProfileRequestDecision(row, 'approve')}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-200 transition hover:bg-emerald-400/20"
          title="Approve registration"
          aria-label={`Approve registration for ${row.name}`}
        >
          <CheckCircle2 size={16} />
        </button>
        <button
          type="button"
          onClick={() => handleProfileRequestDecision(row, 'reject')}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-400/10 text-rose-200 transition hover:bg-rose-400/20"
          title="Reject registration"
          aria-label={`Reject registration for ${row.name}`}
        >
          <XCircle size={16} />
        </button>
      </div>
    ) : row.profileUpdateRequest?.statusKey === 'pending' ? (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => openProfileRequestModal(row)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
          title="Review profile update request"
          aria-label={`Review profile update request for ${row.name}`}
        >
          <FileText size={16} />
        </button>
        <button
          type="button"
          onClick={() => openProfileRequestModal(row)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-200 transition hover:bg-emerald-400/20"
          title="Approve profile update"
          aria-label={`Approve profile update for ${row.name}`}
        >
          <CheckCircle2 size={16} />
        </button>
        <button
          type="button"
          onClick={() => openProfileRequestModal(row)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-400/10 text-rose-200 transition hover:bg-rose-400/20"
          title="Reject profile update"
          aria-label={`Reject profile update for ${row.name}`}
        >
          <XCircle size={16} />
        </button>
      </div>
    ) : (
      <span className="text-sm text-slate-400">{row.registrationApproval?.statusKey === 'rejected' ? 'Registration rejected' : 'No request'}</span>
    )
  );

  const renderClientActions = (row) => (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => openClientAccountModal(row)}
        className="btn-secondary px-3"
        title="View client account"
        aria-label={`View client account for ${row.name}`}
      >
        <Eye size={16} />
      </button>
      <button
        type="button"
        onClick={() => openAuditTrailModal(row)}
        className="btn-secondary px-3"
        title="View audit trail"
        aria-label={`View audit trail for ${row.name}`}
      >
        <FileText size={16} />
      </button>
    </div>
  );

  const columns = [
    { key: 'name', label: 'Client' },
    { key: 'company', label: 'Company' },
    { key: 'email', label: 'Email' },
    { key: 'services', label: 'Services' },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      key: 'approvals',
      label: 'Approvals',
      render: (_, row) => renderClientApprovals(row),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => renderClientActions(row),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Client Management"
        title="Registered customers"
        description="Review client details, customer records, and service counts from the admin portal."
      />
      {reviewError ? <p className="mb-4 rounded-2xl border border-orange-400/30 bg-orange-400/10 px-4 py-3 text-sm text-orange-100">{reviewError}</p> : null}
      {reviewMessage ? <p className="mb-4 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-sm text-sky-100">{reviewMessage}</p> : null}

      <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative block flex-1">
            <span className="sr-only">Search clients</span>
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={clientsSearch}
              onChange={(event) => setClientsSearch(event.target.value)}
              placeholder="Search client, company, or email"
              className="input pl-11"
            />
          </label>

          <select className="input lg:w-48" value={clientsStatusFilter} onChange={(event) => setClientsStatusFilter(event.target.value)}>
            <option value="All">All statuses</option>
            <option value="Active">Active</option>
            <option value="Pending">Pending</option>
            <option value="Pending Approval">Pending Approval</option>
            <option value="Rejected">Rejected</option>
          </select>

          <select className="input lg:w-52" value={clientsApprovalFilter} onChange={(event) => setClientsApprovalFilter(event.target.value)}>
            <option value="All">All approvals</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="No request">No request</option>
          </select>
        </div>

        <div className="inline-flex items-center gap-2 self-end rounded-2xl border border-white/10 bg-slate-900/70 p-1">
          <button
            type="button"
            onClick={() => setClientsView('grid')}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${clientsView === 'grid' ? 'bg-orange-400 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            aria-label="Grid view"
            title="Grid view"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            type="button"
            onClick={() => setClientsView('list')}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${clientsView === 'list' ? 'bg-orange-400 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            aria-label="List view"
            title="List view"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {clientsView === 'list' ? (
        <DataTable columns={columns} rows={filteredClients} />
      ) : filteredClients.length ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filteredClients.map((client) => (
            <div key={client.id} className="panel p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <UserAvatar user={client} />
                  <div>
                    <p className="text-base font-semibold text-white">{client.name}</p>
                    <p className="mt-1 text-sm text-slate-400">{client.company}</p>
                  </div>
                </div>
                <StatusBadge status={client.status} />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Email</p>
                  <p className="mt-2 text-sm font-medium text-white break-all">{client.email}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Services</p>
                  <p className="mt-2 text-sm font-medium text-white">{client.services}</p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Approvals</p>
                <div className="mt-3">{renderClientApprovals(client)}</div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {renderClientActions(client)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel px-5 py-12 text-center text-sm text-slate-400">No clients match the current search and filters.</div>
      )}

      {selectedAuditTrail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="panel max-h-[85vh] w-full max-w-3xl overflow-hidden">
            <div className="flex items-start justify-between border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Audit Trail</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{selectedAuditTrail.client.name}</h2>
                <p className="mt-2 text-sm text-slate-400">Phase 1 customer activity summary • Generated {selectedAuditTrail.data.generatedAt}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAuditTrail(null)}
                className="btn-secondary px-4"
              >
                Close
              </button>
            </div>

            <div className="max-h-[calc(85vh-110px)] space-y-6 overflow-y-auto px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[
                  { label: 'Company', value: selectedAuditTrail.data.summary.company },
                  { label: 'Email', value: selectedAuditTrail.data.summary.email },
                  { label: 'Client Status', value: selectedAuditTrail.data.summary.status },
                  { label: 'Registered Services', value: selectedAuditTrail.data.summary.services },
                  { label: 'Purchases', value: selectedAuditTrail.data.summary.purchaseCount },
                  { label: 'Total Spent', value: formatCurrency(selectedAuditTrail.data.summary.totalSpent) },
                ].map((item) => (
                  <div key={item.label} className="panel-muted rounded-3xl p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                    <p className="mt-3 text-sm font-medium text-white">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Phase 1 Services</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">Service activity</h3>
                  </div>

                  <div className="mt-4 space-y-3">
                    {selectedAuditTrail.data.services.length ? (
                      selectedAuditTrail.data.services.map((service) => (
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
                      ))
                    ) : (
                      <div className="panel-muted rounded-3xl p-4 text-sm text-slate-400">No phase 1 services recorded.</div>
                    )}
                  </div>
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Phase 1 Purchases</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">Purchase activity</h3>
                  </div>

                  <div className="mt-4 space-y-3">
                    {selectedAuditTrail.data.purchases.length ? (
                      selectedAuditTrail.data.purchases.map((purchase) => (
                        <div key={purchase.id} className="panel-muted rounded-3xl p-4">
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-medium text-white">{purchase.serviceName}</p>
                              <span className="text-sm font-semibold text-sky-200">{formatCurrency(purchase.amount)}</span>
                            </div>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{purchase.id}</p>
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
                              <span>{purchase.paymentMethod}</span>
                              <span>{formatDate(purchase.date)}</span>
                            </div>
                            <div className="pt-1">
                              <StatusBadge status={purchase.status} />
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="panel-muted rounded-3xl p-4 text-sm text-slate-400">No phase 1 purchases recorded.</div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedClientAccount && selectedClientAccountSummary ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="panel max-h-[88vh] w-full max-w-5xl overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 md:flex-row md:items-start md:justify-between">
              <div className="flex items-center gap-4">
                <UserAvatar user={selectedClientAccount} size="h-16 w-16" textSize="text-2xl" />
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Client Account</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{selectedClientAccount.name}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
                    <span>Joined {formatDateTime(selectedClientAccount.joinedAt)}</span>
                    <StatusBadge status={selectedClientAccount.status} />
                    {selectedClientAccount.profileUpdateRequest ? <StatusBadge status={selectedClientAccount.profileUpdateRequest.status} /> : null}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedClientAccount(null)}
                className="btn-secondary px-4"
              >
                Close
              </button>
            </div>

            <div className="max-h-[calc(88vh-110px)] space-y-6 overflow-y-auto px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { icon: UserCircle2, label: 'Client Name', value: selectedClientAccount.name },
                  { icon: Mail, label: 'Email', value: selectedClientAccount.email },
                  { icon: Building2, label: 'Company', value: selectedClientAccount.company || 'Not set' },
                  { icon: MapPin, label: 'Address', value: selectedClientAccount.address || 'Not set' },
                  { icon: Phone, label: 'Mobile Number', value: selectedClientAccount.mobileNumber || 'Not set' },
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
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Services</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{selectedClientAccountSummary.relatedServices.length}</p>
                  <p className="mt-2 text-sm text-slate-400">Active and historical customer service records.</p>
                </div>
                <div className="panel-muted rounded-3xl p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Purchases</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{selectedClientAccountSummary.relatedPurchases.length}</p>
                  <p className="mt-2 text-sm text-slate-400">Recorded phase 1 orders from this client.</p>
                </div>
                <div className="panel-muted rounded-3xl p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total Spent</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(selectedClientAccountSummary.totalSpent)}</p>
                  <p className="mt-2 text-sm text-slate-400">Combined amount from customer purchases.</p>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Recent Services</p>
                      <h3 className="mt-2 text-lg font-semibold text-white">Customer services</h3>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {selectedClientAccountSummary.relatedServices.length ? (
                      selectedClientAccountSummary.relatedServices.slice(0, 5).map((service) => (
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
                      ))
                    ) : (
                      <div className="panel-muted rounded-3xl p-4 text-sm text-slate-400">No customer services found for this account.</div>
                    )}
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Registration Status</p>
                    <div className="mt-3">
                      {selectedClientAccount.registrationApproval ? (
                        <>
                          <StatusBadge status={selectedClientAccount.registrationApproval.status} />
                          <p className="mt-3 text-sm text-slate-400">
                            Submitted {formatDateTime(selectedClientAccount.registrationApproval.submittedAt)}
                          </p>
                          {selectedClientAccount.registrationApproval.reviewedAt ? (
                            <p className="mt-1 text-sm text-slate-400">
                              Reviewed {formatDateTime(selectedClientAccount.registrationApproval.reviewedAt)} by {selectedClientAccount.registrationApproval.reviewedBy || 'Admin'}
                            </p>
                          ) : null}
                          {selectedClientAccount.registrationApproval.adminNotes ? (
                            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-300">
                              <p className="font-medium text-white">Admin note</p>
                              <p className="mt-2">{selectedClientAccount.registrationApproval.adminNotes}</p>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-sm text-slate-400">This client has no registration review record.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Profile Request Status</p>
                    <div className="mt-3">
                      {selectedClientAccount.profileUpdateRequest ? (
                        <>
                          <StatusBadge status={selectedClientAccount.profileUpdateRequest.status} />
                          <p className="mt-3 text-sm text-slate-400">
                            Submitted {formatDateTime(selectedClientAccount.profileUpdateRequest.submittedAt)}
                          </p>
                          {selectedClientAccount.profileUpdateRequest.reviewedAt ? (
                            <p className="mt-1 text-sm text-slate-400">
                              Reviewed {formatDateTime(selectedClientAccount.profileUpdateRequest.reviewedAt)} by {selectedClientAccount.profileUpdateRequest.reviewedBy || 'Admin'}
                            </p>
                          ) : null}
                          {selectedClientAccount.profileUpdateRequest.adminNotes ? (
                            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-300">
                              <p className="font-medium text-white">Admin note</p>
                              <p className="mt-2">{selectedClientAccount.profileUpdateRequest.adminNotes}</p>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-sm text-slate-400">This client has no pending or reviewed profile update request.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Recent Purchases</p>
                    <div className="mt-4 space-y-3">
                      {selectedClientAccountSummary.relatedPurchases.length ? (
                        selectedClientAccountSummary.relatedPurchases.slice(0, 4).map((purchase) => (
                          <div key={purchase.id} className="panel-muted rounded-3xl p-4">
                            <div className="flex flex-col gap-2">
                              <p className="font-medium text-white">{purchase.serviceName}</p>
                              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
                                <span>{purchase.id}</span>
                                <span>{formatCurrency(purchase.amount)}</span>
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <StatusBadge status={purchase.status} />
                                <span className="text-xs text-slate-500">{formatDate(purchase.date)}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="panel-muted rounded-3xl p-4 text-sm text-slate-400">No purchases found for this account.</div>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedProfileRequest?.profileUpdateRequest ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="panel max-h-[85vh] w-full max-w-4xl overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Profile Update Review</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{selectedProfileRequest.name}</h2>
                <p className="mt-2 text-sm text-slate-400">Submitted {formatDateTime(selectedProfileRequest.profileUpdateRequest.submittedAt)}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleProfileRequestDecision(selectedProfileRequest, 'approve')}
                  disabled={isReviewing}
                  className="btn-secondary border-emerald-400/30 bg-emerald-400/10 text-emerald-200 disabled:opacity-60"
                >
                  <CheckCircle2 size={16} /> Approve
                </button>
                <button
                  type="button"
                  onClick={() => handleProfileRequestDecision(selectedProfileRequest, 'reject')}
                  disabled={isReviewing}
                  className="btn-secondary border-rose-400/30 bg-rose-400/10 text-rose-200 disabled:opacity-60"
                >
                  <XCircle size={16} /> Reject
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedProfileRequest(null)}
                  className="btn-secondary px-4"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="max-h-[calc(85vh-110px)] space-y-5 overflow-y-auto px-6 py-5">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={selectedProfileRequest.profileUpdateRequest.status} />
                <span className="text-sm text-slate-400">
                  Review status: {selectedProfileRequest.profileUpdateRequest.status}
                </span>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <label className="block text-sm text-slate-300">
                  Admin note (optional)
                  <textarea
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    rows={4}
                    className="input mt-2 min-h-28 resize-y"
                    placeholder="Add a note for the customer before you approve or reject this request."
                  />
                </label>
                <p className="mt-2 text-xs text-slate-500">
                  This note will appear in the customer profile status panel after review.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {profileRequestPreview.map((item) => (
                  <div key={item.label} className="panel-muted rounded-3xl p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                    <div className="mt-3 space-y-2 text-sm">
                      <p className="text-slate-400">Current: <span className="text-white">{item.current}</span></p>
                      <p className="text-slate-400">Requested: <span className="text-sky-200">{item.requested}</span></p>
                    </div>
                  </div>
                ))}
              </div>

              {selectedProfileRequest.profileUpdateRequest.adminNotes ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
                  <p className="font-medium text-white">Admin note</p>
                  <p className="mt-2">{selectedProfileRequest.profileUpdateRequest.adminNotes}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {approvalDecision ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="panel w-full max-w-xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Confirm Approval Action</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {approvalDecision.type === 'registration'
                    ? (approvalDecision.decision === 'approve' ? 'Approve registration request' : 'Reject registration request')
                    : (approvalDecision.decision === 'approve' ? 'Approve update request' : 'Reject update request')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setApprovalDecision(null)}
                className="btn-secondary px-4"
              >
                Close
              </button>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-slate-300">
                Are you sure you want to {approvalDecision.decision === 'approve' ? 'approve' : 'reject'} the pending
                {approvalDecision.type === 'registration' ? ' registration' : ' profile update'} for <span className="font-semibold text-white">{approvalDecision.client.name}</span>?
              </p>
              <p className="mt-3 text-sm text-slate-400">
                {approvalDecision.type === 'registration'
                  ? (approvalDecision.decision === 'approve'
                      ? 'The customer account will be enabled immediately and an approval email will be sent to the registered address.'
                      : 'The customer account will remain blocked and a rejection email will be sent to the registered address.')
                  : (approvalDecision.decision === 'approve'
                      ? 'The requested profile details will be applied to the client account immediately.'
                      : 'The requested profile details will not be applied, and the customer will receive the rejection notice.')}
              </p>
              {reviewNote.trim() ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-300">
                  <p className="font-medium text-white">Admin note</p>
                  <p className="mt-2">{reviewNote}</p>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setApprovalDecision(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmProfileRequestDecision}
                disabled={isReviewing}
                className={`btn-primary disabled:opacity-60 ${approvalDecision.decision === 'reject' ? '!bg-rose-500 hover:!bg-rose-400' : ''}`}
              >
                {isReviewing
                  ? 'Saving...'
                  : approvalDecision.decision === 'approve'
                    ? 'Approve Request'
                    : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
