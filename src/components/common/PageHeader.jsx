export default function PageHeader({ eyebrow, title, description, belowDescription, action }) {
  return (
    <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--accent)]">
            <span className="inline-block h-1.5 w-6 rounded-full bg-[color:var(--accent)]" />
            {eyebrow}
          </p>
        ) : null}
        <h1 className="page-header-title mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{title}</h1>
        {description ? <p className="page-header-description mt-3 max-w-3xl text-sm leading-7 sm:text-base">{description}</p> : null}
        {belowDescription ? <div className="mt-5">{belowDescription}</div> : null}
      </div>
      {action ? <div className="w-full lg:w-auto lg:shrink-0">{action}</div> : null}
    </div>
  );
}
