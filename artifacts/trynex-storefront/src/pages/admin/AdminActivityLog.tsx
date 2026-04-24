import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { getAuthHeaders, getApiBaseUrl } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  History,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Plus,
  Pencil,
  RefreshCw,
} from "lucide-react";

interface ActivityLog {
  id: number;
  adminId: number | null;
  adminName: string | null;
  action: string;
  entity: string;
  entityId: number | null;
  entityName: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
}

interface LogsResponse {
  logs: ActivityLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ENTITY_OPTIONS = [
  { value: "", label: "All Entities" },
  { value: "product", label: "Products" },
  { value: "blog", label: "Blog Posts" },
  { value: "category", label: "Categories" },
  { value: "order", label: "Orders" },
  { value: "hamper", label: "Gift Hampers" },
  { value: "promo", label: "Promo Codes" },
  { value: "review", label: "Reviews" },
  { value: "customer", label: "Customers" },
  { value: "setting", label: "Settings" },
];

const ACTION_OPTIONS = [
  { value: "", label: "All Actions" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "rollback", label: "Rollback" },
];

function ActionBadge({ action }: { action: string }) {
  if (action === "create")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
        <Plus className="w-3 h-3" /> Create
      </span>
    );
  if (action === "update")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        <Pencil className="w-3 h-3" /> Update
      </span>
    );
  if (action === "delete")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <Trash2 className="w-3 h-3" /> Delete
      </span>
    );
  if (action === "rollback")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        <RotateCcw className="w-3 h-3" /> Rollback
      </span>
    );
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      {action}
    </span>
  );
}

function EntityBadge({ entity }: { entity: string }) {
  const colors: Record<string, string> = {
    product: "bg-purple-100 text-purple-700",
    blog: "bg-yellow-100 text-yellow-700",
    category: "bg-indigo-100 text-indigo-700",
    order: "bg-orange-100 text-orange-700",
    hamper: "bg-pink-100 text-pink-700",
    promo: "bg-teal-100 text-teal-700",
    review: "bg-sky-100 text-sky-700",
    customer: "bg-violet-100 text-violet-700",
    setting: "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colors[entity] ?? "bg-gray-100 text-gray-600"}`}
    >
      {entity}
    </span>
  );
}

function DiffViewer({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  const allKeys = Array.from(
    new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  ).sort();
  const changed = allKeys.filter(
    (k) => JSON.stringify((before ?? {})[k]) !== JSON.stringify((after ?? {})[k])
  );
  if (changed.length === 0) return <p className="text-xs text-gray-400 italic">No differences recorded.</p>;
  return (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {changed.map((key) => (
        <div key={key} className="text-xs font-mono">
          <span className="font-semibold text-gray-600">{key}: </span>
          {before !== null && (before as Record<string, unknown>)[key] !== undefined && (
            <span className="text-red-600 line-through mr-1">
              {JSON.stringify((before as Record<string, unknown>)[key])}
            </span>
          )}
          {after !== null && (after as Record<string, unknown>)[key] !== undefined && (
            <span className="text-emerald-600">
              {JSON.stringify((after as Record<string, unknown>)[key])}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AdminActivityLog() {
  const { toast } = useToast();

  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rollbackId, setRollbackId] = useState<number | null>(null);
  const [rollingBack, setRollingBack] = useState<number | null>(null);

  const LIMIT = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      });
      if (search) params.set("search", search);
      if (filterAction) params.set("action", filterAction);
      if (filterEntity) params.set("entity", filterEntity);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(
        `${getApiBaseUrl()}/api/admin/activity-logs?${params.toString()}`,
        { headers: getAuthHeaders() }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: LogsResponse = await res.json();
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [page, search, filterAction, filterEntity, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const canRollback = (log: ActivityLog) =>
    (log.action === "update" || log.action === "delete") && log.before !== null;

  const handleRollback = async (log: ActivityLog) => {
    if (!canRollback(log)) return;
    setRollingBack(log.id);
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/api/admin/activity-logs/${log.id}/rollback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Rollback failed");
      toast({
        title: "Rollback successful",
        description: `${log.entity} "${log.entityName}" has been restored.`,
      });
      setRollbackId(null);
      fetchLogs();
    } catch (e: unknown) {
      toast({
        title: "Rollback failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRollingBack(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("en-BD", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <History className="w-6 h-6 text-orange-500" />
              Activity Log
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Full audit trail of all admin changes with one-click rollback.
            </p>
          </div>
          <button
            onClick={fetchLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <select
              value={filterEntity}
              onChange={(e) => { setFilterEntity(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
            >
              {ENTITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              value={filterAction}
              onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
            >
              {ACTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <span className="text-gray-400 text-xs">–</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              Search
            </button>
          </form>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
          ) : !data || data.logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <History className="w-10 h-10 mb-2" />
              <p className="text-sm">No activity recorded yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.logs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <ActionBadge action={log.action} />
                        <EntityBadge entity={log.entity} />
                        <span className="text-sm font-medium text-gray-800 truncate">
                          {log.entityName ?? `#${log.entityId}`}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        {formatDate(log.createdAt)}
                        {log.adminName && (
                          <span className="ml-2 text-gray-500">— {log.adminName}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(log.before !== null || log.after !== null) && (
                        <button
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          {expandedId === log.id ? "Hide diff" : "View diff"}
                        </button>
                      )}
                      {canRollback(log) && (
                        <button
                          onClick={() => setRollbackId(log.id)}
                          disabled={rollingBack !== null}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-orange-50 text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors disabled:opacity-50"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Rollback
                        </button>
                      )}
                    </div>
                  </div>

                  {expandedId === log.id && (
                    <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Changes</p>
                      <DiffViewer before={log.before} after={log.after} />
                    </div>
                  )}

                  {rollbackId === log.id && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start justify-between gap-4">
                      <p className="text-sm text-amber-800">
                        Restore <strong>{log.entityName ?? `#${log.entityId}`}</strong> to its previous state?
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setRollbackId(null)}
                          className="px-3 py-1 text-xs border border-gray-200 bg-white rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleRollback(log)}
                          disabled={rollingBack === log.id}
                          className="flex items-center gap-1 px-3 py-1 text-xs bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                        >
                          {rollingBack === log.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3" />
                          )}
                          Confirm
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <p className="text-gray-500">
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, data.total)} of {data.total} entries
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-gray-700">
                Page {page} of {data.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
