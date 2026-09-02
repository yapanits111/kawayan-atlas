import type { MetadataRoute } from "next";
import { api } from "@/lib/api";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    "",
    "/atlas",
    "/compare",
    "/joints",
    "/templates",
    "/studio",
    "/calculator",
  ].map(
    (path) => ({
      url: `${siteUrl}${path}`,
      lastModified: new Date(),
    }),
  );

  // Add dynamic detail routes when the API is reachable; degrade to static otherwise.
  const dynamicRoutes: MetadataRoute.Sitemap = [];
  try {
    const [species, joints, templates] = await Promise.all([
      api.listSpecies(),
      api.listJoints(),
      api.listTemplates(),
    ]);
    for (const s of species) dynamicRoutes.push({ url: `${siteUrl}/atlas/${s.id}` });
    for (const j of joints) dynamicRoutes.push({ url: `${siteUrl}/joints/${j.id}` });
    for (const t of templates) dynamicRoutes.push({ url: `${siteUrl}/templates/${t.id}` });
  } catch {
    /* API unavailable — ship the static routes only. */
  }

  return [...staticRoutes, ...dynamicRoutes];
}
