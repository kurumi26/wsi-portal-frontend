import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, FileDown } from 'lucide-react';
import DataTable from '../../components/common/DataTable';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import StatusBadge from '../../components/common/StatusBadge';
import { usePortal } from '../../context/PortalContext';
import { formatCurrency, formatDate } from '../../utils/format';

const ORDERS_PER_PAGE = 5;

export default function OrderHistoryPage() {
  const { orders } = usePortal();
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(orders.length / ORDERS_PER_PAGE));
  const paginatedOrders = useMemo(
    () => orders.slice((currentPage - 1) * ORDERS_PER_PAGE, currentPage * ORDERS_PER_PAGE),
    [orders, currentPage],
  );

  const downloadOrderPdf = (order) => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');

    if (!printWindow) {
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${order.id}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 32px;
              color: #0f172a;
              line-height: 1.6;
            }
            h1 {
              margin: 0 0 8px;
              font-size: 26px;
            }
            .subtitle {
              margin: 0 0 24px;
              color: #475569;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 16px;
              margin-top: 24px;
            }
            .card {
              border: 1px solid #cbd5e1;
              border-radius: 12px;
              padding: 16px;
            }
            .card.full {
              grid-column: 1 / -1;
            }
            .label {
              margin: 0;
              font-size: 12px;
              letter-spacing: 0.18em;
              text-transform: uppercase;
              color: #64748b;
            }
            .value {
              margin: 8px 0 0;
              font-size: 22px;
              font-weight: 700;
              color: #0f172a;
            }
          </style>
        </head>
        <body>
          <h1>WSI Portal Order Summary</h1>
          <p class="subtitle">Order details for ${order.id}</p>

          <div class="grid">
            <div class="card">
              <p class="label">Order ID</p>
              <p class="value">${order.id}</p>
            </div>
            <div class="card">
              <p class="label">Date</p>
              <p class="value">${formatDate(order.date)}</p>
            </div>
            <div class="card full">
              <p class="label">Service</p>
              <p class="value">${order.serviceName}</p>
            </div>
            <div class="card">
              <p class="label">Amount</p>
              <p class="value">${formatCurrency(order.amount)}</p>
            </div>
            <div class="card">
              <p class="label">Payment Method</p>
              <p class="value">${order.paymentMethod}</p>
            </div>
            <div class="card full">
              <p class="label">Status</p>
              <p class="value">${order.status}</p>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const columns = [
    { key: 'id', label: 'Order ID' },
    { key: 'serviceName', label: 'Service' },
    {
      key: 'amount',
      label: 'Amount',
      render: (value) => formatCurrency(value),
    },
    { key: 'paymentMethod', label: 'Payment Method' },
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
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedOrder(row)}
            className="btn-secondary px-3"
            title="View order"
            aria-label={`View order ${row.id}`}
          >
            <Eye size={16} />
          </button>
          <button
            type="button"
            onClick={() => downloadOrderPdf(row)}
            className="btn-secondary px-3"
            title="Download PDF"
            aria-label={`Download PDF for order ${row.id}`}
          >
            <FileDown size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Order History"
        title="Purchases & order records"
        description="Every successful checkout generates an order ID and records the purchase for customer and admin views."
      />
      <DataTable columns={columns} rows={paginatedOrders} />
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      {selectedOrder
        ? createPortal(
            <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
              <div className="panel w-full max-w-2xl overflow-hidden">
                <div className="flex items-start justify-between border-b border-white/10 px-6 py-5">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Order Details</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">{selectedOrder.id}</h2>
                    <p className="mt-2 text-sm text-slate-400">Customer order record for phase 1 portal activity</p>
                  </div>
                  <button type="button" onClick={() => setSelectedOrder(null)} className="btn-secondary px-4">
                    Close
                  </button>
                </div>

                <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
                  <div className="panel-muted p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Service</p>
                    <p className="mt-2 text-lg font-medium text-white">{selectedOrder.serviceName}</p>
                  </div>
                  <div className="panel-muted p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Amount</p>
                    <p className="mt-2 text-lg font-medium text-white">{formatCurrency(selectedOrder.amount)}</p>
                  </div>
                  <div className="panel-muted p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Payment Method</p>
                    <p className="mt-2 text-lg font-medium text-white">{selectedOrder.paymentMethod}</p>
                  </div>
                  <div className="panel-muted p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Date</p>
                    <p className="mt-2 text-lg font-medium text-white">{formatDate(selectedOrder.date)}</p>
                  </div>
                  <div className="panel-muted p-4 md:col-span-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Status</p>
                    <div className="mt-2">
                      <StatusBadge status={selectedOrder.status} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 md:col-span-2">
                    <button
                      type="button"
                      onClick={() => downloadOrderPdf(selectedOrder)}
                      className="btn-primary inline-flex items-center gap-2"
                    >
                      <FileDown size={16} />
                      Download PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
