import DataTable from '../../components/common/DataTable';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import { usePortal } from '../../context/PortalContext';
import { formatCurrency, formatDate } from '../../utils/format';

export default function PurchasesPage() {
  const { adminPurchases } = usePortal();

  const columns = [
    { key: 'id', label: 'Order ID' },
    { key: 'client', label: 'Client' },
    { key: 'serviceName', label: 'Service' },
    {
      key: 'amount',
      label: 'Amount',
      render: (value) => formatCurrency(value),
    },
    {
      key: 'date',
      label: 'Date',
      render: (value) => formatDate(value),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status={value} />,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Purchase Ledger"
        title="Recorded purchases"
        description="Admin-side record of transactions, linked orders, and customer account activity."
      />
      <DataTable columns={columns} rows={adminPurchases} />
    </div>
  );
}
