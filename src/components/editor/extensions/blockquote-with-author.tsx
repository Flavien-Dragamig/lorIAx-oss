"use client";

import Blockquote from "@tiptap/extension-blockquote";
import { ReactNodeViewRenderer, NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/core";
import { useState, useCallback } from "react";

const BlockquoteView = ({ node, updateAttributes, editor }: NodeViewProps) => {
  const author = node.attrs.author || "";
  const [isEditing, setIsEditing] = useState(false);
  const editable = editor?.isEditable;

  const handleAuthorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateAttributes({ author: e.target.value });
    },
    [updateAttributes]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        setIsEditing(false);
      }
    },
    []
  );

  return (
    <NodeViewWrapper as="blockquote" className="blockquote-with-author">
      <NodeViewContent className="blockquote-content" />
      {editable && !author && !isEditing && (
        <button
          className="blockquote-add-author"
          onClick={() => setIsEditing(true)}
          contentEditable={false}
        >
          + Ajouter un auteur
        </button>
      )}
      {isEditing && editable && (
        <input
          className="blockquote-author-input"
          type="text"
          value={author}
          onChange={handleAuthorChange}
          onBlur={() => setIsEditing(false)}
          onKeyDown={handleKeyDown}
          placeholder="Nom de l'auteur"
          autoFocus
          contentEditable={false}
        />
      )}
      {author && !isEditing && (
        <cite
          className="blockquote-author"
          contentEditable={false}
          onClick={() => editable && setIsEditing(true)}
        >
          — {author}
        </cite>
      )}
    </NodeViewWrapper>
  );
};

export const BlockquoteWithAuthor = Blockquote.extend({
  addAttributes() {
    return {
      author: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-author") || null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.author) return {};
          return { "data-author": attributes.author };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlockquoteView, {
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement;
        return !!target.closest("input, button, select, textarea, [role='button'], [contenteditable]");
      },
    });
  },
});
