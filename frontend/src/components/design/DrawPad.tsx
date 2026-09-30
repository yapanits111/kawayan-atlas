"use client";

import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import * as G from "@/lib/design/geometry";
import {
  axisLabel,
  fitToPad,
  formatPoints,
  insertionIndex,
  isFlat,
  matchPreset,
  padOutline,
  padToPlane,
  planeFrame,
  planeToPad,
  planeToWorld,
  presetPlane,
  PLANE_PRESETS,
  roundMm,
  simplify,
  type DrawPlane,
  type PadView,
  type PlanePreset,
  type Pt2,
} from "@/lib/design/freehand";
import type { Vec3 } from "@/lib/design/types";
import { IconHandles, IconPencil } from "@/components/icons";
import { ParamSlider } from "./ParamSlider";

// Drawing surface in its own coordinate space; the SVG scales to fit, keeping this aspect.
const W = 560;
const H = 340;
// A double-click this close to the curve (pad px) adds a point on it; further out extends it.
const HIT_PX = 12;

export type Sweep = "none" | "culm" | "strip";

export interface DrawResult {
  pts: string; // the spline node's `pts` text
  smooth: number;
  tension: number;
  closed: "yes" | "no";
  sweep: Sweep;
}

/** What the 3D view shows while the pad is open: the plane's extent and the curve on it. */
export interface DrawPreview {
  outline: Vec3[]; // the pad's corners on its plane
  base: [Vec3, Vec3] | null; // the edge a pitched plane stands on
  curve: Vec3[]; // the spline, sampled
  ctrl: Vec3[]; // its control points
  result: DrawResult | null; // what Create / Apply would write; null until there is a curve
  dirty: boolean; // something has changed since the pad opened
}

const PRESETS: { value: PlanePreset; label: string; title: string }[] = [
  { value: "xy", label: "Elevation", title: "Upright, facing +z — the XY plane" },
  { value: "xz", label: "Plan", title: "Flat, seen from above — the XZ plane" },
  { value: "yz", label: "Side", title: "Upright, facing −x — the YZ plane" },
];

const path = (pts: Pt2[]) =>
  pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");

const finite = (v: number | undefined, fallback: number) => (Number.isFinite(v) ? (v as number) : fallback);

function ToolButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${
        active ? "bg-leaf-600 text-white" : "text-bamboo-700 hover:bg-bamboo-100"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

/** The sketch pad: draw a stroke or place and drag points on any plane, watch the spline they
 *  make, then drop it into the graph as a Spline node (optionally already swept into a culm or
 *  strip) — or, opened on an existing spline, edit its points where they lie. */
export function DrawPad({
  mode,
  wiredInput = false,
  initial,
  onPreview,
  onCancel,
  onSubmit,
}: {
  mode: "new" | "edit";
  wiredInput?: boolean;
  /** When editing, the spline's current points and settings. */
  initial?: { pts?: Vec3[]; smooth?: number; tension?: number; closed?: string };
  /** Called with the live curve and plane, for the 3D view (and live editing). */
  onPreview?: (p: DrawPreview) => void;
  onCancel: () => void;
  onSubmit: (r: DrawResult) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  // A stroke only replaces the curve once the pointer actually moves, so a stray click can't
  // wipe it; a dragged point keeps the offset it was grabbed at.
  const drag = useRef<
    | { kind: "stroke"; start: Pt2; started: boolean }
    | { kind: "point"; index: number; grab: Pt2 }
    | null
  >(null);

  // An existing spline loads onto the plane it lies in, zoomed to fit.
  const [loaded] = useState(() => (initial?.pts && initial.pts.length >= 2 ? fitToPad(initial.pts, H / W) : null));
  const [plane, setPlane] = useState<DrawPlane>(() => loaded?.plane ?? presetPlane("xy"));
  const [size, setSize] = useState(() => loaded?.size ?? 6);
  // Control points in plane coordinates (a right, b up, c out of the pad). A fresh stroke keeps
  // its raw samples so the simplify slider can re-thin it; editing a point makes the list explicit.
  const [ctrl, setCtrl] = useState<Vec3[]>(() => loaded?.pts ?? []);
  const [stroke, setStroke] = useState<{ pts: Pt2[]; eps: number } | null>(null);
  const [tool, setTool] = useState<"draw" | "edit">(loaded ? "edit" : "draw");
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState(4);
  const [smooth, setSmooth] = useState(() => finite(initial?.smooth, 12));
  const [tension, setTension] = useState(() => finite(initial?.tension, 0));
  const [closed, setClosed] = useState(() => initial?.closed === "yes");
  const [sweep, setSweep] = useState<Sweep>("culm");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const flat = isFlat(plane);
  const view: PadView = useMemo(() => ({ width: W, height: H, size, flat }), [size, flat]);
  const frame = useMemo(() => planeFrame(plane), [plane]);

  const control = useMemo<Vec3[]>(
    () => (stroke ? simplify(stroke.pts, detail * stroke.eps).map(([a, b]) => [a, b, 0] as Vec3) : ctrl),
    [stroke, detail, ctrl],
  );
  const ok = control.length >= 2;
  // The spline in plane coordinates: projected, it draws on the pad; placed, it is the 3D curve.
  const spline = useMemo(
    () => (ok ? G.polyline(control, closed, smooth, tension).points : []),
    [ok, control, closed, smooth, tension],
  );
  const worldCtrl = useMemo(() => control.map((q) => roundMm(planeToWorld(q, frame))), [control, frame]);
  const worldCurve = useMemo(() => spline.map((q) => planeToWorld(q, frame)), [spline, frame]);
  const lengthM = ok ? G.curveLength({ points: spline }) : 0;

  const result = useMemo<DrawResult | null>(
    () =>
      ok
        ? {
            pts: formatPoints(worldCtrl, mode === "edit" ? "edited on the draw pad" : "drawn freehand"),
            smooth,
            tension,
            closed: closed ? "yes" : "no",
            sweep: mode === "new" ? sweep : "none",
          }
        : null,
    [ok, worldCtrl, mode, smooth, tension, closed, sweep],
  );

  // Once anything changes, the pad stays "dirty" — so live edits keep flowing even if a
  // setting is later put back the way it was.
  const resultKey = result ? JSON.stringify(result) : "";
  const initialKey = useRef(resultKey);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (resultKey !== initialKey.current) setDirty(true);
  }, [resultKey]);

  const outline = useMemo(() => padOutline(view, frame), [view, frame]);
  const base = useMemo<[Vec3, Vec3] | null>(
    () => (flat ? null : [planeToWorld([-size / 2, 0, 0], frame), planeToWorld([size / 2, 0, 0], frame)]),
    [flat, size, frame],
  );
  useEffect(() => {
    onPreview?.({ outline, base, curve: worldCurve, ctrl: worldCtrl, result, dirty });
  }, [onPreview, outline, base, worldCurve, worldCtrl, result, dirty]);

  // --- pointer & keyboard editing ---

  function toPad(e: { clientX: number; clientY: number }): Pt2 {
    const r = svgRef.current!.getBoundingClientRect();
    const sx = ((e.clientX - r.left) * W) / (r.width || W);
    const sy = ((e.clientY - r.top) * H) / (r.height || H);
    return [Math.min(W, Math.max(0, sx)), Math.min(H, Math.max(0, sy))];
  }
  const handleAt = (t: EventTarget) => {
    const el = (t as Element).closest?.("[data-handle]");
    return el ? Number(el.getAttribute("data-handle")) : null;
  };
  /** The explicit control list, taking over from a fresh stroke the first time a point is edited. */
  function bake(): Vec3[] {
    if (stroke) {
      setStroke(null);
      setCtrl(control);
    }
    return control;
  }
  function removePoint(i: number, pts: Vec3[]) {
    if (pts.length <= 2) return; // a spline needs two points
    setCtrl(pts.filter((_, k) => k !== i));
    setSelected(null);
  }

  function down(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    svgRef.current?.focus();
    const idx = handleAt(e.target);
    const [a, b] = padToPlane(toPad(e), view);
    if (tool === "edit" && idx !== null) {
      const q = bake()[idx];
      setSelected(idx);
      drag.current = { kind: "point", index: idx, grab: [q[0] - a, q[1] - b] };
    } else if (tool === "draw") {
      setSelected(null);
      drag.current = { kind: "stroke", start: [a, b], started: false };
    } else {
      setSelected(null);
      return;
    }
    try {
      // Keep receiving moves even if the pen leaves the pad mid-stroke.
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* no capturable pointer (synthetic events) — drawing still works */
    }
  }
  function move(e: React.PointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d) return;
    const [a, b] = padToPlane(toPad(e), view);
    if (d.kind === "stroke") {
      const minStep = 1.5 * (size / W);
      if (!d.started) {
        if (Math.hypot(a - d.start[0], b - d.start[1]) < minStep) return;
        d.started = true;
        setCtrl([]);
        setStroke({ pts: [d.start, [a, b]], eps: size / W });
        return;
      }
      setStroke((s) => {
        if (!s) return s;
        const last = s.pts[s.pts.length - 1];
        return Math.hypot(a - last[0], b - last[1]) < minStep ? s : { ...s, pts: [...s.pts, [a, b]] };
      });
    } else {
      const snap = (v: number) => (e.shiftKey ? Math.round(v * 10) / 10 : v);
      const na = snap(a + d.grab[0]), nb = snap(b + d.grab[1]);
      setCtrl((c) => c.map((q, i) => (i === d.index ? [na, nb, q[2]] : q)));
    }
  }
  const up = () => {
    drag.current = null;
  };

  function doubleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (tool !== "edit") return;
    const pts = bake();
    const idx = handleAt(e.target);
    if (idx !== null) {
      removePoint(idx, pts);
      return;
    }
    const at = padToPlane(toPad(e), view);
    const hit = insertionIndex(pts, closed, smooth, tension, at);
    let index = hit.index;
    if (!closed && hit.distance * (W / size) > HIT_PX && pts.length) {
      // Well away from the curve: extend it from the nearer end.
      const d0 = Math.hypot(at[0] - pts[0][0], at[1] - pts[0][1]);
      const d1 = Math.hypot(at[0] - pts[pts.length - 1][0], at[1] - pts[pts.length - 1][1]);
      index = d0 < d1 ? 0 : pts.length;
    }
    // A new point sits at its neighbours' average depth off the plane (0 on a flat curve).
    const prev = pts[index - 1];
    const next = index < pts.length ? pts[index] : closed ? pts[0] : undefined;
    const nb = [prev, next].filter((q): q is Vec3 => !!q);
    const c = nb.length ? nb.reduce((s, q) => s + q[2], 0) / nb.length : 0;
    setCtrl([...pts.slice(0, index), [at[0], at[1], c], ...pts.slice(index)]);
    setSelected(index);
  }

  function keyDown(e: React.KeyboardEvent<SVGSVGElement>) {
    if (tool !== "edit" || selected === null || selected >= control.length) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      removePoint(selected, bake());
      return;
    }
    const step = e.shiftKey ? 0.25 : 0.05;
    const nudge: Record<string, Pt2> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const d = nudge[e.key];
    if (!d) return;
    e.preventDefault();
    setCtrl(bake().map((q, i) => (i === selected ? [q[0] + d[0], q[1] + d[1], q[2]] : q)));
  }

  function clear() {
    setStroke(null);
    setCtrl([]);
    setSelected(null);
  }

  function submit() {
    if (!result) return;
    if (mode === "edit" && !dirty) onCancel(); // nothing to apply
    else onSubmit(result);
  }

  // --- drawing the pad ---

  const pxPerM = W / size;
  const gridM = pxPerM > 200 ? 0.25 : pxPerM > 110 ? 0.5 : pxPerM >= 20 ? 1 : 5;
  const padM = (size * H) / W; // metres the pad spans vertically
  const bLo = flat ? -padM / 2 : 0;
  const grid: ReactElement[] = [];
  for (let i = Math.ceil(-size / 2 / gridM - 1e-9); i * gridM <= size / 2 + 1e-9; i++) {
    const x = planeToPad([i * gridM, 0], view)[0];
    grid.push(<line key={`v${i}`} x1={x} y1={0} x2={x} y2={H} />);
  }
  for (let j = Math.ceil(bLo / gridM - 1e-9); j * gridM <= bLo + padM + 1e-9; j++) {
    const y = planeToPad([0, j * gridM], view)[1];
    grid.push(<line key={`h${j}`} x1={0} y1={y} x2={W} y2={y} />);
  }
  const [ox, oy] = planeToPad([0, 0], view);
  const toPx = (q: Vec3 | Pt2) => planeToPad(q, view);
  const oyM = plane.origin[1];
  const baseLabel = oyM === 0 ? "ground" : `base · y ${oyM.toFixed(2)} m`;
  const preset = matchPreset(plane);
  const setOrigin = (i: number, v: number) =>
    setPlane((p) => {
      const o = [...p.origin] as Vec3;
      o[i] = v;
      return { ...p, origin: o };
    });
  const sel = selected !== null && selected < worldCtrl.length ? worldCtrl[selected] : null;
  const title = mode === "new" ? "Draw a curve" : "Edit curve";

  return (
    <div role="dialog" aria-label={title} className="fixed inset-0 z-50 flex flex-col bg-white lg:absolute lg:z-20">
      <div className="flex items-center justify-between gap-4 border-b border-bamboo-100 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-semibold leading-tight text-leaf-800">{title}</div>
          <p className="text-xs text-bamboo-600">
            {mode === "new"
              ? "Sketch on any plane; it becomes a Spline node you can keep editing."
              : "Drag, add or remove points, move the plane, or redraw. The model follows live."}
          </p>
        </div>
        <div role="group" aria-label="Tool" className="flex shrink-0 gap-0.5 rounded-md border border-bamboo-200 p-0.5">
          <ToolButton active={tool === "draw"} onClick={() => setTool("draw")} icon={<IconPencil className="h-3.5 w-3.5" />}>
            Draw
          </ToolButton>
          <ToolButton active={tool === "edit"} onClick={() => setTool("edit")} icon={<IconHandles className="h-3.5 w-3.5" />}>
            Edit points
          </ToolButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        {mode === "edit" && wiredInput && (
          <p className="mx-auto mb-2 max-w-[900px] rounded bg-clay-400/10 px-2 py-1 text-xs text-clay-600">
            This spline&apos;s points come from a wired input, which overrides what you edit here
            until you disconnect it.
          </p>
        )}
        {/* The pad shrinks on short screens so every control below stays in view. */}
        <div className="mx-auto" style={{ maxWidth: `min(900px, max(360px, calc((100vh - 30rem) * ${W} / ${H})))` }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            style={{ aspectRatio: `${W} / ${H}` }}
            tabIndex={0}
            className={`block h-auto w-full touch-none rounded-lg border border-bamboo-200 bg-bamboo-50 outline-none focus-visible:ring-2 focus-visible:ring-leaf-400 ${
              tool === "draw" ? "cursor-crosshair" : "cursor-default"
            }`}
            aria-label="Drawing pad"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onPointerLeave={up}
            onDoubleClick={doubleClick}
            onKeyDown={keyDown}
          >
            <g stroke="#e6dcc3" strokeWidth={1} pointerEvents="none">{grid}</g>
            <g pointerEvents="none">
              <line x1={ox} y1={0} x2={ox} y2={H} stroke="#cbbd96" strokeWidth={1} strokeDasharray="4 4" />
              {flat ? (
                <>
                  <line x1={0} y1={oy} x2={W} y2={oy} stroke="#cbbd96" strokeWidth={1} strokeDasharray="4 4" />
                  <text x={6} y={H - 6} fontSize={10} fill="#9a8248">plan · y {oyM.toFixed(2)} m</text>
                </>
              ) : (
                <>
                  <line x1={0} y1={H - 1} x2={W} y2={H - 1} stroke="#9a8248" strokeWidth={2} />
                  <text x={6} y={H - 6} fontSize={10} fill="#9a8248">{baseLabel}</text>
                </>
              )}
              <text x={W - 6} y={14} fontSize={10} fill="#ad975f" textAnchor="end">grid {gridM} m</text>
              {control.length === 0 && !stroke && (
                <text x={W / 2} y={H / 2 - 14} textAnchor="middle" fontSize={14} fill="#a8986f">
                  {tool === "draw" ? "Click and drag to draw" : "Double-click to place points"}
                </text>
              )}
              {stroke && stroke.pts.length > 1 && (
                <path d={path(stroke.pts.map(toPx))} fill="none" stroke="#c9b98a" strokeWidth={1.5} />
              )}
              {tool === "edit" && control.length > 1 && (
                <path
                  d={path([...control, ...(closed ? [control[0]] : [])].map(toPx))}
                  fill="none"
                  stroke="#c9a27a"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              )}
              {spline.length > 1 && <path d={path(spline.map(toPx))} fill="none" stroke="#33522a" strokeWidth={2.5} />}
            </g>
            {control.map((q, i) => {
              const [x, y] = toPx(q);
              const isSel = i === selected;
              return (
                <g key={i} data-handle={i}>
                  {tool === "edit" && (
                    <circle cx={x} cy={y} r={11} fill="transparent" className="cursor-grab" aria-label={`Point ${i + 1}`} />
                  )}
                  <circle
                    cx={x}
                    cy={y}
                    r={isSel ? 5.5 : tool === "edit" ? 4.5 : 3.5}
                    fill={isSel ? "#33522a" : "#a9623a"}
                    stroke="#fff"
                    strokeWidth={tool === "edit" ? 1.5 : 0}
                    pointerEvents="none"
                  />
                </g>
              );
            })}
          </svg>

          <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs text-bamboo-600">
            <span>
              {ok ? `${control.length} control points · ${lengthM.toFixed(2)} m long` : "No curve yet"}
              {loaded && !loaded.planar && " · not flat: each point keeps its depth"}
            </span>
            <span className="tabular-nums">
              {sel
                ? `Point ${selected! + 1}: x ${sel[0].toFixed(2)} · y ${sel[1].toFixed(2)} · z ${sel[2].toFixed(2)}`
                : `right ${axisLabel(frame.u)} · up ${axisLabel(frame.v)}`}
            </span>
          </div>
        </div>
        <div className="mx-auto max-w-[900px]">
          <p className="mt-0.5 text-[11px] text-bamboo-500">
            {tool === "draw"
              ? "Click and drag to sketch. A new stroke replaces the curve; switch to Edit points to fine-tune it."
              : "Drag a point to move it (Shift snaps to 10 cm). Double-click the curve to add a point, beyond an end to extend it, or on a point to remove it. Arrow keys nudge the selected point; Delete removes it."}
          </p>

          <div className="mt-3 grid gap-x-5 gap-y-4 text-xs sm:grid-cols-2 xl:grid-cols-3">
            <section aria-label="Drawing plane" className="space-y-1.5">
              {/* The presets drop under the heading when the column is narrow. */}
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-bamboo-500">Plane</span>
                <div className="flex items-center gap-1">
                  {PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      title={p.title}
                      aria-pressed={preset === p.value}
                      onClick={() => setPlane((pl) => ({ ...pl, ...PLANE_PRESETS[p.value] }))}
                      className={`rounded border px-1.5 py-0.5 text-[11px] ${
                        preset === p.value
                          ? "border-leaf-600 bg-leaf-600 text-white"
                          : "border-bamboo-200 text-bamboo-700 hover:bg-bamboo-100"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                  {!preset && <span className="text-[11px] font-medium text-clay-600">custom</span>}
                </div>
              </div>
              <ParamSlider label="turn (°) — about the vertical" value={plane.turn} min={-180} max={180} step={1}
                onChange={(v) => setPlane((p) => ({ ...p, turn: v }))} />
              <ParamSlider label="pitch (°) — 0 flat, 90 upright" value={plane.pitch} min={0} max={90} step={1}
                onChange={(v) => setPlane((p) => ({ ...p, pitch: v }))} />
              <ParamSlider label="view width (m)" value={size} min={1} max={50} step={0.5} onChange={setSize} />
            </section>

            <section aria-label="Plane position" className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-bamboo-500">Origin</span>
              <ParamSlider label="origin x (m)" value={plane.origin[0]} min={-20} max={20} step={0.05} onChange={(v) => setOrigin(0, v)} />
              <ParamSlider label="origin y (m)" value={plane.origin[1]} min={-20} max={20} step={0.05} onChange={(v) => setOrigin(1, v)} />
              <ParamSlider label="origin z (m)" value={plane.origin[2]} min={-20} max={20} step={0.05} onChange={(v) => setOrigin(2, v)} />
            </section>

            <section aria-label="Curve" className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-bamboo-500">Curve</span>
                <label className="flex items-center gap-1.5 text-[11px] text-bamboo-700">
                  <input
                    type="checkbox"
                    checked={closed}
                    onChange={(e) => setClosed(e.target.checked)}
                    className="accent-leaf-600"
                  />
                  closed loop
                </label>
              </div>
              <ParamSlider
                label="simplify (px) — lower keeps more"
                value={detail}
                min={0.5}
                max={20}
                step={0.5}
                onChange={setDetail}
                disabled={!stroke}
              />
              <ParamSlider label="smoothing" value={smooth} min={0} max={40} step={1} onChange={setSmooth} />
              <ParamSlider label="tension" value={tension} min={0} max={1} step={0.05} onChange={setTension} />
            </section>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-bamboo-100 px-4 py-2.5">
        <button
          type="button"
          onClick={clear}
          className="rounded-md border border-bamboo-300 bg-white px-3 py-1.5 text-sm font-medium text-bamboo-800 hover:bg-bamboo-100"
        >
          Clear
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {mode === "new" && (
            <label className="flex items-center gap-1.5 text-xs text-bamboo-600">
              also sweep into
              <select
                value={sweep}
                onChange={(e) => setSweep(e.target.value as Sweep)}
                className="rounded border border-bamboo-200 px-1.5 py-1 text-xs text-bamboo-800"
              >
                <option value="culm">Culm (round bamboo)</option>
                <option value="strip">Strip (split bamboo)</option>
                <option value="none">Nothing — just the curve</option>
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-bamboo-300 bg-white px-3 py-1.5 text-sm font-medium text-bamboo-800 hover:bg-bamboo-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!ok}
            className="rounded-md bg-leaf-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-leaf-700 disabled:opacity-50"
          >
            {mode === "new" ? "Create spline node" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
