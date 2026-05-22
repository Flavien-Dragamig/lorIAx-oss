import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { backupJobs } from "@/lib/db/schema";
import { desc, eq, and, count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const type = searchParams.get("type");
  const offset = (page - 1) * limit;

  const conditions = [];
  if (type && ["client", "technical", "full"].includes(type)) {
    conditions.push(eq(backupJobs.type, type as "client" | "technical" | "full"));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [jobs, [{ total }]] = await Promise.all([
    db
      .select()
      .from(backupJobs)
      .where(where)
      .orderBy(desc(backupJobs.startedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(backupJobs)
      .where(where),
  ]);

  return NextResponse.json({
    jobs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
