"use client";

import { type ReactNode } from "react";
import { MeetingStatusBadge } from "@/components/meet/meeting-status-badge";

interface MeetingStatusSectionProps {
  icon: ReactNode;
  iconBgClass: string;
  status: string;
  actions: ReactNode;
}

export function MeetingStatusSection({
  icon,
  iconBgClass,
  status,
  actions,
}: MeetingStatusSectionProps) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBgClass}`}>
            {icon}
          </div>
          <MeetingStatusBadge status={status || "scheduled"} />
        </div>
        <div className="flex items-center gap-2">
          {actions}
        </div>
      </div>
    </div>
  );
}
