"use client";

import { Node, mergeAttributes, InputRule } from "@tiptap/core";
import type { NodeViewProps } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { useState, useCallback, useRef, useEffect } from "react";
import { Video, ExternalLink, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Providers ───────────────────────────────────────────────────────────────

type VideoProvider = "youtube" | "vimeo" | "dailymotion";

interface VideoInfo {
  provider: VideoProvider;
  videoId: string;
  embedUrl: string;
}

const YOUTUBE_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const VIMEO_REGEX = /vimeo\.com\/(?:video\/)?(\d+)/;
const DAILYMOTION_REGEX = /dailymotion\.com\/(?:video\/|embed\/video\/)?([a-zA-Z0-9]+)/;

function parseVideoUrl(url: string): VideoInfo | null {
  const yt = url.match(YOUTUBE_REGEX);
  if (yt) {
    return {
      provider: "youtube",
      videoId: yt[1],
      embedUrl: `https://www.youtube.com/embed/${yt[1]}`,
    };
  }
  const vm = url.match(VIMEO_REGEX);
  if (vm) {
    return {
      provider: "vimeo",
      videoId: vm[1],
      embedUrl: `https://player.vimeo.com/video/${vm[1]}`,
    };
  }
  const dm = url.match(DAILYMOTION_REGEX);
  if (dm) {
    return {
      provider: "dailymotion",
      videoId: dm[1],
      embedUrl: `https://www.dailymotion.com/embed/video/${dm[1]}`,
    };
  }
  return null;
}

// ─── Node View Component ─────────────────────────────────────────────────────

function VideoEmbedView({
  node,
  updateAttributes,
  selected,
}: Pick<NodeViewProps, "node" | "updateAttributes" | "selected">) {
  const { src, provider, videoid } = node.attrs;
  const [isEditing, setIsEditing] = useState(!src);
  const [inputValue, setInputValue] = useState(src || "");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setError("Veuillez coller une URL YouTube ou Vimeo");
      return;
    }
    const info = parseVideoUrl(trimmed);
    if (!info) {
      setError("URL non reconnue — YouTube, Vimeo et Dailymotion sont acceptés");
      return;
    }
    setError("");
    updateAttributes({ src: trimmed, provider: info.provider, videoid: info.videoId });
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
        setInputValue(src || "");
        setError("");
      }
    },
    [handleSubmit, src]
  );

  const embedUrl = src ? parseVideoUrl(src)?.embedUrl : null;

  // ─── Editing state: URL input form ────────────────────────────────────────

  if (isEditing || !src) {
    return (
      <NodeViewWrapper className="video-embed" data-drag-handle>
        <div className="video-embed-input">
          <div className="video-embed-input-header">
            <Video className="h-5 w-5 text-red-500" />
            <span>Intégrer une vidéo YouTube, Vimeo ou Dailymotion</span>
          </div>
          <div className="video-embed-input-form">
            <input
              ref={inputRef}
              type="url"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setError("");
              }}
              onKeyDown={handleKeyDown}
              placeholder="Collez l'URL YouTube, Vimeo ou Dailymotion..."
              className="video-embed-url-input"
            />
            <Button onClick={handleSubmit} variant="default" size="xs">
              Intégrer
            </Button>
          </div>
          {error && <p className="video-embed-error">{error}</p>}
        </div>
      </NodeViewWrapper>
    );
  }

  // ─── Display state: toolbar + iframe ──────────────────────────────────────

  const providerLabel =
    provider === "youtube" ? "YouTube" : provider === "vimeo" ? "Vimeo" : "Dailymotion";
  const ProviderIcon =
    provider === "youtube" ? (
      <Youtube className="h-4 w-4 text-red-500" />
    ) : provider === "vimeo" ? (
      <Video className="h-4 w-4 text-sky-500" />
    ) : (
      <Video className="h-4 w-4 text-blue-600" />
    );

  return (
    <NodeViewWrapper
      className={`video-embed ${selected ? "is-selected" : ""}`}
      data-drag-handle
    >
      <div className="video-embed-toolbar">
        <div className="video-embed-toolbar-left">
          {ProviderIcon}
          <span className="video-embed-provider-label">{providerLabel}</span>
          <span className="video-embed-video-id" title={src}>
            {videoid}
          </span>
        </div>
        <div className="video-embed-toolbar-right">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setInputValue(src);
              setIsEditing(true);
            }}
          >
            Modifier
          </Button>
          <Button
            variant="ghost"
            size="xs"
            render={<a href={src} target="_blank" rel="noopener noreferrer" />}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ouvrir
          </Button>
        </div>
      </div>
      <div className="video-embed-frame-wrapper">
        <iframe
          src={embedUrl!}
          className="video-embed-iframe"
          title={`Vidéo ${providerLabel}`}
          allow="fullscreen; autoplay; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    </NodeViewWrapper>
  );
}

// ─── InputRule: auto-convert pasted YouTube/Vimeo URLs ───────────────────────

const videoInputRule = new InputRule({
  find: /^(https?:\/\/(?:(?:www\.)?youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/|(?:www\.)?vimeo\.com\/(?:video\/)?)[\w-]+[^\s]*)[\s]$/,
  handler: ({ state, range, match }) => {
    const url = match[1];
    const info = parseVideoUrl(url);
    if (!info) return null;

    const { tr } = state;
    tr.delete(range.from, range.to);
    tr.insert(
      range.from,
      state.schema.nodes.videoEmbed.create({
        src: url,
        provider: info.provider,
        videoid: info.videoId,
      })
    );
  },
});

// ─── TipTap Commands Declaration ────────────────────────────────────────────

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    videoEmbed: {
      setVideoEmbed: (attrs: {
        src?: string;
        provider?: string;
        videoid?: string;
      }) => ReturnType;
    };
  }
}

// ─── TipTap Node Extension ───────────────────────────────────────────────────

export const VideoEmbed = Node.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: "" },
      provider: { default: "" },
      videoid: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="video-embed"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "video-embed" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoEmbedView, {
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement;
        return !!target.closest("input, button, select, textarea, [role='button'], [contenteditable]");
      },
    });
  },

  addInputRules() {
    return [videoInputRule];
  },

  addCommands() {
    return {
      setVideoEmbed:
        (attrs) =>
        ({ chain }) => {
          return chain()
            .insertContent({ type: this.name, attrs })
            .run();
        },
    };
  },
});
