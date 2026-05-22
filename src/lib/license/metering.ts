/**
 * Usage metering for license limits
 * Counts current usage and checks against license quotas
 */

import { db } from "@/lib/db";
import { users, spaces } from "@/lib/db/schema";
import { count } from "drizzle-orm";
import { License } from "./types";
import { getLimit } from "./gate";

export interface UsageStatus {
  current: number;
  max: number;
  exceeded: boolean;
  percentage: number;
}

/**
 * Checks current user count against license limit
 */
export async function checkUsersLimit(license: License | null): Promise<UsageStatus> {
  const max = getLimit(license, "users");

  const result = await db
    .select({ count: count() })
    .from(users)
    .limit(1);

  const current = result[0]?.count ?? 0;
  const exceeded = current >= max;

  return {
    current,
    max,
    exceeded,
    percentage: max === Infinity ? 0 : Math.round((current / max) * 100),
  };
}

/**
 * Checks current space count against license limit
 */
export async function checkSpacesLimit(license: License | null): Promise<UsageStatus> {
  const max = getLimit(license, "spaces");

  const result = await db
    .select({ count: count() })
    .from(spaces)
    .limit(1);

  const current = result[0]?.count ?? 0;
  const exceeded = current >= max;

  return {
    current,
    max,
    exceeded,
    percentage: max === Infinity ? 0 : Math.round((current / max) * 100),
  };
}

/**
 * Gets all usage metrics at once
 */
export async function getAllUsageMetrics(license: License | null) {
  const [usersStatus, spacesStatus] = await Promise.all([
    checkUsersLimit(license),
    checkSpacesLimit(license),
  ]);

  return {
    users: usersStatus,
    spaces: spacesStatus,
  };
}
