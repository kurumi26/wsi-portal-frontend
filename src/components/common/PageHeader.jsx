export default function PageHeader({ eyebrow, title, description, belowDescription, action }) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="text-sm uppercase tracking-[0.2em] text-orange-300">{eyebrow}</p> : null}
        <h1 className="mt-2 text-3xl font-semibold text-white">{title}</h1>
        {description ? <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">{description}</p> : null}
        {belowDescription ? <div className="mt-4">{belowDescription}</div> : null}
      </div>
      {action ? <div className="w-full lg:w-auto lg:shrink-0">{action}</div> : null}
    </div>
  );
}
