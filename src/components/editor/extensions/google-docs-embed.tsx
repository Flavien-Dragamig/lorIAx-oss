"use client";

import { Node, mergeAttributes, InputRule } from "@tiptap/core";
import type { NodeViewProps } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { useState, useCallback, useRef, useEffect } from "react";
import { FileText, ExternalLink, GripHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── URL helpers ─────────────────────────────────────────────────────────────

const GOOGLE_DOCS_REGEX = /^https:\/\/docs\.google\.com\/document\/d\/[a-zA-Z0-9_-]+/;

function isValidGoogleDocsUrl(url: string): boolean {
  return GOOGLE_DOCS_REGEX.test(url);
}

function toEmbedUrl(url: string): string {
  // Remove trailing fragments/params and append /pub?embedded=true
  const base = url.replace(/\/(edit|preview|pub).*$/, "");
  return `${base}/pub?embedded=true`;
}

function truncateUrl(url: string, maxLen = 50): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 3) + "...";
}

// ─── Node View Component ─────────────────────────────────────────────────────

function GoogleDocsEmbedView({
  node,
  updateAttributes,
  selected,
}: Pick<NodeViewProps, "node" | "updateAttributes" | "selected">) {
  const { url, height } = node.attrs;
  const [isEditing, setIsEditing] = useState(!url);
  const [inputValue, setInputValue] = useState(url || "");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setError("Veuillez saisir une URL");
      return;
    }
    if (!isValidGoogleDocsUrl(trimmed)) {
      setError("URL invalide — uniquement docs.google.com/document/d/...");
      return;
    }
    setError("");
    updateAttributes({ url: trimmed });
    setIsEditing(false);
  }, [inputValue, updateAttributes]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setIsEditing(false);
        setInputValue(url || "");
        setError("");
      }
    },
    [handleSubmit, url]
  );

  // ─── Resize logic ───────────────────────────────────────────────────────

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = height;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientY - startY;
        const newHeight = Math.max(200, startHeight + delta);
        updateAttributes({ height: newHeight });
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [height, updateAttributes]
  );

  // ─── Editing state: URL input form ──────────────────────────────────────

  if (isEditing || !url) {
    return (
      <NodeViewWrapper className="google-docs-embed" data-drag-handle>
        <div className="google-docs-embed-input">
          <div className="google-docs-embed-input-header">
            <FileText className="h-5 w-5 text-blue-500" />
            <span>Intégrer un document Google Docs</span>
          </div>
          <div className="google-docs-embed-input-form">
            <input
              ref={inputRef}
              type="url"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setError("");
              }}
              onKeyDown={handleKeyDown}
              placeholder="https://docs.google.com/document/d/..."
              className="google-docs-embed-url-input"
            />
            <Button onClick={handleSubmit} variant="default" size="xs">
              Intégrer
            </Button>
          </div>
          {error && (
            <p className="google-docs-embed-error">{error}</p>
          )}
        </div>
      </NodeViewWrapper>
    );
  }

  // ─── Display state: toolbar + iframe ────────────────────────────────────

  return (
    <NodeViewWrapper
      className={`google-docs-embed ${selected ? "is-selected" : ""}`}
      data-drag-handle
    >
      <div className="google-docs-embed-toolbar">
        <div className="google-docs-embed-toolbar-left">
          <FileText className="h-4 w-4 text-blue-500" />
          <span
            className="google-docs-embed-url-label"
            title={url}
            onClick={() => setIsEditing(true)}
          >
            {truncateUrl(url)}
          </span>
        </div>
        <Button
          variant="ghost"
          size="xs"
          render={<a href={url} target="_blank" rel="noopener noreferrer" />}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Ouvrir
        </Button>
      </div>
      <div className="google-docs-embed-frame-wrapper" style={{ height }}>
        <iframe
          src={toEmbedUrl(url)}
          sandbox="allow-scripts allow-same-origin allow-popups"
          className="google-docs-embed-iframe"
          title="Google Docs"
          loading="lazy"
        />
      </div>
      <div
        ref={resizeRef}
        className="google-docs-embed-resize-handle"
        onMouseDown={handleResizeStart}
      >
        <GripHorizontal className="h-4 w-4" />
      </div>
    </NodeViewWrapper>
  );
}

// ─── InputRule: auto-convert pasted Google Docs URLs ─────────────────────────

const googleDocsInputRule = new InputRule({
  find: /^(https:\/\/docs\.google\.com\/document\/d\/[a-zA-Z0-9_-]+[^\s]*)[\s]$/,
  handler: ({ state, range, match }) => {
    const url = match[1];
    if (!url || !isValidGoogleDocsUrl(url)) return null;

    const { tr } = state;
    tr.delete(range.from, range.to);
    tr.insert(
      range.from,
      state.schema.nodes.googleDocsEmbed.create({ url, height: 600 })
    );
    return;
  },
});

// ─── TipTap Commands Declaration ────────────────────────────────────────────

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    googleDocsEmbed: {
      setGoogleDocsEmbed: (attrs: {
        url?: string;
        height?: number;
      }) => ReturnType;
    };
  }
}

// ─── TipTap Node Extension ──────────────────────────────────────────────────

export const GoogleDocsEmbed = Node.create({
  name: "googleDocsEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      url: {
        default: "",
      },
      height: {
        default: 600,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="google-docs-embed"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "google-docs-embed" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(GoogleDocsEmbedView, {
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement;
        return !!target.closest("input, button, select, textarea, [role='button'], [contenteditable]");
      },
    });
  },

  addInputRules() {
    return [googleDocsInputRule];
  },

  addCommands() {
    return {
      setGoogleDocsEmbed:
        (attrs) =>
        ({ chain }) => {
          return chain()
            .insertContent({ type: this.name, attrs })
            .run();
        },
    };
  },
});
