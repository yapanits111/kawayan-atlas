"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { api, type Species } from "@/lib/api";
import { speciesColor } from "@/lib/speciesColor";
import {
  computeStructure,
  type RoofType,
  type BracingType,
} from "@/components/studio/BahayKuboModel";
import { TEMPLATE_PRESETS } from "@/lib/templatePresets";

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

const DEFAULTS = {
  speciesId: "kawayan-tinik",
  roof: "gable" as RoofType,
  bays: 2,
  width: 3.6,
  bayLength: 3.0,
  floorHeight: 1.5,
  wallHeight: 2.2,
  roofPitch: 1.7,
  bracing: "none" as BracingType,
  door: false,
};

const BRACINGS: { value: BracingType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "knee", label: "Knee" },
  { value: "cross", label: "Cross" },
];

function parseMinDiameterMm(range: string): number {
  const m = range.match(/\d+/);
  return m ? parseInt(m[0], 10) : 90;
}

/** Labeled range slider. */
function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-sm">
      <div className="mb-1 flex justify-between">
        <span className="font-medium text-bamboo-700">{label}</span>
        <span className="tabular-nums text-bamboo-600">
          {value.toFixed(step < 1 ? 1 : 0)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-leaf-600"
      />
    </label>
  );
}

export default function StudioPage() {
  const [species, setSpecies] = useState<Species[]>([]);
  const [speciesId, setSpeciesId] = useState(DEFAULTS.speciesId);
  const [roof, setRoof] = useState<RoofType>(DEFAULTS.roof);
  const [bays, setBays] = useState(DEFAULTS.bays);
  const [width, setWidth] = useState(DEFAULTS.width);
  const [bayLength, setBayLength] = useState(DEFAULTS.bayLength);
  const [floorHeight, setFloorHeight] = useState(DEFAULTS.floorHeight);
  const [wallHeight, setWallHeight] = useState(DEFAULTS.wallHeight);
  const [roofPitch, setRoofPitch] = useState(DEFAULTS.roofPitch);
  const [bracing, setBracing] = useState<BracingType>(DEFAULTS.bracing);
  const [door, setDoor] = useState(DEFAULTS.door);

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadStatus, setLoadStatus] = useState<"loaded" | "notfound" | null>(null);
  const [fromTemplate, setFromTemplate] = useState<string | null>(null);
  const shareInputRef = useRef<HTMLInputElement>(null);

  async function copyShare() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      // Fallback for non-secure contexts where the Clipboard API is blocked.
      const el = shareInputRef.current;
      if (el) {
        el.select();
        try {
          document.execCommand("copy");
          setCopied(true);
        } catch {
          /* leave it for the user to copy manually */
        }
      }
    }
  }

  useEffect(() => {
    api.listSpecies().then(setSpecies).catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const designId = params.get("d");
    const templateId = params.get("t");

    // Opening a template pre-configures the studio toward that template's scale.
    if (!designId && templateId && TEMPLATE_PRESETS[templateId]) {
      const preset = TEMPLATE_PRESETS[templateId];
      setSpeciesId(preset.speciesId);
      setRoof(preset.roof);
      setBays(preset.bays);
      setWidth(preset.width);
      setBayLength(preset.bayLength);
      setFloorHeight(preset.floorHeight);
      setWallHeight(preset.wallHeight);
      setRoofPitch(preset.roofPitch);
      setBracing(preset.bracing);
      setDoor(preset.door);
      setFromTemplate(preset.name);
    }

    if (designId) {
      api
        .getDesign(designId)
        .then((d) => {
          const p = d.params as Record<string, unknown>;
          if (typeof p.species_id === "string") setSpeciesId(p.species_id);
          if (typeof p.roof === "string") setRoof(p.roof as RoofType);
          if (typeof p.bays === "number") setBays(p.bays);
          if (typeof p.width === "number") setWidth(p.width);
          if (typeof p.bayLength === "number") setBayLength(p.bayLength);
          if (typeof p.floorHeight === "number") setFloorHeight(p.floorHeight);
          if (typeof p.wallHeight === "number") setWallHeight(p.wallHeight);
          if (typeof p.roofPitch === "number") setRoofPitch(p.roofPitch);
          if (p.bracing === "none" || p.bracing === "knee" || p.bracing === "cross")
            setBracing(p.bracing);
          if (typeof p.door === "boolean") setDoor(p.door);
          setLoadStatus("loaded");
        })
        .catch(() => setLoadStatus("notfound"));
    }
  }, []);

  const selected = species.find((s) => s.id === speciesId);
  const culmRadius = useMemo(() => {
    const dia = selected ? parseMinDiameterMm(selected.culm_diam_range) : 90;
    return Math.min(0.09, Math.max(0.035, dia / 2 / 1000));
  }, [selected]);

  const color = speciesColor(speciesId);

  const modelParams = {
    culmRadius,
    color,
    roof,
    bays,
    width,
    bayLength,
    floorHeight,
    wallHeight,
    roofPitch,
    bracing,
    door,
  };

  // Live parametric takeoff — recomputed on every parameter change.
  const { stats } = useMemo(() => computeStructure(modelParams), [modelParams]);

  function reset() {
    setSpeciesId(DEFAULTS.speciesId);
    setRoof(DEFAULTS.roof);
    setBays(DEFAULTS.bays);
    setWidth(DEFAULTS.width);
    setBayLength(DEFAULTS.bayLength);
    setFloorHeight(DEFAULTS.floorHeight);
    setWallHeight(DEFAULTS.wallHeight);
    setRoofPitch(DEFAULTS.roofPitch);
    setBracing(DEFAULTS.bracing);
    setDoor(DEFAULTS.door);
    setShareUrl(null);
    setFromTemplate(null);
  }

  async function saveAndShare() {
    setSaving(true);
    setSaveError(false);
    setCopied(false);
    try {
      const design = await api.createDesign({
        based_on_template_id: "bahay-kubo-traditional",
        components: [{ type: "frame", species_id: speciesId }],
        params: {
          species_id: speciesId,
          roof,
          bays,
          width,
          bayLength,
          floorHeight,
          wallHeight,
          roofPitch,
          bracing,
          door,
        },
      });
      setShareUrl(`${window.location.origin}/studio?d=${design.id}`);
      // Keep the address bar in sync so a refresh preserves the saved design.
      window.history.replaceState(null, "", `/studio?d=${design.id}`);
      setLoadStatus(null);
    } catch {
      setShareUrl(null);
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-leaf-900">
          Parametric Design Studio
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-bamboo-700">
          The freedom of parametric modelling — like Rhino + Grasshopper, but built for
          bamboo and simple enough to use in a minute. Drag the sliders; the structure and
          the material takeoff update live. Structural frame only — an advisory sketch, not
          an engineered model.
        </p>
      </div>

      {fromTemplate && loadStatus === null && (
        <p className="mt-4 rounded-md border border-bamboo-300 bg-bamboo-100/70 p-2 text-sm text-bamboo-900">
          Starting from the <strong>{fromTemplate}</strong> template — a simplified
          parametric bamboo frame. Adjust the sliders to make it your own.
        </p>
      )}
      {loadStatus === "loaded" && (
        <p className="mt-4 rounded-md border border-leaf-200 bg-leaf-50 p-2 text-sm text-leaf-800">
          ✓ Loaded a shared design. Adjust anything and save again to make it your own.
        </p>
      )}
      {loadStatus === "notfound" && (
        <p className="mt-4 rounded-md border border-clay-400/40 bg-clay-400/10 p-2 text-sm text-bamboo-900">
          That shared design link couldn&apos;t be found — starting from the default instead.
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_21rem]">
        {/* 3D viewport */}
        <div className="h-[26rem] overflow-hidden rounded-xl border border-bamboo-200 bg-bamboo-100 sm:h-[34rem]">
          <StudioCanvas {...modelParams} />
        </div>

        {/* Controls */}
        <aside className="space-y-5">
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
                <option key={s.id} value={s.id}>{s.name_local}</option>
              ))}
            </select>
            {selected && (
              <p className="mt-1 text-xs text-bamboo-600">Ø {selected.culm_diam_range}</p>
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

          {/* Parametric dimension sliders */}
          <div className="space-y-3 rounded-lg border border-bamboo-200 bg-white/60 p-3">
            <Slider label="Width" value={width} min={2.5} max={8} step={0.1} unit="m" onChange={setWidth} />
            <Slider label="Bay length" value={bayLength} min={2} max={5} step={0.1} unit="m" onChange={setBayLength} />
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium text-bamboo-700">Bays</span>
                <span className="tabular-nums text-bamboo-600">{bays}</span>
              </div>
              <input
                type="range" min={1} max={5} step={1} value={bays}
                onChange={(e) => setBays(parseInt(e.target.value, 10))}
                className="w-full accent-leaf-600"
              />
            </div>
            <Slider label="Stilt height" value={floorHeight} min={0} max={3} step={0.1} unit="m" onChange={setFloorHeight} />
            <Slider label="Wall height" value={wallHeight} min={1.8} max={4} step={0.1} unit="m" onChange={setWallHeight} />
            {roof !== "flat" && (
              <Slider label="Roof pitch" value={roofPitch} min={0.3} max={3} step={0.1} unit="m" onChange={setRoofPitch} />
            )}

            <div>
              <div className="mb-1 text-sm font-medium text-bamboo-700">Bracing</div>
              <div className="grid grid-cols-3 gap-1.5">
                {BRACINGS.map((b) => (
                  <button
                    key={b.value}
                    onClick={() => setBracing(b.value)}
                    className={`rounded-md border px-2 py-1.5 text-xs font-medium transition ${
                      bracing === b.value
                        ? "border-leaf-600 bg-leaf-600 text-white"
                        : "border-bamboo-300 bg-white text-bamboo-800 hover:bg-bamboo-100"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 pt-1 text-sm">
              <input
                type="checkbox"
                checked={door}
                onChange={(e) => setDoor(e.target.checked)}
                className="h-4 w-4 accent-leaf-600"
              />
              <span className="font-medium text-bamboo-700">Door opening (front)</span>
            </label>
          </div>

          {/* Live parametric takeoff */}
          <div className="rounded-lg border border-leaf-200 bg-leaf-50 p-3 text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-leaf-700">
              Live takeoff
            </div>
            <Stat label="Footprint" value={`${stats.footprintWidth.toFixed(1)} × ${stats.footprintLength.toFixed(1)} m`} />
            <Stat label="Total height" value={`${stats.totalHeight.toFixed(1)} m`} />
            {roof !== "flat" && <Stat label="Roof angle" value={`${stats.roofAngleDeg.toFixed(0)}°`} />}
            <Stat label="Posts" value={String(stats.postCount)} />
            <Stat label="Members" value={String(stats.memberCount)} />
            <Stat label="Total culm length" value={`${stats.totalCulmLengthM.toFixed(1)} m`} />
            <Stat label="Est. culms needed" value={`~${stats.estimatedCulms}`} />
          </div>

          <div className="flex gap-2">
            <button
              onClick={saveAndShare}
              disabled={saving}
              className="flex-1 rounded-lg bg-leaf-600 px-4 py-2.5 font-semibold text-white transition hover:bg-leaf-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save & share"}
            </button>
            <button
              onClick={reset}
              className="rounded-lg border border-bamboo-300 bg-white px-4 py-2.5 font-semibold text-bamboo-800 hover:bg-bamboo-100"
            >
              Reset
            </button>
          </div>

          {saveError && (
            <p className="rounded-md border border-clay-400/40 bg-clay-400/10 p-2 text-xs text-bamboo-900">
              Couldn&apos;t save — the API is unreachable. Make sure the backend is running,
              then try again.
            </p>
          )}

          {shareUrl && (
            <div className="rounded-md border border-leaf-200 bg-leaf-50 p-2 text-xs">
              <p className="mb-1 text-bamboo-700">Shareable link:</p>
              <div className="flex items-center gap-1">
                <input
                  ref={shareInputRef}
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded border border-bamboo-200 bg-white px-2 py-1"
                />
                <button
                  onClick={copyShare}
                  className="rounded bg-bamboo-200 px-2 py-1 font-medium text-bamboo-800"
                >
                  {copied ? "✓ Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-bamboo-600">{label}</span>
      <span className="font-medium tabular-nums text-bamboo-900">{value}</span>
    </div>
  );
}
