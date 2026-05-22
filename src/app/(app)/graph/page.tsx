"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const KnowledgeGraph = dynamic(
  () => import("@/components/graph/knowledge-graph").then((m) => m.KnowledgeGraph),
  { ssr: false }
);
import type { GraphData } from "@/types";
import { Network, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GraphPage() {
  const router = useRouter();
  const [graphData, setGraphData] = useState<GraphData>({
    nodes: [],
    edges: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/graph")
      .then((r) => r.json())
      .then((data) => {
        if (data?.nodes && data?.edges) {
          setGraphData(data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function handleNodeClick(nodeId: string) {
    router.push(`/s/_/${nodeId}`);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Graphe de connaissances</h1>
          <span className="text-sm text-muted-foreground">
            {graphData.nodes.length} documents, {graphData.edges.length} liens
          </span>
        </div>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Filter className="h-3.5 w-3.5" />
          Filtrer
        </Button>
      </div>

      <div className="flex-1 p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse text-muted-foreground">
              Chargement du graphe...
            </div>
          </div>
        ) : (
          <KnowledgeGraph
            data={graphData}
            onNodeClick={handleNodeClick}
            width={1200}
            height={800}
          />
        )}
      </div>
    </div>
  );
}
