"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";
import { GraphNode } from "./GraphNode";
import { Viewport3D } from "./Viewport3D";
import { SchedulePanel } from "./SchedulePanel";
import { NODE_DEFS, CATEGORIES } from "@/lib/design/nodeDefs";
import { evaluateGraph } from "@/lib/design/evaluate";
import { api } from "@/lib/api";

const STORAGE_KEY = "kawayan-design-graph";

/** Strip React Flow's runtime fields down to the essentials we persist. */
function serialize(nodes: Node[], edges: Edge[]) {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: "graphNode",
      position: n.position,
      data: { type: (n.data as { type: string }).type, params: (n.data as { params: unknown }).params },
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    })),
  };
}

const nodeTypes = { graphNode: GraphNode };

function defaultParams(type: string): Record<string, number | string> {
  return Object.fromEntries(NODE_DEFS[type].params.map((p) => [p.key, p.default]));
}

// Preloaded graph — the whitepaper's proof chain (a bamboo barrel-vault of arches).
const INITIAL_NODES: Node[] = [
  { id: "arc-1", type: "graphNode", position: { x: 0, y: 40 }, data: { type: "arc", params: { ...defaultParams("arc"), plane: "xy", radius: 3, start: 0, end: 180, samples: 24 } } },
  { id: "divide-1", type: "graphNode", position: { x: 240, y: 40 }, data: { type: "divide", params: { count: 9 } } },
  { id: "culm-1", type: "graphNode", position: { x: 480, y: 40 }, data: { type: "culm", params: defaultParams("culm") } },
  { id: "array-1", type: "graphNode", position: { x: 720, y: 40 }, data: { type: "arrayLinear", params: { count: 4, dx: 0, dy: 0, dz: 1.5 } } },
  { id: "schedule-1", type: "graphNode", position: { x: 960, y: 40 }, data: { type: "schedule", params: defaultParams("schedule") } },
];

const INITIAL_EDGES: Edge[] = [
  { id: "e1", source: "arc-1", sourceHandle: "out", target: "divide-1", targetHandle: "in" },
  { id: "e2", source: "divide-1", sourceHandle: "out", target: "culm-1", targetHandle: "in" },
  { id: "e3", source: "culm-1", sourceHandle: "out", target: "array-1", targetHandle: "in" },
  { id: "e4", source: "array-1", sourceHandle: "out", target: "schedule-1", targetHandle: "in" },
];

export function DesignEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const idCounter = useRef(100);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const restored = useRef(false);

  // On mount: restore from ?g=<id> (server) or localStorage, else keep the preloaded chain.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const gid = new URLSearchParams(window.location.search).get("g");
    const applyGraph = (g: { nodes: unknown[]; edges: unknown[] }) => {
      if (Array.isArray(g.nodes) && Array.isArray(g.edges)) {
        setNodes(g.nodes as Node[]);
        setEdges(g.edges as Edge[]);
      }
    };
    if (gid) {
      api.getGraph(gid).then((doc) => applyGraph(doc.data)).catch(() => {});
      return;
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) applyGraph(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, [setNodes, setEdges]);

  // Autosave to localStorage (debounced) so work survives a refresh.
  useEffect(() => {
    if (!restored.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(nodes, edges)));
      } catch {
        /* ignore quota / private mode */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [nodes, edges]);

  const updateParam = useCallback(
    (nodeId: string, key: string, value: number | string) => {
      setNodes((ns) =>
        ns.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, params: { ...(n.data as { params: object }).params, [key]: value } } }
            : n,
        ),
      );
    },
    [setNodes],
  );

  // Inject the param-updater into every node's data so custom nodes can edit params.
  const rfNodes = useMemo(
    () => nodes.map((n) => ({ ...n, data: { ...n.data, updateParam } })),
    [nodes, updateParam],
  );

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge(c, eds)),
    [setEdges],
  );

  function addNode(type: string) {
    const id = `${type}-${idCounter.current++}`;
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: "graphNode",
        position: { x: 120 + Math.random() * 160, y: 260 + Math.random() * 120 },
        data: { type, params: defaultParams(type) },
      },
    ]);
  }

  async function saveAndShare() {
    setSaving(true);
    try {
      const doc = await api.createGraph(serialize(nodes, edges));
      const url = `${window.location.origin}/design?g=${doc.id}`;
      setShareUrl(url);
      window.history.replaceState(null, "", `/design?g=${doc.id}`);
    } catch {
      setShareUrl(null);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setNodes(INITIAL_NODES);
    setEdges(INITIAL_EDGES);
    setShareUrl(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    window.history.replaceState(null, "", "/design");
  }

  // Live evaluation (dependency-ordered) — recomputes on any node/edge change.
  const result = useMemo(() => {
    const evalNodes = nodes.map((n) => ({
      id: n.id,
      type: (n.data as { type: string }).type,
      data: { params: (n.data as { params: Record<string, number | string> }).params },
    }));
    return evaluateGraph(evalNodes, edges);
  }, [nodes, edges]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-bamboo-200 bg-bamboo-50 px-4 py-2">
        <span className="font-display text-lg font-semibold text-leaf-800">Design Lab</span>
        <span className="hidden text-xs text-bamboo-600 sm:inline">
          node-graph parametric modeling · drag to connect · edit params live
        </span>
        <div className="ml-auto flex items-center gap-2">
          <select
            className="rounded-md border border-bamboo-300 bg-white px-3 py-1.5 text-sm"
            value=""
            onChange={(e) => {
              if (e.target.value) addNode(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">+ Add node…</option>
            {CATEGORIES.map((cat) => (
              <optgroup key={cat} label={cat}>
                {Object.values(NODE_DEFS)
                  .filter((d) => d.category === cat)
                  .map((d) => (
                    <option key={d.type} value={d.type}>{d.label}</option>
                  ))}
              </optgroup>
            ))}
          </select>
          <button
            onClick={saveAndShare}
            disabled={saving}
            className="rounded-md bg-leaf-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-leaf-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save & share"}
          </button>
          <button
            onClick={reset}
            className="rounded-md border border-bamboo-300 bg-white px-3 py-1.5 text-sm font-medium text-bamboo-800 hover:bg-bamboo-100"
          >
            Reset
          </button>
        </div>
      </div>

      {shareUrl && (
        <div className="flex items-center gap-2 border-b border-leaf-200 bg-leaf-50 px-4 py-1.5 text-xs">
          <span className="text-bamboo-700">Shareable link:</span>
          <input
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded border border-bamboo-200 bg-white px-2 py-1"
          />
          <button
            onClick={() => navigator.clipboard?.writeText(shareUrl)}
            className="rounded bg-bamboo-200 px-2 py-1 font-medium text-bamboo-800"
          >
            Copy
          </button>
        </div>
      )}

      {/* Split: node canvas | (3D view over cut-list) */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1.15fr_1fr]">
        <div className="min-h-0 border-r border-bamboo-200">
          <ReactFlow
            nodes={rfNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#d9cfb2" gap={18} />
            <Controls />
          </ReactFlow>
        </div>

        <div className="grid min-h-0 grid-rows-[1.4fr_1fr]">
          <div className="min-h-0 bg-bamboo-100">
            <Viewport3D
              elements={result.scene.elements}
              curves={result.scene.curves}
              points={result.scene.points}
              joints={result.scene.joints}
            />
          </div>
          <div className="min-h-0 border-t border-bamboo-200 bg-white">
            <SchedulePanel schedule={result.schedule} />
          </div>
        </div>
      </div>
    </div>
  );
}
