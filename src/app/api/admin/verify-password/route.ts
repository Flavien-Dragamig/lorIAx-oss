import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";

export async function POST(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || !hasGlobalRole(sessionUser.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { password } = await req.json();
  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Mot de passe requis" }, { status: 400 });
  }

  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1);

  if (!user?.passwordHash) {
    // Compte LDAP ou sans mot de passe local — accès refusé
    return NextResponse.json({ error: "Aucun mot de passe local configuré" }, { status: 400 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
