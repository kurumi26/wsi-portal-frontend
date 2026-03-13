export default function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow ? <p className="text-sm uppercase tracking-[0.2em] text-orange-300">{eyebrow}</p> : null}
        <h1 className="mt-2 text-3xl font-semibold text-white">{title}</h1>
        {description ? <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">{description}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
