"use client";

import { useSession as useNextAuthSession } from "next-auth/react";
import type { SessionUser } from "@/types";

export function useCurrentUser(): SessionUser | null {
  const { data: session } = useNextAuthSession();
  if (!session?.user) return null;
  return session.user as SessionUser;
}
