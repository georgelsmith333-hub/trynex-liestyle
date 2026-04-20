import { AdminLayout } from "@/components/layout/AdminLayout";
import { useListOrders } from "@workspace/api-client-react";
import { Loader } from "@/components/ui/Loader";
import { getAuthHeaders, formatPrice, getApiUrl } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getListOrdersQueryKey } from "@workspace/api-client-react";
import {
  RefreshCw, Package, Clock, CheckCircle2, XCircle, Truck,
  Search, Eye, AlertTriangle, CreditCard, Check, X, Tag
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_OPTIONS = ["all", "pending", "processing", "shipped", "ongoing", "delivered", "cancelled"] as const;
type StatusFilter = typeof STATUS_OPTIONS[number];

const PAYMENT_LABELS: Record<string, { label: string; color: string }> = {
  cod: { label: "Cash on Delivery", color: "#4ade80" },
  bkash: { label: "bKash", color: "#e2136e" },
  nagad: { label: "Nagad", color: "#f7941d" },
  upay: { label: "uPay", color: "#0077cc" },
  rocket: { label: "Rocket", color: "#8b2291" },
  card: { label: "Card (Visa/MC)", color: "#2563eb" },
};

const PAYMENT_STATUS_OPTS = [
  { value: 'pending', label: '✗ Not Paid', color: '#ef4444' },
  { value: 'submitted', label: '⏳ Under Review', color: '#f59e0b' },
  { value: 'verified', label: '✓ Payment Confirmed', color: '#22c55e' },
  { value: 'wrong', label: '⚠ Payment Issue', color: '#ef4444' },
];


export default function AdminOrders() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const [lastCount, setLastCount] = useState<number | null>(null);
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);

  const { data, isLoading, refetch, dataUpdatedAt } = useListOrders(
    { limit: 200, ...(statusFilter !== "all" ? { status: statusFilter } : {}) },
    {
      request: { headers: getAuthHeaders() },
      query: {
        refetchInterval: 3000,           // 3s polling for near-real-time updates across devices
        refetchIntervalInBackground: true,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        staleTime: 0,                    // never serve stale data — always show latest
      } as any
    }
  );

  const [isUpdating, setIsUpdating] = useState(false);

  // Cross-tab + cross-window instant sync: when any admin tab updates an order,
  // every other admin tab refetches immediately via BroadcastChannel.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel("trynex-admin-orders");
    ch.onmessage = (ev) => {
      if (ev.data?.type === "orders:invalidate") {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        refetch();
      }
    };
    return () => ch.close();
  }, [queryClient, refetch]);

  // Refetch the moment the tab becomes visible (covers mobile background → foreground)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") refetch();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refetch]);

  const broadcastInvalidate = () => {
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const ch = new BroadcastChannel("trynex-admin-orders");
        ch.postMessage({ type: "orders:invalidate", at: Date.now() });
        ch.close();
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (data?.total !== undefined && lastCount !== null && data.total > lastCount) {
      setNewOrderAlert(true);
      toast({ title: `🎉 New Order!`, description: `${data.total - lastCount} new order(s) arrived!` });
      setTimeout(() => setNewOrderAlert(false), 5000);
    }
    if (data?.total !== undefined) setLastCount(data.total);
  }, [data?.total]);

  const patchOrdersCache = (id: number, patch: Record<string, string>) => {
    queryClient.setQueriesData({ queryKey: getListOrdersQueryKey() }, (old: any) => {
      if (!old?.orders) return old;
      return { ...old, orders: old.orders.map((o: any) => o.id === id ? { ...o, ...patch } : o) };
    });
  };

  const handleStatusChange = async (id: number, status: string) => {
    patchOrdersCache(id, { status });
    if (selectedOrder?.id === id) setSelectedOrder((prev: any) => ({ ...prev, status }));
    setIsUpdating(true);
    try {
      const res = await fetch(getApiUrl(`/api/orders/${id}/status`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed');
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      broadcastInvalidate();
      toast({ title: "✓ Status updated" });
    } catch {
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      toast({ title: "Update failed", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePaymentStatusChange = async (id: number, paymentStatus: string) => {
    patchOrdersCache(id, { paymentStatus });
    if (selectedOrder?.id === id) setSelectedOrder((prev: any) => ({ ...prev, paymentStatus }));
    setIsUpdatingPayment(true);
    try {
      const res = await fetch(getApiUrl(`/api/orders/${id}/payment-status`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ paymentStatus }),
      });
      if (!res.ok) throw new Error('Failed');
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      broadcastInvalidate();
      toast({ title: "✓ Payment status updated" });
    } catch {
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      toast({ title: "Failed to update payment status", variant: "destructive" });
    } finally {
      setIsUpdatingPayment(false);
    }
  };

  const getPaymentStatusColor = (s: string) => {
    const map: Record<string, string> = {
      pending: '#ef4444', not_paid: '#ef4444',
      submitted: '#f59e0b', verified: '#22c55e', wrong: '#ef4444', cod: '#4ade80'
    };
    return map[s] || '#aaa';
  };

  const getPaymentStatusLabel = (s: string) => {
    const map: Record<string, string> = {
      pending: 'Not Paid', not_paid: 'Not Paid', submitted: 'Under Review',
      verified: 'Confirmed', wrong: 'Issue', cod: 'COD'
    };
    return map[s] || s;
  };

  const statusClass = (s: string) => {
    const map: Record<string, string> = {
      pending: 'status-pending', processing: 'status-processing',
      shipped: 'status-shipped', delivered: 'status-delivered',
      cancelled: 'status-cancelled', ongoing: 'status-processing',
    };
    return map[s] || 'status-pending';
  };

  const statusIcon = (s: string) => {
    const map: Record<string, any> = {
      pending: Clock, processing: RefreshCw, shipped: Truck,
      ongoing: Truck, delivered: CheckCircle2, cancelled: XCircle
    };
    return map[s] || Package;
  };

  const filteredOrders = (data?.orders ?? []).filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return o.orderNumber?.toLowerCase().includes(q) ||
      o.customerName?.toLowerCase().includes(q) ||
      o.customerPhone?.includes(q) ||
      o.customerEmail?.toLowerCase().includes(q);
  });

  const lastRefresh = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('en-BD') : null;

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-primary mb-2">Manage</p>
          <h1 className="text-4xl font-black font-display tracking-tighter flex items-center gap-3">
            Orders
            {newOrderAlert && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-primary" />
              </motion.span>
            )}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-green-600">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              Live
            </span>
            {lastRefresh && <span className="text-xs text-gray-400">Auto-syncs every 3s · Last: {lastRefresh}</span>}
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all text-gray-500 hover:text-gray-900 hover:bg-gray-50"
          style={{ background: 'white', border: '1px solid #e5e7eb' }}
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
        {[
          { label: "Total", count: data?.total ?? 0, cls: 'text-gray-900' },
          { label: "Pending", count: (data?.orders ?? []).filter(o => o.status === 'pending').length, cls: 'text-yellow-400' },
          { label: "Processing", count: (data?.orders ?? []).filter(o => o.status === 'processing').length, cls: 'text-blue-400' },
          { label: "Shipped", count: (data?.orders ?? []).filter(o => ['shipped', 'ongoing'].includes(o.status)).length, cls: 'text-purple-400' },
          { label: "Delivered", count: (data?.orders ?? []).filter(o => o.status === 'delivered').length, cls: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-2xl text-center"
            style={{ background: '#f9fafb', border: '1px solid #f3f4f6' }}>
            <p className={`text-2xl font-black ${s.cls}`}>{s.count}</p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by order #, name, phone..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary"
            style={{ background: 'white', border: '1px solid #e5e7eb', color: '#111827' }}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-bold capitalize transition-all ${statusFilter === s ? 'text-white' : 'text-gray-500 hover:text-gray-900'}`}
              style={statusFilter === s
                ? { background: 'hsl(var(--primary))', boxShadow: '0 4px 16px rgba(255,107,43,0.3)' }
                : { background: '#f9fafb', border: '1px solid #e5e7eb' }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? <Loader /> : (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {["Order #", "Date", "Customer", "Total", "Payment", "Pay Status", "Order Status", "Action"].map(h => (
                    <th key={h} className="px-4 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredOrders.map((order, i) => {
                    const Icon = statusIcon(order.status);
                    const pm = PAYMENT_LABELS[order.paymentMethod] || { label: order.paymentMethod, color: '#aaa' };
                    const payColor = getPaymentStatusColor(order.paymentStatus || 'pending');
                    const payLabel = getPaymentStatusLabel(order.paymentStatus || 'pending');
                    return (
                      <motion.tr
                        key={order.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="border-t border-white/5 hover:bg-white/[0.02] transition-colors group"
                      >
                        <td className="px-4 py-4 font-mono text-xs font-bold text-primary whitespace-nowrap">{order.orderNumber}</td>
                        <td className="px-4 py-4 text-xs text-gray-500 whitespace-nowrap">
                          {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-BD', { day: '2-digit', month: 'short' }) : 'N/A'}
                          <br />
                          <span className="text-gray-300">{order.createdAt ? new Date(order.createdAt).toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-bold text-sm leading-tight">{order.customerName}</p>
                          <p className="text-xs text-gray-500">{order.customerPhone}</p>
                          <p className="text-[10px] text-gray-300">{order.shippingDistrict}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-black text-primary text-sm">{formatPrice(order.total)}</p>
                          {(order.shippingCost ?? 0) === 0 && <p className="text-[10px] text-green-400">FREE ship</p>}
                          {order.promoCode && <p className="text-[10px] text-purple-500 font-bold">{order.promoCode} (-{formatPrice(order.promoDiscount || 0)})</p>}
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: `${pm.color}15`, color: pm.color }}>
                            {pm.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <select
                            value={order.paymentStatus || 'pending'}
                            onChange={e => handlePaymentStatusChange(order.id, e.target.value)}
                            disabled={isUpdatingPayment}
                            className="text-xs font-bold px-2 py-1.5 rounded-lg border border-gray-200 outline-none cursor-pointer"
                            style={{ background: `${payColor}15`, color: payColor }}
                          >
                            {PAYMENT_STATUS_OPTS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-4">
                          <select
                            value={order.status}
                            onChange={e => handleStatusChange(order.id, e.target.value)}
                            disabled={isUpdating}
                            className={`text-xs font-bold px-2 py-1.5 rounded-xl border border-gray-200 outline-none cursor-pointer capitalize ${statusClass(order.status)}`}
                            style={{ background: 'white' }}
                          >
                            <option value="pending">⏳ Pending</option>
                            <option value="processing">🔄 Processing</option>
                            <option value="shipped">📦 Shipped</option>
                            <option value="ongoing">🚚 On the Way</option>
                            <option value="delivered">✅ Delivered</option>
                            <option value="cancelled">❌ Cancelled</option>
                          </select>
                        </td>
                        <td className="px-4 py-4">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="p-2 rounded-lg transition-all hover:-translate-y-0.5"
                            style={{ background: 'rgba(255,107,43,0.1)', color: 'hsl(var(--primary))' }}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center">
                      <Package className="w-12 h-12 mx-auto mb-4 opacity-15" />
                      <p className="text-gray-400 text-sm font-medium">
                        {search ? `No orders matching "${search}"` : 'No orders yet.'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
            onClick={e => e.target === e.currentTarget && setSelectedOrder(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="w-full max-w-lg rounded-3xl overflow-hidden max-h-[85vh] overflow-y-auto"
              style={{ background: 'white', border: '1px solid #e5e7eb' }}
            >
              <div className="p-6 border-b border-white/5 flex items-start justify-between sticky top-0 z-10"
                style={{ background: 'white' }}>
                <div>
                  <p className="text-xs font-black text-primary uppercase tracking-widest mb-1">Order Details</p>
                  <h2 className="text-xl font-black font-display">{selectedOrder.orderNumber}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString('en-BD') : ''}
                  </p>
                </div>
                <button onClick={() => setSelectedOrder(null)}
                  className="p-2 text-gray-400 hover:text-gray-900 rounded-xl"
                  style={{ background: '#fff4ee' }}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Customer */}
                <div className="p-4 rounded-2xl" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Customer Info</p>
                  <p className="font-black">{selectedOrder.customerName}</p>
                  <p className="text-sm text-gray-500">{selectedOrder.customerEmail}</p>
                  <p className="text-sm text-gray-500">{selectedOrder.customerPhone}</p>
                  <p className="text-sm text-gray-500 mt-2">{selectedOrder.shippingAddress}, {selectedOrder.shippingDistrict}</p>
                </div>

                {/* Payment Controls */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Payment Method</p>
                    <div className="p-3 rounded-xl font-bold text-sm capitalize"
                      style={{ background: '#fff8f5', border: '1px solid #fed7aa', color: PAYMENT_LABELS[selectedOrder.paymentMethod]?.color || '#aaa' }}>
                      {PAYMENT_LABELS[selectedOrder.paymentMethod]?.label || selectedOrder.paymentMethod}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                      <CreditCard className="inline w-3 h-3 mr-1" />Payment Status
                      {selectedOrder.paymentMethod === 'cod' && (
                        <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
                          15% Advance
                        </span>
                      )}
                    </p>
                    <select
                      value={selectedOrder.paymentStatus || 'pending'}
                      onChange={e => handlePaymentStatusChange(selectedOrder.id, e.target.value)}
                      disabled={isUpdatingPayment}
                      className="w-full px-3 py-3 rounded-xl text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary transition-all cursor-pointer"
                      style={{ background: 'white', border: '1px solid #e5e7eb', color: '#111827' }}
                    >
                      {PAYMENT_STATUS_OPTS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedOrder.notes && (
                  <div className="p-4 rounded-xl"
                    style={{ background: 'rgba(255,107,43,0.05)', border: '1px solid rgba(255,107,43,0.15)' }}>
                    <p className="text-xs font-black uppercase tracking-widest text-primary mb-2">Notes / Payment Info</p>
                    <p className="text-sm text-gray-500 font-mono">{selectedOrder.notes}</p>
                  </div>
                )}

                {(selectedOrder.utmSource || selectedOrder.utmMedium || selectedOrder.utmCampaign) && (
                  <div className="p-4 rounded-xl"
                    style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
                    <p className="text-xs font-black uppercase tracking-widest text-blue-600 mb-2">Ad Attribution (UTM)</p>
                    <div className="space-y-1 text-sm">
                      {selectedOrder.utmSource && <p className="text-gray-700"><span className="font-bold text-gray-500 w-24 inline-block">Source:</span> {selectedOrder.utmSource}</p>}
                      {selectedOrder.utmMedium && <p className="text-gray-700"><span className="font-bold text-gray-500 w-24 inline-block">Medium:</span> {selectedOrder.utmMedium}</p>}
                      {selectedOrder.utmCampaign && <p className="text-gray-700"><span className="font-bold text-gray-500 w-24 inline-block">Campaign:</span> {selectedOrder.utmCampaign}</p>}
                    </div>
                  </div>
                )}

                {/* Items */}
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Items</p>
                  <div className="space-y-2">
                    {(selectedOrder.items ?? []).map((item: any, i: number) => (
                      <div key={i} className="p-3 rounded-xl"
                        style={{ background: '#fff8f5', border: '1px solid #fed7aa' }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-sm">{item.productName}</p>
                            <p className="text-xs text-gray-500">
                              Qty: {item.quantity}
                              {item.size ? ` · Size: ${item.size}` : ''}
                              {item.color ? ` · ${item.color}` : ''}
                            </p>
                            {(() => {
                              if (!item.customNote) return null;
                              let parsed: any = null;
                              try { parsed = JSON.parse(item.customNote); } catch {}
                              if (parsed && typeof parsed === "object" && parsed.studioDesign) {
                                const layers = Number(parsed.layerCount) || 0;
                                const front = Number(parsed.frontLayerCount) || 0;
                                const back = Number(parsed.backLayerCount) || 0;
                                const originals: string[] = Array.isArray(parsed.originalAssetUrls) ? parsed.originalAssetUrls : [];
                                return (
                                  <>
                                    <p className="text-xs text-primary/70 mt-1">
                                      Custom studio design · {layers} layer{layers === 1 ? '' : 's'}
                                      {(front || back) ? ` (${front} front, ${back} back)` : ''}
                                    </p>
                                    {originals.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-1.5">
                                        {originals.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              try {
                                                toast({ title: "Preparing zip...", description: `Bundling ${originals.length} files` });
                                                const JSZip = (await import("jszip")).default;
                                                const zip = new JSZip();
                                                for (let i = 0; i < originals.length; i++) {
                                                  const p = originals[i];
                                                  const r = await fetch(getApiUrl(`/api/storage/sign-download?path=${encodeURIComponent(p)}`), { headers: getAuthHeaders() });
                                                  if (!r.ok) continue;
                                                  const j = await r.json();
                                                  if (!j?.url) continue;
                                                  const blob = await (await fetch(j.url)).blob();
                                                  const ext = (p.split(".").pop() || "bin").split("?")[0];
                                                  zip.file(`design-${i + 1}.${ext}`, blob);
                                                }
                                                const out = await zip.generateAsync({ type: "blob" });
                                                const url = URL.createObjectURL(out);
                                                const a = document.createElement("a");
                                                a.href = url;
                                                a.download = `order-originals-${Date.now()}.zip`;
                                                document.body.appendChild(a);
                                                a.click();
                                                document.body.removeChild(a);
                                                URL.revokeObjectURL(url);
                                                toast({ title: "Zip ready", description: `Downloaded ${originals.length} files` });
                                              } catch (err) {
                                                toast({ title: "Zip failed", description: String(err), variant: "destructive" });
                                              }
                                            }}
                                            className="px-2 py-1 rounded-lg text-[10px] font-bold bg-orange-500 text-white border border-orange-600 hover:bg-orange-600 transition-colors"
                                          >
                                            ⬇ Download all originals (zip)
                                          </button>
                                        )}
                                        {originals.map((path, idx) => (
                                          <button
                                            key={idx}
                                            type="button"
                                            onClick={async () => {
                                              try {
                                                const r = await fetch(getApiUrl(`/api/storage/sign-download?path=${encodeURIComponent(path)}`), {
                                                  headers: getAuthHeaders(),
                                                });
                                                if (!r.ok) {
                                                  toast({ title: "Download failed", description: `Server returned ${r.status}`, variant: "destructive" });
                                                  return;
                                                }
                                                const data = await r.json();
                                                if (data?.url) window.open(data.url, "_blank", "noopener,noreferrer");
                                                else toast({ title: "Download failed", description: "Missing URL in response", variant: "destructive" });
                                              } catch (err) {
                                                toast({ title: "Download failed", description: String(err), variant: "destructive" });
                                              }
                                            }}
                                            className="px-2 py-1 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                                            title={path}
                                          >
                                            ⬇ Original {idx + 1}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                );
                              }
                              if (parsed && typeof parsed === "object" && parsed.hamper) return null;
                              return <p className="text-xs text-primary/70 mt-1">"{item.customNote}"</p>;
                            })()}
                          </div>
                          <p className="font-black text-primary text-sm">{formatPrice(item.price * item.quantity)}</p>
                        </div>
                        {item.customImages && item.customImages.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-orange-100">
                            <p className="text-[10px] font-black uppercase tracking-widest text-orange-400 mb-1.5">Customer Design Files</p>
                            <div className="flex flex-wrap gap-2">
                              {item.customImages.map((img: string, idx: number) => (
                                <a key={idx} href={img} target="_blank" rel="noopener noreferrer"
                                  className="block w-14 h-14 rounded-lg overflow-hidden border border-gray-200 hover:border-orange-400 transition-colors hover:shadow-md">
                                  <img src={img} alt={`Design ${idx + 1}`} className="w-full h-full object-cover" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div className="p-4 rounded-2xl" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="font-semibold">{formatPrice(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-gray-500">Shipping</span>
                    <span className={selectedOrder.shippingCost === 0 ? "font-bold text-green-400" : "font-semibold"}>
                      {selectedOrder.shippingCost === 0 ? "FREE" : formatPrice(selectedOrder.shippingCost)}
                    </span>
                  </div>
                  {selectedOrder.promoCode && (
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-gray-500 flex items-center gap-1.5">
                        <Tag className="w-3 h-3" />
                        Promo: <span className="font-mono font-bold text-purple-600">{selectedOrder.promoCode}</span>
                      </span>
                      <span className="font-bold text-green-500">-{formatPrice(selectedOrder.promoDiscount || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-3 border-t border-white/5">
                    <span className="font-bold">Total</span>
                    <span className="font-black text-primary text-xl">{formatPrice(selectedOrder.total)}</span>
                  </div>
                </div>

                {/* Order Status */}
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Update Order Status</p>
                  <select
                    value={selectedOrder.status}
                    onChange={e => handleStatusChange(selectedOrder.id, e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    style={{ background: 'white', border: '1px solid #e5e7eb', color: '#111827' }}
                  >
                    <option value="pending">⏳ Pending</option>
                    <option value="processing">🔄 Processing</option>
                    <option value="shipped">📦 Shipped to Department</option>
                    <option value="ongoing">🚚 On the Way (Ongoing)</option>
                    <option value="delivered">✅ Delivered</option>
                    <option value="cancelled">❌ Cancelled</option>
                  </select>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
