"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import { TaskItemAssignable } from "./extensions/task-item-assignable";
import { Checklist, ChecklistItem } from "./extensions/checklist";
import { useTaskSync } from "@/hooks/use-task-sync";
import TiptapImage from "@tiptap/extension-image";
import TiptapLink from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { TableExtended } from "./extensions/table-block/table-extended";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import type CodeBlockLowlightType from "@tiptap/extension-code-block-lowlight";
import Dropcursor from "@tiptap/extension-dropcursor";
import Collaboration from "@tiptap/extension-collaboration";
// lowlight est chargé dynamiquement pour réduire le bundle initial (~180KB)
import { Markdown } from "tiptap-markdown";
import { useEffect, useRef, useMemo, useState } from "react";
import { EditorToolbar } from "./editor-toolbar";
import { WikiLink, WikiLinkSuggestion } from "./extensions/wiki-link";
import { GoogleDocsEmbed } from "./extensions/google-docs-embed";
import { LinkPreview } from "./extensions/link-preview";
import { MentionExtension } from "./extensions/mention-extension";
import { SlashCommands, setCustomAliases } from "./extensions/slash-commands/slash-extension";
import { ChartBlock } from "./extensions/chart-block-node";
import { DatabaseBlock } from "./extensions/database-block/node";
import { WhiteboardBlock } from "./extensions/whiteboard-block-node";
import { MindmapBlock } from "./extensions/mindmap-block-node";
import { MapBlock } from "./extensions/map-block-node";
import { CalendarBlock } from "./extensions/calendar-block-node";
import { EventInlineNode } from "./extensions/event-inline-node";
import { MeetingBlock } from "./extensions/meeting-block-node";
import { InPersonMeetingBlock } from "./extensions/meeting/in-person-meeting-block-node";
import { SpreadsheetBlock } from "./extensions/spreadsheet-block-node";
import { VideoEmbed } from "./extensions/video-embed";
import { BlockquoteWithAuthor } from "./extensions/blockquote-with-author";
import { CalloutBlock } from "./extensions/callout-block";
import { EditorContext } from "./extensions/editor-context";
import { WifiOff } from "lucide-react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type * as Y from "yjs";

// Chargement dynamique de lowlight + CodeBlockLowlight
let _codeBlockExt: ReturnType<typeof CodeBlockLowlightType.configure> | null = null;
const codeBlockExtPromise = Promise.all([
  import("@tiptap/extension-code-block-lowlight"),
  import("lowlight"),
]).then(([{ default: CodeBlockLowlight }, { common, createLowlight }]) => {
  const lowlight = createLowlight(common);
  _codeBlockExt = CodeBlockLowlight.configure({ lowlight });
  return _codeBlockExt;
});

interface LorIAxEditorProps {
  content: string;
  onChange?: (markdown: string) => void;
  onSave?: (markdown: string) => void;
  editable?: boolean;
  placeholder?: string;
  spaceId?: string;
  documentId?: string;
  // Collaboration props
  collaborationEnabled?: boolean;
  provider?: HocuspocusProvider | null;
  ydoc?: Y.Doc | null;
  // Pessimistic lock mode: read-only when offline and locked by another user
  lockedOffline?: boolean;
}

export function LorIAxEditor({
  content,
  onChange,
  onSave,
  editable = true,
  placeholder = "Tapez / pour inserer un bloc...",
  spaceId,
  documentId,
  collaborationEnabled = false,
  provider,
  ydoc,
  lockedOffline = false,
}: LorIAxEditorProps) {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTasks = useTaskSync(documentId);
  const isCollab = collaborationEnabled && ydoc && provider;
  // In collab mode (Yjs CRDT), always allow editing — merging happens automatically.
  // Only restrict editing for pessimistic lock mode when offline.
  const effectiveEditable = lockedOffline ? false : editable;

  // Charger CodeBlockLowlight dynamiquement (ref stable, pas de re-render)
  const codeBlockExtRef = useRef(_codeBlockExt);
  const [codeBlockReady, setCodeBlockReady] = useState(!!_codeBlockExt);
  useEffect(() => {
    if (!codeBlockExtRef.current) {
      codeBlockExtPromise.then((ext) => {
        codeBlockExtRef.current = ext;
        setCodeBlockReady(true);
      });
    }
  }, []);

  // Charger les alias custom des slash commands
  useEffect(() => {
    fetch("/api/admin/slash-aliases")
      .then((r) => r.ok ? r.json() : {})
      .then((aliases) => setCustomAliases(aliases))
      .catch(() => {});
  }, []);

  // Exposer le spaceId et documentId pour les blocs éditeur
  useEffect(() => {
    if (spaceId) {
      window.__loriax_spaceId = spaceId;
    }
    if (documentId) {
      window.__loriax_docId = documentId;
    }
  }, [spaceId, documentId]);

  // Build extensions list based on collaboration mode
  const extensions = useMemo(() => {
    const baseExtensions = [
      StarterKit.configure({
        codeBlock: false,
        dropcursor: false,
        blockquote: false,
        link: false,       // Configured explicitly below
        underline: false,  // Configured explicitly below
        // Disable history when collaboration is enabled (Yjs handles undo/redo)
        ...(isCollab ? { history: false } : {}),
      }),
      BlockquoteWithAuthor,
      CalloutBlock,
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItemAssignable,
      Checklist,
      ChecklistItem,
      TiptapImage.configure({ inline: false, allowBase64: true }),
      TiptapLink.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline" },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TableExtended.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      ...(codeBlockExtRef.current ? [codeBlockExtRef.current] : []),
      Dropcursor.configure({ color: "var(--primary)", width: 2 }),
      WikiLink,
      WikiLinkSuggestion,
      MentionExtension,
      SlashCommands,
      GoogleDocsEmbed,
      LinkPreview,
      ChartBlock,
      DatabaseBlock,
      WhiteboardBlock,
      MindmapBlock,
      MapBlock,
      CalendarBlock,
      EventInlineNode,
      MeetingBlock,
      InPersonMeetingBlock,
      SpreadsheetBlock,
      VideoEmbed,
      EditorContext,
      Markdown.configure({
        html: true,
        transformCopiedText: true,
        transformPastedText: true,
      }),
    ];

    // Add collaboration extensions when enabled
    if (isCollab) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      baseExtensions.push(
        Collaboration.configure({
          document: ydoc,
        }) as any,
      );
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }

    return baseExtensions;
  }, [isCollab, ydoc, provider, placeholder, codeBlockReady]);

  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    // In collaboration mode, content comes from Yjs, not from props
    content: isCollab ? undefined : content,
    editable: effectiveEditable,
    editorProps: {
      attributes: {
        class: "focus:outline-none min-h-[300px] px-4 py-4 md:px-8 md:py-6",
      },
      handleKeyDown: (_view, event) => {
        // Ctrl+S pour sauvegarder
        if ((event.metaKey || event.ctrlKey) && event.key === "s") {
          event.preventDefault();
          if (onSave && editor && !isCollab) {
            const md = (editor.storage as { markdown?: { getMarkdown: () => string } }).markdown?.getMarkdown() ?? "";
            onSave(md);
          }
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      // Always sync task assignees regardless of collab mode
      syncTasks(editor);

      if (!isCollab) {
        const md = (editor.storage as { markdown?: { getMarkdown: () => string } }).markdown?.getMarkdown() ?? "";
        onChange?.(md);

        // Auto-save avec debounce (2s)
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          onSave?.(md);
        }, 2000);
      }
    },
  });

  // Expose ydoc/provider dans le storage EditorContext pour les extensions canvas
  useEffect(() => {
    type EditorContextStorage = { editorContext?: { ydoc: unknown; provider: unknown } };
    const storage = editor?.storage as EditorContextStorage | undefined;
    if (editor && storage?.editorContext) {
      storage.editorContext.ydoc = ydoc ?? null;
      storage.editorContext.provider = provider ?? null;
    }
  }, [editor, ydoc, provider]);

  // Sync initial des tâches au chargement (délai pour laisser Yjs charger le contenu en mode collab)
  useEffect(() => {
    if (!editor || !documentId) return;
    const t = setTimeout(() => {
      syncTasks(editor);
    }, isCollab ? 4000 : 500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, documentId]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Expose getMarkdown pour usage externe (ref directe vers l'éditeur)
  useEffect(() => {
    (window as Window & { __loriax_getMarkdown?: () => string }).__loriax_getMarkdown = () => {
      if (!editor) return "";
      return (editor.storage as { markdown?: { getMarkdown?: () => string } }).markdown?.getMarkdown?.() ?? "";
    };
    return () => {
      delete (window as Window & { __loriax_getMarkdown?: () => string }).__loriax_getMarkdown;
    };
  }, [editor]);

  // Écouter l'événement "Verser dans le document" émis par le chat panel
  useEffect(() => {
    const handleInsertBlock = (e: Event) => {
      const node = (e as CustomEvent).detail;
      if (!editor || !node) return;
      editor.commands.insertContent(node);
    };
    window.addEventListener("loriax:insert-block", handleInsertBlock);
    return () => window.removeEventListener("loriax:insert-block", handleInsertBlock);
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="tiptap-editor flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
      {lockedOffline && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-sm">
          <WifiOff className="h-4 w-4 flex-shrink-0" />
          <span>Lecture seule (verrou actif, hors ligne)</span>
        </div>
      )}
      {effectiveEditable && <EditorToolbar editor={editor} />}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
        {/* Espace de respiration en fin de document — clic pour focus l'éditeur */}
        <div
          className="min-h-[40vh] cursor-text"
          onClick={() => editor?.commands.focus("end")}
        />
      </div>
    </div>
  );
}
