"use client";

import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import * as G from "@/lib/design/geometry";
import { formatPoints, padToWorld, simplify, type Plane, type Pt2 } from "@/lib/design/freehand";
import type { Vec3 } from "@/lib/design/types";
import { ParamSlider } from "./ParamSlider";

// Drawing surface in its own coordinate space; the SVG scales to fit, keeping this aspect.
const W = 560;
const H = 340;

export type Sweep = "none" | "culm" | "strip";

export interface DrawResult {
  pts: string; // the spline node's `pts` text
  smooth: number;
  tension: number;
  closed: "yes" | "no";
  sweep: Sweep;
}

const PLANES: { value: Plane; label: string }[] = [
  { value: "xy", label: "Elevation (XY) · on ground" },
  { value: "xz", label: "Plan (XZ) · top view" },
  { value: "yz", label: "Side (YZ) · on ground" },
];

const path = (pts: number[][]) =>
  pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");

/** Freehand sketch pad: draw a stroke, watch the spline it becomes, then drop it into the
 *  graph as a Spline node — optionally already swept into a culm or strip — or, when
 *  redrawing, replace an existing spline's points. */
export function DrawPad({
  mode,
  wiredInput = false,
  initial,
  onCancel,
  onSubmit,
}: {
  mode: "new" | "redraw";
  wiredInput?: boolean;
  /** When redrawing, start from the node's current spline settings rather than defaults. */
  initial?: { smooth?: number; tension?: number; closed?: string };
  onCancel: () => void;
  onSubmit: (r: DrawResult) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drawing = useRef(false);
  const [stroke, setStroke] = useState<Pt2[]>([]);
  const [plane, setPlane] = useState<Plane>("xy");
  const [size, setSize] = useState(6);
  const [detail, setDetail] = useState(4);
  const finite = (v: number | undefined, fallback: number) => (Number.isFinite(v) ? (v as number) : fallback);
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

  function toPad(e: React.PointerEvent): Pt2 {
    const r = svgRef.current!.getBoundingClientRect();
    const sx = ((e.clientX - r.left) * W) / (r.width || W);
    const sy = ((e.clientY - r.top) * H) / (r.height || H);
    return [Math.min(W, Math.max(0, sx)), Math.min(H, Math.max(0, sy))];
  }
  function down(e: React.PointerEvent<SVGSVGElement>) {
    e.preventDefault();
    drawing.current = true;
    try {
      // Keep receiving moves even if the pen leaves the pad mid-stroke.
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* no capturable pointer (synthetic events) — drawing still works */
    }
    setStroke([toPad(e)]);
  }
  function move(e: React.PointerEvent<SVGSVGElement>) {
    if (!drawing.current) return;
    const p = toPad(e);
    setStroke((s) => {
      const last = s[s.length - 1];
      return last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 1.5 ? s : [...s, p];
    });
  }
  const up = () => {
    drawing.current = false;
  };

  const control = useMemo(() => simplify(stroke, detail), [stroke, detail]);
  const preview = useMemo(
    () =>
      control.length >= 2
        ? G.polyline(control.map(([x, y]) => [x, y, 0] as Vec3), closed, smooth, tension).points
        : [],
    [control, closed, smooth, tension],
  );
  const world = useMemo(
    () => control.map((p) => padToWorld(p, { width: W, height: H, size, plane })),
    [control, size, plane],
  );
  const lengthM = useMemo(
    () => (world.length >= 2 ? G.curveLength(G.polyline(world, closed, smooth, tension)) : 0),
    [world, closed, smooth, tension],
  );

  const ok = control.length >= 2;
  function submit() {
    if (!ok) return;
    onSubmit({
      pts: formatPoints(world),
      smooth,
      tension,
      closed: closed ? "yes" : "no",
      sweep: mode === "new" ? sweep : "none",
    });
  }

  // A metre grid (5 m when zoomed out). Upright planes grid up from the ground line at
  // the bottom; the plan grid is centred.
  const upright = plane !== "xz";
  const pxPerM = W / size;
  const gridPx = (pxPerM < 20 ? 5 : 1) * pxPerM;
  const grid: ReactElement[] = [];
  for (let x = (W / 2) % gridPx; x <= W; x += gridPx)
    grid.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={H} />);
  for (let y = (upright ? H : H / 2) % gridPx; y <= H; y += gridPx)
    grid.push(<line key={`h${y}`} x1={0} y1={y} x2={W} y2={y} />);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Draw a curve freehand"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="max-h-full w-full max-w-4xl overflow-auto rounded-xl bg-white shadow-xl">
        <div className="border-b border-bamboo-100 px-5 py-3">
          <div className="font-display text-lg font-semibold text-leaf-800">
            {mode === "new" ? "Draw a curve" : "Redraw curve"}
          </div>
          <p className="text-xs text-bamboo-600">
            Click and drag to sketch. The stroke is simplified to control points and smoothed
            into a spline you can keep tuning on the node.
          </p>
          {mode === "redraw" && wiredInput && (
            <p className="mt-1 text-xs text-clay-700">
              This spline&apos;s points currently come from a wired input, which overrides the
              drawing until you disconnect it.
            </p>
          )}
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-[1fr_15rem]">
          <div>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              style={{ aspectRatio: `${W} / ${H}` }}
              className="block h-auto w-full cursor-crosshair touch-none rounded-lg border border-bamboo-200 bg-bamboo-50"
              aria-label="Drawing pad"
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              onPointerLeave={up}
            >
              <g stroke="#e6dcc3" strokeWidth={1}>{grid}</g>
              <line
                x1={W / 2} y1={0} x2={W / 2} y2={H}
                stroke="#cbbd96" strokeWidth={1} strokeDasharray="4 4"
              />
              {upright ? (
                <>
                  <line x1={0} y1={H - 1} x2={W} y2={H - 1} stroke="#9a8248" strokeWidth={2} />
                  <text x={6} y={H - 6} fontSize={10} fill="#9a8248">ground</text>
                </>
              ) : (
                <line
                  x1={0} y1={H / 2} x2={W} y2={H / 2}
                  stroke="#cbbd96" strokeWidth={1} strokeDasharray="4 4"
                />
              )}
              {stroke.length === 0 && (
                <text x={W / 2} y={H / 2 - 14} textAnchor="middle" fontSize={14} fill="#a8986f">
                  Click and drag to draw
                </text>
              )}
              {stroke.length > 1 && (
                <path d={path(stroke)} fill="none" stroke="#c9b98a" strokeWidth={1.5} />
              )}
              {preview.length > 1 && (
                <path d={path(preview)} fill="none" stroke="#33522a" strokeWidth={2.5} />
              )}
              {control.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={3.5} fill="#a9623a" />
              ))}
            </svg>
            <div className="mt-1.5 flex justify-between text-xs text-bamboo-600">
              <span>
                {ok
                  ? `${control.length} control points · ${lengthM.toFixed(2)} m long`
                  : "No curve yet"}
              </span>
              <span>pad width = {size} m</span>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <label className="block">
              <span className="text-[10px] text-bamboo-600">plane</span>
              <select
                value={plane}
                onChange={(e) => setPlane(e.target.value as Plane)}
                className="mt-0.5 w-full rounded border border-bamboo-200 px-1.5 py-1"
              >
                {PLANES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </label>
            <ParamSlider label="pad width (m)" value={size} min={1} max={30} step={0.5} onChange={setSize} />
            <ParamSlider label="simplify (px) — lower keeps more points" value={detail} min={0.5} max={20} step={0.5} onChange={setDetail} />
            <ParamSlider label="smoothing" value={smooth} min={0} max={40} step={1} onChange={setSmooth} />
            <ParamSlider label="tension" value={tension} min={0} max={1} step={0.05} onChange={setTension} />
            <label className="flex items-center gap-2 text-bamboo-700">
              <input
                type="checkbox"
                checked={closed}
                onChange={(e) => setClosed(e.target.checked)}
                className="accent-leaf-600"
              />
              closed loop
            </label>
            {mode === "new" && (
              <label className="block">
                <span className="text-[10px] text-bamboo-600">also sweep into</span>
                <select
                  value={sweep}
                  onChange={(e) => setSweep(e.target.value as Sweep)}
                  className="mt-0.5 w-full rounded border border-bamboo-200 px-1.5 py-1"
                >
                  <option value="culm">Culm (round bamboo)</option>
                  <option value="strip">Strip (split bamboo)</option>
                  <option value="none">Nothing — just the curve</option>
                </select>
              </label>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-bamboo-100 px-5 py-3">
          <button
            onClick={() => setStroke([])}
            className="rounded-md border border-bamboo-300 bg-white px-3 py-1.5 text-sm font-medium text-bamboo-800 hover:bg-bamboo-100"
          >
            Clear
          </button>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="rounded-md border border-bamboo-300 bg-white px-3 py-1.5 text-sm font-medium text-bamboo-800 hover:bg-bamboo-100"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!ok}
              className="rounded-md bg-leaf-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-leaf-700 disabled:opacity-50"
            >
              {mode === "new" ? "Create spline node" : "Replace curve"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
