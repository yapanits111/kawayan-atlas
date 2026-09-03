"use client";

import { useMemo } from "react";
import * as THREE from "three";

export type RoofType = "gable" | "hip" | "flat";

export interface ModelParams {
  culmRadius: number; // metres
  color: string;
  roof: RoofType;
  bays: number;
  width: number; // m, across x
  bayLength: number; // m, per bay along z
  floorHeight: number; // m, stilt height
  wallHeight: number; // m, floor to top plate
  roofPitch: number; // m, ridge height above the top plate
}

export interface MemberSpec {
  start: [number, number, number];
  end: [number, number, number];
  radius: number;
  color: string;
}

export interface StructureStats {
  footprintWidth: number;
  footprintLength: number;
  totalHeight: number;
  roofAngleDeg: number;
  postCount: number;
  memberCount: number;
  totalCulmLengthM: number;
  estimatedCulms: number; // total length / usable culm length
}

const UP = new THREE.Vector3(0, 1, 0);
const USABLE_CULM_M = 6; // typical usable straight length per harvested culm

/** Pure geometry: given parameters, produce every culm member plus a live takeoff.
 *  Shared by the 3D component (to render) and the studio UI (to show stats). */
export function computeStructure(p: ModelParams): {
  members: MemberSpec[];
  stats: StructureStats;
  length: number;
} {
  const roofColor = "#7d683a";
  const r = p.culmRadius;
  const rr = Math.max(0.025, p.culmRadius * 0.7); // thinner roof members
  const hx = p.width / 2;
  const length = p.bays * p.bayLength;
  const topY = p.floorHeight + p.wallHeight;
  const ridgeY = topY + (p.roof === "flat" ? 0 : p.roofPitch);

  const zs: number[] = [];
  for (let i = 0; i <= p.bays; i++) zs.push(i * p.bayLength);

  const members: MemberSpec[] = [];
  const add = (
    start: [number, number, number],
    end: [number, number, number],
    radius: number,
    color: string,
  ) => members.push({ start, end, radius, color });

  // Vertical posts at each corner of every frame line
  for (const z of zs) {
    for (const x of [-hx, hx]) add([x, 0, z], [x, topY, z], r, p.color);
  }
  const postCount = zs.length * 2;

  // Floor beams (perimeter at floor level) + top plates (at post tops)
  for (const y of [p.floorHeight, topY]) {
    for (const x of [-hx, hx]) add([x, y, 0], [x, y, length], r, p.color);
    for (const z of zs) add([-hx, y, z], [hx, y, z], r, p.color);
  }

  // Roof
  if (p.roof === "flat") {
    for (const x of [-hx, hx]) add([x, topY, 0], [x, topY, length], rr, roofColor);
  } else {
    const ridgeInset = p.roof === "hip" ? p.bayLength * 0.5 : 0;
    const ridgeZ0 = ridgeInset;
    const ridgeZ1 = length - ridgeInset;
    add([0, ridgeY, ridgeZ0], [0, ridgeY, ridgeZ1], rr, roofColor);
    for (const z of zs) {
      const ridgeZ = Math.min(Math.max(z, ridgeZ0), ridgeZ1);
      for (const x of [-hx, hx]) add([x, topY, z], [0, ridgeY, ridgeZ], rr, roofColor);
    }
    if (p.roof === "hip") {
      for (const [z, ridgeZ] of [
        [0, ridgeZ0],
        [length, ridgeZ1],
      ] as const) {
        for (const x of [-hx, hx]) add([x, topY, z], [0, ridgeY, ridgeZ], rr, roofColor);
      }
    }
  }

  // Takeoff: total length of all members
  let totalCulmLengthM = 0;
  for (const m of members) {
    const dx = m.end[0] - m.start[0];
    const dy = m.end[1] - m.start[1];
    const dz = m.end[2] - m.start[2];
    totalCulmLengthM += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  const roofAngleDeg =
    p.roof === "flat" ? 0 : (Math.atan2(p.roofPitch, hx) * 180) / Math.PI;

  const stats: StructureStats = {
    footprintWidth: p.width,
    footprintLength: length,
    totalHeight: ridgeY,
    roofAngleDeg,
    postCount,
    memberCount: members.length,
    totalCulmLengthM,
    estimatedCulms: Math.ceil(totalCulmLengthM / USABLE_CULM_M),
  };

  return { members, stats, length };
}

/** A single bamboo culm rendered as a cylinder between two points. */
function Member({ start, end, radius, color }: MemberSpec) {
  const { position, quaternion, len } = useMemo(() => {
    const s = new THREE.Vector3(...start);
    const e = new THREE.Vector3(...end);
    const dir = e.clone().sub(s);
    const l = dir.length();
    const mid = s.clone().add(e).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
    return { position: mid, quaternion: quat, len: l };
  }, [start, end]);

  return (
    <mesh position={position} quaternion={quaternion} castShadow>
      <cylinderGeometry args={[radius, radius, len, 12]} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  );
}

export function BahayKuboModel(params: ModelParams) {
  const { members, length } = useMemo(() => computeStructure(params), [params]);

  return (
    <group position={[0, 0, -length / 2]}>
      {/* Floor platform */}
      <mesh position={[0, params.floorHeight, length / 2]} receiveShadow>
        <boxGeometry args={[params.width, 0.06, length]} />
        <meshStandardMaterial color="#c2b184" roughness={0.9} />
      </mesh>
      {members.map((m, i) => (
        <Member key={i} {...m} />
      ))}
    </group>
  );
}
