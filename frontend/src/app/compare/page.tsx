"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, type Species } from "@/lib/api";
import { SpeciesGlyph } from "@/components/SpeciesGlyph";
import { speciesColor } from "@/lib/speciesColor";
import { ApiUnavailable } from "@/components/ApiUnavailable";

const ROWS: { label: string; get: (s: Species) => string }[] = [
  { label: "Scientific name", get: (s) => s.name_scientific },
  { label: "Region", get: (s) => s.region },
  { label: "Density", get: (s) => s.density },
  { label: "Culm diameter", get: (s) => s.culm_diam_range },
  { label: "Wall thickness", get: (s) => s.wall_thickness_range },
  { label: "Structural roles", get: (s) => s.structural_role.join(", ") },
  { label: "Treatment", get: (s) => s.treatment_methods.join(", ") },
];

export default function ComparePage() {
  const [species, setSpecies] = useState<Species[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .listSpecies()
      .then((all) => {
        setSpecies(all);
        // default: first three, in a stable order
        setSelected(new Set(all.slice(0, 3).map((s) => s.id)));
      })
      .catch(() => setError(true));
  }, []);

  const chosen = useMemo(
    () => species.filter((s) => selected.has(s.id)),
    [species, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl font-bold text-leaf-900">
            Compare Species
          </h1>
          <p className="mt-1 text-bamboo-800">
            Pick species to compare their properties side by side.
          </p>
        </div>
        <Link href="/atlas" className="text-sm font-medium text-leaf-700 hover:underline">
          ← Back to Atlas
        </Link>
      </div>

      {error && (
        <div className="mt-8">
          <ApiUnavailable />
        </div>
      )}

      {/* Selector chips */}
      <div className="mt-6 flex flex-wrap gap-2" hidden={error}>
        {species.map((s) => {
          const on = selected.has(s.id);
          return (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                on
                  ? "border-leaf-600 bg-leaf-600 text-white"
                  : "border-bamboo-300 bg-white text-bamboo-800 hover:bg-bamboo-100"
              }`}
            >
              {s.name_local}
            </button>
          );
        })}
      </div>

      {/* Comparison table */}
      {error ? null : chosen.length === 0 ? (
        <p className="mt-10 text-bamboo-700">Select at least one species above.</p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-40 py-3 text-left" />
                {chosen.map((s) => (
                  <th key={s.id} className="px-3 py-3 text-left align-bottom">
                    <div className="flex flex-col items-start gap-2">
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-leaf-50 to-bamboo-100">
                        <SpeciesGlyph
                          color={speciesColor(s.id)}
                          diameterRange={s.culm_diam_range}
                          className="h-14 w-14"
                        />
                      </div>
                      <Link
                        href={`/atlas/${s.id}`}
                        className="font-display text-base font-semibold text-leaf-800 hover:underline"
                      >
                        {s.name_local}
                      </Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-t border-bamboo-200 align-top">
                  <th className="py-3 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-bamboo-500">
                    {row.label}
                  </th>
                  {chosen.map((s) => (
                    <td key={s.id} className="px-3 py-3 text-bamboo-900">
                      {row.get(s)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
