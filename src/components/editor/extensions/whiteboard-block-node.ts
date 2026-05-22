import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { createLazyNodeView } from "./lazy-node-view";

const LazyWhiteboardBlockView = createLazyNodeView(
  () => import("./whiteboard-block").then((m) => ({ default: m.WhiteboardBlockView })),
  "Tableau blanc"
);

export const WhiteboardBlock = Node.create({
  name: "whiteboardBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      canvasId: { default: null },
      title: { default: "" },
      thumbnailUrl: { default: null },
      lockedBy: { default: null },
      lockedAt: { default: null },
    };
  },

  parseHTML() {
    return [
      { tag: 'div[data-type="whiteboard-block"]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "whiteboard-block" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LazyWhiteboardBlockView, {
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement;
        return !!target.closest("input, button, select, textarea, [role='button']");
      },
    });
  },
});
