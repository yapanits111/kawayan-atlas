/**
 * Typed API client for the Kawayan Atlas backend.
 * Base URL is configurable so the same build points at localhost in dev and the
 * deployed FastAPI app in production.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8020";

export interface Species {
  id: string;
  name_local: string;
  name_scientific: string;
  region: string;
  density: string;
  culm_diam_range: string;
  wall_thickness_range: string;
  treatment_methods: string[];
  structural_role: string[];
  description: string;
  image_url: string | null;
  sources: string[];
}

export interface Joint {
  id: string;
  name: string;
  description: string;
  applicable_species: string[];
  applicable_culm_sizes: string;
  load_notes: string;
  failure_mode: string;
  media_url: string | null;
  sources: string[];
}

export interface TemplateComponent {
  type: string;
  species_id?: string;
  joint_id?: string;
  count?: number;
  notes?: string;
}

export interface BomItem {
  item: string;
  qty: number | string;
  unit: string;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  version: string;
  components: TemplateComponent[];
  default_bom: BomItem[];
  known_span_range: string;
  hero_image: string | null;
}

export interface Design {
  id: string;
  based_on_template_id: string | null;
  based_on_template_version: string | null;
  components: Record<string, unknown>[];
  params: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Error that preserves the HTTP status, so callers can tell 404 from a backend outage. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new ApiError(res.status, `API ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listSpecies: (params?: { region?: string; role?: string; q?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v) as [string, string][],
    ).toString();
    return getJSON<Species[]>(`/api/species${qs ? `?${qs}` : ""}`);
  },
  getSpecies: (id: string) => getJSON<Species>(`/api/species/${id}`),
  listJoints: (params?: { species_id?: string; q?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v) as [string, string][],
    ).toString();
    return getJSON<Joint[]>(`/api/joints${qs ? `?${qs}` : ""}`);
  },
  getJoint: (id: string) => getJSON<Joint>(`/api/joints/${id}`),
  listTemplates: () => getJSON<Template[]>(`/api/templates`),
  getTemplate: (id: string) => getJSON<Template>(`/api/templates/${id}`),
  createDesign: (body: {
    based_on_template_id?: string;
    components?: Record<string, unknown>[];
    params?: Record<string, unknown>;
  }) => postJSON<Design>(`/api/designs`, body),
  getDesign: (id: string) => getJSON<Design>(`/api/designs/${id}`),
  calculateSingleMember: (body: {
    species_id: string;
    diameter_mm: number;
    wall_thickness_mm: number;
    span_m: number;
    spacing_m?: number;
  }) => postJSON<CalcResult>(`/api/calculator/single-member`, body),
};

export interface CalcResult {
  enabled: boolean;
  disclaimer: string;
  axial_capacity_kn: number | null;
  bending_capacity_knm: number | null;
  safety_factor: number | null;
  flags: string[];
}
