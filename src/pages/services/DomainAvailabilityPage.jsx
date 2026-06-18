import { useMemo } from 'react';
import { ArrowLeft, CheckCircle2, Clock3, Globe2, Lock, Search, ShieldCheck, ShoppingCart } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { formatCurrency } from '../../utils/format';
import { domainExtensions } from './DomainsPage';

const processSteps = [
  {
    icon: Search,
    title: 'Check the domain name',
    description: 'We verify the exact spelling and extension against available domain inventory.',
  },
  {
    icon: ShieldCheck,
    title: 'Review privacy and protection',
    description: 'WSI prepares the domain with privacy-ready setup and ownership protection guidance.',
  },
  {
    icon: Lock,
    title: 'Reserve during checkout',
    description: 'Add the available domain to your cart, sign in, accept the agreement, then complete payment.',
  },
];

export default function DomainAvailabilityPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { services, addToCart, updateCartItem } = usePortal();

  const requestedDomain = searchParams.get('domain') || 'my-business.com';
  const requestedExt = searchParams.get('ext') || `.${requestedDomain.split('.').pop()}`;

  const selectedExtension = useMemo(
    () => domainExtensions.find((item) => item.ext === requestedExt) ?? domainExtensions[0],
    [requestedExt],
  );

  const domainService = useMemo(
    () => services.find((service) => String(service.category).toLowerCase() === 'domains') ?? services[0],
    [services],
  );

  const handleAddToCart = () => {
    if (!domainService) {
      return;
    }

    const item = addToCart(
      {
        ...domainService,
        price: selectedExtension.price,
        name: `${selectedExtension.ext} Domain Registration`,
        category: 'Domains',
      },
      selectedExtension.ext,
      [],
    );

    if (item?.lineId) {
      updateCartItem(item.lineId, { desiredDomain: requestedDomain });
    }

    navigate('/checkout');
  };

  return (
    <div className="space-y-8">
      <Link to="/domains" className="inline-flex items-center gap-2 text-sm font-black text-slate-700 transition hover:text-sky-600">
        <ArrowLeft size={16} /> Search another domain
      </Link>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-none border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-600">Domain Availability</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Good news, your domain is ready to continue.
          </h1>
          <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-600">
            We checked the request for <span className="text-slate-950">{requestedDomain}</span>. Review the process below, then add it to your cart to reserve it during checkout.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {processSteps.map((step, index) => {
              const Icon = step.icon;

              return (
                <article key={step.title} className="border border-slate-200 bg-slate-50 p-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                    <Icon size={20} />
                  </span>
                  <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Step {index + 1}
                  </p>
                  <h2 className="mt-2 text-lg font-black text-slate-950">{step.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="rounded-none border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sky-700">
              <Globe2 size={24} />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Selected Domain</p>
              <h2 className="text-2xl font-black text-slate-950">{requestedDomain}</h2>
            </div>
          </div>

          <div className="mt-7 border-t border-slate-200 pt-6">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-bold text-slate-600">Status</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                <CheckCircle2 size={15} /> Available
              </span>
            </div>
            <div className="mt-5 flex items-center justify-between gap-4">
              <span className="text-sm font-bold text-slate-600">Registration</span>
              <span className="text-sm font-black text-slate-950">1st year</span>
            </div>
            <div className="mt-5 flex items-center justify-between gap-4">
              <span className="text-sm font-bold text-slate-600">Estimated price</span>
              <span className="text-3xl font-black text-slate-950">{formatCurrency(selectedExtension.price)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-none bg-[#020617] px-5 py-4 text-sm font-black text-white shadow-lg shadow-slate-950/15 transition hover:bg-sky-600 force-white"
          >
            <ShoppingCart size={18} /> Add Domain to Cart
          </button>

          <p className="mt-4 flex items-center gap-2 text-xs font-bold leading-5 text-slate-500">
            <Clock3 size={15} /> Domain availability can change until checkout payment is completed.
          </p>
        </aside>
      </section>
    </div>
  );
}
