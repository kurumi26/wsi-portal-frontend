import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LayoutGrid, List } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import { usePortal } from '../../context/PortalContext';
import { formatCurrency, formatDateTime } from '../../utils/format';

export default function AdminDashboardPage() {
  const { stats, clients, adminServices, adminPurchases } = usePortal();
  const [selectedTimeline, setSelectedTimeline] = useState(null);
  const [selectedStatCard, setSelectedStatCard] = useState(null);
  const [provPage, setProvPage] = useState(1);
  const [clientsView, setClientsView] = useState('grid');
  const [provView, setProvView] = useState('grid');

  const approvedClientsList = clients.filter((client) => {
    const approvalStatus = client.registrationApproval?.statusKey;

    if (approvalStatus === 'pending' || approvalStatus === 'rejected') {
      return false;
    }

    return true;
  });
  const activeServicesList = adminServices.filter((service) => service.status === 'Active');
  const provisioningList = adminServices.filter((service) => service.status === 'Undergoing Provisioning');
  const provPerPage = 2;
  const provTotalPages = Math.max(1, Math.ceil(provisioningList.length / provPerPage));

  useEffect(() => {
    if (provPage > provTotalPages) setProvPage(provTotalPages);
  }, [provPage, provTotalPages]);

  useEffect(() => {
    if (!selectedStatCard) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedStatCard(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedStatCard]);

  useEffect(() => {
    if (!selectedStatCard) {
      document.body.classList.remove('service-summary-modal-open');
      document.body.style.overflow = '';
      return undefined;
    }

    document.body.classList.add('service-summary-modal-open');
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.classList.remove('service-summary-modal-open');
      document.body.style.overflow = '';
    };
  }, [selectedStatCard]);

  const rateCards = useMemo(() => {
    const totalManagedServices = adminServices.length;
    const approvedClients = approvedClientsList.length;

    const buildRate = (label, numerator, denominator, helper, accentClass, modalTitle, modalDescription, rows) => ({
      label,
      numerator,
      denominator,
      helper,
      accentClass,
      modalTitle,
      modalDescription,
      rows,
      value: denominator ? Math.round((numerator / denominator) * 100) : 0,
    });

    return [
      buildRate(
        'Activation Rate',
        stats.activeServices,
        totalManagedServices,
        'Active subscriptions across all managed services.',
        'from-emerald-400 to-sky-400',
        'Activation Rate Details',
        'Services currently active out of the full managed service portfolio.',
        activeServicesList.map((service) => ({
          id: service.id,
          title: service.name,
          subtitle: service.client || service.customer || service.category,
          badge: service.status,
          fields: [
            { label: 'Plan', value: service.plan || 'Not assigned' },
            { label: 'Renews On', value: service.renewsOn ? formatDateTime(service.renewsOn) : 'Not scheduled' },
          ],
        })),
      ),
      buildRate(
        'Approval Rate',
        approvedClients,
        clients.length,
        'Customer registrations currently approved for portal access.',
        'from-sky-400 to-cyan-300',
        'Approval Rate Details',
        'Approved customer registrations compared to the full client list.',
        approvedClientsList.map((client) => ({
          id: client.id,
          title: client.name,
          subtitle: client.email,
          badge: client.status,
          fields: [
            { label: 'Services', value: `${client.services} Services` },
            { label: 'Joined', value: client.joinedAt ? formatDateTime(client.joinedAt) : 'Not available' },
          ],
        })),
      ),
      buildRate(
        'Provisioning Rate',
        stats.provisioning,
        totalManagedServices,
        'Services still being provisioned by the admin team.',
        'from-orange-400 to-amber-300',
        'Provisioning Rate Details',
        'Services still in provisioning compared to the total managed service count.',
        provisioningList.map((service) => ({
          id: service.id,
          title: service.name,
          subtitle: service.client || service.customer || service.category,
          badge: service.status,
          fields: [
            { label: 'Plan', value: service.plan || 'Not assigned' },
            { label: 'Target Date', value: service.renewsOn ? formatDateTime(service.renewsOn) : 'Pending schedule' },
          ],
        })),
      ),
    ];
  }, [activeServicesList, adminServices.length, approvedClientsList, clients.length, provisioningList, stats.activeServices, stats.provisioning]);

  const adminStatCards = useMemo(
    () => [
      {
        label: 'Total Clients',
        value: stats.totalClients,
        helper: 'Registered customers',
        accent: 'cyan',
        modalTitle: 'Registered Clients',
        modalDescription: 'Customer accounts currently visible to administrators.',
        rows: clients.map((client) => ({
          id: client.id,
          title: client.name,
          subtitle: client.email,
          badge: client.status,
          fields: [
            { label: 'Services', value: `${client.services} Services` },
            { label: 'Joined', value: client.joinedAt ? formatDateTime(client.joinedAt) : 'Not available' },
          ],
        })),
      },
      {
        label: 'Active Services',
        value: stats.activeServices,
        helper: 'Running subscriptions',
        accent: 'emerald',
        modalTitle: 'Active Service Portfolio',
        modalDescription: 'Subscriptions currently running under administrator oversight.',
        rows: activeServicesList.map((service) => ({
          id: service.id,
          title: service.name,
          subtitle: service.client || service.customer || service.category,
          badge: service.status,
          fields: [
            { label: 'Plan', value: service.plan || 'Not assigned' },
            { label: 'Renews On', value: service.renewsOn ? formatDateTime(service.renewsOn) : 'Not scheduled' },
          ],
        })),
      },
      {
        label: 'Provisioning Queue',
        value: stats.provisioning,
        helper: 'Requires admin oversight',
        accent: 'amber',
        modalTitle: 'Provisioning Queue',
        modalDescription: 'Services that still need review, setup, or final activation.',
        rows: provisioningList.map((service) => ({
          id: service.id,
          title: service.name,
          subtitle: service.client || service.customer || service.category,
          badge: service.status,
          fields: [
            { label: 'Plan', value: service.plan || 'Not assigned' },
            { label: 'Target Date', value: service.renewsOn ? formatDateTime(service.renewsOn) : 'Pending schedule' },
          ],
        })),
      },
      {
        label: 'Revenue Logged',
        value: formatCurrency(stats.totalRevenue),
        helper: 'Across recorded purchases',
        accent: 'violet',
        modalTitle: 'Recorded Revenue',
        modalDescription: 'Purchase records contributing to the dashboard revenue total.',
        rows: adminPurchases.map((purchase) => ({
          id: purchase.id,
          title: purchase.serviceName,
          subtitle: purchase.client,
          badge: purchase.status,
          fields: [
            { label: 'Amount', value: formatCurrency(purchase.amount) },
            { label: 'Date', value: purchase.date ? formatDateTime(purchase.date) : 'Not available' },
          ],
        })),
      },
    ],
    [activeServicesList, adminPurchases, clients, provisioningList, stats.activeServices, stats.provisioning, stats.totalClients, stats.totalRevenue],
  );

  const statCardModal = selectedStatCard
    ? createPortal(
        <div
          className="fixed inset-0 z-[80] flex min-h-screen items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-stat-modal-title"
          onClick={() => setSelectedStatCard(null)}
        >
          <div
            className="panel flex max-h-[min(88vh,760px)] w-full max-w-4xl flex-col overflow-hidden p-0"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative border-b border-white/10 px-6 py-5">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300/80">Admin Overview</p>
                <h2 id="admin-stat-modal-title" className="mt-2 pr-28 text-2xl font-semibold text-white">
                  {selectedStatCard.modalTitle}
                </h2>
                <p className="mt-2 pr-28 text-sm text-slate-300">{selectedStatCard.modalDescription}</p>
                {selectedStatCard.numerator !== undefined && selectedStatCard.denominator !== undefined ? (
                  <div className="mt-4 w-full rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Current Rate</p>
                        <p className="mt-2 text-3xl font-semibold text-white">{selectedStatCard.value}%</p>
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                        {selectedStatCard.numerator}/{selectedStatCard.denominator || 0}
                      </div>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${selectedStatCard.accentClass}`}
                        style={{ width: `${selectedStatCard.value}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setSelectedStatCard(null)}
                className="btn-secondary absolute right-6 top-5 shrink-0 px-4"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-4 pr-1">
                {selectedStatCard.rows.length ? (
                  selectedStatCard.rows.map((row) => (
                    <div key={row.id} className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{row.title}</h3>
                          <p className="mt-1 text-sm text-slate-300">{row.subtitle}</p>
                        </div>
                        {row.badge ? <StatusBadge status={row.badge} /> : null}
                      </div>
                      <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                        {row.fields.map((field) => (
                          <div key={`${row.id}-${field.label}`}>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{field.label}</p>
                            <p className="mt-1 text-white">{field.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-slate-400">
                    No records are available for this card right now.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div>
      <PageHeader
        eyebrow="Operations Dashboard"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {adminStatCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            helper={card.helper}
            accent={card.accent}
            onClick={() => setSelectedStatCard(card)}
          />
        ))}
      </div>

      <div className="mt-3 grid gap-4 xl:grid-cols-3">
        {rateCards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => setSelectedStatCard(card)}
            className="panel p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-slate-500/70"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-300">{card.label}</p>
                <p className="mt-3 text-3xl font-semibold text-white">{card.value}%</p>
                <p className="mt-2 text-sm text-slate-400">{card.helper}</p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                {card.numerator}/{card.denominator || 0}
              </div>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${card.accentClass}`}
                style={{ width: `${card.value}%` }}
              />
            </div>
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Recent clients</h2>
            <div className="inline-flex items-center gap-2">
              <button type="button" onClick={() => setClientsView('grid')} className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition ${clientsView === 'grid' ? 'bg-orange-400 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`} aria-label="Grid view">
                <LayoutGrid size={16} />
              </button>
              <button type="button" onClick={() => setClientsView('list')} className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition ${clientsView === 'list' ? 'bg-orange-400 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`} aria-label="List view">
                <List size={16} />
              </button>
            </div>
          </div>

          {clientsView === 'list' ? (
            <div className="mt-6 space-y-4">
              {clients.map((client) => (
                <div key={client.id} className="panel-muted flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-white">{client.name}</p>
                    <p className="mt-1 text-sm text-slate-400">{client.email}</p>
                  </div>
                  <div className="text-right text-sm text-slate-400 flex flex-col items-end">
                    <p>{client.services} Services</p>
                    <div className="mt-1"><StatusBadge status={client.status} /></div>
                    {client.joinedAt ? (
                      <button
                        type="button"
                        onClick={() => setSelectedTimeline({
                          title: client.name,
                          subtitle: client.email,
                          label: 'Joined At',
                          value: client.joinedAt,
                        })}
                        className="mt-1 text-xs text-sky-200 underline decoration-sky-400/40 underline-offset-4 transition hover:text-sky-100"
                      >
                        {formatDateTime(client.joinedAt)}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {clients.map((client) => (
                <div key={client.id} className="panel-muted p-4">
                  <p className="font-medium text-white">{client.name}</p>
                  <p className="mt-1 text-sm text-slate-400">{client.email}</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-sm text-slate-400">{client.services} Services</div>
                    <div><StatusBadge status={client.status} /></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Provisioning watchlist</h2>
            <div className="inline-flex items-center gap-2">
              <button type="button" onClick={() => setProvView('grid')} className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition ${provView === 'grid' ? 'bg-orange-400 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`} aria-label="Grid view">
                <LayoutGrid size={16} />
              </button>
              <button type="button" onClick={() => setProvView('list')} className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition ${provView === 'list' ? 'bg-orange-400 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`} aria-label="List view">
                <List size={16} />
              </button>
            </div>
          </div>

          {provView === 'list' ? (
            <div className="mt-6 space-y-4 max-h-[48vh] overflow-auto pr-2">
              {provisioningList.slice((provPage - 1) * provPerPage, provPage * provPerPage).map((service) => (
                <div key={service.id} className="panel-muted p-4">
                  <p className="font-medium text-white">{service.name}</p>
                  <p className="mt-1 text-sm text-slate-400">Plan: {service.plan}</p>
                  {service.renewsOn ? (
                    <button
                      type="button"
                      onClick={() => setSelectedTimeline({
                        title: service.name,
                        subtitle: `Plan: ${service.plan}`,
                        label: 'Renewal Timeline',
                        value: service.renewsOn,
                      })}
                      className="mt-2 text-xs text-sky-200 underline decoration-sky-400/40 underline-offset-4 transition hover:text-sky-100"
                    >
                      {formatDateTime(service.renewsOn)}
                    </button>
                  ) : null}
                </div>
              ))}

              <div className="mt-3 flex items-center justify-between px-2">
                <div className="text-sm text-slate-400">Page {provPage} / {provTotalPages}</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setProvPage((p) => Math.max(1, p - 1))}
                    disabled={provPage <= 1}
                    className="btn-secondary px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setProvPage((p) => Math.min(provTotalPages, p + 1))}
                    disabled={provPage >= provTotalPages}
                    className="btn-secondary px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-1 lg:grid-cols-2">
              {provisioningList.slice((provPage - 1) * provPerPage, provPage * provPerPage).map((service) => (
                <div key={service.id} className="panel-muted p-4">
                  <p className="font-medium text-white">{service.name}</p>
                  <p className="mt-1 text-sm text-slate-400">Plan: {service.plan}</p>
                  {service.renewsOn ? (
                    <div className="mt-2 text-xs text-sky-200">{formatDateTime(service.renewsOn)}</div>
                  ) : null}
                </div>
              ))}

              <div className="col-span-full mt-2 flex items-center justify-between px-2">
                <div className="text-sm text-slate-400">Page {provPage} / {provTotalPages}</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setProvPage((p) => Math.max(1, p - 1))}
                    disabled={provPage <= 1}
                    className="btn-secondary px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setProvPage((p) => Math.min(provTotalPages, p + 1))}
                    disabled={provPage >= provTotalPages}
                    className="btn-secondary px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedTimeline ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="panel w-full max-w-lg p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Timeline Details</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{selectedTimeline.title}</h2>
                <p className="mt-2 text-sm text-slate-400">{selectedTimeline.subtitle}</p>
              </div>
              <button type="button" onClick={() => setSelectedTimeline(null)} className="btn-secondary px-4">
                Close
              </button>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{selectedTimeline.label}</p>
              <p className="mt-3 text-lg font-semibold text-white">{formatDateTime(selectedTimeline.value)}</p>
            </div>
          </div>
        </div>
      ) : null}

      {statCardModal}
    </div>
  );
}
