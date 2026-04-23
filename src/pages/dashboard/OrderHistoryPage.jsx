import { useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Eye, FileDown, Search, ChevronDown, List, Grid2x2, Calendar } from 'lucide-react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortOption, setSortOption] = useState('Newest');
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef(null);
  const [statusMenuStyle, setStatusMenuStyle] = useState(null);
  const [layoutMode, setLayoutMode] = useState('list');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const filters = ['All', 'Paid', 'Failed', 'Pending Review'];

  const filteredOrders = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return orders.filter((order) => {
      // status first
      const matchesStatus = statusFilter === 'All' ? true : order.status === statusFilter;
      if (!matchesStatus) return false;

      // date range filter
      const orderDate = new Date(order.date);
      if (startDate) {
        const s = new Date(startDate + 'T00:00:00');
        if (orderDate < s) return false;
      }
      if (endDate) {
        const e = new Date(endDate + 'T23:59:59');
        if (orderDate > e) return false;
      }

      // search
      if (normalizedSearch) {
        const hay = [order.id, order.serviceName, order.paymentMethod, order.status].join(' ').toLowerCase();
        return hay.includes(normalizedSearch);
      }

      return true;
    });
  }, [orders, searchTerm, statusFilter, startDate, endDate]);

  const sortedOrders = useMemo(() => {
    const rows = [...filteredOrders];
    switch (sortOption) {
      case 'Oldest':
        rows.sort((a, b) => new Date(a.date) - new Date(b.date));
        break;
      case 'Amount: High → Low':
        rows.sort((a, b) => b.amount - a.amount);
        break;
      case 'Amount: Low → High':
        rows.sort((a, b) => a.amount - b.amount);
        break;
      default:
        rows.sort((a, b) => new Date(b.date) - new Date(a.date));
        break;
    }
    return rows;
  }, [filteredOrders, sortOption]);

  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / ORDERS_PER_PAGE));
  const paginatedOrders = useMemo(
    () => sortedOrders.slice((currentPage - 1) * ORDERS_PER_PAGE, currentPage * ORDERS_PER_PAGE),
    [sortedOrders, currentPage],
  );

  // close status dropdown on outside click
  useEffect(() => {
    const onDoc = (e) => {
      if (statusRef.current && !statusRef.current.contains(e.target)) setStatusOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useLayoutEffect(() => {
    if (!statusOpen || !statusRef.current) {
      setStatusMenuStyle(null);
      return;
    }

    const btn = statusRef.current.querySelector('button');
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const menuWidth = 160; // px
    const left = Math.max(8, rect.right - menuWidth + window.scrollX);
    const top = rect.bottom + 8 + window.scrollY;

    setStatusMenuStyle({ position: 'absolute', left: `${left}px`, top: `${top}px`, width: `${menuWidth}px`, zIndex: 9999 });

    const onResize = () => {
      const r = btn.getBoundingClientRect();
      setStatusMenuStyle({ position: 'absolute', left: `${Math.max(8, r.right - menuWidth + window.scrollX)}px`, top: `${r.bottom + 8 + window.scrollY}px`, width: `${menuWidth}px`, zIndex: 9999 });
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [statusOpen]);

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
    { key: 'id', label: 'Order ID', sortable: true },
    { key: 'serviceName', label: 'Service', sortable: true },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      sortValue: (r) => Number(r.amount || 0),
      render: (value) => formatCurrency(value),
    },
    { key: 'paymentMethod', label: 'Payment Method', sortable: true },
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      sortValue: (r) => new Date(r.date).getTime(),
      render: (value) => formatDate(value),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
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
        action={
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-[420px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="Search orders"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.02] py-2 pl-10 pr-4 text-sm text-slate-200 outline-none"
              />
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                  className="rounded-full border border-white/10 bg-white/[0.02] py-2 pl-10 pr-3 text-sm text-slate-200 outline-none"
                />
              </div>
              <span className="text-sm text-slate-400">to</span>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                  className="rounded-full border border-white/10 bg-white/[0.02] py-2 pl-10 pr-3 text-sm text-slate-200 outline-none"
                />
              </div>
            </div>

            <div className="relative" ref={statusRef}>
              <button
                type="button"
                onClick={() => setStatusOpen((s) => !s)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-slate-200"
              >
                <span className="sr-only">Status</span>
                <span className="text-sm text-slate-200">{statusFilter}</span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {statusOpen && statusMenuStyle
                ? createPortal(
                    <div style={statusMenuStyle} className="rounded-lg border border-white/6 bg-slate-900 shadow">
                      {filters.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => {
                            setStatusFilter(f);
                            setStatusOpen(false);
                            setCurrentPage(1);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
                        >
                          {f}
                        </button>
                      ))}
                    </div>,
                    document.body,
                  )
                : null}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setLayoutMode('list')}
                className={layoutMode === 'list' ? 'btn-primary px-3 py-2' : 'btn-secondary px-3 py-2'}
                aria-label="List layout"
              >
                <List size={16} />
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('grid')}
                className={layoutMode === 'grid' ? 'btn-primary px-3 py-2' : 'btn-secondary px-3 py-2'}
                aria-label="Grid layout"
              >
                <Grid2x2 size={16} />
              </button>
            </div>
          </div>
        }
      />
      {layoutMode === 'list' ? (
        <>
          <DataTable columns={columns} rows={paginatedOrders} />
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </>
      ) : (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paginatedOrders.map((order) => (
              <div key={order.id} className="panel-muted flex h-full flex-col gap-5 rounded-3xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{order.id}</p>
                    <p className="mt-1 text-sm text-slate-400">{order.serviceName}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Amount</p>
                    <p className="mt-2 text-sm font-medium text-slate-200">{formatCurrency(order.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Payment Method</p>
                    <p className="mt-2 text-sm font-medium text-slate-200">{order.paymentMethod}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatDate(order.date)}</p>
                  </div>
                </div>

                <div className="mt-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(order)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08]"
                    title="View order"
                    aria-label={`View order ${order.id}`}
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadOrderPdf(order)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08]"
                    title="Download PDF"
                    aria-label={`Download PDF for order ${order.id}`}
                  >
                    <FileDown size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </>
      )}

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
                  <div className="flex flex-col items-end gap-2">
                    <button type="button" onClick={() => setSelectedOrder(null)} className="btn-secondary px-4">
                      Close
                    </button>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm uppercase tracking-[0.12em] text-slate-400">Status</span>
                      <StatusBadge status={selectedOrder.status} />
                    </div>
                  </div>
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
                  {/* Status now shown in header */}
                  <div className="flex flex-wrap gap-3 md:col-span-2 justify-center">
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
