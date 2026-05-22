"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Coins,
  Clock,
  AlertTriangle,
  RefreshCw,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

// --- Types ---

interface DashboardData {
  kpi: {
    requestsToday: number;
    requestsYesterday: number;
    tokensIn: number;
    tokensOut: number;
    avgLatency: number;
    errorRate: number;
    costToday: number;
    costMonth: number;
  };
  timeSeries: { bucket: string; requests: number; tokensTotal: number }[];
  byUsage: { usageType: string; count: number }[];
  byProvider: { providerId: string; count: number; displayName: string; color: string }[];
}

type Period = "24h" | "7d" | "30d";

// --- Constants ---

const USAGE_TYPE_COLORS: Record<string, string> = {
  chat: "#6366f1",
  summary_doc: "#f59e0b",
  summary_meeting: "#10b981",
  embeddings: "#8b5cf6",
  playground: "#ec4899",
};

const USAGE_TYPE_LABELS: Record<string, string> = {
  chat: "Chat RAG",
  summary_doc: "Résumé doc",
  summary_meeting: "Résumé réunion",
  embeddings: "Embeddings",
  playground: "Playground",
};

const PERIOD_LABELS: Record<Period, string> = {
  "24h": "24 h",
  "7d": "7 jours",
  "30d": "30 jours",
};

// --- Helpers ---

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} k`;
  return n.toString();
}

function formatBucket(bucket: string, period: Period): string {
  const d = new Date(bucket);
  if (period === "24h") {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

// --- Component ---

export default function AdminAIDashboard() {
  const [period, setPeriod] = useState<Period>("24h");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ai/dashboard?period=${period}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // Silently fail — show empty state
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const kpi = data?.kpi ?? {
    requestsToday: 0,
    requestsYesterday: 0,
    tokensIn: 0,
    tokensOut: 0,
    avgLatency: 0,
    errorRate: 0,
    costToday: 0,
    costMonth: 0,
  };

  const timeSeries = (data?.timeSeries ?? []).map((ts) => ({
    ...ts,
    label: formatBucket(ts.bucket, period),
  }));

  const byUsage = (data?.byUsage ?? []).map((u) => ({
    ...u,
    name: USAGE_TYPE_LABELS[u.usageType] ?? u.usageType,
    color: USAGE_TYPE_COLORS[u.usageType] ?? "#94a3b8",
  }));

  const byProvider = data?.byProvider ?? [];

  // Trend indicator
  const trend =
    kpi.requestsYesterday === 0
      ? 0
      : Math.round(
          ((kpi.requestsToday - kpi.requestsYesterday) / kpi.requestsYesterday) * 100
        );

  const TrendIcon =
    trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor =
    trend > 0 ? "text-green-600" : trend < 0 ? "text-red-600" : "text-muted-foreground";

  // Latency color
  const latencyColor =
    kpi.avgLatency < 500
      ? "text-green-600"
      : kpi.avgLatency < 2000
        ? "text-amber-600"
        : "text-red-600";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tableau de bord IA</h1>
        <div className="flex items-center gap-2">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
          <button
            onClick={fetchData}
            disabled={loading}
            className="ml-2 p-2 rounded-md text-muted-foreground hover:bg-accent disabled:opacity-50"
            title="Actualiser"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Requests today */}
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Activity className="h-4 w-4" />
            Requêtes aujourd&apos;hui
          </div>
          <div className="text-2xl font-bold">{formatNumber(kpi.requestsToday)}</div>
          <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
            <TrendIcon className="h-3 w-3" />
            {trend > 0 ? "+" : ""}
            {trend} % vs hier
          </div>
        </div>

        {/* Tokens */}
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Zap className="h-4 w-4" />
            Tokens
          </div>
          <div className="text-2xl font-bold">{formatNumber(kpi.tokensIn + kpi.tokensOut)}</div>
          <div className="text-xs text-muted-foreground">
            {formatNumber(kpi.tokensIn)} in / {formatNumber(kpi.tokensOut)} out
          </div>
        </div>

        {/* Cost */}
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Coins className="h-4 w-4" />
            Coût estimé
          </div>
          <div className="text-2xl font-bold">{kpi.costToday.toFixed(4)} €</div>
          <div className="text-xs text-muted-foreground">
            Mois : {kpi.costMonth.toFixed(4)} €
          </div>
        </div>

        {/* Latency */}
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Clock className="h-4 w-4" />
            Latence moyenne
          </div>
          <div className={`text-2xl font-bold ${latencyColor}`}>
            {kpi.avgLatency} ms
          </div>
          <div className="text-xs text-muted-foreground">
            {kpi.avgLatency < 500
              ? "Excellente"
              : kpi.avgLatency < 2000
                ? "Correcte"
                : "Lente"}
          </div>
        </div>

        {/* Error rate */}
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <AlertTriangle className="h-4 w-4" />
            Taux d&apos;erreur
          </div>
          <div
            className={`text-2xl font-bold ${
              kpi.errorRate > 5 ? "text-red-600" : kpi.errorRate > 1 ? "text-amber-600" : "text-green-600"
            }`}
          >
            {kpi.errorRate} %
          </div>
          <div className="text-xs text-muted-foreground">
            {kpi.errorRate === 0 ? "Aucune erreur" : "Sur la journée"}
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Line chart — requests + tokens over time */}
        <div className="lg:col-span-2 rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium mb-4">Activité sur la période</h3>
          <div className="h-64">
            {timeSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: 8,
                    }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="requests"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                    name="Requêtes"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="tokensTotal"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                    name="Tokens"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Aucune donnée pour cette période
              </div>
            )}
          </div>
        </div>

        {/* Pie chart — by usage type */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium mb-4">Répartition par type</h3>
          <div className="h-64">
            {byUsage.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byUsage}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={false}
                    labelLine={false}
                  >
                    {byUsage.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Aucune donnée
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Provider bar chart */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-medium mb-4">Requêtes par fournisseur</h3>
        <div className="h-48">
          {byProvider.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byProvider} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="displayName"
                  width={120}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="count" name="Requêtes" radius={[0, 4, 4, 0]}>
                  {byProvider.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Aucune donnée
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
