import { useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, List, Grid2x2 } from 'lucide-react';
import DataTable from '../../components/common/DataTable';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import StatusBadge from '../../components/common/StatusBadge';
import { usePortal } from '../../context/PortalContext';
import { formatCurrency, formatDate } from '../../utils/format';

const PURCHASES_PER_PAGE = 6;

export default function PurchasesPage() {
  const { adminPurchases } = usePortal();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [layoutMode, setLayoutMode] = useState('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef(null);
  const statusMenuRef = useRef(null);
  const [statusMenuStyle, setStatusMenuStyle] = useState(null);
  const filters = ['All', 'Paid', 'Failed', 'Pending Review'];

  const filteredPurchases = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();

    return adminPurchases.filter((p) => {
      const matchesStatus = statusFilter === 'All' ? true : p.status === statusFilter;
      if (!matchesStatus) return false;

      if (normalized) {
        const hay = [p.id, p.client, p.serviceName, p.status, p.paymentMethod].join(' ').toLowerCase();
        return hay.includes(normalized);
      }

      return true;
    });
  }, [adminPurchases, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPurchases.length / PURCHASES_PER_PAGE));
  const paginatedPurchases = useMemo(() => filteredPurchases.slice((currentPage - 1) * PURCHASES_PER_PAGE, currentPage * PURCHASES_PER_PAGE), [filteredPurchases, currentPage]);

  useEffect(() => setCurrentPage(1), [statusFilter, searchTerm, layoutMode]);

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
        title="Recorded Purchases"
        description="Admin-side record of transactions, linked orders, and customer account activity."
      />

      <div className="panel p-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-[420px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="Search purchases"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.02] py-2 pl-10 pr-4 text-sm text-slate-200 outline-none"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
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
                    <div ref={statusMenuRef} style={statusMenuStyle} className="rounded-lg border border-white/6 bg-slate-900 shadow">
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

      {layoutMode === 'list' ? (
        <>
          <DataTable columns={columns} rows={paginatedPurchases} />
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </>
      ) : (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paginatedPurchases.map((p) => (
              <div key={p.id} className="panel-muted flex h-full flex-col gap-5 rounded-3xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{p.id}</p>
                    <p className="mt-1 text-sm text-slate-400">{p.serviceName}</p>
                  </div>
                  <StatusBadge status={p.status} />
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

                <div className="mt-auto flex items-center gap-2">
                  <a href={`/admin/purchases/${p.id}`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08]">View</a>
                </div>
              </div>
            ))}
          </div>

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </>
      )}
    </div>
  );
}
