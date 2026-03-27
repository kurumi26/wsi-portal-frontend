import { Moon, SunMedium } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export default function ThemeToggle({ compact = false }) {
  const { isDarkMode, toggleTheme } = useTheme();

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/10 transition hover:border-sky-300/30 ${isDarkMode ? 'bg-white/5 text-slate-100 hover:bg-sky-300/10' : 'bg-transparent text-slate-900 hover:bg-slate-100'}`}
        aria-label="Toggle dark mode"
        title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDarkMode ? <SunMedium size={16} /> : <Moon size={16} />}
      </button>
    );
  }

  return (
    <div className={`w-full theme-toggle-wrapper ${isDarkMode ? '' : ''}`}>
      <div className={`rounded-2xl border p-2 ${isDarkMode ? 'border-white/8 bg-white/5' : 'border-transparent bg-transparent'}`}>
        <button
          type="button"
          onClick={toggleTheme}
          role="switch"
          aria-checked={isDarkMode}
          className={`w-full theme-toggle-button flex items-center justify-between rounded-2xl px-2 py-1 text-left transition appearance-none outline-none bg-transparent border-none`}
          aria-label="Toggle dark mode"
        >
          <span className="flex items-center gap-3">
            {isDarkMode ? <Moon size={16} /> : <SunMedium size={16} />}
            <span className="p-0 !bg-transparent !shadow-none !border-none">
              <span className={`block text-sm font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Dark mode</span>
              <span className="block text-xs text-slate-400">{isDarkMode ? 'On' : 'Off'}</span>
            </span>
          </span>

          <span
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${isDarkMode ? '!bg-orange-400' : '!bg-slate-200'}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full transition ${isDarkMode ? 'translate-x-6' : 'translate-x-1'} !bg-white`}
            />
          </span>
        </button>
      </div>
    </div>
  );
}
