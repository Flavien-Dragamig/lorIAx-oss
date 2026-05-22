/**
 * POST /api/admin/licenses/revoke
 * Revoke the current license
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { revokeLicense } from "@/lib/license/validate";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";

export async function POST(_req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || !hasGlobalRole(user.globalRole, "admin")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    await revokeLicense();
    revalidateTag("license", "default");

    return NextResponse.json({ success: true });
  } catch (err) {
    const error = err as Error;
    console.error("License revoke failed:", error);
    return NextResponse.json(
      { error: "License revoke failed", message: error.message },
      { status: 500 }
    );
  }
}
