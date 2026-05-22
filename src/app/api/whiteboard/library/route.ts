import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userWhiteboardLibrary } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { z } from "zod";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const [row] = await db
    .select()
    .from(userWhiteboardLibrary)
    .where(eq(userWhiteboardLibrary.userId, user.id))
    .limit(1);

  return NextResponse.json({ items: row?.libraryItems ?? [] });
}

const postSchema = z.object({
  items: z.array(z.any()),
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await db
    .insert(userWhiteboardLibrary)
    .values({ userId: user.id, libraryItems: parsed.data.items })
    .onConflictDoUpdate({
      target: userWhiteboardLibrary.userId,
      set: {
        libraryItems: parsed.data.items,
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ success: true });
}
