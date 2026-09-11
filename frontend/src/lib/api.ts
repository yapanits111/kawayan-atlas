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

export interface GraphDoc {
  id: string;
  data: { nodes: unknown[]; edges: unknown[] };
  owner_id?: string | null;
  title?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GraphSummary {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

// --- auth token storage (per-browser; guarded for SSR / private mode) ---
const TOKEN_KEY = "kawayan-auth-token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}
export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Pull FastAPI's `{detail: "..."}` message out of an error response, if present. */
async function errorMessage(res: Response, path: string): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.detail === "string") return body.detail;
  } catch {
    /* fall through */
  }
  return `API ${path} failed: ${res.status}`;
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store", headers: authHeaders() });
  if (!res.ok) {
    throw new ApiError(res.status, await errorMessage(res, path));
  }
  return res.json() as Promise<T>;
}

async function sendJSON<T>(method: "POST" | "PATCH", path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new ApiError(res.status, await errorMessage(res, path));
  }
  return res.json() as Promise<T>;
}

const postJSON = <T>(path: string, body: unknown) => sendJSON<T>("POST", path, body);
const patchJSON = <T>(path: string, body: unknown) => sendJSON<T>("PATCH", path, body);

/** For endpoints that return 204 No Content (delete, change-password). */
async function sendNoBody(method: "POST" | "DELETE", path: string, body?: unknown): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new ApiError(res.status, await errorMessage(res, path));
  }
}
const del = (path: string) => sendNoBody("DELETE", path);

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
  createGraph: (data: { nodes: unknown[]; edges: unknown[] }, title?: string | null) =>
    postJSON<GraphDoc>(`/api/graphs`, { data, title: title ?? null }),
  getGraph: (id: string) => getJSON<GraphDoc>(`/api/graphs/${id}`),
  updateGraph: (id: string, patch: { title?: string; data?: { nodes: unknown[]; edges: unknown[] } }) =>
    patchJSON<GraphDoc>(`/api/graphs/${id}`, patch),
  deleteGraph: (id: string) => del(`/api/graphs/${id}`),
  // Accounts (Release 2)
  register: (email: string, password: string) =>
    postJSON<TokenResponse>(`/api/auth/register`, { email, password }),
  login: (email: string, password: string) =>
    postJSON<TokenResponse>(`/api/auth/login`, { email, password }),
  me: () => getJSON<AuthUser>(`/api/auth/me`),
  changePassword: (current_password: string, new_password: string) =>
    postJSON<TokenResponse>(`/api/auth/change-password`, { current_password, new_password }),
  logoutAll: () => sendNoBody("POST", `/api/auth/logout-all`),
  deleteAccount: () => sendNoBody("DELETE", `/api/auth/me`),
  listMyGraphs: () => getJSON<GraphSummary[]>(`/api/graphs/mine`),
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
