import React from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useGetAdminStats, type AdminStatsWeeklyDataItem, type AdminStatsPaymentDistributionItem } from "@workspace/api-client-react";
import { Loader } from "@/components/ui/Loader";
import { getAuthHeaders, formatPrice } from "@/lib/utils";
import { TrendingUp, ShoppingCart, Package, AlertTriangle, ArrowUpRight, RefreshCw, Star, Info, X } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar
} from "recharts";

const FALLBACK_WEEKLY: AdminStatsWeeklyDataItem[] = [
  { day: "Mon", revenue: 0, orders: 0 },
  { day: "Tue", revenue: 0, orders: 0 },
  { day: "Wed", revenue: 0, orders: 0 },
  { day: "Thu", revenue: 0, orders: 0 },
  { day: "Fri", revenue: 0, orders: 0 },
  { day: "Sat", revenue: 0, orders: 0 },
  { day: "Sun", revenue: 0, orders: 0 },
];

const FALLBACK_PAYMENT: AdminStatsPaymentDistributionItem[] = [
  { name: "bKash", value: 0, color: "#e2136e" },
  { name: "Nagad", value: 0, color: "#f7941d" },
  { name: "COD", value: 0, color: "#16a34a" },
  { name: "Rocket", value: 0, color: "#8b2291" },
];

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-lg text-sm">
        <p className="font-bold text-gray-900 mb-2">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="font-semibold" style={{ color: p.color }}>
            {p.name}: {p.name === "revenue" ? formatPrice(p.value) : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AdminDashboard() {
  const { data: rawStats, isLoading, refetch, dataUpdatedAt } = useGetAdminStats();
  const [showProdNotice, setShowProdNotice] = React.useState(
    () => localStorage.getItem("trynex_prod_notice_dismissed") !== "1"
  );
  const dismissProdNotice = () => {
    localStorage.setItem("trynex_prod_notice_dismissed", "1");
    setShowProdNotice(false);
  };

  if (isLoading || !rawStats) return <AdminLayout><Loader /></AdminLayout>;

  const stats = rawStats;
  const lastRefresh = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('en-BD') : null;
  const WEEKLY_DATA = stats.weeklyData && stats.weeklyData.length > 0 ? stats.weeklyData : FALLBACK_WEEKLY;
  const PAYMENT_DATA = stats.paymentDistribution && stats.paymentDistribution.length > 0 ? stats.paymentDistribution : FALLBACK_PAYMENT;
  const topProducts = stats.topProducts || [];

  const cards = [
    {
      title: "Total Revenue",
      value: formatPrice(stats.totalRevenue),
      icon: TrendingUp,
      color: "#16a34a",
      bg: "#f0fdf4",
      border: "#bbf7d0",
      desc: "All time earnings",
      trend: "",
      link: ""
    },
    {
      title: "Today's Revenue",
      value: formatPrice(stats.todayRevenue ?? 0),
      icon: TrendingUp,
      color: "#2563eb",
      bg: "#eff6ff",
      border: "#bfdbfe",
      desc: "Earned today",
      trend: "",
      link: ""
    },
    {
      title: "Total Orders",
      value: String(stats.totalOrders),
      icon: ShoppingCart,
      color: "#E85D04",
      bg: "#fff4ee",
      border: "#fdd5b4",
      desc: "All orders placed",
      trend: `${stats.pendingOrders} pending`,
      link: "/admin/orders"
    },
    {
      title: "Low Stock Alert",
      value: String(stats.lowStockProducts ?? 0),
      icon: AlertTriangle,
      color: "#d97706",
      bg: "#fffbeb",
      border: "#fde68a",
      desc: "Products ≤ 5 units",
      trend: (stats.lowStockProducts ?? 0) > 0 ? "Action needed" : "All good",
      link: "/admin/products?filter=lowstock"
    },
  ];

  const getStatusStyle = (status: string) => {
    const map: Record<string, string> = {
      pending: 'status-pending', processing: 'status-processing',
      shipped: 'status-shipped', delivered: 'status-delivered',
      cancelled: 'status-cancelled', ongoing: 'status-ongoing',
    };
    return map[status] || 'status-pending';
  };

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-orange-500 mb-1">Overview</p>
          <h1 className="text-3xl font-black font-display tracking-tight text-gray-900">Dashboard</h1>
          {lastRefresh && (
            <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1.5 font-medium">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400"></span>
              </span>
              Live · Updated {lastRefresh}
            </p>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all text-gray-600 bg-white border border-gray-200 hover:border-orange-300 hover:text-orange-600"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Production DB Notice */}
      {showProdNotice && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6 text-sm">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <div className="flex-1 text-blue-800">
            <span className="font-semibold">Production database is separate.</span> Your live site on{" "}
            <span className="font-medium">trynexshop.com</span> uses the Render database — which starts empty.
            Add your products, categories, and settings via this admin panel after each new deployment.
          </div>
          <button onClick={dismissProdNotice} className="text-blue-400 hover:text-blue-600 mt-0.5 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {cards.map((c, i) => {
          const Icon = c.icon;
          const cardContent = (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: c.bg }}>
                  <Icon className="w-5 h-5" style={{ color: c.color }} />
                </div>
                {c.trend && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: c.bg, color: c.color }}>
                    {c.trend}
                  </span>
                )}
              </div>
              <p className="text-2xl font-black text-gray-900 mb-1">{c.value}</p>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 font-medium">{c.title}</p>
                {c.link && <ArrowUpRight className="w-3.5 h-3.5 text-gray-300" />}
              </div>
            </>
          );
          return (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -3 }}
            >
              {c.link ? (
                <Link
                  href={c.link}
                  className="block p-6 rounded-2xl bg-white border shadow-sm cursor-pointer hover:border-orange-200 transition-colors"
                  style={{ borderColor: c.border }}
                >
                  {cardContent}
                </Link>
              ) : (
                <div
                  className="block p-6 rounded-2xl bg-white border shadow-sm"
                  style={{ borderColor: c.border }}
                >
                  {cardContent}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-black text-gray-900">Weekly Revenue</h2>
              <p className="text-xs text-gray-400 mt-0.5">Last 7 days performance</p>
            </div>
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-green-50 text-green-600 border border-green-100">
              Real-time data
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={WEEKLY_DATA} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E85D04" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#E85D04" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fontWeight: 600, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `৳${(v/1000).toFixed(0)}K`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" name="revenue" stroke="#E85D04" strokeWidth={2.5} fill="url(#revenueGrad)" dot={{ fill: '#E85D04', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Payment Methods Pie */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
        >
          <h2 className="font-black text-gray-900 mb-1">Payment Methods</h2>
          <p className="text-xs text-gray-400 mb-6">Order distribution</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={PAYMENT_DATA}
                cx="50%" cy="50%"
                innerRadius={45} outerRadius={70}
                paddingAngle={3}
                dataKey="value"
              >
                {PAYMENT_DATA.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `${v}%`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {PAYMENT_DATA.map((p) => (
              <div key={p.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                  <span className="font-semibold text-gray-600">{p.name}</span>
                </div>
                <span className="font-black text-gray-900">{p.value}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Orders Chart + Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Orders Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
        >
          <h2 className="font-black text-gray-900 mb-1">Daily Orders</h2>
          <p className="text-xs text-gray-400 mb-6">Orders this week</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={WEEKLY_DATA} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fontWeight: 600, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => `${v} orders`} />
              <Bar dataKey="orders" name="Orders" fill="#E85D04" radius={[6, 6, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Recent Orders Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-black text-gray-900">Recent Orders</h2>
              <p className="text-xs text-gray-400 mt-0.5">Latest customer orders</p>
            </div>
            <Link href="/admin/orders"
              className="text-xs font-bold text-orange-600 flex items-center gap-1 hover:text-orange-700 transition-colors">
              View All <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-wider">Order #</th>
                  <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-wider">Customer</th>
                  <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-wider">Payment</th>
                  <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(stats.recentOrders ?? []).map((order, i) => (
                  <motion.tr
                    key={order.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + i * 0.04 }}
                    className="hover:bg-orange-50/30 transition-colors"
                  >
                    <td className="px-5 py-4 font-mono text-xs font-black text-orange-600">{order.orderNumber}</td>
                    <td className="px-5 py-4 font-semibold text-sm text-gray-900">{order.customerName}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-bold capitalize ${getStatusStyle(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-black text-gray-500 uppercase">{order.paymentMethod}</span>
                    </td>
                    <td className="px-5 py-4 font-black text-orange-600">{formatPrice(order.total)}</td>
                  </motion.tr>
                ))}
                {(stats.recentOrders ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center">
                      <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-400 text-sm font-medium">No orders yet. Share your store to get started!</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {topProducts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-8"
        >
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-black text-gray-900">Top Selling Products</h2>
              <p className="text-xs text-gray-400 mt-0.5">Best sellers by units sold</p>
            </div>
            <Link href="/admin/products"
              className="text-xs font-bold text-orange-600 flex items-center gap-1 hover:text-orange-700 transition-colors">
              View All <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {topProducts.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.05 }}
                className="flex items-center gap-4 px-6 py-4 hover:bg-orange-50/30 transition-colors"
              >
                <div className="w-6 text-center shrink-0">
                  <span className="text-xs font-black text-gray-300">#{i + 1}</span>
                </div>
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-5 h-5 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-900 truncate">{product.name}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-100">
                    {product.totalSold} sold
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </AdminLayout>
  );
}
