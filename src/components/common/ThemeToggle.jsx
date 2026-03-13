import { Moon, SunMedium } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export default function ThemeToggle({ compact = false }) {
  const { isDarkMode, toggleTheme } = useTheme();

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-100 transition hover:border-sky-300/30 hover:bg-sky-300/10"
        aria-label="Toggle dark mode"
        title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDarkMode ? <SunMedium size={16} /> : <Moon size={16} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      role="switch"
      aria-checked={isDarkMode}
      className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-slate-100 transition hover:border-sky-300/30 hover:bg-sky-300/10"
      aria-label="Toggle dark mode"
    >
      <span className="flex items-center gap-3">
        {isDarkMode ? <Moon size={16} /> : <SunMedium size={16} />}
        <span>
          <span className="block text-sm font-medium text-white">Dark mode</span>
          <span className="block text-xs text-slate-400">{isDarkMode ? 'On' : 'Off'}</span>
        </span>
      </span>

      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          isDarkMode ? 'bg-orange-400' : 'bg-slate-600'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
            isDarkMode ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </span>
    </button>
  );
}
