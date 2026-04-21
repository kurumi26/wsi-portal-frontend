import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, X } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import { usePortal } from '../../context/PortalContext';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { getAddonBillingCycle, getAddonBillingCycleLabel } from '../../utils/addons';
import { desiredDomainRequiredMessage, getDesiredDomainValue, requiresDesiredDomain } from '../../utils/orders';

const paymentMethods = ['Credit Card', 'PayPal', 'Bank Transfer'];

export default function CheckoutPage() {
  const { cart, services, paymentState, placeOrder, removeFromCart, retryPayment, updateCartItem, checkoutAgreementRecord } = usePortal();
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const total = cart.reduce((sum, item) => sum + item.price, 0);
  const missingDesiredDomainItems = cart.filter((item) => requiresDesiredDomain(item) && !getDesiredDomainValue(item));
  const hasMissingDesiredDomains = missingDesiredDomainItems.length > 0;
  const checkoutAgreementAccepted = checkoutAgreementRecord ? checkoutAgreementRecord.status === 'Accepted' : cart.length === 0;
  const checkoutAgreementRejected = checkoutAgreementRecord?.status === 'Rejected';
  const navigate = useNavigate();

  useEffect(() => {
    const cls = 'payment-modal-open';
    if (paymentState && paymentState.status && paymentState.status !== 'idle') {
      document.body.classList.add(cls);
    } else {
      document.body.classList.remove(cls);
    }

    return () => document.body.classList.remove(cls);
  }, [paymentState.status]);

  const handleCheckout = async () => {
    if (hasMissingDesiredDomains) {
      return;
    }

    setIsSubmitting(true);
    await placeOrder({ paymentMethod, agreementAccepted: checkoutAgreementAccepted });
    setIsSubmitting(false);
  };

  const handleDesiredDomainChange = (lineId, value) => {
    updateCartItem(lineId, { desiredDomain: value });
  };

  const renderOption = (opt) => {
    if (opt === null || opt === undefined) return '';
    if (typeof opt === 'object') return opt.label ?? opt.name ?? JSON.stringify(opt);
    return String(opt);
  };

  const getAddonPrice = (addon, item) => {
    if (!addon) return 0;

    if (typeof addon === 'object') {
      return Number(addon.price || 0);
    }

    // string addon - try to resolve from service definition
    const svc = services && services.find((s) => String(s.id) === String(item.serviceId));
    if (svc && Array.isArray(svc.addons)) {
      const found = svc.addons.find((opt) => {
        if (opt === null || opt === undefined) return false;
        if (typeof opt === 'object') return (opt.label ?? opt.name) === addon;
        return String(opt) === addon;
      });

      if (found && typeof found === 'object' && typeof found.price === 'number') {
        return Number(found.price);
      }
    }

    return 0;
  };

  const getAddonBilling = (addon, item) => {
    if (!addon) {
      return '';
    }

    if (typeof addon === 'object') {
      return getAddonBillingCycleLabel(getAddonBillingCycle(addon, item?.billing?.cycle ?? item?.billing), '');
    }

    const svc = services && services.find((service) => String(service.id) === String(item.serviceId));
    if (svc && Array.isArray(svc.addons)) {
      const found = svc.addons.find((opt) => {
        if (opt === null || opt === undefined) return false;
        if (typeof opt === 'object') return (opt.label ?? opt.name) === addon;
        return String(opt) === addon;
      });

      return getAddonBillingCycleLabel(getAddonBillingCycle(found, svc?.billingCycle ?? svc?.billing?.cycle ?? svc?.billing), '');
    }

    return '';
  };

  const getConfigPrice = (config, item) => {
    if (!config) return 0;

    if (typeof config === 'object') {
      return Number(config.price || 0);
    }

    const svc = services && services.find((s) => String(s.id) === String(item.serviceId));
    if (svc && Array.isArray(svc.configurations)) {
      const found = svc.configurations.find((opt) => {
        if (opt === null || opt === undefined) return false;
        if (typeof opt === 'object') return (opt.label ?? opt.name) === config;
        return String(opt) === config;
      });

      if (found && typeof found === 'object' && typeof found.price === 'number') {
        return Number(found.price);
      }
    }

    return 0;
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
                cart.map((item) => {
                  const desiredDomain = getDesiredDomainValue(item);
                  const desiredDomainInputValue = typeof item.desiredDomain === 'string' ? item.desiredDomain : desiredDomain;
                  const showDesiredDomainField = requiresDesiredDomain(item);

                  return (
                    <div key={item.lineId} className="panel-muted flex flex-col gap-4 p-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-white">{item.serviceName}</p>
                        <p className="mt-2 text-sm text-slate-400">
                          Config: {renderOption(item.configuration)}
                          {getConfigPrice(item.configuration, item) ? <span className="ml-2 text-xs text-slate-400">{formatCurrency(getConfigPrice(item.configuration, item))}</span> : null}
                        </p>

                        {Array.isArray(item.addon) && item.addon.length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.addon.map((a, i) => {
                              const price = getAddonPrice(a, item);
                              const billingCycle = getAddonBilling(a, item);
                              return (
                                <span key={`addon-${item.lineId}-${i}`} className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-200">
                                  <span>{renderOption(a)}</span>
                                  {price ? <span className="ml-2 text-xs text-white">{formatCurrency(price)}</span> : null}
                                  {billingCycle ? <span className="ml-2 text-[11px] uppercase tracking-[0.12em] text-slate-400">/{billingCycle}</span> : null}
                                </span>
                              );
                            })}
                          </div>
                        ) : item.addon ? (
                          <p className="mt-2 text-sm text-slate-400">Add-on: {renderOption(item.addon)}{getAddonPrice(item.addon, item) ? <span className="ml-2 text-xs text-white">{formatCurrency(getAddonPrice(item.addon, item))}</span> : null}{getAddonBilling(item.addon, item) ? <span className="ml-2 text-[11px] uppercase tracking-[0.12em] text-slate-400">/{getAddonBilling(item.addon, item)}</span> : null}</p>
                        ) : null}

                        {showDesiredDomainField ? (
                          <div className="mt-4">
                            <label htmlFor={`desired-domain-${item.lineId}`} className="text-sm font-medium text-white">
                              Desired domain / note
                            </label>
                            <textarea
                              id={`desired-domain-${item.lineId}`}
                              rows={3}
                              value={desiredDomainInputValue}
                              onChange={(event) => handleDesiredDomainChange(item.lineId, event.target.value)}
                              placeholder="Enter the exact domain name you want to register, or add a short note for admin review."
                              className={`input mt-3 w-full resize-y ${!desiredDomain ? 'border-white/10' : ''}`}
                              aria-required="true"
                            />
                            <p className="mt-2 text-xs text-slate-500">Required for domain orders. This note is visible to the admin team during review.</p>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-4 md:pt-1">
                        <p className="font-semibold text-white">{formatCurrency(item.price)}</p>
                        <button
                          type="button"
                          className="inline-flex h-8 items-center gap-2 rounded-2xl bg-rose-400 text-white px-3 py-1 hover:bg-rose-500 transition force-white"
                          onClick={() => removeFromCart(item.lineId)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })
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

            {checkoutAgreementRecord ? (
              <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{checkoutAgreementRecord.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">Acceptance is recorded for compliance and audit.</p>
                  </div>
                  <StatusBadge status={checkoutAgreementRecord.status} />
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-300">
                  {checkoutAgreementAccepted
                    ? `Agreement accepted ${formatDateTime(checkoutAgreementRecord.acceptedAt)}. Payment can proceed.`
                    : checkoutAgreementRejected
                      ? 'The agreement pack was rejected. Review it in Contracts and accept it before continuing.'
                      : 'Review and accept the active agreement pack in Contracts before payment can continue.'}
                </p>

                {checkoutAgreementRecord.requiresSignedDocument ? (
                  <p className="mt-2 text-xs leading-6 text-orange-200">Finance may also request a signed copy for this order. You can upload it in Contracts if needed.</p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    to="/contracts"
                    state={{ returnTo: '/checkout', focusContractId: checkoutAgreementRecord.id }}
                    className="btn-secondary"
                  >
                    {checkoutAgreementAccepted ? 'Review Accepted Agreement' : 'Review in Contracts'}
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                Add items to the cart to generate the agreement pack for checkout.
              </div>
            )}
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
            <button
              type="button"
              disabled={isSubmitting || !checkoutAgreementAccepted || hasMissingDesiredDomains || !cart.length}
              aria-disabled={isSubmitting || !checkoutAgreementAccepted || hasMissingDesiredDomains || !cart.length}
              title={
                !cart.length
                  ? 'Your cart is empty'
                  : hasMissingDesiredDomains
                    ? 'Add the desired domain for each domain order to complete payment'
                    : !checkoutAgreementAccepted
                      ? 'Please review and accept the agreement in Contracts before completing payment'
                      : undefined
              }
              className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleCheckout}
            >
              {isSubmitting ? 'Processing payment...' : 'Complete payment'}
            </button>
            {!cart.length ? (
              <p className="mt-2 text-sm text-slate-400">Add at least one service to the cart before completing payment.</p>
            ) : hasMissingDesiredDomains ? (
              <p className="mt-2 text-sm text-slate-400">{desiredDomainRequiredMessage}</p>
            ) : !checkoutAgreementAccepted ? (
              <p className="mt-2 text-sm text-slate-400">Please review and accept the Purchase Agreement, Terms, and Privacy Policy in Contracts to continue.</p>
            ) : null}
            {paymentState.status !== 'idle' ? (
              <div>
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

                {/* modal moved to top-level so it centers across viewport */}
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
      {paymentState.status !== 'idle' ? (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="panel w-full max-w-md p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-orange-300">{paymentState.status === 'success' ? 'Payment Successful' : 'Payment Result'}</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{paymentState.status === 'success' ? 'Payment completed' : 'Payment failed'}</h2>
              </div>
              <button type="button" onClick={() => retryPayment()} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:border-sky-300/30 hover:bg-sky-300/10" aria-label="Close payment result modal">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                {paymentState.status === 'success' ? <CheckCircle size={28} className="text-emerald-400" /> : <XCircle size={28} className="text-rose-400" />}
                <div>
                  <p className="font-medium text-white">{paymentState.message}</p>
                  <p className="text-sm text-slate-400 mt-1">{paymentState.status === 'success' ? 'Your order will be provisioned shortly.' : 'Please try again or contact support.'}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              {paymentState.status === 'success' ? (
                <button
                  type="button"
                  onClick={() => {
                    retryPayment();
                    navigate('/dashboard/orders');
                  }}
                  className="btn-secondary"
                >
                  View orders
                </button>
              ) : (
                <button type="button" onClick={() => retryPayment()} className="btn-secondary">Retry</button>
              )}
              <button type="button" onClick={() => retryPayment()} className="btn-primary">Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
