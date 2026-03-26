import { useMemo, useState } from 'react';

export default function DataTable({ columns, rows, emptyMessage = 'No records found.' }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

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

  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10 text-left text-sm">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              {columns.map((column) => {
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
                  {columns.map((column) => (
                    <td key={column.key} className="px-6 py-5 text-slate-200">
                      {column.render ? column.render(row[column.key], row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-5 py-12 text-center text-slate-400">
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
