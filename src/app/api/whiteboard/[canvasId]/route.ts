import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { whiteboardSnapshots } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { z } from "zod";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ canvasId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { canvasId } = await params;

  const [row] = await db
    .select()
    .from(whiteboardSnapshots)
    .where(eq(whiteboardSnapshots.canvasId, canvasId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ elements: [] });
  }

  try {
    const snapshot = JSON.parse(row.snapshot);
    return NextResponse.json(snapshot);
  } catch {
    return NextResponse.json({ elements: [] });
  }
}

const postSchema = z.object({
  elements: z.array(z.any()),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ canvasId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { canvasId } = await params;

  const body = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { elements } = parsed.data;

  await db
    .insert(whiteboardSnapshots)
    .values({ canvasId, snapshot: JSON.stringify({ elements }) })
    .onConflictDoUpdate({
      target: whiteboardSnapshots.canvasId,
      set: {
        snapshot: JSON.stringify({ elements }),
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ success: true });
}
