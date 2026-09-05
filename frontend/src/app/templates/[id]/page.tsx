import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  try {
    const t = await api.getTemplate(params.id);
    return { title: t.name, description: t.description.slice(0, 155) };
  } catch {
    return { title: "Template" };
  }
}

export default async function TemplateDetail({
  params,
}: {
  params: { id: string };
}) {
  let template;
  try {
    template = await api.getTemplate(params.id);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <Link href="/templates" className="text-sm text-leaf-700 hover:underline">
        ← Back to Templates
      </Link>
      <span className="mt-4 block text-xs font-semibold uppercase tracking-wide text-clay-500">
        {template.category}
      </span>
      <h1 className="mt-1 font-display text-4xl font-bold text-leaf-900">{template.name}</h1>
      <p className="mt-4 text-bamboo-900">{template.description}</p>

      <div className="mt-4 inline-block rounded-lg bg-bamboo-100 px-4 py-2 text-sm text-bamboo-800">
        Indicative span range: <strong>{template.known_span_range}</strong>
      </div>

      <h2 className="mt-10 font-display text-xl font-semibold text-leaf-800">Components</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-bamboo-300 text-left text-bamboo-600">
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Species</th>
              <th className="py-2 pr-4">Joint</th>
              <th className="py-2 pr-4">Qty</th>
              <th className="py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {template.components.map((c, i) => (
              <tr key={i} className="border-b border-bamboo-100">
                <td className="py-2 pr-4 font-medium capitalize text-leaf-800">{c.type}</td>
                <td className="py-2 pr-4">
                  {c.species_id ? (
                    <Link href={`/atlas/${c.species_id}`} className="text-leaf-700 hover:underline">
                      {c.species_id}
                    </Link>
                  ) : "—"}
                </td>
                <td className="py-2 pr-4">
                  {c.joint_id ? (
                    <Link href={`/joints/${c.joint_id}`} className="text-leaf-700 hover:underline">
                      {c.joint_id}
                    </Link>
                  ) : "—"}
                </td>
                <td className="py-2 pr-4">{c.count ?? "—"}</td>
                <td className="py-2 text-bamboo-700">{c.notes ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 font-display text-xl font-semibold text-leaf-800">
        Default bill of materials
      </h2>
      <ul className="mt-3 space-y-2">
        {template.default_bom.map((b, i) => (
          <li key={i} className="flex justify-between rounded-lg border border-bamboo-200 bg-white px-4 py-2 text-sm">
            <span className="text-bamboo-900">{b.item}</span>
            <span className="font-medium text-bamboo-700">{b.qty} {b.unit}</span>
          </li>
        ))}
      </ul>

      <div className="mt-10 rounded-xl border border-leaf-200 bg-leaf-50 p-5">
        <h3 className="font-display text-lg font-semibold text-leaf-800">Make it your own</h3>
        <p className="mt-1 text-sm text-bamboo-800">
          Open this template in the parametric studio — it loads at roughly this template&apos;s
          scale as a simplified bamboo frame, then you adjust dimensions, species, and roof
          live.
        </p>
        <Link
          href={`/studio?t=${template.id}`}
          className="mt-3 inline-block rounded-lg bg-leaf-600 px-5 py-2.5 font-semibold text-white hover:bg-leaf-700"
        >
          Open in Design Studio →
        </Link>
      </div>
    </div>
  );
}
