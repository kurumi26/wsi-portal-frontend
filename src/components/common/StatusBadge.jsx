import { useTheme } from '../../context/ThemeContext';

const classesDark = {
  Enabled: 'bg-emerald-400/15 text-emerald-300',
  Disabled: 'bg-rose-400/15 text-rose-300',
  Active: 'bg-sky-400/15 text-sky-300',
  Expired: 'bg-orange-400/15 text-orange-300',
  Unpaid: 'bg-orange-400/15 text-orange-300',
  New: 'bg-emerald-400/15 text-emerald-300',
  'Undergoing Provisioning': 'bg-white/15 text-white',
  Paid: 'bg-sky-400/15 text-sky-300',
  Pending: 'bg-orange-400/15 text-orange-300',
  'Pending Review': 'bg-white/15 text-slate-100',
  'Pending Approval': 'bg-orange-400/15 text-orange-300',
  Approved: 'bg-emerald-400/15 text-emerald-300',
  Rejected: 'bg-rose-400/15 text-rose-300',
};

const classesLight = {
  Enabled: '!bg-emerald-50 !text-emerald-600',
  Disabled: '!bg-rose-200 !text-rose-700',
  Active: '!bg-emerald-50 !text-emerald-600',
  Expired: '!bg-rose-200 !text-rose-700',
  Unpaid: 'bg-orange-50 text-orange-600',
  'Undergoing Provisioning': '!bg-slate-200 !text-slate-800',
  Paid: '!bg-emerald-50 !text-emerald-600',
  Pending: 'bg-orange-50 text-orange-600',
  'Pending Review': '!bg-slate-200 !text-slate-800',
  New: '!bg-emerald-50 !text-emerald-600',
  Failed: '!bg-rose-200 !text-rose-700',
  'Pending Approval': 'bg-orange-50 text-orange-600',
  Approved: 'bg-emerald-50 text-emerald-600',
  Rejected: 'bg-rose-50 text-rose-600',
};

export default function StatusBadge({ status }) {
  const { isDarkMode } = useTheme();
  const classes = isDarkMode ? classesDark : classesLight;

  return <span className={`badge ${classes[status] ?? (isDarkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-800')}`}>{status}</span>;
}
