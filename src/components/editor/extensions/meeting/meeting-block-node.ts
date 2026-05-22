import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { createLazyNodeView } from "../lazy-node-view";

const LazyMeetingBlockView = createLazyNodeView(
  () =>
    import("./meeting-block").then((m) => ({
      default: m.MeetingBlockView,
    })),
  "Réunion"
);

export const MeetingBlock = Node.create({
  name: "meetingBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      meetingId: { default: "" },
      title: { default: "Nouvelle réunion" },
      status: { default: "scheduled" },
      roomName: { default: "" },
      notesDocumentId: { default: null },
      spaceId: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="meeting-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "meeting-block" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LazyMeetingBlockView, {
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement;
        return !!target.closest("input, button, select, textarea, [role='button']");
      },
    });
  },
});
