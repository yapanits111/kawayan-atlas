"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { api, ApiError, type GraphSummary } from "@/lib/api";

export default function AccountPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="mx-auto max-w-md px-5 py-16 text-center text-bamboo-600">Loading…</div>;
  }
  return user ? <MyDesigns /> : <AuthForm />;
}

function AuthForm() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "register") await register(email, password);
      else await login(email, password);
      // On success the AuthProvider state flips and AccountPage re-renders to My designs.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <h1 className="font-display text-2xl font-semibold text-leaf-800">
        {mode === "login" ? "Log in" : "Create an account"}
      </h1>
      <p className="mt-1 text-sm text-bamboo-600">
        Save your Design Lab graphs to a personal gallery you can reopen from anywhere.
      </p>

      <div className="mt-5 flex gap-1 rounded-lg bg-bamboo-100 p-1 text-sm">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
              mode === m ? "bg-white text-leaf-800 shadow-sm" : "text-bamboo-700"
            }`}
          >
            {m === "login" ? "Log in" : "Sign up"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-bamboo-800">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-bamboo-300 px-3 py-2 text-sm outline-none focus:border-leaf-500"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-bamboo-800">Password</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-bamboo-300 px-3 py-2 text-sm outline-none focus:border-leaf-500"
          />
          {mode === "register" && (
            <span className="mt-1 block text-xs text-bamboo-500">At least 8 characters.</span>
          )}
        </label>

        {error && (
          <div className="rounded-md border border-clay-400/40 bg-clay-400/10 px-3 py-2 text-sm text-clay-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-leaf-600 px-4 py-2.5 font-semibold text-white transition hover:bg-leaf-700 disabled:opacity-60"
        >
          {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>
    </div>
  );
}

function MyDesigns() {
  const { user, logout } = useAuth();
  const [graphs, setGraphs] = useState<GraphSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listMyGraphs()
      .then(setGraphs)
      .catch(() => setError("Could not load your designs. Is the backend running?"));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-leaf-800">My designs</h1>
          <p className="mt-1 text-sm text-bamboo-600">Signed in as {user?.email}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/design"
            className="rounded-md bg-leaf-600 px-3 py-2 text-sm font-semibold text-white hover:bg-leaf-700"
          >
            Open Design Lab
          </Link>
          <button
            onClick={logout}
            className="rounded-md border border-bamboo-300 bg-white px-3 py-2 text-sm font-medium text-bamboo-800 hover:bg-bamboo-100"
          >
            Log out
          </button>
        </div>
      </div>

      <div className="mt-6">
        {error ? (
          <div className="rounded-md border border-clay-400/40 bg-clay-400/10 px-3 py-2 text-sm text-clay-700">
            {error}
          </div>
        ) : graphs === null ? (
          <div className="text-sm text-bamboo-600">Loading…</div>
        ) : graphs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-bamboo-300 bg-bamboo-50 px-4 py-10 text-center text-sm text-bamboo-600">
            No saved designs yet. Open the{" "}
            <Link href="/design" className="font-medium text-leaf-700 underline">
              Design Lab
            </Link>{" "}
            and use <strong>Save &amp; share</strong> to keep one here.
          </div>
        ) : (
          <ul className="divide-y divide-bamboo-100 rounded-lg border border-bamboo-200">
            {graphs.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-leaf-800">{g.title || "Untitled design"}</div>
                  <div className="text-xs text-bamboo-500">
                    Updated {new Date(g.updated_at).toLocaleDateString()}
                  </div>
                </div>
                <Link
                  href={`/design?g=${g.id}`}
                  className="shrink-0 rounded-md border border-bamboo-300 bg-white px-3 py-1.5 text-sm font-medium text-bamboo-800 hover:bg-bamboo-100"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
