import { useMemo, useState, useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import StatusBadge from '../../components/common/StatusBadge';
import UserAvatar from '../../components/common/UserAvatar';
import { usePortal } from '../../context/PortalContext';
import { buildAddonCatalogMap, getAddonBillingCycleLabel } from '../../utils/addons';
import {
  buildCatalogServiceDealRows,
  buildServicePurchaseDetails,
  getCatalogServiceRelatedServices,
  getPurchaseDisplayId,
  getPurchaseRecordTime,
  getServiceClientEmail,
  getServiceClientName,
  getServiceSubtitle,
} from '../../utils/adminDeals';
import { formatCurrency, formatDate } from '../../utils/format';
import { getAdminServiceExpirationMeta, getServiceDisplayStatus } from '../../utils/services';

const getBillingCycleLabel = (value) => getAddonBillingCycleLabel(value, 'Recurring');
const DEALS_PER_PAGE = 5;

export default function ManageServiceDetailPage() {
  const { serviceId } = useParams();
  const location = useLocation();
  const { services, adminServices, adminPurchases, clients } = usePortal();

  const stateService = location.state?.service ?? null;

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

  const catalogAddons = useMemo(() => {
    if (!catalogService) {
      return [];
    }

    return Array.from(buildAddonCatalogMap(catalogService).values());
  }, [catalogService]);

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

  const [dealsPage, setDealsPage] = useState(1);
  const totalDealPages = Math.max(1, Math.ceil(dealRows.length / DEALS_PER_PAGE));
  const paginatedDealRows = useMemo(
    () => dealRows.slice((dealsPage - 1) * DEALS_PER_PAGE, dealsPage * DEALS_PER_PAGE),
    [dealsPage, dealRows],
  );

  useEffect(() => {
    setDealsPage(1);
  }, [catalogService]);

  useEffect(() => {
    if (dealsPage > totalDealPages) {
      setDealsPage(totalDealPages);
    }
  }, [dealsPage, totalDealPages]);

  const serviceInstanceRows = useMemo(() => {
    if (!catalogService) {
      return [];
    }

    return getCatalogServiceRelatedServices(catalogService, adminServices, services)
      .map((service) => {
        const clientRecord = clients.find((client) => {
          const serviceEmail = String(getServiceClientEmail(service) ?? '').trim().toLowerCase();
          const serviceName = String(getServiceClientName(service) ?? '').trim().toLowerCase();

          return (serviceEmail && String(client?.email ?? '').trim().toLowerCase() === serviceEmail)
            || (serviceName && String(client?.name ?? '').trim().toLowerCase() === serviceName);
        }) ?? null;
        const purchaseDetails = buildServicePurchaseDetails(service, adminPurchases);

        return {
          service,
          clientRecord,
          purchaseDetails,
          displayStatus: getServiceDisplayStatus(service),
          expirationMeta: getAdminServiceExpirationMeta(service),
        };
      })
      .sort((left, right) => {
        const timeDifference = getPurchaseRecordTime(right.purchaseDetails.purchase ?? right.service) - getPurchaseRecordTime(left.purchaseDetails.purchase ?? left.service);
        if (timeDifference !== 0) {
          return timeDifference;
        }

        const renewsOnLeft = new Date(left.service?.renewsOn ?? 0).getTime();
        const renewsOnRight = new Date(right.service?.renewsOn ?? 0).getTime();
        return renewsOnRight - renewsOnLeft;
      });
  }, [adminPurchases, adminServices, catalogService, clients, services]);

  const totalRevenue = useMemo(
    () => dealRows.reduce((sum, row) => sum + (typeof row.amount === 'number' ? row.amount : 0), 0),
    [dealRows],
  );

  const activeProvisionedCount = useMemo(
    () => serviceInstanceRows.filter((row) => row.displayStatus !== 'Expired').length,
    [serviceInstanceRows],
  );

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

  return (
    <div>
      <div className="mb-4 text-xs uppercase tracking-[0.18em] text-slate-500">
        <Link to="/admin/services" className="transition hover:text-slate-200">Manage Services</Link>
        <span className="mx-2">/</span>
        <span>{catalogService.name}</span>
      </div>

      <PageHeader
        eyebrow="Service Deal View"
        title={catalogService.name}
        description={catalogService.description || 'Review related deals, provisioned service records, and catalog add-ons for this service.'}
        action={<Link to="/admin/services" className="btn-secondary px-4 py-3">Back to Manage Services</Link>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="panel-muted p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Base Price</p>
          <p className="mt-3 text-2xl font-semibold text-white">
            {typeof catalogService.price === 'number' ? formatCurrency(catalogService.price) : '—'}
          </p>
          <p className="mt-2 text-sm text-slate-400">{getBillingCycleLabel(catalogService.billingCycle ?? catalogService.billing_cycle)}</p>
        </div>

        <div className="panel-muted p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Related Deals</p>
          <p className="mt-3 text-2xl font-semibold text-white">{dealRows.length}</p>
          <p className="mt-2 text-sm text-slate-400">Purchase records matched to this service</p>
        </div>

        <div className="panel-muted p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Provisioned Records</p>
          <p className="mt-3 text-2xl font-semibold text-white">{activeProvisionedCount}</p>
          <p className="mt-2 text-sm text-slate-400">Active or scheduled customer service records</p>
        </div>

        <div className="panel-muted p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total Revenue</p>
          <p className="mt-3 text-2xl font-semibold text-white">{totalRevenue ? formatCurrency(totalRevenue) : '—'}</p>
          <p className="mt-2 text-sm text-slate-400">Combined value of matched deals</p>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <section className="panel overflow-hidden">
          <div className="border-b border-white/10 px-6 py-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Related Deals</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Deal list</h2>
            <p className="mt-2 text-sm text-slate-400">Click a deal name to open the full order and service record view.</p>
          </div>

          {dealRows.length ? (
            <>
            <div className="overflow-x-auto xl:overflow-visible">
              <table className="min-w-full table-auto divide-y divide-white/10 text-left text-sm">
                <thead className="bg-white/5 text-slate-400">
                  <tr>
                    <th className="px-4 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.14em]">Billing-In-Charge</th>
                    <th className="px-4 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.14em]">Deal Owner</th>
                    <th className="px-4 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.14em]">Stage</th>
                    <th className="px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.14em]">Client Name</th>
                    <th className="px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.14em]">Product Category</th>
                    <th className="px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.14em]">Product Name</th>
                    <th className="px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.14em]">Deal Name</th>
                    <th className="px-4 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.14em]">Deal Status</th>
                    <th className="px-4 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.14em] whitespace-nowrap">Deal Type</th>
                    <th className="px-4 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.14em] whitespace-nowrap">Deal Sub-Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {paginatedDealRows.map((row) => (
                    <tr key={row.dealId} className="table-row-hoverable">
                      <td className="px-4 py-5 align-middle text-center text-slate-200">
                        <p className="text-sm font-medium text-white">{row.billingInCharge}</p>
                      </td>
                      <td className="px-4 py-5 align-middle text-center text-slate-200">
                        <p className="text-sm font-medium text-white">{row.dealOwner}</p>
                      </td>
                      <td className="px-4 py-5 align-middle text-center text-slate-200">
                        <p className="text-sm font-medium leading-6 text-white">{row.stage}</p>
                      </td>
                      <td className="px-4 py-5 align-top text-slate-200">
                        <div className="flex items-start gap-3">
                          <UserAvatar user={{ name: row.clientName, profilePhotoUrl: row.clientRecord?.profilePhotoUrl }} size="h-10 w-10" textSize="text-sm" />
                          <div className="min-w-0">
                            <p className="break-words font-medium text-white">{row.clientName}</p>
                            <p className="mt-1 break-words text-xs text-slate-500">{row.clientEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-5 align-top text-slate-200">
                        <p className="font-medium leading-6 text-white">{row.productCategory}</p>
                      </td>
                      <td className="px-4 py-5 align-top text-slate-200">
                        <p className="font-medium leading-6 text-white">{row.productName}</p>
                      </td>
                      <td className="px-4 py-5 align-top text-slate-200">
                        <Link
                          to={`/admin/services/${catalogService.id}/deals/${row.dealId}`}
                          state={{ service: catalogService, deal: row.purchase }}
                          className="break-words font-semibold text-sky-300 transition hover:text-sky-200"
                        >
                          {row.dealName}
                        </Link>
                        <p className="mt-1 break-words text-xs text-slate-500">
                          Order {row.orderLabel}
                          {typeof row.amount === 'number' ? ` • ${formatCurrency(row.amount)}` : ''}
                          {row.date ? ` • ${formatDate(row.date)}` : ''}
                        </p>
                        <p className="mt-1 break-words text-xs text-slate-500">
                          {row.lineItemCount > 1 ? `${row.lineItemCount} matching items` : '1 matching item'}
                          {row.linkedServiceCount ? ` • ${row.linkedServiceCount} provisioned record${row.linkedServiceCount > 1 ? 's' : ''}` : ''}
                        </p>
                        {row.customerNote ? <p className="mt-2 break-all text-xs text-sky-200">Customer note: {row.customerNote}</p> : null}
                      </td>
                      <td className="px-4 py-5 align-middle text-center text-slate-200">
                        <div className="flex justify-center">
                          <StatusBadge status={row.dealStatus} />
                        </div>
                      </td>
                      <td className="px-4 py-5 align-middle text-center text-slate-200">
                        <p className="text-sm font-medium leading-6 text-white">{row.dealType}</p>
                      </td>
                      <td className="px-4 py-5 align-middle text-center text-slate-200">
                        <p className="text-sm font-medium leading-6 text-white">{row.dealSubType}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4">
              <Pagination currentPage={dealsPage} totalPages={totalDealPages} onPageChange={setDealsPage} />
            </div>
            </>
          ) : (
            <div className="px-6 py-12 text-sm text-slate-400">
              No deals are currently linked to this catalog service.
            </div>
          )}
        </section>

        <section className="panel p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Provisioned Service Records</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Client service instances</h2>
              <p className="mt-2 text-sm text-slate-400">These are the customer-facing service records currently mapped to this catalog service.</p>
            </div>
            <div className="badge bg-white/5 text-slate-200">{serviceInstanceRows.length} record{serviceInstanceRows.length === 1 ? '' : 's'}</div>
          </div>

          <div className="mt-5 space-y-4">
            {serviceInstanceRows.length ? serviceInstanceRows.map(({ service, clientRecord, purchaseDetails, displayStatus, expirationMeta }) => (
              <article key={service.id} className="panel-muted p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-3">
                    <UserAvatar user={{ name: getServiceClientName(service), profilePhotoUrl: clientRecord?.profilePhotoUrl }} size="h-11 w-11" textSize="text-sm" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-white">{getServiceClientName(service)}</p>
                        <StatusBadge status={displayStatus} />
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{getServiceClientEmail(service) || 'No billing email recorded'}</p>
                      {getServiceSubtitle(service) ? <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">{getServiceSubtitle(service)}</p> : null}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Plan Expiry</p>
                      <p className="mt-2 text-sm font-medium text-white">{expirationMeta.value}</p>
                      <p className="mt-1 text-xs text-slate-500">{expirationMeta.helper}</p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Linked Deal</p>
                      {purchaseDetails.purchase ? (
                        <>
                          <Link
                            to={`/admin/services/${catalogService.id}/deals/${purchaseDetails.purchase.id ?? getPurchaseDisplayId(purchaseDetails.purchase)}`}
                            state={{ service: catalogService, deal: purchaseDetails.purchase }}
                            className="mt-2 inline-flex text-sm font-medium text-sky-300 transition hover:text-sky-200"
                          >
                            {getPurchaseDisplayId(purchaseDetails.purchase)}
                          </Link>
                          <p className="mt-1 text-xs text-slate-500">{formatDate(purchaseDetails.purchase.date ?? purchaseDetails.purchase.createdAt)}</p>
                        </>
                      ) : (
                        <p className="mt-2 text-sm text-slate-400">No purchase linked</p>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            )) : (
              <div className="panel-muted p-5 text-sm text-slate-400">
                No customer service records are currently linked to this catalog service.
              </div>
            )}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="panel p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Service Profile</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Catalog summary</h2>

            <div className="mt-5 space-y-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Category</p>
                <p className="mt-2 text-sm text-white">{catalogService.category || '—'}</p>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Billing Cycle</p>
                <p className="mt-2 text-sm text-white">{getBillingCycleLabel(catalogService.billingCycle ?? catalogService.billing_cycle)}</p>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Catalog ID</p>
                <p className="mt-2 text-sm text-white">{catalogService.id}</p>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Migration Paths</p>
                {Array.isArray(catalogService.migrationPaths) && catalogService.migrationPaths.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {catalogService.migrationPaths.map((path) => (
                      <span key={path} className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                        {path}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">No migration paths configured.</p>
                )}
              </div>
            </div>
          </section>

          <section className="panel p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Catalog Add-ons</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Available options</h2>

            <div className="mt-5 space-y-3">
              {catalogAddons.length ? catalogAddons.map((addon) => (
                <div key={`${addon.label}-${addon.billingCycle ?? 'default'}`} className="panel-muted p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{addon.label}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{getBillingCycleLabel(addon.billingCycle)}</p>
                    </div>
                    <p className="text-sm font-semibold text-sky-300">{typeof addon.price === 'number' ? formatCurrency(addon.price) : '—'}</p>
                  </div>
                </div>
              )) : (
                <div className="panel-muted p-4 text-sm text-slate-400">
                  No add-ons are configured for this service.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
