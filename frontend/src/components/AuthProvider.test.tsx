import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthProvider";

// Mock the API module with an in-memory token store so we can observe what AuthProvider
// persists, and control the network calls.
vi.mock("@/lib/api", () => {
  let stored: string | null = null;
  return {
    getToken: () => stored,
    setToken: (t: string) => {
      stored = t;
    },
    clearToken: () => {
      stored = null;
    },
    api: {
      me: vi.fn(),
      login: vi.fn(),
      register: vi.fn(),
      changePassword: vi.fn(),
      logoutAll: vi.fn(),
    },
  };
});

import * as apiModule from "@/lib/api";
const mockApi = apiModule.api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function Consumer() {
  const { user, loading, login, logout, changePassword, logoutEverywhere } = useAuth();
  return (
    <div>
      <div data-testid="state">{loading ? "loading" : user ? user.email : "anon"}</div>
      <button onClick={() => login("a@b.com", "pw").catch(() => {})}>login</button>
      <button onClick={() => changePassword("old", "new").catch(() => {})}>change</button>
      <button onClick={logout}>logout</button>
      <button onClick={() => logoutEverywhere()}>logoutall</button>
    </div>
  );
}

const renderAuth = () => render(<AuthProvider><Consumer /></AuthProvider>);
const user = (email: string) => ({ id: "u1", email, created_at: "c" });

beforeEach(() => {
  apiModule.clearToken();
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("AuthProvider", () => {
  it("starts logged out when there is no stored token", async () => {
    renderAuth();
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("anon"));
    expect(mockApi.me).not.toHaveBeenCalled();
  });

  it("login stores the token and sets the user", async () => {
    mockApi.login.mockResolvedValue({ access_token: "tk", token_type: "bearer", user: user("a@b.com") });
    renderAuth();
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("anon"));

    fireEvent.click(screen.getByText("login"));
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("a@b.com"));
    expect(apiModule.getToken()).toBe("tk");
  });

  it("logout clears the token and user", async () => {
    mockApi.login.mockResolvedValue({ access_token: "tk", token_type: "bearer", user: user("a@b.com") });
    renderAuth();
    fireEvent.click(screen.getByText("login"));
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("a@b.com"));

    fireEvent.click(screen.getByText("logout"));
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("anon"));
    expect(apiModule.getToken()).toBeNull();
  });

  it("drops a stale token when /me rejects on mount", async () => {
    apiModule.setToken("stale");
    mockApi.me.mockRejectedValue(new Error("401"));
    renderAuth();
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("anon"));
    expect(apiModule.getToken()).toBeNull();
  });

  it("resolves the user from a valid stored token on mount", async () => {
    apiModule.setToken("good");
    mockApi.me.mockResolvedValue(user("stored@b.com"));
    renderAuth();
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("stored@b.com"));
  });

  it("changePassword rotates the stored token", async () => {
    mockApi.login.mockResolvedValue({ access_token: "tk", token_type: "bearer", user: user("a@b.com") });
    mockApi.changePassword.mockResolvedValue({ access_token: "tk2", token_type: "bearer", user: user("a@b.com") });
    renderAuth();
    fireEvent.click(screen.getByText("login"));
    await waitFor(() => expect(apiModule.getToken()).toBe("tk"));

    fireEvent.click(screen.getByText("change"));
    await waitFor(() => expect(apiModule.getToken()).toBe("tk2"));
  });

  it("logoutEverywhere calls the API and clears the session", async () => {
    mockApi.login.mockResolvedValue({ access_token: "tk", token_type: "bearer", user: user("a@b.com") });
    mockApi.logoutAll.mockResolvedValue(undefined);
    renderAuth();
    fireEvent.click(screen.getByText("login"));
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("a@b.com"));

    fireEvent.click(screen.getByText("logoutall"));
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("anon"));
    expect(mockApi.logoutAll).toHaveBeenCalledOnce();
    expect(apiModule.getToken()).toBeNull();
  });
});
