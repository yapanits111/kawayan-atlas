"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import { BahayKuboModel, type ModelParams } from "./BahayKuboModel";

export function StudioCanvas(params: ModelParams) {
  return (
    <Canvas
      shadows
      camera={{ position: [7, 5, 8], fov: 45 }}
      className="rounded-xl"
    >
      <color attach="background" args={["#ece7d8"]} />
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[6, 10, 6]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <BahayKuboModel {...params} />
      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.35}
        scale={20}
        blur={2}
        far={6}
      />
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#d9cfb2" roughness={1} />
      </mesh>
      <gridHelper args={[40, 40, "#c2b184", "#c2b184"]} position={[0, 0, 0]} />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={4}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 2, 0]}
      />
    </Canvas>
  );
}
