"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Line, Html } from "@react-three/drei";
import * as THREE from "three";
import { tubeGeometry, stripGeometry, nodeStations, pointAtLength, sub } from "@/lib/design/geometry";
import { roundMm } from "@/lib/design/freehand";
import {
  DEFAULT_SNAP,
  dragPlane,
  dragTo,
  nearestTarget,
  rayPlane,
  snapHeight,
  snapInPlane,
  type DragPlane,
  type SnapSettings,
  type SnapTarget,
} from "@/lib/design/drag";
import type { Curve, Element, Joint, Vec3 } from "@/lib/design/types";
import type { DrawPreview } from "./DrawPad";

const ELEMENT_COLOR: Record<Element["kind"], string> = {
  culm: "#9a8248",
  strip: "#c2b184",
  laminate: "#8c6f3f",
};

// Editing colours, matching the draw pad: clay control points, a deep-green curve.
const HANDLE = "#a9623a";
const HANDLE_HOVER = "#c07a4a";
const ACTIVE = "#33522a";
// Geometry that belongs to the selected node(s), and the one member that was clicked.
const SELECTED = "#4f8a3a";
const FOCUS = "#8fd46a";
// How close (px) a dragged point must come to a target to snap onto it.
const SNAP_PX = 12;

/** Something clicked in the 3D view. */
export type Pick =
  | { kind: "element"; id: string }
  | { kind: "curve"; index: number }
  | { kind: "point"; index: number }
  | { kind: "joint"; id: string };
type OnPick = (pick: Pick | null, additive: boolean) => void;

/** A Spline node whose control points can be dragged in the 3D view. */
export interface SplineEdit {
  nodeId: string;
  ctrl: Vec3[]; // control points, world
  curve: Vec3[]; // the spline they make
  normal: Vec3 | null; // the plane a flat curve lies in (its points stay in it); null if not flat
  targets: SnapTarget[]; // what its points can snap to — never geometry built from this spline
}

const v3 = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z];
const noop = () => {};
// r3f's event target stands in for the DOM element and implements pointer capture.
type Capturing = { setPointerCapture(id: number): void; releasePointerCapture(id: number): void };

/** The cursor for whatever is under the pointer: a control point wins, then anything clickable.
 *  Left alone mid-drag. */
function syncCursor(e: ThreeEvent<PointerEvent>, el: HTMLElement) {
  if (el.dataset.dragging) return;
  const tags = e.intersections.map((h) => h.object.userData?.pick);
  el.style.cursor = tags.includes("handle") ? "grab" : tags.some(Boolean) ? "pointer" : "";
}

/** Click handling for anything pickable: skips the click that ends an orbit drag, and clicks
 *  meant for a control point drawn over it. */
function pickOn(onPick: OnPick | undefined, pick: Pick) {
  return (e: ThreeEvent<MouseEvent>) => {
    if (!onPick || e.delta > 2 || e.intersections.some((h) => h.object.userData?.pick === "handle")) return;
    e.stopPropagation();
    onPick(pick, e.shiftKey);
  };
}

function ElementMesh({
  el,
  highlighted,
  focused,
  onPick,
}: {
  el: Element;
  highlighted: boolean;
  focused: boolean;
  onPick?: OnPick;
}) {
  const gl = useThree((s) => s.gl);
  const [hover, setHover] = useState(false);
  const geo = useMemo(() => {
    if (el.kind === "culm") {
      const r0 = (el.startDiameter ?? 80) / 2000;
      const r1 = (el.endDiameter ?? 70) / 2000;
      return tubeGeometry(el.curve, r0, r1, 10);
    }
    // A laminate sweeps like a strip, only deeper — plies × ply thickness.
    return stripGeometry(el.curve, (el.width ?? 25) / 1000, (el.thickness ?? 6) / 1000);
  }, [el]);
  // Every re-evaluation (a slider, a dragged point) builds fresh geometry; free the old one.
  useEffect(() => () => geo.dispose(), [geo]);

  // Diaphragms drawn on the culm — the node data the cut-list reports (§8).
  const nodeRings = useMemo(() => {
    if (el.kind !== "culm" || !el.nodeSpacing || el.nodeSpacing <= 0) return [];
    const d0 = el.startDiameter ?? 80;
    const d1 = el.endDiameter ?? 70;
    return nodeStations(el.curve, el.nodeSpacing).map((s) => {
      const t = el.length > 0 ? s / el.length : 0;
      return { at: pointAtLength(el.curve, s), r: (d0 + (d1 - d0) * t) / 2000 };
    });
  }, [el]);

  const lit = focused ? 0.85 : highlighted ? 0.55 : hover && onPick ? 0.3 : 0;
  return (
    <>
      <mesh
        geometry={geo}
        castShadow
        userData={{ pick: onPick ? "element" : null }}
        onClick={pickOn(onPick, { kind: "element", id: el.id })}
        onPointerOver={(e) => {
          setHover(true);
          syncCursor(e, gl.domElement);
        }}
        onPointerOut={(e) => {
          setHover(false);
          syncCursor(e, gl.domElement);
        }}
      >
        <meshStandardMaterial
          color={ELEMENT_COLOR[el.kind] ?? "#c2b184"}
          roughness={0.7}
          side={THREE.DoubleSide}
          emissive={focused ? FOCUS : highlighted ? SELECTED : "#6b5a2a"}
          emissiveIntensity={lit}
        />
      </mesh>
      {nodeRings.map((n, i) => (
        <mesh key={`${el.id}n${i}`} position={n.at}>
          <sphereGeometry args={[n.r * 1.1, 10, 6]} />
          <meshStandardMaterial color="#6d5a2e" roughness={0.85} />
        </mesh>
      ))}
    </>
  );
}

/** Guide curves, points and joints — each clickable to select the node that made it. */
function Guides({
  curves,
  points,
  joints,
  highlightCurves,
  onPick,
}: {
  curves: Curve[];
  points: Vec3[];
  joints: Joint[];
  highlightCurves: Set<number>;
  onPick?: OnPick;
}) {
  const gl = useThree((s) => s.gl);
  const hover = (e: ThreeEvent<PointerEvent>) => syncCursor(e, gl.domElement);
  const tag = (kind: string) => ({ pick: onPick ? kind : null });
  return (
    <>
      {curves.map((c, i) =>
        c.points.length >= 2 ? (
          <Line
            key={`c${i}`}
            points={c.points}
            color={highlightCurves.has(i) ? SELECTED : "#538343"}
            lineWidth={highlightCurves.has(i) ? 3 : 1.5}
            userData={tag("curve")}
            onClick={pickOn(onPick, { kind: "curve", index: i })}
            onPointerOver={hover}
            onPointerOut={hover}
          />
        ) : null,
      )}
      {points.slice(0, 400).map((p, i) => (
        <mesh
          key={`p${i}`}
          position={p}
          userData={tag("point")}
          onClick={pickOn(onPick, { kind: "point", index: i })}
          onPointerOver={hover}
          onPointerOut={hover}
        >
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color="#a9623a" />
        </mesh>
      ))}
      {joints.map((j) => (
        <mesh
          key={j.id}
          position={j.position}
          userData={tag("joint")}
          onClick={pickOn(onPick, { kind: "joint", id: j.id })}
          onPointerOver={hover}
          onPointerOut={hover}
        >
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial color="#33291f" />
        </mesh>
      ))}
    </>
  );
}

/** A selected spline's control points as draggable handles. A flat curve's points slide in
 *  its own plane, any other curve's horizontally; Shift moves a point straight up or down.
 *  With snapping on, a point lands on a nearby member end, joint or control point (marked with
 *  a ring), or else on the grid. Handles and the curve draw over the culms they sit inside. */
function SplineHandles({
  edit,
  snap,
  onMove,
  onDragging,
}: {
  edit: SplineEdit;
  snap: SnapSettings;
  onMove: (nodeId: string, index: number, p: Vec3) => void;
  onDragging: (on: boolean) => void;
}) {
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const ring = useRef<THREE.Mesh>(null);
  const drag = useRef<{ index: number; plane: DragPlane; grab: Vec3; start: Vec3; vertical: boolean; at: Vec3 } | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [snapped, setSnapped] = useState<SnapTarget | null>(null);
  const onDraggingRef = useRef(onDragging);
  onDraggingRef.current = onDragging;

  // Constant on-screen size, however far away the camera is.
  useFrame(({ camera }) => {
    for (const m of [...meshes.current, ring.current])
      if (m) m.scale.setScalar(Math.max(1e-3, camera.position.distanceTo(m.position) * 0.012));
  });

  // Never leave the orbit controls switched off if this unmounts mid-drag.
  useEffect(
    () => () => {
      if (drag.current) {
        drag.current = null;
        if (controls) controls.enabled = true;
        onDraggingRef.current(false);
      }
      delete gl.domElement.dataset.dragging;
      gl.domElement.style.cursor = "";
    },
    [controls, gl],
  );

  function grabFrom(e: ThreeEvent<PointerEvent>, index: number, from: Vec3) {
    const vertical = e.shiftKey;
    const plane = dragPlane(from, edit.normal, vertical, v3(e.camera.getWorldDirection(new THREE.Vector3())));
    const hit = rayPlane(v3(e.ray.origin), v3(e.ray.direction), plane);
    drag.current = { index, plane, grab: hit ? sub(from, hit) : [0, 0, 0], start: from, vertical, at: from };
  }

  function down(e: ThreeEvent<PointerEvent>, index: number) {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.target as unknown as Capturing).setPointerCapture(e.pointerId);
    if (controls) controls.enabled = false;
    grabFrom(e, index, edit.ctrl[index]);
    setActive(index);
    onDragging(true);
    gl.domElement.dataset.dragging = "1";
    gl.domElement.style.cursor = "grabbing";
  }

  function move(e: ThreeEvent<PointerEvent>) {
    const d = drag.current;
    if (!d) return;
    e.stopPropagation();
    // Shift pressed or released mid-drag: carry on from where the point is now.
    if (e.shiftKey !== d.vertical) grabFrom(e, d.index, d.at);
    const cur = drag.current!;
    let next = dragTo(v3(e.ray.origin), v3(e.ray.direction), cur.plane, cur.grab, cur.start, cur.vertical);
    if (!next) return;

    // Snap: onto a nearby point first (not for straight up/down moves), else to the grid.
    let target: SnapTarget | null = null;
    if (snap.points && !cur.vertical) {
      const camera = e.camera;
      const toScreen = (p: Vec3): [number, number] | null => {
        const inView = new THREE.Vector3(...p).applyMatrix4(camera.matrixWorldInverse);
        if (inView.z > -camera.near) return null; // behind the camera
        const ndc = new THREE.Vector3(...p).project(camera);
        return [((ndc.x + 1) / 2) * size.width, ((1 - ndc.y) / 2) * size.height];
      };
      const own = edit.ctrl.flatMap((p, k) => (k === cur.index ? [] : [{ p, label: `point ${k + 1}` }]));
      target = nearestTarget(next, [...edit.targets, ...own], toScreen, SNAP_PX);
    }
    if (target) next = target.p;
    else if (snap.grid) next = cur.vertical ? snapHeight(next, snap.step) : snapInPlane(next, cur.plane.normal, snap.step);
    setSnapped(target);
    cur.at = roundMm(next);
    onMove(edit.nodeId, cur.index, cur.at);
  }

  function end(e: ThreeEvent<PointerEvent>) {
    if (!drag.current) return;
    e.stopPropagation();
    (e.target as unknown as Capturing).releasePointerCapture(e.pointerId);
    drag.current = null;
    if (controls) controls.enabled = true;
    setActive(null);
    setSnapped(null);
    onDragging(false);
    delete gl.domElement.dataset.dragging;
    gl.domElement.style.cursor = hover !== null ? "grab" : "";
  }

  const shown = active !== null ? edit.ctrl[active] : null;
  const tag = snapped ? ` → ${snapped.label}` : snap.grid ? ` · grid ${snap.step} m` : "";
  return (
    <group>
      {edit.curve.length > 1 && (
        <Line points={edit.curve} color={ACTIVE} lineWidth={3} depthTest={false} renderOrder={5} />
      )}
      {edit.ctrl.length > 1 && (
        <Line
          points={edit.ctrl}
          color={HANDLE}
          lineWidth={1}
          dashed
          dashSize={0.12}
          gapSize={0.08}
          depthTest={false}
          renderOrder={5}
        />
      )}
      {edit.ctrl.map((p, i) => (
        <mesh
          key={i}
          ref={(m) => {
            meshes.current[i] = m;
          }}
          position={p}
          renderOrder={6}
          userData={{ pick: "handle" }}
          onPointerDown={(e) => down(e, i)}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerOver={(e) => {
            setHover(i);
            syncCursor(e, gl.domElement);
          }}
          onPointerOut={(e) => {
            setHover(null);
            syncCursor(e, gl.domElement);
          }}
        >
          <sphereGeometry args={[1, 16, 12]} />
          <meshBasicMaterial
            color={i === active ? ACTIVE : i === hover ? HANDLE_HOVER : HANDLE}
            depthTest={false}
            transparent
          />
        </mesh>
      ))}
      {snapped && (
        <mesh ref={ring} position={snapped.p} renderOrder={7}>
          <sphereGeometry args={[1.9, 20, 14]} />
          <meshBasicMaterial color={SELECTED} transparent opacity={0.35} depthTest={false} />
        </mesh>
      )}
      {shown && (
        <Html position={shown} center pointerEvents="none" zIndexRange={[20, 10]}>
          <div className="-translate-y-5 whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-bamboo-800 shadow">
            {shown.map((v) => v.toFixed(2)).join(", ")}
            {tag && <span className="text-leaf-700">{tag}</span>}
          </div>
        </Html>
      )}
    </group>
  );
}

/** The draw pad's plane and curve, placed in the model while the pad is open. */
function DrawGhost({ ghost }: { ghost: DrawPreview }) {
  const quad = useMemo(() => {
    const [a, b, c, d] = ghost.outline;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
    return geo;
  }, [ghost.outline]);
  useEffect(() => () => quad.dispose(), [quad]);

  return (
    <group>
      <mesh geometry={quad} renderOrder={2}>
        <meshBasicMaterial color="#538343" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Line points={[...ghost.outline, ghost.outline[0]]} color="#538343" lineWidth={1.5} />
      {ghost.base && <Line points={ghost.base} color="#9a8248" lineWidth={3} />}
      {ghost.curve.length > 1 && (
        <Line points={ghost.curve} color={ACTIVE} lineWidth={3.5} depthTest={false} renderOrder={5} />
      )}
      {ghost.ctrl.map((p, i) => (
        <mesh key={i} position={p} renderOrder={6}>
          <sphereGeometry args={[0.06, 12, 8]} />
          <meshBasicMaterial color={HANDLE} depthTest={false} transparent />
        </mesh>
      ))}
    </group>
  );
}

const NO_HIGHLIGHT = { elements: new Set<string>(), curves: new Set<number>() };

export function Viewport3D({
  elements,
  curves,
  points,
  joints,
  ghost = null,
  edits = [],
  snap = DEFAULT_SNAP,
  highlight = NO_HIGHLIGHT,
  focus = null,
  onPick,
  onMovePoint,
  onDragging,
}: {
  elements: Element[];
  curves: Curve[];
  points: Vec3[];
  joints: Joint[];
  /** The draw pad's live plane and curve, while it is open. */
  ghost?: DrawPreview | null;
  /** Selected splines whose control points can be dragged. */
  edits?: SplineEdit[];
  snap?: SnapSettings;
  /** Members and curves to tint: what the selected node(s) produce. */
  highlight?: { elements: Set<string>; curves: Set<number> };
  /** The member that was clicked, marked brighter than the rest of its node's output. */
  focus?: string | null;
  /** Something (or, with null, empty space) was clicked. Omit to make the model unclickable. */
  onPick?: OnPick;
  onMovePoint?: (nodeId: string, index: number, p: Vec3) => void;
  onDragging?: (on: boolean) => void;
}) {
  const hint = ghost
    ? "Drawing plane shown in green; the curve lands where it is drawn."
    : edits.length
      ? "Drag the orange points to reshape the spline. Hold Shift to move one straight up or down."
      : onPick && (elements.length || curves.length)
        ? "Click a member or curve to select its node."
        : null;
  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        camera={{ position: [6, 5, 7], fov: 45 }}
        // Thin lines are hard to hit exactly; accept clicks within a few pixels of them.
        raycaster={{ params: { Line2: { threshold: 8 } } as unknown as THREE.RaycasterParameters }}
        onPointerMissed={(e) => {
          if (e.button === 0) onPick?.(null, e.shiftKey);
        }}
      >
        <color attach="background" args={["#ece7d8"]} />
        <ambientLight intensity={0.65} />
        <directionalLight position={[6, 10, 6]} intensity={1.1} castShadow />

        {elements.map((el) => (
          <ElementMesh
            key={el.id}
            el={el}
            highlighted={highlight.elements.has(el.id)}
            focused={el.id === focus}
            onPick={onPick}
          />
        ))}
        <Guides curves={curves} points={points} joints={joints} highlightCurves={highlight.curves} onPick={onPick} />

        {edits.map((e) => (
          <SplineHandles
            key={e.nodeId}
            edit={e}
            snap={snap}
            onMove={onMovePoint ?? noop}
            onDragging={onDragging ?? noop}
          />
        ))}
        {ghost && ghost.outline.length === 4 && <DrawGhost ghost={ghost} />}

        <gridHelper args={[40, 40, "#c2b184", "#d9cfb2"]} />
        <OrbitControls makeDefault enablePan minDistance={1} maxDistance={60} />
      </Canvas>

      {hint && (
        <div className="pointer-events-none absolute bottom-2 left-2 max-w-[calc(100%-1rem)] rounded bg-white/85 px-2 py-1 text-[11px] text-bamboo-700 shadow-sm">
          {hint}
        </div>
      )}
    </div>
  );
}
