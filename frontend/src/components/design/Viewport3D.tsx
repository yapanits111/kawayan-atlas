"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Line, Html } from "@react-three/drei";
import * as THREE from "three";
import { tubeGeometry, stripGeometry, nodeStations, pointAtLength, sub } from "@/lib/design/geometry";
import { roundMm } from "@/lib/design/freehand";
import { dragPlane, dragTo, rayPlane, type DragPlane } from "@/lib/design/drag";
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

/** A Spline node whose control points can be dragged in the 3D view. */
export interface SplineEdit {
  nodeId: string;
  ctrl: Vec3[]; // control points, world
  curve: Vec3[]; // the spline they make
  normal: Vec3 | null; // the plane a flat curve lies in (its points stay in it); null if not flat
}

function ElementMesh({ el }: { el: Element }) {
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

  return (
    <>
      <mesh geometry={geo} castShadow>
        <meshStandardMaterial
          color={ELEMENT_COLOR[el.kind] ?? "#c2b184"}
          roughness={0.7}
          side={THREE.DoubleSide}
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

const v3 = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z];
const noop = () => {};
// r3f's event target stands in for the DOM element and implements pointer capture.
type Capturing = { setPointerCapture(id: number): void; releasePointerCapture(id: number): void };

/** A selected spline's control points as draggable handles. A flat curve's points slide in
 *  its own plane, any other curve's horizontally; Shift moves a point straight up or down.
 *  Handles and the curve draw over the culms they usually sit inside. */
function SplineHandles({
  edit,
  onMove,
  onDragging,
}: {
  edit: SplineEdit;
  onMove: (nodeId: string, index: number, p: Vec3) => void;
  onDragging: (on: boolean) => void;
}) {
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
  const gl = useThree((s) => s.gl);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const drag = useRef<{ index: number; plane: DragPlane; grab: Vec3; start: Vec3; vertical: boolean; at: Vec3 } | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const onDraggingRef = useRef(onDragging);
  onDraggingRef.current = onDragging;

  // Constant on-screen size, however far away the camera is.
  useFrame(({ camera }) => {
    for (const m of meshes.current) if (m) m.scale.setScalar(Math.max(1e-3, camera.position.distanceTo(m.position) * 0.012));
  });

  // Never leave the orbit controls switched off if this unmounts mid-drag.
  useEffect(
    () => () => {
      if (drag.current) {
        drag.current = null;
        if (controls) controls.enabled = true;
        onDraggingRef.current(false);
      }
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
    gl.domElement.style.cursor = "grabbing";
  }

  function move(e: ThreeEvent<PointerEvent>) {
    const d = drag.current;
    if (!d) return;
    e.stopPropagation();
    // Shift pressed or released mid-drag: carry on from where the point is now.
    if (e.shiftKey !== d.vertical) grabFrom(e, d.index, d.at);
    const cur = drag.current!;
    const next = dragTo(v3(e.ray.origin), v3(e.ray.direction), cur.plane, cur.grab, cur.start, cur.vertical);
    if (!next) return;
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
    onDragging(false);
    gl.domElement.style.cursor = hover !== null ? "grab" : "";
  }

  const shown = active !== null ? edit.ctrl[active] : null;
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
          onPointerDown={(e) => down(e, i)}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHover(i);
            if (!drag.current) gl.domElement.style.cursor = "grab";
          }}
          onPointerOut={() => {
            setHover(null);
            if (!drag.current) gl.domElement.style.cursor = "";
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
      {shown && (
        <Html position={shown} center pointerEvents="none" zIndexRange={[20, 10]}>
          <div className="-translate-y-5 whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-bamboo-800 shadow">
            {shown.map((v) => v.toFixed(2)).join(", ")}
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

export function Viewport3D({
  elements,
  curves,
  points,
  joints,
  ghost = null,
  edits = [],
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
  onMovePoint?: (nodeId: string, index: number, p: Vec3) => void;
  onDragging?: (on: boolean) => void;
}) {
  return (
    <div className="relative h-full w-full">
      <Canvas shadows camera={{ position: [6, 5, 7], fov: 45 }}>
        <color attach="background" args={["#ece7d8"]} />
        <ambientLight intensity={0.65} />
        <directionalLight position={[6, 10, 6]} intensity={1.1} castShadow />

        {elements.map((el) => (
          <ElementMesh key={el.id} el={el} />
        ))}

        {/* Guide curves (before they become culms/strips) */}
        {curves.map((c, i) =>
          c.points.length >= 2 ? (
            <Line key={`c${i}`} points={c.points} color="#538343" lineWidth={1.5} />
          ) : null,
        )}

        {/* Guide points */}
        {points.slice(0, 400).map((p, i) => (
          <mesh key={`p${i}`} position={p}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color="#a9623a" />
          </mesh>
        ))}

        {/* Joints */}
        {joints.map((j) => (
          <mesh key={j.id} position={j.position}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshStandardMaterial color="#33291f" />
          </mesh>
        ))}

        {edits.map((e) => (
          <SplineHandles key={e.nodeId} edit={e} onMove={onMovePoint ?? noop} onDragging={onDragging ?? noop} />
        ))}
        {ghost && ghost.outline.length === 4 && <DrawGhost ghost={ghost} />}

        <gridHelper args={[40, 40, "#c2b184", "#d9cfb2"]} />
        <OrbitControls makeDefault enablePan minDistance={1} maxDistance={60} />
      </Canvas>

      {(edits.length > 0 || ghost) && (
        <div className="pointer-events-none absolute bottom-2 left-2 max-w-[calc(100%-1rem)] rounded bg-white/85 px-2 py-1 text-[11px] text-bamboo-700 shadow-sm">
          {ghost
            ? "Drawing plane shown in green; the curve lands where it is drawn."
            : "Drag the orange points to reshape the spline. Hold Shift to move one straight up or down."}
        </div>
      )}
    </div>
  );
}
