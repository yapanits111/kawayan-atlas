import Link from "next/link";

export const metadata = {
  title: "About & Methodology",
  description:
    "What Kawayan Atlas is, how its data is sourced, the standards it references, and its limits.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-3xl font-bold text-leaf-900">
        About &amp; Methodology
      </h1>

      <p className="mt-4 text-bamboo-900">
        Kawayan Atlas is an educational reference and design sandbox for bamboo
        construction in the Philippines. It brings together a species atlas, a joint
        library, template starting points, a parametric 3D studio, and a (safety-gated)
        calculator — so an owner, student, or builder can learn and explore before bringing
        in a professional.
      </p>

      <div className="mt-6 rounded-lg border border-clay-400/50 bg-clay-400/10 p-4 text-sm text-bamboo-900">
        <strong className="font-semibold">Not engineering advice.</strong> This is a
        learning and design-exploration tool. It does <em>not</em> replace a licensed
        structural engineer or the LGU building-permit process. Any capacities, flags, or
        estimates are advisory and must be verified by a qualified professional before
        construction.
      </div>

      <h2 className="mt-10 font-display text-xl font-semibold text-leaf-800">
        How the data is sourced
      </h2>
      <p className="mt-2 text-bamboo-900">
        Every species and joint carries citations, shown on its detail page. Numeric
        properties vary with age, site, and moisture, so figures are ranges and are labeled{" "}
        <span className="rounded bg-bamboo-200 px-1 text-bamboo-700">approx.</span> where a
        species-specific tested value isn&apos;t openly published. Primary sources include:
      </p>
      <ul className="mt-3 space-y-1.5 text-sm text-bamboo-800">
        <li>
          <a href="https://prosea-bamboos.linnaeus.naturalis.nl/" target="_blank" rel="noreferrer" className="text-leaf-700 underline underline-offset-2">
            PROSEA — Plant Resources of South-East Asia (Bamboos)
          </a>{" "}
          — species descriptions and dimensions
        </li>
        <li>
          <a href="https://fprdi.dost.gov.ph/" target="_blank" rel="noreferrer" className="text-leaf-700 underline underline-offset-2">
            DOST-FPRDI
          </a>{" "}
          and published Philippine studies — physical/mechanical properties
        </li>
        <li>
          <a href="https://base-builds.com/" target="_blank" rel="noreferrer" className="text-leaf-700 underline underline-offset-2">
            Base Bahay Foundation
          </a>{" "}
          — Cement-Bamboo Frame Technology and the ISO 22156 design manual
        </li>
      </ul>

      <h2 className="mt-10 font-display text-xl font-semibold text-leaf-800">
        Standards referenced
      </h2>
      <p className="mt-2 text-bamboo-900">
        <a href="https://www.iso.org/standard/73831.html" target="_blank" rel="noreferrer" className="text-leaf-700 underline underline-offset-2">
          ISO 22156:2021
        </a>{" "}
        (bamboo structural design) is the design basis; PNS ISO 22157 and 19624 are the
        Philippine-adopted <em>test</em> and <em>grading</em> methods (not encodable design
        rules). Because bamboo-specific provisions in the NSCP and National Building Code
        are thin, the calculator is scoped to <em>coarse advisory checks only</em> and stays
        disabled until a licensed engineer reviews its numeric rules.
      </p>

      <h2 className="mt-10 font-display text-xl font-semibold text-leaf-800">
        The parametric studio
      </h2>
      <p className="mt-2 text-bamboo-900">
        Powerful parametric tools like Rhino + Grasshopper give designers real freedom, but
        the learning curve is steep and nothing is bamboo-specific. The{" "}
        <Link href="/studio" className="text-leaf-700 underline underline-offset-2">
          Design Studio
        </Link>{" "}
        aims for the same freedom through plain sliders — width, spans, heights, roof pitch —
        with a live material takeoff, and no node graph or plugins to learn.
      </p>

      <h2 className="mt-10 font-display text-xl font-semibold text-leaf-800">
        Where this is going
      </h2>
      <p className="mt-2 text-bamboo-900">
        This is <strong>Release 1</strong>: a full-stack demo with no accounts. A later
        release adds user accounts and saved designs, a wider parametric vocabulary, an
        engineer-reviewed sanity pre-check, cost/material takeoffs, and a community layer.
      </p>

      <div className="mt-10">
        <Link href="/atlas" className="rounded-lg bg-leaf-600 px-5 py-2.5 font-semibold text-white hover:bg-leaf-700">
          Explore the Atlas →
        </Link>
      </div>
    </div>
  );
}
