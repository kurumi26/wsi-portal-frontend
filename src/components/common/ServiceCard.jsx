import { CheckCircle2, Plus } from 'lucide-react';
import { formatCurrency } from '../../utils/format';

const getLabel = (opt) => {
  if (opt === null || opt === undefined) return '';
  return typeof opt === 'object' ? opt.label ?? opt.name ?? JSON.stringify(opt) : String(opt);
};

const getValue = (opt) => {
  if (opt === null || opt === undefined) return '';
  return typeof opt === 'object' ? opt.label ?? opt.name ?? JSON.stringify(opt) : String(opt);
};

export default function ServiceCard({ service, configuration, addon, onConfigure, onAdd }) {
  const selectedConfiguration = getValue(configuration);
  const selectedAddon = getValue(addon);
  return (
    <article className="panel flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="badge bg-sky-400/10 text-sky-300">{service.category}</span>
          <h3 className="mt-4 text-xl font-semibold text-white">{service.name}</h3>
          <p className="mt-3 text-sm leading-7 text-slate-400">{service.description}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-white">{formatCurrency(service.price)}</p>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">/{service.billing}</p>
        </div>
      </div>

      <div className="mt-5 space-y-3 text-sm text-slate-300">
        <div>
          <p className="mb-2 font-medium text-white">Included Options</p>
            <div className="space-y-2">
            {service.configurations.slice(0, 3).map((item) => (
              <div key={getValue(item)} className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-sky-300" />
                <span>{getLabel(item)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Product Type
            <select value={selectedConfiguration} onChange={(event) => onConfigure(service.id, 'configuration', event.target.value)} className="input mt-2">
              {service.configurations.map((option) => (
                <option key={getValue(option)} value={getValue(option)}>
                  {getLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Add-on
            <select value={selectedAddon} onChange={(event) => onConfigure(service.id, 'addon', event.target.value)} className="input mt-2">
              {service.addons.map((option) => (
                <option key={getValue(option)} value={getValue(option)}>
                  {getLabel(option)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <button type="button" onClick={() => onAdd(service)} className="btn-primary mt-6 gap-2">
        <Plus size={16} /> Add to Order
      </button>
    </article>
  );
}
