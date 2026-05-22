import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ilike, or } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const q = request.nextUrl.searchParams.get("q") || "";
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "10");

  if (q.length < 1) {
    return NextResponse.json([]);
  }

  const pattern = `%${q}%`;
  const results = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(or(ilike(users.name, pattern), ilike(users.email, pattern)))
    .limit(limit);

  return NextResponse.json(results);
}
