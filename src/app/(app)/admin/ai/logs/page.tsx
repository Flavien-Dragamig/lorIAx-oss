"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  FileText,
  Clock,
  User,
  Cpu,
  Zap,
  AlertCircle,
} from "lucide-react";

// --- Types ---

interface LogEntry {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  teamId: string | null;
  providerId: string | null;
  providerName: string | null;
  providerColor: string | null;
  model: string | null;
  usageType: string;
  tokensIn: number | null;
  tokensOut: number | null;
  latencyMs: number | null;
  status: string;
  errorMessage: string | null;
  costEstimate: string | null;
  createdAt: string;
}

interface LogDetail extends LogEntry {
  fallbackProviderId: string | null;
  promptVersionId: string | null;
  requestBody: string | null;
  responseBody: string | null;
}

interface LogsResponse {
  logs: LogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Provider {
  id: string;
  displayName: string;
  color: string | null;
}

// --- Constants ---

const USAGE_TYPES = [
  { value: "chat", label: "Chat" },
  { value: "summary_doc", label: "Résumé doc" },
  { value: "summary_meeting", label: "Résumé réunion" },
  { value: "embeddings", label: "Embeddings" },
  { value: "playground", label: "Playground" },
];

const STATUS_OPTIONS = [
  { value: "success", label: "Succès", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  { value: "error", label: "Erreur", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  { value: "fallback", label: "Fallback", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  { value: "quota_exceeded", label: "Quota dépassé", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  { value: "timeout", label: "Timeout", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
];

const STATUS_BADGE_CLASSES: Record<string, string> = {
  success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  fallback: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  quota_exceeded: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  timeout: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

const STATUS_LABELS: Record<string, string> = {
  success: "Succès",
  error: "Erreur",
  fallback: "Fallback",
  quota_exceeded: "Quota dépassé",
  timeout: "Timeout",
};

const USAGE_LABELS: Record<string, string> = {
  chat: "Chat",
  summary_doc: "Résumé doc",
  summary_meeting: "Résumé réunion",
  embeddings: "Embeddings",
  playground: "Playground",
};

const COLUMNS = [
  { key: "createdAt", label: "Date/heure", sortable: true },
  { key: "user", label: "Utilisateur", sortable: false },
  { key: "usageType", label: "Usage", sortable: true },
  { key: "provider", label: "Provider", sortable: false },
  { key: "model", label: "Modèle", sortable: true },
  { key: "tokensIn", label: "Tokens in", sortable: true },
  { key: "tokensOut", label: "Tokens out", sortable: true },
  { key: "latencyMs", label: "Latence", sortable: true },
  { key: "costEstimate", label: "Coût est.", sortable: true },
  { key: "status", label: "Statut", sortable: true },
];

// --- Helpers ---

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// --- Component ---

export default function AdminAILogsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filters from URL
  const [from, setFrom] = useState(searchParams.get("from") || "");
  const [to, setTo] = useState(searchParams.get("to") || "");
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(searchParams.get("userId") || "");
  const [selectedUserName, setSelectedUserName] = useState("");
  const [usageTypes, setUsageTypes] = useState<string[]>(
    searchParams.get("usageType")?.split(",").filter(Boolean) || []
  );
  const [statuses, setStatuses] = useState<string[]>(
    searchParams.get("status")?.split(",").filter(Boolean) || []
  );
  const [providerIds, setProviderIds] = useState<string[]>(
    searchParams.get("providerId")?.split(",").filter(Boolean) || []
  );
  const [sort, setSort] = useState(searchParams.get("sort") || "createdAt");
  const [order, setOrder] = useState<"asc" | "desc">(
    (searchParams.get("order") as "asc" | "desc") || "desc"
  );
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1", 10));

  // Data
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [userSuggestions, setUserSuggestions] = useState<{ id: string; name: string; email: string }[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Detail drawer
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [logDetail, setLogDetail] = useState<LogDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const userSearchRef = useRef<HTMLInputElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Load providers
  useEffect(() => {
    fetch("/api/admin/ai/providers")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        // The providers API may return { providers: [...] } or [...]
        const list = Array.isArray(data) ? data : (data.providers || []);
        setProviders(list);
      })
      .catch(() => {});
  }, []);

  // Build query string from filters
  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (selectedUserId) params.set("userId", selectedUserId);
    if (usageTypes.length > 0) params.set("usageType", usageTypes.join(","));
    if (statuses.length > 0) params.set("status", statuses.join(","));
    if (providerIds.length > 0) params.set("providerId", providerIds.join(","));
    if (sort !== "createdAt") params.set("sort", sort);
    if (order !== "desc") params.set("order", order);
    if (page > 1) params.set("page", String(page));
    return params.toString();
  }, [from, to, selectedUserId, usageTypes, statuses, providerIds, sort, order, page]);

  // Sync URL
  useEffect(() => {
    const query = buildQuery();
    const newUrl = query ? `/admin/ai/logs?${query}` : "/admin/ai/logs";
    router.replace(newUrl, { scroll: false });
  }, [buildQuery, router]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "50");
      params.set("sort", sort);
      params.set("order", order);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (selectedUserId) params.set("userId", selectedUserId);
      if (usageTypes.length > 0) params.set("usageType", usageTypes.join(","));
      if (statuses.length > 0) params.set("status", statuses.join(","));
      if (providerIds.length > 0) params.set("providerId", providerIds.join(","));

      const res = await fetch(`/api/admin/ai/logs?${params.toString()}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [page, sort, order, from, to, selectedUserId, usageTypes, statuses, providerIds]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Load all users once for autocomplete
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.users || []);
        setAllUsers(list);
      })
      .catch(() => {});
  }, []);

  // User search autocomplete (client-side filter)
  useEffect(() => {
    if (!userSearch || userSearch.length < 2) {
      setUserSuggestions([]);
      setShowUserDropdown(false);
      return;
    }
    const q = userSearch.toLowerCase();
    const filtered = allUsers
      .filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .slice(0, 8);
    setUserSuggestions(filtered);
    setShowUserDropdown(filtered.length > 0);
  }, [userSearch, allUsers]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(e.target as Node) &&
        userSearchRef.current &&
        !userSearchRef.current.contains(e.target as Node)
      ) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch detail
  useEffect(() => {
    if (!selectedLogId) {
      setLogDetail(null);
      return;
    }
    setDetailLoading(true);
    fetch(`/api/admin/ai/logs/${selectedLogId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setLogDetail(d))
      .catch(() => setLogDetail(null))
      .finally(() => setDetailLoading(false));
  }, [selectedLogId]);

  // Toggle helpers
  function toggleChip(value: string, list: string[], setter: (v: string[]) => void) {
    setter(
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
    );
    setPage(1);
  }

  function handleSort(key: string) {
    if (sort === key) {
      setOrder(order === "desc" ? "asc" : "desc");
    } else {
      setSort(key);
      setOrder("desc");
    }
    setPage(1);
  }

  function resetFilters() {
    setFrom("");
    setTo("");
    setSelectedUserId("");
    setSelectedUserName("");
    setUserSearch("");
    setUsageTypes([]);
    setStatuses([]);
    setProviderIds([]);
    setSort("createdAt");
    setOrder("desc");
    setPage(1);
  }

  function handleExport() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (selectedUserId) params.set("userId", selectedUserId);
    if (usageTypes.length > 0) params.set("usageType", usageTypes.join(","));
    if (statuses.length > 0) params.set("status", statuses.join(","));
    if (providerIds.length > 0) params.set("providerId", providerIds.join(","));
    window.open(`/api/admin/ai/logs/export?${params.toString()}`, "_blank");
  }

  function applyDateShortcut(fromDate: string, toDate: string) {
    setFrom(fromDate);
    setTo(toDate);
    setPage(1);
  }

  const hasFilters =
    from || to || selectedUserId || usageTypes.length > 0 || statuses.length > 0 || providerIds.length > 0;

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className={`flex-1 flex flex-col min-w-0 ${selectedLogId ? "mr-[420px]" : ""}`}>
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Historique des logs IA</h1>
            </div>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Download className="h-4 w-4" />
              Exporter CSV
            </button>
          </div>

          {/* Filter bar */}
          <div className="space-y-3">
            {/* Row 1: Dates + User search */}
            <div className="flex items-end gap-3 flex-wrap">
              {/* Period */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Période</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => { setFrom(e.target.value); setPage(1); }}
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  />
                  <span className="text-muted-foreground text-sm">-</span>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => { setTo(e.target.value); setPage(1); }}
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
              {/* Date shortcuts */}
              <div className="flex gap-1">
                {[
                  { label: "Aujourd'hui", from: todayStr(), to: todayStr() },
                  { label: "7j", from: daysAgo(7), to: todayStr() },
                  { label: "30j", from: daysAgo(30), to: todayStr() },
                  { label: "Mois en cours", from: monthStart(), to: todayStr() },
                ].map((s) => (
                  <button
                    key={s.label}
                    onClick={() => applyDateShortcut(s.from, s.to)}
                    className={`px-2 py-1.5 text-xs rounded-md border transition-colors ${
                      from === s.from && to === s.to
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-input text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* User search */}
              <div className="flex flex-col gap-1 relative">
                <label className="text-xs text-muted-foreground font-medium">Utilisateur</label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  {selectedUserId ? (
                    <div className="flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm pl-7">
                      <span className="truncate max-w-[140px]">{selectedUserName || selectedUserId}</span>
                      <button
                        onClick={() => {
                          setSelectedUserId("");
                          setSelectedUserName("");
                          setUserSearch("");
                          setPage(1);
                        }}
                        className="ml-1 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <input
                      ref={userSearchRef}
                      type="text"
                      placeholder="Rechercher..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm pl-7 w-48"
                    />
                  )}
                  {showUserDropdown && userSuggestions.length > 0 && (
                    <div
                      ref={userDropdownRef}
                      className="absolute top-full left-0 mt-1 w-64 bg-popover border border-border rounded-md shadow-md z-50 max-h-48 overflow-y-auto"
                    >
                      {userSuggestions.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => {
                            setSelectedUserId(u.id);
                            setSelectedUserName(u.name);
                            setUserSearch("");
                            setShowUserDropdown(false);
                            setPage(1);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex flex-col"
                        >
                          <span className="font-medium">{u.name}</span>
                          <span className="text-xs text-muted-foreground">{u.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: Chips */}
            <div className="flex items-center gap-4 flex-wrap">
              {/* Usage type */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-medium mr-1">Usage :</span>
                {USAGE_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => toggleChip(t.value, usageTypes, setUsageTypes)}
                    className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                      usageTypes.includes(t.value)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-input text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Status */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-medium mr-1">Statut :</span>
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => toggleChip(s.value, statuses, setStatuses)}
                    className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                      statuses.includes(s.value)
                        ? s.color + " border-current"
                        : "border-input text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Providers */}
              {providers.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground font-medium mr-1">Provider :</span>
                  {providers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => toggleChip(p.id, providerIds, setProviderIds)}
                      className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                        providerIds.includes(p.id)
                          ? "text-white border-current"
                          : "border-input text-muted-foreground hover:bg-accent"
                      }`}
                      style={
                        providerIds.includes(p.id) && p.color
                          ? { backgroundColor: p.color, borderColor: p.color }
                          : undefined
                      }
                    >
                      {p.displayName}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Row 3: Reset + count */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {hasFilters && (
                  <button
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Réinitialiser
                  </button>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {data ? `${data.total} requête${data.total !== 1 ? "s" : ""} correspondent` : "Chargement..."}
              </span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap ${
                      col.sortable ? "cursor-pointer select-none hover:text-foreground" : ""
                    }`}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.sortable && (
                        sort === col.key ? (
                          order === "desc" ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUp className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        )
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-3 py-12 text-center text-muted-foreground">
                    Chargement...
                  </td>
                </tr>
              ) : data && data.logs.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-3 py-12 text-center text-muted-foreground">
                    Aucun log trouvé
                  </td>
                </tr>
              ) : (
                data?.logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLogId(log.id)}
                    className={`border-b border-border/50 cursor-pointer transition-colors hover:bg-muted/30 ${
                      selectedLogId === log.id ? "bg-muted/50" : ""
                    }`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-xs">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium truncate max-w-[120px]">
                          {log.userName ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">
                      {USAGE_LABELS[log.usageType] ?? log.usageType}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {log.providerName ? (
                        <span
                          className="inline-flex items-center gap-1 text-xs"
                        >
                          {log.providerColor && (
                            <span
                              className="inline-block w-2 h-2 rounded-full"
                              style={{ backgroundColor: log.providerColor }}
                            />
                          )}
                          {log.providerName}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                      {log.model ?? "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs tabular-nums">
                      {log.tokensIn ?? "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs tabular-nums">
                      {log.tokensOut ?? "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs tabular-nums">
                      {log.latencyMs != null ? `${log.latencyMs} ms` : "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs tabular-nums">
                      {log.costEstimate ? `${parseFloat(log.costEstimate).toFixed(4)} €` : "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                          STATUS_BADGE_CLASSES[log.status] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {STATUS_LABELS[log.status] ?? log.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="border-t border-border bg-card px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Page {data.page} / {data.totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {/* Page numbers */}
              {Array.from({ length: Math.min(7, data.totalPages) }, (_, i) => {
                let pageNum: number;
                if (data.totalPages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1;
                } else if (page >= data.totalPages - 3) {
                  pageNum = data.totalPages - 6 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`min-w-[28px] h-7 text-xs rounded-md ${
                      page === pageNum
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent text-muted-foreground"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                disabled={page >= data.totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selectedLogId && (
        <div className="fixed top-0 right-0 h-full w-[420px] bg-card border-l border-border shadow-lg z-40 flex flex-col">
          {/* Drawer header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm">Détail du log</h2>
            <button
              onClick={() => setSelectedLogId(null)}
              className="p-1 rounded-md hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Drawer body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {detailLoading ? (
              <div className="text-center text-muted-foreground py-8">Chargement...</div>
            ) : logDetail ? (
              <>
                {/* Metadata */}
                <div className="space-y-2">
                  <DetailRow icon={Clock} label="Date" value={formatDateTime(logDetail.createdAt)} />
                  <DetailRow icon={User} label="Utilisateur" value={logDetail.userName ?? "—"} />
                  {logDetail.userEmail && (
                    <DetailRow icon={User} label="Email" value={logDetail.userEmail} />
                  )}
                  <DetailRow icon={Cpu} label="Provider" value={logDetail.providerName ?? "—"} />
                  <DetailRow icon={Cpu} label="Modèle" value={logDetail.model ?? "—"} />
                  <DetailRow icon={Zap} label="Usage" value={USAGE_LABELS[logDetail.usageType] ?? logDetail.usageType} />
                  <DetailRow
                    icon={Zap}
                    label="Tokens"
                    value={`${logDetail.tokensIn ?? 0} in / ${logDetail.tokensOut ?? 0} out`}
                  />
                  <DetailRow icon={Clock} label="Latence" value={logDetail.latencyMs != null ? `${logDetail.latencyMs} ms` : "—"} />
                  <DetailRow
                    icon={AlertCircle}
                    label="Statut"
                    value={
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${STATUS_BADGE_CLASSES[logDetail.status] ?? ""}`}>
                        {STATUS_LABELS[logDetail.status] ?? logDetail.status}
                      </span>
                    }
                  />
                  {logDetail.costEstimate && (
                    <DetailRow icon={Zap} label="Coût estimé" value={`${parseFloat(logDetail.costEstimate).toFixed(6)} €`} />
                  )}
                  {logDetail.errorMessage && (
                    <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-xs text-red-800 dark:text-red-300">
                      <strong>Erreur :</strong> {logDetail.errorMessage}
                    </div>
                  )}
                  {logDetail.fallbackProviderId && (
                    <DetailRow icon={AlertCircle} label="Fallback provider" value={logDetail.fallbackProviderId} />
                  )}
                  {logDetail.promptVersionId && (
                    <DetailRow icon={FileText} label="Version du prompt" value={logDetail.promptVersionId} />
                  )}
                </div>

                {/* Request body */}
                {logDetail.requestBody && (
                  <div>
                    <h3 className="text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wide">
                      Requête envoyée
                    </h3>
                    <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto max-h-64 whitespace-pre-wrap break-words">
                      {tryFormatJson(logDetail.requestBody)}
                    </pre>
                  </div>
                )}

                {/* Response body */}
                {logDetail.responseBody && (
                  <div>
                    <h3 className="text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wide">
                      Réponse
                    </h3>
                    <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto max-h-64 whitespace-pre-wrap break-words">
                      {tryFormatJson(logDetail.responseBody)}
                    </pre>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-muted-foreground py-8">Log introuvable</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="text-xs text-muted-foreground shrink-0">{label} :</span>
        <span className="text-xs font-medium truncate">{value}</span>
      </div>
    </div>
  );
}

function tryFormatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
