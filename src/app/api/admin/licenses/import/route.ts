/**
 * POST /api/admin/licenses/import
 * Import and validate a license JWT
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { saveLicenseToDB } from "@/lib/license/validate";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || !hasGlobalRole(user.globalRole, "admin")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await req.json();
    const { jwt } = body;

    if (!jwt || typeof jwt !== "string") {
      return NextResponse.json({ error: "Missing or invalid JWT" }, { status: 400 });
    }

    const license = await saveLicenseToDB(jwt);
    revalidateTag("license", "default");

    return NextResponse.json({
      payload: license.payload,
      raw: license.raw,
      expired: license.expired,
      gracePeriod: license.gracePeriod,
      valid: license.valid,
    });
  } catch (err) {
    const error = err as Error;
    console.error("License import failed:", error);
    return NextResponse.json(
      { error: "License import failed", message: error.message },
      { status: 400 }
    );
  }
}
