"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";
import { tubeGeometry, stripGeometry, nodeStations, pointAtLength } from "@/lib/design/geometry";
import type { Curve, Element, Joint, Vec3 } from "@/lib/design/types";

const ELEMENT_COLOR: Record<Element["kind"], string> = {
  culm: "#9a8248",
  strip: "#c2b184",
  laminate: "#8c6f3f",
};

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

export function Viewport3D({
  elements,
  curves,
  points,
  joints,
}: {
  elements: Element[];
  curves: Curve[];
  points: Vec3[];
  joints: Joint[];
}) {
  return (
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

      <gridHelper args={[40, 40, "#c2b184", "#d9cfb2"]} />
      <OrbitControls makeDefault enablePan minDistance={1} maxDistance={60} />
    </Canvas>
  );
}
