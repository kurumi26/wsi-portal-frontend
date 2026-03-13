export default function DataTable({ columns, rows, emptyMessage = 'No records found.' }) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10 text-left text-sm">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-5 py-4 font-medium">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {rows.length ? (
              rows.map((row, index) => (
                <tr key={row.id ?? index} className="hover:bg-white/[0.03]">
                  {columns.map((column) => (
                    <td key={column.key} className="px-5 py-4 text-slate-200">
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
