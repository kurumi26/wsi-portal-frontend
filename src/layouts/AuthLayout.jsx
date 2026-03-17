import { Outlet, Link } from 'react-router-dom';
import ThemeToggle from '../components/common/ThemeToggle';

export default function AuthLayout() {
  return (
    <div className="relative h-screen overflow-hidden bg-slate-950 px-4 py-4 text-slate-100 lg:px-6">
      <div className="mx-auto flex h-full max-w-7xl flex-col">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-3 rounded-2xl bg-transparent px-4 py-3 backdrop-blur">
            <div className="flex h-15 w-28 items-center justify-center overflow-hidden">
              <img src="/logo-light.png" alt="WSI" className="h-8 w-auto object-contain" />
            </div>
          </div>

          <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur">
            <span className="hidden text-sm text-slate-400 sm:inline">Theme</span>
            <ThemeToggle compact />
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <section className="min-h-0 p-6 lg:p-8 bg-transparent">
            <div className="flex h-full flex-col justify-center gap-4">
              <div>
                <h1 className="text-4xl font-bold text-white md:text-5xl">Moderns hosting, billing, and customer operations</h1>
                <p className="mt-2 max-w-xl text-base text-slate-300">Manage services, invoices, and provisioning from one simple portal.</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link to="/auth/register" className="btn-primary rounded-full px-5 py-3 shadow-md">Get started</Link>
                <Link to="/about" className="btn-secondary rounded-full px-4 py-2">Learn more</Link>
              </div>

              <div className="mt-3 flex items-center gap-6 text-sm text-slate-400">
                <div className="flex flex-col">
                  <div className="uppercase text-xs">Active Services</div>
                  <div className="mt-1 text-base font-semibold text-white">128</div>
                </div>
                <div className="h-6 w-px bg-white/5" />
                <div className="flex flex-col">
                  <div className="uppercase text-xs">Provisioning Queue</div>
                  <div className="mt-1 text-base font-semibold text-white">16</div>
                </div>
                <div className="h-6 w-px bg-white/5" />
                <div className="flex flex-col">
                  <div className="uppercase text-xs">Support SLA</div>
                  <div className="mt-1 text-base font-semibold text-white">99.9%</div>
                </div>
              </div>
            </div>
          </section>

          <section className="flex min-h-0 items-center justify-center">
            <div className="scrollbar-none max-h-full w-full max-w-xl overflow-y-auto pr-1">
              <Outlet />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
