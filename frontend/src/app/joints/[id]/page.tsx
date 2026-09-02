import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { SourceList } from "@/components/SourceList";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  try {
    const j = await api.getJoint(params.id);
    return { title: j.name, description: j.description.slice(0, 155) };
  } catch {
    return { title: "Joint" };
  }
}

export default async function JointDetail({
  params,
}: {
  params: { id: string };
}) {
  let joint;
  try {
    joint = await api.getJoint(params.id);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <Link href="/joints" className="text-sm text-leaf-700 hover:underline">
        ← Back to Joint Library
      </Link>
      <h1 className="mt-3 font-display text-4xl font-bold text-leaf-900">{joint.name}</h1>
      <p className="mt-4 text-bamboo-900">{joint.description}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-bamboo-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-bamboo-500">Load behavior</h2>
          <p className="mt-1 text-bamboo-900">{joint.load_notes}</p>
        </div>
        <div className="rounded-lg border border-clay-400/40 bg-clay-400/10 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-clay-600">Typical failure mode</h2>
          <p className="mt-1 text-bamboo-900">{joint.failure_mode}</p>
        </div>
        <div className="rounded-lg border border-bamboo-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-bamboo-500">Applicable culm sizes</h2>
          <p className="mt-1 text-bamboo-900">{joint.applicable_culm_sizes}</p>
        </div>
        <div className="rounded-lg border border-bamboo-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-bamboo-500">Applicable species</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {joint.applicable_species.map((sid) => (
              <Link key={sid} href={`/atlas/${sid}`} className="rounded-full bg-leaf-100 px-2 py-0.5 text-xs font-medium text-leaf-700 hover:bg-leaf-200">
                {sid}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <h2 className="mt-10 font-display text-xl font-semibold text-leaf-800">Sources</h2>
      <SourceList sources={joint.sources} />
    </div>
  );
}
