import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatPrice, getApiUrl } from "@/lib/utils";
import {
  User, Mail, Phone, LogOut, Edit3, Check, X, Package, Heart,
  Loader2, ShieldCheck, Gift, TrendingUp, Wallet, Eye, Clock,
  ArrowRight, Lock, ChevronDown, ChevronUp, CheckCircle2,
  ShoppingBag, Calendar, MapPin, Tag
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PreviewLightbox, type PreviewItem } from "@/components/ZoomableImage";

interface ReferralData {
  code: string;
  totalUses: number;
  totalEarnings: number;
  discountPercent: number;
  active: boolean;
}

interface RecentProduct {
  id: number;
  slug: string;
  name: string;
  price: number;
  discountPrice?: number;
  imageUrl?: string;
}

interface OrderItem {
  productId: number;
  productName: string;
  productImage?: string;
  imageUrl?: string;
  customNote?: string;
  isStudio?: boolean;
  quantity: number;
  size?: string;
  color?: string;
  price: number;
}

interface Order {
  id: number;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  items: OrderItem[];
  subtotal: string;
  shippingCost: string;
  total: string;
  promoCode?: string;
  promoDiscount?: string;
  shippingAddress: string;
  shippingCity?: string;
  shippingDistrict?: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  processing: "bg-purple-100 text-purple-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function Account() {
  const [, navigate] = useLocation();
  const { customer, isLoading, isAuthenticated, updateProfile, logout } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "orders" | "referral" | "recent">("profile");

  const [myReferral, setMyReferral] = useState<ReferralData | null>(null);
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([]);

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [orderLightbox, setOrderLightbox] = useState<{ orderId: number; index: number } | null>(null);

  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (customer) {
      setEditName(customer.name);
      setEditPhone(customer.phone || "");
    }
  }, [customer]);

  useEffect(() => {
    if (customer?.email) {
      fetch(getApiUrl(`/api/referrals/my/${encodeURIComponent(customer.email)}`))
        .then(r => r.json())
        .then(data => { if (data.referral) setMyReferral(data.referral); })
        .catch(() => {});
    }
  }, [customer?.email]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("trynex_recently_viewed");
      if (stored) {
        const parsed = JSON.parse(stored);
        setRecentProducts(Array.isArray(parsed) ? parsed.slice(0, 8) : []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (activeTab === "orders" && customer) {
      fetchOrders();
    }
  }, [activeTab, customer]);

  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail;
      if (tab === "orders") setActiveTab("orders");
    };
    window.addEventListener("account-tab", handler);
    return () => window.removeEventListener("account-tab", handler);
  }, []);

  const fetchOrders = async () => {
    const token = localStorage.getItem("trynex_customer_token");
    if (!token) return;
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const resp = await fetch(getApiUrl("/api/orders/my"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Failed to fetch orders");
      const data = await resp.json();
      setOrders(data.orders || []);
    } catch {
      setOrdersError("Could not load orders. Please try again.");
    }
    setOrdersLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ name: editName, phone: editPhone });
      toast({ title: "✓ Profile updated", description: "Your changes have been saved." });
    } catch {
      toast({ title: "Could not save changes", description: "Please try again.", variant: "destructive" });
    }
    setSaving(false);
    setEditing(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }
    const token = localStorage.getItem("trynex_customer_token");
    if (!token) return;
    setPasswordSaving(true);
    try {
      const resp = await fetch(getApiUrl("/api/auth/change-password"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setPasswordError(data.message || "Failed to change password");
      } else {
        toast({ title: "✓ Password changed", description: "Your new password is now active." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
        setChangingPassword(false);
      }
    } catch {
      setPasswordError("Network error. Please try again.");
    }
    setPasswordSaving(false);
  };

  // Suppress account UI render until BOTH:
  //   1. Auth state has resolved (isLoading === false), AND
  //   2. We have a customer object to render with.
  // This prevents the brief flash of empty-account chrome between
  // session resolution and the redirect-to-/login effect firing.
  if (isLoading || !isAuthenticated || !customer) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "profile" as const, label: "Profile", icon: User },
    { id: "orders" as const, label: "My Orders", icon: ShoppingBag },
    { id: "referral" as const, label: "Referrals", icon: Gift },
    { id: "recent" as const, label: "Recently Viewed", icon: Eye },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <SEOHead title="My Account" description="Manage your TryNex Lifestyle account" noindex />
      <Navbar />

      <main className="flex-1 px-4 py-6 sm:py-12 pt-header">
        <div className="max-w-2xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="px-5 sm:px-6 py-6 sm:py-8" style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 sm:gap-4">
                    {customer.avatar ? (
                      <img src={customer.avatar} alt={customer.name} className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-white/50 shadow-lg object-cover" />
                    ) : (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/50">
                        <User className="w-7 h-7 text-white" />
                      </div>
                    )}
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-white">{customer.name}</h2>
                      <p className="text-orange-100 text-xs sm:text-sm flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Verified Customer
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Sign Out</span>
                  </button>
                </div>
              </div>

              <div className="flex border-b border-gray-100 overflow-x-auto">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-1.5 px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-all border-b-2 ${
                      activeTab === id
                        ? "text-orange-600 border-orange-500"
                        : "text-gray-400 border-transparent hover:text-gray-600"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="p-5 sm:p-6">
                {activeTab === "profile" && (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900 text-sm">Profile Information</h3>
                        {!editing ? (
                          <button
                            onClick={() => setEditing(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-orange-600 hover:bg-orange-50 transition-all"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Edit
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={handleSave}
                              disabled={saving}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-green-600 hover:bg-green-50 transition-all"
                            >
                              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
                            </button>
                            <button
                              onClick={() => { setEditing(false); setEditName(customer.name); setEditPhone(customer.phone || ""); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-50 transition-all"
                            >
                              <X className="w-3.5 h-3.5" /> Cancel
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <User className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Name</p>
                            {editing ? (
                              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm" />
                            ) : (
                              <p className="text-gray-900 font-medium text-sm">{customer.name}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <Mail className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Email</p>
                            <p className="text-gray-900 font-medium text-sm truncate">{customer.email}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <Phone className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Phone</p>
                            {editing ? (
                              <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="01XXXXXXXXX"
                                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm" />
                            ) : (
                              <p className="text-gray-900 font-medium text-sm">{customer.phone || "Not set"}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Link
                        href="/track"
                        className="flex items-center gap-2 p-3 sm:p-4 rounded-xl bg-orange-50 border border-orange-100 hover:bg-orange-100 transition-all group"
                      >
                        <Package className="w-5 h-5 text-orange-500 shrink-0" />
                        <span className="text-sm font-semibold text-gray-900">Track Orders</span>
                      </Link>
                      <Link
                        href="/wishlist"
                        className="flex items-center gap-2 p-3 sm:p-4 rounded-xl bg-red-50 border border-red-100 hover:bg-red-100 transition-all group"
                      >
                        <Heart className="w-5 h-5 text-red-500 shrink-0" />
                        <span className="text-sm font-semibold text-gray-900">Wishlist</span>
                      </Link>
                    </div>

                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                      <button
                        onClick={() => { setChangingPassword(!changingPassword); setPasswordError(""); setPasswordSuccess(""); }}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all"
                      >
                        <span className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-gray-400" />
                          Change Password
                        </span>
                        {changingPassword ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </button>
                      <AnimatePresence>
                        {changingPassword && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <form onSubmit={handleChangePassword} className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                              {passwordError && (
                                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{passwordError}</div>
                              )}
                              {passwordSuccess && (
                                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700 flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> {passwordSuccess}
                                </div>
                              )}
                              <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Current password"
                                required
                                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm"
                              />
                              <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="New password (min 6 characters)"
                                required
                                minLength={6}
                                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm"
                              />
                              <input
                                type="password"
                                value={confirmNewPassword}
                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                placeholder="Confirm new password"
                                required
                                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm"
                              />
                              <button
                                type="submit"
                                disabled={passwordSaving}
                                className="w-full py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                {passwordSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                Update Password
                              </button>
                            </form>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {activeTab === "orders" && (
                  <div>
                    {ordersLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-7 h-7 animate-spin text-orange-500" />
                      </div>
                    ) : ordersError ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-red-500 mb-3">{ordersError}</p>
                        <button onClick={fetchOrders} className="text-sm text-orange-600 font-semibold hover:underline">Try Again</button>
                      </div>
                    ) : orders.length === 0 ? (
                      <div className="text-center py-10">
                        <ShoppingBag className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                        <h3 className="font-bold text-gray-900 mb-1.5">No Orders Yet</h3>
                        <p className="text-sm text-gray-500 mb-4">Your order history will appear here once you place an order.</p>
                        <Link
                          href="/products"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white text-sm"
                          style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}
                        >
                          Shop Now <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {orders.map((order) => (
                          <div key={order.id} className="border border-gray-100 rounded-xl overflow-hidden hover:border-orange-200 transition-all">
                            <div className="flex items-center justify-between px-4 py-3 bg-gray-50/60">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-black text-gray-900 font-mono">#{order.orderNumber}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-600"}`}>
                                  {STATUS_LABELS[order.status] || order.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                <Calendar className="w-3 h-3" />
                                {new Date(order.createdAt).toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" })}
                              </div>
                            </div>

                            <div className="px-4 py-3 space-y-2">
                              {(() => {
                                const previewItems: PreviewItem[] = [];
                                const previewIndexByItem = new Map<number, number>();
                                order.items.forEach((item, idx) => {
                                  let isStudio = !!item.isStudio;
                                  if (!isStudio) {
                                    try { isStudio = !!JSON.parse(item.customNote ?? "{}").studioDesign; } catch {}
                                  }
                                  const src = item.imageUrl || item.productImage || '';
                                  if (!src) return;
                                  previewIndexByItem.set(idx, previewItems.length);
                                  previewItems.push({ src, alt: `${item.productName} preview`, isStudio });
                                });
                                const isOpen = orderLightbox?.orderId === order.id;
                                return (
                                  <>
                                    <div className="flex gap-2 overflow-x-auto pb-1">
                                      {order.items.slice(0, 4).map((item, i) => {
                                        const src = item.imageUrl || item.productImage || '';
                                        const lbIdx = previewIndexByItem.get(i);
                                        const canZoom = src && lbIdx !== undefined;
                                        return (
                                          <div key={i} className="shrink-0 flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5 border border-gray-100">
                                            {src && (
                                              canZoom ? (
                                                <button
                                                  type="button"
                                                  onClick={() => setOrderLightbox({ orderId: order.id, index: lbIdx! })}
                                                  className="rounded overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 cursor-zoom-in"
                                                  aria-label={`View ${item.productName} preview full size`}
                                                >
                                                  <img src={src} alt={item.productName} className="w-6 h-6 object-cover" />
                                                </button>
                                              ) : (
                                                <img src={src} alt={item.productName} className="w-6 h-6 rounded object-cover" />
                                              )
                                            )}
                                            <span className="text-xs text-gray-700 font-medium whitespace-nowrap">{item.productName}</span>
                                            <span className="text-[10px] text-gray-400">×{item.quantity}</span>
                                          </div>
                                        );
                                      })}
                                      {order.items.length > 4 && (
                                        <div className="shrink-0 flex items-center px-2.5 py-1.5 text-xs text-gray-400">
                                          +{order.items.length - 4} more
                                        </div>
                                      )}
                                    </div>
                                    <PreviewLightbox
                                      items={previewItems}
                                      index={isOpen ? orderLightbox!.index : null}
                                      onIndexChange={(i) => setOrderLightbox({ orderId: order.id, index: i })}
                                      onClose={() => setOrderLightbox(null)}
                                    />
                                  </>
                                );
                              })()}

                              <div className="flex items-center justify-between pt-1">
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {order.shippingDistrict || order.shippingCity || "Bangladesh"}
                                  </span>
                                  {order.promoCode && (
                                    <span className="flex items-center gap-1 text-green-600">
                                      <Tag className="w-3 h-3" />
                                      {order.promoCode}
                                    </span>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-black text-gray-900">{formatPrice(parseFloat(order.total))}</p>
                                  <p className="text-[10px] text-gray-400 capitalize">{order.paymentMethod}</p>
                                </div>
                              </div>

                              <div className="flex justify-end pt-2 border-t border-gray-100 mt-1">
                                <Link
                                  // Auto-fill: prefer phone, fall back to email
                                  // so the tracking page can auto-submit even
                                  // for users who never set a phone number.
                                  href={(() => {
                                    const id = customer?.phone?.trim();
                                    const email = customer?.email?.trim();
                                    const param = id
                                      ? `phone=${encodeURIComponent(id)}`
                                      : email
                                      ? `email=${encodeURIComponent(email)}`
                                      : "";
                                    return `/track?order=${encodeURIComponent(order.orderNumber)}${param ? `&${param}` : ""}`;
                                  })()}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors hover:bg-orange-50"
                                  style={{ color: '#E85D04', border: '1px solid #fed7aa' }}
                                  data-testid={`button-track-order-${order.orderNumber}`}
                                >
                                  Track this order <ArrowRight className="w-3 h-3" />
                                </Link>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "referral" && (
                  <div>
                    {myReferral ? (
                      <div className="space-y-4">
                        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-center">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Your Referral Code</p>
                          <p className="text-2xl font-black font-mono tracking-wider text-orange-600">{myReferral.code}</p>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-3 rounded-xl bg-gray-50 border border-gray-100">
                            <TrendingUp className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                            <p className="text-xl font-black text-gray-900">{myReferral.totalUses || 0}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Referrals</p>
                          </div>
                          <div className="text-center p-3 rounded-xl bg-gray-50 border border-gray-100">
                            <Wallet className="w-5 h-5 text-green-500 mx-auto mb-1" />
                            <p className="text-xl font-black text-green-600">{formatPrice(myReferral.totalEarnings || 0)}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Earned</p>
                          </div>
                          <div className="text-center p-3 rounded-xl bg-gray-50 border border-gray-100">
                            <Gift className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                            <p className="text-xl font-black text-blue-600">10%</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Rate</p>
                          </div>
                        </div>

                        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                          <p className="text-sm text-green-800 font-medium">
                            Share your link: <span className="font-mono text-xs break-all">{window.location.origin}?ref={myReferral.code}</span>
                          </p>
                          <p className="text-xs text-green-600 mt-1">Your friends get 10% off. You earn 10% credit on every sale.</p>
                        </div>

                        <p className="text-xs text-gray-400 text-center">
                          Earnings accumulate as store credit. Contact us via WhatsApp to redeem or use on your next order.
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <h3 className="font-bold text-gray-900 mb-2">No Referral Code Yet</h3>
                        <p className="text-sm text-gray-500 mb-4">Create your referral code and start earning 10% on every sale!</p>
                        <Link
                          href="/referral"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white text-sm"
                          style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}
                        >
                          Get My Code <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "recent" && (
                  <div>
                    {recentProducts.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {recentProducts.map((product) => (
                          <Link
                            key={product.id}
                            href={`/product/${product.slug || product.id}`}
                            className="group rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-all bg-white"
                          >
                            <div className="aspect-square bg-gray-100 overflow-hidden">
                              {product.imageUrl ? (
                                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                  <Package className="w-8 h-8" />
                                </div>
                              )}
                            </div>
                            <div className="p-2.5">
                              <p className="text-xs font-semibold text-gray-900 truncate">{product.name}</p>
                              <p className="text-xs font-bold text-orange-600 mt-0.5">
                                {formatPrice(product.discountPrice || product.price)}
                              </p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <h3 className="font-bold text-gray-900 mb-2">No Recently Viewed Products</h3>
                        <p className="text-sm text-gray-500 mb-4">Start browsing our collection to see your recent views here.</p>
                        <Link
                          href="/products"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white text-sm"
                          style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}
                        >
                          Browse Products <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
