import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, ApiError, getToken, setToken, clearToken } from "./api";

const BASE = "http://127.0.0.1:8020";
const fetchMock = vi.fn();

beforeEach(() => {
  // In-memory localStorage (node has none) and a controllable fetch.
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

const jsonRes = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body });
const noContentRes = (ok = true, status = 204) => ({
  ok,
  status,
  json: async () => {
    throw new Error("no body");
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lastCall(): { url: string; init: any } {
  const calls = fetchMock.mock.calls;
  const [url, init] = calls[calls.length - 1];
  return { url, init: init ?? {} };
}

describe("token storage", () => {
  it("round-trips and clears", () => {
    expect(getToken()).toBeNull();
    setToken("abc123");
    expect(getToken()).toBe("abc123");
    clearToken();
    expect(getToken()).toBeNull();
  });

  it("returns null instead of throwing when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
    });
    expect(getToken()).toBeNull();
  });
});

describe("auth headers", () => {
  it("attaches a bearer token when one is stored", async () => {
    setToken("tok123");
    fetchMock.mockResolvedValue(jsonRes({ id: "u1", email: "a@b.com", created_at: "c" }));
    await api.me();
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE}/api/auth/me`);
    expect(init.headers.Authorization).toBe("Bearer tok123");
  });

  it("omits the header when no token is stored", async () => {
    fetchMock.mockResolvedValue(jsonRes([]));
    await api.listMyGraphs();
    expect(lastCall().init.headers.Authorization).toBeUndefined();
  });
});

describe("responses", () => {
  it("returns parsed JSON on success", async () => {
    fetchMock.mockResolvedValue(jsonRes([{ id: "g1", title: "T", created_at: "c", updated_at: "u" }]));
    const res = await api.listMyGraphs();
    expect(res[0].id).toBe("g1");
  });

  it("throws ApiError carrying the FastAPI detail + status", async () => {
    fetchMock.mockResolvedValue(jsonRes({ detail: "An account with that email already exists" }, false, 409));
    try {
      await api.register("a@b.com", "password123");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(409);
      expect((e as ApiError).message).toContain("already exists");
    }
  });

  it("falls back to a generic message when the error body has no detail", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    });
    try {
      await api.me();
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as ApiError).status).toBe(500);
      expect((e as ApiError).message).toContain("failed: 500");
    }
  });
});

describe("graph methods", () => {
  it("createGraph posts {data, title:null} by default", async () => {
    fetchMock.mockResolvedValue(jsonRes({ id: "g", data: { nodes: [], edges: [] }, created_at: "c", updated_at: "u" }));
    await api.createGraph({ nodes: [], edges: [] });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE}/api/graphs`);
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ data: { nodes: [], edges: [] }, title: null });
  });

  it("createGraph forwards a title", async () => {
    fetchMock.mockResolvedValue(jsonRes({ id: "g", data: { nodes: [], edges: [] }, created_at: "c", updated_at: "u" }));
    await api.createGraph({ nodes: [], edges: [] }, "My design");
    expect(JSON.parse(lastCall().init.body).title).toBe("My design");
  });

  it("updateGraph PATCHes the given id with the patch body", async () => {
    fetchMock.mockResolvedValue(jsonRes({ id: "g1", data: { nodes: [], edges: [] }, created_at: "c", updated_at: "u" }));
    await api.updateGraph("g1", { title: "Renamed" });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE}/api/graphs/g1`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ title: "Renamed" });
  });

  it("deleteGraph DELETEs with no body or content-type", async () => {
    fetchMock.mockResolvedValue(noContentRes());
    await api.deleteGraph("g1");
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE}/api/graphs/g1`);
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
    expect(init.headers["Content-Type"]).toBeUndefined();
  });
});

describe("auth methods", () => {
  it("login posts the credentials verbatim and returns the token payload", async () => {
    fetchMock.mockResolvedValue(
      jsonRes({ access_token: "tk", token_type: "bearer", user: { id: "u", email: "a@b.com", created_at: "c" } }),
    );
    const res = await api.login("A@B.com", "pw");
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE}/api/auth/login`);
    expect(JSON.parse(init.body)).toEqual({ email: "A@B.com", password: "pw" });
    expect(res.access_token).toBe("tk");
  });

  it("changePassword posts to change-password with auth + body", async () => {
    setToken("t");
    fetchMock.mockResolvedValue(noContentRes());
    await api.changePassword("old", "newpassword1");
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE}/api/auth/change-password`);
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers.Authorization).toBe("Bearer t");
    expect(JSON.parse(init.body)).toEqual({ current_password: "old", new_password: "newpassword1" });
  });

  it("deleteAccount DELETEs /api/auth/me", async () => {
    setToken("t");
    fetchMock.mockResolvedValue(noContentRes());
    await api.deleteAccount();
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE}/api/auth/me`);
    expect(init.method).toBe("DELETE");
    expect(init.headers.Authorization).toBe("Bearer t");
  });
});
