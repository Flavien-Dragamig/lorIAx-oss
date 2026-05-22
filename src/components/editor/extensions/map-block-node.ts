import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { createLazyNodeView } from "./lazy-node-view";

const DEFAULT_CONFIG = {
  center: [46.603354, 1.888334],
  zoom: 6,
  markers: [],
  height: 400,
};

const LazyMapBlockView = createLazyNodeView(
  () => import("./map-block").then((m) => ({ default: m.MapBlockView })),
  "Carte"
);

export const MapBlock = Node.create({
  name: "mapBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      mapConfig: {
        default: DEFAULT_CONFIG,
      },
      title: {
        default: "",
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="map-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "map-block" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LazyMapBlockView, {
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement;
        return !!target.closest("input, button, select, textarea, [role='button'], .leaflet-container");
      },
    });
  },
});
