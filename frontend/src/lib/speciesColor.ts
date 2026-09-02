/** A distinct warm tone per species, used for glyphs and the 3D studio. */
export const SPECIES_COLOR: Record<string, string> = {
  "kawayan-tinik": "#9a8248",
  bolo: "#ad975f",
  bayog: "#7d683a",
  buho: "#c2b184",
  "kawayan-kiling": "#a9623a",
  "giant-bamboo": "#635130",
};

export function speciesColor(id: string): string {
  return SPECIES_COLOR[id] ?? "#9a8248";
}
