import { useState, useEffect, useRef, useCallback } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { OrderSkeleton } from "@/components/ui/skeleton";
import {
  Package, Search, Clock, CheckCircle2, Truck, MapPin,
  XCircle, AlertTriangle, RefreshCw, Box, Star, Loader2, Gift, Heart
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatPrice, cn, getApiUrl } from "@/lib/utils";

const inputClass = "w-full px-4 py-3.5 rounded-xl text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-gray-400";
const inputStyle = { background: 'white', border: '1px solid #e5e7eb', color: '#111827' };

const PAYMENT_STATUSES: Record<string, { label: string; color: string; bg: string; border: string; icon: typeof XCircle; desc: string }> = {
  pending: {
    label: 'Not Paid', color: '#ef4444', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.15)',
    icon: XCircle, desc: 'Payment not yet received'
  },
  not_paid: {
    label: 'Not Paid', color: '#ef4444', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.15)',
    icon: XCircle, desc: 'Payment not yet received'
  },
  submitted: {
    label: 'Under Review', color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.15)',
    icon: RefreshCw, desc: 'Your payment is being verified by admin'
  },
  verified: {
    label: 'Payment Confirmed', color: '#22c55e', bg: 'rgba(34,197,94,0.06)', border: 'rgba(34,197,94,0.15)',
    icon: CheckCircle2, desc: 'Payment received and confirmed!'
  },
  wrong: {
    label: 'Payment Issue', color: '#ef4444', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.15)',
    icon: AlertTriangle, desc: 'Issue with payment — contact us on WhatsApp'
  },
  cod: {
    label: 'Cash on Delivery', color: '#16a34a', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.2)',
    icon: CheckCircle2, desc: 'Pay when you receive your order'
  },
};

const ORDER_STEPS = [
  { key: 'pending', icon: Clock, label: 'Order Placed', desc: 'Your order has been received' },
  { key: 'processing', icon: Package, label: 'Processing', desc: 'Order is being prepared' },
  { key: 'shipped', icon: Box, label: 'Shipped', desc: 'Sent to delivery partner' },
  { key: 'ongoing', icon: Truck, label: 'On the Way', desc: 'Your order is in transit' },
  { key: 'delivered', icon: CheckCircle2, label: 'Delivered', desc: 'Successfully delivered!' },
];

function getOrderStepIndex(status: string): number {
  const map: Record<string, number> = {
    pending: 0, processing: 1, shipped: 2, ongoing: 3, delivered: 4, cancelled: -1,
  };
  return map[status] ?? 0;
}

type TrackBody = { orderNumber: string; email?: string; phone?: string };

async function fetchTrack(body: TrackBody, signal?: AbortSignal): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(getApiUrl('/api/orders/track'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (res.ok) return await res.json();
    return null;
  } catch {
    return null;
  }
}

function buildTrackBody(oNum: string, identifier: string): TrackBody {
  const isEmail = identifier.includes("@");
  return isEmail
    ? { orderNumber: oNum.toUpperCase(), email: identifier.toLowerCase().trim() }
    : { orderNumber: oNum.toUpperCase(), phone: identifier.trim() };
}

export default function TrackOrder() {
  const settings = useSiteSettings();
  const [orderNumber, setOrderNumber] = useState("");
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [trackError, setTrackError] = useState(false);
  const [liveOrderData, setLiveOrderData] = useState<Record<string, unknown> | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const didAutoTrack = useRef(false);
  const identifierRef = useRef("");

  // Auto-track when redirected from order completion (URL has ?order=&phone= or ?order=&email=)
  useEffect(() => {
    if (didAutoTrack.current) return;
    const params = new URLSearchParams(window.location.search);
    const oNum = (params.get("order") || params.get("orderNumber") || "").toUpperCase();
    const identifier = params.get("phone") || params.get("email") || "";
    if (oNum && identifier) {
      didAutoTrack.current = true;
      setOrderNumber(oNum);
      setEmailOrPhone(identifier);
      identifierRef.current = identifier;
      setHasSearched(true);
      setIsPending(true);
      setTrackError(false);
      const ctrl = new AbortController();
      fetchTrack(buildTrackBody(oNum, identifier), ctrl.signal).then(d => {
        if (d) setLiveOrderData(d);
        else setTrackError(true);
      }).finally(() => setIsPending(false));
      return () => ctrl.abort();
    }
    return undefined;
  }, []);

  // Live polling every 12 seconds once we have order data
  useEffect(() => {
    if (liveOrderData && liveOrderData.orderNumber) {
      setIsPolling(true);
      const poll = async () => {
        const id = identifierRef.current || emailOrPhone;
        if (!id) return;
        const d = await fetchTrack(
          buildTrackBody(String(liveOrderData.orderNumber), id),
          AbortSignal.timeout(10000)
        );
        if (d) setLiveOrderData(d);
      };
      pollingRef.current = setInterval(poll, 12000);
      return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setIsPolling(false);
      };
    }
    return undefined;
  }, [liveOrderData?.orderNumber]);

  const handleTrack = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const oNum = orderNumber.trim().toUpperCase();
    const id = emailOrPhone.trim();
    if (!oNum || !id) return;
    identifierRef.current = id;
    setHasSearched(true);
    setIsPending(true);
    setTrackError(false);
    setLiveOrderData(null);
    if (pollingRef.current) clearInterval(pollingRef.current);
    const d = await fetchTrack(buildTrackBody(oNum, id), AbortSignal.timeout(15000));
    if (d) {
      setLiveOrderData(d);
      setTrackError(false);
    } else {
      setTrackError(true);
    }
    setIsPending(false);
  }, [orderNumber, emailOrPhone]);

  const error = trackError;

  const displayOrder = liveOrderData as Record<string, unknown> | null;
  const stepIdx = displayOrder ? getOrderStepIndex(displayOrder.status as string) : -1;
  const paymentInfo = displayOrder ? PAYMENT_STATUSES[(displayOrder.paymentStatus as string)] || PAYMENT_STATUSES.pending : null;
  const PayIcon = paymentInfo?.icon;

  const TRYNEX_NUMBER = settings.whatsappNumber
    ? (settings.whatsappNumber.startsWith('+') ? settings.whatsappNumber : `+88${settings.whatsappNumber.replace(/[^0-9]/g, '')}`)
    : (settings.phone || "+8801903426915");

  const paymentMethodLabel: Record<string, string> = {
    cod: 'Cash on Delivery', bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket'
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEOHead
        title="Track Your Order"
        description="Track your TryNex Lifestyle order in real-time. Enter your order number to see live delivery status updates."
        canonical="/track"
        keywords="track order trynex, order tracking bangladesh"
      />
      <Navbar />

      <main className="flex-1 pt-header pb-24 flex flex-col items-center">
        <div className="max-w-2xl w-full px-4 sm:px-6">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex w-20 h-20 rounded-3xl items-center justify-center mb-6"
              style={{ background: 'rgba(232,93,4,0.08)', border: '1px solid rgba(232,93,4,0.15)' }}>
              <MapPin className="w-9 h-9 text-orange-500" />
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-primary mb-3">Live Tracking</p>
            <h1 className="text-5xl font-black font-display tracking-tighter mb-4">Track Your Order</h1>
            <p className="text-gray-400 text-base">Real-time updates on your TryNex order status.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-7 rounded-3xl mb-8"
            style={{ background: 'white', border: '1px solid #e5e7eb' }}
          >
            <form onSubmit={handleTrack} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">
                    Order Number *
                  </label>
                  <input
                    required
                    type="text"
                    inputMode="text"
                    autoCapitalize="characters"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="search"
                    placeholder="e.g. TN250325XXXX"
                    value={orderNumber}
                    onChange={e => setOrderNumber(e.target.value.toUpperCase())}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">
                    Email or Phone Number *
                  </label>
                  <input
                    required
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="search"
                    placeholder="your@email.com or 01XXXXXXXXX"
                    value={emailOrPhone}
                    onChange={e => setEmailOrPhone(e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isPending || !orderNumber || !emailOrPhone}
                className="btn-glow w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2.5 text-base disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)', boxShadow: '0 6px 24px rgba(232,93,4,0.35)' }}
              >
                {isPending ? <><Loader2 className="w-5 h-5 animate-spin" /> Searching...</> : <><Search className="w-5 h-5" /> Track Order</>}
              </button>
            </form>
          </motion.div>

          <AnimatePresence>
            {isPending && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4 mb-6"
                aria-label="Searching for order"
                aria-busy="true"
              >
                <OrderSkeleton />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {hasSearched && !isPending && error && !displayOrder && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center p-6 rounded-2xl text-sm font-semibold mb-6"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}
              >
                <XCircle className="w-6 h-6 mx-auto mb-2 opacity-70" />
                Order not found. Please check your Order Number and Email, then try again.
                <p className="text-xs text-gray-400 mt-2">Need help? WhatsApp: {TRYNEX_NUMBER}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {displayOrder && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Main Card */}
                <div className="rounded-3xl overflow-hidden"
                  style={{ background: 'white', border: '1px solid #e5e7eb' }}>

                  {/* Status Header */}
                  <div className="p-6 sm:p-8"
                    style={{ background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)' }}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Order Reference</p>
                        <p className="text-2xl font-black font-mono text-primary">{displayOrder.orderNumber as string}</p>
                      </div>
                      {isPolling && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Live</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mb-8">
                      Placed on {displayOrder.createdAt ? new Date(displayOrder.createdAt as string).toLocaleString('en-BD', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}
                    </p>

                    {(displayOrder.status as string) !== 'cancelled' ? (
                      <div>
                        {/* Current Status Banner */}
                        <div className="mb-6 p-4 rounded-2xl flex items-center gap-3"
                          style={{
                            background: stepIdx === 4 ? 'rgba(34,197,94,0.08)' : 'rgba(232,93,4,0.06)',
                            border: `1px solid ${stepIdx === 4 ? 'rgba(34,197,94,0.2)' : 'rgba(232,93,4,0.15)'}`
                          }}>
                          {(() => { const CurrentIcon = ORDER_STEPS[stepIdx >= 0 ? stepIdx : 0].icon; return <CurrentIcon className="w-6 h-6 shrink-0" style={{ color: stepIdx === 4 ? '#22c55e' : '#E85D04' }} />; })()}
                          <div>
                            <p className="font-black text-sm" style={{ color: stepIdx === 4 ? '#16a34a' : '#E85D04' }}>
                              {ORDER_STEPS[stepIdx >= 0 ? stepIdx : 0].label}
                            </p>
                            <p className="text-xs text-gray-500">{ORDER_STEPS[stepIdx >= 0 ? stepIdx : 0].desc}</p>
                          </div>
                        </div>

                        {/* Progress Steps */}
                        <div className="relative">
                          <div className="absolute top-5 left-5 right-5 h-0.5 rounded-full" style={{ background: '#e5e7eb' }} />
                          {stepIdx > 0 && (
                            <div
                              className="absolute top-5 left-5 h-0.5 rounded-full transition-all duration-1000"
                              style={{
                                background: 'linear-gradient(90deg, #E85D04, #FB8500)',
                                width: `${(stepIdx / (ORDER_STEPS.length - 1)) * (100 - 12)}%`,
                                maxWidth: 'calc(100% - 40px)'
                              }}
                            />
                          )}
                          <div className="relative flex justify-between">
                            {ORDER_STEPS.map((step, i) => {
                              const isActive = stepIdx >= i;
                              const isCurrent = stepIdx === i;
                              const Icon = step.icon;
                              return (
                                <div key={step.key} className="flex flex-col items-center gap-2 z-10">
                                  <motion.div
                                    animate={isCurrent ? { scale: [1, 1.15, 1] } : {}}
                                    transition={{ repeat: Infinity, duration: 2 }}
                                    className="w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500"
                                    style={{
                                      background: isActive ? (stepIdx === 4 && i === 4 ? '#22c55e' : 'hsl(var(--primary))') : 'white',
                                      borderColor: isActive ? (stepIdx === 4 && i === 4 ? '#22c55e' : 'hsl(var(--primary))') : '#e5e7eb',
                                      color: isActive ? 'white' : '#d1d5db',
                                      boxShadow: isCurrent ? (stepIdx === 4 ? '0 0 20px rgba(34,197,94,0.5)' : '0 0 20px rgba(255,107,43,0.5)') : undefined
                                    }}
                                  >
                                    <Icon className="w-4 h-4" />
                                  </motion.div>
                                  <span className={cn("text-[10px] font-black text-center", isActive ? "text-gray-700" : "text-gray-300")}>
                                    {step.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-4 rounded-2xl"
                        style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                        <XCircle className="w-6 h-6 text-red-500" />
                        <div>
                          <p className="font-black text-red-500">Order Cancelled</p>
                          <p className="text-xs text-gray-400">Contact us if you need assistance</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Payment Status */}
                  {paymentInfo && (displayOrder.paymentMethod as string) !== 'cod' && (
                    <div className="px-6 sm:px-8 py-5 border-t border-gray-100">
                      <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Payment Status</p>
                      <div className="flex items-center gap-4 p-4 rounded-2xl"
                        style={{ background: paymentInfo.bg, border: `1px solid ${paymentInfo.border}` }}>
                        {PayIcon && <PayIcon className="w-6 h-6 shrink-0" style={{ color: paymentInfo.color }} />}
                        <div className="flex-1">
                          <p className="font-black text-sm" style={{ color: paymentInfo.color }}>{paymentInfo.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{paymentInfo.desc}</p>
                        </div>
                        {(displayOrder.paymentStatus as string) === 'verified' && (
                          <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                        )}
                      </div>
                      {(displayOrder.paymentStatus as string) === 'submitted' && (
                        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5">
                          <Clock className="w-3 h-3" /> Verification takes 5–30 minutes. This page refreshes automatically.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Customer Info */}
                  <div className="px-6 sm:px-8 py-5 border-t border-gray-100">
                    <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Delivery Details</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Customer</p>
                        <p className="font-bold text-sm text-gray-800">{String(displayOrder.customerName ?? '')}</p>
                      </div>
                      <div className="p-3 rounded-xl" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Payment</p>
                        <p className="font-bold text-sm text-gray-800">{paymentMethodLabel[String(displayOrder.paymentMethod ?? '')] || String(displayOrder.paymentMethod ?? '')}</p>
                      </div>
                      {!!displayOrder.shippingDistrict && (
                        <div className="col-span-2 p-3 rounded-xl" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Shipping District</p>
                          <p className="font-bold text-sm text-gray-800">{String(displayOrder.shippingDistrict)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="px-6 sm:px-8 py-5 border-t border-gray-100">
                    <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Items Ordered</p>
                    <div className="space-y-3">
                      {(displayOrder.items as Array<Record<string, unknown>>).map((item: any, idx: number) => {
                        let hamper: any = null;
                        try { hamper = JSON.parse(item.customNote ?? "{}").hamper; } catch {}
                        if (hamper) {
                          return (
                            <div key={idx} className="py-3 border-b border-gray-100 last:border-0">
                              <div className="flex items-start gap-4">
                                <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                                  style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)' }}>
                                  <Gift className="w-6 h-6 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest text-white mb-1"
                                    style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)' }}>
                                    <Gift className="w-2 h-2" /> Gift Hamper
                                  </span>
                                  <p className="font-bold text-sm text-gray-800">{hamper.hamperName || item.productName}</p>
                                  <p className="text-xs text-gray-400 mt-0.5">Qty: {item.quantity as number} · {(hamper.items || []).length} items inside</p>
                                  {hamper.recipientName && (
                                    <p className="text-xs text-gray-600 mt-1 italic flex items-center gap-1">
                                      <Heart className="w-3 h-3 text-orange-400" /> For: <strong>{hamper.recipientName}</strong>
                                    </p>
                                  )}
                                </div>
                                <span className="font-bold text-orange-600 text-sm shrink-0">{formatPrice((item.price as number) * (item.quantity as number))}</span>
                              </div>
                              <div className="mt-2 ml-[4.5rem] pl-3 border-l-2 border-orange-100 space-y-0.5">
                                {(hamper.items || []).map((it: any, i: number) => (
                                  <div key={i} className="text-xs text-gray-600">
                                    • {it.name}{it.quantity > 1 ? ` × ${it.quantity}` : ''}
                                  </div>
                                ))}
                                {hamper.giftMessage && (
                                  <div className="mt-2 p-2 rounded-lg bg-orange-50 border border-orange-100">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-orange-600">Gift Message</p>
                                    <p className="text-xs text-gray-700 italic mt-0.5">"{hamper.giftMessage}"</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }
                        return (
                        <div key={idx} className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
                          <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0"
                            style={{ background: '#f3f4f6' }}>
                            {item.productImage && (
                              <img src={item.productImage as string} alt="" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm leading-snug text-gray-800">{item.productName as string}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              Qty: {item.quantity as number}
                              {item.size ? ` · Size: ${item.size}` : ''}
                              {item.color ? ` · Color: ${item.color}` : ''}
                            </p>
                          </div>
                          <span className="font-bold text-orange-600 text-sm shrink-0">{formatPrice((item.price as number) * (item.quantity as number))}</span>
                        </div>
                        );
                      })}
                    </div>

                    <div className="mt-5 pt-4 border-t border-gray-100 space-y-2">
                      <div className="flex justify-between text-sm text-gray-400">
                        <span>Subtotal</span><span>{formatPrice(displayOrder.subtotal as number)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-400">
                        <span>Shipping</span>
                        <span className="text-gray-900">{(displayOrder.shippingCost as number) === 0 ? "FREE" : formatPrice(displayOrder.shippingCost as number)}</span>
                      </div>
                      <div className="flex justify-between font-black text-lg pt-2 border-t border-gray-100">
                        <span className="text-gray-800">Total</span><span className="text-primary">{formatPrice(displayOrder.total as number)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-2xl text-center"
                  style={{ background: 'rgba(255,107,43,0.05)', border: '1px solid rgba(255,107,43,0.1)' }}>
                  <p className="text-sm text-gray-500">
                    Questions? WhatsApp us at{' '}
                    <a
                      href={`https://wa.me/${TRYNEX_NUMBER.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-black text-orange-600 hover:underline"
                    >
                      {TRYNEX_NUMBER}
                    </a>
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <Footer />
    </div>
  );
}
