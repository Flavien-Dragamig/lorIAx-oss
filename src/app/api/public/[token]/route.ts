import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, spaces, publicShares, meetings } from "@/lib/db/schema";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { readDocument } from "@/lib/storage/filesystem";

// GET — Public access (no auth required)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Find the public share by token
  const [share] = await db
    .select()
    .from(publicShares)
    .where(
      and(
        eq(publicShares.token, token),
        isNull(publicShares.revokedAt)
      )
    )
    .limit(1);

  if (!share) {
    return NextResponse.json(
      { error: "Document introuvable ou lien expire" },
      { status: 404 }
    );
  }

  // Check expiration
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    return NextResponse.json(
      { error: "Document introuvable ou lien expire" },
      { status: 404 }
    );
  }

  // Load document
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, share.documentId))
    .limit(1);

  if (!doc) {
    return NextResponse.json(
      { error: "Document introuvable ou lien expire" },
      { status: 404 }
    );
  }

  // Load space
  const [space] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.id, doc.spaceId))
    .limit(1);

  if (!space) {
    return NextResponse.json(
      { error: "Document introuvable ou lien expire" },
      { status: 404 }
    );
  }

  // Verify classification: both document and space must be "public"
  if (doc.classification !== "public" || space.classification !== "public") {
    return NextResponse.json(
      { error: "Document introuvable ou lien expire" },
      { status: 404 }
    );
  }

  // Increment view count
  await db
    .update(publicShares)
    .set({ viewCount: sql`${publicShares.viewCount} + 1` })
    .where(eq(publicShares.id, share.id));

  // Read document content from filesystem
  let content = "";
  if (!doc.isFolder) {
    try {
      content = await readDocument(space.gitRepoPath, doc.filePath);
    } catch {
      content = doc.contentText || "";
    }
  }

  // Load meetings associated with this document (scheduled or active only)
  const docMeetings = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      status: meetings.status,
      roomName: meetings.roomName,
    })
    .from(meetings)
    .where(
      and(
        eq(meetings.documentId, doc.id),
        inArray(meetings.status, ["scheduled", "active"])
      )
    );

  return NextResponse.json({
    title: doc.title,
    content,
    icon: doc.icon,
    spaceName: space.name,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    meetings: docMeetings,
  });
}
