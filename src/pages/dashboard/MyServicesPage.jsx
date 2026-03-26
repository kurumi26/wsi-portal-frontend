import { useMemo, useState } from 'react';
import DataTable from '../../components/common/DataTable';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import { usePortal } from '../../context/PortalContext';
import usePageTitle from '../../hooks/usePageTitle';
import { formatDate } from '../../utils/format';

export default function MyServicesPage() {
  usePageTitle('My Services');

  const { myServices } = usePortal();
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

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
      sortValue: (r) => new Date(r.renewsOn).getTime(),
      render: (value) => formatDate(value),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => <StatusBadge status={value} />,
    },
  ];

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
        <StatCard label="Total Services" value={summary.total} helper="All purchased subscriptions" accent="cyan" />
        <StatCard label="Active" value={summary.active} helper="Live and available now" accent="emerald" />
        <StatCard label="Provisioning" value={summary.provisioning} helper="Awaiting final activation" accent="violet" />
        <StatCard label="Unpaid" value={summary.unpaid} helper="Needs billing attention" accent="amber" />
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
    </div>
  );
}
