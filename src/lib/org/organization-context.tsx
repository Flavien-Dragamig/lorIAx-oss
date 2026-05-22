"use client";

import { createContext, useContext, ReactNode } from "react";

export type OrgRole = "owner" | "admin" | "member";

export interface OrgContextValue {
  org: {
    id: string;
    slug: string;
    name: string;
    plan: string;
    maxUsers: number;
    maxSpaces: number;
    memberCount: number;
  } | null;
  role: OrgRole | null;
  isSuperAdmin: boolean;
}

const OrganizationContext = createContext<OrgContextValue>({
  org: null,
  role: null,
  isSuperAdmin: false,
});

export function OrganizationProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: OrgContextValue;
}) {
  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization(): OrgContextValue {
  return useContext(OrganizationContext);
}
