export default function StatCard({
  label,
  value,
  helper,
  accent = 'cyan',
  className = '',
  onClick,
  isActive = false,
}) {
  const accentClasses = {
    cyan: 'from-sky-400/20 to-sky-500/5 text-sky-300',
    emerald: 'from-sky-300/20 to-sky-500/5 text-sky-200',
    amber: 'from-orange-400/20 to-orange-500/5 text-orange-300',
    violet: 'from-white/15 to-sky-200/5 text-white',
  };

  const sharedClassName = `panel bg-gradient-to-br ${accentClasses[accent]} p-4 ${
    onClick ? 'cursor-pointer transition duration-200 hover:-translate-y-0.5 hover:border-slate-500/70' : ''
  } ${isActive ? 'border-sky-400/80 shadow-[0_0_0_1px_rgba(56,189,248,0.35)]' : ''} ${className}`.trim();

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={sharedClassName}>
        <p className="text-left text-sm text-slate-300">{label}</p>
        <p className="mt-2 text-left text-3xl font-semibold text-white">{value}</p>
        {helper ? <p className="mt-1 text-left text-sm text-slate-400">{helper}</p> : null}
      </button>
    );
  }

  return (
    <div className={sharedClassName}>
      <p className="text-sm text-slate-300">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      {helper ? <p className="mt-1 text-sm text-slate-400">{helper}</p> : null}
    </div>
  );
}
