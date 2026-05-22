import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { testLdapConnection } from "@/lib/auth/ldap";

export async function POST() {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const result = await testLdapConnection();

  if (result.success) {
    return NextResponse.json({ message: "Connexion LDAP réussie" });
  }

  return NextResponse.json(
    { error: `Échec de la connexion LDAP : ${result.error}` },
    { status: 500 }
  );
}
