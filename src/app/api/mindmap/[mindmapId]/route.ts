import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mindmapSnapshots } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { z } from "zod";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ mindmapId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { mindmapId } = await params;

  const [row] = await db
    .select()
    .from(mindmapSnapshots)
    .where(eq(mindmapSnapshots.mindmapId, mindmapId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ data: null, thumbnailUrl: null });
  }

  return NextResponse.json({ data: row.data, thumbnailUrl: row.thumbnailUrl ?? null });
}

const postSchema = z.object({
  data: z.string().min(1),
  thumbnailUrl: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ mindmapId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { mindmapId } = await params;

  const body = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { data, thumbnailUrl } = parsed.data;

  await db
    .insert(mindmapSnapshots)
    .values({ mindmapId, data, thumbnailUrl: thumbnailUrl ?? null })
    .onConflictDoUpdate({
      target: mindmapSnapshots.mindmapId,
      set: {
        data,
        thumbnailUrl: thumbnailUrl ?? null,
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ success: true });
}
