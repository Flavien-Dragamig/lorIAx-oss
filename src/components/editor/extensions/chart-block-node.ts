import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { createLazyNodeView } from "./lazy-node-view";

const DEFAULT_COLORS = [
  "var(--loriax-chart-1, #6366f1)",
  "var(--loriax-chart-2, #f59e0b)",
  "var(--loriax-chart-3, #10b981)",
  "var(--loriax-chart-4, #ef4444)",
  "var(--loriax-chart-5, #8b5cf6)",
  "var(--loriax-chart-6, #06b6d4)",
  "var(--loriax-chart-7, #f97316)",
  "var(--loriax-chart-8, #ec4899)",
];

const LazyChartBlockView = createLazyNodeView(
  () => import("./chart-block").then((m) => ({ default: m.ChartBlockView })),
  "Graphique"
);

export const ChartBlock = Node.create({
  name: "chartBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      chartType: { default: "bar" },
      title: { default: "" },
      data: { default: "[]" },
      columns: { default: "[]" },
      labelKey: { default: "label" },
      colors: { default: JSON.stringify(DEFAULT_COLORS) },
      dataSource: { default: '{"type":"manual"}' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="chart-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "chart-block" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LazyChartBlockView, {
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement;
        return !!target.closest("input, button, select, textarea, [role='button'], [contenteditable]");
      },
    });
  },
});
