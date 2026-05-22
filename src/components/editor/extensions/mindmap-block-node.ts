import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { createLazyNodeView } from "./lazy-node-view";

const LazyMindmapBlockView = createLazyNodeView(
  () => import("./mindmap-block").then((m) => ({ default: m.MindmapBlockView })),
  "Carte mentale"
);

export const MindmapBlock = Node.create({
  name: "mindmapBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      mindmapId: { default: null },
      title: { default: "" },
      thumbnailUrl: { default: null },
      lockedBy: { default: null },
      lockedAt: { default: null },
    };
  },

  parseHTML() {
    return [
      { tag: 'div[data-type="mindmap-block"]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "mindmap-block" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LazyMindmapBlockView, {
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement;
        return !!target.closest("input, button, select, textarea, [role='button']");
      },
    });
  },
});
