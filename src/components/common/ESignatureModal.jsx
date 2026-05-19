import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, PenLine, RotateCcw, X } from 'lucide-react';

const STEPS = ['details', 'draw', 'confirm'];

export default function ESignatureModal({ contract, onClose, onSign, signatoryIndex = 0 }) {
  const [step, setStep] = useState('details');
  const [form, setForm] = useState({ signerName: '', signerCompany: '', signerTitle: '' });
  const [signatureDataUrl, setSignatureDataUrl] = useState(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef(null);

  const contractTitle = contract?.title || 'Service Agreement';
  const contractRef = contract?.auditReference || contract?.orderNumber || '';
  const persistedSignatories = Array.isArray(contract?.eSignatureSignatories) ? contract.eSignatureSignatories : [];
  const hasTrackedSignature = persistedSignatories.some((signatory) => signatory?.eSignedAt);
  const currentSignatory = persistedSignatories[signatoryIndex] ?? null;
  const otherPartySigned = persistedSignatories.some((signatory, index) => index !== signatoryIndex && signatory?.eSignedAt);
  const hasLegacySignedCopy = Boolean(contract?.signedDocumentUrl) && !hasTrackedSignature;
  const flowNotice = hasLegacySignedCopy
    ? {
        tone: 'border-amber-300 bg-amber-50 text-amber-900',
        text: 'This record already has an older signed PDF. To keep both signatures inside the portal flow, have the side that already signed re-sign once in the portal, then complete the other signature.',
      }
    : currentSignatory?.eSignedAt
      ? {
          tone: 'border-sky-300 bg-sky-50 text-sky-900',
          text: 'This side already has a portal e-signature. Signing again will update that same signature block.',
        }
      : otherPartySigned
        ? {
            tone: 'border-sky-300 bg-sky-50 text-sky-900',
            text: 'The other party already signed in the portal. Your signature will be added to the same agreement copy.',
          }
        : {
            tone: 'border-orange-300 bg-orange-50 text-orange-900',
            text: 'Your signature will be saved first, and the other party can sign the same agreement afterward without replacing your block.',
          };

  // ── Canvas drawing wiring ──────────────────────────────────
  useEffect(() => {
    if (step !== 'draw' || !canvasRef.current) {
      return undefined;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      if (e.touches) {
        return {
          x: (e.touches[0].clientX - rect.left) * scaleX,
          y: (e.touches[0].clientY - rect.top) * scaleY,
        };
      }

      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    };

    const startDraw = (e) => {
      e.preventDefault();
      isDrawingRef.current = true;
      lastPosRef.current = getPos(e);
    };

    const draw = (e) => {
      if (!isDrawingRef.current) {
        return;
      }

      e.preventDefault();
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastPosRef.current = pos;
      setHasDrawn(true);
    };

    const endDraw = (e) => {
      if (!isDrawingRef.current) {
        return;
      }

      e.preventDefault();
      isDrawingRef.current = false;
    };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endDraw);
    canvas.addEventListener('mouseleave', endDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', endDraw);

    return () => {
      canvas.removeEventListener('mousedown', startDraw);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', endDraw);
      canvas.removeEventListener('mouseleave', endDraw);
      canvas.removeEventListener('touchstart', startDraw);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', endDraw);
    };
  }, [step]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;

    if (canvas) {
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    }

    setHasDrawn(false);
    setSignatureDataUrl(null);
  };

  const handleNext = () => {
    if (step === 'details') {
      setStep('draw');
      return;
    }

    if (step === 'draw') {
      const canvas = canvasRef.current;

      if (!canvas || !hasDrawn) {
        return;
      }

      setSignatureDataUrl(canvas.toDataURL('image/png'));
      setStep('confirm');
    }
  };

  const handleBack = () => {
    if (step === 'draw') {
      setStep('details');
    } else if (step === 'confirm') {
      setSignatureDataUrl(null);
      setStep('draw');
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      await onSign({
        signerName: form.signerName.trim(),
        signerCompany: form.signerCompany.trim(),
        signerTitle: form.signerTitle.trim(),
        signatureDataUrl,
        signedAt: new Date().toISOString(),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepIndex = STEPS.indexOf(step);
  const isDetailsValid = form.signerName.trim().length > 0;

  const signedDateLabel = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const modal = (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="esig-title">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <PenLine size={16} className="text-orange-400" />
              <h2 id="esig-title" className="text-sm font-semibold text-white">Sign Contract Electronically</h2>
            </div>
            <p className="mt-0.5 max-w-xs truncate text-xs text-slate-400">
              {contractTitle}{contractRef ? ` — ${contractRef}` : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-1.5 border-b border-white/5 px-6 py-3">
          {[['details', '1', 'Signer Details'], ['draw', '2', 'Draw Signature'], ['confirm', '3', 'Review & Sign']].map(([id, num, label], i) => {
            const isActive = step === id;
            const isDone = stepIndex > i;

            return (
              <div key={id} className="flex items-center gap-1.5">
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition ${
                    isActive ? 'bg-orange-500 text-white'
                    : isDone ? 'bg-orange-500/80 text-white'
                    : 'bg-white/10 text-slate-500'
                  }`}
                >
                  {isDone ? <Check size={10} strokeWidth={3} /> : num}
                </div>
                <span className={`text-[11px] font-medium ${isActive ? 'text-white' : 'text-slate-500'}`}>
                  {label}
                </span>
                {i < 2 && <ChevronRight size={12} className="text-slate-700" />}
              </div>
            );
          })}
        </div>

        {/* Step bodies */}
        <div className="min-h-[240px] px-6 py-5">
          <div className={`mb-4 rounded-xl border px-4 py-3 text-xs font-medium leading-5 ${flowNotice.tone}`}>
            {flowNotice.text}
          </div>

          {/* Step 1 — Signer details */}
          {step === 'details' && (
            <div className="space-y-4">
              <p className="text-xs leading-5 text-slate-400">
                Enter your details as they will appear on the signed agreement document.
              </p>

              <div>
                <label htmlFor="esig-company" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  Company / Organization
                </label>
                <input
                  id="esig-company"
                  type="text"
                  value={form.signerCompany}
                  onChange={(e) => setForm((f) => ({ ...f, signerCompany: e.target.value }))}
                  placeholder="e.g. ACME Corporation"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20"
                />
              </div>

              <div>
                <label htmlFor="esig-name" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  Printed Name <span className="text-rose-400">*</span>
                </label>
                <input
                  id="esig-name"
                  type="text"
                  value={form.signerName}
                  onChange={(e) => setForm((f) => ({ ...f, signerName: e.target.value }))}
                  placeholder="e.g. Jane Smith"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20"
                />
              </div>

              <div>
                <label htmlFor="esig-title" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  Title / Role
                </label>
                <input
                  id="esig-title"
                  type="text"
                  value={form.signerTitle}
                  onChange={(e) => setForm((f) => ({ ...f, signerTitle: e.target.value }))}
                  placeholder="e.g. IT Manager"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20"
                />
              </div>
            </div>
          )}

          {/* Step 2 — Signature canvas */}
          {step === 'draw' && (
            <div>
              <p className="mb-3 text-xs leading-5 text-slate-400">
                Draw your signature using your mouse or finger. This will be embedded directly into the signed PDF.
              </p>

              <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-white/20 bg-white">
                <canvas
                  ref={canvasRef}
                  width={476}
                  height={160}
                  className="h-[140px] w-full touch-none"
                  style={{ cursor: 'crosshair' }}
                  aria-label="Signature drawing area"
                />
                {/* Baseline guide */}
                <div className="pointer-events-none absolute bottom-8 left-[8%] right-[8%] border-t border-slate-300/50" />
                <span className="pointer-events-none absolute bottom-10 left-5 text-[10px] italic text-slate-400">
                  Sign here
                </span>
                {!hasDrawn && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <p className="text-sm text-slate-400/60">Draw your signature above</p>
                  </div>
                )}
              </div>

              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-white/5 hover:text-slate-300"
                >
                  <RotateCcw size={11} />
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Confirm */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Signature Preview</p>
                <div className="overflow-hidden rounded-lg border border-white/10 bg-white">
                  {signatureDataUrl && (
                    <img src={signatureDataUrl} alt="Your drawn signature" className="h-[72px] w-full object-contain p-2" />
                  )}
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-white/10 bg-slate-950/40 p-4">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Signer Information</p>
                {form.signerCompany && (
                  <div className="flex gap-3 text-xs">
                    <span className="w-28 shrink-0 text-slate-500">Company</span>
                    <span className="text-white">{form.signerCompany}</span>
                  </div>
                )}
                <div className="flex gap-3 text-xs">
                  <span className="w-28 shrink-0 text-slate-500">Printed Name</span>
                  <span className="text-white">{form.signerName}</span>
                </div>
                {form.signerTitle && (
                  <div className="flex gap-3 text-xs">
                    <span className="w-28 shrink-0 text-slate-500">Title / Role</span>
                    <span className="text-white">{form.signerTitle}</span>
                  </div>
                )}
                <div className="flex gap-3 text-xs">
                  <span className="w-28 shrink-0 text-slate-500">Date Signed</span>
                  <span className="text-white">{signedDateLabel}</span>
                </div>
              </div>

              <p className="text-xs leading-5 text-slate-400">
                By clicking <strong className="text-white">Confirm & Submit</strong>, you acknowledge that this electronic signature constitutes your legally binding agreement to the terms of this contract. A signed PDF will be generated and attached to the contract record automatically.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
          <button
            type="button"
            onClick={step === 'details' ? onClose : handleBack}
            className="btn-secondary"
          >
            {step === 'details' ? 'Cancel' : 'Back'}
          </button>

          <button
            type="button"
            disabled={
              (step === 'details' && !isDetailsValid)
              || (step === 'draw' && !hasDrawn)
              || isSubmitting
            }
            onClick={step === 'confirm' ? handleSubmit : handleNext}
            className="btn-primary gap-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {step === 'confirm'
              ? (isSubmitting ? 'Submitting…' : 'Confirm & Submit')
              : 'Continue'}
            {step !== 'confirm' && <ChevronRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
