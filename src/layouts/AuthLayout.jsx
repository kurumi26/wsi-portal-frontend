import { Outlet, Link } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="auth-font-page relative min-h-screen bg-white px-4 py-4 text-slate-950 lg:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl flex-col">
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <Link to="/services" className="inline-flex items-center gap-3">
            <span className="flex h-12 w-28 items-center justify-center overflow-hidden rounded-2xl bg-white px-1">
              <img src="/logo-light.png" alt="WSI" className="h-7 w-auto object-contain" />
            </span>
            <span>
              <span className="block text-sm font-black uppercase tracking-[0.2em] text-slate-950">WSI Portal</span>
              <span className="block text-xs font-semibold text-slate-500">Secure customer access</span>
            </span>
          </Link>

          <Link to="/services" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50">
            Browse products
          </Link>
        </div>

        <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <section className="min-h-0 rounded-[32px] border border-slate-200 bg-white p-6 text-slate-950 shadow-sm lg:p-8">
            <div className="flex h-full flex-col justify-center gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-700">WSI customer portal</p>
                <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">Checkout, billing, and service updates in one secure place.</h1>
                <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">Create an account or sign in to complete payment, review contracts, track orders, and manage your active services.</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link to="/auth/register" className="rounded-full bg-sky-300 px-5 py-3 text-sm font-black text-slate-950 shadow-md transition hover:bg-sky-200">Get started</Link>
                <Link to="/services" className="rounded-full border border-slate-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:border-sky-300 hover:bg-sky-50">Browse products</Link>
              </div>

              <div className="mt-3 flex items-center gap-6 text-sm text-slate-500">
                <div className="flex flex-col">
                  <div className="uppercase text-xs">Active Services</div>
                  <div className="mt-1 text-base font-semibold text-slate-950">128</div>
                </div>
                <div className="h-6 w-px bg-slate-200" />
                <div className="flex flex-col">
                  <div className="uppercase text-xs">Provisioning Queue</div>
                  <div className="mt-1 text-base font-semibold text-slate-950">16</div>
                </div>
                <div className="h-6 w-px bg-slate-200" />
                <div className="flex flex-col">
                  <div className="uppercase text-xs">Support SLA</div>
                  <div className="mt-1 text-base font-semibold text-slate-950">99.9%</div>
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
