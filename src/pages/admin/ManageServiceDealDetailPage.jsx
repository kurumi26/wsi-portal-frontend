import { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import UserAvatar from '../../components/common/UserAvatar';
import { usePortal } from '../../context/PortalContext';
import { PURCHASE_ADDON_KEYS, extractAddonEntries, getAddonBillingCycleLabel } from '../../utils/addons';
import {
  buildCatalogServiceDealRows,
  buildServicePurchaseDetails,
  getCatalogServiceMatchedLineItems,
  getPurchaseLinkedServices,
  getPurchaseRecordTime,
  getServiceClientEmail,
  getServiceClientName,
  getServiceSubtitle,
} from '../../utils/adminDeals';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format';
import { getDesiredDomainValue } from '../../utils/orders';
import { getAdminServiceExpirationMeta, getServiceDisplayStatus } from '../../utils/services';

const BACKEND_ORIGIN = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/api\/?$/i, '');
const DAY_MS = 24 * 60 * 60 * 1000;

const getBillingCycleLabel = (value) => getAddonBillingCycleLabel(value, 'Recurring');

const getDisplayText = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value)) {
    return value.map((entry) => getDisplayText(entry)).filter(Boolean).join(', ');
  }

  if (typeof value === 'object') {
    return String(value.label ?? value.name ?? value.title ?? '').trim();
  }

  return String(value).trim();
};

const getFirstDisplayValue = (...values) => values
  .map((value) => getDisplayText(value))
  .find(Boolean) ?? '—';

const getTimestamp = (value) => {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
};

const formatDuration = (startValue, endValue) => {
  const start = getTimestamp(startValue);
  const end = getTimestamp(endValue);

  if (start === null || end === null || end < start) {
    return 'NA';
  }

  const totalDays = Math.max(0, Math.round((end - start) / DAY_MS));
  return `${totalDays} day${totalDays === 1 ? '' : 's'}`;
};

const extractConfigurationSpec = (configurationText, pattern, formatter = (match) => match[0]) => {
  if (!configurationText) {
    return '—';
  }

  const matched = configurationText.match(pattern);
  return matched ? formatter(matched) : '—';
};

const buildTimelineEvents = ({ dealRow, linkedServiceRows, paymentProof, catalogService }) => {
  const events = [];

  if (dealRow?.date) {
    events.push({
      id: `deal-created-${dealRow.dealId}`,
      title: 'Deal created',
      description: `Order ${dealRow.orderLabel} was submitted for ${catalogService.name}.`,
      time: dealRow.date,
      tone: 'primary',
    });
  }

  if (paymentProof?.createdAt) {
    events.push({
      id: `payment-proof-${dealRow.dealId}`,
      title: 'Payment proof uploaded',
      description: 'The client uploaded a receipt for billing verification.',
      time: paymentProof.createdAt,
      tone: 'success',
    });
  }

  if (dealRow?.purchase?.updatedAt && dealRow.purchase.updatedAt !== dealRow.date) {
    events.push({
      id: `deal-updated-${dealRow.dealId}`,
      title: 'Deal record updated',
      description: 'The purchase record received a follow-up update.',
      time: dealRow.purchase.updatedAt,
      tone: 'neutral',
    });
  }

  linkedServiceRows.forEach(({ service }) => {
    if (service?.createdAt) {
      events.push({
        id: `service-created-${service.id}`,
        title: 'Service instance created',
        description: `${getServiceClientName(service)} now has a linked service record for ${service.name}.`,
        time: service.createdAt,
        tone: 'primary',
      });
    }

    if (service?.renewsOn) {
      events.push({
        id: `service-renewal-${service.id}`,
        title: 'Renewal schedule recorded',
        description: `${service.name} is scheduled to renew on ${service.renewsOn}.`,
        time: service.renewsOn,
        tone: 'neutral',
      });
    }
  });

  return events
    .filter((event) => event.time)
    .sort((left, right) => (getTimestamp(right.time) ?? 0) - (getTimestamp(left.time) ?? 0));
};

const getNumericValue = (...values) => {
  const found = values.find((value) => value !== null && value !== undefined && value !== '' && !Number.isNaN(Number(value)));
  return found === undefined ? null : Number(found);
};

const mergeAddonEntries = (...entryLists) => {
  const seen = new Set();

  return entryLists
    .flatMap((entries) => (Array.isArray(entries) ? entries : []))
    .filter((entry) => {
      const key = String(entry?.label ?? '').trim().toLowerCase();

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
};

export default function ManageServiceDealDetailPage() {
  const { serviceId, dealId } = useParams();
  const location = useLocation();
  const { services, adminServices, adminPurchases, clients } = usePortal();
  const [activeTab, setActiveTab] = useState('overview');

  const stateService = location.state?.service ?? null;
  const stateDeal = location.state?.deal ?? null;

  const catalogService = useMemo(() => {
    const matchedService = services.find((service) => String(service.id) === String(serviceId));
    if (matchedService) {
      return matchedService;
    }

    if (stateService && String(stateService.id) === String(serviceId)) {
      return stateService;
    }

    return null;
  }, [serviceId, services, stateService]);

  const dealRows = useMemo(() => {
    if (!catalogService) {
      return [];
    }

    return buildCatalogServiceDealRows({
      catalogService,
      adminPurchases,
      adminServices,
      clients,
      catalogServices: services,
    });
  }, [adminPurchases, adminServices, catalogService, clients, services]);

  const fallbackDealRows = useMemo(() => {
    if (!catalogService || !stateDeal) {
      return [];
    }

    return buildCatalogServiceDealRows({
      catalogService,
      adminPurchases: [stateDeal],
      adminServices,
      clients,
      catalogServices: services,
    });
  }, [adminServices, catalogService, clients, services, stateDeal]);

  const dealRow = useMemo(() => {
    const matchedDeal = dealRows.find((row) => String(row.dealId) === String(dealId));
    if (matchedDeal) {
      return matchedDeal;
    }

    return fallbackDealRows.find((row) => String(row.dealId) === String(dealId)) ?? null;
  }, [dealId, dealRows, fallbackDealRows]);

  const linkedServiceRows = useMemo(() => {
    if (!catalogService || !dealRow) {
      return [];
    }

    return getPurchaseLinkedServices({
      catalogService,
      purchase: dealRow.purchase,
      adminServices,
      catalogServices: services,
    })
      .map((service) => {
        const purchaseDetails = buildServicePurchaseDetails(service, [dealRow.purchase]);
        const clientRecord = clients.find((client) => {
          const serviceEmail = String(getServiceClientEmail(service) ?? '').trim().toLowerCase();
          const serviceName = String(getServiceClientName(service) ?? '').trim().toLowerCase();

          return (serviceEmail && String(client?.email ?? '').trim().toLowerCase() === serviceEmail)
            || (serviceName && String(client?.name ?? '').trim().toLowerCase() === serviceName);
        }) ?? null;

        return {
          service,
          purchaseDetails,
          clientRecord,
          displayStatus: getServiceDisplayStatus(service),
          expirationMeta: getAdminServiceExpirationMeta(service),
        };
      })
      .sort((left, right) => getPurchaseRecordTime(right.service) - getPurchaseRecordTime(left.service));
  }, [adminServices, catalogService, clients, dealRow, services]);

  const matchedLineItems = useMemo(() => {
    if (!catalogService || !dealRow) {
      return [];
    }

    return getCatalogServiceMatchedLineItems(catalogService, dealRow.purchase);
  }, [catalogService, dealRow]);

  const paymentProof = useMemo(
    () => dealRow?.purchase?.payments?.find((payment) => payment?.transactionRef) ?? null,
    [dealRow],
  );

  const paymentProofUrl = useMemo(() => {
    if (!paymentProof?.transactionRef) {
      return null;
    }

    const proofPath = paymentProof.transactionRef.startsWith('payment_proofs/')
      ? paymentProof.transactionRef
      : `payment_proofs/${paymentProof.transactionRef}`;

    return `${BACKEND_ORIGIN}/storage/${proofPath}`;
  }, [paymentProof]);

  const clientRecord = dealRow?.clientRecord ?? null;
  const paymentMethod = dealRow?.purchase?.paymentMethod ?? dealRow?.purchase?.payment_method ?? 'Not recorded';
  const dealNote = dealRow ? getDesiredDomainValue(dealRow.purchase) : '';
  const primaryLineItem = matchedLineItems[0] ?? dealRow?.purchase ?? null;
  const configurationText = getFirstDisplayValue(
    primaryLineItem?.configuration,
    primaryLineItem?.plan,
    primaryLineItem?.config,
    primaryLineItem?.option,
    linkedServiceRows[0]?.service?.plan,
  );
  const addonEntries = useMemo(
    () => mergeAddonEntries(
      ...matchedLineItems.map((lineItem) => extractAddonEntries(lineItem, { catalogService, addonKeys: PURCHASE_ADDON_KEYS, fallbackToAddonsKey: true })),
      dealRow ? extractAddonEntries(dealRow.purchase, { catalogService, addonKeys: PURCHASE_ADDON_KEYS, fallbackToAddonsKey: true }) : [],
    ),
    [catalogService, dealRow, matchedLineItems],
  );
  const addonSummary = addonEntries.length
    ? addonEntries.map((entry) => `${entry.label}${entry.billingCycle ? ` (${getBillingCycleLabel(entry.billingCycle)})` : ''}`).join(', ')
    : 'No add-ons selected';
  const clientPurchaseCount = useMemo(() => adminPurchases.filter((purchase) => {
    const purchaseEmail = String(purchase?.clientEmail ?? purchase?.customerEmail ?? purchase?.email ?? '').trim().toLowerCase();
    const purchaseName = String(purchase?.client ?? purchase?.customer ?? purchase?.clientName ?? purchase?.customerName ?? '').trim().toLowerCase();
    const currentEmail = String(dealRow?.clientEmail ?? '').trim().toLowerCase();
    const currentName = String(dealRow?.clientName ?? '').trim().toLowerCase();

    return (currentEmail && purchaseEmail === currentEmail) || (currentName && purchaseName === currentName);
  }).length, [adminPurchases, dealRow?.clientEmail, dealRow?.clientName]);
  const siblingServiceDeals = useMemo(() => adminPurchases.filter((purchase) => {
    if (String(purchase?.id ?? '') === String(dealRow?.purchase?.id ?? '')) {
      return false;
    }

    const purchaseEmail = String(purchase?.clientEmail ?? purchase?.customerEmail ?? purchase?.email ?? '').trim().toLowerCase();
    const purchaseName = String(purchase?.client ?? purchase?.customer ?? purchase?.clientName ?? purchase?.customerName ?? '').trim().toLowerCase();
    const currentEmail = String(dealRow?.clientEmail ?? '').trim().toLowerCase();
    const currentName = String(dealRow?.clientName ?? '').trim().toLowerCase();
    const sameClient = (currentEmail && purchaseEmail === currentEmail) || (currentName && purchaseName === currentName);

    if (!sameClient) {
      return false;
    }

    return getCatalogServiceMatchedLineItems(catalogService, purchase).length > 0;
  }).length, [adminPurchases, catalogService, dealRow?.clientEmail, dealRow?.clientName, dealRow?.purchase?.id]);
  const dealType = clientPurchaseCount > 1 ? 'Existing Client' : 'New Client';
  const dealSubType = siblingServiceDeals > 0 ? 'Renewal / Repeat Service' : 'New Service';
  const derivedDomainName = getFirstDisplayValue(
    dealNote,
    getDesiredDomainValue(primaryLineItem),
    primaryLineItem?.domain,
    primaryLineItem?.domainName,
    primaryLineItem?.domain_name,
    linkedServiceRows[0]?.service?.domain,
  );
  const operatingSystem = getFirstDisplayValue(
    primaryLineItem?.operatingSystem,
    primaryLineItem?.operating_system,
    extractConfigurationSpec(configurationText, /(alma linux os 8|alma linux|ubuntu(?:\s+\d+(?:\.\d+)*)?|debian(?:\s+\d+(?:\.\d+)*)?|centos(?:\s+\d+(?:\.\d+)*)?|rocky linux(?:\s+\d+(?:\.\d+)*)?|windows(?:\s+server)?(?:\s+\d+(?:\.\d+)*)?)/i),
  );
  const providerName = getFirstDisplayValue(
    primaryLineItem?.provider,
    primaryLineItem?.providerName,
    primaryLineItem?.provider_name,
    primaryLineItem?.dataCenterProvider,
    primaryLineItem?.data_center_provider,
    linkedServiceRows[0]?.service?.provider,
  );
  const createdLabel = getFirstDisplayValue(
    dealRow?.purchase?.createdBy,
    dealRow?.purchase?.created_by,
    'Portal Checkout',
  );
  const modifiedLabel = getFirstDisplayValue(
    dealRow?.purchase?.updatedBy,
    dealRow?.purchase?.updated_by,
    dealRow?.purchase?.updatedAt ? 'System Update' : '—',
  );
  const overviewLeftFields = [
    { label: 'Client Name', value: dealRow.clientName, emphasize: true },
    { label: 'Contact Name', value: clientRecord?.name ?? dealRow.clientName },
    { label: 'Deal Type', value: dealType },
    { label: 'Deal Sub-Type', value: dealSubType },
    { label: 'Product Category', value: catalogService.category },
    { label: 'Product Name', value: catalogService.name },
    { label: 'Sales Status', value: dealRow.status, badge: true },
    { label: 'Status Trigger Date', value: formatDate(dealRow.date) },
    { label: 'JO Number', value: dealRow.orderLabel },
  ];
  const overviewRightFields = [
    { label: 'Invoice Received Date', value: paymentProof?.createdAt ? formatDate(paymentProof.createdAt) : '—' },
    { label: 'Payment Commitment Date', value: getFirstDisplayValue(dealRow.purchase?.paymentCommitmentDate, dealRow.purchase?.payment_commitment_date) },
    { label: 'Collection Note', value: dealNote || '—', multiline: Boolean(dealNote) },
    { label: 'Created By', value: createdLabel, meta: dealRow.purchase?.createdAt ? formatDateTime(dealRow.purchase.createdAt) : '' },
    { label: 'Modified By', value: modifiedLabel, meta: dealRow.purchase?.updatedAt ? formatDateTime(dealRow.purchase.updatedAt) : '' },
  ];
  const solutionFields = [
    { label: 'Domain Name', value: derivedDomainName },
    { label: 'Data Center Provider', value: providerName },
    { label: 'Cloud Server Specification', value: configurationText, multiline: configurationText !== '—' },
    { label: 'Payment Method', value: paymentMethod },
    { label: 'Hosting Features Package', value: addonSummary, multiline: addonEntries.length > 1 },
    { label: 'Billing Cycle', value: getBillingCycleLabel(primaryLineItem?.billingCycle ?? primaryLineItem?.billing_cycle ?? catalogService?.billingCycle ?? catalogService?.billing_cycle) },
    { label: 'Operating System', value: operatingSystem },
    { label: 'Renewal Date', value: linkedServiceRows[0]?.service?.renewsOn ? formatDate(linkedServiceRows[0].service.renewsOn) : '—' },
    { label: 'vCPU', value: extractConfigurationSpec(configurationText, /(\d+(?:\.\d+)?)\s*vcpu/i, (match) => `${match[1]} vCPU`) },
    { label: 'Cloud Cost', value: typeof dealRow.amount === 'number' ? formatCurrency(dealRow.amount) : '—' },
    { label: 'RAM', value: extractConfigurationSpec(configurationText, /(\d+(?:\.\d+)?)\s*gb\s*ram/i, (match) => `${match[1]} GB`) },
    { label: 'Cloud Server Start Date', value: linkedServiceRows[0]?.service?.createdAt ? formatDate(linkedServiceRows[0].service.createdAt) : formatDate(dealRow.date) },
    { label: 'Storage', value: extractConfigurationSpec(configurationText, /(\d+(?:\.\d+)?)\s*(tb|gb)\s*(?:storage|nvme|ssd)?/i, (match) => `${match[1]} ${match[2].toUpperCase()}`) },
    { label: 'Cloud Server End Date', value: linkedServiceRows[0]?.service?.renewsOn ? formatDate(linkedServiceRows[0].service.renewsOn) : '—' },
    { label: 'Data Cap', value: extractConfigurationSpec(configurationText, /(\d+(?:\.\d+)?)\s*(tb|gb)\s*data\s*cap/i, (match) => `${match[1]} ${match[2].toUpperCase()}`) },
    { label: 'Service Instances', value: String(linkedServiceRows.length) },
  ];
  const relatedListItems = [
    { label: 'Notes', count: dealNote ? 1 : 0, helper: dealNote ? 'Customer note recorded' : 'No notes added' },
    { label: 'Connected Records', count: linkedServiceRows.length, helper: linkedServiceRows.length ? 'Provisioned services linked' : 'No service records yet' },
    { label: 'Attachments', count: paymentProofUrl ? 1 : 0, helper: paymentProofUrl ? 'Payment proof available' : 'No file uploaded' },
    { label: 'Matched Items', count: matchedLineItems.length || 1, helper: 'Purchase items tied to this service' },
    { label: 'Billing Profile', count: clientRecord ? 1 : 0, helper: clientRecord ? 'Client billing data on file' : 'No billing profile found' },
  ];
  const timelineEvents = useMemo(
    () => buildTimelineEvents({ dealRow, linkedServiceRows, paymentProof, catalogService }),
    [catalogService, dealRow, linkedServiceRows, paymentProof],
  );
  const cycleDuration = formatDuration(dealRow.purchase?.createdAt ?? dealRow.date, dealRow.purchase?.updatedAt ?? paymentProof?.createdAt ?? dealRow.date);
  const overallDuration = formatDuration(dealRow.purchase?.createdAt ?? dealRow.date, linkedServiceRows[0]?.service?.renewsOn ?? dealRow.purchase?.updatedAt ?? dealRow.date);

  if (!catalogService) {
    return (
      <div>
        <PageHeader
          eyebrow="Manage Services"
          title="Service not found"
          description="The selected catalog service could not be resolved from the current portal data."
          action={<Link to="/admin/services" className="btn-secondary px-4 py-3">Back to Manage Services</Link>}
        />
      </div>
    );
  }

  if (!dealRow) {
    return (
      <div>
        <div className="mb-4 text-xs uppercase tracking-[0.18em] text-slate-500">
          <Link to="/admin/services" className="transition hover:text-slate-200">Manage Services</Link>
          <span className="mx-2">/</span>
          <Link to={`/admin/services/${catalogService.id}`} state={{ service: catalogService }} className="transition hover:text-slate-200">{catalogService.name}</Link>
          <span className="mx-2">/</span>
          <span>Deal not found</span>
        </div>

        <PageHeader
          eyebrow="Deal Detail"
          title="Deal not found"
          description="The requested deal could not be matched to the selected service."
          action={<Link to={`/admin/services/${catalogService.id}`} state={{ service: catalogService }} className="btn-secondary px-4 py-3">Back to Service View</Link>}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 text-xs uppercase tracking-[0.18em] text-slate-500">
        <Link to="/admin/services" className="transition hover:text-slate-200">Manage Services</Link>
        <span className="mx-2">/</span>
        <Link to={`/admin/services/${catalogService.id}`} state={{ service: catalogService }} className="transition hover:text-slate-200">{catalogService.name}</Link>
        <span className="mx-2">/</span>
        <span>{dealRow.dealName}</span>
      </div>

      <PageHeader
        eyebrow="Deal Detail"
        title={dealRow.dealName}
        description={`Order ${dealRow.orderLabel} for ${catalogService.name}. The overview below follows the standard portal detail layout so billing, configuration, and service linkage are easier to review.`}
        action={<Link to={`/admin/services/${catalogService.id}`} state={{ service: catalogService }} className="btn-secondary px-4 py-3">Back to Service View</Link>}
      />

      <section className="crm-record-shell panel overflow-hidden">
        <div className="crm-record-header">
          <div>
            <p className="crm-record-kicker">Deal Overview</p>
            <h2 className="crm-record-title">{catalogService.name} {typeof dealRow.amount === 'number' ? `- ${formatCurrency(dealRow.amount)}` : ''}</h2>
            <p className="crm-record-subtitle">Order {dealRow.orderLabel} • {dealRow.clientName}</p>
          </div>

          <div className="crm-record-header-actions">
            <StatusBadge status={dealRow.status} />
            <div className="crm-record-pill">{linkedServiceRows.length} linked service{linkedServiceRows.length === 1 ? '' : 's'}</div>
          </div>
        </div>

        <div className="crm-record-body">
          <aside className="crm-record-sidebar">
            <div>
              <p className="crm-record-sidebar-title">Related List</p>
              <div className="crm-record-related-list">
                {relatedListItems.map((item) => (
                  <div key={item.label} className="crm-record-related-item panel-muted">
                    <div>
                      <p className="crm-record-related-label">{item.label}</p>
                      <p className="crm-record-related-helper">{item.helper}</p>
                    </div>
                    <span className="crm-record-related-count">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="crm-record-sales-summary panel-muted">
              <p className="crm-record-sidebar-title">Sales Summary</p>
              <div className="crm-record-summary-list">
                <div className="crm-record-summary-row">
                  <span>Lead Conversion Time</span>
                  <strong>NA</strong>
                </div>
                <div className="crm-record-summary-row">
                  <span>Sales Cycle Duration</span>
                  <strong>{cycleDuration}</strong>
                </div>
                <div className="crm-record-summary-row">
                  <span>Overall Sales Duration</span>
                  <strong>{overallDuration}</strong>
                </div>
              </div>

              <div className="crm-record-summary-links">
                {paymentProofUrl ? <a href={paymentProofUrl} target="_blank" rel="noreferrer">Open attachment</a> : <span>No attachment link</span>}
                <Link to={`/admin/services/${catalogService.id}`} state={{ service: catalogService }}>View service profile</Link>
              </div>
            </div>
          </aside>

          <div className="crm-record-main">
            <div className="crm-record-tabs">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`crm-record-tab ${activeTab === 'overview' ? 'is-active' : ''}`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className={`crm-record-tab ${activeTab === 'timeline' ? 'is-active' : ''}`}
              >
                Timeline
              </button>
            </div>

            {activeTab === 'overview' ? (
              <div className="crm-record-content">
                <section className="crm-record-panel panel-muted">
                  <div className="crm-record-two-column-grid">
                    <div className="crm-record-field-group">
                      {overviewLeftFields.map((field) => (
                        <div key={field.label} className="crm-record-field-row">
                          <p className="crm-record-field-label">{field.label}</p>
                          <div className="crm-record-field-value-wrap">
                            {field.badge ? <StatusBadge status={field.value} /> : (
                              <p className={`crm-record-field-value ${field.emphasize ? 'is-emphasized' : ''}`}>{field.value}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="crm-record-field-group">
                      {overviewRightFields.map((field) => (
                        <div key={field.label} className="crm-record-field-row">
                          <p className="crm-record-field-label">{field.label}</p>
                          <div className="crm-record-field-value-wrap">
                            <p className={`crm-record-field-value ${field.multiline ? 'is-multiline' : ''}`}>{field.value}</p>
                            {field.meta ? <p className="crm-record-field-meta">{field.meta}</p> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="crm-record-panel panel-muted">
                  <div className="crm-record-section-heading">
                    <div>
                      <p className="crm-record-section-kicker">{catalogService.category || 'Product Section'}</p>
                      <h3 className="crm-record-section-title">{catalogService.name}</h3>
                    </div>
                  </div>

                  <div className="crm-record-solution-grid">
                    {solutionFields.map((field) => (
                      <div key={field.label} className="crm-record-solution-field">
                        <p className="crm-record-field-label">{field.label}</p>
                        <p className={`crm-record-field-value ${field.multiline ? 'is-multiline' : ''}`}>{field.value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="crm-record-support-grid">
                  <section className="crm-record-panel panel-muted">
                    <div className="crm-record-section-heading compact">
                      <div>
                        <p className="crm-record-section-kicker">Payment Proof</p>
                        <h3 className="crm-record-section-title">Attachment preview</h3>
                      </div>
                    </div>

                    {paymentProofUrl ? (
                      <div className="crm-record-proof-block">
                        <a href={paymentProofUrl} target="_blank" rel="noreferrer" className="crm-record-proof-image-wrap">
                          <img src={paymentProofUrl} alt="Payment proof" className="crm-record-proof-image" />
                        </a>
                        <div className="crm-record-proof-meta">
                          <div>
                            <p className="crm-record-field-value">Proof uploaded</p>
                            <p className="crm-record-field-meta">{paymentProof?.createdAt ? formatDateTime(paymentProof.createdAt) : 'Upload time unavailable'}</p>
                          </div>
                          <a href={paymentProofUrl} target="_blank" rel="noreferrer" className="btn-secondary px-4 py-2 text-xs">Open proof</a>
                        </div>
                      </div>
                    ) : (
                      <div className="crm-record-empty-state">No payment proof is attached to this deal yet.</div>
                    )}
                  </section>

                  <section className="crm-record-panel panel-muted">
                    <div className="crm-record-section-heading compact">
                      <div>
                        <p className="crm-record-section-kicker">Billing Contact</p>
                        <h3 className="crm-record-section-title">Client billing details</h3>
                      </div>
                    </div>

                    <div className="crm-record-profile-card">
                      <div className="crm-record-profile-head">
                        <UserAvatar user={{ name: dealRow.clientName, profilePhotoUrl: clientRecord?.profilePhotoUrl }} size="h-11 w-11" textSize="text-sm" />
                        <div>
                          <p className="crm-record-field-value is-emphasized">{dealRow.clientName}</p>
                          <p className="crm-record-field-meta">{dealRow.clientEmail}</p>
                        </div>
                      </div>

                      <div className="crm-record-profile-grid">
                        <div>
                          <p className="crm-record-field-label">Company</p>
                          <p className="crm-record-field-value">{clientRecord?.company || '—'}</p>
                        </div>
                        <div>
                          <p className="crm-record-field-label">TIN</p>
                          <p className="crm-record-field-value">{clientRecord?.tin || '—'}</p>
                        </div>
                        <div>
                          <p className="crm-record-field-label">Address</p>
                          <p className="crm-record-field-value is-multiline">{clientRecord?.address || '—'}</p>
                        </div>
                        <div>
                          <p className="crm-record-field-label">Mobile Number</p>
                          <p className="crm-record-field-value">{clientRecord?.mobileNumber || '—'}</p>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            ) : (
              <div className="crm-record-content">
                <section className="crm-record-panel panel-muted">
                  <div className="crm-record-section-heading">
                    <div>
                      <p className="crm-record-section-kicker">Timeline</p>
                      <h3 className="crm-record-section-title">Deal activity stream</h3>
                    </div>
                  </div>

                  <div className="crm-record-timeline">
                    {timelineEvents.length ? timelineEvents.map((event) => (
                      <div key={event.id} className="crm-record-timeline-item">
                        <div className={`crm-record-timeline-dot tone-${event.tone}`} />
                        <div className="crm-record-timeline-card panel-muted">
                          <div className="crm-record-timeline-head">
                            <p className="crm-record-field-value is-emphasized">{event.title}</p>
                            <p className="crm-record-field-meta">{formatDateTime(event.time)}</p>
                          </div>
                          <p className="crm-record-field-value">{event.description}</p>
                        </div>
                      </div>
                    )) : (
                      <div className="crm-record-empty-state">No timeline activity is available for this deal yet.</div>
                    )}
                  </div>
                </section>

                <section className="crm-record-panel panel-muted">
                  <div className="crm-record-section-heading">
                    <div>
                      <p className="crm-record-section-kicker">Connected Records</p>
                      <h3 className="crm-record-section-title">Linked customer service instances</h3>
                    </div>
                  </div>

                  <div className="crm-record-connected-list">
                    {linkedServiceRows.length ? linkedServiceRows.map(({ service, purchaseDetails, clientRecord: linkedClientRecord, displayStatus, expirationMeta }) => (
                      <article key={service.id} className="crm-record-connected-item panel-muted">
                        <div className="crm-record-profile-head">
                          <UserAvatar user={{ name: getServiceClientName(service), profilePhotoUrl: linkedClientRecord?.profilePhotoUrl }} size="h-11 w-11" textSize="text-sm" />
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="crm-record-field-value is-emphasized">{getServiceClientName(service)}</p>
                              <StatusBadge status={displayStatus} />
                            </div>
                            <p className="crm-record-field-meta">{getServiceClientEmail(service) || 'No billing email recorded'}</p>
                            {getServiceSubtitle(service) ? <p className="crm-record-field-meta">{getServiceSubtitle(service)}</p> : null}
                          </div>
                        </div>

                        <div className="crm-record-connected-meta-grid">
                          <div>
                            <p className="crm-record-field-label">Plan Expiry</p>
                            <p className="crm-record-field-value">{expirationMeta.value}</p>
                            <p className="crm-record-field-meta">{expirationMeta.helper}</p>
                          </div>
                          <div>
                            <p className="crm-record-field-label">Matched Charge</p>
                            <p className="crm-record-field-value">{typeof purchaseDetails.totalPaid === 'number' ? formatCurrency(purchaseDetails.totalPaid) : '—'}</p>
                            <p className="crm-record-field-meta">Provisioned from order {dealRow.orderLabel}</p>
                          </div>
                        </div>
                      </article>
                    )) : (
                      <div className="crm-record-empty-state">No customer service records have been provisioned from this deal yet.</div>
                    )}
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
