"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ─── Types (partagés avec chart-block.tsx) ───────────────────────────────────

type ChartType = "bar" | "line" | "pie" | "area";

interface ChartDataRow {
  [key: string]: string | number;
}

interface ChartConfig {
  chartType: ChartType;
  title: string;
  data: ChartDataRow[];
  columns: string[];
  labelKey: string;
  colors: string[];
}

const DEFAULT_COLORS = [
  "var(--loriax-chart-1, #6366f1)",
  "var(--loriax-chart-2, #f59e0b)",
  "var(--loriax-chart-3, #10b981)",
  "var(--loriax-chart-4, #ef4444)",
  "var(--loriax-chart-5, #8b5cf6)",
  "var(--loriax-chart-6, #06b6d4)",
  "var(--loriax-chart-7, #f97316)",
  "var(--loriax-chart-8, #ec4899)",
];

function resolveColor(cssVar: string): string {
  if (!cssVar.startsWith("var(")) return cssVar;
  const fallback = cssVar.match(/,\s*([^)]+)\)/)?.[1]?.trim();
  if (typeof window === "undefined") return fallback || "#6366f1";
  const varName = cssVar.match(/var\(([^,)]+)/)?.[1]?.trim();
  if (!varName) return fallback || "#6366f1";
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return resolved || fallback || "#6366f1";
}

// ─── Chart Renderer ──────────────────────────────────────────────────────────

export default function ChartRenderer({
  config,
  chartRef,
}: {
  config: ChartConfig;
  chartRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { chartType, data, columns, labelKey, colors } = config;
  const safeColumns = Array.isArray(columns) ? columns : [];
  const safeColors = Array.isArray(colors) ? colors : DEFAULT_COLORS;
  const valueKeys = safeColumns.filter((c) => c !== labelKey);
  const resolvedColors = safeColors.length > 0 ? safeColors.map(resolveColor) : DEFAULT_COLORS.map(resolveColor);

  if (data.length === 0) return null;

  const commonProps = { data, margin: { top: 5, right: 20, bottom: 20, left: 0 } };

  return (
    <div ref={chartRef} className="chart-block-render">
      <ResponsiveContainer width="100%" height={320}>
        {chartType === "bar" ? (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {valueKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={resolvedColors[i % resolvedColors.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        ) : chartType === "line" ? (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {valueKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={resolvedColors[i % resolvedColors.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        ) : chartType === "area" ? (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {valueKeys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={resolvedColors[i % resolvedColors.length]}
                fill={resolvedColors[i % resolvedColors.length]}
                fillOpacity={0.2}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        ) : (
          <PieChart>
            <Tooltip />
            <Legend />
            <Pie
              data={data}
              dataKey={valueKeys[0] || "valeur"}
              nameKey={labelKey}
              cx="50%"
              cy="50%"
              outerRadius={120}
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={true}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={resolvedColors[i % resolvedColors.length]} />
              ))}
            </Pie>
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
