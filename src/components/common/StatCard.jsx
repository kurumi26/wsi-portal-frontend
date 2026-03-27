export default function StatCard({ label, value, helper, accent = 'cyan' }) {
  const accentClasses = {
    cyan: 'from-sky-400/20 to-sky-500/5 text-sky-300',
    emerald: 'from-sky-300/20 to-sky-500/5 text-sky-200',
    amber: 'from-orange-400/20 to-orange-500/5 text-orange-300',
    violet: 'from-white/15 to-sky-200/5 text-white',
  };

  return (
    <div className={`panel bg-gradient-to-br ${accentClasses[accent]} p-4`}>
      <p className="text-sm text-slate-300">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      {helper ? <p className="mt-1 text-sm text-slate-400">{helper}</p> : null}
    </div>
  );
}
