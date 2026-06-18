import { Menu, ShoppingCart, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePortal } from '../context/PortalContext';

const storefrontNav = [
  { label: 'Browse Products', to: '/services' },
  { label: 'Domains', to: '/domains' },
];

export default function StorefrontLayout() {
  const { cart } = usePortal();
  const { isAuthenticated, isAdmin, user } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const portalPath = isAdmin ? '/admin' : '/dashboard';

  return (
    <div className="storefront-page min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-10 2xl:px-14">
          <Link to="/services" className="flex items-center gap-3" onClick={() => setMobileNavOpen(false)}>
              <img src="/logo-light.png" alt="WSI" className="h-7 w-auto object-contain" />
        
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {storefrontNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/services'}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-bold transition ${
                    isActive ? 'bg-sky-100 text-sky-700' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              to="/checkout"
              className="relative inline-flex h-11 items-center gap-2 rounded-full border border-slate-300 px-4 text-sm font-bold text-slate-950 transition hover:border-sky-300 hover:bg-sky-50"
            >
              <ShoppingCart size={18} />
              Cart
              {cart.length ? (
                <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-sky-400 px-1.5 text-[11px] font-black text-slate-950">
                  {cart.length}
                </span>
              ) : null}
            </Link>
            {isAuthenticated ? (
              <Link to={portalPath} className="btn-primary rounded-full">
                {user?.name ? 'Customer Portal' : 'Portal'}
              </Link>
            ) : (
              <Link to="/auth/login" state={{ returnTo: '/checkout' }} className="btn-primary rounded-full">
                Sign in
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileNavOpen((current) => !current)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-300 text-slate-950 md:hidden"
            aria-label="Toggle storefront navigation"
            aria-expanded={mobileNavOpen}
          >
            {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {mobileNavOpen ? (
          <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
            <div className="mx-auto flex w-full flex-col gap-2">
              {storefrontNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/services'}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `rounded-2xl px-4 py-3 text-sm font-bold ${
                      isActive ? 'bg-sky-100 text-sky-700' : 'text-slate-700 hover:bg-slate-100'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <Link
                to="/checkout"
                onClick={() => setMobileNavOpen(false)}
                className="mt-2 flex items-center justify-between rounded-2xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-950"
              >
                <span className="inline-flex items-center gap-2">
                  <ShoppingCart size={18} /> Cart
                </span>
                {cart.length ? (
                  <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-sky-400 px-1.5 text-[11px] font-black text-slate-950">
                    {cart.length}
                  </span>
                ) : null}
              </Link>
              <Link
                to={isAuthenticated ? portalPath : '/auth/login'}
                state={isAuthenticated ? undefined : { returnTo: '/checkout' }}
                onClick={() => setMobileNavOpen(false)}
                className="btn-primary mt-2 rounded-full"
              >
                {isAuthenticated ? 'Customer Portal' : 'Sign in to pay'}
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto w-full px-4 py-6 sm:px-6 lg:px-10 2xl:px-14">
        <Outlet />
      </main>
    </div>
  );
}
