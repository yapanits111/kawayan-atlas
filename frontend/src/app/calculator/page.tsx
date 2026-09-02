"use client";

import { useEffect, useState } from "react";
import { api, type Species, type CalcResult } from "@/lib/api";

export default function CalculatorPage() {
  const [species, setSpecies] = useState<Species[]>([]);
  const [speciesId, setSpeciesId] = useState("kawayan-tinik");
  const [diameter, setDiameter] = useState(90);
  const [wall, setWall] = useState(15);
  const [span, setSpan] = useState(3.5);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.listSpecies().then(setSpecies).catch(() => {});
  }, []);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    try {
      const r = await api.calculateSingleMember({
        species_id: speciesId,
        diameter_mm: diameter,
        wall_thickness_mm: wall,
        span_m: span,
      });
      setResult(r);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-3xl font-bold text-leaf-900">
        Single-Member Calculator
      </h1>
      <p className="mt-2 text-bamboo-800">
        A quick capacity check for one bamboo member. This is an exploration aid, not an
        engineered calculation.
      </p>

      {/* Persistent, prominent disclaimer — required (PLAN.md 3F, 7). */}
      <div className="mt-5 rounded-lg border border-clay-400/50 bg-clay-400/10 p-4 text-sm text-bamboo-900">
        <strong className="font-semibold">Estimate only — not a stamped calculation.</strong>{" "}
        Outputs do not replace a licensed structural engineer or the LGU building-permit
        process, and must be verified by a qualified professional before construction.
      </div>

      <form onSubmit={run} className="mt-8 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col text-sm sm:col-span-2">
          <span className="mb-1 font-medium text-bamboo-700">Species</span>
          <select
            value={speciesId}
            onChange={(e) => setSpeciesId(e.target.value)}
            className="rounded-md border border-bamboo-300 bg-white px-3 py-2"
          >
            {species.map((s) => (
              <option key={s.id} value={s.id}>{s.name_local}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          <span className="mb-1 font-medium text-bamboo-700">Culm diameter (mm)</span>
          <input type="number" value={diameter} min={20} onChange={(e) => setDiameter(+e.target.value)}
            className="rounded-md border border-bamboo-300 bg-white px-3 py-2" />
        </label>
        <label className="flex flex-col text-sm">
          <span className="mb-1 font-medium text-bamboo-700">Wall thickness (mm)</span>
          <input type="number" value={wall} min={1} onChange={(e) => setWall(+e.target.value)}
            className="rounded-md border border-bamboo-300 bg-white px-3 py-2" />
        </label>
        <label className="flex flex-col text-sm sm:col-span-2">
          <span className="mb-1 font-medium text-bamboo-700">Span (m)</span>
          <input type="number" step="0.1" value={span} min={0.5} onChange={(e) => setSpan(+e.target.value)}
            className="rounded-md border border-bamboo-300 bg-white px-3 py-2" />
        </label>
        <button type="submit" disabled={loading}
          className="rounded-lg bg-leaf-600 px-5 py-2.5 font-semibold text-white hover:bg-leaf-700 disabled:opacity-60 sm:col-span-2">
          {loading ? "Checking…" : "Check member"}
        </button>
      </form>

      {error && (
        <p className="mt-6 rounded-lg border border-clay-400/40 bg-clay-400/10 p-4 text-sm">
          Couldn&apos;t reach the calculator API. Make sure the backend is running.
        </p>
      )}

      {result && !result.enabled && (
        <div className="mt-6 rounded-xl border border-bamboo-300 bg-bamboo-100 p-6">
          <h2 className="font-display text-lg font-semibold text-bamboo-800">
            🔒 Calculator under engineer review
          </h2>
          <p className="mt-2 text-sm text-bamboo-800">
            The numeric rules are intentionally disabled until a licensed structural
            engineer (SME) reviews and signs off on them — so no capacity figures are shown
            yet. This gate is deliberate; see the project plan.
          </p>
          <p className="mt-3 border-t border-bamboo-300 pt-3 text-xs text-bamboo-600">
            {result.disclaimer}
          </p>
        </div>
      )}

      {result && result.enabled && (
        <div className="mt-6 rounded-xl border border-leaf-200 bg-leaf-50 p-6">
          <h2 className="font-display text-lg font-semibold text-leaf-800">Result</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-bamboo-600">Axial capacity</dt>
              <dd className="text-lg font-semibold">{result.axial_capacity_kn ?? "—"} kN</dd>
            </div>
            <div>
              <dt className="text-xs text-bamboo-600">Bending capacity</dt>
              <dd className="text-lg font-semibold">{result.bending_capacity_knm ?? "—"} kN·m</dd>
            </div>
            <div>
              <dt className="text-xs text-bamboo-600">Safety factor</dt>
              <dd className="text-lg font-semibold">{result.safety_factor ?? "—"}</dd>
            </div>
          </dl>
          {result.flags.length > 0 && (
            <ul className="mt-4 list-inside list-disc text-sm text-bamboo-800">
              {result.flags.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          )}
          <p className="mt-3 border-t border-leaf-200 pt-3 text-xs text-bamboo-600">
            {result.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}
