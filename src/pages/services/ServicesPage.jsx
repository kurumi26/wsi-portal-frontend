import { useMemo, useState } from 'react';
import { CheckCircle2, Search } from 'lucide-react';
import ServiceCard from '../../components/common/ServiceCard';
import { usePortal } from '../../context/PortalContext';
import { getAddonLabel } from '../../utils/addons';

const getConfigurationLabel = (option) => {
  if (option === null || option === undefined) {
    return '';
  }

  return typeof option === 'object'
    ? option.label ?? option.name ?? JSON.stringify(option)
    : String(option);
};

export default function ServicesPage() {
  const { services } = usePortal();
  const [category, setCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = useMemo(() => ['All', ...new Set(services.map((service) => service.category))], [services]);
  const featuredServices = useMemo(() => services.slice(0, 3), [services]);

  const filteredServices = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return services.filter((service) => {
      const matchesCategory = category === 'All' || service.category === category;

      if (!matchesCategory) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchableText = [
        service.name,
        service.description,
        service.category,
        ...(Array.isArray(service?.configurations) ? service.configurations.map((option) => getConfigurationLabel(option)) : []),
        ...(Array.isArray(service?.addons) ? service.addons.map((option) => getAddonLabel(option)) : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [category, searchQuery, services]);

  return (
    <div className="space-y-5">
      <section className="mt-8 rounded-[28px] border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-slate-50 px-4 py-8 shadow-sm sm:px-8">
        <div className="mx-auto flex w-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-950/5 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Type the product you want"
              aria-label="Search products and services"
              className="w-full rounded-xl px-12 py-4 text-base font-bold text-slate-950 outline-none"
            />
          </label>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-6 py-4 text-sm font-black text-white shadow-md shadow-sky-900/20 transition hover:bg-sky-700 force-white"
          >
            <Search size={17} /> Search Products
          </button>
        </div>
      </section>

      {featuredServices.length ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-700">Popular picks</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Get online faster</h2>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {featuredServices.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[230px_1fr]">
        <aside className="h-fit rounded-none border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">Categories</p>
          <div className="mt-4 grid gap-2">
            {categories.map((item) => {
              const count = item === 'All'
                ? services.length
                : services.filter((service) => service.category === item).length;
              const isActive = item === category;

              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`flex w-full items-center justify-between gap-3 border px-4 py-3 text-left text-sm font-black transition ${
                    isActive
                      ? 'border-slate-950 bg-sky-300 text-slate-950'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-slate-950'
                  }`}
                >
                  <span>{item}</span>
                  <span className="text-xs font-black">{count}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 px-1">
            <p className="text-sm font-semibold text-slate-500">
              {filteredServices.length} {filteredServices.length === 1 ? 'product' : 'products'}
              {category !== 'All' ? ` in ${category}` : ''}
            </p>
          </div>

          {filteredServices.length ? (
            <div className="store-grid">
              {filteredServices.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          ) : (
            <div className="store-panel text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">No matches found</p>
              <p className="mt-3 text-base text-slate-400">Try a different keyword or switch the category filter.</p>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white sm:grid-cols-3">
        {[
          'Public browse and cart before login',
          'Secure portal login before payment',
          'Responsive on phones, tablets, and desktop',
        ].map((item) => (
          <div key={item} className="flex items-start gap-3">
            <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-sky-300" />
            <p className="text-sm font-bold leading-6 text-white">{item}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
