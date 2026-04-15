import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import DataTable from '../../components/common/DataTable';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import { usePortal } from '../../context/PortalContext';
import usePageTitle from '../../hooks/usePageTitle';
import { formatDate } from '../../utils/format';
import { getRenewalCountdownMeta, getServiceDisplayStatus, hasRenewalCountdown } from '../../utils/services';

export default function MyServicesPage() {
  usePageTitle('My Services');

  const location = useLocation();
  const { myServices } = usePortal();
  const [statusFilter, setStatusFilter] = useState(location.state?.statusFilter ?? 'All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSummaryCard, setSelectedSummaryCard] = useState(null);

  useEffect(() => {
    if (location.state?.statusFilter) {
      setStatusFilter(location.state.statusFilter);
    }
  }, [location.state]);

  useEffect(() => {
    if (!selectedSummaryCard) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedSummaryCard(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSummaryCard]);

  useEffect(() => {
    if (!selectedSummaryCard) {
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
  }, [selectedSummaryCard]);

  const summary = useMemo(() => {
    const active = myServices.filter((service) => service.status === 'Active').length;
    const provisioning = myServices.filter((service) => service.status === 'Undergoing Provisioning').length;
    const unpaid = myServices.filter((service) => service.status === 'Unpaid').length;

    return {
      total: myServices.length,
      active,
      provisioning,
      unpaid,
    };
  }, [myServices]);

  const summaryCards = [
    {
      label: 'Total Services',
      value: summary.total,
      helper: 'All purchased subscriptions',
      accent: 'cyan',
      filter: 'All',
    },
    {
      label: 'Active',
      value: summary.active,
      helper: 'Live and available now',
      accent: 'emerald',
      filter: 'Active',
    },
    {
      label: 'Provisioning',
      value: summary.provisioning,
      helper: 'Awaiting final activation',
      accent: 'violet',
      filter: 'Undergoing Provisioning',
    },
    {
      label: 'Unpaid',
      value: summary.unpaid,
      helper: 'Needs billing attention',
      accent: 'amber',
      filter: 'Unpaid',
    },
  ];

  const modalServices = useMemo(() => {
    if (!selectedSummaryCard) {
      return [];
    }

    return myServices.filter(
      (service) => selectedSummaryCard.filter === 'All' || service.status === selectedSummaryCard.filter,
    );
  }, [myServices, selectedSummaryCard]);

  const filteredServices = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return myServices.filter((service) => {
      const matchesStatus = statusFilter === 'All' || service.status === statusFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        service.name.toLowerCase().includes(normalizedSearch) ||
        service.category.toLowerCase().includes(normalizedSearch) ||
        service.plan.toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [myServices, searchTerm, statusFilter]);

  const filters = ['All', 'Active', 'Undergoing Provisioning', 'Unpaid', 'Expired'];

  const columns = [
    { key: 'name', label: 'Service', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'plan', label: 'Plan', sortable: true },
    {
      key: 'renewsOn',
      label: 'Renews On',
      sortable: true,
      sortValue: (r) => (hasRenewalCountdown(r) ? new Date(r.renewsOn).getTime() : null),
      render: (value, row) => {
        const renewalMeta = getRenewalCountdownMeta(row);

        return renewalMeta.isInteractive ? formatDate(value) : renewalMeta.value;
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_, row) => <StatusBadge status={getServiceDisplayStatus(row)} />,
    },
  ];

  const summaryModal = selectedSummaryCard
    ? createPortal(
        <div
          className="fixed inset-0 z-[80] flex min-h-screen items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="service-summary-modal-title"
          onClick={() => setSelectedSummaryCard(null)}
        >
          <div
            className="panel flex max-h-[min(88vh,760px)] w-full max-w-4xl flex-col overflow-hidden p-0"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300/80">Service Overview</p>
                <h2 id="service-summary-modal-title" className="mt-2 text-2xl font-semibold text-white">
                  {selectedSummaryCard.label}
                </h2>
                <p className="mt-2 text-sm text-slate-300">
                  {selectedSummaryCard.value} service{selectedSummaryCard.value === 1 ? '' : 's'} in this group.
                </p>
              </div>
              <button type="button" onClick={() => setSelectedSummaryCard(null)} className="btn-secondary px-4">
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-4 pr-1">
                {modalServices.length ? (
                  modalServices.map((service) => (
                    <div
                      key={service.id ?? `${service.name}-${service.plan}-${service.renewsOn}`}
                      className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{service.name}</h3>
                          <p className="mt-1 text-sm text-slate-300">{service.category}</p>
                        </div>
                        <StatusBadge status={getServiceDisplayStatus(service)} />
                      </div>
                      <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Plan</p>
                          <p className="mt-1 text-white">{service.plan}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{getRenewalCountdownMeta(service).label}</p>
                          <p className="mt-1 text-white">
                            {getRenewalCountdownMeta(service).isInteractive ? formatDate(service.renewsOn) : getRenewalCountdownMeta(service).value}
                          </p>
                          {!getRenewalCountdownMeta(service).isInteractive ? (
                            <p className="mt-1 text-xs text-slate-400">{getRenewalCountdownMeta(service).helper}</p>
                          ) : null}
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Status</p>
                          <p className="mt-1 text-white">{getServiceDisplayStatus(service)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-slate-400">
                    No services are available for this card right now.
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-5 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-slate-400">Use the table view if you want to sort, search, or inspect the full list.</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter(selectedSummaryCard.filter);
                    setSelectedSummaryCard(null);
                  }}
                  className="btn-primary"
                >
                  View in Table
                </button>
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
        eyebrow="Customer Services"
        title="My Services"
        description="Review active subscriptions, unpaid items, and provisioning progress across your portfolio."
        action={
          <div className="w-full max-w-sm">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search service, category, or plan"
              className="input"
            />
          </div>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            helper={card.helper}
            accent={card.accent}
            onClick={() => setSelectedSummaryCard(card)}
          />
        ))}
      </div>

      <div className="panel mb-6 p-4">
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={statusFilter === filter ? 'btn-primary' : 'btn-secondary'}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <DataTable columns={columns} rows={filteredServices} emptyMessage="No services match the current filter." />

      {summaryModal}
    </div>
  );
}
