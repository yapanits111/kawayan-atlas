import Link from "next/link";
import { api, type Species } from "@/lib/api";
import { ApiUnavailable } from "@/components/ApiUnavailable";
import { SpeciesGlyph } from "@/components/SpeciesGlyph";
import { speciesColor } from "@/lib/speciesColor";

export const metadata = {
  title: "Bamboo Atlas",
  description:
    "Browse Philippine bamboo species — their properties, structural roles, and sources.",
};

// All structural roles present in the seed set, for the filter dropdown.
const ROLES = ["post", "beam", "truss", "flooring", "wall infill", "roofing lath", "scaffolding"];

export default async function AtlasPage({
  searchParams,
}: {
  searchParams: { region?: string; role?: string; q?: string };
}) {
  let species: Species[];
  try {
    species = await api.listSpecies({
      region: searchParams.region,
      role: searchParams.role,
      q: searchParams.q,
    });
  } catch {
    return (
      <div className="mx-auto max-w-6xl px-5 py-12">
        <h1 className="font-display text-3xl font-bold text-leaf-900">Bamboo Species Atlas</h1>
        <div className="mt-8">
          <ApiUnavailable />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="font-display text-3xl font-bold text-leaf-900">Bamboo Species Atlas</h1>
      <p className="mt-2 max-w-2xl text-bamboo-800">
        Philippine bamboo species and their structural roles. Figures are drawn from PROSEA,
        DOST-FPRDI/Base Bahay, and published studies (cited on each species page); values
        marked <span className="rounded bg-bamboo-200 px-1 text-bamboo-700">approx.</span>{" "}
        vary with age, site, and moisture and still need a species-specific test value.
      </p>

      <Link
        href="/compare"
        className="mt-4 inline-block rounded-lg border border-leaf-300 bg-leaf-50 px-4 py-2 text-sm font-semibold text-leaf-700 transition hover:bg-leaf-100"
      >
        ⇄ Compare species side by side
      </Link>

      {/* Filter form (GET → server component re-renders) */}
      <form className="mt-8 flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col text-sm">
          <span className="mb-1 font-medium text-bamboo-700">Search</span>
          <input
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder="name…"
            className="rounded-md border border-bamboo-300 bg-white px-3 py-2"
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="mb-1 font-medium text-bamboo-700">Structural role</span>
          <select
            name="role"
            defaultValue={searchParams.role ?? ""}
            className="rounded-md border border-bamboo-300 bg-white px-3 py-2"
          >
            <option value="">Any role</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-leaf-600 px-4 py-2 font-semibold text-white hover:bg-leaf-700"
        >
          Filter
        </button>
        {(searchParams.q || searchParams.role) && (
          <Link href="/atlas" className="px-2 py-2 text-sm text-bamboo-600 hover:underline">
            Clear
          </Link>
        )}
      </form>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {species.map((s) => (
          <Link
            key={s.id}
            href={`/atlas/${s.id}`}
            className="group rounded-xl border border-bamboo-200 bg-white p-5 shadow-sm transition hover:border-leaf-300 hover:shadow-md"
          >
            <div className="mb-3 flex h-24 items-center justify-center rounded-lg bg-gradient-to-br from-leaf-50 to-bamboo-100">
              <SpeciesGlyph
                color={speciesColor(s.id)}
                diameterRange={s.culm_diam_range}
                className="h-20 w-20"
              />
            </div>
            <h2 className="font-display text-xl font-semibold text-leaf-800 group-hover:text-leaf-900">
              {s.name_local}
            </h2>
            <p className="italic text-sm text-bamboo-600">{s.name_scientific}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {s.structural_role.map((r) => (
                <span
                  key={r}
                  className="rounded-full bg-leaf-100 px-2 py-0.5 text-xs font-medium text-leaf-700"
                >
                  {r}
                </span>
              ))}
            </div>
            <dl className="mt-4 space-y-1 text-sm text-bamboo-800">
              <div className="flex justify-between gap-2">
                <dt className="text-bamboo-600">Diameter</dt>
                <dd className="text-right">{s.culm_diam_range}</dd>
              </div>
            </dl>
          </Link>
        ))}
        {species.length === 0 && (
          <p className="text-bamboo-700">No species match those filters.</p>
        )}
      </div>
    </div>
  );
}
