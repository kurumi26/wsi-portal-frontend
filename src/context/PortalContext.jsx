import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { portalApi } from '../services/portalApi';
import { desiredDomainRequiredMessage, getCancellationReasonValue, getDesiredDomainValue, normalizeOrderNoteRecords, requiresDesiredDomain } from '../utils/orders';

const PortalContext = createContext(null);

export function PortalProvider({ children }) {
  const { isAuthenticated, isAdmin, isAuthLoading } = useAuth();
  const [services, setServices] = useState([]);
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [myServices, setMyServices] = useState([]);

  // Deduplicate services by name (or id) preferring active/provisioning records over unpaid
  const dedupeServices = (list) => {
    if (!Array.isArray(list)) return [];
    const priority = ['Active', 'Undergoing Provisioning', 'Unpaid', 'Expired'];
    const byName = new Map();

    list.forEach((svc) => {
      const key = svc.name || String(svc.serviceName || svc.id || Math.random());
      const existing = byName.get(key);
      if (!existing) {
        byName.set(key, svc);
        return;
      }

      // Prefer the service with higher status priority (lower index)
      const idxExisting = priority.indexOf(existing.status);
      const idxNew = priority.indexOf(svc.status);
      if (idxNew === -1 && idxExisting !== -1) return; // keep existing if new has no priority
      if (idxExisting === -1 && idxNew !== -1) {
        byName.set(key, svc);
        return;
      }

      if (idxNew < idxExisting) {
        byName.set(key, svc);
        return;
      }

      // If same priority, pick the one with later renewsOn or larger id as a tie-breaker
      const existingTime = existing.renewsOn ? new Date(existing.renewsOn).getTime() : 0;
      const newTime = svc.renewsOn ? new Date(svc.renewsOn).getTime() : 0;
      if (newTime > existingTime) {
        byName.set(key, svc);
        return;
      }

      const existingId = Number(existing.id) || 0;
      const newId = Number(svc.id) || 0;
      if (newId > existingId) {
        byName.set(key, svc);
      }
    });

    return Array.from(byName.values());
  };
  const [notifications, setNotifications] = useState([]);
  const DISMISSED_SYNTH_KEY = 'wsi-dismissed-synth-notifications';

  const getDismissedSynthIds = () => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(DISMISSED_SYNTH_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      return new Set();
    }
  };

  const addDismissedSynthId = (id) => {
    if (typeof window === 'undefined') return;
    try {
      const set = getDismissedSynthIds();
      set.add(id);
      localStorage.setItem(DISMISSED_SYNTH_KEY, JSON.stringify(Array.from(set)));
    } catch (e) {
      // ignore
    }
  };
  const [clients, setClients] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminPurchases, setAdminPurchases] = useState([]);
  const [adminServices, setAdminServices] = useState([]);
  const [paymentState, setPaymentState] = useState({ status: 'idle', message: '' });
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  const normalizeServiceCancellationRecord = (service) => {
    if (!service || typeof service !== 'object') {
      return service;
    }

    const cancellationReason = getCancellationReasonValue(service);
    const cancellationRequest = service.cancellationRequest && typeof service.cancellationRequest === 'object'
      ? {
          ...service.cancellationRequest,
          ...(cancellationReason ? {
            reason: service.cancellationRequest.reason ?? cancellationReason,
            customerNote: service.cancellationRequest.customerNote ?? cancellationReason,
            customer_note: service.cancellationRequest.customer_note ?? cancellationReason,
            note: service.cancellationRequest.note ?? cancellationReason,
            comment: service.cancellationRequest.comment ?? cancellationReason,
          } : {}),
        }
      : service.cancellationRequest;

    return {
      ...service,
      ...(cancellationReason ? {
        customerNote: service.customerNote ?? cancellationReason,
        customer_note: service.customer_note ?? cancellationReason,
        note: service.note ?? cancellationReason,
        comment: service.comment ?? cancellationReason,
      } : {}),
      cancellationRequest,
    };
  };

  const normalizeServiceCancellationRecords = (list) => {
    if (!Array.isArray(list)) {
      return [];
    }

    return list.map((service) => normalizeServiceCancellationRecord(service));
  };

  const sortNotificationsByTime = (list = []) => {
    return [...list].sort((a, b) => {
      const timeA = new Date(a?.createdAt ?? 0).getTime();
      const timeB = new Date(b?.createdAt ?? 0).getTime();

      if (Number.isNaN(timeA) && Number.isNaN(timeB)) return 0;
      if (Number.isNaN(timeA)) return 1;
      if (Number.isNaN(timeB)) return -1;
      return timeB - timeA;
    });
  };

  useEffect(() => {
    const loadServices = async () => {
      try {
        const catalog = await portalApi.getServices();
        setServices(catalog);
      } catch {
        setServices([]);
      }
    };

    loadServices();
  }, []);

  const refreshPortalData = async () => {
    if (!isAuthenticated) {
      setOrders([]);
      setMyServices([]);
      setNotifications([]);
      setClients([]);
      setAdminUsers([]);
      setAdminPurchases([]);
      setAdminServices([]);
      return;
    }

    setIsLoadingPortal(true);

    try {
      if (isAdmin) {
        const [clientData, userData, purchaseData, serviceData, notificationData] = await Promise.all([
          portalApi.getClients(),
          portalApi.getAdminUsers(),
          portalApi.getAdminPurchases(),
          portalApi.getAdminServices(),
          portalApi.getNotifications(),
        ]);

        setClients(clientData);
        setAdminUsers(userData);
        setAdminPurchases(normalizeOrderNoteRecords(purchaseData));
        setAdminServices(normalizeServiceCancellationRecords(serviceData));
        setNotifications(sortNotificationsByTime(notificationData));
        setOrders([]);
        setMyServices([]);
      } else {
        const [orderData, serviceData, notificationData] = await Promise.all([
          portalApi.getOrders(),
          portalApi.getMyServices(),
          portalApi.getNotifications(),
        ]);

        setOrders(normalizeOrderNoteRecords(orderData));
        // Dedupe services to avoid duplicate entries after renew/pay cycles
        setMyServices(dedupeServices(normalizeServiceCancellationRecords(serviceData)));
        // Generate lightweight client-side alerts based on service lifecycle events
        try {
          const synth = [];
          const now = Date.now();
          const NEAR_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

          const timeRemaining = (iso) => {
            if (!iso) return '';
            const ms = new Date(iso).getTime() - Date.now();
            if (ms <= 0) return 'expired';
            const days = Math.floor(ms / (24 * 60 * 60 * 1000));
            if (days >= 1) return `${days} day${days > 1 ? 's' : ''} left`;
            const hours = Math.floor(ms / (60 * 60 * 1000));
            if (hours >= 1) return `${hours} hour${hours > 1 ? 's' : ''} left`;
            const minutes = Math.ceil(ms / (60 * 1000));
            if (minutes >= 1) return `${minutes} minute${minutes > 1 ? 's' : ''} left`;
            return 'less than a minute left';
          };

          (normalizeServiceCancellationRecords(serviceData) || []).forEach((svc) => {
            try {
              if (svc.renewsOn) {
                const t = new Date(svc.renewsOn).getTime() - now;
                if (t > 0 && t <= NEAR_EXPIRE_MS) {
                  synth.push({
                    id: `synth-expire-${svc.id}`,
                      title: `${svc.name} expiring soon`,
                      message: `${svc.name} is expiring in ${timeRemaining(svc.renewsOn)}.`,
                    createdAt: svc.renewsOn || new Date().toISOString(),
                    isRead: false,
                    type: 'danger',
                    data: { serviceId: svc.id },
                    isLocal: true,
                  });
                }
              }

              if (svc.status === 'Undergoing Provisioning') {
                synth.push({
                  id: `synth-provision-${svc.id}`,
                  title: `${svc.name} provisioning`,
                  message: `${svc.name} is currently provisioning. We'll notify you when it's active.`,
                  createdAt: svc.updatedAt || svc.createdAt || new Date().toISOString(),
                  isRead: false,
                  type: 'info',
                  data: { serviceId: svc.id },
                  isLocal: true,
                });
              }

              if (svc.cancellationRequest && svc.cancellationRequest.statusKey === 'pending') {
                synth.push({
                  id: `synth-cancel-${svc.id}`,
                  title: `${svc.name} cancellation requested`,
                  message: `A cancellation request for ${svc.name} is pending admin review.`,
                  createdAt: (svc.cancellationRequest.updatedAt || svc.cancellationRequest.createdAt || new Date().toISOString()),
                  isRead: false,
                  type: 'info',
                  data: { serviceId: svc.id },
                  isLocal: true,
                });
              }

              if (svc.cancellationRequest && svc.cancellationRequest.statusKey === 'approved') {
                synth.push({
                  id: `synth-cancel-approved-${svc.id}`,
                  title: `${svc.name} cancellation approved`,
                  message: `Your cancellation request for ${svc.name} has been approved by admin.`,
                  createdAt: (svc.cancellationRequest.updatedAt || svc.cancellationRequest.createdAt || new Date().toISOString()),
                  isRead: false,
                  type: 'success',
                  data: { serviceId: svc.id },
                  isLocal: true,
                });
              }

              if (svc.cancellationRequest && svc.cancellationRequest.statusKey === 'rejected') {
                synth.push({
                  id: `synth-cancel-rejected-${svc.id}`,
                  title: `${svc.name} cancellation declined`,
                  message: `Your cancellation request for ${svc.name} was declined by admin.`,
                  createdAt: (svc.cancellationRequest.updatedAt || svc.cancellationRequest.createdAt || new Date().toISOString()),
                  isRead: false,
                  type: 'danger',
                  data: { serviceId: svc.id },
                  isLocal: true,
                });
              }
            } catch (e) {
              // ignore per-service errors
            }
          });

          // Prepend synthetic notifications so they appear first in the list
          // Avoid duplicating synth entries if they already exist in notifications
          const serverNotifications = notificationData || [];
          const serverIds = new Set(serverNotifications.map((n) => n.id));
          let uniqueSynth = synth.filter((s) => !serverIds.has(s.id));
          // Filter out synth notifications the user has dismissed locally
          const dismissed = getDismissedSynthIds();
          uniqueSynth = uniqueSynth.filter((s) => !dismissed.has(s.id));
          setNotifications(sortNotificationsByTime([...uniqueSynth, ...serverNotifications]));
        } catch (e) {
          setNotifications(sortNotificationsByTime(notificationData));
        }
        setClients([]);
        setAdminUsers([]);
        setAdminPurchases([]);
        setAdminServices([]);
      }
    } finally {
      setIsLoadingPortal(false);
    }
  };

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    refreshPortalData();
  }, [isAuthenticated, isAdmin, isAuthLoading]);

  useEffect(() => {
    // Listen for broadcast events from other tabs (e.g., cancellation requests)
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;

    const channel = new BroadcastChannel('wsi-portal');
    const handler = (ev) => {
      const msg = ev.data;
      if (!msg || !msg.type) return;

      // Admins should refresh when cancellation requests arrive
      if (msg.type === 'cancellation-request' && isAdmin) {
        refreshPortalData();
      }

      // Customers and other tabs should refresh when an order is approved by an admin
      if (msg.type === 'order-approved') {
        // Refresh for all tabs to ensure UI reflects admin approvals even in the same tab
        refreshPortalData();
      }

      // When a service status is changed by an admin, refresh for all non-admin tabs
      if (msg.type === 'service-status-updated') {
        refreshPortalData();
      }
    };
    channel.addEventListener('message', handler);

    return () => {
      channel.removeEventListener('message', handler);
      channel.close();
    };
  }, [isAdmin, isAuthLoading]);

  const addToCart = (service, configuration, addon) => {
    const computeAddonTotal = (addonInput) => {
      if (addonInput === null || addonInput === undefined) return 0;

      const items = Array.isArray(addonInput) ? addonInput : [addonInput];
      let total = 0;

      items.forEach((a) => {
        if (a === null || a === undefined) return;

        if (typeof a === 'object') {
          if (typeof a.price === 'number') {
            total += Number(a.price);
          }
          return;
        }

        if (typeof a === 'string') {
          // try to match against the provided service's addons (which may contain objects with price)
          if (service && Array.isArray(service.addons)) {
            const found = service.addons.find((opt) => {
              if (opt === null || opt === undefined) return false;
              if (typeof opt === 'object') return (opt.label ?? opt.name) === a;
              return String(opt) === a;
            });

            if (found && typeof found === 'object' && typeof found.price === 'number') {
              total += Number(found.price);
            }
          }
        }
      });

      return total;
    };

    const computeConfigPrice = (configInput) => {
      if (configInput === null || configInput === undefined) return 0;

      const items = Array.isArray(configInput) ? configInput : [configInput];
      let total = 0;

      items.forEach((c) => {
        if (c === null || c === undefined) return;

        if (typeof c === 'object') {
          if (typeof c.price === 'number') {
            total += Number(c.price);
          }
          return;
        }

        if (typeof c === 'string') {
          // try to match against the provided service's configurations (which may contain objects with price)
          if (service && Array.isArray(service.configurations)) {
            const found = service.configurations.find((opt) => {
              if (opt === null || opt === undefined) return false;
              if (typeof opt === 'object') return (opt.label ?? opt.name) === c;
              return String(opt) === c;
            });

            if (found && typeof found === 'object' && typeof found.price === 'number') {
              total += Number(found.price);
            }
          }
        }
      });

      return total;
    };

    const addonTotal = computeAddonTotal(addon);
    const configTotal = computeConfigPrice(configuration);
    const basePrice = typeof service.price === 'number' ? Number(service.price) : Number(service.price || 0);
    const linePrice = Number(basePrice) + Number(addonTotal || 0) + Number(configTotal || 0);

    const lineItem = {
      lineId: `${service.id}-${Date.now()}`,
      serviceId: service.id,
      serviceName: service.name,
      category: service.category,
      price: linePrice,
      billing: service.billing,
      configuration,
      addon,
      desiredDomain: '',
    };

    setCart((current) => [...current, lineItem]);
    return lineItem;
  };

  const removeFromCart = (lineId) => {
    setCart((current) => current.filter((item) => item.lineId !== lineId));
  };

  const updateCartItem = (lineId, updates) => {
    setCart((current) => current.map((item) => (item.lineId === lineId ? { ...item, ...updates } : item)));
  };

  const clearCart = () => setCart([]);

  const placeOrder = async ({ paymentMethod, agreementAccepted }) => {
    if (!agreementAccepted) {
      setPaymentState({ status: 'failed', message: 'You must accept the agreement before completing payment.' });
      return { success: false, message: 'Agreement not accepted' };
    }

    const missingDesiredDomain = cart.some((item) => requiresDesiredDomain(item) && !getDesiredDomainValue(item));
    if (missingDesiredDomain) {
      return { success: false, message: desiredDomainRequiredMessage };
    }

    const sanitizedCart = cart.map((item) => {
      const normalize = (v) => {
        if (v === null || v === undefined) return null;
        if (typeof v === 'object') return v.label ?? v.name ?? String(v);
        return String(v);
      };

      const customerNote = requiresDesiredDomain(item) ? getDesiredDomainValue(item) : '';

      return {
        serviceId: Number(item.serviceId),
        serviceName: String(item.serviceName),
        category: String(item.category),
        configuration: normalize(item.configuration),
        addon: normalize(item.addon),
        price: Number(item.price),
        ...(customerNote ? {
          customerNote,
          customer_note: customerNote,
          desiredDomain: customerNote,
          desired_domain: customerNote,
          note: customerNote,
          comment: customerNote,
        } : {}),
      };
    });

    try {
      console.debug('Checkout payload', { cart: sanitizedCart, paymentMethod, agreementAccepted });
      const response = await portalApi.checkout({
        cart: sanitizedCart,
        paymentMethod,
        agreementAccepted,
      });
      clearCart();
      setPaymentState({ status: 'success', message: response.message });
      await refreshPortalData();
      return { success: true, orders: normalizeOrderNoteRecords(response?.orders ?? []) };
    } catch (error) {
      console.error('Checkout failed', error);
      setPaymentState({ status: 'failed', message: error.message });
      await refreshPortalData();
      return { success: false, message: error.message };
    }
  };

  const retryPayment = () => setPaymentState({ status: 'idle', message: '' });

  const startInvoicePayment = async (input) => {
    const invoiceOrders = Array.isArray(input) ? input : [input];

    const ensureServices = async () => {
      if (!services || !services.length) {
        try {
          const catalog = await portalApi.getServices();
          setServices(catalog);
        } catch (e) {
          // ignore
        }
      }
    };

    await ensureServices();

    const cartItems = invoiceOrders.map((order, index) => {
      let matchingService = services.find((service) => service.name === order.serviceName);

      if (!matchingService) {
        matchingService = services.find((service) => service.name?.toLowerCase() === String(order.serviceName).toLowerCase());
      }

      if (!matchingService) {
        // As a fallback, create a lightweight cart entry for the invoice amount.
        return {
          lineId: `invoice-${order.id}-${Date.now()}-${index}`,
          serviceId: `invoice-${order.id}`,
          serviceName: order.serviceName || `Invoice ${order.id}`,
          category: 'Invoice',
          price: order.amount,
          billing: 'one_time',
          configuration: 'Invoice',
          addon: '',
          desiredDomain: getDesiredDomainValue(order),
          _invoiceFallback: true,
        };
      }

      return {
        lineId: `${matchingService.id}-${Date.now()}-${index}`,
        serviceId: matchingService.id,
        serviceName: matchingService.name,
        category: matchingService.category,
        price: order.amount,
        billing: matchingService.billing,
        configuration: matchingService.configurations[0] ?? 'Standard',
        addon: matchingService.addons[0] ?? '',
        desiredDomain: getDesiredDomainValue(order),
      };
    });

    setPaymentState({ status: 'idle', message: '' });
    setCart(cartItems);
  };

  const updateNotificationStatus = async (notificationId, isRead) => {
    // Handle client-side synthetic notifications without calling the API
    if (String(notificationId).startsWith('synth-')) {
      setNotifications((current) =>
        current.map((notification) => (notification.id === notificationId ? { ...notification, isRead } : notification)),
      );
      return { id: notificationId, isRead };
    }

    const updated = await portalApi.updateNotification(notificationId, isRead);

    setNotifications((current) => current.map((notification) => (notification.id === notificationId ? updated : notification)));

    return updated;
  };

  const markAllNotificationsRead = async () => {
    await portalApi.markAllNotificationsRead();

    setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
  };

  const dismissNotification = async (notificationId) => {
    // Client-side notifications can be dismissed locally
    if (String(notificationId).startsWith('synth-')) {
      // persist dismissal so synthetic notifications do not reappear after refresh
      addDismissedSynthId(notificationId);
      setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
      return null;
    }

    await portalApi.dismissNotification(notificationId);

    setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
  };

  const updateServiceStatus = async (serviceId, status) => {
    const updated = await portalApi.updateServiceStatus(serviceId, status);

    setAdminServices((current) =>
      current.map((service) => (service.id === serviceId ? { ...service, status: updated.status } : service)),
    );

    // Also update customer-facing services cache so customers see the change
    setMyServices((current) =>
      current.map((service) => (service.id === serviceId ? { ...service, status: updated.status } : service)),
    );

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const ch = new BroadcastChannel('wsi-portal');
        ch.postMessage({ type: 'service-status-updated', serviceId, status: updated.status });
        ch.close();
      }
    } catch (e) {
      // ignore
    }

    return updated;
  };

  const createAdminService = async (payload) => {
    const result = await portalApi.createAdminService(payload);
    await refreshPortalData();
    return result;
  };

  const createCatalogService = async (payload) => {
    const result = await portalApi.createCatalogService(payload);
    const catalog = await portalApi.getServices();
    setServices(catalog);
    return result;
  };

  const updateCatalogService = async (serviceId, payload) => {
    const result = await portalApi.updateCatalogService(serviceId, payload);
    await refreshPortalData();
    const catalog = await portalApi.getServices();
    setServices(catalog);
    return result;
  };

  const requestServiceCancellation = async (serviceId, reason = '') => {
    const normalizedReason = reason.trim();

    if (!isAdmin && !normalizedReason) {
      throw new Error('Cancellation reason is required.');
    }

    // Use the admin API when the current user is an admin, otherwise hit the customer endpoint
    const result = isAdmin
      ? await portalApi.requestServiceCancellation(serviceId, normalizedReason)
      : await portalApi.requestCustomerServiceCancellation(serviceId, normalizedReason);
    await refreshPortalData();
    return result;
  };

  const approveServiceCancellation = async (serviceId) => {
    const result = await portalApi.approveServiceCancellation(serviceId);
    await refreshPortalData();
    return result;
  };

  const rejectServiceCancellation = async (serviceId) => {
    const result = await portalApi.rejectServiceCancellation(serviceId);
    await refreshPortalData();
    return result;
  };

  const approveProfileUpdateRequest = async (requestId, note = '') => {
    const result = await portalApi.approveProfileUpdateRequest(requestId, note);
    await refreshPortalData();
    return result;
  };

  const rejectProfileUpdateRequest = async (requestId, note = '') => {
    const result = await portalApi.rejectProfileUpdateRequest(requestId, note);
    await refreshPortalData();
    return result;
  };

  const approveClientRegistration = async (userId, note = '') => {
    const result = await portalApi.approveClientRegistration(userId, note);
    await refreshPortalData();
    return result;
  };

  const rejectClientRegistration = async (userId, note = '') => {
    const result = await portalApi.rejectClientRegistration(userId, note);
    await refreshPortalData();
    return result;
  };

  const updateAdminUser = async (userId, payload) => {
    const result = await portalApi.updateAdminUser(userId, payload);

    setAdminUsers((current) => current.map((user) => (user.id === userId ? result.user : user)));

    return result;
  };

  const createAdminUser = async (payload) => {
    const result = await portalApi.createAdminUser(payload);
    // Always re-fetch from backend to ensure the new user is persisted and visible after reload.
    await refreshPortalData();
    return result;
  };

  const resetAdminUserPassword = async (userId, payload) => {
    return portalApi.resetAdminUserPassword(userId, payload);
  };

  const updateAdminUserStatus = async (userId, enabled) => {
    const result = await portalApi.updateAdminUserStatus(userId, enabled);

    setAdminUsers((current) => current.map((user) => (user.id === userId ? result.user : user)));

    return result;
  };

  const approveAdminOrder = async (orderId) => {
    const result = await portalApi.approveAdminOrder(orderId);
    await refreshPortalData();
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const ch = new BroadcastChannel('wsi-portal');
        ch.postMessage({ type: 'order-approved', orderId });
        ch.close();
      }
    } catch (e) {
      // ignore
    }
    return result;
  };

  const updateClientBilling = async (userId, payload) => {
    const result = await portalApi.updateClientBilling(userId, payload);
    await refreshPortalData();
    return result;
  };

  const updateClientAccount = async (userId, payload) => {
    const result = await portalApi.updateClientAccount(userId, payload);
    await refreshPortalData();
    return result;
  };

  const updateClientAccountStatus = async (userId, enabled) => {
    const result = await portalApi.updateClientAccountStatus(userId, enabled);
    await refreshPortalData();
    return result;
  };

  const stats = useMemo(() => {
    const relevantOrders = adminPurchases.length ? adminPurchases : orders;
    const relevantServices = adminServices.length ? adminServices : myServices;
    const totalRevenue = relevantOrders.reduce((sum, order) => sum + order.amount, 0);
    const activeServices = relevantServices.filter((service) => service.status === 'Active').length;
    const provisioning = relevantServices.filter((service) => service.status === 'Undergoing Provisioning').length;

    return {
      totalRevenue,
      activeServices,
      provisioning,
      totalClients: clients.length,
      totalOrders: relevantOrders.length,
    };
  }, [adminPurchases, adminServices, clients.length, myServices, orders]);

  const value = useMemo(
    () => ({
      services,
      cart,
      orders,
      myServices,
      adminServices,
      adminUsers,
      notifications,
      clients,
      paymentState,
      stats,
      adminPurchases,
      isLoadingPortal,
      addToCart,
      removeFromCart,
      updateCartItem,
      clearCart,
      placeOrder,
      retryPayment,
      startInvoicePayment,
      updateNotificationStatus,
      markAllNotificationsRead,
      dismissNotification,
      createCatalogService,
      updateCatalogService,
      createAdminService,
      requestServiceCancellation,
      approveServiceCancellation,
      rejectServiceCancellation,
      updateServiceStatus,
      approveAdminOrder,
      updateClientBilling,
      updateClientAccount,
      updateClientAccountStatus,
      approveProfileUpdateRequest,
      rejectProfileUpdateRequest,
      approveClientRegistration,
      rejectClientRegistration,
      updateAdminUser,
      createAdminUser,
      resetAdminUserPassword,
      updateAdminUserStatus,
      refreshPortalData,
    }),
    [services, cart, orders, myServices, adminServices, adminUsers, notifications, clients, paymentState, stats, adminPurchases, isLoadingPortal],
  );

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export const usePortal = () => {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error('usePortal must be used within PortalProvider');
  }
  return context;
};
