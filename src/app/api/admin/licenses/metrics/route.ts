/**
 * GET /api/admin/licenses/metrics
 * Get current usage metrics against license limits
 */

import { NextRequest, NextResponse } from "next/server";
import { getLicenseFromDB } from "@/lib/license/validate";
import { getAllUsageMetrics } from "@/lib/license/metering";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";

export async function GET(_req: NextRequest) {
  try {
    // Check admin permission
    const user = await getSessionUser();
    if (!user || !hasGlobalRole(user.globalRole, "admin")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const license = await getLicenseFromDB();
    const metrics = await getAllUsageMetrics(license);

    return NextResponse.json(metrics);
  } catch (err) {
    const error = err as Error;
    console.error("Metrics fetch failed:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch metrics",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
