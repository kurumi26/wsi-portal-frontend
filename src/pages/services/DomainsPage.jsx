import { useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../../utils/format';

export const domainExtensions = [
  { ext: '.com', description: 'The classic domain for businesses.', price: 60.74, oldPrice: 979.62 },
  { ext: '.ph', description: 'Perfect for the Philippines.', price: 969, oldPrice: 5029 },
  { ext: '.net', description: 'Reliable for networks and services.', price: 490.18, oldPrice: 1229.5 },
  { ext: '.org', description: 'Trusted for organizations.', price: 616.67, oldPrice: 1450 },
  { ext: '.shop', description: 'For online stores and sellers.', price: 60.74, oldPrice: 606.97 },
  { ext: '.xyz', description: 'Create, innovate, and express.', price: 60.74, oldPrice: 1471.7 },
];

export default function DomainsPage() {
  const navigate = useNavigate();
  const [domainQuery, setDomainQuery] = useState('');

  const handleCheckAvailability = (extension) => {
    const requestedDomain = domainQuery.trim()
      ? `${domainQuery.trim().replace(/\s+/g, '').replace(/\.[^.]+$/, '')}${extension.ext}`
      : `my-business${extension.ext}`;

    navigate(`/domains/check?domain=${encodeURIComponent(requestedDomain)}&ext=${encodeURIComponent(extension.ext)}`);
  };

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_50%_20%,rgba(56,189,248,0.45),transparent_34%),linear-gradient(135deg,#020617,#0f172a_45%,#38bdf8)] px-5 py-16 text-center shadow-2xl shadow-slate-950/20 sm:px-8">
        <p className="text-sm font-black text-white force-white">Domain Name Search Tool - Find & Buy Available Domains</p>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-black tracking-tight text-white force-white sm:text-5xl">
          Get a domain for your next big idea
        </h1>
        <p className="mt-4 text-sm font-semibold text-white force-white">
          Includes privacy-focused domain setup and WSI support.
        </p>

        <div className="mx-auto mt-7 flex max-w-4xl flex-col gap-3 rounded-2xl bg-white p-2 shadow-2xl shadow-slate-950/25 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <Search size={21} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={domainQuery}
              onChange={(event) => setDomainQuery(event.target.value)}
              placeholder="Type the domain you want"
              className="w-full rounded-xl px-12 py-4 text-lg font-bold text-slate-950 outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => handleCheckAvailability(domainExtensions[0])}
            className="rounded-xl border-2 border-slate-950 bg-transparent px-6 py-4 text-sm font-black text-slate-950 transition hover:bg-[#020617] hover:text-white"
          >
            Search Domains
          </button>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {['.ph', '.com', '.co', '.net', '.org', '.shop', '.ai'].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setDomainQuery((current) => current.replace(/\.[^.]+$/, '') + item)}
              className="rounded-full bg-white/90 px-4 py-2 text-sm font-black text-slate-950"
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {domainExtensions.map((domain) => (
          <article key={domain.ext} className="rounded-none border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-black text-slate-950">{domain.ext}</h2>
            <p className="mt-2 min-h-10 text-sm leading-6 text-slate-600">{domain.description}</p>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-slate-600">Starting at</p>
            <p className="mt-1 text-sm text-slate-500 line-through">{formatCurrency(domain.oldPrice)}</p>
            <p className="storefront-price-font text-3xl text-slate-950">
              {formatCurrency(domain.price)}
              <span className="text-sm font-bold tracking-normal"> /1st year</span>
            </p>
            <button
              type="button"
              onClick={() => handleCheckAvailability(domain)}
              className="domain-card-cta mt-7"
            >
              Check Availability
            </button>
          </article>
        ))}
      </section>

      <section className="flex flex-wrap items-center justify-center gap-5 rounded-2xl bg-sky-200 px-5 py-5 text-sm font-black text-slate-950">
        {['Free domain URL forwarding', 'Free logo creation', 'Free social media subdomains', 'Live 24/7 support', 'Free domain privacy'].map((item) => (
          <span key={item} className="inline-flex items-center gap-2">
            <ShieldCheck size={16} /> {item}
          </span>
        ))}
      </section>
    </div>
  );
}
