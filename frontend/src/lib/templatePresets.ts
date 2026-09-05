import type { RoofType, BracingType } from "@/components/studio/BahayKuboModel";

/**
 * Approximate starting parameters for opening a template in the parametric studio.
 * The studio models a simplified bamboo frame, so these are honest approximations of
 * each template's scale and character — a starting point to adjust, not an exact model.
 */
export interface TemplatePreset {
  name: string;
  speciesId: string;
  roof: RoofType;
  bays: number;
  width: number;
  bayLength: number;
  floorHeight: number;
  wallHeight: number;
  roofPitch: number;
  bracing: BracingType;
  door: boolean;
}

export const TEMPLATE_PRESETS: Record<string, TemplatePreset> = {
  "bahay-kubo-traditional": {
    name: "Bahay Kubo (Traditional)",
    speciesId: "kawayan-tinik",
    roof: "gable",
    bays: 1,
    width: 3.5,
    bayLength: 3.0,
    floorHeight: 1.6,
    wallHeight: 2.2,
    roofPitch: 1.9,
    bracing: "none",
    door: true,
  },
  "modern-single-room": {
    name: "Modern Single-Room Dwelling",
    speciesId: "giant-bamboo",
    roof: "hip",
    bays: 1,
    width: 4.5,
    bayLength: 3.5,
    floorHeight: 0.6,
    wallHeight: 2.6,
    roofPitch: 1.2,
    bracing: "knee",
    door: true,
  },
  "event-pavilion": {
    name: "Multi-Bay Event Pavilion",
    speciesId: "giant-bamboo",
    roof: "gable",
    bays: 3,
    width: 6.0,
    bayLength: 3.0,
    floorHeight: 0.3,
    wallHeight: 3.0,
    roofPitch: 2.2,
    bracing: "knee",
    door: false,
  },
  "core-shelter-elevated": {
    name: "Disaster-Resilient Core Shelter",
    speciesId: "giant-bamboo",
    roof: "hip",
    bays: 2,
    width: 3.5,
    bayLength: 3.0,
    floorHeight: 1.8,
    wallHeight: 2.2,
    roofPitch: 1.5,
    bracing: "cross",
    door: true,
  },
};
