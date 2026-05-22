"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Simulation } from "d3-force";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import { select } from "d3-selection";
import { zoom, zoomIdentity } from "d3-zoom";
import type { GraphData } from "@/types";

interface GraphNodeDatum extends SimulationNodeDatum {
  id: string;
  title: string;
  spaceId: string;
  linkCount: number;
}

interface GraphLinkDatum extends SimulationLinkDatum<GraphNodeDatum> {
  linkText?: string;
}

interface KnowledgeGraphProps {
  data: GraphData;
  onNodeClick?: (nodeId: string) => void;
  width?: number;
  height?: number;
}

const NODE_COLORS = {
  default: "var(--graph-node-default)",
  active: "var(--graph-node-active)",
  tag: "var(--graph-node-tag)",
};

export function KnowledgeGraph({
  data,
  onNodeClick,
  width = 800,
  height = 600,
}: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<Simulation<GraphNodeDatum, GraphLinkDatum> | null>(null);

  const renderGraph = useCallback(() => {
    if (!svgRef.current || data.nodes.length === 0) return;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const nodes: GraphNodeDatum[] = data.nodes.map((n) => ({ ...n }));
    const links: GraphLinkDatum[] = data.edges.map((e) => ({
      source: e.source,
      target: e.target,
      linkText: e.linkText,
    }));

    // Container pour le zoom
    const g = svg.append("g");

    // Zoom handler
    const zoomHandler = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoomHandler);
    svg.call(zoomHandler.transform, zoomIdentity.translate(width / 2, height / 2));

    // Liens
    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", "var(--graph-link-stroke)")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", 1);

    // Noeuds
    const node = g
      .append("g")
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("cursor", "pointer")
      .on("click", (_event, d) => {
        onNodeClick?.(d.id);
      });

    // Cercle du noeud
    node
      .append("circle")
      .attr("r", (d) => Math.max(6, Math.min(20, 6 + d.linkCount * 2)))
      .attr("fill", NODE_COLORS.default)
      .attr("stroke", "var(--graph-node-stroke)")
      .attr("stroke-width", 1.5)
      .on("mouseover", function () {
        select(this).attr("fill", NODE_COLORS.active).attr("stroke", NODE_COLORS.default);
      })
      .on("mouseout", function () {
        select(this).attr("fill", NODE_COLORS.default).attr("stroke", "var(--graph-node-stroke)");
      });

    // Label
    node
      .append("text")
      .text((d) => d.title.length > 20 ? d.title.slice(0, 20) + "..." : d.title)
      .attr("x", (d) => Math.max(8, 8 + d.linkCount))
      .attr("y", 4)
      .attr("fill", "currentColor")
      .attr("font-size", "11px")
      .attr("font-family", "var(--font-plus-jakarta), system-ui, sans-serif")
      .attr("pointer-events", "none");

    // Simulation
    const simulation = forceSimulation(nodes)
      .force(
        "link",
        forceLink<GraphNodeDatum, GraphLinkDatum>(links)
          .id((d) => d.id)
          .distance(80)
      )
      .force("charge", forceManyBody().strength(-200))
      .force("center", forceCenter(0, 0))
      .force("collide", forceCollide(30))
      .on("tick", () => {
        link
          .attr("x1", (d: GraphLinkDatum) => (d.source as GraphNodeDatum).x ?? 0)
          .attr("y1", (d: GraphLinkDatum) => (d.source as GraphNodeDatum).y ?? 0)
          .attr("x2", (d: GraphLinkDatum) => (d.target as GraphNodeDatum).x ?? 0)
          .attr("y2", (d: GraphLinkDatum) => (d.target as GraphNodeDatum).y ?? 0);

        node.attr("transform", (d: GraphNodeDatum) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      });

    simulationRef.current = simulation;

    return () => {
      simulation.stop();
    };
  }, [data, width, height, onNodeClick]);

  useEffect(() => {
    renderGraph();
    return () => {
      simulationRef.current?.stop();
    };
  }, [renderGraph]);

  return (
    <div className="w-full h-full bg-card rounded-lg border border-border overflow-hidden">
      {data.nodes.length === 0 ? (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Aucun document avec des liens pour afficher le graphe
        </div>
      ) : (
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="w-full h-full"
          viewBox={`0 0 ${width} ${height}`}
        />
      )}
    </div>
  );
}
