"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { useState, useEffect } from "react";
import Image from "next/image";
import { ExternalLink, Globe } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface LinkPreviewAttrs {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
}

// ─── URL detection helper ───────────────────────────────────────────────────

const URL_REGEX = /^https?:\/\/[^\s<>]+$/i;

function isPlainUrl(text: string): boolean {
  return URL_REGEX.test(text.trim());
}

// ─── Fetch link metadata ───────────────────────────────────────────────────

async function fetchLinkPreview(
  url: string
): Promise<LinkPreviewAttrs | null> {
  try {
    const res = await fetch("/api/link-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      url: data.url || url,
      title: data.title || null,
      description: data.description || null,
      image: data.image || null,
    };
  } catch (error) {
    console.error('[LinkPreview] Fetch link preview échoué:', error);
    return null;
  }
}

// ─── Node View Component ────────────────────────────────────────────────────

function LinkPreviewView({ node }: ReactNodeViewProps) {
  const { url, title, description, image } = node.attrs as LinkPreviewAttrs;
  const [loading, setLoading] = useState(!title && !description);
  const [error, setError] = useState(false);
  const [meta, setMeta] = useState<LinkPreviewAttrs>({
    url,
    title,
    description,
    image,
  });

  useEffect(() => {
    // If we already have metadata, skip
    if (title || description) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    fetchLinkPreview(url).then((result) => {
      if (cancelled) return;
      if (result) {
        setMeta(result);
      } else {
        setError(true);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [url, title, description]);

  // Loading skeleton
  if (loading) {
    return (
      <NodeViewWrapper>
        <div className="link-preview-card link-preview-loading" contentEditable={false}>
          <div className="link-preview-skeleton-image" />
          <div className="link-preview-body">
            <div className="link-preview-skeleton-title" />
            <div className="link-preview-skeleton-desc" />
            <div className="link-preview-skeleton-url" />
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  // Error fallback — show as simple link
  if (error) {
    return (
      <NodeViewWrapper>
        <div className="link-preview-card link-preview-error" contentEditable={false}>
          <div className="link-preview-body">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="link-preview-url-fallback"
            >
              <Globe size={14} />
              {url}
            </a>
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  const displayUrl = (() => {
    try {
      const u = new URL(meta.url);
      return u.hostname.replace(/^www\./, "");
    } catch {
      return meta.url;
    }
  })();

  return (
    <NodeViewWrapper>
      <a
        href={meta.url}
        target="_blank"
        rel="noopener noreferrer"
        className="link-preview-card"
        contentEditable={false}
        draggable
        data-drag-handle
      >
        {meta.image && (
          <div className="link-preview-image">
            <Image
              src={meta.image}
              alt={meta.title || ""}
              width={120}
              height={100}
              unoptimized
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="link-preview-body">
          {meta.title && (
            <span className="link-preview-title">{meta.title}</span>
          )}
          {meta.description && (
            <span className="link-preview-description">{meta.description}</span>
          )}
          <span className="link-preview-url">
            <Globe size={12} />
            {displayUrl}
            <ExternalLink size={12} />
          </span>
        </div>
      </a>
    </NodeViewWrapper>
  );
}

// ─── ProseMirror Plugin — auto-convert pasted URLs ─────────────────────────

const linkPreviewPastePluginKey = new PluginKey("linkPreviewPaste");

function createLinkPreviewPastePlugin(
  nodeType: string
): Plugin {
  return new Plugin({
    key: linkPreviewPastePluginKey,
    props: {
      handlePaste(view, event) {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        const text = clipboardData.getData("text/plain").trim();
        const html = clipboardData.getData("text/html");

        // Only convert if:
        // 1. Pasted text is a plain URL
        // 2. No rich HTML content (e.g., not copying from a webpage with formatting)
        if (!isPlainUrl(text)) return false;
        if (html && !html.includes(text)) return false;

        const { state, dispatch } = view;
        const { $from } = state.selection;

        // Only convert if the cursor is on an empty line or at the start of an empty block
        const currentNode = $from.parent;
        if (
          currentNode.type.name !== "paragraph" ||
          currentNode.textContent.length > 0
        ) {
          return false;
        }

        // Insert the linkPreview node
        const schema = state.schema;
        const linkPreviewNodeType = schema.nodes[nodeType];
        if (!linkPreviewNodeType) return false;

        const node = linkPreviewNodeType.create({
          url: text,
          title: null,
          description: null,
          image: null,
        });

        // Replace the current empty paragraph with the link preview
        const pos = $from.before();
        const tr = state.tr.replaceWith(pos, $from.after(), node);
        dispatch(tr);

        return true;
      },
    },
  });
}

// ─── TipTap Node Extension ─────────────────────────────────────────────────

export const LinkPreview = Node.create({
  name: "linkPreview",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      url: { default: "" },
      title: { default: null },
      description: { default: null },
      image: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="link-preview"]',
        getAttrs: (dom) => {
          const element = dom as HTMLElement;
          return {
            url: element.getAttribute("data-url"),
            title: element.getAttribute("data-title"),
            description: element.getAttribute("data-description"),
            image: element.getAttribute("data-image"),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "link-preview",
        "data-url": HTMLAttributes.url,
        "data-title": HTMLAttributes.title,
        "data-description": HTMLAttributes.description,
        "data-image": HTMLAttributes.image,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LinkPreviewView);
  },

  addProseMirrorPlugins() {
    return [createLinkPreviewPastePlugin(this.name)];
  },
});
