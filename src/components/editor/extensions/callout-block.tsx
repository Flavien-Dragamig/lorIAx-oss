"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import type { NodeViewProps } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { useCallback, useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { Settings } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });
import { Theme as EmojiTheme, EmojiStyle } from "emoji-picker-react";

export type CalloutType = "info" | "warning" | "success" | "error";

const CALLOUT_EMOJIS: Record<CalloutType, string> = {
  info: "ℹ️",
  warning: "⚠️",
  success: "✅",
  error: "🚫",
};

const CALLOUT_LABELS: Record<CalloutType, string> = {
  info: "Information",
  warning: "Attention",
  success: "Succès",
  error: "Erreur",
};

const CALLOUT_TYPES: CalloutType[] = ["info", "warning", "success", "error"];

const CalloutView = ({ node, updateAttributes, editor }: NodeViewProps) => {
  const calloutType: CalloutType = node.attrs.calloutType || "info";
  const emoji = node.attrs.emoji || CALLOUT_EMOJIS[calloutType];
  const editable = editor?.isEditable;
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiRef = useRef<HTMLSpanElement>(null);
  const { darkMode } = useTheme();

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as globalThis.Node;
      if (showEmojiPicker && emojiRef.current && !emojiRef.current.contains(target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmojiPicker]);

  const handleEmojiClick = useCallback(() => {
    if (!editable) return;
    setShowEmojiPicker((prev) => !prev);
  }, [editable]);

  const handleTypeChange = useCallback(
    (newType: string) => {
      updateAttributes({ calloutType: newType as CalloutType, emoji: CALLOUT_EMOJIS[newType as CalloutType] });
    },
    [updateAttributes]
  );

  return (
    <NodeViewWrapper className={`callout-block callout-${calloutType}`} data-callout-type={calloutType}>
      <span
        ref={emojiRef}
        className="callout-emoji"
        contentEditable={false}
        onClick={handleEmojiClick}
        title={editable ? "Cliquer pour changer l'émoji" : ""}
      >
        {emoji}
        {showEmojiPicker && editable && (
          <div className="callout-emoji-picker-container" contentEditable={false} onClick={(e) => e.stopPropagation()}>
            <EmojiPicker
              onEmojiClick={(emojiData: { emoji: string }) => {
                updateAttributes({ emoji: emojiData.emoji });
                setShowEmojiPicker(false);
              }}
              theme={darkMode ? EmojiTheme.DARK : EmojiTheme.LIGHT}
              emojiStyle={EmojiStyle.NATIVE}
              width={320}
              height={400}
              searchPlaceHolder="Rechercher un émoji..."
              previewConfig={{ showPreview: false }}
              lazyLoadEmojis
            />
          </div>
        )}
      </span>
      <div className="callout-content">
        <NodeViewContent className="callout-text" />
      </div>
      {editable && (
        <div className="callout-type-selector" contentEditable={false}>
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button variant="ghost" size="icon-sm" title="Changer le type">
                <Settings className="h-3.5 w-3.5" />
              </Button>
            } />
            <DropdownMenuContent align="start">
              <DropdownMenuRadioGroup value={calloutType} onValueChange={handleTypeChange}>
                {CALLOUT_TYPES.map((t) => (
                  <DropdownMenuRadioItem key={t} value={t}>
                    <span className="flex items-center gap-2">
                      {CALLOUT_EMOJIS[t]} {CALLOUT_LABELS[t]}
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </NodeViewWrapper>
  );
};

export const CalloutBlock = Node.create({
  name: "calloutBlock",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      calloutType: {
        default: "info",
        parseHTML: (element: HTMLElement) => element.getAttribute("data-callout-type") || "info",
        renderHTML: (attributes: Record<string, unknown>) => ({ "data-callout-type": attributes.calloutType }),
      },
      emoji: {
        default: "ℹ️",
        parseHTML: (element: HTMLElement) => element.getAttribute("data-emoji") || "ℹ️",
        renderHTML: (attributes: Record<string, unknown>) => ({ "data-emoji": attributes.emoji }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "callout-block" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView, {
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement;
        return !!target.closest("input, button, select, textarea, [role='button'], [contenteditable]");
      },
    });
  },
});
