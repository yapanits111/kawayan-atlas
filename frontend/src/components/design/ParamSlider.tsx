"use client";

/** Decimal places implied by a step (0.05 → 2, 1 → 0), for the value readout. */
export function stepDecimals(step: number): number {
  return (String(step).split(".")[1] ?? "").length;
}

/** A labelled range slider with a live value readout — the Design Lab's control for every
 *  numeric parameter (Grasshopper-style number sliders rather than typed boxes). The track
 *  stretches to include an out-of-range value (e.g. from an older saved graph) instead of
 *  silently clamping it. */
export function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const lo = Math.min(min, value);
  const hi = Math.max(max, value);
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-2 text-[10px] leading-3">
        <span className="truncate text-bamboo-600">{label}</span>
        <span className="shrink-0 font-semibold tabular-nums text-bamboo-800">
          {value.toFixed(stepDecimals(step))}
        </span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={lo}
        max={hi}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="nodrag nowheel h-3 w-full cursor-pointer accent-leaf-600"
      />
    </div>
  );
}
