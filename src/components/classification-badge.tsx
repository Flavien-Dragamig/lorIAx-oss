"use client";

import { Globe, Building2, Shield, ShieldAlert, type LucideIcon } from "lucide-react";

type ClassificationLevel = "public" | "internal" | "confidential" | "secret";

const classificationConfig: Record<
  ClassificationLevel,
  { label: string; icon: LucideIcon; colors: string }
> = {
  public: {
    label: "Public",
    icon: Globe,
    colors: "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30",
  },
  internal: {
    label: "Interne",
    icon: Building2,
    colors: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30",
  },
  confidential: {
    label: "Confidentiel",
    icon: Shield,
    colors: "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30",
  },
  secret: {
    label: "Secret",
    icon: ShieldAlert,
    colors: "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30",
  },
};

export function ClassificationBadge({
  classification,
  size = "sm",
}: {
  classification: ClassificationLevel;
  size?: "sm" | "md";
}) {
  const config = classificationConfig[classification];
  const Icon = config.icon;

  const sizeClasses = size === "sm"
    ? "text-xs px-1.5 py-0.5"
    : "text-sm px-2 py-1";

  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md font-medium ${config.colors} ${sizeClasses}`}
    >
      <Icon className={`${iconSize} shrink-0`} />
      <span>{config.label}</span>
    </div>
  );
}
