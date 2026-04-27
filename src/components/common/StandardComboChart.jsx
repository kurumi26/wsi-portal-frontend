const splitLabel = (label) => {
  const words = String(label ?? '').split(' ').filter(Boolean);

  if (words.length <= 2) {
    return [String(label ?? '')];
  }

  const midpoint = Math.ceil(words.length / 2);

  return [words.slice(0, midpoint).join(' '), words.slice(midpoint).join(' ')];
};

const buildTickValues = (maxValue, tickCount, formatter) => Array.from({ length: tickCount + 1 }, (_, index) => {
  const ratio = (tickCount - index) / tickCount;
  const value = maxValue ? maxValue * ratio : 0;

  return {
    id: `tick-${index}`,
    value,
    label: formatter(value),
  };
});

export default function StandardComboChart({
  labels = [],
  barValues = [],
  lineValues = [],
  barLabel = 'Bars',
  lineLabel = 'Trend',
  valueFormatter = (value) => value,
  tickFormatter,
  emptyMessage = 'No chart data available.',
  wrapperClassName = 'rounded-[24px] border border-slate-200 bg-slate-50 p-4',
  minWidth = 720,
  plotHeight = 220,
  tickCount = 4,
  barColor = '#2f6dff',
  lineColor = '#22a745',
}) {
  const safeLabels = labels.length
    ? labels
    : Array.from({ length: Math.max(barValues.length, lineValues.length) }, (_, index) => `Item ${index + 1}`);
  const safeBarValues = safeLabels.map((_, index) => Number(barValues[index] ?? 0) || 0);
  const resolvedLineValues = lineValues.length ? lineValues : safeBarValues;
  const safeLineValues = safeLabels.map((_, index) => Number(resolvedLineValues[index] ?? 0) || 0);
  const rawMax = Math.max(...safeBarValues, ...safeLineValues, 0);
  const chartMax = rawMax > 0 ? rawMax * 1.1 : 1;
  const yFormatter = tickFormatter ?? valueFormatter;
  const ticks = buildTickValues(chartMax, tickCount, yFormatter);
  const pointCount = Math.max(safeLabels.length - 1, 1);
  const linePoints = safeLineValues.map((value, index) => {
    const x = safeLabels.length === 1 ? 50 : (index / pointCount) * 100;
    const height = (value / chartMax) * 84;
    const y = 94 - height;

    return {
      x,
      y,
      left: `${x}%`,
      top: `${y}%`,
    };
  });
  const polylinePoints = linePoints.map((point) => `${point.x},${point.y}`).join(' ');

  if (!safeLabels.length) {
    return (
      <div className={wrapperClassName}>
        <div className="flex items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-white px-4 py-12 text-sm text-slate-400">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClassName}>
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${Math.max(minWidth, safeLabels.length * 64)}px` }}>
          <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-3">
            <div className="relative" style={{ height: `${plotHeight}px` }}>
              {ticks.map((tick, index) => (
                <div
                  key={tick.id}
                  className="absolute left-0 text-[11px] font-medium text-slate-500"
                  style={{
                    top: `${(index / tickCount) * 100}%`,
                    transform: index === 0 ? 'translateY(0)' : index === tickCount ? 'translateY(-100%)' : 'translateY(-50%)',
                  }}
                >
                  {tick.label}
                </div>
              ))}
            </div>

            <div>
              <div className="relative" style={{ height: `${plotHeight}px` }}>
                <div className="absolute inset-0">
                  {Array.from({ length: tickCount + 1 }).map((_, index) => (
                    <div
                      key={`grid-${index}`}
                      className="absolute inset-x-0 border-t border-slate-200"
                      style={{ top: `${(index / tickCount) * 100}%` }}
                    />
                  ))}
                </div>

                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
                  <polyline
                    fill="none"
                    stroke={lineColor}
                    strokeWidth="1.8"
                    points={polylinePoints}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>

                <div
                  className="absolute inset-0 grid items-end gap-2"
                  style={{ gridTemplateColumns: `repeat(${safeLabels.length}, minmax(0, 1fr))` }}
                >
                  {safeBarValues.map((value, index) => (
                    <div key={`${safeLabels[index]}-bar`} className="flex h-full items-end justify-center">
                      <div
                        className="w-full max-w-[24px] rounded-t-full"
                        style={{
                          backgroundColor: barColor,
                          height: `${Math.max((value / chartMax) * 100, value ? 8 : 0)}%`,
                        }}
                      />
                    </div>
                  ))}
                </div>

                {linePoints.map((point, index) => (
                  <span
                    key={`${safeLabels[index]}-dot`}
                    className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
                    style={{ left: point.left, top: point.top, backgroundColor: lineColor }}
                  />
                ))}
              </div>

              <div
                className="mt-3 grid gap-2 text-center text-xs font-medium text-slate-500"
                style={{ gridTemplateColumns: `repeat(${safeLabels.length}, minmax(0, 1fr))` }}
              >
                {safeLabels.map((label) => {
                  const lines = splitLabel(label);

                  return (
                    <div key={label} className="leading-tight">
                      {lines.map((line) => (
                        <div key={`${label}-${line}`}>{line}</div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-5 text-sm text-slate-600">
            <div className="inline-flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded" style={{ backgroundColor: barColor }} />
              <span>{barLabel}</span>
            </div>
            <div className="inline-flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: lineColor }} />
              <span>{lineLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
