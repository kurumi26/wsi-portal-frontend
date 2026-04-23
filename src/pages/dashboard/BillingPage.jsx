import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, CreditCard, Eye, FileDown, FileText, Grid2x2, Headphones, List, Percent, Search, ShieldCheck, X, Calendar, ChevronDown } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import StatusBadge from '../../components/common/StatusBadge';
import { usePortal } from '../../context/PortalContext';
import { formatCurrency, formatDate } from '../../utils/format';
import { portalApi } from '../../services/portalApi';

const DISCOUNT_CODES = {
  PROMO20: 20,
  WSI10: 10,
};

const BILLING_ITEMS_PER_PAGE = 5;

export default function BillingPage() {
  const navigate = useNavigate();
  const { orders, startInvoicePayment } = usePortal();
  const [selectedCharge, setSelectedCharge] = useState(null);
  const [inlineAlert, setInlineAlert] = useState(null);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef(null);
  const [layoutMode, setLayoutMode] = useState('list');
  const [appliedDiscounts, setAppliedDiscounts] = useState({});
  const [discountTarget, setDiscountTarget] = useState(null);
  const [discountCode, setDiscountCode] = useState('');
  const [discountFeedback, setDiscountFeedback] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [showPaymentPolicies, setShowPaymentPolicies] = useState(false);

  const invoiceRows = useMemo(
    () =>
      orders.map((order, index) => ({
        ...order,
        invoiceNumber: `CH-2026-${String(index + 1001)}`,
        dueDate: new Date(order.date).toLocaleDateString('en-CA'),
        originalAmount: order.amount,
        discountPercent: appliedDiscounts[order.id] ?? 0,
        amount:
          appliedDiscounts[order.id] != null
            ? Number((order.amount * (1 - appliedDiscounts[order.id] / 100)).toFixed(2))
            : order.amount,
      })),
    [orders, appliedDiscounts],
  );

  const BACKEND_ORIGIN = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/api\/?$/i, '');

  const downloadChargeReceipt = (order) => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');

    if (!printWindow) {
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${order.invoiceNumber}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 32px;
              color: #ffffff;
              line-height: 1.6;
            }
            h1 {
              margin: 0 0 8px;
              font-size: 24px;
            }
            .meta {
              margin-top: 24px;
            }
            .meta p {
              margin: 6px 0;
            }
          </style>
        </head>
        <body>
          <h1>WSI Portal Billing Receipt</h1>
          <div class="meta">
            <p><strong>Invoice #:</strong> ${order.invoiceNumber}</p>
            <p><strong>Order ID:</strong> ${order.id}</p>
            <p><strong>Service:</strong> ${order.serviceName}</p>
            <p><strong>Due Date:</strong> ${order.dueDate}</p>
            <p><strong>Amount:</strong> ${formatCurrency(order.amount)}</p>
            <p><strong>Status:</strong> ${order.status}</p>
            <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const contactBillingSupport = (order) => {
    const subject = encodeURIComponent(`Billing support for ${order.invoiceNumber}`);
    const body = encodeURIComponent(
      `Hello WSI Billing,%0D%0A%0D%0APlease assist me with invoice ${order.invoiceNumber} for ${order.serviceName}.`,
    );
    window.location.href = `mailto:billing@wsiportal.com?subject=${subject}&body=${body}`;
  };

  const downloadChargeDetails = (order) => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');

    if (!printWindow) {
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${order.invoiceNumber}</title>
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
            {discountTarget
              ? createPortal(
                  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-4">
                    <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
                      <div className="flex items-start justify-between px-6 pb-2 pt-5 text-slate-900">
                        <div>
                          <h2 className="text-3xl font-semibold tracking-tight">Apply Discount</h2>
                          <p className="mt-5 text-2xl text-slate-700">
                            Invoice: <span className="font-semibold text-slate-900">{discountTarget.invoiceNumber}</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={closeDiscountModal}
                          className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                          aria-label="Close discount modal"
                        >
                          <X size={24} />
                        </button>
                      </div>

                      <div className="px-6 pb-6 pt-3">
                        <div className="overflow-hidden rounded-xl border border-slate-200">
                          <div className="flex items-stretch">
                            <input
                              type="text"
                              value={discountCode}
                              onChange={(event) => setDiscountCode(event.target.value)}
                              placeholder="Code (PROMO20)"
                              className="min-w-0 flex-1 px-4 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400"
                            />
                            <button
                              type="button"
                              onClick={() => applyDiscount(discountTarget)}
                              className="inline-flex items-center gap-2 rounded-r-xl bg-slate-900/90 px-4 py-3 text-white"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-slate-700">{discountFeedback}</p>
                      </div>
                    </div>
                  </div>,
                  document.body,
                )
              : null}
          <p class="subtitle">Invoice details for ${order.invoiceNumber}</p>

          <div class="grid">
            <div class="card">
              <p class="label">Invoice #</p>
              <p class="value">${order.invoiceNumber}</p>
            </div>
            <div class="card">
              <p class="label">Order ID</p>
              <p class="value">${order.id}</p>
            </div>
            <div class="card">
              <p class="label">Due Date</p>
              <p class="value">${order.dueDate}</p>
            </div>
            <div class="card">
              <p class="label">Recorded Date</p>
              <p class="value">${formatDate(order.date)}</p>
            </div>
            <div class="card">
              <p class="label">Service</p>
              <p class="value">${order.serviceName}</p>
            </div>
            <div class="card">
              <p class="label">Payment Method</p>
              <p class="value">${order.paymentMethod}</p>
            </div>
            <div class="card">
              <p class="label">Amount</p>
              <p class="value">${formatCurrency(order.amount)}</p>
              ${order.discountPercent ? `<p class="discount"><s>${formatCurrency(order.originalAmount)}</s>${order.discountPercent}% off</p>` : ''}
            </div>
            <div class="card">
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

  const handlePayInvoice = (order) => {
    (async () => {
      try {
        await startInvoicePayment(order);
        setSelectedCharge(null);
        navigate('/checkout');
      } catch (err) {
        setInlineAlert(err.message || 'Unable to prepare invoice payment.');
      }
    })();
  };

  const { refreshPortalData } = usePortal();

  const handleUploadProof = async (order, file) => {
    if (!file) return;

    try {
      const data = await portalApi.uploadPaymentProof(order.id || order.orderNumber || order.order_number, file);
      // refresh data via startInvoicePayment or portal context refresh
      await refreshPortalData();

      // Fetch fresh orders to ensure we have updated data and set the invoice modal accordingly.
      let freshOrders = [];
      try {
        freshOrders = await portalApi.getOrders();
      } catch (e) {
        // fallback to existing orders in context
        freshOrders = orders || [];
      }

      const updated = freshOrders.find((o) => o.id === (order.id || order.orderNumber || order.order_number));
      if (updated) {
        setSelectedCharge(updated);
      } else {
        // if we couldn't find an updated order, keep the currently selected charge
        setSelectedCharge((current) => ({ ...(current || {}), ...order }));
      }

      // Inline confirmation
      setInlineAlert('Proof uploaded successfully. Billing will review shortly.');
    } catch (err) {
      console.error('Upload failed', err);
      setInlineAlert('Upload failed: ' + (err.message || 'Unknown error'));
    }
  };

  const triggerUploadForOrder = (order) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf,.jpg,.jpeg';
    input.onchange = (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) handleUploadProof(order, f);
    };
    input.click();
  };

  const payableInvoices = useMemo(
    () => invoiceRows.filter((order) => order.status !== 'Paid'),
    [invoiceRows],
  );

  const filters = ['All', 'Paid', 'Failed', 'Pending Review'];

  const filteredInvoiceRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return invoiceRows.filter((order) => {
      const matchesFilter = statusFilter === 'All' ? true : order.status === statusFilter;
      const matchesSearch = normalizedSearch
        ? [order.invoiceNumber, order.id, order.serviceName, order.paymentMethod].some((value) =>
            value.toLowerCase().includes(normalizedSearch),
          )
        : true;

      // Date range filter (based on order.date)
      const orderDate = new Date(order.date);
      let matchesDate = true;

      if (startDate) {
        const s = new Date(startDate + 'T00:00:00');
        if (orderDate < s) matchesDate = false;
      }

      if (endDate) {
        const e = new Date(endDate + 'T23:59:59');
        if (orderDate > e) matchesDate = false;
      }

      return matchesFilter && matchesSearch && matchesDate;
    });
  }, [invoiceRows, searchTerm, statusFilter, startDate, endDate]);

  const visiblePayableInvoices = useMemo(
    () => filteredInvoiceRows.filter((order) => order.status !== 'Paid'),
    [filteredInvoiceRows],
  );

  const selectedInvoices = useMemo(
    () => invoiceRows.filter((order) => selectedInvoiceIds.includes(order.id)),
    [invoiceRows, selectedInvoiceIds],
  );

  const selectedInvoicesTotal = useMemo(
    () => selectedInvoices.reduce((sum, order) => sum + order.amount, 0),
    [selectedInvoices],
  );

  const sortedFilteredInvoiceRows = useMemo(() => {
    if (!sortKey) return filteredInvoiceRows;

    const copy = filteredInvoiceRows.slice();
    copy.sort((a, b) => {
      let va;
      let vb;

      switch (sortKey) {
        case 'invoiceNumber':
          va = String(a.invoiceNumber || '').toLowerCase();
          vb = String(b.invoiceNumber || '').toLowerCase();
          break;
        case 'dueDate':
          va = new Date(a.dueDate).getTime();
          vb = new Date(b.dueDate).getTime();
          break;
        case 'amount':
          va = Number(a.amount || 0);
          vb = Number(b.amount || 0);
          break;
        case 'status':
          va = String(a.status || '').toLowerCase();
          vb = String(b.status || '').toLowerCase();
          break;
        default:
          va = a[sortKey];
          vb = b[sortKey];
      }

      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;

      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }

      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      if (sa < sb) return sortDir === 'asc' ? -1 : 1;
      if (sa > sb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return copy;
  }, [filteredInvoiceRows, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedFilteredInvoiceRows.length / BILLING_ITEMS_PER_PAGE));
  const paginatedInvoiceRows = sortedFilteredInvoiceRows.slice((currentPage - 1) * BILLING_ITEMS_PER_PAGE, currentPage * BILLING_ITEMS_PER_PAGE);

  const allPayableSelected =
    visiblePayableInvoices.length > 0 && visiblePayableInvoices.every((order) => selectedInvoiceIds.includes(order.id));

  const toggleInvoiceSelection = (orderId) => {
    setSelectedInvoiceIds((current) =>
      current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId],
    );
  };

  const toggleSelectAllInvoices = () => {
    setSelectedInvoiceIds((current) => {
      const visibleIds = visiblePayableInvoices.map((order) => order.id);

      if (allPayableSelected) {
        return current.filter((id) => !visibleIds.includes(id));
      }

      return [...new Set([...current, ...visibleIds])];
    });
  };

  const handlePaySelected = () => {
    if (!selectedInvoices.length) {
      return;
    }

    (async () => {
      try {
        await startInvoicePayment(selectedInvoices);
        setSelectedCharge(null);
        navigate('/checkout');
      } catch (err) {
        window.alert(err.message || 'Unable to prepare invoice payment.');
      }
    })();
  };

  const openDiscountModal = (order) => {
    setDiscountTarget(order);
    setDiscountCode('');
    setDiscountFeedback('');
  };

  const closeDiscountModal = () => {
    setDiscountTarget(null);
    setDiscountCode('');
    setDiscountFeedback('');
  };

  const applyDiscountCode = () => {
    if (!discountTarget) {
      return false;
    }

    const normalizedCode = discountCode.trim().toUpperCase();
    const discountPercent = DISCOUNT_CODES[normalizedCode];

    if (!discountPercent) {
      setDiscountFeedback('Invalid promo code. Try PROMO20 or WSI10.');
      return false;
    }

    setAppliedDiscounts((current) => ({
      ...current,
      [discountTarget.id]: discountPercent,
    }));
    setDiscountFeedback(`${discountPercent}% discount applied to ${discountTarget.invoiceNumber}.`);
    return true;
  };

  const handleApplyAndCloseDiscount = () => {
    const applied = applyDiscountCode();

    if (applied) {
      closeDiscountModal();
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, layoutMode]);

  // close status dropdown when clicking outside
  useEffect(() => {
    const onDocClick = (e) => {
      if (statusRef.current && !statusRef.current.contains(e.target)) {
        setStatusOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const renderSortIcons = (key) => {
    const isSorted = sortKey === key;
    return (
      <span className="ml-1 flex flex-col items-center gap-0">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`sort-svg sort-icon ${isSorted && sortDir === 'asc' ? 'active' : 'inactive'}`}>
          <path d="M7 14l5-5 5 5" />
        </svg>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`sort-svg sort-icon ${isSorted && sortDir === 'desc' ? 'active' : 'inactive'}`}>
          <path d="M7 10l5 5 5-5" />
        </svg>
      </span>
    );
  };

  return (
    <div>
      <PageHeader
        eyebrow="Billing Center"
        title="Billing & Payments"
        action={
          <div className="flex items-center gap-3 flex-wrap">

            <div className="relative w-64 flex-shrink-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search invoice"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.02] py-2 pl-10 pr-4 text-sm text-slate-200 outline-none"
              />
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-full border border-white/10 bg-white/[0.02] py-2 pl-10 pr-3 text-sm text-slate-200 outline-none"
                />
              </div>
              <span className="text-sm text-slate-400">to</span>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-full border border-white/10 bg-white/[0.02] py-2 pl-10 pr-3 text-sm text-slate-200 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative" ref={statusRef}>
                <button
                  type="button"
                  onClick={() => setStatusOpen((s) => !s)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-slate-200"
                  aria-haspopup="true"
                  aria-expanded={statusOpen}
                  title="Filter by status"
                >
                  <span className="sr-only">Status</span>
                  <span className="text-sm text-slate-200">{statusFilter}</span>
                  <ChevronDown size={14} className="text-slate-300" />
                </button>

                {statusOpen ? (
                  <div className="absolute right-0 mt-2 w-40 rounded-lg border border-white/6 bg-slate-900 shadow z-50">
                    {filters.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => {
                          setStatusFilter(f);
                          setStatusOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex gap-2">
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
          </div>
        }
      />

      <div className="space-y-6">
        <div className="panel p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-sky-300" />
              <h2 className="text-xl font-semibold text-white">Payment policies</h2>
            </div>

            <button
              type="button"
              onClick={() => setShowPaymentPolicies((s) => !s)}
              aria-expanded={showPaymentPolicies}
              aria-controls="payment-policies-content"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none hover:bg-white/[0.04]"
              title={showPaymentPolicies ? 'Hide policies' : 'Show policies'}
            >
              <span className="sr-only">{showPaymentPolicies ? 'Hide payment policies' : 'Show payment policies'}</span>
              <ChevronDown size={16} className={`transition-transform ${showPaymentPolicies ? 'rotate-180' : 'rotate-0'}`} />
            </button>
          </div>

          {showPaymentPolicies ? (
            <ul id="payment-policies-content" className="mt-6 space-y-3 text-sm leading-7 text-slate-400">
              <li>• Purchase Agreement and Terms are captured during checkout.</li>
              <li>• Privacy Policy acknowledgement is required before payment processing.</li>
              <li>• Failed payments can be retried directly from the checkout flow.</li>
              <li>• Successful transactions trigger order IDs and provisioning actions.</li>
            </ul>
          ) : null}
        </div>

        <div className="panel p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex flex-col gap-3 xl:flex-1 xl:flex-row xl:items-center xl:gap-6">
              <div className="flex items-center gap-3">
                <CreditCard className="text-sky-300" />
                <h2 className="text-xl font-semibold text-white">Recent Charges</h2>
              </div>


            </div>

          </div>
          {layoutMode === 'list' ? (
            <div className="panel overflow-hidden mt-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <colgroup>
                <col className="w-14" />
                <col className="w-[25%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[18%]" />
                <col className="w-[23%]" />
              </colgroup>
                  <thead className="bg-white/5 text-slate-400">
                    <tr>
                      <th className="px-6 py-5">
                    <label className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={allPayableSelected}
                        onChange={toggleSelectAllInvoices}
                        className="h-4 w-4 rounded border-white/20 bg-slate-900 accent-blue-500"
                        aria-label="Select all unpaid invoices"
                      />
                    </label>
                      </th>
                      <th
                        className="px-6 py-5 font-medium cursor-pointer select-none"
                    onClick={() => {
                      if (sortKey !== 'invoiceNumber') {
                        setSortKey('invoiceNumber');
                        setSortDir('asc');
                      } else {
                        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span>Invoice #</span>
                      {renderSortIcons('invoiceNumber')}
                    </div>
                      </th>
                      <th
                        className="px-6 py-5 font-medium cursor-pointer select-none"
                    onClick={() => {
                      if (sortKey !== 'dueDate') {
                        setSortKey('dueDate');
                        setSortDir('asc');
                      } else {
                        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span>Due Date</span>
                      {renderSortIcons('dueDate')}
                    </div>
                      </th>
                      <th
                        className="px-6 py-5 font-medium cursor-pointer select-none"
                    onClick={() => {
                      if (sortKey !== 'amount') {
                        setSortKey('amount');
                        setSortDir('asc');
                      } else {
                        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span>Amount</span>
                      {renderSortIcons('amount')}
                    </div>
                      </th>
                      <th
                        className="px-6 py-5 font-medium cursor-pointer select-none"
                    onClick={() => {
                      if (sortKey !== 'status') {
                        setSortKey('status');
                        setSortDir('asc');
                      } else {
                        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span>Status</span>
                      {renderSortIcons('status')}
                    </div>
                  </th>
                      <th className="px-6 py-5 font-medium">Actions</th>
                </tr>
                  </thead>
              <tbody className="divide-y divide-white/8">
                {paginatedInvoiceRows.map((order) => {
                  const isPaid = order.status === 'Paid';
                  const isSelected = selectedInvoiceIds.includes(order.id);

                  return (
                    <tr key={order.id} className="table-row-hoverable">
                      <td className="px-6 py-5 align-middle">
                        <div className="flex items-center justify-center">
                          {isPaid ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-400/10 text-emerald-300">
                              <CheckCircle2 size={14} />
                            </span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleInvoiceSelection(order.id)}
                              className="h-4 w-4 rounded border-white/20 bg-slate-900 accent-blue-500"
                              aria-label={`Select invoice ${order.invoiceNumber}`}
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 align-middle">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">{order.invoiceNumber}</p>
                          <p className="mt-1 truncate text-xs text-slate-400">{order.serviceName}</p>
                        </div>
                      </td>
                      <td className="px-6 py-5 align-middle text-slate-300">
                        <span className="whitespace-nowrap">{order.dueDate}</span>
                      </td>
                      <td className="px-6 py-5 align-middle">
                        <div className="min-w-0">
                          <p className="whitespace-nowrap font-semibold text-white">{formatCurrency(order.amount)}</p>
                          {order.discountPercent ? (
                            <p className="mt-1 text-xs text-emerald-300">
                              <span className="mr-2 line-through text-slate-500">{formatCurrency(order.originalAmount)}</span>
                              {order.discountPercent}% off
                            </p>
                          ) : null}
                          <p className="mt-1 truncate text-xs text-slate-400">{order.paymentMethod}</p>
                        </div>
                      </td>
                      <td className="px-6 py-5 align-middle">
                        <div className="flex items-center">
                          <StatusBadge status={order.status} />
                        </div>
                      </td>
                      <td className="px-4 py-5 align-middle">
                                <div className="flex items-center justify-start gap-2 whitespace-nowrap">
                                  {isPaid ? (
                                    <button
                                      type="button"
                                      onClick={() => downloadChargeReceipt(order)}
                                      className={`inline-flex h-9 min-w-[88px] items-center justify-center rounded-full px-4 text-xs font-semibold !text-white transition bg-emerald-500 hover:bg-emerald-400`}
                                    >
                                      Receipt
                                    </button>
                                  ) : (
                                    order.status === 'Pending Review' ? null : (
                                      <button
                                        type="button"
                                        onClick={() => handlePayInvoice(order)}
                                        className={`inline-flex h-9 min-w-[88px] items-center justify-center rounded-full px-4 text-xs font-semibold text-white transition bg-blue-600 hover:bg-blue-500`}
                                      >
                                        Pay Now
                                      </button>
                                    )
                                  )}
                          <button
                            type="button"
                            onClick={() => openDiscountModal(order)}
                            disabled={isPaid}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                            title="Apply discount"
                            aria-label={`Apply discount for ${order.invoiceNumber}`}
                          >
                            <Percent size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedCharge(order)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08]"
                            title="View invoice"
                            aria-label={`View invoice ${order.invoiceNumber}`}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => contactBillingSupport(order)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08]"
                            title="Contact billing support"
                            aria-label={`Contact billing support for ${order.invoiceNumber}`}
                          >
                            <Headphones size={16} />
                          </button>
                          {!isPaid ? (
                            <button
                              type="button"
                              onClick={() => triggerUploadForOrder(order)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08]"
                              title="Upload proof of payment"
                              aria-label={`Upload proof of payment for ${order.invoiceNumber}`}
                            >
                              <FileDown size={16} />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {paginatedInvoiceRows.map((order) => {
                const isPaid = order.status === 'Paid';
                const isSelected = selectedInvoiceIds.includes(order.id);

                return (
                  <div key={order.id} className="panel-muted flex h-full flex-col gap-5 rounded-3xl p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        {isPaid ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-400/10 text-emerald-300">
                            <CheckCircle2 size={14} />
                          </span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleInvoiceSelection(order.id)}
                            className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900 accent-blue-500"
                            aria-label={`Select invoice ${order.invoiceNumber}`}
                          />
                        )}
                        <div>
                          <p className="font-semibold text-white">{order.invoiceNumber}</p>
                          <p className="mt-1 text-sm text-slate-400">{order.serviceName}</p>
                        </div>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Due Date</p>
                        <p className="mt-2 text-sm font-medium text-slate-200">{order.dueDate}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Amount</p>
                        <p className="mt-2 text-sm font-semibold text-white">{formatCurrency(order.amount)}</p>
                        {order.discountPercent ? (
                          <p className="mt-1 text-xs text-emerald-300">
                            <span className="mr-2 line-through text-slate-500">{formatCurrency(order.originalAmount)}</span>
                            {order.discountPercent}% off
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-slate-400">{order.paymentMethod}</p>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center gap-2">
                      {isPaid ? (
                        <button
                          type="button"
                          onClick={() => downloadChargeReceipt(order)}
                          className={`inline-flex h-9 min-w-[88px] items-center justify-center rounded-full px-4 text-xs font-semibold !text-white transition bg-emerald-500 hover:bg-emerald-400`}
                        >
                          Receipt
                        </button>
                      ) : (
                        order.status === 'Pending Review' ? null : (
                          <button
                            type="button"
                            onClick={() => handlePayInvoice(order)}
                            className={`inline-flex h-9 min-w-[88px] items-center justify-center rounded-full px-4 text-xs font-semibold text-white transition bg-blue-600 hover:bg-blue-500`}
                          >
                            Pay Now
                          </button>
                        )
                      )}
                      <button
                        type="button"
                        onClick={() => openDiscountModal(order)}
                        disabled={isPaid}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                        title="Apply discount"
                        aria-label={`Apply discount for ${order.invoiceNumber}`}
                      >
                        <Percent size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCharge(order)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08]"
                        title="View invoice"
                        aria-label={`View invoice ${order.invoiceNumber}`}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => contactBillingSupport(order)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08]"
                        title="Contact billing support"
                        aria-label={`Contact billing support for ${order.invoiceNumber}`}
                      >
                        <Headphones size={16} />
                      </button>
                      {!isPaid ? (
                        <button
                          type="button"
                          onClick={() => triggerUploadForOrder(order)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08]"
                          title="Upload proof of payment"
                          aria-label={`Upload proof of payment for ${order.invoiceNumber}`}
                        >
                          <FileDown size={16} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!filteredInvoiceRows.length ? (
            <div className="panel-muted mt-6 rounded-3xl p-8 text-center text-sm text-slate-400">
              No invoices match the current search or filter.
            </div>
          ) : null}

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>

        {/* <div className="panel p-6">
          <h2 className="text-xl font-semibold text-white">Phase 2 readiness</h2>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            Invoice and deeper billing automation are planned for the next release phase without changing the
            current route structure.
          </p>
        </div> */}

        {selectedInvoices.length ? (
          <div className="sticky bottom-4 z-20 flex justify-center px-2">
            <div className="flex w-full max-w-xl items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/95 px-5 py-4 shadow-2xl shadow-slate-950/40 backdrop-blur">
              <div className="flex items-center gap-4 text-sm">
                <p className="text-slate-300">
                  Selected: <span className="ml-2 text-lg md:text-xl font-semibold text-sky-300">{selectedInvoices.length}</span>
                </p>
                <div className="h-8 w-px bg-white/10" />
                <p className="text-slate-300">
                  Total: <span className="ml-2 text-lg md:text-xl font-semibold text-sky-300">{formatCurrency(selectedInvoicesTotal)}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={handlePaySelected}
                className="inline-flex h-9 min-w-[140px] items-center justify-center rounded-full px-4 text-xs font-semibold !text-white transition bg-emerald-500 hover:bg-emerald-400"
              >
                Pay Selected
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {selectedCharge
        ? createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
              <div className="panel w-full max-w-2xl overflow-hidden">
                <div className="flex items-start justify-between border-b border-white/10 px-6 py-5">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Invoice Details</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">{selectedCharge.invoiceNumber}</h2>
                    <p className="mt-2 text-sm text-slate-400">Billing summary for this recent charge entry.</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button type="button" onClick={() => setSelectedCharge(null)} className="btn-secondary px-4">
                      Close
                    </button>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm uppercase tracking-[0.12em] text-slate-400">Status</span>
                      <StatusBadge status={selectedCharge.status} />
                    </div>
                  </div>
                </div>

                <div className="grid gap-x-4 gap-y-3 px-6 py-5 md:grid-cols-2 items-start">
                  <div className="panel-muted p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Order ID</p>
                    <p className="mt-2 text-lg font-medium text-white">{selectedCharge.id}</p>
                  </div>
                  <div className="panel-muted p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Due Date</p>
                    <p className="mt-2 text-lg font-medium text-white">{selectedCharge.dueDate}</p>
                  </div>
                  <div className="panel-muted p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Service</p>
                    <p className="mt-2 text-lg font-medium text-white">{selectedCharge.serviceName}</p>
                  </div>
                  <div className="panel-muted p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Amount</p>
                    <p className="mt-2 text-lg font-medium text-white">{formatCurrency(selectedCharge.amount)}</p>
                    {selectedCharge.discountPercent ? (
                      <p className="mt-1 text-sm text-emerald-300">
                        <span className="mr-2 line-through text-slate-500">{formatCurrency(selectedCharge.originalAmount)}</span>
                        {selectedCharge.discountPercent}% off
                      </p>
                    ) : null}
                  </div>
                  <div className="panel-muted p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Payment Method</p>
                    <p className="mt-2 text-lg font-medium text-white">{selectedCharge.paymentMethod}</p>
                  </div>
                  {/* Payment proof preview (if uploaded) */}
                  {selectedCharge?.payments && selectedCharge.payments.length ? (
                    (() => {
                      const proof = selectedCharge.payments.find((p) => p.transactionRef);
                      if (!proof) return null;
                      const proofPath = proof.transactionRef?.startsWith('payment_proofs/') ? proof.transactionRef : `payment_proofs/${proof.transactionRef}`;
                      const proofUrl = `${BACKEND_ORIGIN}/storage/${proofPath}`;

                      return (
                        <div className="panel-muted p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Payment proof</p>
                          <div className="mt-2 flex items-center gap-3">
                            <div className="flex flex-col items-start gap-3">
                              <a href={proofUrl} target="_blank" rel="noreferrer" className="block max-w-[220px] overflow-hidden rounded-lg border border-white/8">
                                <img src={proofUrl} alt="Payment proof" className="h-28 w-48 object-cover" />
                              </a>
                              <div className="flex items-center gap-3">
                                <a href={proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-200 hover:bg-white/[0.06]">
                                  View proof
                                </a>
                                <p className="text-sm text-slate-300">Uploaded {proof.createdAt ? formatDate(proof.createdAt) : '—'}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : null}
                  <div className="panel-muted p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Recorded Date</p>
                    <p className="mt-2 text-lg font-medium text-white">{formatDate(selectedCharge.date)}</p>
                  </div>
                  {/* Status shown in header */}
                  <div className="flex flex-wrap gap-3 md:col-span-2">
                    {(() => {
                      const isPaid = selectedCharge?.statusKey === 'paid' || selectedCharge?.status === 'Paid';
                      const isPendingReview = selectedCharge?.statusKey === 'pending_review' || (selectedCharge?.payments || []).some((p) => p.status === 'pending');

                      if (isPaid) {
                        return (
                          <button
                            type="button"
                            onClick={() => downloadChargeReceipt(selectedCharge)}
                            className="btn-primary inline-flex items-center gap-2"
                          >
                            <FileText size={16} />
                            Print receipt
                          </button>
                        );
                      }

                      if (isPendingReview) {
                        return (
                          <button type="button" disabled className="btn-secondary inline-flex items-center gap-2 opacity-60 cursor-not-allowed">
                            <FileText size={16} />
                            Awaiting admin review
                          </button>
                        );
                      }

                      return (
                        <button
                          type="button"
                          onClick={() => handlePayInvoice(selectedCharge)}
                          className="btn-primary inline-flex items-center gap-2"
                        >
                          <CreditCard size={16} />
                          Proceed to payment
                        </button>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={() => downloadChargeDetails(selectedCharge)}
                      className="btn-secondary inline-flex items-center gap-2"
                    >
                      <FileDown size={16} />
                      Download PDF
                    </button>
                    {selectedCharge.status !== 'Paid' ? (
                      <button
                        type="button"
                        onClick={() => openDiscountModal(selectedCharge)}
                        className="btn-secondary inline-flex items-center gap-2"
                      >
                        <Percent size={16} />
                        Apply discount
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => contactBillingSupport(selectedCharge)}
                      className="btn-secondary inline-flex items-center gap-2"
                    >
                      <Headphones size={16} />
                      Contact billing
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {discountTarget ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between px-6 pb-2 pt-5 text-slate-900">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight">Apply Discount</h2>
                <p className="mt-5 text-2xl text-slate-700">
                  Invoice: <span className="font-semibold text-slate-900">{discountTarget.invoiceNumber}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={closeDiscountModal}
                className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close discount modal"
              >
                <X size={24} />
              </button>
            </div>

            <div className="px-6 pb-6 pt-3">
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="flex items-stretch">
                  <input
                    type="text"
                    value={discountCode}
                    onChange={(event) => setDiscountCode(event.target.value)}
                    placeholder="Code (PROMO20)"
                    className="min-w-0 flex-1 px-4 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={applyDiscountCode}
                    className="bg-slate-900 px-5 text-base font-medium text-white transition hover:bg-slate-800"
                  >
                    Apply
                  </button>
                </div>
              </div>

              <div className="mt-3 min-h-6 text-sm text-slate-600">
                {discountFeedback ? <p>{discountFeedback}</p> : <p>Available codes: PROMO20, WSI10</p>}
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  type="button"
                  onClick={handleApplyAndCloseDiscount}
                  className="inline-flex items-center rounded-full bg-blue-600 px-6 py-3 text-base font-medium text-white transition hover:bg-blue-500 force-white"
                >
                  Apply & Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {inlineAlert
        ? createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
              <div className="panel w-full max-w-md p-6">
                <div>
                  <p className="text-sm font-medium text-white">Notice</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">{inlineAlert}</h2>
                </div>
                <div className="mt-6 flex justify-end">
                  <button type="button" onClick={() => setInlineAlert(null)} className="btn-primary px-4 py-2">
                    OK
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
