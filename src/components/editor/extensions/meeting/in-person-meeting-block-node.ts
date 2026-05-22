import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { createLazyNodeView } from "../lazy-node-view";

const LazyInPersonMeetingBlockView = createLazyNodeView(
  () =>
    import("./in-person-meeting-block").then((m) => ({
      default: m.InPersonMeetingBlockView,
    })),
  "Réunion en présentiel"
);

export const InPersonMeetingBlock = Node.create({
  name: "inPersonMeetingBlock",
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
      participants: { default: [] },
      speakerMapping: { default: {} },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="in-person-meeting-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "in-person-meeting-block" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LazyInPersonMeetingBlockView, {
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement;
        return !!target.closest("input, button, select, textarea, [role='button']");
      },
    });
  },
});
