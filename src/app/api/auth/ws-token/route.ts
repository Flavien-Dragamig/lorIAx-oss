import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { SignJWT } from "jose";

/**
 * GET /api/auth/ws-token
 * Returns a short-lived JWT for WebSocket authentication.
 * The main session JWT is HTTP-only and cannot be read by client JS.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Configuration manquante" }, { status: 500 });
  }

  const key = new TextEncoder().encode(secret);
  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    globalRole: user.globalRole,
    avatarUrl: user.avatarUrl ?? null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(key);

  return NextResponse.json({ token });
}
