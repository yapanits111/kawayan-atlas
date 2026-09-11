"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { tubeGeometry, stripGeometry } from "@/lib/design/geometry";
import { useAuth } from "@/components/AuthProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GraphNode } from "./GraphNode";
import { NoteNode } from "./NoteNode";
import { Viewport3D } from "./Viewport3D";
import { OutputPanel } from "./OutputPanel";
import { AddNodeMenu } from "./AddNodeMenu";
import { NODE_DEFS } from "@/lib/design/nodeDefs";
import { evaluateGraph } from "@/lib/design/evaluate";
import { EXAMPLES } from "@/lib/design/examples";
import { api } from "@/lib/api";

const STORAGE_KEY = "kawayan-design-graph";

/** Strip React Flow's runtime fields down to the essentials we persist. */
function serialize(nodes: Node[], edges: Edge[]) {
  return {
    nodes: nodes.map((n) => {
      const base = { id: n.id, type: n.type ?? "graphNode", position: n.position };
      if (n.type === "note") {
        // Notes carry their own text and box size, not a node type/params.
        return {
          ...base,
          width: n.width ?? n.measured?.width,
          height: n.height ?? n.measured?.height,
          data: { text: (n.data as { text?: string }).text ?? "" },
        };
      }
      return { ...base, data: { type: (n.data as { type: string }).type, params: (n.data as { params: unknown }).params } };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    })),
  };
}

const nodeTypes = { graphNode: GraphNode, note: NoteNode };

function defaultParams(type: string): Record<string, number | string> {
  return Object.fromEntries(NODE_DEFS[type].params.map((p) => [p.key, p.default]));
}

// Which output kinds may feed which input kinds (mirrors the compute coercions).
const COMPAT: Record<string, string[]> = {
  number: ["number"],
  points: ["points", "curve", "curves"],
  curve: ["curve", "curves"],
  curves: ["curve", "curves"],
  elements: ["elements"],
  joints: ["joints"],
  schedule: ["schedule"],
  checks: ["checks"],
};

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
  const clipboard = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [savedToAccount, setSavedToAccount] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  // The currently-loaded saved graph (from a share/gallery link or a prior save this
  // session). If the signed-in user owns it, Save updates it in place instead of
  // creating a duplicate.
  const [loadedGraph, setLoadedGraph] = useState<{ id: string; ownerId: string | null; title: string | null } | null>(null);
  const { user } = useAuth();
  const ownsLoaded = !!user && !!loadedGraph && loadedGraph.ownerId === user.id;
  // Signed in, looking at a shared design that isn't yours — Save claims a copy.
  const viewingOthers = !!user && !!loadedGraph && !ownsLoaded;
  const restored = useRef(false);
  const history = useRef<{ stack: string[]; index: number }>({ stack: [], index: -1 });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const speciesInfo = useRef<Record<string, { d0: number; d1: number; wall: number }>>({});
  const speciesLabels = useRef<Record<string, string>>({});
  const [speciesOptions, setSpeciesOptions] = useState<{ value: string; label: string }[]>([]);
  const jointLabels = useRef<Record<string, string>>({});
  const [jointOptions, setJointOptions] = useState<{ value: string; label: string }[]>([]);

  // Pull the seeded atlas species so culm nodes can be bamboo-aware (auto-fill dims).
  useEffect(() => {
    api
      .listSpecies()
      .then((all) => {
        const info: Record<string, { d0: number; d1: number; wall: number }> = {};
        const labels: Record<string, string> = {};
        const opts: { value: string; label: string }[] = [];
        const firstInt = (s: string) => {
          const m = s.match(/\d+/);
          return m ? parseInt(m[0], 10) : 0;
        };
        for (const s of all) {
          const d0 = firstInt(s.culm_diam_range) || 90;
          info[s.id] = { d0, d1: Math.round(d0 * 0.87), wall: firstInt(s.wall_thickness_range) || 10 };
          labels[s.id] = s.name_local;
          opts.push({ value: s.id, label: s.name_local });
        }
        speciesInfo.current = info;
        speciesLabels.current = labels;
        setSpeciesOptions(opts);
      })
      .catch(() => {});

    // The joint library, so a `joint` node knows a fish-mouth from a bolt-through (§3).
    api
      .listJoints()
      .then((all) => {
        const labels: Record<string, string> = {};
        for (const j of all) labels[j.id] = j.name;
        jointLabels.current = labels;
        setJointOptions(all.map((j) => ({ value: j.id, label: j.name })));
      })
      .catch(() => {});
  }, []);

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
      // Remember the opened graph's owner/title so a later Save can update it in place
      // (ownership is judged against the signed-in user at save time).
      api
        .getGraph(gid)
        .then((doc) => {
          applyGraph(doc.data);
          setLoadedGraph({ id: doc.id, ownerId: doc.owner_id ?? null, title: doc.title ?? null });
        })
        .catch(() => {});
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

  // Undo/redo history (debounced snapshots). Restoring a snapshot re-matches the
  // stored string, so the recorder naturally skips re-recording it.
  useEffect(() => {
    if (!restored.current) return;
    const t = setTimeout(() => {
      const snap = JSON.stringify(serialize(nodes, edges));
      const h = history.current;
      if (h.stack[h.index] === snap) return;
      h.stack = h.stack.slice(0, h.index + 1);
      h.stack.push(snap);
      if (h.stack.length > 60) h.stack.shift();
      h.index = h.stack.length - 1;
      setCanUndo(h.index > 0);
      setCanRedo(false);
    }, 400);
    return () => clearTimeout(t);
  }, [nodes, edges]);

  const updateParam = useCallback(
    (nodeId: string, key: string, value: number | string) => {
      setNodes((ns) =>
        ns.map((n) => {
          if (n.id !== nodeId) return n;
          const params = { ...(n.data as { params: Record<string, number | string> }).params, [key]: value };
          // Picking a species fills the culm's diameter/wall from the atlas data, and
          // carries the species label through to the schedule's material summary.
          if (key === "species" && typeof value === "string") {
            params.speciesLabel = speciesLabels.current[value] ?? "";
            const info = speciesInfo.current[value];
            if (info) {
              params.d0 = info.d0;
              params.d1 = info.d1;
              params.wall = info.wall;
            }
          }
          // Picking a joint type carries its library label through to the joint schedule.
          if (key === "type" && typeof value === "string") {
            params.typeLabel = jointLabels.current[value] ?? value;
          }
          return { ...n, data: { ...n.data, params } };
        }),
      );
    },
    [setNodes],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((ns) => ns.filter((n) => n.id !== nodeId));
      setEdges((es) => es.filter((e) => e.source !== nodeId && e.target !== nodeId));
    },
    [setNodes, setEdges],
  );

  const duplicateNode = useCallback(
    (nodeId: string) => {
      setNodes((ns) => {
        const src = ns.find((n) => n.id === nodeId);
        if (!src) return ns;
        const type = (src.data as { type: string }).type;
        const id = `${type}-${idCounter.current++}`;
        return [
          ...ns,
          {
            ...src,
            id,
            position: { x: src.position.x + 40, y: src.position.y + 40 },
            selected: false,
            data: { type, params: { ...(src.data as { params: object }).params } },
          },
        ];
      });
    },
    [setNodes],
  );

  // Copy the current selection (nodes + the edges wholly inside it) to an in-memory
  // clipboard, so a subgraph can be replicated as a unit.
  const copySelection = useCallback(() => {
    // Notes are annotations, not part of the computational subgraph — don't copy them.
    const sel = nodes.filter((n) => n.selected && n.type !== "note");
    if (!sel.length) return;
    const ids = new Set(sel.map((n) => n.id));
    clipboard.current = {
      nodes: sel.map((n) => ({
        ...n,
        data: { type: (n.data as { type: string }).type, params: { ...(n.data as { params: object }).params } },
      })) as Node[],
      edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)).map((e) => ({ ...e })),
    };
  }, [nodes, edges]);

  // Paste the clipboard: fresh ids, an offset, internal edges rewired to the new ids, and
  // the copies left selected so the next paste steps further along (and they move as a group).
  const pasteClipboard = useCallback(() => {
    const clip = clipboard.current;
    if (!clip || clip.nodes.length === 0) return;
    const OFFSET = 48;
    const idMap = new Map<string, string>();
    const newNodes: Node[] = clip.nodes.map((n) => {
      const type = (n.data as { type: string }).type;
      const id = `${type}-${idCounter.current++}`;
      idMap.set(n.id, id);
      return {
        id,
        type: "graphNode",
        position: { x: n.position.x + OFFSET, y: n.position.y + OFFSET },
        selected: true,
        data: { type, params: { ...(n.data as { params: object }).params } },
      } as Node;
    });
    const newEdges: Edge[] = clip.edges.map((e) => ({
      ...e,
      id: `e-${idCounter.current++}`,
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
    }));
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), ...newNodes]);
    setEdges((es) => [...es, ...newEdges]);
  }, [setNodes, setEdges]);

  const updateNote = useCallback(
    (nodeId: string, text: string) => {
      setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, text } } : n)));
    },
    [setNodes],
  );

  // Inject the right handlers per node kind, and keep notes stacked below the graph nodes.
  const rfNodes = useMemo(
    () =>
      nodes.map((n) =>
        n.type === "note"
          ? { ...n, zIndex: 0, data: { ...n.data, updateNote, deleteNode } }
          : { ...n, zIndex: 1, data: { ...n.data, updateParam, deleteNode, duplicateNode, speciesOptions, jointOptions } },
      ),
    [nodes, updateParam, updateNote, deleteNode, duplicateNode, speciesOptions, jointOptions],
  );

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge(c, eds)),
    [setEdges],
  );

  // Block connections between incompatible port kinds.
  const isValidConnection = useCallback(
    (c: Connection | Edge) => {
      const src = nodes.find((n) => n.id === c.source);
      const tgt = nodes.find((n) => n.id === c.target);
      if (!src || !tgt) return false;
      const outKind = NODE_DEFS[(src.data as { type: string }).type]?.outputs.find((o) => o.id === c.sourceHandle)?.kind;
      const inKind = NODE_DEFS[(tgt.data as { type: string }).type]?.inputs.find((i) => i.id === c.targetHandle)?.kind;
      if (!outKind || !inKind) return false;
      return (COMPAT[outKind] ?? [outKind]).includes(inKind);
    },
    [nodes],
  );

  function addNote() {
    const id = `note-${idCounter.current++}`;
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: "note",
        position: { x: 80 + Math.random() * 80, y: 220 + Math.random() * 80 },
        width: 240,
        height: 150,
        zIndex: 0,
        data: { text: "" },
      },
    ]);
  }

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

  function showSaved(id: string) {
    const url = `${window.location.origin}/design?g=${id}`;
    setShareUrl(url);
    setSavedToAccount(!!user);
    window.history.replaceState(null, "", `/design?g=${id}`);
  }

  /** Save the graph. If the signed-in user owns the loaded graph, update it in place;
   *  otherwise create a new one (naming it when signed in). `forceNew` always creates a
   *  copy — the "Save as new" path. Anonymous saves are unchanged from Release 1. */
  async function saveAndShare(forceNew = false) {
    const data = serialize(nodes, edges);
    setSaving(true);
    try {
      if (ownsLoaded && !forceNew && loadedGraph) {
        const doc = await api.updateGraph(loadedGraph.id, { data });
        showSaved(doc.id);
      } else if (user) {
        const suggested = forceNew && loadedGraph?.title ? `${loadedGraph.title} (copy)` : "Untitled design";
        const title = window.prompt("Name this design (saved to your account):", suggested);
        if (title === null) return; // cancelled
        const doc = await api.createGraph(data, title);
        setLoadedGraph({ id: doc.id, ownerId: user.id, title: title.trim() || null });
        showSaved(doc.id);
      } else {
        const doc = await api.createGraph(data);
        showSaved(doc.id);
      }
    } catch {
      setShareUrl(null);
    } finally {
      setSaving(false);
    }
  }

  function loadExample(key: string) {
    const ex = EXAMPLES.find((x) => x.key === key);
    if (!ex) return;
    setNodes(ex.graph.nodes as unknown as Node[]);
    setEdges(ex.graph.edges as unknown as Edge[]);
    setShareUrl(null);
    setLoadedGraph(null); // an example is a fresh start, not the opened design
    window.history.replaceState(null, "", "/design");
  }

  function reset() {
    setNodes(INITIAL_NODES);
    setEdges(INITIAL_EDGES);
    setShareUrl(null);
    setLoadedGraph(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    window.history.replaceState(null, "", "/design");
  }

  const applySnap = useCallback(
    (snap: string) => {
      const g = JSON.parse(snap);
      setNodes(g.nodes as Node[]);
      setEdges(g.edges as Edge[]);
    },
    [setNodes, setEdges],
  );

  const undo = useCallback(() => {
    const h = history.current;
    if (h.index <= 0) return;
    h.index--;
    applySnap(h.stack[h.index]);
    setCanUndo(h.index > 0);
    setCanRedo(h.index < h.stack.length - 1);
  }, [applySnap]);

  const redo = useCallback(() => {
    const h = history.current;
    if (h.index >= h.stack.length - 1) return;
    h.index++;
    applySnap(h.stack[h.index]);
    setCanUndo(h.index > 0);
    setCanRedo(h.index < h.stack.length - 1);
  }, [applySnap]);

  // Keyboard: Ctrl/Cmd+Z undo, +Shift+Z / +Y redo, +C copy selection, +V paste
  // (all suppressed while typing in a field, so native copy/paste still works there).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      } else if (key === "c") {
        copySelection();
      } else if (key === "v") {
        pasteClipboard();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, copySelection, pasteClipboard]);

  // Live evaluation (dependency-ordered) — recomputes on any node/edge change.
  const result = useMemo(() => {
    const evalNodes = nodes
      .filter((n) => n.type !== "note") // annotations are not evaluated
      .map((n) => ({
        id: n.id,
        type: (n.data as { type: string }).type,
        data: { params: (n.data as { params: Record<string, number | string> }).params },
      }));
    return evaluateGraph(evalNodes, edges);
  }, [nodes, edges]);

  function exportGLB() {
    const group = new THREE.Group();
    for (const el of result.scene.elements) {
      const geo =
        el.kind === "culm"
          ? tubeGeometry(el.curve, (el.startDiameter ?? 80) / 2000, (el.endDiameter ?? 70) / 2000, 10)
          : stripGeometry(el.curve, (el.width ?? 25) / 1000, (el.thickness ?? 6) / 1000);
      const mat = new THREE.MeshStandardMaterial({
        color: el.kind === "culm" ? 0x9a8248 : el.kind === "laminate" ? 0x8c6f3f : 0xc2b184,
      });
      group.add(new THREE.Mesh(geo, mat));
    }
    if (group.children.length === 0) return;
    new GLTFExporter().parse(
      group,
      (gltf) => download(new Blob([gltf as ArrayBuffer], { type: "model/gltf-binary" }), "kawayan-model.glb"),
      () => {},
      { binary: true },
    );
  }

  function exportDXF() {
    // DXF R12 line geometry of every element centerline. Three.js is Y-up; CAD is
    // Z-up, so map (x, y, z) -> (x, z, y).
    const out: string[] = ["0", "SECTION", "2", "ENTITIES"];
    for (const el of result.scene.elements) {
      const layer = el.kind === "culm" ? "CULM" : el.kind === "laminate" ? "LAMINATE" : "STRIP";
      const p = el.curve.points;
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1];
        out.push("0", "LINE", "8", layer,
          "10", String(a[0]), "20", String(a[2]), "30", String(a[1]),
          "11", String(b[0]), "21", String(b[2]), "31", String(b[1]));
      }
    }
    out.push("0", "ENDSEC", "0", "EOF");
    if (result.scene.elements.length === 0) return;
    download(new Blob([out.join("\n")], { type: "application/dxf" }), "kawayan-model.dxf");
  }

  function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-bamboo-200 bg-bamboo-50 px-4 py-2">
        <span className="font-display text-lg font-semibold text-leaf-800">Design Lab</span>
        <span className="hidden text-xs text-bamboo-600 sm:inline">
          drag to connect · shift-select, Ctrl/⌘ C/V to copy, Del to remove
        </span>
        <div className="ml-auto flex items-center gap-2">
          <select
            className="rounded-md border border-bamboo-300 bg-white px-3 py-1.5 text-sm"
            value=""
            onChange={(e) => {
              if (e.target.value) loadExample(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">Examples…</option>
            {EXAMPLES.map((x) => (
              <option key={x.key} value={x.key}>{x.label}</option>
            ))}
          </select>
          <AddNodeMenu onAdd={addNode} />
          <button
            onClick={addNote}
            title="Add a note to annotate the graph"
            className="rounded-md border border-bamboo-300 bg-white px-3 py-1.5 text-sm text-bamboo-800 hover:bg-bamboo-100"
          >
            + Note
          </button>
          <button
            onClick={() => saveAndShare()}
            disabled={saving}
            title={
              ownsLoaded
                ? "Update this saved design in place"
                : viewingOthers
                  ? "Save your own copy of this shared design to My designs"
                  : "Save and get a shareable link"
            }
            className="rounded-md bg-leaf-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-leaf-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : ownsLoaded ? "Update" : viewingOthers ? "Save a copy" : "Save & share"}
          </button>
          {ownsLoaded && (
            <button
              onClick={() => saveAndShare(true)}
              disabled={saving}
              title="Save a separate copy to your account"
              className="rounded-md border border-bamboo-300 bg-white px-3 py-1.5 text-sm font-medium text-bamboo-800 hover:bg-bamboo-100 disabled:opacity-60"
            >
              Save as new
            </button>
          )}
          <select
            className="rounded-md border border-bamboo-300 bg-white px-2.5 py-1.5 text-sm font-medium text-bamboo-800"
            value=""
            title="Export the 3D model"
            onChange={(e) => {
              if (e.target.value === "glb") exportGLB();
              else if (e.target.value === "dxf") exportDXF();
              e.target.value = "";
            }}
          >
            <option value="">Export 3D…</option>
            <option value="glb">GLB (mesh)</option>
            <option value="dxf">DXF (lines)</option>
          </select>
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="rounded-md border border-bamboo-300 bg-white px-2.5 py-1.5 text-sm font-medium text-bamboo-800 hover:bg-bamboo-100 disabled:opacity-40"
          >
            Undo
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            className="rounded-md border border-bamboo-300 bg-white px-2.5 py-1.5 text-sm font-medium text-bamboo-800 hover:bg-bamboo-100 disabled:opacity-40"
          >
            Redo
          </button>
          <button
            onClick={reset}
            className="rounded-md border border-bamboo-300 bg-white px-3 py-1.5 text-sm font-medium text-bamboo-800 hover:bg-bamboo-100"
          >
            Reset
          </button>
          <div className="relative">
            <button
              onClick={() => setShowHelp((v) => !v)}
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts"
              className="rounded-md border border-bamboo-300 bg-white px-2.5 py-1.5 text-sm font-medium text-bamboo-800 hover:bg-bamboo-100"
            >
              ⌨
            </button>
            {showHelp && (
              <div className="absolute right-0 z-30 mt-1 w-64 rounded-lg border border-bamboo-200 bg-white p-3 text-xs shadow-lg">
                <div className="mb-1.5 font-semibold text-leaf-800">Keyboard &amp; mouse</div>
                <ul className="space-y-1 text-bamboo-700">
                  <li>Drag a port to a port to <strong>connect</strong></li>
                  <li><strong>Shift-drag</strong> the canvas to box-select</li>
                  <li><strong>Ctrl/⌘ C</strong> / <strong>V</strong> — copy / paste selection</li>
                  <li><strong>Del</strong> / <strong>Backspace</strong> — remove selection</li>
                  <li><strong>Ctrl/⌘ Z</strong> — undo · <strong>Ctrl/⌘ ⇧ Z</strong> — redo</li>
                </ul>
              </div>
            )}
          </div>
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
          {savedToAccount && (
            <a href="/account" className="whitespace-nowrap font-medium text-leaf-700 underline">
              Saved to My designs
            </a>
          )}
        </div>
      )}

      {/* Split: node canvas | (3D view over cut-list) */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1.15fr_1fr]">
        <div className="relative min-h-0 border-r border-bamboo-200">
          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6 text-center">
              <div className="max-w-xs text-sm text-bamboo-500">
                Empty canvas. Use <strong>+ Add node</strong> or pick an <strong>Example</strong> to
                begin, then drag port-to-port to connect.
              </div>
            </div>
          )}
          <ReactFlow
            nodes={rfNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            nodeTypes={nodeTypes}
            fitView
            // Delete / Backspace removes the selected nodes and edges (React Flow ignores
            // the key while a param field is focused, so editing stays safe). Selecting an
            // edge and pressing Delete is the only way to unwire two nodes.
            deleteKeyCode={["Delete", "Backspace"]}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#d9cfb2" gap={18} />
            <Controls />
            <MiniMap pannable zoomable className="!bg-bamboo-50" />
          </ReactFlow>
        </div>

        <div className="grid min-h-0 grid-rows-[1.4fr_1fr]">
          <div className="min-h-0 bg-bamboo-100">
            <ErrorBoundary label="The 3D view hit an error rendering this design.">
              <Viewport3D
                elements={result.scene.elements}
                curves={result.scene.curves}
                points={result.scene.points}
                joints={result.scene.joints}
              />
            </ErrorBoundary>
          </div>
          <div className="min-h-0 border-t border-bamboo-200 bg-white">
            <OutputPanel schedule={result.schedule} checks={result.checks} inventory={result.inventory} />
          </div>
        </div>
      </div>
    </div>
  );
}
