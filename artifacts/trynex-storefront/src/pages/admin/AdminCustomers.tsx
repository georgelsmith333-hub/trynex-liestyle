import { AdminLayout } from "@/components/layout/AdminLayout";
import { Loader } from "@/components/ui/Loader";
import { getAuthHeaders, formatPrice } from "@/lib/utils";
import { useState } from "react";
import {
  Users, Search, MapPin, Phone, Mail, ShoppingBag,
  TrendingUp, Calendar, ChevronDown, ChevronUp, Globe,
  BarChart3, AlertCircle, Download
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  useListAdminCustomers,
  useListAdminGuestCustomers,
  useConvertGuestCustomer,
  useDeleteGuestCustomer,
  type AdminCustomer,
} from "@workspace/api-client-react";
import { UserCircle, UserCheck, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DISTRICT_COLORS = [
  "#E85D04", "#FB8500", "#f97316", "#ea580c", "#d97706",
  "#b45309", "#92400e", "#78350f", "#c2410c", "#9a3412"
];

const PAYMENT_LABELS: Record<string, string> = {
  cod: "Cash on Delivery", bkash: "bKash", nagad: "Nagad", rocket: "Rocket"
};

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" });
}

interface TooltipPayloadEntry {
  value: number;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-lg text-sm">
        <p className="font-bold text-gray-900">{label}</p>
        <p className="font-semibold text-orange-600">{payload[0].value} customers</p>
      </div>
    );
  }
  return null;
};

export default function AdminCustomers() {
  const { data, isLoading, error } = useListAdminCustomers({
    request: { headers: getAuthHeaders() },
  });
  const { data: guestData, isLoading: guestsLoading } = useListAdminGuestCustomers();
  const [search, setSearch] = useState("");
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"recent" | "spent" | "orders">("recent");
  const [tab, setTab] = useState<"buyers" | "guests">("buyers");
  const convertGuest = useConvertGuestCustomer();
  const deleteGuest = useDeleteGuestCustomer();
  const { toast } = useToast();

  if (isLoading) return <AdminLayout><Loader fullScreen /></AdminLayout>;

  if (error || !data) return (
    <AdminLayout>
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Failed to Load Customers</h2>
        <p className="text-gray-400">{error instanceof Error ? error.message : "Unknown error"}</p>
      </div>
    </AdminLayout>
  );

  const filtered = data.customers.filter(c => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) ||
      c.phone.includes(q) || (c.district || "").toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "spent") return b.totalSpent - a.totalSpent;
    if (sortBy === "orders") return b.totalOrders - a.totalOrders;
    return new Date(b.lastOrder || 0).getTime() - new Date(a.lastOrder || 0).getTime();
  });

  const totalRevenue = data.customers.reduce((sum, c) => sum + c.totalSpent, 0);
  const avgOrderValue = data.totalOrders > 0 ? totalRevenue / data.totalOrders : 0;
  const repeatCustomers = data.customers.filter(c => c.totalOrders > 1).length;

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black font-display tracking-tight text-gray-900">Customers</h1>
            <p className="text-sm text-gray-400 mt-1">All purchaser information and analytics</p>
          </div>
          <button
            onClick={() => {
              if (!data || data.customers.length === 0) return;
              const escCsv = (val: string) => {
                let safe = val;
                if (/^[=+\-@\t\r]/.test(safe)) {
                  safe = "'" + safe;
                }
                if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
                  return '"' + safe.replace(/"/g, '""') + '"';
                }
                return safe;
              };
              const headers = ["Name", "Email", "Phone", "District", "City", "Address", "Total Orders", "Total Spent", "First Order", "Last Order", "Payment Methods"];
              const rows = data.customers.map(c => [
                escCsv(c.name), escCsv(c.email), escCsv(c.phone),
                escCsv(c.district || ""), escCsv(c.city || ""), escCsv(c.address || ""),
                String(c.totalOrders), String(c.totalSpent),
                c.firstOrder ? new Date(c.firstOrder).toLocaleDateString() : "",
                c.lastOrder ? new Date(c.lastOrder).toLocaleDateString() : "",
                escCsv((c.paymentMethods || []).join(", ")),
              ]);
              const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `trynex-customers-${new Date().toISOString().split("T")[0]}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", boxShadow: "0 4px 12px rgba(22,163,74,0.3)" }}
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Customers", value: data.totalCustomers, icon: Users, color: "#E85D04" },
            { label: "Total Orders", value: data.totalOrders, icon: ShoppingBag, color: "#16a34a" },
            { label: "Repeat Customers", value: repeatCustomers, icon: TrendingUp, color: "#7c3aed" },
            { label: "Avg. Order Value", value: formatPrice(avgOrderValue), icon: BarChart3, color: "#0ea5e9" },
          ].map(stat => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${stat.color}12` }}>
                  <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                </div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{stat.label}</span>
              </div>
              <p className="text-2xl font-black text-gray-900">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {data.topDistricts.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-bold text-gray-900">Top Districts</h2>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topDistricts} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <XAxis dataKey="district" tick={{ fontSize: 11, fontWeight: 600 }} angle={-25} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {data.topDistricts.map((_, i) => (
                      <Cell key={i} fill={DISTRICT_COLORS[i % DISTRICT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="flex gap-2 border-b border-gray-200">
          {([
            { id: "buyers", label: `Buyers (${data.totalCustomers})`, icon: Users },
            { id: "guests", label: `Guest Accounts${guestData ? ` (${guestData.totalGuests})` : ""}`, icon: UserCircle },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
                tab === t.id ? "border-orange-500 text-orange-600" : "border-transparent text-gray-400 hover:text-gray-700"
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "guests" ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Guest Checkout Accounts</h2>
              <p className="text-xs text-gray-400 mt-1">
                Auto-created when buyers click "Continue as Guest" — synthetic email
                <code className="mx-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">guestaccountNNNN@trynex.guest</code>
                lets them track orders without registering.
              </p>
            </div>
            {guestsLoading ? (
              <div className="p-12 text-center"><Loader /></div>
            ) : !guestData || guestData.guests.length === 0 ? (
              <div className="p-12 text-center">
                <UserCircle className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 font-semibold">No guest accounts yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr className="text-left">
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">#</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Name</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Email</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Username</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Phone</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Orders</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Spent</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Last Order</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Last Order Date</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Created</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {guestData.guests.map(g => (
                      <tr key={g.id} className="hover:bg-orange-50/30">
                        <td className="px-5 py-3 font-mono text-xs text-gray-500">#{String(g.guestSequence ?? "").padStart(4, "0")}</td>
                        <td className="px-5 py-3 font-bold text-gray-900">{g.name}</td>
                        <td className="px-5 py-3 text-xs text-gray-500">{g.email}</td>
                        <td className="px-5 py-3 font-mono text-xs text-orange-600 font-bold">{g.username}</td>
                        <td className="px-5 py-3 text-xs text-gray-700">{g.phone || "—"}</td>
                        <td className="px-5 py-3 font-bold text-gray-900">{g.totalOrders}</td>
                        <td className="px-5 py-3 font-bold text-orange-600">{formatPrice(g.totalSpent)}</td>
                        <td className="px-5 py-3 text-xs text-gray-700">
                          {g.lastOrderNumber ? (
                            <span>
                              <span className="font-bold">{g.lastOrderNumber}</span>
                              <span className="text-gray-400 ml-1">{g.lastOrderStatus}</span>
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-700">{g.lastOrderAt ? formatDate(g.lastOrderAt) : "—"}</td>
                        <td className="px-5 py-3 text-xs text-gray-400">{formatDate(g.createdAt || "")}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              title="Convert to full account"
                              onClick={async () => {
                                const email = window.prompt(`Convert guest "${g.name}" — enter the customer's real email:`);
                                if (!email) return;
                                const password = window.prompt("Set a temporary password (min 6 chars). They can change it later.");
                                if (!password) return;
                                try {
                                  await convertGuest.mutateAsync({ id: g.id, email: email.trim(), password, name: g.name });
                                  toast({ title: "Converted to full account", description: `${email} is now a registered customer.` });
                                } catch (e: unknown) {
                                  const msg = e instanceof Error ? e.message : "Try again";
                                  toast({ title: "Convert failed", description: msg, variant: "destructive" });
                                }
                              }}
                              className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              title="Delete guest account"
                              onClick={async () => {
                                if (!window.confirm(`Delete guest #${String(g.guestSequence ?? "").padStart(4, "0")}? This cannot be undone.`)) return;
                                try {
                                  await deleteGuest.mutateAsync({ id: g.id });
                                  toast({ title: "Guest deleted" });
                                } catch (e: unknown) {
                                  const msg = e instanceof Error ? e.message : "Try again";
                                  toast({ title: "Delete failed", description: msg, variant: "destructive" });
                                }
                              }}
                              className="p-1.5 rounded-md text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, phone, email, or district..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400">Sort by:</span>
              {(["recent", "spent", "orders"] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    sortBy === s
                      ? "text-white shadow-md"
                      : "text-gray-500 bg-gray-50 hover:bg-gray-100"
                  }`}
                  style={sortBy === s ? { background: "linear-gradient(135deg, #E85D04, #FB8500)" } : {}}
                >
                  {s === "recent" ? "Recent" : s === "spent" ? "Top Spenders" : "Most Orders"}
                </button>
              ))}
            </div>
          </div>

          {sorted.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-semibold">
                {search ? "No customers match your search" : "No customers yet — orders will appear here"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {sorted.map((customer, idx) => {
                const key = customer.phone || customer.email;
                const isExpanded = expandedCustomer === key;
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.02 }}
                  >
                    <button
                      onClick={() => setExpandedCustomer(isExpanded ? null : key)}
                      className="w-full text-left px-5 py-4 hover:bg-orange-50/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm shrink-0"
                          style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}>
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 truncate">{customer.name}</span>
                            {customer.totalOrders > 1 && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-600">
                                Repeat
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{customer.phone}</span>
                            {customer.district && (
                              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{customer.district}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right hidden sm:block">
                          <p className="text-sm font-bold text-gray-900">{formatPrice(customer.totalSpent)}</p>
                          <p className="text-xs text-gray-400">{customer.totalOrders} order{customer.totalOrders > 1 ? "s" : ""}</p>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-300" /> : <ChevronDown className="w-4 h-4 text-gray-300" />}
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 pt-1 ml-14 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              <div className="bg-gray-50 rounded-xl p-3.5">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Contact</p>
                                <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                                  <Mail className="w-3.5 h-3.5 text-gray-300" />{customer.email}
                                </p>
                                <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5 mt-1">
                                  <Phone className="w-3.5 h-3.5 text-gray-300" />{customer.phone}
                                </p>
                              </div>
                              <div className="bg-gray-50 rounded-xl p-3.5">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Shipping Address</p>
                                <p className="text-sm font-semibold text-gray-900">{customer.address || "—"}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{customer.city || ""}{customer.city && customer.district ? ", " : ""}{customer.district || ""}</p>
                              </div>
                              <div className="bg-gray-50 rounded-xl p-3.5">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Order History</p>
                                <p className="text-sm font-semibold text-gray-900">
                                  First: {formatDate(customer.firstOrder || "")}
                                </p>
                                <p className="text-sm font-semibold text-gray-900">
                                  Last: {formatDate(customer.lastOrder || "")}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">Payment methods:</span>
                              {(customer.paymentMethods || []).map(pm => (
                                <span key={pm} className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-50 text-orange-700">
                                  {PAYMENT_LABELS[pm] || pm}
                                </span>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
        )}

        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <Globe className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-blue-900 mb-1">About Visitor Analytics</h3>
              <p className="text-xs text-blue-700 leading-relaxed">
                To track website visitors, countries, and traffic sources, set up your <strong>Google Analytics (GA4)</strong> and <strong>Facebook Pixel</strong> IDs in <strong>Settings → Analytics & Tracking</strong>. Once configured, visit{" "}
                <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="underline font-bold">analytics.google.com</a>{" "}
                to see real-time visitors, countries, page views, and traffic sources. Facebook Pixel data is available in{" "}
                <a href="https://business.facebook.com/events_manager" target="_blank" rel="noopener noreferrer" className="underline font-bold">Meta Events Manager</a>.
                This customer list shows all purchasers who have placed orders through the store.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
