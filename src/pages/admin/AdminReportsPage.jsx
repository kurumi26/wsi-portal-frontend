import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarRange,
  Clock3,
  Download,
  Eraser,
  FileSpreadsheet,
  FileText,
  Globe2,
  ReceiptText,
  Save,
  Search,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  X,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DataTable, { readStoredVisibleColumns, writeStoredVisibleColumns } from '../../components/common/DataTable';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import StandardComboChart from '../../components/common/StandardComboChart';
import StatusBadge from '../../components/common/StatusBadge';
import { usePortal } from '../../context/PortalContext';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format';
import {
  buildAdminReportDataset,
  buildReportFocusPath,
  CUSTOMER_REPORT_TEMPLATE_STORAGE_KEY,
  DEFAULT_REPORT_FILTERS,
  DETAILED_REPORT_FOCUS_OPTIONS,
  normalizeReportFocus,
  REPORT_FOCUS_OPTIONS,
  REPORT_TEMPLATE_STORAGE_KEY,
  REPORT_VISIBILITY_OPTIONS,
  readReportTemplates,
  writeReportTemplates,
} from '../../utils/reports';

const feedbackClasses = {
  success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  error: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
  info: 'border-sky-400/20 bg-sky-400/10 text-sky-200',
};

const toneClasses = {
  Active: 'report-tone-badge',
  Pending: 'report-tone-badge',
  Cancelled: 'report-tone-badge',
  'On Time': 'report-tone-badge',
  Late: 'report-tone-badge',
  Overdue: 'report-tone-badge',
  Open: 'report-tone-badge',
  own: 'report-tone-badge',
  public: 'report-tone-badge',
};

const toneStyles = {
  Active: { borderColor: '#86efac', backgroundColor: '#dcfce7', color: '#166534' },
  Pending: { borderColor: '#fcd34d', backgroundColor: '#fef3c7', color: '#92400e' },
  Cancelled: { borderColor: '#fda4af', backgroundColor: '#ffe4e6', color: '#be123c' },
  'On Time': { borderColor: '#86efac', backgroundColor: '#dcfce7', color: '#166534' },
  Late: { borderColor: '#fcd34d', backgroundColor: '#fef3c7', color: '#92400e' },
  Overdue: { borderColor: '#fda4af', backgroundColor: '#ffe4e6', color: '#be123c' },
  Open: { borderColor: '#93c5fd', backgroundColor: '#dbeafe', color: '#1d4ed8' },
  own: { borderColor: '#93c5fd', backgroundColor: '#dbeafe', color: '#1d4ed8' },
  public: { borderColor: '#86efac', backgroundColor: '#dcfce7', color: '#166534' },
};

const surfaceToneClasses = {
  sky: 'border-sky-300/20 bg-sky-400/10',
  emerald: 'border-emerald-300/20 bg-emerald-400/10',
  amber: 'border-orange-300/20 bg-orange-400/10',
  rose: 'border-rose-300/20 bg-rose-400/10',
  slate: 'border-white/10 bg-white/[0.03]',
};

const iconToneClasses = {
  sky: 'border-sky-300/20 bg-sky-300/15 text-sky-200',
  emerald: 'border-emerald-300/20 bg-emerald-300/15 text-emerald-200',
  amber: 'border-orange-300/20 bg-orange-300/15 text-orange-200',
  rose: 'border-rose-300/20 bg-rose-300/15 text-rose-200',
  slate: 'border-white/10 bg-white/10 text-slate-200',
};
const graphPointToneStyles = [
  { marker: '#2563eb', glow: 'rgba(37, 99, 235, 0.16)', swatch: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)', surface: 'rgba(219, 234, 254, 0.55)' },
  { marker: '#0f766e', glow: 'rgba(15, 118, 110, 0.16)', swatch: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)', surface: 'rgba(204, 251, 241, 0.52)' },
  { marker: '#7c3aed', glow: 'rgba(124, 58, 237, 0.16)', swatch: 'linear-gradient(135deg, #6d28d9 0%, #8b5cf6 100%)', surface: 'rgba(237, 233, 254, 0.58)' },
  { marker: '#db2777', glow: 'rgba(219, 39, 119, 0.16)', swatch: 'linear-gradient(135deg, #be185d 0%, #ec4899 100%)', surface: 'rgba(252, 231, 243, 0.62)' },
  { marker: '#d97706', glow: 'rgba(217, 119, 6, 0.16)', swatch: 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)', surface: 'rgba(254, 243, 199, 0.68)' },
  { marker: '#059669', glow: 'rgba(5, 150, 105, 0.16)', swatch: 'linear-gradient(135deg, #047857 0%, #10b981 100%)', surface: 'rgba(209, 250, 229, 0.6)' },
];

const graphLineStyles = {
  strokeStart: '#38bdf8',
  strokeMid: '#2563eb',
  strokeEnd: '#1d4ed8',
  fillTop: 'rgba(59, 130, 246, 0.18)',
  fillBottom: 'rgba(59, 130, 246, 0.01)',
  chartHalo: 'rgba(219, 234, 254, 0.95)',
  chartSurface: 'rgba(255, 255, 255, 0.98)',
  chartSurfaceBorder: 'rgba(226, 232, 240, 0.95)',
  grid: 'rgba(148, 163, 184, 0.14)',
  axis: 'rgba(148, 163, 184, 0.32)',
  featureGuide: 'rgba(59, 130, 246, 0.18)',
  lineShadow: 'rgba(37, 99, 235, 0.18)',
  plotValue: '#0f172a',
  plotValueMuted: '#64748b',
  pointSurface: '#ffffff',
  pointBorder: '#2563eb',
  pointCore: '#2563eb',
  pointGlow: 'rgba(37, 99, 235, 0.14)',
  pointHighlightBorder: '#0f172a',
  pointHighlightCore: '#0f172a',
  pointHighlightGlow: 'rgba(15, 23, 42, 0.16)',
  badgeSurface: 'rgba(255, 255, 255, 0.98)',
  badgeBorder: 'rgba(148, 163, 184, 0.22)',
  axisText: '#64748b',
  captionText: '#0f172a',
  captionMutedText: '#64748b',
};

const buildSmoothLinePath = (points) => {
  if (points.length < 2) {
    return '';
  }

  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }

    const previousPoint = points[index - 1];
    const midpointX = (previousPoint.x + point.x) / 2;

    return `${path} C ${midpointX} ${previousPoint.y}, ${midpointX} ${point.y}, ${point.x} ${point.y}`;
  }, '');
};

const buildSmoothAreaPath = (points, baselineY) => {
  if (points.length < 2) {
    return '';
  }

  return `${buildSmoothLinePath(points)} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;
};

const REPORT_FOCUS_META = {
  all: {
    icon: BarChart3,
    tone: 'sky',
    description: 'Unified pipeline coverage across sales, service lifecycle, receivables, and tax snapshots.',
  },
  sales: {
    icon: TrendingUp,
    tone: 'emerald',
    description: 'Revenue and deal mix by client, product, amount, and date range.',
  },
  services: {
    icon: ShieldCheck,
    tone: 'amber',
    description: 'Renewal, cancellation, and service status reporting for the delivery team.',
  },
  receivables: {
    icon: ReceiptText,
    tone: 'rose',
    description: 'Outstanding invoices, unpaid balances, and on-time versus late payment timing.',
  },
  tax: {
    icon: FileText,
    tone: 'sky',
    description: 'Paid sales rolled into simple accounting periods for tax and bookkeeping review.',
  },
};

const QUICK_RANGE_PRESETS = [
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'quarter', label: 'Quarter to Date' },
  { value: 'year', label: 'Year to Date' },
];
const REPORT_TABLE_PAGE_SIZE = 10;
const REPORT_COLUMN_VISIBILITY_STORAGE_KEYS = [
  'admin-reports-collections-table',
  'admin-reports-sales-table',
  'admin-reports-services-table',
  'admin-reports-renewals-table',
  'admin-reports-receivables-table',
  'admin-reports-tax-table',
];
const INITIAL_TABLE_PAGES = {
  collections: 1,
  sales: 1,
  services: 1,
  renewals: 1,
  receivables: 1,
  tax: 1,
};

const readReportColumnVisibilitySnapshot = () => REPORT_COLUMN_VISIBILITY_STORAGE_KEYS.reduce((snapshot, storageKey) => {
  const visibleColumns = readStoredVisibleColumns(storageKey);

  if (Array.isArray(visibleColumns)) {
    snapshot[storageKey] = visibleColumns;
  }

  return snapshot;
}, {});

const applyReportColumnVisibilitySnapshot = (snapshot = {}) => {
  REPORT_COLUMN_VISIBILITY_STORAGE_KEYS.forEach((storageKey) => {
    if (Array.isArray(snapshot?.[storageKey])) {
      writeStoredVisibleColumns(storageKey, snapshot[storageKey]);
    }
  });
};

const hasReportColumnVisibilitySnapshot = (snapshot = {}) => REPORT_COLUMN_VISIBILITY_STORAGE_KEYS
  .some((storageKey) => Array.isArray(snapshot?.[storageKey]));

const formatCompactCurrency = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(Number(value ?? 0));

const formatCompactNumber = (value) => new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(Number(value ?? 0));

const formatInputDate = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getQuickRangeDates = (preset, referenceDate = new Date()) => {
  const endDate = formatInputDate(referenceDate);
  const startDate = new Date(referenceDate);

  switch (preset) {
    case 'last7':
      startDate.setDate(referenceDate.getDate() - 6);
      return { label: 'Last 7 Days', startDate: formatInputDate(startDate), endDate };
    case 'last30':
      startDate.setDate(referenceDate.getDate() - 29);
      return { label: 'Last 30 Days', startDate: formatInputDate(startDate), endDate };
    case 'quarter': {
      const quarterStartMonth = Math.floor(referenceDate.getMonth() / 3) * 3;
      return {
        label: 'Quarter to Date',
        startDate: formatInputDate(new Date(referenceDate.getFullYear(), quarterStartMonth, 1)),
        endDate,
      };
    }
    case 'year':
      return {
        label: 'Year to Date',
        startDate: formatInputDate(new Date(referenceDate.getFullYear(), 0, 1)),
        endDate,
      };
    default:
      return null;
  }
};

function FocusCard({ icon: Icon, label, helper, metric, active, tone = 'sky', onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative overflow-hidden rounded-3xl border p-4 text-left transition cursor-pointer ${
        active
          ? `${surfaceToneClasses[tone] ?? surfaceToneClasses.slate} shadow-[0_0_0_1px_rgba(148,163,184,0.18)]`
          : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]'
      } focus:outline-none focus:ring-2 focus:ring-sky-400`}
    >
      {active ? <span className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-200">Active</span> : null}
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{metric}</p>
      {helper ? <p className="mt-2 text-sm leading-6 text-slate-400">{helper}</p> : null}
    </button>
  );
}

function FilterChip({ label, value, onClear }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200">
      <span className="font-semibold text-slate-300">{label}</span>
      <span>{value}</span>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
        aria-label={`Clear ${label} filter`}
      >
        <X size={12} />
      </button>
    </span>
  );
}

function ReportBarGraph({
  title,
  description,
  items = [],
  valueFormatter = (value) => value,
  emptyMessage,
  axisLabel = 'Metric',
}) {
  const normalizedItems = items.map((item) => ({
    ...item,
    numericValue: Number(item.value) || 0,
  }));
  const totalValue = normalizedItems.reduce((sum, item) => sum + item.numericValue, 0);
  const highestItem = normalizedItems.reduce((currentHighest, item) => (
    !currentHighest || item.numericValue > currentHighest.numericValue ? item : currentHighest
  ), null);
  const averageValue = normalizedItems.length ? totalValue / normalizedItems.length : 0;
  const trendValues = normalizedItems.map((item, index, collection) => {
    const previous = collection[index - 1]?.numericValue ?? item.numericValue;
    const next = collection[index + 1]?.numericValue ?? item.numericValue;

    return Math.round((previous + item.numericValue + next) / 3);
  });

  if (!normalizedItems.length) {
    return (
      <div className="panel overflow-hidden">
        <div className="border-b border-white/10 bg-gradient-to-r from-sky-400/10 via-white/[0.02] to-transparent p-5 lg:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-sky-200">
              <BarChart3 size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
            </div>
          </div>
        </div>

        <div className="p-5 lg:p-6">
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-slate-400">
            {emptyMessage}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-white/10 bg-gradient-to-r from-sky-400/10 via-white/[0.02] to-transparent p-5 lg:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-sky-200">
            <BarChart3 size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
          </div>
        </div>
      </div>

      <div className="p-5 lg:p-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_220px]">
          <StandardComboChart
            labels={normalizedItems.map((item) => item.label)}
            barValues={normalizedItems.map((item) => item.numericValue)}
            lineValues={trendValues}
            barLabel={axisLabel}
            lineLabel="Trend"
            valueFormatter={valueFormatter}
            wrapperClassName="rounded-[26px] border border-slate-200 bg-slate-50 p-4 lg:p-5"
            minWidth={760}
            plotHeight={220}
          />

          <aside className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Chart Summary</p>
            <div className="mt-4 space-y-5">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Total Value</p>
                <p className="mt-2 text-2xl font-semibold text-[#2f6dff]">{valueFormatter(totalValue)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Top Category</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{highestItem?.label ?? '—'}</p>
                <p className="mt-1 text-sm text-slate-500">{highestItem ? valueFormatter(highestItem.numericValue) : 'No values available.'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Average</p>
                <p className="mt-2 text-4xl font-semibold text-slate-900">{valueFormatter(averageValue)}</p>
                <p className="mt-2 text-sm text-slate-500">Trendline is the smoothed average between each point and its neighbors.</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function PaginatedReportTable({
  columns,
  rows,
  emptyMessage,
  currentPage,
  onPageChange,
  itemLabel,
  enableAdminColumnVisibility = false,
  columnVisibilityStorageKey,
  compactColumnKeys = [],
  columnVisibilitySyncKey = 0,
}) {
  const totalPages = Math.max(1, Math.ceil(rows.length / REPORT_TABLE_PAGE_SIZE));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = rows.length ? (safePage - 1) * REPORT_TABLE_PAGE_SIZE : 0;
  const endIndex = Math.min(startIndex + REPORT_TABLE_PAGE_SIZE, rows.length);
  const paginatedRows = rows.slice(startIndex, endIndex);

  return (
    <div>
      <DataTable
        columns={columns}
        rows={paginatedRows}
        emptyMessage={emptyMessage}
        enableAdminColumnVisibility={enableAdminColumnVisibility}
        columnVisibilityStorageKey={columnVisibilityStorageKey}
        compactColumnKeys={compactColumnKeys}
        columnVisibilitySyncKey={columnVisibilitySyncKey}
      />
      {rows.length ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.16em] text-slate-500">
          <span>Showing {startIndex + 1}-{endIndex} of {rows.length} {itemLabel}</span>
          <span>{REPORT_TABLE_PAGE_SIZE} items per page</span>
        </div>
      ) : null}
      <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}

function ReportSection({
  icon: Icon,
  title,
  description,
  metricLabel,
  metricValue,
  metricHelper,
  miniStats = [],
  action,
  children,
  hideMetricCard = false,
}) {
  return (
    <section className="space-y-4">
      <div className="panel overflow-hidden">
        <div className="bg-gradient-to-r from-sky-400/10 via-white/[0.02] to-transparent p-5 lg:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex max-w-3xl items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-sky-200">
                <Icon size={18} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">{title}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-400">{description}</p>
              </div>
            </div>

            {action || !hideMetricCard ? (
              <div className="flex flex-wrap items-start justify-end gap-3">
                {action ? <div className="shrink-0">{action}</div> : null}
                {!hideMetricCard ? (
                  <div className="min-w-[220px] rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-4 text-right">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{metricLabel}</p>
                    <p className="mt-3 text-2xl font-semibold text-white">{metricValue}</p>
                    {metricHelper ? <p className="mt-2 text-xs leading-5 text-slate-400">{metricHelper}</p> : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {miniStats.length ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {miniStats.map((item) => (
                <div key={item.label} className={`rounded-2xl border p-4 ${surfaceToneClasses[item.tone] ?? surfaceToneClasses.slate}`}>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
                  {item.helper ? <p className="mt-1 text-xs leading-5 text-slate-400">{item.helper}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {children}
    </section>
  );
}

const buildTemplateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `report-template-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};

const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const normalizeExportText = (value) => String(value ?? '')
  .replace(/\u20b1/g, 'PHP ')
  .replace(/\u2022/g, ' | ')
  .replace(/[–—]/g, '-')
  .replace(/\u00a0/g, ' ');

const escapeHtml = (value) => normalizeExportText(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const buildFilterSummary = (filters, productTypeOptions, dealTypeOptions, collectionMonthOptions = []) => {
  const focusLabel = REPORT_FOCUS_OPTIONS.find((option) => option.value === filters.reportFocus)?.label ?? 'All Reports';
  const productLabel = productTypeOptions.includes(filters.productType) ? filters.productType : 'All Products';
  const dealLabel = dealTypeOptions.includes(filters.dealType) ? filters.dealType : 'All Deals';
  const collectionMonthLabel = collectionMonthOptions.find((option) => option.value === filters.reportMonth)?.label ?? 'Latest available month';

  return [
    ['Report', focusLabel],
    ['Collection month', filters.reportMonth ? collectionMonthLabel : 'Latest available month'],
    ['Search', filters.searchTerm || 'All records'],
    ['Start date', filters.startDate || 'Any'],
    ['End date', filters.endDate || 'Any'],
    ['Minimum amount', filters.minAmount ? formatCurrency(Number(filters.minAmount)) : 'Any'],
    ['Maximum amount', filters.maxAmount ? formatCurrency(Number(filters.maxAmount)) : 'Any'],
    ['Product type', productLabel],
    ['Deal type', dealLabel],
  ];
};

const workbookCurrencyPattern = /(amount|revenue|sales|tax|receivables|balance|due)/i;

const buildWorkbookTable = ({
  title,
  description,
  columns,
  rows,
  emptyMessage = 'No records found.',
}) => {
  const headerMarkup = columns
    .map((column) => `<th class="${workbookCurrencyPattern.test(column) ? 'align-right' : ''}">${escapeHtml(column)}</th>`)
    .join('');

  const bodyMarkup = rows.length
    ? rows.map((row, rowIndex) => `
        <tr class="${rowIndex % 2 === 0 ? 'row-even' : 'row-odd'}">
          ${row.map((value, columnIndex) => `<td class="${workbookCurrencyPattern.test(columns[columnIndex]) ? 'align-right' : ''}">${escapeHtml(value)}</td>`).join('')}
        </tr>
      `).join('')
    : `<tr><td colspan="${columns.length}" class="empty-cell">${escapeHtml(emptyMessage)}</td></tr>`;

  return `
    <table class="workbook-card" role="presentation">
      <tr>
        <td class="workbook-card-head">
          <div class="workbook-card-title">${escapeHtml(title)}</div>
          ${description ? `<div class="workbook-card-copy">${escapeHtml(description)}</div>` : ''}
        </td>
      </tr>
      <tr>
        <td class="workbook-card-body">
          <table class="workbook-table">
            <thead>
              <tr>${headerMarkup}</tr>
            </thead>
            <tbody>${bodyMarkup}</tbody>
          </table>
        </td>
      </tr>
    </table>
  `;
};

const buildWorkbookHtml = ({ title, generatedAt, filters, summaryRows, sections }) => {
  const highlightRows = summaryRows.slice(0, 4);

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { margin: 0.4in; }
          body { margin: 0; padding: 24px; background: #edf4f7; color: #0f172a; font-family: "Segoe UI", Arial, sans-serif; }
          .hero { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 18px; }
          .hero-card { padding: 28px 32px; background: #0f172a; background-image: linear-gradient(135deg, #0f172a 0%, #155e75 100%); border-radius: 24px; }
          .hero-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; color: #bae6fd; }
          .hero-title { margin-top: 10px; font-size: 26px; font-weight: 700; color: #ffffff; }
          .hero-copy { margin-top: 8px; font-size: 13px; line-height: 1.6; color: #dbeafe; }
          .hero-meta { margin-top: 14px; font-size: 11px; color: #bfdbfe; }
          .highlight-grid { width: 100%; border-collapse: separate; border-spacing: 12px; margin-bottom: 18px; }
          .highlight-cell { width: 25%; padding: 16px 18px; background: #ffffff; border: 1px solid #d9e2ec; border-radius: 18px; }
          .highlight-label { font-size: 11px; font-weight: 700; letter-spacing: 1.3px; text-transform: uppercase; color: #64748b; }
          .highlight-value { margin-top: 8px; font-size: 18px; font-weight: 700; color: #0f172a; }
          .workbook-card { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 18px; background: #ffffff; border: 1px solid #d9e2ec; border-radius: 20px; overflow: hidden; }
          .workbook-card-head { padding: 16px 20px; background: #f8fbff; border-bottom: 1px solid #d9e2ec; }
          .workbook-card-title { font-size: 16px; font-weight: 700; color: #0f172a; }
          .workbook-card-copy { margin-top: 6px; font-size: 12px; line-height: 1.5; color: #64748b; }
          .workbook-card-body { padding: 0; }
          .workbook-table { width: 100%; border-collapse: collapse; }
          .workbook-table thead th { padding: 12px 14px; background: #155e75; color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; text-align: left; }
          .workbook-table tbody td { padding: 11px 14px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #0f172a; vertical-align: top; }
          .row-even td { background: #ffffff; }
          .row-odd td { background: #f8fafc; }
          .align-right { text-align: right; }
          .empty-cell { padding: 18px 14px; text-align: center; color: #64748b; }
        </style>
      </head>
      <body>
        <table class="hero" role="presentation">
          <tr>
            <td class="hero-card">
              <div class="hero-eyebrow">WSI Report Export</div>
              <div class="hero-title">${escapeHtml(title)}</div>
              <div class="hero-copy">Prepared from the current report filters and styled for finance, operations, and client review.</div>
              <div class="hero-meta">Generated ${escapeHtml(generatedAt)} | ${filters.length} filters | ${sections.length} section${sections.length === 1 ? '' : 's'}</div>
            </td>
          </tr>
        </table>

        ${highlightRows.length ? `
          <table class="highlight-grid" role="presentation">
            <tr>
              ${highlightRows.map(([label, value]) => `
                <td class="highlight-cell">
                  <div class="highlight-label">${escapeHtml(label)}</div>
                  <div class="highlight-value">${escapeHtml(value)}</div>
                </td>
              `).join('')}
            </tr>
          </table>
        ` : ''}

        ${buildWorkbookTable({
          title: 'Filters',
          description: 'Current filter values used when this report was exported.',
          columns: ['Filter', 'Value'],
          rows: filters,
          emptyMessage: 'No filters were applied.',
        })}
        ${buildWorkbookTable({
          title: 'Summary',
          description: 'Headline metrics for the selected report scope.',
          columns: ['Metric', 'Value'],
          rows: summaryRows,
          emptyMessage: 'No summary metrics are available.',
        })}
        ${sections.map((section) => buildWorkbookTable({
          title: section.title,
          description: section.description,
          columns: section.columns,
          rows: section.rows,
        })).join('')}
      </body>
    </html>
  `;
};

const renderToneBadge = (value) => (
  <span
    className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold shadow-sm ${toneClasses[value] ?? 'report-tone-badge'}`}
    style={toneStyles[value] ?? { borderColor: '#cbd5e1', backgroundColor: '#f8fafc', color: '#334155' }}
  >
    {value}
  </span>
);

const getTemplateSummary = (template) => {
  const details = [];

  if (template.filters?.reportMonth) {
    details.push(`Collection month: ${template.filters.reportMonth}`);
  }

  if (template.filters?.searchTerm) {
    details.push(`Search: ${template.filters.searchTerm}`);
  }

  if (template.filters?.productType && template.filters.productType !== 'All Products') {
    details.push(`Product: ${template.filters.productType}`);
  }

  if (template.filters?.dealType && template.filters.dealType !== 'All Deals') {
    details.push(`Deal: ${template.filters.dealType}`);
  }

  if (template.filters?.startDate || template.filters?.endDate) {
    details.push(`Window: ${template.filters.startDate || 'Any'} to ${template.filters.endDate || 'Any'}`);
  }

  if (template.filters?.minAmount || template.filters?.maxAmount) {
    details.push(`Amount: ${template.filters.minAmount || 'Any'} to ${template.filters.maxAmount || 'Any'}`);
  }

  return details.length ? details.join(' • ') : 'All records and all date windows';
};

const getReportsPageConfig = (audience = 'admin') => {
  if (audience === 'customer') {
    return {
      title: 'My Reports',
      basePath: '/dashboard/reports',
      exportTitle: 'WSI Customer Reports Center',
      filenamePrefix: 'wsi-customer',
      feedbackDatasetLabel: 'customer',
      emptyFiltersMessage: 'No focused filters yet. The reports page is showing the widest available customer dataset.',
      emptyTemplatesMessage: 'No saved templates yet. Save the current report filters to build reusable customer report presets.',
      upcomingRenewalsDescription: 'Surface services renewing within the next 30 days so you can act ahead of churn or missed renewal windows.',
      templateStorageKey: CUSTOMER_REPORT_TEMPLATE_STORAGE_KEY,
    };
  }

  return {
    title: 'Admin Reports',
    basePath: '/admin/reports',
    exportTitle: 'WSI Admin Reports Center',
    filenamePrefix: 'wsi-admin',
    feedbackDatasetLabel: 'admin',
    focusOverviewHelper: 'Keep the full admin reporting surface visible while refining filters.',
    overviewGraphDescription: 'Overview of which product types are driving revenue across the current admin report scope.',
    emptyFiltersMessage: 'No focused filters yet. The reports page is showing the widest available admin dataset.',
    emptyTemplatesMessage: 'No saved templates yet. Save the current report filters to build reusable admin report presets.',
    upcomingRenewalsDescription: 'Surface services renewing within the next 30 days so the admin team can act ahead of churn or missed renewal windows.',
    templateStorageKey: REPORT_TEMPLATE_STORAGE_KEY,
  };
};

export default function AdminReportsPage({ audience = 'admin' }) {
  const navigate = useNavigate();
  const { reportView } = useParams();
  const isCustomerAudience = audience === 'customer';
  const pageConfig = getReportsPageConfig(audience);
  const {
    orders,
    myServices,
    adminPurchases,
    adminServices,
    clients,
    services,
  } = usePortal();
  const reportPurchases = audience === 'customer' ? orders : adminPurchases;
  const reportServices = audience === 'customer' ? myServices : adminServices;
  const reportClients = audience === 'customer' ? [] : clients;
  const routeReportFocus = normalizeReportFocus(reportView);
  const [filters, setFilters] = useState(DEFAULT_REPORT_FILTERS);
  const [templateName, setTemplateName] = useState('');
  const [templateVisibility, setTemplateVisibility] = useState('own');
  const [savedTemplates, setSavedTemplates] = useState(() => readReportTemplates(pageConfig.templateStorageKey));
  const [feedback, setFeedback] = useState(null);
  const [activeWorkspacePanel, setActiveWorkspacePanel] = useState(null);
  const [tablePages, setTablePages] = useState(INITIAL_TABLE_PAGES);
  const [columnVisibilitySyncKey, setColumnVisibilitySyncKey] = useState(0);

  useEffect(() => {
    if (reportView && routeReportFocus !== reportView) {
      navigate(buildReportFocusPath(routeReportFocus, pageConfig.basePath), { replace: true });
      return;
    }

    setFilters((current) => (
      current.reportFocus === routeReportFocus
        ? current
        : { ...current, reportFocus: routeReportFocus }
    ));
  }, [navigate, pageConfig.basePath, reportView, routeReportFocus]);

  useEffect(() => {
    writeReportTemplates(savedTemplates, pageConfig.templateStorageKey);
  }, [pageConfig.templateStorageKey, savedTemplates]);

  const reportData = useMemo(() => buildAdminReportDataset({
    purchases: reportPurchases,
    services: reportServices,
    catalogServices: services,
    clients: reportClients,
    filters,
  }), [filters, reportClients, reportPurchases, reportServices, services]);

  const filterSummaryRows = useMemo(
    () => buildFilterSummary(
      filters,
      reportData.productTypeOptions,
      reportData.dealTypeOptions,
      reportData.collectionMonthOptions,
    ),
    [filters, reportData.collectionMonthOptions, reportData.productTypeOptions, reportData.dealTypeOptions],
  );

  const summaryRows = useMemo(() => [
    ['Filtered revenue', formatCurrency(reportData.summary.filteredRevenue)],
    ['Filtered deals', String(reportData.summary.filteredDeals)],
    ['Renewal rate', formatPercent(reportData.summary.renewalRate)],
    ['Cancellation rate', formatPercent(reportData.summary.cancellationRate)],
    ['Active services', String(reportData.summary.activeServices)],
    ['Pending services', String(reportData.summary.pendingServices)],
    ['Cancelled services', String(reportData.summary.cancelledServices)],
    ['Open invoices', String(reportData.summary.openInvoices)],
    ['Overdue invoices', `${reportData.summary.overdueInvoices} (${formatCurrency(reportData.summary.overdueAmount)})`],
    ['Unpaid invoices', `${reportData.summary.unpaidInvoices} (${formatCurrency(reportData.summary.unpaidAmount)})`],
    ['On-time payments', String(reportData.summary.onTimePayments)],
    ['Late payments', String(reportData.summary.latePayments)],
    ['Upcoming renewals', String(reportData.summary.upcomingRenewals)],
    ['Tax due', formatCurrency(reportData.summary.taxDue)],
    ['Net revenue', formatCurrency(reportData.summary.netRevenue)],
  ], [reportData.summary]);

  const exportSections = useMemo(() => {
    const sections = [];

    if (!isCustomerAudience && reportData.selectedCollectionMonthKey) {
      sections.push({
        title: `${reportData.selectedCollectionMonthLabel} Collection Summary`,
        description: `${reportData.monthlyCollectionRows.length} paid line-item record${reportData.monthlyCollectionRows.length === 1 ? '' : 's'} match the selected collection month.`,
        columns: [
          'Billing-In-Charge',
          'Deal Owner',
          'Client Name',
          'Product Category',
          'Deal Name',
          'Deal Type',
          'Deal Sub-Type',
          'Collection Amount',
          'Amount',
          'Service Invoice Number',
          'Service Invoice Date',
          'TIN Number',
          'Billing Address',
          'Tax Classification',
        ],
        rows: reportData.monthlyCollectionRows.map((row) => [
          row.billingInCharge || '—',
          row.dealOwner || '—',
          row.clientName,
          row.productCategory,
          row.dealName,
          row.dealType,
          row.dealSubType,
          formatCurrency(row.collectionAmount),
          formatCurrency(row.amount),
          row.invoiceNumber || '—',
          formatDate(row.serviceInvoiceDate),
          row.tinNumber,
          row.billingAddress,
          row.taxClassification,
        ]),
      });
    }

    if (filters.reportFocus === 'all' || filters.reportFocus === 'sales') {
      sections.push({
        title: 'Sales Report',
        description: `${reportData.filteredSalesRows.length} deals match the current sales filters.`,
        columns: isCustomerAudience
          ? ['Order', 'Date', 'Product', 'Product Type', 'Deal Type', 'Deal Sub Type', 'Amount', 'Status']
          : ['Order', 'Date', 'Client', 'Email', 'Product', 'Product Type', 'Deal Type', 'Deal Sub Type', 'Amount', 'Status'],
        rows: reportData.filteredSalesRows.map((row) => (
          isCustomerAudience
            ? [
              row.orderLabel,
              formatDate(row.date),
              row.productName,
              row.productType,
              row.dealType,
              row.dealSubType,
              formatCurrency(row.amount),
              row.status,
            ]
            : [
              row.orderLabel,
              formatDate(row.date),
              row.clientName,
              row.clientEmail,
              row.productName,
              row.productType,
              row.dealType,
              row.dealSubType,
              formatCurrency(row.amount),
              row.status,
            ]
        )),
      });
    }

    if (filters.reportFocus === 'all' || filters.reportFocus === 'services') {
      sections.push({
        title: 'Service Lifecycle',
        description: `${reportData.filteredServiceRows.length} service records are included.`,
        columns: isCustomerAudience
          ? ['Service', 'Product Type', 'Lifecycle', 'Status', 'Renews On', 'Days to Renewal']
          : ['Service', 'Client', 'Product Type', 'Lifecycle', 'Status', 'Renews On', 'Days to Renewal'],
        rows: reportData.filteredServiceRows.map((row) => (
          isCustomerAudience
            ? [
              row.serviceName,
              row.productType,
              row.lifecycleStatus,
              row.status,
              formatDate(row.renewsOn),
              row.daysUntilRenewal ?? '—',
            ]
            : [
              row.serviceName,
              row.clientName,
              row.productType,
              row.lifecycleStatus,
              row.status,
              formatDate(row.renewsOn),
              row.daysUntilRenewal ?? '—',
            ]
        )),
      });
      sections.push({
        title: 'Upcoming Renewals',
        description: `${reportData.upcomingRenewalRows.length} services renew within 30 days.`,
        columns: isCustomerAudience
          ? ['Service', 'Product Type', 'Renews On', 'Days Remaining']
          : ['Service', 'Client', 'Product Type', 'Renews On', 'Days Remaining'],
        rows: reportData.upcomingRenewalRows.map((row) => (
          isCustomerAudience
            ? [
              row.serviceName,
              row.productType,
              formatDate(row.renewsOn),
              row.daysUntilRenewal ?? '—',
            ]
            : [
              row.serviceName,
              row.clientName,
              row.productType,
              formatDate(row.renewsOn),
              row.daysUntilRenewal ?? '—',
            ]
        )),
      });
    }

    if (filters.reportFocus === 'all' || filters.reportFocus === 'receivables') {
      sections.push({
        title: isCustomerAudience ? 'Open/Aging Invoices, Payments & Unpaid Invoices' : 'Receivables & Payments',
        description: isCustomerAudience
          ? `${reportData.filteredSalesRows.length} invoice-backed records are available across open, aging, unpaid, and payment-timing views.`
          : `${reportData.filteredSalesRows.length} invoice-backed purchase records are available.`,
        columns: isCustomerAudience
          ? ['Invoice', 'Order', 'Product', 'Amount', 'Due Date', 'Status', 'Payment Timing']
          : ['Invoice', 'Order', 'Client', 'Product', 'Amount', 'Due Date', 'Status', 'Payment Timing'],
        rows: reportData.filteredSalesRows.map((row) => (
          isCustomerAudience
            ? [
              row.invoiceNumber,
              row.orderLabel,
              row.productName,
              formatCurrency(row.amount),
              formatDate(row.dueDate),
              row.isPaid ? 'Paid' : 'Unpaid',
              row.paymentTiming,
            ]
            : [
              row.invoiceNumber,
              row.orderLabel,
              row.clientName,
              row.productName,
              formatCurrency(row.amount),
              formatDate(row.dueDate),
              row.isPaid ? 'Paid' : 'Unpaid',
              row.paymentTiming,
            ]
        )),
      });
    }

    if (filters.reportFocus === 'all' || filters.reportFocus === 'tax') {
      sections.push({
        title: 'Tax & Accounting',
        description: `${reportData.taxRows.length} monthly accounting buckets are calculated from paid sales.`,
        columns: ['Period', 'Gross Sales', 'Tax Due', 'Net Revenue', 'Receivables'],
        rows: reportData.taxRows.map((row) => [
          row.period,
          formatCurrency(row.grossSales),
          formatCurrency(row.taxDue),
          formatCurrency(row.netRevenue),
          formatCurrency(row.receivables),
        ]),
      });
    }

    return sections;
  }, [filters.reportFocus, isCustomerAudience, reportData]);

  const collectionColumns = useMemo(() => [
    { key: 'billingInCharge', label: 'Billing-In-Charge', sortable: true },
    { key: 'dealOwner', label: 'Deal Owner', sortable: true },
    {
      key: 'clientName',
      label: 'Client Name',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-white">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{row.clientEmail}</p>
        </div>
      ),
    },
    { key: 'productCategory', label: 'Product Category', sortable: true },
    {
      key: 'dealName',
      label: 'Deal Name',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-white">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{row.productName}</p>
        </div>
      ),
    },
    { key: 'dealType', label: 'Deal Type', sortable: true },
    { key: 'dealSubType', label: 'Deal Sub-Type', sortable: true },
    {
      key: 'collectionAmount',
      label: 'Collection Amount',
      sortable: true,
      sortValue: (row) => row.collectionAmount,
      render: (value) => formatCurrency(value),
    },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      sortValue: (row) => row.amount,
      render: (value) => formatCurrency(value),
    },
    { key: 'invoiceNumber', label: 'Service Invoice Number', sortable: true },
    {
      key: 'serviceInvoiceDate',
      label: 'Service Invoice Date',
      sortable: true,
      sortValue: (row) => new Date(row.serviceInvoiceDate).getTime(),
      render: (value) => formatDate(value),
    },
    { key: 'tinNumber', label: 'TIN Number', sortable: true },
    {
      key: 'billingAddress',
      label: 'Billing Address',
      sortable: true,
      render: (value) => <div className="max-w-[260px] whitespace-normal leading-6 text-slate-200">{value}</div>,
    },
    { key: 'taxClassification', label: 'Tax Classification', sortable: true },
  ], []);

  const salesColumns = useMemo(() => [
    { key: 'orderLabel', label: 'Order', sortable: true },
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      sortValue: (row) => new Date(row.date).getTime(),
      render: (value) => formatDate(value),
    },
    ...(!isCustomerAudience ? [{
      key: 'clientName',
      label: 'Client',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-white">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{row.clientEmail}</p>
        </div>
      ),
    }] : []),
    {
      key: 'productName',
      label: 'Product',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-white">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{row.productType} • {row.dealSubType}</p>
        </div>
      ),
    },
    {
      key: 'dealType',
      label: 'Deal',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-white">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{row.dealSubType}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      sortValue: (row) => row.amount,
      render: (value) => formatCurrency(value),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => <StatusBadge status={value} />,
    },
  ], [isCustomerAudience]);

  const serviceColumns = useMemo(() => [
    { key: 'serviceName', label: 'Service', sortable: true },
    ...(!isCustomerAudience ? [{ key: 'clientName', label: 'Client', sortable: true }] : []),
    { key: 'productType', label: 'Product Type', sortable: true },
    {
      key: 'lifecycleStatus',
      label: 'Lifecycle',
      sortable: true,
      render: (value) => renderToneBadge(value),
    },
    {
      key: 'status',
      label: 'Service Status',
      sortable: true,
      render: (value) => <StatusBadge status={value} />,
    },
    {
      key: 'renewsOn',
      label: 'Renews On',
      sortable: true,
      sortValue: (row) => new Date(row.renewsOn ?? row.recordedAt).getTime(),
      render: (value) => formatDate(value),
    },
    {
      key: 'daysUntilRenewal',
      label: 'Days Left',
      sortable: true,
      sortValue: (row) => row.daysUntilRenewal ?? Number.MAX_SAFE_INTEGER,
      render: (value) => (value === null || value === undefined ? '—' : value),
    },
  ], [isCustomerAudience]);

  const renewalColumns = useMemo(() => [
    { key: 'serviceName', label: 'Service', sortable: true },
    ...(!isCustomerAudience ? [{ key: 'clientName', label: 'Client', sortable: true }] : []),
    { key: 'productType', label: 'Product Type', sortable: true },
    {
      key: 'renewsOn',
      label: 'Renews On',
      sortable: true,
      sortValue: (row) => new Date(row.renewsOn).getTime(),
      render: (value) => formatDate(value),
    },
    {
      key: 'daysUntilRenewal',
      label: 'Days Remaining',
      sortable: true,
      sortValue: (row) => row.daysUntilRenewal ?? Number.MAX_SAFE_INTEGER,
    },
  ], [isCustomerAudience]);

  const receivableColumns = useMemo(() => [
    { key: 'invoiceNumber', label: 'Invoice', sortable: true },
    { key: 'orderLabel', label: 'Order', sortable: true },
    ...(!isCustomerAudience ? [{ key: 'clientName', label: 'Client', sortable: true }] : []),
    { key: 'productName', label: 'Product', sortable: true },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      sortValue: (row) => row.amount,
      render: (value) => formatCurrency(value),
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      sortable: true,
      sortValue: (row) => new Date(row.dueDate).getTime(),
      render: (value) => formatDate(value),
    },
    {
      key: 'paymentState',
      label: 'Status',
      sortable: true,
      render: (_, row) => <StatusBadge status={row.isPaid ? 'Paid' : 'Unpaid'} />,
    },
    {
      key: 'paymentTiming',
      label: 'Timing',
      sortable: true,
      render: (value) => renderToneBadge(value),
    },
  ], [isCustomerAudience]);

  const taxColumns = useMemo(() => [
    { key: 'period', label: 'Period', sortable: true },
    {
      key: 'grossSales',
      label: 'Gross Sales',
      sortable: true,
      sortValue: (row) => row.grossSales,
      render: (value) => formatCurrency(value),
    },
    {
      key: 'taxDue',
      label: 'Tax Due',
      sortable: true,
      sortValue: (row) => row.taxDue,
      render: (value) => formatCurrency(value),
    },
    {
      key: 'netRevenue',
      label: 'Net Revenue',
      sortable: true,
      sortValue: (row) => row.netRevenue,
      render: (value) => formatCurrency(value),
    },
    {
      key: 'receivables',
      label: 'Receivables',
      sortable: true,
      sortValue: (row) => row.receivables,
      render: (value) => formatCurrency(value),
    },
  ], []);

  useEffect(() => {
    setTablePages(INITIAL_TABLE_PAGES);
  }, [filters.searchTerm, filters.reportMonth, filters.startDate, filters.endDate, filters.minAmount, filters.maxAmount, filters.productType, filters.dealType, filters.reportFocus]);

  const tableTotalPages = useMemo(() => ({
    collections: Math.max(1, Math.ceil(reportData.monthlyCollectionRows.length / REPORT_TABLE_PAGE_SIZE)),
    sales: Math.max(1, Math.ceil(reportData.filteredSalesRows.length / REPORT_TABLE_PAGE_SIZE)),
    services: Math.max(1, Math.ceil(reportData.filteredServiceRows.length / REPORT_TABLE_PAGE_SIZE)),
    renewals: Math.max(1, Math.ceil(reportData.upcomingRenewalRows.length / REPORT_TABLE_PAGE_SIZE)),
    receivables: Math.max(1, Math.ceil(reportData.filteredSalesRows.length / REPORT_TABLE_PAGE_SIZE)),
    tax: Math.max(1, Math.ceil(reportData.taxRows.length / REPORT_TABLE_PAGE_SIZE)),
  }), [
    reportData.monthlyCollectionRows.length,
    reportData.filteredSalesRows.length,
    reportData.filteredServiceRows.length,
    reportData.upcomingRenewalRows.length,
    reportData.taxRows.length,
  ]);

  useEffect(() => {
    setTablePages((current) => ({
      collections: Math.min(Math.max(current.collections, 1), tableTotalPages.collections),
      sales: Math.min(Math.max(current.sales, 1), tableTotalPages.sales),
      services: Math.min(Math.max(current.services, 1), tableTotalPages.services),
      renewals: Math.min(Math.max(current.renewals, 1), tableTotalPages.renewals),
      receivables: Math.min(Math.max(current.receivables, 1), tableTotalPages.receivables),
      tax: Math.min(Math.max(current.tax, 1), tableTotalPages.tax),
    }));
  }, [tableTotalPages]);

  const setReportTablePage = (tableKey, page) => {
    setTablePages((current) => ({ ...current, [tableKey]: page }));
  };

  const handleReportFocusChange = (value) => {
    const nextFocus = normalizeReportFocus(value);

    setFilters((current) => (
      current.reportFocus === nextFocus
        ? current
        : { ...current, reportFocus: nextFocus }
    ));

    const nextPath = buildReportFocusPath(nextFocus, pageConfig.basePath);
    const currentPath = buildReportFocusPath(routeReportFocus, pageConfig.basePath);

    if (nextPath !== currentPath) {
      navigate(nextPath);
    }
  };

  const setFilter = (key, value) => {
    if (key === 'reportFocus') {
      handleReportFocusChange(value);
      return;
    }

    setFilters((current) => ({ ...current, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ ...DEFAULT_REPORT_FILTERS, reportFocus: routeReportFocus });
    setFeedback({
      tone: 'info',
      message: routeReportFocus === DEFAULT_REPORT_FILTERS.reportFocus
        ? 'Filters reset to the full report view.'
        : `Filters reset for the ${REPORT_FOCUS_OPTIONS.find((option) => option.value === routeReportFocus)?.label ?? 'current'} page.`,
    });
  };

  const applyTemplate = (template) => {
    const nextFocus = normalizeReportFocus(template.filters?.reportFocus);

    if (!isCustomerAudience && hasReportColumnVisibilitySnapshot(template.columnVisibility)) {
      applyReportColumnVisibilitySnapshot(template.columnVisibility);
      setColumnVisibilitySyncKey((current) => current + 1);
    }

    setFilters({ ...DEFAULT_REPORT_FILTERS, ...(template.filters ?? {}), reportFocus: nextFocus });
    setTemplateName(template.name);
    setTemplateVisibility(template.visibility ?? 'own');
    if (nextFocus !== routeReportFocus) {
      navigate(buildReportFocusPath(nextFocus, pageConfig.basePath));
    }
    setFeedback({ tone: 'success', message: `Applied template: ${template.name}` });
  };

  const handleSaveTemplate = () => {
    const normalizedName = templateName.trim();

    if (!normalizedName) {
      setFeedback({ tone: 'error', message: 'Enter a template name before saving the current report search.' });
      return;
    }

    const timestamp = new Date().toISOString();
    const existingTemplate = savedTemplates.find((template) => template.name.trim().toLowerCase() === normalizedName.toLowerCase());

    if (existingTemplate) {
      const updatedTemplate = {
        ...existingTemplate,
        name: normalizedName,
        visibility: templateVisibility,
        filters,
        columnVisibility: isCustomerAudience ? undefined : readReportColumnVisibilitySnapshot(),
        updatedAt: timestamp,
      };

      setSavedTemplates((current) => [
        updatedTemplate,
        ...current.filter((template) => template.id !== existingTemplate.id),
      ]);
      setFeedback({ tone: 'success', message: `Updated ${normalizedName} with the latest report filters.` });
      setTemplateName('');
      return;
    }

    const template = {
      id: buildTemplateId(),
      name: normalizedName,
      visibility: templateVisibility,
      filters,
      columnVisibility: isCustomerAudience ? undefined : readReportColumnVisibilitySnapshot(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    setSavedTemplates((current) => [template, ...current]);
    setFeedback({ tone: 'success', message: `Saved ${normalizedName} as a ${templateVisibility} report template.` });
    setTemplateName('');
  };

  const toggleTemplateVisibility = (templateId, visibility) => {
    setSavedTemplates((current) => current.map((template) => (
      template.id === templateId
        ? { ...template, visibility, updatedAt: new Date().toISOString() }
        : template
    )));
    setFeedback({ tone: 'success', message: `Template visibility updated to ${visibility}.` });
  };

  const deleteTemplate = (templateId) => {
    setSavedTemplates((current) => current.filter((template) => template.id !== templateId));
    setFeedback({ tone: 'info', message: 'Report template removed.' });
  };

  const exportPdf = () => {
    const title = REPORT_FOCUS_OPTIONS.find((option) => option.value === filters.reportFocus)?.label ?? 'All Reports';
    const generatedAt = formatDateTime(new Date());
    const document = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
    const pageWidth = document.internal.pageSize.getWidth();
    const pageHeight = document.internal.pageSize.getHeight();
    const margin = 32;
    const bottomMargin = 28;
    const maxWidth = pageWidth - margin * 2;
    const palette = {
      ink: [15, 23, 42],
      muted: [100, 116, 139],
      line: [203, 213, 225],
      brand: [15, 23, 42],
      brandAccent: [21, 94, 117],
      white: [255, 255, 255],
      surface: [248, 250, 252],
    };
    let cursorY = margin;

    const setDocumentFont = (size = 10, weight = 'normal', color = palette.ink) => {
      document.setFont('helvetica', weight);
      document.setFontSize(size);
      document.setTextColor(...color);
    };

    const splitLines = (text, width, size = 10, weight = 'normal') => {
      setDocumentFont(size, weight);
      return document.splitTextToSize(normalizeExportText(text), Math.max(width, 24));
    };

    const startNewPage = () => {
      document.addPage();
      cursorY = margin;
    };

    const ensureSpace = (height = 18) => {
      if (cursorY + height > pageHeight - bottomMargin) {
        startNewPage();
      }
    };

    const drawMetricCards = (rows) => {
      if (!rows.length) {
        return;
      }

      const gap = 10;
      const cardWidth = (maxWidth - gap * (rows.length - 1)) / rows.length;
      const cardHeight = 58;

      ensureSpace(cardHeight + 10);

      rows.forEach(([label, value], index) => {
        const x = margin + index * (cardWidth + gap);

        document.setDrawColor(...palette.line);
        document.setFillColor(...palette.white);
        document.roundedRect(x, cursorY, cardWidth, cardHeight, 14, 14, 'FD');

        setDocumentFont(8, 'bold', palette.muted);
        document.text(document.splitTextToSize(normalizeExportText(label).toUpperCase(), cardWidth - 20), x + 12, cursorY + 18);

        setDocumentFont(14, 'bold', palette.ink);
        document.text(document.splitTextToSize(normalizeExportText(value), cardWidth - 20), x + 12, cursorY + 39);
      });

      cursorY += cardHeight + 18;
    };

    const drawTableBlock = ({
      title: blockTitle,
      description,
      columns,
      rows,
      emptyMessage = 'No records found.',
    }) => {
      const titleLines = splitLines(blockTitle, maxWidth, 12, 'bold');
      const descriptionLines = description ? splitLines(description, maxWidth, 9, 'normal') : [];
      const sampleRows = rows.slice(0, 6);
      const weights = columns.map((column, columnIndex) => {
        const headerLength = normalizeExportText(column).length;
        const sampleLength = sampleRows.reduce((largest, row) => Math.max(largest, normalizeExportText(row[columnIndex]).length), headerLength);

        return Math.min(Math.max(sampleLength, 10), 28);
      });
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      const columnWidths = weights.map((weight, columnIndex) => {
        if (columnIndex === weights.length - 1) {
          return maxWidth - weights.slice(0, -1).reduce((sum, item) => sum + ((item / totalWeight) * maxWidth), 0);
        }

        return (weight / totalWeight) * maxWidth;
      });
      const headerLineSets = columns.map((column, columnIndex) => splitLines(column, columnWidths[columnIndex] - 10, 8.5, 'bold'));
      const headerHeight = Math.max(...headerLineSets.map((lines) => lines.length || 1), 1) * 10 + 10;

      ensureSpace(titleLines.length * 14 + descriptionLines.length * 11 + headerHeight + 20);

      setDocumentFont(12, 'bold', palette.ink);
      document.text(titleLines, margin, cursorY);
      cursorY += titleLines.length * 14;

      if (descriptionLines.length) {
        setDocumentFont(9, 'normal', palette.muted);
        document.text(descriptionLines, margin, cursorY);
        cursorY += descriptionLines.length * 11 + 8;
      } else {
        cursorY += 6;
      }

      const drawHeaderRow = (continuedLabel = '') => {
        if (continuedLabel) {
          setDocumentFont(9, 'bold', palette.muted);
          document.text(normalizeExportText(continuedLabel), margin, cursorY);
          cursorY += 14;
        }

        let x = margin;

        columns.forEach((column, columnIndex) => {
          document.setDrawColor(...palette.line);
          document.setFillColor(...palette.brandAccent);
          document.rect(x, cursorY, columnWidths[columnIndex], headerHeight, 'FD');
          setDocumentFont(8.5, 'bold', palette.white);
          document.text(headerLineSets[columnIndex], x + 5, cursorY + 13);
          x += columnWidths[columnIndex];
        });

        cursorY += headerHeight;
      };

      drawHeaderRow();

      if (!rows.length) {
        ensureSpace(30);
        document.setDrawColor(...palette.line);
        document.setFillColor(...palette.surface);
        document.rect(margin, cursorY, maxWidth, 30, 'FD');
        setDocumentFont(9, 'normal', palette.muted);
        document.text(normalizeExportText(emptyMessage), margin + 8, cursorY + 19);
        cursorY += 44;
        return;
      }

      rows.forEach((row, rowIndex) => {
        const cellLineSets = row.map((value, columnIndex) => splitLines(value, columnWidths[columnIndex] - 10, 8.5, 'normal'));
        const rowHeight = Math.max(...cellLineSets.map((lines) => lines.length || 1), 1) * 10 + 10;

        if (cursorY + rowHeight > pageHeight - bottomMargin) {
          startNewPage();
          drawHeaderRow(`${blockTitle} (continued)`);
        }

        let x = margin;

        row.forEach((_, columnIndex) => {
          document.setDrawColor(...palette.line);
          document.setFillColor(...(rowIndex % 2 === 0 ? palette.white : palette.surface));
          document.rect(x, cursorY, columnWidths[columnIndex], rowHeight, 'FD');
          setDocumentFont(8.5, 'normal', palette.ink);
          document.text(cellLineSets[columnIndex], x + 5, cursorY + 13);
          x += columnWidths[columnIndex];
        });

        cursorY += rowHeight;
      });

      cursorY += 18;
    };

    const heroHeight = 88;

    ensureSpace(heroHeight + 8);
    document.setFillColor(...palette.brand);
    document.roundedRect(margin, cursorY, maxWidth, heroHeight, 18, 18, 'F');

    setDocumentFont(10, 'bold', [186, 230, 253]);
    document.text('WSI REPORT EXPORT', margin + 20, cursorY + 22);

    setDocumentFont(20, 'bold', palette.white);
    document.text(normalizeExportText(pageConfig.exportTitle), margin + 20, cursorY + 46);

    setDocumentFont(11, 'normal', [219, 234, 254]);
    document.text(normalizeExportText(`${title} report`), margin + 20, cursorY + 66);
    document.text(normalizeExportText(`Generated ${generatedAt}`), pageWidth - margin - 20, cursorY + 28, { align: 'right' });
    document.text(normalizeExportText(`${exportSections.length} export section${exportSections.length === 1 ? '' : 's'}`), pageWidth - margin - 20, cursorY + 46, { align: 'right' });
    document.text(normalizeExportText(`${filterSummaryRows.length} filters in scope`), pageWidth - margin - 20, cursorY + 64, { align: 'right' });
    cursorY += heroHeight + 16;

    drawMetricCards(summaryRows.slice(0, 4));
    drawTableBlock({
      title: 'Filters',
      description: 'Current filter values used when this report was exported.',
      columns: ['Filter', 'Value'],
      rows: filterSummaryRows,
      emptyMessage: 'No filters were applied.',
    });
    drawTableBlock({
      title: 'Summary',
      description: 'Headline metrics for the selected report scope.',
      columns: ['Metric', 'Value'],
      rows: summaryRows,
      emptyMessage: 'No summary metrics are available.',
    });
    exportSections.forEach((section) => {
      drawTableBlock(section);
    });

    const totalPages = document.getNumberOfPages();

    for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
      document.setPage(pageIndex);
      document.setDrawColor(...palette.line);
      document.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);
      setDocumentFont(8.5, 'normal', palette.muted);
      document.text(normalizeExportText(pageConfig.exportTitle), margin, pageHeight - 6);
      document.text(`Page ${pageIndex} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
    }

    document.save(`${pageConfig.filenamePrefix}-${filters.reportFocus}-report.pdf`);
    setFeedback({ tone: 'success', message: `PDF export generated for the current ${pageConfig.feedbackDatasetLabel} report view.` });
  };

  const exportExcel = () => {
    const title = REPORT_FOCUS_OPTIONS.find((option) => option.value === filters.reportFocus)?.label ?? 'All Reports';
    const generatedAt = formatDateTime(new Date());
    const html = buildWorkbookHtml({
      title: `${pageConfig.exportTitle} - ${title}`,
      generatedAt,
      filters: filterSummaryRows,
      summaryRows,
      sections: exportSections,
    });
    const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8;' });

    downloadBlob(blob, `${pageConfig.filenamePrefix}-${filters.reportFocus}-report.xls`);
    setFeedback({ tone: 'success', message: `Excel export generated for the current ${pageConfig.feedbackDatasetLabel} report view.` });
  };

  const sortedTemplates = useMemo(
    () => [...savedTemplates].sort((left, right) => new Date(right.updatedAt ?? right.createdAt).getTime() - new Date(left.updatedAt ?? left.createdAt).getTime()),
    [savedTemplates],
  );

  const templateStats = useMemo(() => ({
    total: sortedTemplates.length,
    publicCount: sortedTemplates.filter((template) => template.visibility === 'public').length,
    ownCount: sortedTemplates.filter((template) => template.visibility !== 'public').length,
  }), [sortedTemplates]);

  const selectedFocusLabel = REPORT_FOCUS_OPTIONS.find((option) => option.value === filters.reportFocus)?.label ?? 'All Reports';
  const isOverviewPage = filters.reportFocus === DEFAULT_REPORT_FILTERS.reportFocus;

  const activeFilters = useMemo(() => {
    const items = [];

    if (filters.reportFocus !== DEFAULT_REPORT_FILTERS.reportFocus) {
      items.push({ key: 'reportFocus', label: 'Report', value: selectedFocusLabel });
    }

    if (filters.reportMonth) {
      items.push({
        key: 'reportMonth',
        label: 'Collection Month',
        value: reportData.collectionMonthOptions.find((option) => option.value === filters.reportMonth)?.label ?? filters.reportMonth,
      });
    }

    if (filters.searchTerm.trim()) {
      items.push({ key: 'searchTerm', label: 'Search', value: filters.searchTerm.trim() });
    }

    if (filters.startDate) {
      items.push({ key: 'startDate', label: 'From', value: formatDate(filters.startDate) });
    }

    if (filters.endDate) {
      items.push({ key: 'endDate', label: 'To', value: formatDate(filters.endDate) });
    }

    if (filters.minAmount) {
      items.push({ key: 'minAmount', label: 'Minimum', value: formatCurrency(Number(filters.minAmount)) });
    }

    if (filters.maxAmount) {
      items.push({ key: 'maxAmount', label: 'Maximum', value: formatCurrency(Number(filters.maxAmount)) });
    }

    if (filters.productType !== DEFAULT_REPORT_FILTERS.productType) {
      items.push({ key: 'productType', label: 'Product', value: filters.productType });
    }

    if (filters.dealType !== DEFAULT_REPORT_FILTERS.dealType) {
      items.push({ key: 'dealType', label: 'Deal', value: filters.dealType });
    }

    return items;
  }, [filters, reportData.collectionMonthOptions, selectedFocusLabel]);

  const focusCards = useMemo(() => [
    {
      value: 'all',
      label: 'All Reports',
      helper: pageConfig.focusOverviewHelper,
      metric: `${formatCompactNumber(reportData.filteredSalesRows.length + reportData.filteredServiceRows.length)} rows`,
      ...REPORT_FOCUS_META.all,
    },
    {
      value: 'sales',
      label: 'Sales',
      helper: `${reportData.summary.filteredDeals} deals in the current revenue view.`,
      metric: formatCompactCurrency(reportData.summary.filteredRevenue),
      ...REPORT_FOCUS_META.sales,
    },
    {
      value: 'services',
      label: isCustomerAudience ? 'Renewals & Services' : 'Service Lifecycle',
      helper: isCustomerAudience
        ? `${formatPercent(reportData.summary.renewalRate)} renewal • ${formatPercent(reportData.summary.cancellationRate)} cancellation`
        : `${reportData.summary.pendingServices} pending • ${reportData.summary.cancelledServices} cancelled`,
      metric: `${formatCompactNumber(reportData.summary.activeServices)} active`,
      ...REPORT_FOCUS_META.services,
    },
    {
      value: 'receivables',
      label: isCustomerAudience ? 'Invoices & Payments' : 'Receivables',
      helper: isCustomerAudience
        ? `${reportData.summary.openInvoices} open • ${reportData.summary.overdueInvoices} aging`
        : `${reportData.summary.overdueInvoices} overdue • ${reportData.summary.unpaidInvoices} unpaid`,
      metric: formatCompactCurrency(reportData.summary.unpaidAmount),
      ...REPORT_FOCUS_META.receivables,
    },
    {
      value: 'tax',
      label: 'Tax & Accounting',
      helper: `${reportData.taxRows.length} accounting period${reportData.taxRows.length === 1 ? '' : 's'} in scope`,
      metric: formatCompactCurrency(reportData.summary.taxDue),
      ...REPORT_FOCUS_META.tax,
    },
  ], [isCustomerAudience, pageConfig.focusOverviewHelper, reportData.filteredSalesRows.length, reportData.filteredServiceRows.length, reportData.summary, reportData.taxRows.length]);

  const reportGraph = useMemo(() => {
    if (filters.reportFocus === 'services') {
      return {
        title: 'Service Lifecycle Bar Graph',
        description: 'Compare active, pending, cancelled, and upcoming renewal counts in the current service report.',
        valueFormatter: formatCompactNumber,
        axisLabel: 'Services',
        items: [
          { label: 'Active Services', value: reportData.summary.activeServices, helper: 'Running subscriptions in scope.' },
          { label: 'Pending Services', value: reportData.summary.pendingServices, helper: 'Provisioning or under review.' },
          { label: 'Cancelled Services', value: reportData.summary.cancelledServices, helper: 'No longer active.' },
          { label: 'Upcoming Renewals', value: reportData.summary.upcomingRenewals, helper: 'Renew within the next 30 days.' },
        ],
        emptyMessage: 'No service lifecycle rows are available for the current filters.',
      };
    }

    if (filters.reportFocus === 'receivables') {
      return {
        title: isCustomerAudience ? 'Open/Aging Invoice Bar Graph' : 'Receivables Bar Graph',
        description: isCustomerAudience
          ? 'Track open invoices, aging invoices, and on-time versus late payments across the current receivables report.'
          : 'Track invoice timing and payment pressure across the current receivables report.',
        valueFormatter: formatCompactNumber,
        axisLabel: 'Invoices',
        items: isCustomerAudience
          ? [
            { label: 'Open Invoices', value: reportData.summary.openInvoices, helper: 'Unpaid but not yet overdue.' },
            { label: 'Aging Invoices', value: reportData.summary.overdueInvoices, helper: 'Past due and needing follow-up.' },
            { label: 'On-Time Payments', value: reportData.summary.onTimePayments, helper: 'Cleared on or before due date.' },
            { label: 'Late Payments', value: reportData.summary.latePayments, helper: 'Paid after the due date.' },
          ]
          : [
            { label: 'On-Time Payments', value: reportData.summary.onTimePayments, helper: 'Cleared on or before due date.' },
            { label: 'Late Payments', value: reportData.summary.latePayments, helper: 'Paid after the due date.' },
            { label: 'Unpaid Invoices', value: reportData.summary.unpaidInvoices, helper: 'Still outstanding.' },
            { label: 'Overdue Invoices', value: reportData.summary.overdueInvoices, helper: 'Requires follow-up.' },
          ],
        emptyMessage: 'No receivable records are available for the current filters.',
      };
    }

    if (filters.reportFocus === 'tax') {
      return {
        title: 'Gross Sales by Period',
        description: 'Recent accounting periods by gross paid sales inside the current tax report.',
        valueFormatter: formatCompactCurrency,
        axisLabel: 'Gross Sales',
        items: reportData.taxRows.slice(-6).map((row) => ({
          label: row.period,
          value: row.grossSales,
          helper: `Tax due ${formatCompactCurrency(row.taxDue)}`,
        })),
        emptyMessage: 'No accounting periods are available for the current tax filters.',
      };
    }

    const revenueByProductType = [...reportData.filteredSalesRows.reduce((collection, row) => {
      const key = row.productType || 'Uncategorized';
      const entry = collection.get(key) ?? { label: key, value: 0, deals: 0 };
      entry.value += row.amount;
      entry.deals += 1;
      collection.set(key, entry);
      return collection;
    }, new Map()).values()]
      .sort((left, right) => right.value - left.value)
      .slice(0, 6)
      .map((item) => ({
        label: item.label,
        value: item.value,
        helper: `${item.deals} deal${item.deals === 1 ? '' : 's'} in the current view.`,
      }));

    return {
      title: filters.reportFocus === 'sales' ? 'Revenue by Product Type' : 'Top Revenue Mix',
      description: filters.reportFocus === 'sales'
        ? 'Compare the strongest product categories inside the filtered sales report.'
        : pageConfig.overviewGraphDescription,
      valueFormatter: formatCompactCurrency,
      axisLabel: 'Revenue',
      items: revenueByProductType,
      emptyMessage: 'No sales data is available to draw a revenue bar graph for the current filters.',
    };
  }, [filters.reportFocus, isCustomerAudience, pageConfig.overviewGraphDescription, reportData.filteredSalesRows, reportData.summary, reportData.taxRows]);

  const clearSingleFilter = (key) => {
    setFilter(key, DEFAULT_REPORT_FILTERS[key]);
  };

  const applyQuickRange = (preset) => {
    const range = getQuickRangeDates(preset);

    if (!range) {
      return;
    }

    setFilters((current) => ({
      ...current,
      startDate: range.startDate,
      endDate: range.endDate,
    }));
    setFeedback({ tone: 'info', message: `${range.label} applied to the current report.` });
  };

  const isQuickRangeActive = (preset) => {
    const range = getQuickRangeDates(preset);

    return Boolean(range) && filters.startDate === range.startDate && filters.endDate === range.endDate;
  };

  const toggleWorkspacePanel = (panelKey) => {
    setActiveWorkspacePanel((current) => (current === panelKey ? null : panelKey));
  };

  const headerAction = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={exportPdf}
        className="btn-secondary inline-flex items-center gap-2 px-4 py-2"
      >
        <FileText size={16} />
        Export PDF
      </button>
      <button
        type="button"
        onClick={exportExcel}
        className="btn-primary inline-flex items-center gap-2 px-4 py-2"
      >
        <FileSpreadsheet size={16} />
        Export Excel
      </button>
    </div>
  );

  const buildSectionAction = (focusValue, label) => {
    if (filters.reportFocus === DEFAULT_REPORT_FILTERS.reportFocus) {
      return (
        <Link
          to={buildReportFocusPath(focusValue, pageConfig.basePath)}
          className="btn-secondary inline-flex items-center gap-2 px-4 py-2"
        >
          <BarChart3 size={16} />
          Open {label} Page
        </Link>
      );
    }

    if (filters.reportFocus === focusValue) {
      return (
        <Link
          to={buildReportFocusPath(DEFAULT_REPORT_FILTERS.reportFocus, pageConfig.basePath)}
          className="btn-secondary inline-flex items-center gap-2 px-4 py-2"
        >
          <BarChart3 size={16} />
          Back to Overview
        </Link>
      );
    }

    return null;
  };

  const collectionSectionAction = !isCustomerAudience ? (
    <div className="flex flex-wrap items-end gap-3">
      <label className="block min-w-[220px] text-left text-sm text-slate-300">
        <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-slate-500">Collection Month</span>
        <input
          type="month"
          value={filters.reportMonth}
          onChange={(event) => setFilter('reportMonth', event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-200 outline-none"
        />
        <p className="mt-2 text-xs text-slate-500">
          {filters.reportMonth
            ? 'Using the selected month for the admin collection summary.'
            : `Showing the latest paid month: ${reportData.selectedCollectionMonthLabel}.`}
        </p>
      </label>

      {filters.reportMonth ? (
        <button
          type="button"
          onClick={() => setFilter('reportMonth', '')}
          className="btn-secondary inline-flex items-center gap-2 px-4 py-2"
        >
          <CalendarRange size={16} />
          Use Latest Month
        </button>
      ) : null}
    </div>
  ) : null;

  const showCollections = !isCustomerAudience && filters.reportFocus !== 'services';
  const showSales = filters.reportFocus === 'all' || filters.reportFocus === 'sales';
  const showServices = filters.reportFocus === 'all' || filters.reportFocus === 'services';
  const showReceivables = filters.reportFocus === 'all' || filters.reportFocus === 'receivables';
  const showTax = filters.reportFocus === 'all' || filters.reportFocus === 'tax';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports Center"
        title={pageConfig.title}
        description={pageConfig.description}
        action={headerAction}
      />

      {feedback ? (
        <div className={`inline-flex max-w-3xl items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${feedbackClasses[feedback.tone] ?? feedbackClasses.info}`}>
          <BarChart3 size={16} />
          <span className="flex-1">{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-current/80 transition hover:bg-white/10 hover:text-current"
            aria-label="Dismiss report feedback"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {focusCards.map((card) => (
          <FocusCard
            key={card.value}
            icon={card.icon}
            label={card.label}
            helper={card.helper}
            metric={card.metric}
            tone={card.tone}
            active={filters.reportFocus === card.value}
            onClick={() => handleReportFocusChange(card.value)}
          />
        ))}
      </div>

      <div className="panel p-5 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-white">Report Workspace</h2>
            </div>


          <button
            type="button"
            onClick={clearFilters}
            className="btn-secondary inline-flex items-center gap-2 px-4 py-2"
          >
            <Eraser size={16} />
            Clear Filters
          </button>
        </div>

        {activeFilters.length ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {activeFilters.map((filterItem) => (
              <FilterChip
                key={filterItem.key}
                label={filterItem.label}
                value={filterItem.value}
                onClear={() => clearSingleFilter(filterItem.key)}
              />
            ))}
          </div>
        ) : null}

        <div className="mt-5">
          <label className="block text-sm text-slate-300">
            <span className="mb-2 block">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="text"
                value={filters.searchTerm}
                onChange={(event) => setFilter('searchTerm', event.target.value)}
                placeholder="Search client, product, invoice, status, or service"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.02] py-3 pl-10 pr-4 text-sm text-slate-200 outline-none"
              />
            </div>
          </label>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Quick Date Ranges</p>
          <div className="mt-3 overflow-x-auto pb-2">
            <div className="flex min-w-max flex-nowrap items-center gap-2 pr-1">
              {QUICK_RANGE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => applyQuickRange(preset.value)}
                  className={`inline-flex min-w-[160px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm transition ${
                    isQuickRangeActive(preset.value)
                      ? 'border-sky-300/25 bg-sky-400/12 text-sky-100'
                      : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  <CalendarRange size={15} />
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => toggleWorkspacePanel('filters')}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                  activeWorkspacePanel === 'filters'
                    ? 'border-sky-300/25 bg-sky-400/12 text-sky-100'
                    : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <SlidersHorizontal size={15} />
                {activeWorkspacePanel === 'filters' ? 'Hide Filters' : 'Open Filters'}
                <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.14em] text-slate-200">
                  {activeFilters.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => toggleWorkspacePanel('templates')}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                  activeWorkspacePanel === 'templates'
                    ? 'border-sky-300/25 bg-sky-400/12 text-sky-100'
                    : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <Save size={15} />
                {activeWorkspacePanel === 'templates' ? 'Hide Templates' : 'Manage Templates'}
                <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.14em] text-slate-200">
                  {templateStats.total}
                </span>
              </button>
            </div>
          </div>
          <div className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-500">
            {activeWorkspacePanel === 'filters'
              ? 'Advanced filter controls are open.'
              : activeWorkspacePanel === 'templates'
                ? 'Template tools are open.'
                : ''}
          </div>
        </div>

        {activeWorkspacePanel === 'filters' ? (
          <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-white">Advanced Filters</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">Refine the current report without leaving this page, then collapse the panel again once the table is in the right state.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Export Payload</p>
                <p className="mt-2 text-lg font-semibold text-white">{exportSections.length}</p>
                <p className="mt-1 text-xs text-slate-400">Sections included in export</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Report</span>
                <select
                  value={filters.reportFocus}
                  onChange={(event) => handleReportFocusChange(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-200 outline-none"
                >
                  {REPORT_FOCUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              {!isCustomerAudience ? (
                <label className="block text-sm text-slate-300">
                  <span className="mb-2 block">Collection Month</span>
                  <input
                    type="month"
                    value={filters.reportMonth}
                    onChange={(event) => setFilter('reportMonth', event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-200 outline-none"
                  />
                  <p className="mt-2 text-xs text-slate-500">Leave blank to keep the collection summary on the latest paid month.</p>
                </label>
              ) : null}

              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Start Date</span>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(event) => setFilter('startDate', event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-200 outline-none"
                />
              </label>

              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">End Date</span>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(event) => setFilter('endDate', event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-200 outline-none"
                />
              </label>

              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Minimum Amount</span>
                <input
                  type="number"
                  min="0"
                  value={filters.minAmount}
                  onChange={(event) => setFilter('minAmount', event.target.value)}
                  placeholder="0"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-200 outline-none"
                />
              </label>

              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Maximum Amount</span>
                <input
                  type="number"
                  min="0"
                  value={filters.maxAmount}
                  onChange={(event) => setFilter('maxAmount', event.target.value)}
                  placeholder="Any"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-200 outline-none"
                />
              </label>

              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Product Type</span>
                <select
                  value={filters.productType}
                  onChange={(event) => setFilter('productType', event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-200 outline-none"
                >
                  {reportData.productTypeOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Deal Type</span>
                <select
                  value={filters.dealType}
                  onChange={(event) => setFilter('dealType', event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-200 outline-none"
                >
                  {reportData.dealTypeOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>

          </div>
        ) : null}

        {activeWorkspacePanel === 'templates' ? (
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-sky-200">
                    <Save size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">Template Studio</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-400">Save the current report search and share it as own or public.</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Templates</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{templateStats.total}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Own</p>
                  <p className="mt-2 text-lg font-semibold text-white">{templateStats.ownCount}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Public</p>
                  <p className="mt-2 text-lg font-semibold text-white">{templateStats.publicCount}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Focus</p>
                  <p className="mt-2 text-lg font-semibold text-white">{selectedFocusLabel}</p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <label className="block text-sm text-slate-300">
                  <span className="mb-2 block">Template Name</span>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(event) => setTemplateName(event.target.value)}
                    placeholder="Monthly collections, Q2 renewals, overdue invoices"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-200 outline-none"
                  />
                </label>

                <label className="block text-sm text-slate-300">
                  <span className="mb-2 block">Visibility</span>
                  <select
                    value={templateVisibility}
                    onChange={(event) => setTemplateVisibility(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-200 outline-none"
                  >
                    {REPORT_VISIBILITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  className="btn-primary inline-flex w-full items-center justify-center gap-2 px-4 py-3"
                >
                  <Save size={16} />
                  Save Current Search
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-white">Saved Templates</h3>
                  <p className="mt-1 text-sm text-slate-400">Apply, share, or delete reusable report presets.</p>
                </div>
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{templateStats.total} saved</span>
              </div>

              <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {sortedTemplates.length ? sortedTemplates.map((template) => (
                  <div key={template.id} className="rounded-3xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{template.name}</p>
                        <p className="mt-1 text-xs text-slate-400">Updated {formatDateTime(template.updatedAt || template.createdAt)}</p>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${toneClasses[template.visibility]}`}>
                        {template.visibility === 'public' ? 'Public' : 'Own'}
                      </span>
                    </div>

                    <p className="mt-3 text-xs leading-6 text-slate-400">{getTemplateSummary(template)}</p>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => applyTemplate(template)}
                        className="btn-secondary inline-flex items-center gap-2 px-3 py-2 text-xs"
                      >
                        <Download size={14} />
                        Apply
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleTemplateVisibility(template.id, template.visibility === 'public' ? 'own' : 'public')}
                        className="btn-secondary inline-flex items-center gap-2 px-3 py-2 text-xs"
                      >
                        {template.visibility === 'public' ? <Share2 size={14} /> : <Globe2 size={14} />}
                        {template.visibility === 'public' ? 'Set Own' : 'Set Public'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTemplate(template.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200 transition hover:bg-rose-400/15"
                      >
                        <Eraser size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-slate-400">
                    {pageConfig.emptyTemplatesMessage}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div>
        <ReportBarGraph
          title={reportGraph.title}
          description={reportGraph.description}
          items={reportGraph.items}
          valueFormatter={reportGraph.valueFormatter}
          emptyMessage={reportGraph.emptyMessage}
          axisLabel={reportGraph.axisLabel}
        />
      </div>

      {showCollections ? (
        <ReportSection
          icon={CalendarRange}
          title={reportData.selectedCollectionMonthKey ? `${reportData.selectedCollectionMonthLabel} Collection Summary` : 'Monthly Collection Summary'}
          description="Generate a month-ledger view for collected admin orders with billing owner, invoice, TIN, billing address, and tax classification details aligned with the finance reporting layout."
          hideMetricCard
          metricLabel="Total Records"
          metricValue={String(reportData.monthlyCollectionSummary.totalRecords)}
          metricHelper="Paid line-item rows in the selected collection month"
          miniStats={[
            { label: 'Total Records', value: formatCompactNumber(reportData.monthlyCollectionSummary.totalRecords), helper: 'Paid line-item rows in scope.', tone: 'sky' },
            { label: 'Sum of Amount', value: formatCurrency(reportData.monthlyCollectionSummary.totalAmount), helper: 'Line-item amount total.', tone: 'emerald' },
            { label: 'Sum of Total Amount Collected', value: formatCurrency(reportData.monthlyCollectionSummary.totalAmountCollected), helper: 'Distinct invoice totals for the month.', tone: 'amber' },
            { label: 'Sum of Collection Amount', value: formatCurrency(reportData.monthlyCollectionSummary.totalCollectionAmount), helper: 'Repeated order totals across the detail rows.', tone: 'slate' },
          ]}
          action={collectionSectionAction}
        >
          <PaginatedReportTable
            columns={collectionColumns}
            rows={reportData.monthlyCollectionRows}
            emptyMessage={reportData.collectionMonthOptions.length
              ? 'No paid collection rows match the selected collection month and current filters.'
              : 'No paid collection activity is available yet for admin reporting.'}
            currentPage={tablePages.collections}
            onPageChange={(page) => setReportTablePage('collections', page)}
            itemLabel="collection rows"
            enableAdminColumnVisibility
            columnVisibilityStorageKey="admin-reports-collections-table"
            compactColumnKeys={[
              'billingInCharge',
              'dealOwner',
              'clientName',
              'productCategory',
              'dealName',
              'dealType',
              'dealSubType',
              'collectionAmount',
              'amount',
              'invoiceNumber',
              'serviceInvoiceDate',
              'tinNumber',
              'billingAddress',
              'taxClassification',
            ]}
            columnVisibilitySyncKey={columnVisibilitySyncKey}
          />
        </ReportSection>
      ) : null}

      {showSales ? (
        <ReportSection
          icon={TrendingUp}
          title="Sales Reports"
          hideMetricCard
          metricLabel="Filtered Sales"
          metricValue={formatCurrency(reportData.summary.filteredRevenue)}
          metricHelper={`${reportData.summary.filteredDeals} deals in the current sales report scope.`}
          miniStats={[
            { label: 'Filtered Sales', value: formatCurrency(reportData.summary.filteredRevenue), helper: `${reportData.summary.filteredDeals} deals in the current sales report scope.`, tone: 'sky' },
            { label: 'Renewal Deals', value: formatCompactNumber(reportData.filteredSalesRows.filter((row) => row.dealSubType === 'Renewal').length), helper: 'Returning service renewals.', tone: 'emerald' },
            { label: 'New Client Deals', value: formatCompactNumber(reportData.filteredSalesRows.filter((row) => row.dealType === 'New Client').length), helper: 'Fresh customer acquisitions.', tone: 'amber' },
            { label: 'Existing Client Deals', value: formatCompactNumber(reportData.filteredSalesRows.filter((row) => row.dealType === 'Existing Client').length), helper: 'Upsells and repeat business.', tone: 'slate' },
          ]}
        >
          <PaginatedReportTable
            columns={salesColumns}
            rows={reportData.filteredSalesRows}
            emptyMessage="No sales records match the current report filters."
            currentPage={tablePages.sales}
            onPageChange={(page) => setReportTablePage('sales', page)}
            itemLabel="sales rows"
            enableAdminColumnVisibility={!isCustomerAudience}
            columnVisibilityStorageKey="admin-reports-sales-table"
            compactColumnKeys={['orderLabel', 'date', 'clientName', 'productName', 'amount', 'status']}
            columnVisibilitySyncKey={columnVisibilitySyncKey}
          />
        </ReportSection>
      ) : null}

      {showServices ? (
        <div className="space-y-6">
          <ReportSection
            icon={ShieldCheck}
            title={isCustomerAudience ? 'Renewal vs Cancellation Rate' : 'Service Lifecycle'}
            description={isCustomerAudience
              ? 'Track renewal versus cancellation rate while reviewing active, pending, and cancelled services in the same customer report.'
              : 'Track renewal versus cancellation rate, plus active, pending, and cancelled services under the same report view.'}
            hideMetricCard
            metricLabel={isCustomerAudience ? 'Renewal Rate' : 'Renewal Mix'}
            metricValue={formatPercent(reportData.summary.renewalRate)}
            metricHelper={`Cancellation rate ${formatPercent(reportData.summary.cancellationRate)}`}
            miniStats={[
              { label: isCustomerAudience ? 'Renewal Rate' : 'Renewal Mix', value: formatPercent(reportData.summary.renewalRate), helper: `Cancellation rate ${formatPercent(reportData.summary.cancellationRate)}`, tone: 'sky' },
              { label: 'Active Services', value: formatCompactNumber(reportData.summary.activeServices), helper: 'Running subscriptions.', tone: 'emerald' },
              { label: 'Pending Services', value: formatCompactNumber(reportData.summary.pendingServices), helper: 'Still moving through provisioning or review.', tone: 'amber' },
              { label: 'Cancelled Services', value: formatCompactNumber(reportData.summary.cancelledServices), helper: 'No longer in the active lifecycle.', tone: 'rose' },
            ]}
          >
            <PaginatedReportTable
              columns={serviceColumns}
              rows={reportData.filteredServiceRows}
              emptyMessage="No service lifecycle records match the current report filters."
              currentPage={tablePages.services}
              onPageChange={(page) => setReportTablePage('services', page)}
              itemLabel="service rows"
              enableAdminColumnVisibility={!isCustomerAudience}
              columnVisibilityStorageKey="admin-reports-services-table"
              compactColumnKeys={['serviceName', 'clientName', 'productType', 'lifecycleStatus', 'status', 'renewsOn']}
              columnVisibilitySyncKey={columnVisibilitySyncKey}
            />
          </ReportSection>

          <ReportSection
            icon={Clock3}
            title="Upcoming Renewals"
            description={pageConfig.upcomingRenewalsDescription}
            hideMetricCard
            metricLabel="Renewing Soon"
            metricValue={formatCompactNumber(reportData.summary.upcomingRenewals)}
            metricHelper="Within the next 30 days"
            miniStats={[
              { label: 'Renewing Soon', value: formatCompactNumber(reportData.summary.upcomingRenewals), helper: 'Within the next 30 days.', tone: 'sky' },
              { label: 'Within 7 Days', value: formatCompactNumber(reportData.upcomingRenewalRows.filter((row) => row.daysUntilRenewal !== null && row.daysUntilRenewal <= 7).length), helper: 'Immediate renewal actions.', tone: 'rose' },
              { label: 'Within 14 Days', value: formatCompactNumber(reportData.upcomingRenewalRows.filter((row) => row.daysUntilRenewal !== null && row.daysUntilRenewal <= 14).length), helper: 'Short-term renewals.', tone: 'amber' },
              { label: 'Active Services', value: formatCompactNumber(reportData.summary.activeServices), helper: 'Base service pool being monitored.', tone: 'emerald' },
            ]}
          >
            <PaginatedReportTable
              columns={renewalColumns}
              rows={reportData.upcomingRenewalRows}
              emptyMessage="No upcoming renewals fall within the current report scope."
              currentPage={tablePages.renewals}
              onPageChange={(page) => setReportTablePage('renewals', page)}
              itemLabel="renewal rows"
              enableAdminColumnVisibility={!isCustomerAudience}
              columnVisibilityStorageKey="admin-reports-renewals-table"
              compactColumnKeys={['serviceName', 'clientName', 'productType', 'renewsOn', 'daysUntilRenewal']}
              columnVisibilitySyncKey={columnVisibilitySyncKey}
            />
          </ReportSection>
        </div>
      ) : null}

      {showReceivables ? (
        <ReportSection
          icon={ReceiptText}
          title={isCustomerAudience ? 'Open/Aging Invoices, Payments & Unpaid Invoices' : 'Receivables & Payments'}
          description={isCustomerAudience
            ? 'Review open invoices, aging invoices, on-time versus late payments, and unpaid invoice balances in one ledger-style customer report.'
            : 'Review overdue invoices, unpaid invoices, and on-time versus late payment performance in one ledger-style report.'}
          hideMetricCard
          metricLabel={isCustomerAudience ? 'Unpaid Balance' : 'Outstanding'}
          metricValue={formatCurrency(reportData.summary.unpaidAmount)}
          metricHelper={isCustomerAudience
            ? `${reportData.summary.openInvoices} open invoices • ${reportData.summary.overdueInvoices} aging invoices`
            : `${reportData.summary.overdueInvoices} overdue invoices need attention`}
          miniStats={isCustomerAudience
            ? [
              { label: 'Unpaid Balance', value: formatCurrency(reportData.summary.unpaidAmount), helper: `${reportData.summary.openInvoices} open invoices • ${reportData.summary.overdueInvoices} aging invoices`, tone: 'sky' },
              { label: 'Aging Invoices', value: formatCompactNumber(reportData.summary.overdueInvoices), helper: formatCompactCurrency(reportData.summary.overdueAmount), tone: 'rose' },
              { label: 'On-Time Payments', value: formatCompactNumber(reportData.summary.onTimePayments), helper: 'Invoices paid on or before the due date.', tone: 'emerald' },
              { label: 'Late Payments', value: formatCompactNumber(reportData.summary.latePayments), helper: 'Invoices cleared after the due date.', tone: 'amber' },
            ]
            : [
              { label: 'Outstanding', value: formatCurrency(reportData.summary.unpaidAmount), helper: `${reportData.summary.overdueInvoices} overdue invoices need attention`, tone: 'sky' },
              { label: 'Unpaid Invoices', value: formatCompactNumber(reportData.summary.unpaidInvoices), helper: formatCompactCurrency(reportData.summary.unpaidAmount), tone: 'amber' },
              { label: 'On-Time Payments', value: formatCompactNumber(reportData.summary.onTimePayments), helper: 'Invoices paid on or before the due date.', tone: 'emerald' },
              { label: 'Late Payments', value: formatCompactNumber(reportData.summary.latePayments), helper: `${formatCompactNumber(reportData.summary.overdueInvoices)} overdue invoices`, tone: 'rose' },
            ]}
        >
          <PaginatedReportTable
            columns={receivableColumns}
            rows={reportData.filteredSalesRows}
            emptyMessage="No receivable or payment records match the current report filters."
            currentPage={tablePages.receivables}
            onPageChange={(page) => setReportTablePage('receivables', page)}
            itemLabel="receivable rows"
            enableAdminColumnVisibility={!isCustomerAudience}
            columnVisibilityStorageKey="admin-reports-receivables-table"
            compactColumnKeys={['invoiceNumber', 'orderLabel', 'clientName', 'productName', 'amount', 'dueDate', 'paymentState']}
            columnVisibilitySyncKey={columnVisibilitySyncKey}
          />
        </ReportSection>
      ) : null}

      {showTax ? (
        <ReportSection
          icon={FileText}
          title="Tax & Accounting"
          description="Use paid sales to estimate tax due, net revenue, and receivables by monthly accounting period."
          hideMetricCard
          metricLabel="Tax Due"
          metricValue={formatCurrency(reportData.summary.taxDue)}
          metricHelper={`Gross paid revenue ${formatCurrency(reportData.summary.grossPaidRevenue)}`}
          miniStats={[
            { label: 'Gross Paid Revenue', value: formatCompactCurrency(reportData.summary.grossPaidRevenue), helper: 'Paid sales before tax.', tone: 'sky' },
            { label: 'Tax Due', value: formatCompactCurrency(reportData.summary.taxDue), helper: 'Estimated at 12% of paid sales.', tone: 'amber' },
            { label: 'Net Revenue', value: formatCompactCurrency(reportData.summary.netRevenue), helper: 'Paid sales after tax allocation.', tone: 'emerald' },
            { label: 'Accounting Periods', value: formatCompactNumber(reportData.taxRows.length), helper: 'Monthly buckets in the current report scope.', tone: 'slate' },
          ]}
        >
          <PaginatedReportTable
            columns={taxColumns}
            rows={reportData.taxRows}
            emptyMessage="No paid sales are available for the current tax and accounting report scope."
            currentPage={tablePages.tax}
            onPageChange={(page) => setReportTablePage('tax', page)}
            itemLabel="tax rows"
            enableAdminColumnVisibility={!isCustomerAudience}
            columnVisibilityStorageKey="admin-reports-tax-table"
            compactColumnKeys={['period', 'grossSales', 'taxDue', 'netRevenue']}
            columnVisibilitySyncKey={columnVisibilitySyncKey}
          />
        </ReportSection>
      ) : null}
    </div>
  );
}
