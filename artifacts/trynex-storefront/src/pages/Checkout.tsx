import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { SEOHead } from "@/components/SEOHead";
import { useCart } from "@/context/CartContext";
import { useCreateOrder, CreateOrderRequestPaymentMethod } from "@workspace/api-client-react";
import { formatPrice, getApiUrl } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import {
  CheckCircle2, CreditCard, Banknote,
  ShieldCheck, Copy, Check, ArrowRight,
  Smartphone, Info, Tag, MapPin, MessageCircle, Phone, AlertCircle, Search,
  LocateFixed, Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { trackInitiateCheckout, trackPurchase } from "@/lib/tracking";
import { getStoredUtm } from "@/hooks/useUtm";

import { BD_UPAZILAS, getDivisionForDistrict, getAllDistricts, getPostCode } from "@/data/bd-addresses";
import { DeliveryAreaPicker } from "@/components/DeliveryAreaPicker";

const checkoutSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  customerEmail: z.string().email("Invalid email address"),
  customerPhone: z.string().min(11, "Valid phone number required"),
  shippingAddress: z.string().min(5, "Street address required (House / Road / Area)"),
  shippingDistrict: z.string().min(2, "District is required"),
  shippingUpazila: z.string().min(2, "Upazila is required"),
  shippingUnion: z.string().optional(),
  shippingPostCode: z.string().optional(),
  shippingCity: z.string().optional(),
  notes: z.string().optional()
});
type CheckoutFormData = z.infer<typeof checkoutSchema>;

const DISTRICTS = getAllDistricts();

const FALLBACK_PAYMENT_NUMBER = "01747292277";
const FALLBACK_WHATSAPP_LOCAL = "01903426915";
const FALLBACK_WHATSAPP_INTL = "+8801903426915";

const inputClass = "w-full px-4 py-3.5 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all placeholder:text-gray-400";
const inputStyle = { background: 'white', border: '1px solid #e5e7eb', color: '#111827' };

type CheckoutStep = 'form' | 'gateway' | 'success';
type MobileMethod = 'bkash' | 'nagad' | 'rocket';

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { items, subtotal, clearCart } = useCart();
  const { toast } = useToast();
  const settings = useSiteSettings();

  const PAYMENT_NUMBER_LOCAL = settings.bkashNumber || FALLBACK_PAYMENT_NUMBER;
  const WHATSAPP_NUMBER_LOCAL = settings.whatsappNumber?.replace(/[^0-9]/g, '').replace(/^880/, '') || FALLBACK_WHATSAPP_LOCAL;
  const WHATSAPP_NUMBER_INTL = settings.whatsappNumber?.replace(/[^+0-9]/g, '') || FALLBACK_WHATSAPP_INTL;
  const freeShippingThreshold = settings.freeShippingThreshold ?? 1500;
  const shippingFee = settings.shippingCost ?? 100;

  const [paymentMethod, setPaymentMethod] = useState<CreateOrderRequestPaymentMethod>('cod');
  const [codAdvanceMethod, setCodAdvanceMethod] = useState<MobileMethod>('bkash');
  const [step, setStep] = useState<CheckoutStep>('form');
  const [createdOrder, setCreatedOrder] = useState<Record<string, unknown> | null>(null);
  const [lastFour, setLastFour] = useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoApplied, setPromoApplied] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [isReferralCode, setIsReferralCode] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [serverWaking, setServerWaking] = useState(false);
  const refAppliedRef = useRef(false);
  const wakingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snapshotRef = useRef({ total: 0, advance: 0, shipping: 0 });

  const { mutateAsync: createOrder, isPending } = useCreateOrder();
  const formRef = useRef<HTMLFormElement>(null);

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { shippingDistrict: '', shippingUpazila: '', shippingUnion: '', shippingPostCode: '' }
  });

  useEffect(() => {
    const keys = Object.keys(errors);
    if (keys.length > 0) {
      const firstErrorField = formRef.current?.querySelector(`[name="${keys[0]}"]`) as HTMLElement | null;
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstErrorField.focus();
      }
    }
  }, [errors]);

  const gpsTriedRef = useRef(false);
  useEffect(() => {
    if (gpsTriedRef.current) return;
    gpsTriedRef.current = true;
    if (!navigator.geolocation) return;
    try {
      if (navigator.permissions && typeof navigator.permissions.query === 'function') {
        navigator.permissions.query({ name: 'geolocation' as PermissionName }).then(result => {
          if (result.state === 'prompt' || result.state === 'granted') {
            handleGPSDetect();
          }
        }).catch(() => {});
      } else {
        handleGPSDetect();
      }
    } catch {
      handleGPSDetect();
    }
  }, []);

  const selectedDistrict = watch("shippingDistrict");
  const selectedUpazila = watch("shippingUpazila");

  const handleGPSDetect = useCallback(async () => {
    if (!navigator.geolocation) {
      toast({ title: "Select manually", description: "Location services are not available on this device. Please choose your district below." });
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`, {
            headers: { 'Accept-Language': 'en' },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          const data = await res.json();
          const addr = data.address || {};
          const detectedDistrict = addr.county || addr.state_district || addr.city || "";
          const detectedSuburb = addr.suburb || addr.town || addr.village || addr.neighbourhood || "";
          const detectedPostCode = addr.postcode || "";

          const matched = DISTRICTS.find(d => detectedDistrict.toLowerCase().includes(d.toLowerCase()) || d.toLowerCase().includes(detectedDistrict.toLowerCase()));
          if (matched) {
            setValue("shippingDistrict", matched, { shouldValidate: true });
            const division = getDivisionForDistrict(matched);
            if (division) setValue("shippingCity", division);

            const upazilas = BD_UPAZILAS[matched] || [];
            const matchedUpazila = upazilas.find(u =>
              detectedSuburb.toLowerCase().includes(u.toLowerCase()) ||
              u.toLowerCase().includes(detectedSuburb.toLowerCase())
            );
            if (matchedUpazila) {
              setValue("shippingUpazila", matchedUpazila, { shouldValidate: true });
              const pc = getPostCode(matched, matchedUpazila);
              if (pc) setValue("shippingPostCode", pc);
            } else {
              setValue("shippingUpazila", "");
              const pc = getPostCode(matched);
              if (pc) setValue("shippingPostCode", pc);
            }

            if (detectedPostCode) setValue("shippingPostCode", detectedPostCode);

            toast({ title: "Location detected!", description: `${matched}${matchedUpazila ? `, ${matchedUpazila}` : ''}${division ? ` — ${division} Division` : ''}` });
          } else {
            toast({ title: "Select manually", description: "We couldn't auto-detect your exact district. Please choose from the list below." });
          }
        } catch {
          toast({ title: "Select manually", description: "Location lookup timed out. Please choose your district from the list below." });
        }
        setGpsLoading(false);
      },
      (err) => {
        if (err.code === 1) {
          toast({ title: "Location permission needed", description: "Please allow location access in your browser settings, or select your district manually." });
        } else {
          toast({ title: "Select manually", description: "Could not determine your location. Please choose your district from the list below." });
        }
        setGpsLoading(false);
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
    );
  }, [setValue, toast]);

  const checkoutEntryFiredRef = useRef(false);
  useEffect(() => {
    if (checkoutEntryFiredRef.current || items.length === 0) return;
    checkoutEntryFiredRef.current = true;
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    trackInitiateCheckout(
      items.map(i => ({ id: i.productId, name: i.name, price: i.price, quantity: i.quantity })),
      total
    );
  }, [items]);

  useEffect(() => {
    if (refAppliedRef.current || promoApplied) return;
    const refCode = localStorage.getItem("trynex_ref_code");
    if (refCode) {
      refAppliedRef.current = true;
      setPromoInput(refCode);
      setTimeout(() => {
        const liveTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const emailForSelfCheck = watch("customerEmail") || undefined;
        fetch(getApiUrl("/api/promo-codes/validate"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: refCode, orderTotal: liveTotal, customerEmail: emailForSelfCheck }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.valid) {
              setPromoDiscount(data.discount || 0);
              setPromoApplied(data.code);
              setIsReferralCode(!!data.isReferral);
              toast({ title: data.message });
            }
          })
          .catch(() => {});
      }, 500);
    }
  }, [items, promoApplied]);

  const getPaymentNumber = (method: MobileMethod) => {
    if (method === 'bkash') return settings.bkashNumber || FALLBACK_PAYMENT_NUMBER;
    if (method === 'nagad') return settings.nagadNumber || FALLBACK_PAYMENT_NUMBER;
    if (method === 'rocket') return settings.rocketNumber || FALLBACK_PAYMENT_NUMBER;
    return FALLBACK_PAYMENT_NUMBER;
  };

  const validatePromo = async () => {
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    setPromoError(null);
    try {
      const liveTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const customerEmailVal = watch("customerEmail") || undefined;
      const res = await fetch(getApiUrl("/api/promo-codes/validate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoInput.trim(), orderTotal: liveTotal, customerEmail: customerEmailVal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPromoError(data.message || "Invalid code");
        setPromoDiscount(0);
        setPromoApplied(null);
        return;
      }
      setPromoDiscount(data.discount || 0);
      setPromoApplied(data.code);
      setIsReferralCode(!!data.isReferral);
      toast({ title: data.message });
    } catch {
      setPromoError("Failed to validate. Try again.");
    } finally {
      setPromoLoading(false);
    }
  };

  const removePromo = () => {
    setPromoDiscount(0);
    setPromoApplied(null);
    setPromoInput("");
    setPromoError(null);
    setIsReferralCode(false);
  };

  const liveSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingCost = liveSubtotal > 0 && liveSubtotal < freeShippingThreshold ? shippingFee : 0;
  const total = Math.max(0, liveSubtotal + shippingCost - promoDiscount);
  const advanceAmount = Math.ceil(total * 0.15);

  const displayTotal = step === 'form' ? total : snapshotRef.current.total;
  const displayAdvance = step === 'form' ? advanceAmount : snapshotRef.current.advance;

  useEffect(() => {
    if (items.length === 0 && step === 'form') {
      setLocation("/cart");
    }
  }, [items.length, step, setLocation]);

  if (items.length === 0 && step === 'form') {
    return null;
  }

  const effectiveGatewayMethod: MobileMethod =
    paymentMethod === 'cod' ? codAdvanceMethod : (paymentMethod as MobileMethod);

  const isMobilePayment = paymentMethod === 'bkash' || paymentMethod === 'nagad' || paymentMethod === 'rocket';

  const onSubmit = async (data: CheckoutFormData) => {
    const snapSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const snapShipping = snapSubtotal > 0 && snapSubtotal < freeShippingThreshold ? shippingFee : 0;
    const snapTotal = Math.max(0, snapSubtotal + snapShipping - promoDiscount);
    const snapAdvance = Math.ceil(snapTotal * 0.15);

    snapshotRef.current = { total: snapTotal, advance: snapAdvance, shipping: snapShipping };

    const { firstName, lastName, shippingUpazila, shippingUnion, shippingPostCode, ...rest } = data;
    const customerName = `${firstName} ${lastName}`.trim();
    const addressParts = [rest.shippingAddress];
    if (shippingUnion) addressParts.push(shippingUnion);
    if (shippingUpazila) addressParts.push(shippingUpazila);
    if (shippingPostCode) addressParts.push(`PO: ${shippingPostCode}`);
    rest.shippingAddress = addressParts.join(", ");

    if (wakingTimerRef.current) clearTimeout(wakingTimerRef.current);
    wakingTimerRef.current = setTimeout(() => setServerWaking(true), 4000);

    try {
      const utm = getStoredUtm();
      const order = await createOrder({
        data: {
          ...rest,
          customerName,
          paymentMethod,
          items: items.map(i => ({
            productId: i.productId,
            name: i.name,
            quantity: i.quantity,
            size: i.size,
            color: i.color,
            imageUrl: i.imageUrl,
            customNote: i.hamperPayload
              ? JSON.stringify({ hamper: i.hamperPayload, unitPrice: i.price })
              : i.customNote,
            customImages: i.customImages,
          })),
          ...(promoApplied ? { promoCode: promoApplied } : {}),
          ...(utm.utmSource ? { utmSource: utm.utmSource } : {}),
          ...(utm.utmMedium ? { utmMedium: utm.utmMedium } : {}),
          ...(utm.utmCampaign ? { utmCampaign: utm.utmCampaign } : {}),
        }
      });

      const orderData = order as unknown as Record<string, unknown>;
      setCreatedOrder(orderData);

      const serverTotal = typeof orderData.total === "number" ? orderData.total : snapTotal;
      const serverAdvance = Math.ceil(serverTotal * 0.15);
      snapshotRef.current = { total: serverTotal, advance: serverAdvance, shipping: snapshotRef.current.shipping };

      trackPurchase({
        orderId: orderData.orderNumber as string,
        total: serverTotal,
        items: items.map(i => ({ id: i.productId, name: i.name, price: i.price, quantity: i.quantity })),
      });

      if (isReferralCode && promoApplied) {
        fetch(getApiUrl(`/api/referrals/${promoApplied}/use`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderTotal: serverTotal }),
        }).catch(() => {});
        localStorage.removeItem("trynex_ref_code");
      }

      if (wakingTimerRef.current) { clearTimeout(wakingTimerRef.current); wakingTimerRef.current = null; }
      setServerWaking(false);
      clearCart();
      setStep(paymentMethod === 'card' ? 'success' : 'gateway');
    } catch (err: any) {
      if (wakingTimerRef.current) { clearTimeout(wakingTimerRef.current); wakingTimerRef.current = null; }
      setServerWaking(false);
      const errBody = err?.data || err?.body || {};
      const code = errBody?.error;
      const serverMessage = errBody?.message;

      if (code === "promo_invalid") {
        removePromo();
        toast({
          title: "Promo code is no longer valid",
          description: "It may have expired or reached its limit. Your order total has been updated — please try again.",
          variant: "destructive",
        });
      } else if (code === "self_referral") {
        removePromo();
        toast({
          title: "You can't use your own referral code",
          description: "Try a different code or remove it to continue.",
          variant: "destructive",
        });
      } else if (code === "stock_out") {
        toast({
          title: "Out of stock",
          description: serverMessage || "One of your items is out of stock. Please update your cart.",
          variant: "destructive",
        });
        setTimeout(() => setLocation("/cart"), 2500);
      } else if (code === "product_missing") {
        toast({
          title: "Item no longer available",
          description: serverMessage || "An item in your cart has been removed by the store. Please update your cart.",
          variant: "destructive",
        });
        setTimeout(() => setLocation("/cart"), 2500);
      } else if (code === "Invalid hamper" || code === "Invalid hamper price") {
        toast({
          title: "Gift hamper issue",
          description: serverMessage || "One of your gift hampers is no longer valid. Please rebuild it from the Hampers page.",
          variant: "destructive",
        });
      } else if (code === "validation_error") {
        toast({
          title: "Please check your details",
          description: serverMessage || "Some fields look incorrect. Review and try again.",
          variant: "destructive",
        });
      } else if (err?.status === 0 || err?.name === "TypeError" || /network|fetch/i.test(err?.message ?? "")) {
        toast({
          title: "Connection lost",
          description: "We couldn't reach the server. Check your internet and try again — or message us on WhatsApp.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to place order",
          description: serverMessage || "Please try again in a moment, or message us on WhatsApp for help.",
          variant: "destructive",
        });
      }
    }
  };

  const handlePaymentSubmit = async () => {
    if (!lastFour || lastFour.length < 4) {
      toast({ title: "Please enter last 4 digits", description: "Enter the last 4 digits of your sending number.", variant: "destructive" });
      return;
    }
    setIsSubmittingPayment(true);
    try {
      await fetch(getApiUrl(`/api/orders/${(createdOrder as Record<string, unknown>)?.id}/payment-info`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastFourDigits: lastFour, promoCode: promoApplied || undefined })
      });
      setStep('success');
    } catch {
      toast({ title: "Submission failed", description: "Please screenshot this page and contact us on WhatsApp.", variant: "destructive" });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const activePaymentNumber = getPaymentNumber(effectiveGatewayMethod);

  const copyNumber = async () => {
    await navigator.clipboard.writeText(activePaymentNumber);
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 3000);
  };

  const gatewayTheme = {
    bkash: {
      name: 'bKash',
      primary: '#e2136e',
      light: 'rgba(226,19,110,0.08)',
      border: 'rgba(226,19,110,0.2)',
      glow: '0 4px 30px rgba(226,19,110,0.1)',
      badge: 'linear-gradient(135deg, #e2136e 0%, #c0105c 100%)',
      logo: <span className="text-4xl font-black" style={{ color: '#e2136e' }}>bKash</span>,
    },
    nagad: {
      name: 'Nagad',
      primary: '#f7941d',
      light: 'rgba(247,148,29,0.08)',
      border: 'rgba(247,148,29,0.2)',
      glow: '0 4px 30px rgba(247,148,29,0.1)',
      badge: 'linear-gradient(135deg, #f7941d 0%, #e07800 100%)',
      logo: <span className="text-4xl font-black" style={{ color: '#f7941d' }}>Nagad</span>,
    },
    rocket: {
      name: 'Rocket',
      primary: '#7c3aed',
      light: 'rgba(124,58,237,0.08)',
      border: 'rgba(124,58,237,0.2)',
      glow: '0 4px 30px rgba(124,58,237,0.1)',
      badge: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
      logo: <span className="text-4xl font-black" style={{ color: '#7c3aed' }}>Rocket</span>,
    },
  };

  const theme = gatewayTheme[effectiveGatewayMethod];

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 20 }}
          className="max-w-md w-full rounded-3xl p-8 text-center bg-white"
          style={{ border: '1px solid #e5e7eb', boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}
        >
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2, damping: 15 }}
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(22,163,74,0.08)', border: '2px solid rgba(22,163,74,0.2)' }}
          >
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </motion.div>

          <h1 className="text-4xl font-black font-display mb-2 text-gray-900">Order Confirmed!</h1>
          <p className="text-gray-400 mb-6 leading-relaxed text-sm">
            {paymentMethod === 'card'
              ? "Your order has been placed. We will send you a secure payment link via email or WhatsApp shortly."
              : "Your payment info was submitted. Our team will verify and confirm your order shortly."}
          </p>

          <div className="p-5 rounded-2xl mb-4 bg-gray-50 border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Order Reference</p>
            <p className="text-2xl font-black tracking-wider text-orange-600 font-mono">{createdOrder?.orderNumber as string}</p>
            <p className="text-xs text-gray-400 mt-1">Save this number to track your order</p>
          </div>

          {paymentMethod === 'card' ? (
            <div className="p-4 rounded-2xl mb-4 text-left" style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)' }}>
              <p className="text-xs font-bold text-blue-600 mb-2 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" /> Card Payment Pending
              </p>
              <div className="text-xs text-gray-500 space-y-1">
                <p>Order total: <strong className="text-gray-900">{formatPrice(snapshotRef.current.total)}</strong></p>
                <p>A secure payment link (Visa/Mastercard/Amex) will be sent to you via email or WhatsApp.</p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl mb-4 text-left" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <p className="text-xs font-bold text-amber-600 mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> Payment Under Verification
              </p>
              <div className="text-xs text-gray-500 space-y-1">
                <p>Advance paid: <strong className="text-gray-900">{formatPrice(snapshotRef.current.advance)}</strong></p>
                <p>Remaining on delivery: <strong className="text-gray-900">{formatPrice(snapshotRef.current.total - snapshotRef.current.advance)}</strong></p>
              </div>
            </div>
          )}

          <a
            href={`https://wa.me/${WHATSAPP_NUMBER_INTL.replace('+', '')}?text=Hi TryNex! My order number is ${createdOrder?.orderNumber}. I need help.`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-white text-sm mb-2"
            style={{ background: '#25D366', boxShadow: '0 4px 20px rgba(37,211,102,0.3)' }}
          >
            <MessageCircle className="w-4 h-4" /> WhatsApp — {WHATSAPP_NUMBER_LOCAL}
          </a>
          <a
            href={`tel:${WHATSAPP_NUMBER_INTL}`}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm mb-3"
            style={{ background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.15)', color: '#16a34a' }}
          >
            <Phone className="w-4 h-4" /> Call Us — {WHATSAPP_NUMBER_LOCAL}
          </a>

          <button onClick={() => setLocation(`/track`)}
            className="btn-glow w-full py-4 rounded-xl font-bold text-white text-base mb-3"
            style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)', boxShadow: '0 6px 24px rgba(232,93,4,0.35)' }}>
            Track My Order
          </button>
          <button onClick={() => setLocation("/")}
            className="w-full py-3.5 rounded-xl font-semibold text-sm text-gray-500 hover:text-gray-700 transition-colors bg-gray-50 border border-gray-200">
            Continue Shopping
          </button>
        </motion.div>
      </div>
    );
  }

  if (step === 'gateway') {
    const snapTotal = snapshotRef.current.total;
    const snapAdvance = snapshotRef.current.advance;
    const snapRemaining = snapTotal - snapAdvance;

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full space-y-4"
        >
          <div className="rounded-3xl overflow-hidden bg-white"
            style={{ border: `1px solid ${theme.border}`, boxShadow: theme.glow }}>

            <div className="p-6 text-center" style={{ background: theme.light, borderBottom: `1px solid ${theme.border}` }}>
              <div className="mb-2">{theme.logo}</div>
              <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Payment Gateway</p>
              <p className="text-sm text-gray-500">
                {paymentMethod === 'cod'
                  ? 'Pay 15% advance via mobile banking — rest on delivery'
                  : 'Complete your 15% advance payment below'}
              </p>
            </div>

            <div className="p-6 space-y-5">

              {paymentMethod === 'cod' && (
                <div className="p-3 rounded-xl" style={{ background: 'rgba(22,163,74,0.04)', border: '1px solid rgba(22,163,74,0.15)' }}>
                  <p className="text-xs font-black text-green-600 mb-2 flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5" /> Cash on Delivery — 15% Advance Required
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    Choose how to send the 15% advance. The rest ({formatPrice(snapRemaining)}) will be collected when we deliver your order.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['bkash', 'nagad', 'rocket'] as MobileMethod[]).map(m => (
                      <button
                        key={m}
                        onClick={() => setCodAdvanceMethod(m)}
                        className="py-2 px-3 rounded-lg font-black text-xs transition-all"
                        style={{
                          background: codAdvanceMethod === m ? gatewayTheme[m].light : '#f9fafb',
                          border: codAdvanceMethod === m ? `1px solid ${gatewayTheme[m].border}` : '1px solid #e5e7eb',
                          color: codAdvanceMethod === m ? gatewayTheme[m].primary : '#9ca3af',
                        }}
                      >
                        {m === 'bkash' ? 'bKash' : m === 'nagad' ? 'Nagad' : 'Rocket'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Order #</p>
                  <p className="font-black text-sm font-mono text-orange-600">{createdOrder?.orderNumber as string}</p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Full Order Total</p>
                  <p className="font-black text-sm text-gray-900">{formatPrice(snapTotal)}</p>
                </div>
              </div>

              <div className="rounded-2xl p-5 text-center" style={{ background: theme.light, border: `2px solid ${theme.border}` }}>
                <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: theme.primary }}>
                  Send This Amount (15% Advance)
                </p>
                <p className="text-6xl font-black font-display" style={{ color: theme.primary }}>
                  {formatPrice(snapAdvance)}
                </p>
                <div className="mt-3 pt-3 border-t" style={{ borderColor: theme.border }}>
                  <p className="text-xs font-semibold text-gray-500">
                    Remaining <strong className="text-gray-900 text-sm">{formatPrice(snapRemaining)}</strong> paid on delivery
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-gray-400">How to Pay</p>
                {[
                  `Open your ${theme.name} app`,
                  `Go to "Send Money"`,
                  `Enter number: ${activePaymentNumber}`,
                  `Send exactly ${formatPrice(snapAdvance)}`,
                  'Enter your sending number last 4 digits below',
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5"
                      style={{ background: theme.light, color: theme.primary, border: `1px solid ${theme.border}` }}>
                      {i + 1}
                    </div>
                    <span className="text-sm text-gray-600 leading-relaxed">{s}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl p-4 bg-gray-50" style={{ border: `1px solid ${theme.border}` }}>
                <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Send Money To</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-gray-400 mb-1">{theme.name} Personal Number</p>
                    <p className="text-3xl font-black tracking-widest font-mono" style={{ color: theme.primary }}>
                      {activePaymentNumber}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">Tap COPY then paste directly in {theme.name} app</p>
                  </div>
                  <button
                    onClick={copyNumber}
                    className="flex flex-col items-center gap-1 w-14 h-14 rounded-xl justify-center transition-all duration-300 shrink-0"
                    style={{
                      background: copiedNumber ? 'rgba(22,163,74,0.08)' : theme.light,
                      border: copiedNumber ? '1px solid rgba(22,163,74,0.2)' : `1px solid ${theme.border}`,
                      color: copiedNumber ? '#16a34a' : theme.primary,
                    }}
                  >
                    {copiedNumber ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    <span className="text-[8px] font-black">{copiedNumber ? 'COPIED' : 'COPY'}</span>
                  </button>
                </div>
                {copiedNumber && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-green-600 font-bold mt-2 flex items-center gap-1.5"
                  >
                    <Check className="w-3 h-3" /> {activePaymentNumber} copied! Paste directly in {theme.name} app.
                  </motion.p>
                )}
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">
                  Your Sending Number — Last 4 Digits *
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="e.g. 5678"
                  value={lastFour}
                  onChange={e => setLastFour(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className={inputClass}
                  style={{ ...inputStyle, letterSpacing: '0.5em', textAlign: 'center', fontSize: '1.5rem', fontWeight: 900 }}
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  Enter the last 4 digits of the {theme.name} number you're sending FROM
                </p>
              </div>

              <button
                onClick={handlePaymentSubmit}
                disabled={isSubmittingPayment || lastFour.length < 4}
                className="w-full py-4 rounded-xl font-black text-white text-base flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-40"
                style={{
                  background: lastFour.length >= 4 && !isSubmittingPayment ? theme.badge : '#e5e7eb',
                  boxShadow: lastFour.length >= 4 ? `0 8px 30px ${theme.light}` : 'none',
                  color: lastFour.length >= 4 ? 'white' : '#9ca3af',
                }}
              >
                {isSubmittingPayment ? (
                  <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</>
                ) : (
                  <>I've Sent the Payment <ArrowRight className="w-5 h-5" /></>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                Your payment info is secure & encrypted
              </div>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden bg-white" style={{ border: '1px solid rgba(37,211,102,0.2)' }}>
            <div className="p-4">
              <p className="text-xs font-black uppercase tracking-widest text-green-600 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Need Help? Contact Us
              </p>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                Having trouble? Wrong amount? Contact us immediately — we're here for you.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER_INTL.replace('+', '')}?text=Hi! I need help with my ${theme.name} payment for order ${createdOrder?.orderNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white text-sm"
                  style={{ background: '#25D366', boxShadow: '0 4px 15px rgba(37,211,102,0.3)' }}
                >
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
                <a
                  href={`tel:${WHATSAPP_NUMBER_INTL}`}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm"
                  style={{ background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.15)', color: '#16a34a' }}
                >
                  <Phone className="w-4 h-4" /> Call Us
                </a>
              </div>
              <p className="text-center text-xs text-gray-400 mt-2">{WHATSAPP_NUMBER_LOCAL}</p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEOHead title="Checkout" description="Complete your order at TryNex Lifestyle." noindex />
      <Navbar />

      <main className="flex-1 pt-header pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="mb-8">
            <div className="flex items-center justify-center gap-0 max-w-md mx-auto" role="navigation" aria-label="Checkout progress">
              {[
                { num: 1, label: "Cart", done: true },
                { num: 2, label: "Details", done: false, active: true },
                { num: 3, label: "Payment", done: false },
              ].map((s, i) => (
                <div key={s.num} className="flex items-center flex-1 last:flex-initial">
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black transition-all"
                      style={{
                        background: s.done
                          ? 'linear-gradient(135deg, #E85D04, #FB8500)'
                          : s.active
                            ? 'linear-gradient(135deg, #E85D04, #FB8500)'
                            : '#f3f4f6',
                        color: s.done || s.active ? 'white' : '#9ca3af',
                        boxShadow: s.active ? '0 4px 12px rgba(232,93,4,0.3)' : 'none',
                      }}
                      aria-current={s.active ? 'step' : undefined}
                    >
                      {s.done ? <Check className="w-4 h-4" /> : s.num}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${s.active ? 'text-orange-600' : s.done ? 'text-gray-600' : 'text-gray-400'}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < 2 && (
                    <div className="flex-1 h-0.5 mx-2 mt-[-1rem] rounded-full" style={{ background: s.done ? '#E85D04' : '#e5e7eb' }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-6">
              <form id="checkout-form" ref={formRef} onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                {/* Delivery Details */}
                <div className="p-7 rounded-3xl" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
                  <h2 className="text-xl font-black font-display flex items-center gap-3 mb-6 text-gray-800">
                    <span className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(232,93,4,0.08)', color: '#E85D04' }}>
                      <MapPin className="w-4 h-4" />
                    </span>
                    Delivery Details
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="co-firstName" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">First Name *</label>
                      <input
                        id="co-firstName"
                        type="text"
                        inputMode="text"
                        autoCapitalize="words"
                        enterKeyHint="next"
                        {...register("firstName")}
                        className={inputClass}
                        style={{ ...inputStyle, borderColor: errors.firstName ? '#f87171' : undefined }}
                        placeholder="First name"
                        autoComplete="given-name"
                        aria-invalid={!!errors.firstName}
                        aria-describedby={errors.firstName ? "co-firstName-error" : undefined}
                      />
                      {errors.firstName && <p id="co-firstName-error" role="alert" className="text-red-500 text-xs mt-1.5">{errors.firstName.message}</p>}
                    </div>
                    <div>
                      <label htmlFor="co-lastName" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Last Name *</label>
                      <input
                        id="co-lastName"
                        type="text"
                        inputMode="text"
                        autoCapitalize="words"
                        enterKeyHint="next"
                        {...register("lastName")}
                        className={inputClass}
                        style={{ ...inputStyle, borderColor: errors.lastName ? '#f87171' : undefined }}
                        placeholder="Last name"
                        autoComplete="family-name"
                        aria-invalid={!!errors.lastName}
                        aria-describedby={errors.lastName ? "co-lastName-error" : undefined}
                      />
                      {errors.lastName && <p id="co-lastName-error" role="alert" className="text-red-500 text-xs mt-1.5">{errors.lastName.message}</p>}
                    </div>
                    <div>
                      <label htmlFor="co-email" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Email *</label>
                      <input
                        id="co-email"
                        type="email"
                        inputMode="email"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                        enterKeyHint="next"
                        {...register("customerEmail")}
                        className={inputClass}
                        style={{ ...inputStyle, borderColor: errors.customerEmail ? '#f87171' : undefined }}
                        placeholder="you@example.com"
                        autoComplete="email"
                        aria-invalid={!!errors.customerEmail}
                        aria-describedby={errors.customerEmail ? "co-email-error" : undefined}
                      />
                      {errors.customerEmail && <p id="co-email-error" role="alert" className="text-red-500 text-xs mt-1.5">{errors.customerEmail.message}</p>}
                    </div>
                    <div>
                      <label htmlFor="co-phone" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Phone *</label>
                      <input
                        id="co-phone"
                        type="tel"
                        inputMode="tel"
                        enterKeyHint="next"
                        {...register("customerPhone")}
                        className={inputClass}
                        style={{ ...inputStyle, borderColor: errors.customerPhone ? '#f87171' : undefined }}
                        placeholder="01XXXXXXXXX"
                        autoComplete="tel"
                        aria-invalid={!!errors.customerPhone}
                        aria-describedby={errors.customerPhone ? "co-phone-error" : undefined}
                      />
                      {errors.customerPhone && <p id="co-phone-error" role="alert" className="text-red-500 text-xs mt-1.5">{errors.customerPhone.message}</p>}
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="co-address" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Street Address *</label>
                      <textarea
                        id="co-address"
                        autoCapitalize="words"
                        enterKeyHint="next"
                        {...register("shippingAddress")}
                        rows={3}
                        className={`${inputClass} resize-none`}
                        style={{ ...inputStyle, borderColor: errors.shippingAddress ? '#f87171' : undefined }}
                        placeholder="House / Road / Area / Thana"
                        autoComplete="street-address"
                        aria-invalid={!!errors.shippingAddress}
                        aria-describedby={errors.shippingAddress ? "co-address-error" : undefined}
                      />
                      {errors.shippingAddress && <p id="co-address-error" role="alert" className="text-red-500 text-xs mt-1.5">{errors.shippingAddress.message}</p>}
                    </div>
                    <div className="sm:col-span-2">
                      <DeliveryAreaPicker
                        selectedDistrict={selectedDistrict}
                        selectedUpazila={selectedUpazila}
                        onSelect={(district, upazila, division, postCode) => {
                          setValue("shippingDistrict", district, { shouldValidate: true });
                          setValue("shippingUpazila", upazila, { shouldValidate: true });
                          setValue("shippingCity", division);
                          setValue("shippingPostCode", postCode);
                          setValue("shippingUnion", "");
                        }}
                        onGPSDetect={handleGPSDetect}
                        gpsLoading={gpsLoading}
                        error={errors.shippingDistrict?.message || errors.shippingUpazila?.message}
                      />
                    </div>
                    {selectedDistrict && (
                      <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Union / Ward (Optional)</label>
                          <input
                            {...register("shippingUnion")}
                            className={inputClass}
                            style={inputStyle}
                            placeholder="e.g. Ward 5, Kalabagan"
                            autoComplete="off"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Post Code</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            enterKeyHint="done"
                            {...register("shippingPostCode")}
                            className={inputClass}
                            style={inputStyle}
                            placeholder="e.g. 1205"
                            autoComplete="postal-code"
                          />
                          {watch("shippingPostCode") && (
                            <p className="text-xs text-green-600 font-semibold mt-1.5 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Auto-filled
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Order Notes (Optional)</label>
                      <input {...register("notes")} className={inputClass} style={inputStyle} placeholder="Any special instructions..." />
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="p-7 rounded-3xl" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
                  <h2 className="text-xl font-black font-display flex items-center gap-3 mb-6 text-gray-800">
                    <span className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(232,93,4,0.08)', color: '#E85D04' }}>
                      <CreditCard className="w-4 h-4" />
                    </span>
                    Payment Method
                  </h2>

                  <div className="mb-4 p-3 rounded-xl flex items-start gap-2.5"
                    style={{ background: 'rgba(232,93,4,0.04)', border: '1px solid rgba(232,93,4,0.15)' }}>
                    <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-gray-500 leading-relaxed">
                      <strong className="text-orange-600">15% advance is required for all orders</strong> — this lets us confirm and dispatch your order. The remaining balance is collected on delivery.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {[
                      {
                        id: 'cod', name: 'Cash on Delivery', desc: 'Pay 15% advance via bKash/Nagad, rest on delivery',
                        icon: <Banknote className="w-5 h-5 text-green-500" />,
                        tag: '15% Advance', tagColor: 'rgba(232,93,4,0.06)', tagBorder: 'rgba(232,93,4,0.2)', tagText: '#E85D04'
                      },
                      {
                        id: 'bkash', name: 'bKash', desc: `15% advance via Send Money to ${getPaymentNumber('bkash')}`,
                        icon: <span className="font-black text-pink-500 text-sm">bKash</span>,
                        tag: 'Popular', tagColor: 'rgba(226,19,110,0.06)', tagBorder: 'rgba(226,19,110,0.2)', tagText: '#e2136e'
                      },
                      {
                        id: 'nagad', name: 'Nagad', desc: `15% advance via Send Money to ${getPaymentNumber('nagad')}`,
                        icon: <span className="font-black text-orange-500 text-sm">Nagad</span>,
                        tag: null
                      },
                      {
                        id: 'rocket', name: 'Rocket (DBBL)', desc: `15% advance via Send Money to ${getPaymentNumber('rocket')}`,
                        icon: <span className="font-black text-purple-500 text-sm">Rocket</span>,
                        tag: null
                      },
                      {
                        id: 'card', name: 'Credit / Debit Card', desc: 'Visa, Mastercard, American Express',
                        icon: <CreditCard className="w-5 h-5 text-blue-500" />,
                        tag: 'International', tagColor: 'rgba(37,99,235,0.06)', tagBorder: 'rgba(37,99,235,0.2)', tagText: '#2563eb'
                      },
                    ].map(method => (
                      <label
                        key={method.id}
                        className="flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-200"
                        style={{
                          background: paymentMethod === method.id ? 'rgba(232,93,4,0.04)' : '#f9fafb',
                          border: paymentMethod === method.id ? '1px solid rgba(232,93,4,0.25)' : '1px solid #e5e7eb',
                          boxShadow: paymentMethod === method.id ? '0 2px 12px rgba(232,93,4,0.08)' : 'none',
                        }}
                      >
                        <input type="radio" name="payment" value={method.id}
                          checked={paymentMethod === method.id}
                          onChange={() => setPaymentMethod(method.id as CreateOrderRequestPaymentMethod)}
                          className="hidden" />
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${paymentMethod === method.id ? 'border-orange-500' : 'border-gray-300'}`}>
                          {paymentMethod === method.id && <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
                        </div>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gray-100 border border-gray-200">
                          {method.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-sm text-gray-900">{method.name}</p>
                            {method.tag && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                                style={{ background: method.tagColor, border: `1px solid ${method.tagBorder}`, color: method.tagText }}>
                                {method.tag}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{method.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  <AnimatePresence>
                    {paymentMethod === 'cod' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 overflow-hidden"
                      >
                        <div className="p-4 rounded-xl" style={{ background: 'rgba(22,163,74,0.04)', border: '1px solid rgba(22,163,74,0.15)' }}>
                          <p className="text-xs font-bold text-green-600 mb-2 flex items-center gap-1.5">
                            <Smartphone className="w-3.5 h-3.5" /> Choose mobile banking for 15% advance:
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {(['bkash', 'nagad', 'rocket'] as MobileMethod[]).map(m => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setCodAdvanceMethod(m)}
                                className="py-2.5 rounded-xl font-black text-xs transition-all"
                                style={{
                                  background: codAdvanceMethod === m ? gatewayTheme[m].light : '#f9fafb',
                                  border: codAdvanceMethod === m ? `1px solid ${gatewayTheme[m].border}` : '1px solid #e5e7eb',
                                  color: codAdvanceMethod === m ? gatewayTheme[m].primary : '#9ca3af',
                                }}
                              >
                                {m === 'bkash' ? 'bKash' : m === 'nagad' ? 'Nagad' : 'Rocket'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {isMobilePayment && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 overflow-hidden"
                      >
                        <div className="p-4 rounded-xl" style={{ background: 'rgba(232,93,4,0.04)', border: '1px solid rgba(232,93,4,0.12)' }}>
                          <div className="flex items-start gap-2">
                            <Smartphone className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-bold text-sm text-orange-600 mb-1">15% Advance Required</p>
                              <p className="text-xs text-gray-500 leading-relaxed">
                                You'll pay <strong className="text-gray-900">{formatPrice(advanceAmount)}</strong> (15% of {formatPrice(total)}) now via Send Money.
                                The remaining <strong className="text-gray-900">{formatPrice(total - advanceAmount)}</strong> is paid on delivery.
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {paymentMethod === 'card' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 overflow-hidden"
                      >
                        <div className="p-4 rounded-xl" style={{ background: 'rgba(37,99,235,0.04)', border: '1px solid rgba(37,99,235,0.12)' }}>
                          <div className="flex items-start gap-2">
                            <CreditCard className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-bold text-sm text-blue-600 mb-1">Card Payment</p>
                              <p className="text-xs text-gray-500 leading-relaxed">
                                We accept Visa, Mastercard, and American Express. You will receive a payment link via email/WhatsApp after placing your order.
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </form>
            </div>

            <div className="lg:col-span-5">
              <div className="sticky top-28 rounded-3xl p-7" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
                <h3 className="text-lg font-black font-display mb-6 text-gray-800">Order Summary</h3>

                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1 mb-6 hide-scrollbar">
                  {items.map(item => (
                    <div key={item.id} className="flex gap-3 items-center">
                      <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-gray-100"
                        style={{ background: '#f3f4f6' }}>
                        {item.imageUrl && <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm leading-tight truncate text-gray-800">{item.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Qty: {item.quantity}
                          {item.size ? ` · ${item.size}` : ''}
                          {item.color ? ` · ${item.color}` : ''}
                        </p>
                      </div>
                      <p className="font-bold text-sm text-orange-600 shrink-0">{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-100 pt-4 mb-4">
                  {!promoApplied ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoInput}
                        onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError(null); }}
                        placeholder="Promo or referral code"
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
                      />
                      <button
                        type="button"
                        onClick={validatePromo}
                        disabled={promoLoading || !promoInput.trim()}
                        className="px-4 py-2.5 rounded-xl text-sm font-bold text-white shrink-0 disabled:opacity-40"
                        style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}
                      >
                        {promoLoading ? "..." : "Apply"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.15)" }}>
                      <span className="text-sm font-bold text-green-600 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5" /> {promoApplied} — {formatPrice(promoDiscount)} off
                      </span>
                      <button type="button" onClick={removePromo} className="text-xs font-semibold text-red-500 hover:text-red-700">Remove</button>
                    </div>
                  )}
                  {promoError && <p className="text-xs text-red-500 mt-1.5 font-medium">{promoError}</p>}
                </div>

                <div className="border-t border-gray-100 pt-4 space-y-2.5 mb-6 text-sm">
                  <div className="flex justify-between text-gray-400">
                    <span>Subtotal</span>
                    <span className="font-semibold text-gray-700">{formatPrice(liveSubtotal)}</span>
                  </div>
                  {promoDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span className="font-semibold">-{formatPrice(promoDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-400">
                    <span>Shipping</span>
                    <span className={shippingCost === 0 ? "font-bold text-green-500" : "font-semibold text-gray-700"}>
                      {shippingCost === 0 ? "FREE" : formatPrice(shippingCost)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                    <span className="font-bold text-lg text-gray-800">Total</span>
                    <span className="font-black text-2xl text-primary">{formatPrice(total)}</span>
                  </div>

                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between items-center p-3 rounded-xl"
                      style={{ background: 'rgba(232,93,4,0.04)', border: '1px solid rgba(232,93,4,0.12)' }}>
                      <span className="text-xs font-bold text-orange-600">
                        Pay Now (15% Advance
                        {paymentMethod === 'cod' ? ` via ${codAdvanceMethod === 'bkash' ? 'bKash' : codAdvanceMethod === 'nagad' ? 'Nagad' : 'Rocket'}` : ''})
                      </span>
                      <span className="font-black text-orange-600">{formatPrice(advanceAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl"
                      style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)' }}>
                      <span className="text-xs font-bold text-green-600">Remaining (Paid on Delivery)</span>
                      <span className="font-black text-green-600">{formatPrice(total - advanceAmount)}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  form="checkout-form"
                  disabled={isPending}
                  className="btn-glow w-full py-4 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:transform-none"
                  style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)', boxShadow: '0 6px 24px rgba(232,93,4,0.35)' }}
                >
                  {isPending ? (
                    <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {serverWaking ? "Waking up server…" : "Placing Order..."}</>
                  ) : paymentMethod === 'cod' ? (
                    <>Proceed to Pay Advance <ArrowRight className="w-5 h-5" /></>
                  ) : paymentMethod === 'card' ? (
                    <>Proceed to Card Payment <ArrowRight className="w-5 h-5" /></>
                  ) : (
                    <>Proceed to {paymentMethod === 'bkash' ? 'bKash' : paymentMethod === 'nagad' ? 'Nagad' : 'Rocket'} Payment <ArrowRight className="w-5 h-5" /></>
                  )}
                </button>

                {serverWaking && isPending && (
                  <div className="mt-3 p-3 rounded-xl text-xs font-semibold text-amber-700 flex items-start gap-2"
                    style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <Loader2 className="w-3.5 h-3.5 shrink-0 mt-0.5 animate-spin" />
                    <span>Our server is waking up — this can take 30–50 seconds on the first request after a quiet period. Please don't close the page.</span>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary/50" />
                  Secure · All 64 Districts · Free Shipping ৳1500+
                </div>

                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER_INTL.replace('+', '')}?text=Hi TryNex! I need help with my order.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl font-semibold text-xs transition-all"
                  style={{ background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.15)', color: '#16a34a' }}
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Any questions? WhatsApp us — {WHATSAPP_NUMBER_LOCAL}
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
