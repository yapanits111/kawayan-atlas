"use client";

import { useMemo } from "react";
import * as THREE from "three";

export type RoofType = "gable" | "hip" | "flat";

export interface ModelParams {
  culmRadius: number; // metres
  color: string;
  roof: RoofType;
  bays: number;
}

const UP = new THREE.Vector3(0, 1, 0);

/** A single bamboo culm rendered as a cylinder between two points. */
function Member({
  start,
  end,
  radius,
  color,
}: {
  start: [number, number, number];
  end: [number, number, number];
  radius: number;
  color: string;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const s = new THREE.Vector3(...start);
    const e = new THREE.Vector3(...end);
    const dir = e.clone().sub(s);
    const len = dir.length();
    const mid = s.clone().add(e).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      UP,
      dir.clone().normalize(),
    );
    return { position: mid, quaternion: quat, length: len };
  }, [start, end]);

  return (
    <mesh position={position} quaternion={quaternion} castShadow>
      <cylinderGeometry args={[radius, radius, length, 12]} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  );
}

// Building dimensions (metres).
const WIDTH = 3.6; // across x
const BAY_LEN = 3.0; // along z
const FLOOR_H = 1.5; // stilt height
const WALL_H = 2.2; // floor to top plate
const RIDGE_H = 1.7; // top plate to ridge

export function BahayKuboModel({ culmRadius, color, roof, bays }: ModelParams) {
  const roofColor = "#7d683a"; // bamboo-600, slightly darker for the roof frame
  const r = culmRadius;
  const rr = Math.max(0.025, culmRadius * 0.7); // thinner roof members

  const members = useMemo(() => {
    const hx = WIDTH / 2;
    const length = bays * BAY_LEN;
    const topY = FLOOR_H + WALL_H;
    const ridgeY = topY + (roof === "flat" ? 0 : RIDGE_H);

    // z positions of every frame line (bay boundaries)
    const zs: number[] = [];
    for (let i = 0; i <= bays; i++) zs.push(i * BAY_LEN);

    const list: {
      start: [number, number, number];
      end: [number, number, number];
      radius: number;
      color: string;
    }[] = [];

    // Vertical posts at each corner of every frame line
    for (const z of zs) {
      for (const x of [-hx, hx]) {
        list.push({ start: [x, 0, z], end: [x, topY, z], radius: r, color });
      }
    }

    // Floor beams (perimeter at floor level) + top plates (at post tops)
    for (const y of [FLOOR_H, topY]) {
      // beams running along z on both sides
      for (const x of [-hx, hx]) {
        list.push({ start: [x, y, 0], end: [x, y, length], radius: r, color });
      }
      // cross beams along x at every frame line
      for (const z of zs) {
        list.push({ start: [-hx, y, z], end: [hx, y, z], radius: r, color });
      }
    }

    // Roof
    if (roof === "flat") {
      // simple flat lattice: two length-wise members
      for (const x of [-hx, hx]) {
        list.push({
          start: [x, topY, 0],
          end: [x, topY, length],
          radius: rr,
          color: roofColor,
        });
      }
    } else {
      const ridgeInset = roof === "hip" ? BAY_LEN * 0.5 : 0;
      const ridgeZ0 = ridgeInset;
      const ridgeZ1 = length - ridgeInset;

      // Ridge beam
      list.push({
        start: [0, ridgeY, ridgeZ0],
        end: [0, ridgeY, ridgeZ1],
        radius: rr,
        color: roofColor,
      });

      // Rafters from each top-plate corner up to the ridge
      for (const z of zs) {
        const ridgeZ = Math.min(Math.max(z, ridgeZ0), ridgeZ1);
        for (const x of [-hx, hx]) {
          list.push({
            start: [x, topY, z],
            end: [0, ridgeY, ridgeZ],
            radius: rr,
            color: roofColor,
          });
        }
      }

      // Hip end rafters (from the eave corners to the ridge ends)
      if (roof === "hip") {
        for (const [z, ridgeZ] of [
          [0, ridgeZ0],
          [length, ridgeZ1],
        ] as const) {
          for (const x of [-hx, hx]) {
            list.push({
              start: [x, topY, z],
              end: [0, ridgeY, ridgeZ],
              radius: rr,
              color: roofColor,
            });
          }
        }
      }
    }

    return list;
  }, [r, rr, color, roof, bays]);

  const length = bays * BAY_LEN;

  return (
    <group position={[0, 0, -length / 2]}>
      {/* Floor platform */}
      <mesh position={[0, FLOOR_H, length / 2]} receiveShadow>
        <boxGeometry args={[WIDTH, 0.06, length]} />
        <meshStandardMaterial color="#c2b184" roughness={0.9} />
      </mesh>
      {members.map((m, i) => (
        <Member key={i} {...m} />
      ))}
    </group>
  );
}
