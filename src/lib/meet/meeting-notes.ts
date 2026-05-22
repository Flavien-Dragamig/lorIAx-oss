import { db } from "@/lib/db";
import { documents, spaces, meetings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { writeDocument } from "@/lib/storage/filesystem";
import { commitFile } from "@/lib/git/repository";
import slugify from "slugify";
import logger from "@/lib/logger";

const log = logger.child({ module: "meet-notes" });

const MEETING_NOTES_FOLDER_SLUG = "comptes-rendus";
const MEETING_NOTES_FOLDER_TITLE = "Comptes rendus";
const MEETING_NOTES_FOLDER_ICON = "🎙️";

interface CreateNotesInput {
  meetingId: string;
  title: string;
  spaceId: string;
  createdBy: string;
  summary: string;
  transcript: string;
}

/**
 * Find or create the "Comptes rendus" folder in a space.
 */
async function getOrCreateNotesFolder(
  spaceId: string,
  createdBy: string
): Promise<string> {
  const [existing] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.spaceId, spaceId),
        eq(documents.slug, MEETING_NOTES_FOLDER_SLUG),
        eq(documents.isFolder, true)
      )
    )
    .limit(1);

  if (existing) return existing.id;

  const [folder] = await db
    .insert(documents)
    .values({
      spaceId,
      title: MEETING_NOTES_FOLDER_TITLE,
      slug: MEETING_NOTES_FOLDER_SLUG,
      filePath: MEETING_NOTES_FOLDER_SLUG,
      icon: MEETING_NOTES_FOLDER_ICON,
      visibility: "team",
      classification: "internal",
      isFolder: true,
      createdBy,
    })
    .returning();

  log.info({ spaceId, folderId: folder.id }, "Meeting notes folder created");
  return folder.id;
}

/**
 * Create a LorIAx document from a meeting summary and transcript.
 * The document is saved inside the "Comptes rendus" folder of the space.
 */
export async function createMeetingNotes(
  input: CreateNotesInput
): Promise<string> {
  const { meetingId, title, spaceId, createdBy, summary, transcript } = input;

  // Get space info for git repo path
  const [space] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.id, spaceId))
    .limit(1);

  if (!space) {
    throw new Error(`Space ${spaceId} not found`);
  }

  // Ensure the "Comptes rendus" folder exists
  const folderId = await getOrCreateNotesFolder(spaceId, createdBy);

  // Build the document content
  const date = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const docTitle = `Compte-rendu — ${title} — ${date}`;
  const content = `# ${docTitle}

${summary}

---

## Transcript complet

<details>
<summary>Voir le transcript intégral</summary>

${transcript}

</details>
`;

  const docSlug = slugify(docTitle, { lower: true, strict: true }).slice(
    0,
    100
  );
  const filePath = `${MEETING_NOTES_FOLDER_SLUG}/${docSlug}.md`;

  // Write to filesystem + git
  await writeDocument(space.gitRepoPath, filePath, content);
  await commitFile(
    space.gitRepoPath,
    filePath,
    `Compte-rendu automatique : ${title}`,
    "LorIAx Meet",
    "meet@loriax.local"
  );

  // Insert in database inside the folder
  const [doc] = await db
    .insert(documents)
    .values({
      spaceId,
      parentId: folderId,
      title: docTitle,
      slug: docSlug,
      filePath,
      icon: "📋",
      visibility: space.type === "personal" ? "private" : "team",
      classification:
        (space.classification as
          | "public"
          | "internal"
          | "confidential"
          | "secret") || "internal",
      isFolder: false,
      createdBy,
      contentText: content,
    })
    .returning();

  // Link the notes document to the meeting
  await db
    .update(meetings)
    .set({ notesDocumentId: doc.id, updatedAt: new Date() })
    .where(eq(meetings.id, meetingId));

  log.info(
    { meetingId, documentId: doc.id, spaceId, folderId },
    "Meeting notes document created"
  );

  return doc.id;
}
