"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { api, ApiError } from "@/lib/api";

// A "My designs" row unifies Design Lab graphs and Studio designs.
type Item = { kind: "graph" | "design"; id: string; title: string | null; updated_at: string };
const keyOf = (i: Item) => `${i.kind}:${i.id}`;
const openHref = (i: Item) => (i.kind === "graph" ? `/design?g=${i.id}` : `/studio?d=${i.id}`);

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
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([api.listMyGraphs(), api.listMyDesigns()])
      .then(([graphs, designs]) => {
        const merged: Item[] = [
          ...graphs.map((g) => ({ kind: "graph" as const, id: g.id, title: g.title, updated_at: g.updated_at })),
          ...designs.map((d) => ({ kind: "design" as const, id: d.id, title: d.title, updated_at: d.updated_at })),
        ].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
        setItems(merged);
        setError(null);
      })
      .catch(() => setError("Could not load your designs. Is the backend running?"));
  }, []);

  useEffect(load, [load]);

  async function rename(item: Item) {
    const next = window.prompt("Rename design:", item.title ?? "Untitled design");
    if (next === null) return;
    setError(null);
    setBusyKey(keyOf(item));
    try {
      if (item.kind === "graph") await api.updateGraph(item.id, { title: next });
      else await api.updateDesign(item.id, { title: next });
      load();
    } catch {
      setError("Could not rename that design.");
    } finally {
      setBusyKey(null);
    }
  }

  async function remove(item: Item) {
    if (!window.confirm(`Delete “${item.title || "Untitled design"}”? This cannot be undone.`)) return;
    setError(null);
    setBusyKey(keyOf(item));
    try {
      if (item.kind === "graph") await api.deleteGraph(item.id);
      else await api.deleteDesign(item.id);
      setItems((xs) => (xs ? xs.filter((x) => keyOf(x) !== keyOf(item)) : xs));
    } catch {
      setError("Could not delete that design.");
    } finally {
      setBusyKey(null);
    }
  }

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
        {error && (
          <div className="mb-3 rounded-md border border-clay-400/40 bg-clay-400/10 px-3 py-2 text-sm text-clay-700">
            {error}
          </div>
        )}
        {items === null ? (
          error ? null : <div className="text-sm text-bamboo-600">Loading…</div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-bamboo-300 bg-bamboo-50 px-4 py-10 text-center text-sm text-bamboo-600">
            No saved designs yet. Save one from the{" "}
            <Link href="/design" className="font-medium text-leaf-700 underline">
              Design Lab
            </Link>{" "}
            or the{" "}
            <Link href="/studio" className="font-medium text-leaf-700 underline">
              Studio
            </Link>{" "}
            while signed in and it will appear here.
          </div>
        ) : (
          <ul className="divide-y divide-bamboo-100 rounded-lg border border-bamboo-200">
            {items.map((item) => {
              const busy = busyKey === keyOf(item);
              return (
                <li key={keyOf(item)} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-leaf-800">{item.title || "Untitled design"}</span>
                      <span className="shrink-0 rounded bg-bamboo-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-bamboo-600">
                        {item.kind === "graph" ? "Design Lab" : "Studio"}
                      </span>
                    </div>
                    <div className="text-xs text-bamboo-500">
                      Updated {new Date(item.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Link
                      href={openHref(item)}
                      className="rounded-md border border-bamboo-300 bg-white px-3 py-1.5 text-sm font-medium text-bamboo-800 hover:bg-bamboo-100"
                    >
                      Open
                    </Link>
                    <button
                      onClick={() => rename(item)}
                      disabled={busy}
                      className="rounded-md border border-bamboo-300 bg-white px-3 py-1.5 text-sm font-medium text-bamboo-800 hover:bg-bamboo-100 disabled:opacity-50"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => remove(item)}
                      disabled={busy}
                      className="rounded-md border border-clay-400/50 bg-white px-3 py-1.5 text-sm font-medium text-clay-700 hover:bg-clay-400/10 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AccountSettings />
    </div>
  );
}

function AccountSettings() {
  const { changePassword: doChangePassword, logout, logoutEverywhere } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      await doChangePassword(current, next);
      setCurrent("");
      setNext("");
      setMsg({ kind: "ok", text: "Password updated. Other devices have been signed out." });
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof ApiError ? err.message : "Could not change your password." });
    } finally {
      setBusy(false);
    }
  }

  async function signOutEverywhere() {
    if (!window.confirm("Sign out on all devices? You'll need to log in again here too.")) return;
    await logoutEverywhere();
  }

  async function deleteAccount() {
    if (
      !window.confirm(
        "Delete your account? Your saved designs will be permanently removed. This cannot be undone.",
      )
    )
      return;
    try {
      await api.deleteAccount();
      logout(); // drops the (now invalid) token and returns to the logged-out view
    } catch {
      setMsg({ kind: "err", text: "Could not delete your account." });
    }
  }

  return (
    <section className="mt-12 border-t border-bamboo-200 pt-8">
      <h2 className="font-display text-lg font-semibold text-leaf-800">Account settings</h2>

      <form onSubmit={changePassword} className="mt-4 max-w-sm space-y-3">
        <div className="text-sm font-medium text-bamboo-800">Change password</div>
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Current password"
          aria-label="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="w-full rounded-md border border-bamboo-300 px-3 py-2 text-sm outline-none focus:border-leaf-500"
        />
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="New password (min 8 characters)"
          aria-label="New password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className="w-full rounded-md border border-bamboo-300 px-3 py-2 text-sm outline-none focus:border-leaf-500"
        />
        {msg && (
          <div className={`text-sm ${msg.kind === "ok" ? "text-leaf-700" : "text-clay-700"}`}>{msg.text}</div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-leaf-600 px-4 py-2 text-sm font-semibold text-white hover:bg-leaf-700 disabled:opacity-60"
        >
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>

      <div className="mt-6 max-w-sm">
        <button
          onClick={signOutEverywhere}
          className="rounded-md border border-bamboo-300 bg-white px-4 py-2 text-sm font-medium text-bamboo-800 hover:bg-bamboo-100"
        >
          Sign out on all devices
        </button>
        <p className="mt-1 text-xs text-bamboo-600">Revokes every active sign-in for your account.</p>
      </div>

      <div className="mt-8 max-w-sm rounded-lg border border-clay-400/40 bg-clay-400/5 p-4">
        <div className="text-sm font-semibold text-clay-700">Danger zone</div>
        <p className="mt-1 text-xs text-bamboo-600">
          Permanently delete your account and all designs saved to it. Anonymous share links you
          created stay available.
        </p>
        <button
          onClick={deleteAccount}
          className="mt-3 rounded-md border border-clay-400/60 bg-white px-4 py-2 text-sm font-semibold text-clay-700 hover:bg-clay-400/10"
        >
          Delete account
        </button>
      </div>
    </section>
  );
}
