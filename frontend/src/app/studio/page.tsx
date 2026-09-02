"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { api, type Species } from "@/lib/api";
import { speciesColor } from "@/lib/speciesColor";
import type { RoofType } from "@/components/studio/BahayKuboModel";

// three.js can't render on the server — load the canvas client-only.
const StudioCanvas = dynamic(
  () => import("@/components/studio/StudioCanvas").then((m) => m.StudioCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-bamboo-600">
        Loading 3D studio…
      </div>
    ),
  },
);

const ROOFS: { value: RoofType; label: string }[] = [
  { value: "gable", label: "Nipa Gable" },
  { value: "hip", label: "Hip" },
  { value: "flat", label: "Low / Flat" },
];

function parseMinDiameterMm(range: string): number {
  const m = range.match(/\d+/);
  return m ? parseInt(m[0], 10) : 90;
}

export default function StudioPage() {
  const [species, setSpecies] = useState<Species[]>([]);
  const [speciesId, setSpeciesId] = useState("kawayan-tinik");
  const [roof, setRoof] = useState<RoofType>("gable");
  const [bays, setBays] = useState(2);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load species for the picker, and restore a shared design from ?d=.
  useEffect(() => {
    api.listSpecies().then(setSpecies).catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const designId = params.get("d");
    if (designId) {
      api
        .getDesign(designId)
        .then((d) => {
          const p = d.params as {
            species_id?: string;
            roof?: RoofType;
            bays?: number;
          };
          if (p.species_id) setSpeciesId(p.species_id);
          if (p.roof) setRoof(p.roof);
          if (p.bays) setBays(p.bays);
        })
        .catch(() => {});
    }
  }, []);

  const selected = species.find((s) => s.id === speciesId);
  const culmRadius = useMemo(() => {
    const dia = selected ? parseMinDiameterMm(selected.culm_diam_range) : 90;
    // radius in metres, clamped so it always reads at building scale
    return Math.min(0.09, Math.max(0.035, dia / 2 / 1000));
  }, [selected]);

  const color = speciesColor(speciesId);

  async function saveAndShare() {
    setSaving(true);
    setCopied(false);
    try {
      const design = await api.createDesign({
        based_on_template_id: "bahay-kubo-traditional",
        components: [{ type: "frame", species_id: speciesId }],
        params: { species_id: speciesId, roof, bays },
      });
      const url = `${window.location.origin}/studio?d=${design.id}`;
      setShareUrl(url);
    } catch {
      setShareUrl(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl font-bold text-leaf-900">Design Studio</h1>
          <p className="mt-1 text-sm text-bamboo-700">
            Template: <strong>Bahay Kubo</strong> · orbit &amp; zoom to inspect · swap
            components on the right. Structural frame only — an advisory sketch, not an
            engineered model.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* 3D viewport */}
        <div className="h-[26rem] overflow-hidden rounded-xl border border-bamboo-200 bg-bamboo-100 sm:h-[32rem]">
          <StudioCanvas culmRadius={culmRadius} color={color} roof={roof} bays={bays} />
        </div>

        {/* Controls */}
        <aside className="space-y-6">
          <div>
            <label className="mb-1 block text-sm font-semibold text-bamboo-700">
              Bamboo species
            </label>
            <select
              value={speciesId}
              onChange={(e) => setSpeciesId(e.target.value)}
              className="w-full rounded-md border border-bamboo-300 bg-white px-3 py-2"
            >
              {species.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name_local}
                </option>
              ))}
            </select>
            {selected && (
              <p className="mt-1 text-xs text-bamboo-600">
                Ø {selected.culm_diam_range}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-bamboo-700">
              Roof type
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {ROOFS.map((rt) => (
                <button
                  key={rt.value}
                  onClick={() => setRoof(rt.value)}
                  className={`rounded-md border px-2 py-2 text-xs font-medium transition ${
                    roof === rt.value
                      ? "border-leaf-600 bg-leaf-600 text-white"
                      : "border-bamboo-300 bg-white text-bamboo-800 hover:bg-bamboo-100"
                  }`}
                >
                  {rt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-bamboo-700">
              Bays: {bays}
            </label>
            <input
              type="range"
              min={1}
              max={3}
              value={bays}
              onChange={(e) => setBays(parseInt(e.target.value, 10))}
              className="w-full accent-leaf-600"
            />
          </div>

          <div className="rounded-lg border border-bamboo-200 bg-white p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-bamboo-600">Footprint</span>
              <span className="font-medium">3.6 × {(bays * 3).toFixed(1)} m</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-bamboo-600">Posts</span>
              <span className="font-medium">{2 * (bays + 1)}</span>
            </div>
          </div>

          <div>
            <button
              onClick={saveAndShare}
              disabled={saving}
              className="w-full rounded-lg bg-leaf-600 px-4 py-2.5 font-semibold text-white transition hover:bg-leaf-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save & share design"}
            </button>
            {shareUrl && (
              <div className="mt-2 rounded-md border border-leaf-200 bg-leaf-50 p-2 text-xs">
                <p className="mb-1 text-bamboo-700">Shareable link:</p>
                <div className="flex items-center gap-1">
                  <input
                    readOnly
                    value={shareUrl}
                    className="min-w-0 flex-1 rounded border border-bamboo-200 bg-white px-2 py-1"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(shareUrl);
                      setCopied(true);
                    }}
                    className="rounded bg-bamboo-200 px-2 py-1 font-medium text-bamboo-800"
                  >
                    {copied ? "✓" : "Copy"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
