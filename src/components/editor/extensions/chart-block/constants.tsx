"use client";

import {
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  AreaChart as AreaChartIcon,
  Pencil,
  FileSpreadsheet,
  Globe,
} from "lucide-react";
import type { ChartType, ChartDataRow, DataSourceConfig } from "./types";

export const DEFAULT_COLORS = [
  "var(--loriax-chart-1, #6366f1)",
  "var(--loriax-chart-2, #f59e0b)",
  "var(--loriax-chart-3, #10b981)",
  "var(--loriax-chart-4, #ef4444)",
  "var(--loriax-chart-5, #8b5cf6)",
  "var(--loriax-chart-6, #06b6d4)",
  "var(--loriax-chart-7, #f97316)",
  "var(--loriax-chart-8, #ec4899)",
];

export const CHART_TYPE_OPTIONS: { value: ChartType; label: string; icon: React.ReactNode }[] = [
  { value: "bar", label: "Barres", icon: <BarChart3 className="h-4 w-4" /> },
  { value: "line", label: "Courbe", icon: <LineChartIcon className="h-4 w-4" /> },
  { value: "area", label: "Aire", icon: <AreaChartIcon className="h-4 w-4" /> },
  { value: "pie", label: "Camembert", icon: <PieChartIcon className="h-4 w-4" /> },
];

export const DEFAULT_DATA: ChartDataRow[] = [
  { label: "Jan", valeur: 40 },
  { label: "Fév", valeur: 55 },
  { label: "Mar", valeur: 35 },
  { label: "Avr", valeur: 70 },
  { label: "Mai", valeur: 60 },
];

export const DATA_SOURCE_OPTIONS: { value: DataSourceConfig["type"]; label: string; icon: React.ReactNode }[] = [
  { value: "manual", label: "Manuel", icon: <Pencil className="h-3.5 w-3.5" /> },
  { value: "rest-api", label: "API REST", icon: <Globe className="h-3.5 w-3.5" /> },
  { value: "google-sheets", label: "Google Sheets", icon: <FileSpreadsheet className="h-3.5 w-3.5" /> },
];
