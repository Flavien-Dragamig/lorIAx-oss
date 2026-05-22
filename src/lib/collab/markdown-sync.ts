import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import * as Y from "yjs";
import { yDocToProsemirrorJSON } from "y-prosemirror";
import { writeDocument } from "@/lib/storage/filesystem";
import { commitFile } from "@/lib/git/repository";
import { spaces } from "@/lib/db/schema";
import { checkDocumentEditAccess } from "./auth-ws";
import type { JSONContent } from "@tiptap/core";
import logger from "@/lib/logger";

/**
 * Extract Markdown content from a Yjs document.
 * Uses prosemirror JSON serialization then converts to markdown.
 * Falls back to plain text extraction.
 */
export function extractTextFromYDoc(ydoc: Y.Doc): string {
  try {
    const json = yDocToProsemirrorJSON(ydoc, "default");
    return prosemirrorJsonToMarkdown(json);
  } catch {
    // Fallback: extract text from Yjs XML fragment
    const xmlFragment = ydoc.getXmlFragment("default");
    return xmlFragment.toString();
  }
}

/**
 * Simple ProseMirror JSON → Markdown converter.
 * Handles the most common node types.
 */
function prosemirrorJsonToMarkdown(json: Record<string, unknown>): string {
  const content = json.content as Array<Record<string, unknown>> | undefined;
  if (!content) return "";

  return content.map(nodeToMarkdown).join("\n");
}

function nodeToMarkdown(node: Record<string, unknown>): string {
  const type = node.type as string;
  const content = node.content as Array<Record<string, unknown>> | undefined;
  const attrs = node.attrs as Record<string, unknown> | undefined;

  switch (type) {
    case "paragraph":
      return inlineContent(content) + "\n";

    case "heading": {
      const level = (attrs?.level as number) || 1;
      return "#".repeat(level) + " " + inlineContent(content) + "\n";
    }

    case "bulletList":
      return (content || [])
        .map((item) => {
          const inner = (item.content as Array<Record<string, unknown>> | undefined) || [];
          return "- " + inner.map(nodeToMarkdown).join("").trim();
        })
        .join("\n") + "\n";

    case "orderedList":
      return (content || [])
        .map((item, i) => {
          const inner = (item.content as Array<Record<string, unknown>> | undefined) || [];
          return `${i + 1}. ` + inner.map(nodeToMarkdown).join("").trim();
        })
        .join("\n") + "\n";

    case "taskList":
      return (content || [])
        .map((item) => {
          const checked = (item.attrs as Record<string, unknown>)?.checked ? "x" : " ";
          const inner = (item.content as Array<Record<string, unknown>> | undefined) || [];
          return `- [${checked}] ` + inner.map(nodeToMarkdown).join("").trim();
        })
        .join("\n") + "\n";

    case "codeBlock": {
      const lang = (attrs?.language as string) || "";
      return "```" + lang + "\n" + inlineContent(content) + "\n```\n";
    }

    case "blockquote":
      return (content || [])
        .map((c) => "> " + nodeToMarkdown(c).trim())
        .join("\n") + "\n";

    case "horizontalRule":
      return "---\n";

    case "hardBreak":
      return "\n";

    default:
      return inlineContent(content);
  }
}

function inlineContent(content: Array<Record<string, unknown>> | undefined): string {
  if (!content) return "";
  return content
    .map((node) => {
      if (node.type === "text") {
        let text = node.text as string;
        const marks = node.marks as Array<Record<string, unknown>> | undefined;
        if (marks) {
          for (const mark of marks) {
            switch (mark.type) {
              case "bold":
              case "strong":
                text = `**${text}**`;
                break;
              case "italic":
              case "em":
                text = `*${text}*`;
                break;
              case "code":
                text = "`" + text + "`";
                break;
              case "link": {
                const href = (mark.attrs as Record<string, unknown>)?.href || "";
                text = `[${text}](${href})`;
                break;
              }
            }
          }
        }
        return text;
      }
      if (node.type === "hardBreak") return "\n";
      return inlineContent(node.content as Array<Record<string, unknown>> | undefined);
    })
    .join("");
}

/**
 * Persist the Yjs document content to the file system and git.
 * This maintains compatibility with the existing storage system.
 *
 * @param userId — if provided, re-checks edit permissions before writing (C5).
 *   Omitted for onDisconnect flush (final flush, data already in Yjs state).
 */
export async function syncYjsToStorage(
  documentId: string,
  ydoc: Y.Doc,
  userId?: string
): Promise<void> {
  try {
    // Re-validate edit permissions if userId is provided (C5)
    if (userId) {
      const hasEditAccess = await checkDocumentEditAccess(userId, documentId);
      if (!hasEditAccess) {
        logger.warn({ userId, documentId }, "[markdown-sync] Edit access revoked — sync blocked");
        return;
      }
    }

    // Extract ProseMirror JSON once — used for both markdown and task sync
    let prosemirrorJson: JSONContent | null = null;
    try {
      prosemirrorJson = yDocToProsemirrorJSON(ydoc, "default") as JSONContent;
    } catch {
      // Will fall back to text extraction for markdown
    }

    const markdown = prosemirrorJson
      ? prosemirrorJsonToMarkdown(prosemirrorJson as Record<string, unknown>)
      : extractTextFromYDoc(ydoc);

    // Get document and space info
    const [doc] = await db
      .select({
        filePath: documents.filePath,
        spaceId: documents.spaceId,
        title: documents.title,
      })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (!doc) return;

    const [space] = await db
      .select({ gitRepoPath: spaces.gitRepoPath })
      .from(spaces)
      .where(eq(spaces.id, doc.spaceId))
      .limit(1);

    if (!space) return;

    // Update contentText in DB
    await db
      .update(documents)
      .set({ contentText: markdown, updatedAt: new Date() })
      .where(eq(documents.id, documentId));

    // Write to filesystem
    await writeDocument(space.gitRepoPath, doc.filePath, markdown);

    // Git commit
    await commitFile(
      space.gitRepoPath,
      doc.filePath,
      `Auto-save: ${doc.title}`,
      "LorIAx Collab",
      "collab@loriax.local"
    );

  } catch (err) {
    logger.error({ err }, "[markdown-sync] Erreur sync Yjs vers storage");
  }
}
