import { useTheme } from '../../context/ThemeContext';

const classesDark = {
  Active: 'bg-sky-400/15 text-sky-300',
  Expired: 'bg-orange-400/15 text-orange-300',
  Unpaid: 'bg-orange-400/15 text-orange-300',
  'Undergoing Provisioning': 'bg-white/15 text-white',
  Paid: 'bg-sky-400/15 text-sky-300',
  Pending: 'bg-orange-400/15 text-orange-300',
  'Pending Review': 'bg-white/15 text-slate-100',
  'Pending Approval': 'bg-orange-400/15 text-orange-300',
  Approved: 'bg-emerald-400/15 text-emerald-300',
  Rejected: 'bg-rose-400/15 text-rose-300',
};

const classesLight = {
  Active: 'bg-sky-50 text-sky-600',
  Expired: 'bg-orange-50 text-orange-600',
  Unpaid: 'bg-orange-50 text-orange-600',
  'Undergoing Provisioning': 'bg-slate-100 text-slate-800',
  Paid: 'bg-sky-50 text-sky-600',
  Pending: 'bg-orange-50 text-orange-600',
  'Pending Review': 'bg-slate-100 text-slate-800',
  'Pending Approval': 'bg-orange-50 text-orange-600',
  Approved: 'bg-emerald-50 text-emerald-600',
  Rejected: 'bg-rose-50 text-rose-600',
};

export default function StatusBadge({ status }) {
  const { isDarkMode } = useTheme();
  const classes = isDarkMode ? classesDark : classesLight;

  return <span className={`badge ${classes[status] ?? (isDarkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-800')}`}>{status}</span>;
}
