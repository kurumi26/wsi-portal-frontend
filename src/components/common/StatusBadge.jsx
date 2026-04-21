import { useTheme } from '../../context/ThemeContext';

const classesDark = {
  Enabled: 'bg-emerald-400/15 text-emerald-300',
  Disabled: 'bg-rose-400/15 text-rose-300',
  Active: 'bg-sky-400/15 text-sky-300',
  Accepted: 'bg-emerald-400/15 text-emerald-300',
  Verified: 'border border-sky-300/20 bg-sky-400/15 text-sky-200',
  Open: 'bg-orange-400/15 text-orange-300',
  'In Progress': 'border border-sky-300/20 bg-sky-400/15 text-sky-200',
  Resolved: 'bg-emerald-400/15 text-emerald-300',
  Closed: 'bg-white/15 text-slate-100',
  Escalated: 'bg-rose-400/15 text-rose-300',
  'Expiring Soon': 'border border-amber-300/20 bg-amber-400/15 text-amber-100',
  Expired: 'bg-orange-400/15 text-orange-300',
  Unpaid: 'bg-orange-400/15 text-orange-300',
  New: 'bg-emerald-400/15 text-emerald-300',
  'Undergoing Provisioning': 'border border-sky-300/20 bg-sky-400/15 text-sky-200',
  Paid: 'bg-sky-400/15 text-sky-300',
  Pending: 'bg-orange-400/15 text-orange-300',
  'Pending Review': 'bg-white/15 text-slate-100',
  'Pending Verification': 'border border-amber-300/20 bg-amber-400/15 text-amber-100',
  'Pending Approval': 'bg-orange-400/15 text-orange-300',
  Approved: 'bg-emerald-400/15 text-emerald-300',
  Rejected: 'bg-rose-400/15 text-rose-300',
  'Awaiting Acceptance': 'bg-white/15 text-slate-100',
};

const classesLight = {
  Enabled: '!bg-emerald-50 !text-emerald-600',
  Disabled: '!bg-rose-200 !text-rose-700',
  Active: '!bg-emerald-50 !text-emerald-600',
  Accepted: '!bg-emerald-50 !text-emerald-600',
  Verified: '!border !border-sky-200 !bg-sky-50 !text-sky-700',
  Open: 'bg-orange-50 text-orange-600',
  'In Progress': '!border !border-sky-200 !bg-sky-50 !text-sky-700',
  Resolved: '!bg-emerald-50 !text-emerald-600',
  Closed: '!bg-slate-200 !text-slate-800',
  Escalated: '!bg-rose-200 !text-rose-700',
  'Expiring Soon': '!border !border-amber-200 !bg-amber-50 !text-amber-700',
  Expired: '!bg-rose-200 !text-rose-700',
  Unpaid: 'bg-orange-50 text-orange-600',
  'Undergoing Provisioning': '!border !border-sky-200 !bg-sky-50 !text-sky-700',
  Paid: '!bg-emerald-50 !text-emerald-600',
  Pending: 'bg-orange-50 text-orange-600',
  'Pending Review': '!bg-slate-200 !text-slate-800',
  'Pending Verification': '!border !border-amber-200 !bg-amber-50 !text-amber-700',
  New: '!bg-emerald-50 !text-emerald-600',
  Failed: '!bg-rose-200 !text-rose-700',
  'Pending Approval': 'bg-orange-50 text-orange-600',
  Approved: 'bg-emerald-50 text-emerald-600',
  Rejected: 'bg-rose-50 text-rose-600',
  'Awaiting Acceptance': '!bg-slate-200 !text-slate-800',
};

const displayLabels = {
  'Undergoing Provisioning': 'Provisioning',
};

export default function StatusBadge({ status }) {
  const { isDarkMode } = useTheme();
  const classes = isDarkMode ? classesDark : classesLight;
  const label = displayLabels[status] ?? status;

  return (
    <span
      title={status}
      aria-label={status}
      className={`badge shrink-0 justify-center whitespace-nowrap leading-none ${classes[status] ?? (isDarkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-800')}`}
    >
      {label}
    </span>
  );
}
