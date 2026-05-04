import { useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, List, Grid2x2, Eye, CheckCircle2 } from 'lucide-react';
import DataTable from '../../components/common/DataTable';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import StatusBadge from '../../components/common/StatusBadge';
import { usePortal } from '../../context/PortalContext';
import { collectPurchaseLineItems, getPurchaseClientEmail, getPurchaseDisplayId } from '../../utils/adminDeals';
import { findClientByRecord, getClientDisplayName } from '../../utils/clients';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format';
import { getInvoiceApprovalBlockReason, getInvoiceStatusHelperText, getInvoiceStatusLabel, hasInvoiceRecord, isInvoicePaid } from '../../utils/invoices';
import { getDesiredDomainValue } from '../../utils/orders';

const PURCHASES_PER_PAGE = 5;
const BACKEND_ORIGIN = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/api\/?$/i, '');

const getDisplayValue = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }

    const normalizedValue = String(value).trim();
    if (normalizedValue) {
      return normalizedValue;
    }
  }

  return '';
};

const buildStorageUrl = (value, folder = '') => {
  const normalizedValue = String(value ?? '').trim();
  if (!normalizedValue) {
    return null;
  }

  if (/^https?:\/\//i.test(normalizedValue)) {
    return normalizedValue;
  }

  const normalizedPath = normalizedValue.replace(/^\/+/, '');
  const finalPath = folder && !normalizedPath.toLowerCase().startsWith(`${folder.toLowerCase()}/`)
    ? `${folder}/${normalizedPath}`
    : normalizedPath;

  return `${BACKEND_ORIGIN}/storage/${finalPath}`;
};

const getInvoiceNumber = (purchase) => getDisplayValue(
  purchase?.invoiceNumber,
  purchase?.invoice_number,
  purchase?.serviceInvoiceNumber,
  purchase?.service_invoice_number,
  purchase?.soaNumber,
  purchase?.soa_number,
  purchase?.receiptNumber,
  purchase?.receipt_number,
  purchase?.reference,
);

const getDueDateValue = (purchase) => purchase?.dueDate
  ?? purchase?.due_date
  ?? purchase?.dueOn
  ?? purchase?.due_on
  ?? purchase?.invoiceDueDate
  ?? purchase?.invoice_due_date
  ?? purchase?.paymentDueDate
  ?? purchase?.payment_due_date
  ?? null;

const getInvoiceDocumentUrl = (purchase) => buildStorageUrl(
  getDisplayValue(
    purchase?.invoiceUrl,
    purchase?.invoice_url,
    purchase?.invoiceFileUrl,
    purchase?.invoice_file_url,
    purchase?.invoicePath,
    purchase?.invoice_path,
    purchase?.invoiceFile,
    purchase?.invoice_file,
  ),
);

const getPaymentProofRecord = (purchase) => {
  const paymentEntries = Array.isArray(purchase?.payments) ? purchase.payments : [];
  const matchedPayment = paymentEntries.find((entry) => entry?.transactionRef || entry?.transaction_ref || entry?.proof || entry?.path || entry?.file || entry?.url);

  if (matchedPayment) {
    return matchedPayment;
  }

  const directProof = purchase?.paymentProof ?? purchase?.payment_proof ?? purchase?.proof ?? null;
  return directProof && typeof directProof === 'object' ? directProof : null;
};

const getPaymentProofUrl = (purchase) => {
  const proof = getPaymentProofRecord(purchase);
  if (!proof) {
    return null;
  }

  return buildStorageUrl(
    getDisplayValue(proof.url, proof.proofUrl, proof.proof_url)
      || getDisplayValue(proof.transactionRef, proof.transaction_ref, proof.path, proof.file, proof.filename, proof.name),
    'payment_proofs',
  );
};

const buildPurchaseRow = (purchase, clients) => {
  const clientRecord = findClientByRecord(clients, purchase.client, purchase.clientEmail);
  const clientName = clientRecord ? getClientDisplayName(clientRecord) : purchase.client;
  const invoiceStatus = getInvoiceStatusLabel(purchase);
  const hasLinkedInvoice = hasInvoiceRecord(purchase);
  const invoicePaid = isInvoicePaid(purchase);
  const canMarkInvoicePaid = hasLinkedInvoice && !invoicePaid && invoiceStatus !== 'Cancelled';
  const markPaidBlockedReason = !hasLinkedInvoice
    ? 'Linked invoice is not yet available from the billing API.'
    : invoicePaid
      ? 'Invoice is already marked paid.'
      : invoiceStatus === 'Cancelled'
        ? 'Cancelled invoices cannot be marked paid.'
        : '';

  return {
    ...purchase,
    client: clientName,
    clientEmail: clientRecord?.email ?? getPurchaseClientEmail(purchase) ?? '',
    clientRecord,
    displayId: getPurchaseDisplayId(purchase),
    invoiceNumber: getInvoiceNumber(purchase),
    invoiceStatus,
    invoiceStatusHelper: getInvoiceStatusHelperText(purchase),
    invoiceApprovalBlockReason: getInvoiceApprovalBlockReason(purchase),
    dueDate: getDueDateValue(purchase),
    hasInvoiceRecord: hasLinkedInvoice,
    isInvoicePaid: invoicePaid,
    canMarkInvoicePaid,
    markPaidBlockedReason,
    invoiceUrl: getInvoiceDocumentUrl(purchase),
    paymentProof: getPaymentProofRecord(purchase),
    paymentProofUrl: getPaymentProofUrl(purchase),
    lineItems: collectPurchaseLineItems(purchase),
  };
};

export default function PurchasesPage() {
  const { adminPurchases, clients, markAdminPurchasePaid } = usePortal();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [layoutMode, setLayoutMode] = useState('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [processingPaidPurchaseId, setProcessingPaidPurchaseId] = useState('');
  const [paymentActionMessage, setPaymentActionMessage] = useState('');
  const [paymentActionError, setPaymentActionError] = useState('');
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef(null);
  const statusMenuRef = useRef(null);
  const [statusMenuStyle, setStatusMenuStyle] = useState(null);

  const purchaseRows = useMemo(
    () => adminPurchases.map((purchase) => buildPurchaseRow(purchase, clients)),
    [adminPurchases, clients],
  );

  const filters = useMemo(
    () => ['All', ...new Set(purchaseRows.map((purchase) => purchase.invoiceStatus).filter(Boolean))],
    [purchaseRows],
  );

  const filteredPurchases = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();

    return purchaseRows.filter((p) => {
      const matchesStatus = statusFilter === 'All' ? true : p.invoiceStatus === statusFilter;
      if (!matchesStatus) return false;

      if (normalized) {
        const hay = [p.displayId, p.client, p.clientEmail, p.serviceName, p.status, p.paymentMethod, p.invoiceNumber, p.invoiceStatus, getDesiredDomainValue(p)].join(' ').toLowerCase();
        return hay.includes(normalized);
      }

      return true;
    });
  }, [purchaseRows, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPurchases.length / PURCHASES_PER_PAGE));
  const paginatedPurchases = useMemo(() => filteredPurchases.slice((currentPage - 1) * PURCHASES_PER_PAGE, currentPage * PURCHASES_PER_PAGE), [filteredPurchases, currentPage]);

  const openPurchaseDetails = (purchase) => {
    setPaymentActionMessage('');
    setPaymentActionError('');
    setSelectedPurchase(purchase);
  };

  const closePurchaseDetails = () => {
    setPaymentActionMessage('');
    setPaymentActionError('');
    setSelectedPurchase(null);
  };

  useEffect(() => setCurrentPage(1), [statusFilter, searchTerm, layoutMode]);

  useEffect(() => {
    if (!filters.includes(statusFilter)) {
      setStatusFilter('All');
    }
  }, [filters, statusFilter]);

  useEffect(() => {
    if (!selectedPurchase) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedPurchase(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedPurchase]);

  useEffect(() => {
    if (!selectedPurchase?.id) {
      return;
    }

    const refreshedPurchase = purchaseRows.find((purchase) => String(purchase.id) === String(selectedPurchase.id));

    if (refreshedPurchase) {
      setSelectedPurchase(refreshedPurchase);
    }
  }, [purchaseRows, selectedPurchase?.id]);

  const handleMarkPaid = async (purchase) => {
    if (!purchase?.id) {
      return;
    }

    if (!purchase.canMarkInvoicePaid) {
      setPaymentActionError(purchase.markPaidBlockedReason || 'This invoice cannot be marked paid yet.');
      return;
    }

    setProcessingPaidPurchaseId(String(purchase.id));
    setPaymentActionMessage('');
    setPaymentActionError('');

    try {
      const response = await markAdminPurchasePaid(purchase.id, {});
      setPaymentActionMessage(response?.message || 'Invoice marked as paid successfully.');
    } catch (requestError) {
      setPaymentActionError(requestError.message || 'Unable to mark this invoice as paid.');
    } finally {
      setProcessingPaidPurchaseId('');
    }
  };

  const getMarkPaidActionTitle = (purchase) => {
    if (!purchase) {
      return 'Mark invoice as paid';
    }

    if (processingPaidPurchaseId === String(purchase.id)) {
      return 'Marking invoice as paid...';
    }

    if (purchase.isInvoicePaid) {
      return 'Invoice already paid';
    }

    return purchase.markPaidBlockedReason || 'Mark invoice as paid';
  };

  const renderPurchaseActions = (purchase, buttonSizeClasses = 'h-10 w-10 rounded-2xl') => {
    const isProcessing = processingPaidPurchaseId === String(purchase.id);
    const markPaidDisabled = isProcessing || !purchase.canMarkInvoicePaid;
    const baseButtonClasses = `inline-flex ${buttonSizeClasses} items-center justify-center border transition disabled:cursor-not-allowed disabled:opacity-60`;

    return (
      <>
        <button
          type="button"
          onClick={() => openPurchaseDetails(purchase)}
          className={`${baseButtonClasses} border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]`}
          title="View purchase details"
          aria-label={`View purchase details for ${purchase.displayId}`}
        >
          <Eye size={16} />
        </button>
        <button
          type="button"
          onClick={() => handleMarkPaid(purchase)}
          disabled={markPaidDisabled}
          className={`${baseButtonClasses} ${markPaidDisabled ? 'border-white/10 bg-white/[0.04] text-slate-500' : 'border-emerald-400/25 bg-emerald-400/12 text-emerald-200 hover:bg-emerald-400/20'}`}
          title={getMarkPaidActionTitle(purchase)}
          aria-label={`${getMarkPaidActionTitle(purchase)} for ${purchase.invoiceNumber || purchase.displayId}`}
        >
          <CheckCircle2 size={16} />
        </button>
      </>
    );
  };

  // close status dropdown on outside click
  useEffect(() => {
    const onDoc = (e) => {
      const clickedInsideTrigger = statusRef.current && statusRef.current.contains(e.target);
      const clickedInsideMenu = statusMenuRef.current && statusMenuRef.current.contains(e.target);
      if (!clickedInsideTrigger && !clickedInsideMenu) setStatusOpen(false);
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
    const menuWidth = 180;
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

  const columns = [
    {
      key: 'displayId',
      label: 'Order ID',
      sortable: true,
      render: (value, row) => (
        <button type="button" onClick={() => openPurchaseDetails(row)} className="text-left font-medium text-sky-300 transition hover:text-sky-200">
          {value}
        </button>
      ),
    },
    {
      key: 'client',
      label: 'Client',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-white">{value}</p>
          {row.clientEmail ? <p className="mt-1 text-xs text-slate-400">{row.clientEmail}</p> : null}
        </div>
      ),
    },
    {
      key: 'serviceName',
      label: 'Service',
      sortable: true,
      render: (value, row) => (
        <div>
          <button type="button" onClick={() => openPurchaseDetails(row)} className="text-left font-medium text-white transition hover:text-sky-200">
            {value}
          </button>
          {getDesiredDomainValue(row) ? <p className="mt-1 break-all text-xs text-sky-200">Customer note / desired domain: {getDesiredDomainValue(row)}</p> : null}
        </div>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      sortValue: (r) => Number(r.amount || 0),
      render: (value) => formatCurrency(value),
    },
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      sortValue: (r) => new Date(r.date).getTime(),
      render: (value) => formatDate(value),
    },
    {
      key: 'invoiceStatus',
      label: 'Status',
      sortable: true,
      sortValue: (row) => row.invoiceStatus,
      render: (value) => <StatusBadge status={value} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      hideable: false,
      render: (_, row) => (
        <div className="flex justify-center gap-2">
          {renderPurchaseActions(row)}
        </div>
      ),
    },
  ];

  const purchasesHeaderAction = (
    <div className="flex w-full justify-end">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="relative w-full sm:w-[280px] xl:w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search purchases"
            className="w-full rounded-2xl border border-white/10 bg-white/[0.02] py-2 pl-10 pr-4 text-sm text-slate-200 outline-none"
          />
        </div>

        <div className="relative shrink-0" ref={statusRef}>
          <button
            type="button"
            onClick={() => setStatusOpen((current) => !current)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-slate-200"
          >
            <span className="sr-only">Status</span>
            <span className="text-sm text-slate-200">{statusFilter}</span>
            <ChevronDown size={14} className="text-slate-400" />
          </button>

          {statusOpen && statusMenuStyle
            ? createPortal(
                <div ref={statusMenuRef} style={statusMenuStyle} className="rounded-lg border border-white/6 bg-slate-900 shadow">
                  {filters.map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => {
                        setStatusFilter(filter);
                        setStatusOpen(false);
                        setCurrentPage(1);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
                    >
                      {filter}
                    </button>
                  ))}
                </div>,
                document.body,
              )
            : null}
        </div>

        {layoutMode === 'list' ? <div id="purchases-column-visibility-slot" className="shrink-0" /> : null}

        <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/70 p-1">
          <button
            type="button"
            onClick={() => setLayoutMode('list')}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${layoutMode === 'list' ? 'bg-orange-400 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            aria-label="List layout"
          >
            <List size={16} />
          </button>
          <button
            type="button"
            onClick={() => setLayoutMode('grid')}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${layoutMode === 'grid' ? 'bg-orange-400 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            aria-label="Grid layout"
          >
            <Grid2x2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Purchase Ledger"
        title="Recorded Purchases"
        action={purchasesHeaderAction}
      />

      {!selectedPurchase && paymentActionMessage ? (
        <div className="mt-6 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          {paymentActionMessage}
        </div>
      ) : null}

      {!selectedPurchase && paymentActionError ? (
        <div className="mt-6 rounded-3xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          {paymentActionError}
        </div>
      ) : null}

      {layoutMode === 'list' ? (
        <>
          <DataTable
            columns={columns}
            rows={paginatedPurchases}
            enableAdminColumnVisibility
            columnVisibilityStorageKey="admin-purchases-table-v2"
            compactColumnKeys={['displayId', 'client', 'serviceName', 'amount', 'date', 'invoiceStatus', 'actions']}
            columnVisibilityPortalTargetId="purchases-column-visibility-slot"
          />
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </>
      ) : (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paginatedPurchases.map((p) => (
              <div key={p.id} className="panel-muted flex h-full flex-col gap-5 rounded-3xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <button type="button" onClick={() => openPurchaseDetails(p)} className="text-left font-semibold text-white transition hover:text-sky-200">{p.displayId}</button>
                    <button type="button" onClick={() => openPurchaseDetails(p)} className="mt-1 block text-left text-sm text-slate-400 transition hover:text-slate-200">{p.serviceName}</button>
                    {getDesiredDomainValue(p) ? <p className="mt-2 break-all text-xs text-sky-200">Customer note / desired domain: {getDesiredDomainValue(p)}</p> : null}
                  </div>
                  <StatusBadge status={p.invoiceStatus} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Amount</p>
                    <p className="mt-2 text-sm font-medium text-slate-200">{formatCurrency(p.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Client</p>
                    <p className="mt-2 text-sm font-medium text-slate-200">{p.client}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatDate(p.date)}</p>
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-center gap-2">
                  {renderPurchaseActions(p, 'h-9 w-9 rounded-lg')}
                </div>
              </div>
            ))}
          </div>

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </>
      )}

      {selectedPurchase
        ? createPortal(
            <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onClick={closePurchaseDetails}>
              <div className="panel max-h-[88vh] w-full max-w-4xl overflow-y-auto p-6" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Purchase Details</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">{selectedPurchase.displayId}</h2>
                    <p className="mt-2 text-sm text-slate-400">{selectedPurchase.serviceName} • Recorded {formatDateTime(selectedPurchase.date)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <StatusBadge status={selectedPurchase.invoiceStatus} />
                    <button type="button" onClick={closePurchaseDetails} className="btn-secondary px-4">Close</button>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="panel-muted rounded-3xl p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Purchase Summary</p>
                    <div className="mt-4 space-y-3 text-sm text-slate-300">
                      <div className="flex items-start justify-between gap-4">
                        <span>Order ID</span>
                        <span className="text-right font-medium text-white">{selectedPurchase.displayId}</span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span>Service</span>
                        <span className="text-right font-medium text-white">{selectedPurchase.serviceName || '—'}</span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span>Amount</span>
                        <span className="text-right font-semibold text-sky-300">{formatCurrency(selectedPurchase.amount ?? 0)}</span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span>Payment Method</span>
                        <span className="text-right font-medium text-white">{selectedPurchase.paymentMethod || '—'}</span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span>Order Status</span>
                        <span className="text-right font-medium text-white">{selectedPurchase.status || '—'}</span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span>Recorded Date</span>
                        <span className="text-right font-medium text-white">{formatDate(selectedPurchase.date)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="panel-muted rounded-3xl p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Client & Invoice</p>
                    <div className="mt-4 space-y-3 text-sm text-slate-300">
                      <div className="flex items-start justify-between gap-4">
                        <span>Client</span>
                        <span className="text-right font-medium text-white">{selectedPurchase.client || '—'}</span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span>Client Email</span>
                        <span className="break-all text-right font-medium text-white">{selectedPurchase.clientEmail || '—'}</span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span>Invoice</span>
                        <span className="text-right font-medium text-white">{selectedPurchase.invoiceNumber || 'Not available'}</span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span>Invoice Status</span>
                        <span className="text-right"><StatusBadge status={selectedPurchase.invoiceStatus} /></span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span>Due Date</span>
                        <span className="text-right font-medium text-white">{formatDate(selectedPurchase.dueDate)}</span>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                      <p className="text-slate-300">{selectedPurchase.invoiceStatusHelper}</p>
                      {!selectedPurchase.canMarkInvoicePaid && selectedPurchase.markPaidBlockedReason ? (
                        <p className="mt-2 text-amber-300">{selectedPurchase.markPaidBlockedReason}</p>
                      ) : null}
                    </div>

                    <div className="mt-4 border-t border-white/10 pt-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Invoice File</p>
                      {selectedPurchase.invoiceUrl ? (
                        <a href={selectedPurchase.invoiceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-100 transition hover:bg-white/[0.08]">
                          Open invoice document
                        </a>
                      ) : (
                        <p className="mt-3 text-sm text-slate-400">No invoice document link is attached to this purchase record yet.</p>
                      )}
                    </div>
                  </div>
                </div>

                {getDesiredDomainValue(selectedPurchase) ? (
                  <div className="panel-muted mt-4 rounded-3xl p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Customer Note / Desired Domain</p>
                    <p className="mt-3 break-all text-sm text-slate-200">{getDesiredDomainValue(selectedPurchase)}</p>
                  </div>
                ) : null}

                {paymentActionMessage ? (
                  <div className="mt-4 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                    {paymentActionMessage}
                  </div>
                ) : null}

                {paymentActionError ? (
                  <div className="mt-4 rounded-3xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                    {paymentActionError}
                  </div>
                ) : null}

                <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="panel-muted rounded-3xl p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Recorded Line Items</p>
                    {selectedPurchase.lineItems.length ? (
                      <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full text-left text-sm text-slate-200">
                          <thead className="text-slate-500">
                            <tr>
                              <th className="px-3 py-2">Item</th>
                              <th className="px-3 py-2">Category</th>
                              <th className="px-3 py-2 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedPurchase.lineItems.map((item, index) => {
                              const itemAmount = item?.amount ?? item?.price ?? item?.total ?? item?.subtotal ?? null;
                              return (
                                <tr key={`${selectedPurchase.id}-item-${index}`} className="border-t border-white/10">
                                  <td className="px-3 py-3 font-medium text-white">{getDisplayValue(item?.serviceName, item?.service_name, item?.name, item?.title) || selectedPurchase.serviceName || '—'}</td>
                                  <td className="px-3 py-3 text-slate-400">{getDisplayValue(item?.category, item?.serviceCategory, item?.service_category) || '—'}</td>
                                  <td className="px-3 py-3 text-right font-medium text-sky-300">{itemAmount !== null && itemAmount !== '' && !Number.isNaN(Number(itemAmount)) ? formatCurrency(Number(itemAmount)) : '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-400">No nested line-item breakdown is included in this purchase payload.</p>
                    )}
                  </div>

                  <div className="panel-muted rounded-3xl p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Payment Proof</p>
                    {selectedPurchase.paymentProofUrl ? (
                      <div className="mt-4 space-y-3 text-sm text-slate-300">
                        <p>Proof of payment is attached to this purchase record.</p>
                        <p className="text-slate-400">Uploaded {formatDateTime(selectedPurchase.paymentProof?.createdAt ?? selectedPurchase.paymentProof?.created_at)}</p>
                        <a href={selectedPurchase.paymentProofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-100 transition hover:bg-white/[0.08]">
                          Open payment proof
                        </a>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-400">No payment proof link is attached to this purchase record.</p>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-white/10 pt-5">
                  <button
                    type="button"
                    onClick={() => handleMarkPaid(selectedPurchase)}
                    disabled={processingPaidPurchaseId === String(selectedPurchase.id) || !selectedPurchase.canMarkInvoicePaid}
                    title={selectedPurchase.markPaidBlockedReason || 'Mark this invoice as paid'}
                    className="inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {processingPaidPurchaseId === String(selectedPurchase.id)
                      ? 'Marking invoice as paid...'
                      : selectedPurchase.isInvoicePaid
                        ? 'Invoice Already Paid'
                        : 'Mark Invoice Paid'}
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
