import Link from "next/link";
import { api, type Joint } from "@/lib/api";
import { ApiUnavailable } from "@/components/ApiUnavailable";

export const metadata = {
  title: "Joint Library",
  description:
    "Bamboo connections — traditional lashings to bolted and steel-strap joints.",
};

export default async function JointsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  let joints: Joint[];
  try {
    joints = await api.listJoints({ q: searchParams.q });
  } catch {
    return (
      <div className="mx-auto max-w-6xl px-5 py-12">
        <h1 className="font-display text-3xl font-bold text-leaf-900">
          Joint &amp; Connection Library
        </h1>
        <div className="mt-8">
          <ApiUnavailable />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="font-display text-3xl font-bold text-leaf-900">Joint &amp; Connection Library</h1>
      <p className="mt-2 max-w-2xl text-bamboo-800">
        How bamboo members meet — from traditional lashings to bolted and steel-strap
        connections. Load behavior and sizes are drafts pending verification.
      </p>

      <form className="mt-8 flex items-end gap-3" method="get">
        <label className="flex flex-col text-sm">
          <span className="mb-1 font-medium text-bamboo-700">Search</span>
          <input
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder="lashing, bolted…"
            className="rounded-md border border-bamboo-300 bg-white px-3 py-2"
          />
        </label>
        <button type="submit" className="rounded-md bg-leaf-600 px-4 py-2 font-semibold text-white hover:bg-leaf-700">
          Search
        </button>
      </form>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {joints.map((j) => (
          <Link
            key={j.id}
            href={`/joints/${j.id}`}
            className="group rounded-xl border border-bamboo-200 bg-white p-5 shadow-sm transition hover:border-leaf-300 hover:shadow-md"
          >
            <h2 className="font-display text-lg font-semibold text-leaf-800 group-hover:text-leaf-900">
              {j.name}
            </h2>
            <p className="mt-1 line-clamp-2 text-sm text-bamboo-800">{j.description}</p>
            <p className="mt-3 text-xs text-bamboo-600">
              Culm sizes: {j.applicable_culm_sizes}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
