import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import { usePortal } from '../../context/PortalContext';
import { formatCurrency } from '../../utils/format';

const paymentMethods = ['Credit Card', 'PayPal', 'Bank Transfer'];

export default function CheckoutPage() {
  const { cart, paymentState, placeOrder, removeFromCart, retryPayment } = usePortal();
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const total = cart.reduce((sum, item) => sum + item.price, 0);

  const handleCheckout = async () => {
    setIsSubmitting(true);
    await placeOrder({ paymentMethod, agreementAccepted });
    setIsSubmitting(false);
  };

  const renderOption = (opt) => {
    if (opt === null || opt === undefined) return '';
    if (typeof opt === 'object') return opt.label ?? opt.name ?? JSON.stringify(opt);
    return String(opt);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Order & Checkout"
        title="Review order summary"
        description="Complete payment with agreement capture, policy acknowledgement, and method selection before provisioning starts."
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="panel p-6">
            <h2 className="text-xl font-semibold text-white">Order summary</h2>
            <div className="mt-6 space-y-4">
              {cart.length ? (
                cart.map((item) => (
                  <div key={item.lineId} className="panel-muted flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium text-white">{item.serviceName}</p>
                      <p className="mt-2 text-sm text-slate-400">Config: {renderOption(item.configuration)} · Add-on: {renderOption(item.addon)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-semibold text-white">{formatCurrency(item.price)}</p>
                      <button type="button" className="btn-secondary" onClick={() => removeFromCart(item.lineId)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="panel-muted p-8 text-center text-sm text-slate-400">
                  Your cart is empty. <Link to="/services" className="text-sky-300">Browse services</Link>
                </div>
              )}
            </div>
          </div>

          <div className="panel p-6">
            <h2 className="text-xl font-semibold text-white">Purchase agreements</h2>
            <div className="mt-6 space-y-4 text-sm leading-7 text-slate-400">
              <div className="panel-muted p-4">Purchase Agreement: Service orders are subject to provisioning validation and product-specific policy checks.</div>
              <div className="panel-muted p-4">Terms & Conditions: Billing terms, service periods, and cancellation rules apply based on selected products.</div>
              <div className="panel-muted p-4">Privacy Policy: Customer data is handled according to WSI privacy commitments and operational safeguards.</div>
            </div>
            <label className="mt-5 flex items-start gap-3 text-sm text-slate-300">
              <input type="checkbox" checked={agreementAccepted} onChange={(event) => setAgreementAccepted(event.target.checked)} className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900" />
              <span>I agree to the Purchase Agreement, Terms and Conditions, and Privacy Policy.</span>
            </label>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="panel p-6">
            <h2 className="text-xl font-semibold text-white">Payment method</h2>
            <div className="mt-6 space-y-3">
              {paymentMethods.map((method) => (
                <label key={method} className="panel-muted flex cursor-pointer items-center justify-between p-4">
                  <span className="font-medium text-white">{method}</span>
                  <input type="radio" name="paymentMethod" checked={paymentMethod === method} onChange={() => setPaymentMethod(method)} />
                </label>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-6 text-sm">
              <span className="text-slate-400">Total due now</span>
              <span className="text-2xl font-semibold text-white">{formatCurrency(total)}</span>
            </div>
            <button type="button" disabled={isSubmitting} className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60" onClick={handleCheckout}>
              {isSubmitting ? 'Processing payment...' : 'Complete payment'}
            </button>
            {paymentState.status !== 'idle' ? (
              <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-white">Payment result</p>
                  <StatusBadge status={paymentState.status === 'success' ? 'Paid' : 'Pending'} />
                </div>
                <p className="text-sm text-slate-400">{paymentState.message}</p>
                {paymentState.status === 'failed' ? (
                  <button type="button" className="btn-secondary w-full" onClick={retryPayment}>
                    Retry payment
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="panel p-6">
            <h2 className="text-xl font-semibold text-white">What happens next?</h2>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-400">
              <li>• Order ID is generated instantly.</li>
              <li>• Customer account record is updated.</li>
              <li>• Admin purchase logs are refreshed.</li>
              <li>• Service provisioning begins automatically.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
