import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { createLazyNodeView } from "./lazy-node-view";

const LazyCalendarBlockView = createLazyNodeView(
  () => import("./calendar-block").then((m) => ({ default: m.CalendarBlockView })),
  "Calendrier"
);

export const CalendarBlock = Node.create({
  name: "calendarBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      calendarIds: { default: "[]" },
      viewMode: { default: "month" },
      showTitle: { default: true },
      height: { default: 400 },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="calendar-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "calendar-block" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LazyCalendarBlockView, {
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement;
        return !!target.closest("input, button, select, textarea, [role='button']");
      },
    });
  },
});
