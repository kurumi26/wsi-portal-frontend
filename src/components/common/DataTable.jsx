import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, EyeOff } from 'lucide-react';

const COLUMN_VISIBILITY_STORAGE_PREFIX = 'admin-table-columns';

const getAllColumnKeys = (columns) => columns.map((column) => column.key);

const getLockedColumnKeys = (columns) => columns
  .filter((column) => column.hideable === false)
  .map((column) => column.key);

const getDefaultVisibleColumnKeys = (columns, compactColumnKeys = []) => {
  const allKeys = getAllColumnKeys(columns);
  const lockedKeys = getLockedColumnKeys(columns);

  if (!columns.length) {
    return [];
  }

  if (compactColumnKeys.length) {
    const compactSet = new Set([...lockedKeys, ...compactColumnKeys]);

    return allKeys.filter((key) => compactSet.has(key));
  }

  const hasExplicitHiddenColumns = columns.some((column) => column.defaultVisible === false);

  if (hasExplicitHiddenColumns) {
    const visibleSet = new Set([
      ...lockedKeys,
      ...columns
        .filter((column) => column.defaultVisible !== false)
        .map((column) => column.key),
    ]);

    return allKeys.filter((key) => visibleSet.has(key));
  }

  const fallbackVisibleCount = Math.min(allKeys.length, 4);

  return allKeys.filter((key, index) => index < fallbackVisibleCount || lockedKeys.includes(key));
};

const sanitizeVisibleColumnKeys = (candidateKeys, columns, fallbackKeys) => {
  const allKeys = getAllColumnKeys(columns);
  const lockedKeys = getLockedColumnKeys(columns);
  const allowedKeySet = new Set(allKeys);
  const normalizedKeys = Array.isArray(candidateKeys)
    ? candidateKeys.filter((key) => allowedKeySet.has(key))
    : [];
  const lockedSet = new Set(lockedKeys);
  const nextVisibleSet = new Set([...normalizedKeys, ...lockedKeys]);
  const orderedKeys = allKeys.filter((key) => nextVisibleSet.has(key));

  if (orderedKeys.length) {
    return orderedKeys;
  }

  const fallbackSet = new Set([...fallbackKeys, ...lockedKeys]);

  return allKeys.filter((key) => fallbackSet.has(key) || lockedSet.has(key));
};

const readStoredVisibleColumns = (storageKey) => {
  if (!storageKey || typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(`${COLUMN_VISIBILITY_STORAGE_PREFIX}:${storageKey}`);

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue);

    return Array.isArray(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
};

const writeStoredVisibleColumns = (storageKey, visibleColumnKeys) => {
  if (!storageKey || typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(`${COLUMN_VISIBILITY_STORAGE_PREFIX}:${storageKey}`, JSON.stringify(visibleColumnKeys));
  } catch {
    // Ignore persistence failures and keep the UI responsive.
  }
};

export default function DataTable({
  columns,
  rows,
  emptyMessage = 'No records found.',
  enableAdminColumnVisibility = false,
  columnVisibilityStorageKey = '',
  compactColumnKeys = [],
  columnVisibilityPortalTargetId = '',
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const compactColumnSignature = compactColumnKeys.join('|');
  const columnSignature = columns
    .map((column) => `${column.key}:${column.hideable === false ? 'locked' : 'toggle'}:${column.defaultVisible === false ? 'hidden' : 'visible'}`)
    .join('|');
  const defaultVisibleColumnKeys = useMemo(
    () => getDefaultVisibleColumnKeys(columns, compactColumnKeys),
    [columnSignature, compactColumnSignature, columns, compactColumnKeys],
  );
  const [visibleColumnKeys, setVisibleColumnKeys] = useState(() => (
    enableAdminColumnVisibility ? defaultVisibleColumnKeys : getAllColumnKeys(columns)
  ));
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [columnMenuStyle, setColumnMenuStyle] = useState(null);
  const [columnVisibilityPortalTarget, setColumnVisibilityPortalTarget] = useState(null);
  const columnMenuTriggerRef = useRef(null);
  const columnMenuRef = useRef(null);
  const useExternalColumnVisibilityControl = enableAdminColumnVisibility && Boolean(columnVisibilityPortalTargetId);

  useEffect(() => {
    if (!enableAdminColumnVisibility) {
      return;
    }

    const storedVisibleColumns = readStoredVisibleColumns(columnVisibilityStorageKey);
    const nextVisibleColumns = sanitizeVisibleColumnKeys(
      storedVisibleColumns ?? defaultVisibleColumnKeys,
      columns,
      defaultVisibleColumnKeys,
    );

    setVisibleColumnKeys((current) => {
      const currentSignature = current.join('|');
      const nextSignature = nextVisibleColumns.join('|');

      return currentSignature === nextSignature ? current : nextVisibleColumns;
    });
  }, [columnSignature, columnVisibilityStorageKey, columns, defaultVisibleColumnKeys, enableAdminColumnVisibility]);

  useEffect(() => {
    if (!enableAdminColumnVisibility) {
      return;
    }

    writeStoredVisibleColumns(columnVisibilityStorageKey, visibleColumnKeys);
  }, [columnVisibilityStorageKey, enableAdminColumnVisibility, visibleColumnKeys]);

  useEffect(() => {
    if (!columnMenuOpen) {
      return undefined;
    }

    const handleDocumentClick = (event) => {
      const clickedTrigger = columnMenuTriggerRef.current && columnMenuTriggerRef.current.contains(event.target);
      const clickedMenu = columnMenuRef.current && columnMenuRef.current.contains(event.target);

      if (!clickedTrigger && !clickedMenu) {
        setColumnMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);

    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [columnMenuOpen]);

  useEffect(() => {
    if (!useExternalColumnVisibilityControl || typeof document === 'undefined') {
      setColumnVisibilityPortalTarget(null);
      return;
    }

    setColumnVisibilityPortalTarget(document.getElementById(columnVisibilityPortalTargetId));
  }, [columnVisibilityPortalTargetId, useExternalColumnVisibilityControl]);

  useLayoutEffect(() => {
    if (!enableAdminColumnVisibility || !columnMenuOpen || !columnMenuTriggerRef.current) {
      setColumnMenuStyle(null);
      return;
    }

    const trigger = columnMenuTriggerRef.current.querySelector('button') ?? columnMenuTriggerRef.current;
    const menuWidth = 260;

    const updatePosition = () => {
      const rect = trigger.getBoundingClientRect();
      const left = Math.max(8, rect.right - menuWidth + window.scrollX);
      const top = rect.bottom + 8 + window.scrollY;

      setColumnMenuStyle({
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        width: `${menuWidth}px`,
        zIndex: 9999,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [columnMenuOpen, columnSignature, enableAdminColumnVisibility]);

  const visibleColumns = useMemo(() => {
    if (!enableAdminColumnVisibility) {
      return columns;
    }

    const sanitizedKeys = sanitizeVisibleColumnKeys(visibleColumnKeys, columns, defaultVisibleColumnKeys);
    const visibleKeySet = new Set(sanitizedKeys);

    return columns.filter((column) => visibleKeySet.has(column.key));
  }, [columnSignature, columns, defaultVisibleColumnKeys, enableAdminColumnVisibility, visibleColumnKeys]);

  useEffect(() => {
    if (sortKey && !visibleColumns.some((column) => column.key === sortKey)) {
      setSortKey(null);
      setSortDir('asc');
    }
  }, [sortKey, visibleColumns]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;

    const column = columns.find((c) => c.key === sortKey);
    if (!column) return rows;

    const copy = rows.slice();
    copy.sort((a, b) => {
      const va = typeof column.sortValue === 'function' ? column.sortValue(a) : a[sortKey];
      const vb = typeof column.sortValue === 'function' ? column.sortValue(b) : b[sortKey];

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
  }, [rows, sortKey, sortDir, columns]);

  const handleSort = (col) => {
    if (!col.sortable) return;
    if (sortKey !== col.key) {
      setSortKey(col.key);
      setSortDir('asc');
      return;
    }

    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
  };

  const toggleColumnVisibility = (columnKey) => {
    const targetColumn = columns.find((column) => column.key === columnKey);

    if (!targetColumn || targetColumn.hideable === false) {
      return;
    }

    setVisibleColumnKeys((current) => {
      const currentVisibleKeys = sanitizeVisibleColumnKeys(current, columns, defaultVisibleColumnKeys);
      const hasColumn = currentVisibleKeys.includes(columnKey);
      const nextVisibleKeys = hasColumn
        ? currentVisibleKeys.filter((key) => key !== columnKey)
        : [...currentVisibleKeys, columnKey];
      const orderedVisibleKeys = sanitizeVisibleColumnKeys(nextVisibleKeys, columns, defaultVisibleColumnKeys);

      return orderedVisibleKeys.length ? orderedVisibleKeys : currentVisibleKeys;
    });
  };

  const showAllColumns = () => {
    setVisibleColumnKeys(getAllColumnKeys(columns));
  };

  const showCompactColumns = () => {
    setVisibleColumnKeys(defaultVisibleColumnKeys);
  };

  const columnVisibilityControl = enableAdminColumnVisibility && columns.length > 1 ? (
    <div className="relative" ref={columnMenuTriggerRef}>
      <button
        type="button"
        onClick={() => setColumnMenuOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]"
      >
        <EyeOff size={15} />
        Column visibility
        <ChevronDown size={14} className={`text-slate-400 transition ${columnMenuOpen ? 'rotate-180' : ''}`} />
      </button>

      {columnMenuOpen && columnMenuStyle
        ? createPortal(
            <div ref={columnMenuRef} style={columnMenuStyle} className="rounded-3xl border border-white/10 bg-slate-950 p-3 shadow-2xl shadow-slate-950/60">
              <div className="px-2 pb-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Column visibility</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">Choose which fields stay visible in this admin table.</p>
              </div>

              <div className="grid gap-2 border-b border-white/10 px-2 pb-3">
                <button
                  type="button"
                  onClick={showAllColumns}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]"
                >
                  Show all columns
                </button>
                <button
                  type="button"
                  onClick={showCompactColumns}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]"
                >
                  Hide extra columns
                </button>
              </div>

              <div className="mt-3 space-y-2 px-2">
                {columns.map((column) => {
                  const isVisible = visibleColumns.some((visibleColumn) => visibleColumn.key === column.key);
                  const isLocked = column.hideable === false;

                  return (
                    <button
                      key={column.key}
                      type="button"
                      onClick={() => toggleColumnVisibility(column.key)}
                      disabled={isLocked}
                      className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left text-sm transition ${
                        isVisible
                          ? 'border-sky-300/20 bg-sky-400/10 text-sky-100'
                          : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]'
                      } ${isLocked ? 'cursor-not-allowed opacity-80' : ''}`}
                    >
                      <span className="min-w-0 truncate">{column.label}</span>
                      <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]">
                        {isVisible ? <Check size={13} /> : null}
                        {isLocked ? 'Pinned' : isVisible ? 'Visible' : 'Hidden'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  ) : null;

  return (
    <div className="panel overflow-hidden">
      {useExternalColumnVisibilityControl && columnVisibilityPortalTarget && columnVisibilityControl
        ? createPortal(columnVisibilityControl, columnVisibilityPortalTarget)
        : null}

      {enableAdminColumnVisibility && columns.length > 1 && !useExternalColumnVisibilityControl ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.02] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Showing {visibleColumns.length} of {columns.length} columns
          </p>

          {columnVisibilityControl}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10 text-left text-sm">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              {visibleColumns.map((column) => {
                const isSorted = sortKey === column.key;
                return (
                  <th
                    key={column.key}
                    className={`px-6 py-5 font-medium ${column.sortable ? 'cursor-pointer select-none' : ''}`}
                    onClick={() => handleSort(column)}
                  >
                    <div className="flex items-center gap-2">
                      <span>{column.label}</span>
                      {column.sortable ? (
                        <span className="ml-1 flex flex-col items-center gap-0">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`sort-svg sort-icon ${isSorted && sortDir === 'asc' ? 'active' : 'inactive'}`}
                          >
                            <path d="M7 14l5-5 5 5" />
                          </svg>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`sort-svg sort-icon ${isSorted && sortDir === 'desc' ? 'active' : 'inactive'}`}
                          >
                            <path d="M7 10l5 5 5-5" />
                          </svg>
                        </span>
                      ) : null}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {sortedRows.length ? (
              sortedRows.map((row, index) => (
                <tr key={row.id ?? index} className="table-row-hoverable">
                  {visibleColumns.map((column) => (
                    <td key={column.key} className="px-6 py-5 text-slate-200">
                      {column.render ? column.render(row[column.key], row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={visibleColumns.length} className="px-5 py-12 text-center text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
