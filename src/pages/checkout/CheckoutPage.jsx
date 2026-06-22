import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle, ClipboardCheck, Clock, CreditCard, FileText, PackageCheck, ShieldCheck, ShoppingCart, UserCheck, XCircle, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePortal } from '../../context/PortalContext';
import { formatCurrency } from '../../utils/format';
import { getAddonBillingCycle, getAddonBillingCycleLabel, getAddonPrice as resolveAddonPrice } from '../../utils/addons';
import { desiredDomainRequiredMessage, getDesiredDomainValue, requiresDesiredDomain } from '../../utils/orders';

const paymentMethods = ['Credit Card', 'PayPal', 'Bank Transfer'];

export default function CheckoutPage() {
  const { isAuthenticated } = useAuth();
  const { cart, services, paymentState, placeOrder, removeFromCart, retryPayment, updateCartItem, checkoutAgreementRecord } = usePortal();
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAcknowledgedAgreement, setHasAcknowledgedAgreement] = useState(false);
  const [isAgreementModalOpen, setIsAgreementModalOpen] = useState(false);
  const [hasReadAgreement, setHasReadAgreement] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState('summary');
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoStatus, setPromoStatus] = useState(null);
  const agreementContentRef = useRef(null);

  const total = cart.reduce((sum, item) => sum + item.price, 0);
  const promoApplied = promoStatus?.tone === 'success';
  const promoDiscount = promoApplied ? Number((total * 0.1).toFixed(2)) : 0;
  const payableTotal = Math.max(0, total - promoDiscount);
  const missingDesiredDomainItems = cart.filter((item) => requiresDesiredDomain(item) && !getDesiredDomainValue(item));
  const hasMissingDesiredDomains = missingDesiredDomainItems.length > 0;
  const checkoutAgreementConfirmed = cart.length === 0 || hasAcknowledgedAgreement;
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

  useEffect(() => {
    setHasAcknowledgedAgreement(false);
    setHasReadAgreement(false);
  }, [checkoutAgreementRecord?.id, checkoutAgreementRecord?.status, cart.length]);

  useEffect(() => {
    if (!cart.length) {
      setCheckoutStep('summary');
    }
  }, [cart.length]);

  useEffect(() => {
    if (!isAuthenticated && checkoutStep === 'payment') {
      setCheckoutStep('summary');
    }
  }, [checkoutStep, isAuthenticated]);

  useEffect(() => {
    if (!isAgreementModalOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const content = agreementContentRef.current;
      if (content && content.scrollHeight <= content.clientHeight + 2) {
        setHasReadAgreement(true);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isAgreementModalOpen]);

  const handleCheckout = async () => {
    if (!cart.length || hasMissingDesiredDomains) {
      return;
    }

    if (!isAuthenticated) {
      navigate('/auth/login', { state: { returnTo: '/checkout' } });
      return;
    }

    if (!checkoutAgreementConfirmed) {
      return;
    }

    setIsSubmitting(true);
    await placeOrder({ paymentMethod, agreementAccepted: checkoutAgreementConfirmed });
    setIsSubmitting(false);
  };

  const paymentDisabled = isSubmitting
    || hasMissingDesiredDomains
    || !cart.length
    || (isAuthenticated && !checkoutAgreementConfirmed);
  const hasCartItems = cart.length > 0;
  const hasReadyCartDetails = hasCartItems && !hasMissingDesiredDomains;
  const paymentSucceeded = paymentState.status === 'success';
  const paymentFailed = paymentState.status === 'failed';
  const currentTrackingStep = !hasCartItems
    ? 'Add products to cart'
    : hasMissingDesiredDomains
      ? 'Complete required order details'
      : !isAuthenticated
        ? 'Sign in before payment'
        : !hasAcknowledgedAgreement
          ? 'Read and accept agreement'
          : paymentSucceeded
            ? 'Billing review'
            : paymentFailed
              ? 'Payment needs retry'
              : isSubmitting
                ? 'Processing payment'
                : 'Ready for payment';
  const trackingSteps = [
    {
      id: 'cart',
      label: 'Cart',
      description: hasCartItems ? `${cart.length} item${cart.length === 1 ? '' : 's'} selected` : 'Choose products',
      icon: ShoppingCart,
      state: hasCartItems ? 'completed' : 'current',
    },
    {
      id: 'details',
      label: 'Details',
      description: hasMissingDesiredDomains ? 'Domain note required' : 'Required info ready',
      icon: ClipboardCheck,
      state: !hasCartItems ? 'upcoming' : hasReadyCartDetails ? 'completed' : 'current',
    },
    {
      id: 'login',
      label: 'Login',
      description: isAuthenticated ? 'Signed in' : 'Required for payment',
      icon: UserCheck,
      state: !hasReadyCartDetails ? 'upcoming' : isAuthenticated ? 'completed' : 'current',
    },
    {
      id: 'agreement',
      label: 'Agreement',
      description: hasAcknowledgedAgreement ? 'Accepted' : 'Read policy & contract',
      icon: FileText,
      state: !isAuthenticated ? 'upcoming' : hasAcknowledgedAgreement ? 'completed' : 'current',
    },
    {
      id: 'payment',
      label: 'Payment',
      description: paymentSucceeded ? 'Submitted' : paymentFailed ? 'Retry payment' : 'Ready after agreement',
      icon: CreditCard,
      state: !hasAcknowledgedAgreement ? 'upcoming' : paymentSucceeded ? 'completed' : paymentFailed ? 'attention' : 'current',
    },
    {
      id: 'review',
      label: 'Review',
      description: paymentSucceeded ? 'Billing checking invoice' : 'After payment',
      icon: Clock,
      state: paymentSucceeded ? 'current' : 'upcoming',
    },
    {
      id: 'provisioning',
      label: 'Provision',
      description: 'Starts after approval',
      icon: PackageCheck,
      state: 'upcoming',
    },
  ];
  const currentTrackerIndex = Math.max(0, trackingSteps.findIndex((step) => step.state === 'current' || step.state === 'attention'));

  const handleDesiredDomainChange = (lineId, value) => {
    updateCartItem(lineId, { desiredDomain: value });
  };

  const handleAgreementScroll = (event) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 12) {
      setHasReadAgreement(true);
    }
  };

  const handleOpenAgreementModal = () => {
    setIsAgreementModalOpen(true);
    setHasReadAgreement(false);
  };

  const handleContinueCheckout = () => {
    if (!cart.length || hasMissingDesiredDomains) {
      return;
    }

    if (!isAuthenticated) {
      setCheckoutStep('account');
      return;
    }

    if (!hasAcknowledgedAgreement) {
      handleOpenAgreementModal();
      return;
    }

    setCheckoutStep('payment');
  };

  const handleSummaryAction = () => {
    if (checkoutStep === 'payment' && isAuthenticated && hasAcknowledgedAgreement) {
      void handleCheckout();
      return;
    }

    handleContinueCheckout();
  };

  const handleApplyPromo = () => {
    const normalizedCode = promoCode.trim().toUpperCase();

    if (!normalizedCode) {
      setPromoStatus({ tone: 'error', text: 'Enter a promo code first.' });
      return;
    }

    if (normalizedCode === 'WSI10' || normalizedCode === 'WELCOME10') {
      setPromoStatus({ tone: 'success', text: 'Promo applied: 10% estimated checkout discount.' });
      return;
    }

    setPromoStatus({ tone: 'error', text: 'Promo code not recognized.' });
  };

  const renderOption = (opt) => {
    if (opt === null || opt === undefined) return '';
    if (Array.isArray(opt)) {
      return opt.map((entry) => renderOption(entry)).filter(Boolean).join(', ');
    }
    if (typeof opt === 'object') return opt.label ?? opt.name ?? '';
    return String(opt);
  };

  const getCatalogService = (item) => services?.find((service) => String(service.id) === String(item.serviceId));

  const findCatalogAddon = (addon, item) => {
    if (!addon || typeof addon !== 'string') {
      return null;
    }

    const svc = getCatalogService(item);
    if (!svc || !Array.isArray(svc.addons)) {
      return null;
    }

    return svc.addons.find((opt) => {
      if (opt === null || opt === undefined) return false;
      if (typeof opt === 'object') return (opt.label ?? opt.name) === addon;
      return String(opt) === addon;
    });
  };

  const getAddonPrice = (addon, item) => {
    if (!addon) return 0;
    const catalogMatch = typeof addon === 'string' ? findCatalogAddon(addon, item) : null;
    const price = resolveAddonPrice(addon, catalogMatch);
    return typeof price === 'number' && !Number.isNaN(price) ? price : 0;
  };

  const serviceHasAddons = (item) => {
    const svc = getCatalogService(item);
    return Array.isArray(svc?.addons) && svc.addons.length > 0;
  };

  const getAddonBilling = (addon, item) => {
    if (!addon) {
      return '';
    }

    if (typeof addon === 'object') {
      return getAddonBillingCycleLabel(getAddonBillingCycle(addon, item?.billing?.cycle ?? item?.billing), '');
    }

    const found = findCatalogAddon(addon, item);
    const svc = getCatalogService(item);
    if (found || svc) {
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

  const getItemAddons = (item) => {
    if (item.addon === null || item.addon === undefined) {
      return [];
    }

    const entries = Array.isArray(item.addon) ? item.addon : [item.addon];
    return entries.filter((entry) => entry !== null && entry !== undefined && String(entry).trim() !== '');
  };

  return (
    <div>
      <div className="mb-8 grid gap-5 border-b border-slate-200 pb-6 xl:grid-cols-[0.95fr_1.05fr] xl:items-end">
        <div className="min-w-0">

          <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950">Your Cart</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Review your selected WSI products, then sign in only when you are ready to continue payment.
          </p>
        </div>

        <div className="sticky top-[84px] z-40 rounded-[24px] border border-slate-200 bg-white/95 px-4 py-3 shadow-xl shadow-slate-950/10 backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">Live checkout progress</p>
            <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700">
              <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
              {currentTrackingStep}
            </span>
          </div>
          <div className="relative hidden grid-cols-7 gap-2 md:grid">
            <div className="absolute left-[7%] right-[7%] top-5 h-1 rounded-full bg-slate-200" />
            <div
              className="absolute left-[7%] top-5 h-1 rounded-full bg-sky-400 transition-all duration-500"
              style={{ width: `${Math.max(0, (currentTrackerIndex / (trackingSteps.length - 1)) * 86)}%` }}
            />
            {trackingSteps.map((step) => {
              const Icon = step.icon;
              const isCompleted = step.state === 'completed';
              const isCurrent = step.state === 'current';
              const isAttention = step.state === 'attention';

              return (
                <div key={step.id} className="relative flex flex-col items-center text-center">
                  <div
                    className={`z-10 flex h-10 w-10 items-center justify-center rounded-full border-4 bg-white shadow-md transition ${
                      isCompleted
                        ? 'border-sky-400 text-sky-700'
                        : isCurrent
                          ? 'border-sky-400 bg-sky-50 text-slate-950 ring-4 ring-sky-100'
                          : isAttention
                            ? 'border-rose-300 bg-rose-50 text-rose-600 ring-4 ring-rose-100'
                            : 'border-slate-200 text-slate-300'
                    }`}
                  >
                    {isCompleted ? <CheckCircle size={19} /> : <Icon size={17} />}
                  </div>
                  <p className={`mt-2 text-[11px] font-black ${isCompleted || isCurrent ? 'text-slate-950' : isAttention ? 'text-rose-600' : 'text-slate-500'}`}>
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 md:hidden">
          {trackingSteps.map((step) => {
            const Icon = step.icon;
            const isCompleted = step.state === 'completed';
            const isCurrent = step.state === 'current';
            const isAttention = step.state === 'attention';

            return (
              <div
                key={step.id}
                className={`min-w-32 rounded-2xl border p-3 ${
                  isCurrent
                    ? 'border-sky-300 bg-sky-50'
                    : isAttention
                      ? 'border-rose-200 bg-rose-50'
                      : isCompleted
                        ? 'border-sky-100 bg-white'
                        : 'border-slate-200 bg-slate-50'
                }`}
              >
                <span className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  isCompleted
                    ? 'bg-sky-100 text-sky-700'
                    : isCurrent
                      ? 'bg-sky-300 text-slate-950'
                      : isAttention
                        ? 'bg-rose-100 text-rose-600'
                        : 'bg-white text-slate-300'
                }`}
                >
                  {isCompleted ? <CheckCircle size={19} /> : <Icon size={18} />}
                </span>
                <p className="mt-2 text-sm font-black text-slate-950">{step.label}</p>
                <p className="mt-1 text-xs leading-4 text-slate-600">{step.description}</p>
              </div>
            );
          })}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-950/5 sm:p-6">
            <h2 className="text-2xl font-black text-slate-950">Cart items</h2>
            <p className="mt-1 text-sm text-slate-600">
              {hasCartItems ? `${cart.length} selected product${cart.length === 1 ? '' : 's'}` : 'Your cart is empty.'}
            </p>
            <div className="mt-6 space-y-4">
              {cart.length ? (
                cart.map((item) => {
                  const desiredDomain = getDesiredDomainValue(item);
                  const desiredDomainInputValue = typeof item.desiredDomain === 'string' ? item.desiredDomain : desiredDomain;
                  const showDesiredDomainField = requiresDesiredDomain(item);

                  return (
                    <div key={item.lineId} className="flex flex-col gap-4 rounded-none border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-start md:justify-between">
                      <div className="flex min-w-0 flex-1 gap-4">
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-slate-100">
                          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white px-1">
                            <img src="/logo-light.png" alt="WSI" className="h-7 w-auto object-contain" />
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="font-black text-slate-950">{item.serviceName}</p>
                          <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{item.category}</p>
                          <div className="mt-3 inline-flex rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-bold text-slate-950">
                            {renderOption(item.configuration) || 'Standard'}
                          </div>
                          {getConfigPrice(item.configuration, item) ? <span className="ml-2 text-xs text-slate-500">{formatCurrency(getConfigPrice(item.configuration, item))}</span> : null}

                        <div className="mt-3">
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Add-ons</p>
                          {getItemAddons(item).length ? (
                            <div className="mt-2 space-y-1">
                              {getItemAddons(item).map((addon, addonIndex) => {
                                const price = getAddonPrice(addon, item);
                                const billingCycle = getAddonBilling(addon, item);
                                return (
                                  <p key={`addon-line-${item.lineId}-${addonIndex}`} className="text-sm text-slate-600">
                                    <span className="font-semibold text-slate-800">{renderOption(addon)}</span>
                                    {price ? <span className="ml-2 text-xs font-bold text-slate-950">{formatCurrency(price)}</span> : null}
                                    {billingCycle ? <span className="ml-2 text-[11px] uppercase tracking-[0.12em] text-slate-500">/{billingCycle}</span> : null}
                                  </p>
                                );
                              })}
                            </div>
                          ) : serviceHasAddons(item) ? (
                            <p className="mt-2 text-sm text-slate-500">No add-ons selected.</p>
                          ) : (
                            <p className="mt-2 text-sm text-slate-500">No Add Ons Available</p>
                          )}
                        </div>

                        {showDesiredDomainField ? (
                          <div className="mt-4">
                            <label htmlFor={`desired-domain-${item.lineId}`} className="text-sm font-bold text-slate-950">
                              Desired domain / note <span className="text-rose-500 ml-1" aria-hidden="true">*</span>
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
                            <p className="mt-2 text-xs font-bold text-slate-500">Required for domain orders. This note is visible to the admin team during review.</p>
                          </div>
                        ) : null}
                      </div>
                      </div>
                      <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-4 md:flex-col md:items-end md:border-t-0 md:pt-1">
                        <p className="text-lg font-black text-slate-950">{formatCurrency(item.price)}</p>
                        <button
                          type="button"
                          className="text-xs font-bold text-slate-500 underline transition hover:text-rose-600"
                          onClick={() => removeFromCart(item.lineId)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  Your cart is empty. <Link to="/services" className="font-bold text-sky-700">Browse services</Link>
                </div>
              )}
            </div>
          </div>

        </div>

        <aside className="space-y-6 xl:sticky xl:top-72 xl:self-start">
          <div className="rounded-none border border-slate-200 bg-slate-50 p-5 shadow-xl shadow-slate-950/5 sm:p-6">
            <h2 className="text-2xl font-black text-slate-950">Order Summary</h2>
            <p className="mt-5 text-sm font-semibold text-slate-700">
              {cart.length} {cart.length === 1 ? 'item' : 'items'}
            </p>

            {cart.length ? (
              <div className="mt-4 space-y-2 border-t border-slate-300 pt-4">
                {cart.map((item) => {
                  const itemAddons = getItemAddons(item);

                  return (
                    <div key={`summary-${item.lineId}`} className="border-b border-slate-200 pb-3 last:border-b-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-950">{item.serviceName}</p>
                          <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{item.category}</p>
                        </div>
                        <p className="shrink-0 text-sm font-black text-sky-700">{formatCurrency(item.price)}</p>
                      </div>
                      {itemAddons.length ? (
                        <div className="mt-2 space-y-1">
                          {itemAddons.map((addon, addonIndex) => {
                            const price = getAddonPrice(addon, item);
                            const billingCycle = getAddonBilling(addon, item);
                            return (
                              <p key={`summary-addon-${item.lineId}-${addonIndex}`} className="text-xs text-slate-600">
                                + {renderOption(addon)}
                                {price ? <span className="ml-1 font-bold text-slate-800">{formatCurrency(price)}</span> : null}
                                {billingCycle ? <span className="ml-1 uppercase tracking-[0.1em] text-slate-400">/{billingCycle}</span> : null}
                              </p>
                            );
                          })}
                        </div>
                      ) : serviceHasAddons(item) ? (
                        <p className="mt-2 text-xs text-slate-500">No add-ons selected.</p>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">No Add Ons Available</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="mt-4 border-t border-slate-300 pt-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-lg font-black text-slate-950">Subtotal (PHP)</span>
                <span className="text-2xl font-black text-sky-700">{formatCurrency(total)}</span>
              </div>
              {promoApplied ? (
                <div className="mt-3 flex items-center justify-between gap-4 text-sm">
                  <span className="font-bold text-slate-600">Promo discount</span>
                  <span className="font-black text-sky-700">- {formatCurrency(promoDiscount)}</span>
                </div>
              ) : null}
              <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-200 pt-4">
                <span className="text-sm font-black text-slate-950">Estimated total</span>
                <span className="text-xl font-black text-slate-950">{formatCurrency(payableTotal)}</span>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-600">Subtotal does not include applicable taxes and fees.</p>
              <button
                type="button"
                onClick={() => setPromoOpen((current) => !current)}
                className="mt-2 text-xs font-black text-slate-950 underline"
              >
                {promoOpen ? 'Hide promo code' : 'Have a promo code?'}
              </button>
              {promoOpen ? (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <label className="block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="promo-code">
                    Promo code
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      id="promo-code"
                      value={promoCode}
                      onChange={(event) => {
                        setPromoCode(event.target.value);
                        setPromoStatus(null);
                      }}
                      placeholder="Try WSI10"
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-950 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                    />
                    <button type="button" onClick={handleApplyPromo} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white force-white">
                      Apply
                    </button>
                  </div>
                  {promoStatus ? (
                    <p className={`mt-2 text-xs font-bold ${promoStatus.tone === 'success' ? 'text-sky-700' : 'text-rose-600'}`}>
                      {promoStatus.text}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {checkoutStep === 'account' && !isAuthenticated ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                <button
                  type="button"
                  onClick={() => setCheckoutStep('summary')}
                  className="mb-3 text-sm font-bold text-sky-700"
                >
                  ‹ Back
                </button>
                <h3 className="text-2xl font-black text-slate-950">Create account</h3>
                <div className="mt-4 rounded-xl bg-slate-100 p-4 text-sm leading-6 text-slate-700">
                  By clicking continue or sign in below, you agree to WSI's Terms of Service and Privacy Policy.
                </div>
                <p className="mt-4 text-sm text-slate-700">
                  Already have an account?{' '}
                  <Link to="/auth/login" state={{ returnTo: '/checkout' }} className="font-black text-slate-950 underline">
                    Sign In
                  </Link>
                </p>
                <div className="mt-4 space-y-3">
                  <Link to="/auth/register" state={{ returnTo: '/checkout' }} className="flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-50">
                    Continue with Email
                  </Link>
                  <Link to="/auth/register" state={{ returnTo: '/checkout' }} className="flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-50">
                    Continue with Google
                  </Link>
                  <Link to="/auth/register" state={{ returnTo: '/checkout' }} className="flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-50">
                    Continue with Facebook
                  </Link>
                </div>
              </div>
            ) : null}

            {checkoutStep === 'payment' && isAuthenticated ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Payment method</p>
              <div className="mt-3 space-y-2">
              {paymentMethods.map((method) => (
                <label key={method} className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <span className="text-sm font-bold text-slate-950">{method}</span>
                  <input type="radio" name="paymentMethod" checked={paymentMethod === method} onChange={() => setPaymentMethod(method)} className="accent-sky-400" />
                </label>
              ))}
              </div>
              </div>
            ) : null}

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-slate-700">Agreement</span>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${hasAcknowledgedAgreement ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'}`}>
                  {hasAcknowledgedAgreement ? 'Accepted' : 'Pending'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleOpenAgreementModal}
                disabled={!cart.length}
                className="mt-3 w-full rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-black text-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Read policy & contract
              </button>
            </div>

            <button
              type="button"
              disabled={checkoutStep === 'payment' ? paymentDisabled : isSubmitting || hasMissingDesiredDomains || !cart.length}
              aria-disabled={checkoutStep === 'payment' ? paymentDisabled : isSubmitting || hasMissingDesiredDomains || !cart.length}
              title={
                !cart.length
                  ? 'Your cart is empty'
                  : hasMissingDesiredDomains
                    ? 'Add the desired domain for each domain order to complete payment'
                    : !isAuthenticated
                      ? 'Sign in to continue to secure payment'
                      : !hasAcknowledgedAgreement
                        ? 'Read and accept the agreement before completing payment'
                      : undefined
              }
              className="mt-5 w-full bg-slate-950 px-5 py-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 force-white"
              onClick={handleSummaryAction}
            >
              {isSubmitting
                ? 'Processing payment...'
                : checkoutStep === 'payment' && isAuthenticated
                  ? 'Complete payment'
                  : checkoutStep === 'account' && !isAuthenticated
                    ? 'Choose account option below'
                    : 'Continue Checkout'}
            </button>
            {!cart.length ? (
              <p className="mt-3 text-xs leading-5 text-slate-600">Add at least one service to the cart before completing payment.</p>
            ) : hasMissingDesiredDomains ? (
              <p className="mt-3 text-xs leading-5 text-slate-600">{desiredDomainRequiredMessage}</p>
            ) : !isAuthenticated ? (
              <p className="mt-3 text-xs leading-5 text-slate-600">Your cart is saved here. Sign in when you are ready to continue payment in the customer portal.</p>
            ) : !hasAcknowledgedAgreement ? (
              <p className="mt-3 text-xs leading-5 text-slate-600">Open the policy and contract modal, scroll to the bottom, then accept before continuing.</p>
            ) : null}
            {paymentState.status !== 'idle' ? (
              <div>
                <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-950">Checkout result</p>
                    <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-sky-700">
                      {paymentState.status === 'success' ? 'Pending Review' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{paymentState.message}</p>
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

          <div className="rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-xl shadow-slate-950/5">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-sky-50 text-sky-700">
              <ShieldCheck size={21} />
            </div>
            <p className="mt-3 text-sm font-black text-slate-950">Quality You Can Trust</p>
            <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-slate-600">
              Your WSI checkout progress stays visible above so customers always know where they are.
            </p>
          </div>
        </aside>
      </div>
      {isAgreementModalOpen ? (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/55 p-4">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-slate-950/30">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-700">Review required</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Policy and contract agreement</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Scroll to the bottom to unlock the “I accept” checkbox.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAgreementModalOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 transition hover:bg-slate-100"
                aria-label="Close agreement modal"
              >
                <X size={18} />
              </button>
            </div>

            <div ref={agreementContentRef} onScroll={handleAgreementScroll} className="max-h-[55vh] overflow-y-auto px-5 py-5 sm:px-6">
              <div className="space-y-6 text-sm leading-7 text-slate-700">
                <section>
                  <h3 className="text-lg font-black text-slate-950">1. Purchase Agreement</h3>
                  <p className="mt-2">
                    This order creates a service request with WSI. All selected services are subject to provisioning validation,
                    product availability, fraud prevention checks, billing confirmation, and admin approval before activation.
                  </p>
                  <p className="mt-2">
                    The products listed in your cart define the scope of this purchase. Any domain, hosting, cloud, SSL,
                    backup, security, or add-on service may require additional details from you before provisioning can begin.
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-black text-slate-950">2. Order Contract Summary</h3>
                  <div className="mt-3 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    {cart.length ? cart.map((item) => (
                      <div key={`agreement-${item.lineId}`} className="border-b border-slate-200 pb-3 last:border-b-0 last:pb-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-slate-950">{item.serviceName}</p>
                            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{item.category}</p>
                          </div>
                          <p className="shrink-0 font-black text-slate-950">{formatCurrency(item.price)}</p>
                        </div>
                        <p className="mt-2 text-slate-600">Configuration: {renderOption(item.configuration) || 'Standard'}</p>
                        <div className="mt-2">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Add-ons</p>
                          {getItemAddons(item).length ? (
                            <div className="mt-1 space-y-1">
                              {getItemAddons(item).map((addon, addonIndex) => {
                                const price = getAddonPrice(addon, item);
                                const billingCycle = getAddonBilling(addon, item);
                                return (
                                  <p key={`agreement-addon-${item.lineId}-${addonIndex}`} className="text-slate-600">
                                    + {renderOption(addon)}
                                    {price ? <span className="ml-2 font-bold text-slate-950">{formatCurrency(price)}</span> : null}
                                    {billingCycle ? <span className="ml-2 text-[11px] uppercase tracking-[0.12em] text-slate-500">/{billingCycle}</span> : null}
                                  </p>
                                );
                              })}
                            </div>
                          ) : serviceHasAddons(item) ? (
                            <p className="mt-1 text-slate-500">No add-ons selected.</p>
                          ) : (
                            <p className="mt-1 text-slate-500">No Add Ons Available</p>
                          )}
                        </div>
                      </div>
                    )) : (
                      <p>No cart items are currently selected.</p>
                    )}
                  </div>
                </section>

                <section>
                  <h3 className="text-lg font-black text-slate-950">3. Terms and Conditions</h3>
                  <p className="mt-2">
                    Billing terms, renewal schedules, cancellation rules, applicable taxes, domain registration rules,
                    acceptable-use requirements, and service-level limitations apply based on the products selected.
                  </p>
                  <p className="mt-2">
                    You agree to provide accurate account, billing, domain, contact, and technical information. WSI may pause
                    or reject provisioning if required information is incomplete, suspicious, invalid, or conflicts with policy.
                  </p>
                  <p className="mt-2">
                    Some services renew monthly, yearly, or one time depending on their product configuration. Add-ons may
                    follow a different cycle from the base service where shown in the cart.
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-black text-slate-950">4. Privacy Policy</h3>
                  <p className="mt-2">
                    WSI may collect and process account, order, billing, domain, and technical information for service
                    delivery, billing, customer support, compliance, security monitoring, audit, and legal requirements.
                  </p>
                  <p className="mt-2">
                    Customer data is handled with reasonable administrative, technical, and operational safeguards. You are
                    responsible for ensuring that information you submit is lawful, accurate, and authorized.
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-black text-slate-950">5. Payment and Provisioning</h3>
                  <p className="mt-2">
                    Payment submission does not guarantee immediate activation. Billing review and admin approval must finish
                    before provisioning starts. WSI may contact you for clarification, supporting documents, or corrected
                    information before completing the order.
                  </p>
                  <p className="mt-2">
                    By accepting this agreement, you confirm that you reviewed the policy and contract, understand the order
                    summary, and are authorized to continue with payment for the listed products.
                  </p>
                </section>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
              <label className={`flex items-start gap-3 ${hasReadAgreement ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                <input
                  type="checkbox"
                  checked={hasAcknowledgedAgreement}
                  onChange={(event) => setHasAcknowledgedAgreement(event.target.checked)}
                  disabled={!hasReadAgreement}
                  className="mt-1 h-4 w-4 rounded border-slate-300 accent-sky-400 disabled:cursor-not-allowed"
                />
                <span className="text-sm leading-6 text-slate-700">
                  I accept the Purchase Agreement, Terms & Conditions, Privacy Policy, and order contract for this cart.
                </span>
              </label>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold text-slate-500">
                  {hasReadAgreement ? 'You reached the end. The checkbox is now enabled.' : 'Scroll to the bottom of the agreement to enable acceptance.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsAgreementModalOpen(false);
                    if (isAuthenticated) {
                      setCheckoutStep('payment');
                    }
                  }}
                  disabled={!hasReadAgreement || !hasAcknowledgedAgreement}
                  className="btn-primary rounded-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Continue to payment
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {paymentState.status !== 'idle' ? (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="panel w-full max-w-md p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-orange-300">{paymentState.status === 'success' ? 'Order Submitted' : 'Payment Result'}</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{paymentState.status === 'success' ? 'Checkout submitted' : 'Payment failed'}</h2>
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
                  <p className="text-sm text-slate-400 mt-1">{paymentState.status === 'success' ? 'Billing review and admin approval must finish before provisioning begins.' : 'Please try again or contact support.'}</p>
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
