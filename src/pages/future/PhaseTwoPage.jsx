import { Layers3 } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';

export default function PhaseTwoPage({ moduleName }) {
  return (
    <div>
      <PageHeader
        eyebrow="Phase 2 Module"
        title={moduleName}
        description="This route is intentionally prepared for the next release phase so the portal architecture can expand without routing changes."
      />
      <div className="panel p-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-sky-400/10 text-sky-300">
          <Layers3 />
        </div>
        <h2 className="mt-6 text-2xl font-semibold text-white">Coming soon</h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400">
          The foundation for {moduleName.toLowerCase()} is ready. API integration, automation, and reporting can be added in the next phase.
        </p>
      </div>
    </div>
  );
}
