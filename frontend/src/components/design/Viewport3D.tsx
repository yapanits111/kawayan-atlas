"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";
import { tubeGeometry, stripGeometry } from "@/lib/design/geometry";
import type { Curve, Element, Vec3 } from "@/lib/design/types";

function ElementMesh({ el }: { el: Element }) {
  const geo = useMemo(() => {
    if (el.kind === "culm") {
      const r0 = (el.startDiameter ?? 80) / 2000;
      const r1 = (el.endDiameter ?? 70) / 2000;
      return tubeGeometry(el.curve, r0, r1, 10);
    }
    return stripGeometry(el.curve, (el.width ?? 25) / 1000, (el.thickness ?? 6) / 1000);
  }, [el]);

  return (
    <mesh geometry={geo} castShadow>
      <meshStandardMaterial
        color={el.kind === "culm" ? "#9a8248" : "#c2b184"}
        roughness={0.7}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function Viewport3D({
  elements,
  curves,
  points,
}: {
  elements: Element[];
  curves: Curve[];
  points: Vec3[];
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

      <gridHelper args={[40, 40, "#c2b184", "#d9cfb2"]} />
      <OrbitControls makeDefault enablePan minDistance={1} maxDistance={60} />
    </Canvas>
  );
}
