"use client";

import { Fragment } from "react";
import { SNAP_STEPS, type SnapSettings } from "@/lib/design/drag";

const toggle = (on: boolean) =>
  `rounded px-1.5 py-0.5 font-medium ${on ? "bg-leaf-600 text-white" : "text-bamboo-700 hover:bg-bamboo-100"}`;

/** Snapping for dragged control points: to a grid in the curve's plane, and onto other points. */
export function SnapBar({ snap, onChange }: { snap: SnapSettings; onChange: (s: SnapSettings) => void }) {
  return (
    <div
      role="group"
      aria-label="Snapping"
      className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-white/90 px-1.5 py-1 text-[11px] shadow-sm"
    >
      <span className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-bamboo-500">Snap</span>
      <button
        type="button"
        aria-pressed={snap.grid}
        title="Snap dragged points to a grid laid out in the curve's plane"
        onClick={() => onChange({ ...snap, grid: !snap.grid })}
        className={toggle(snap.grid)}
      >
        Grid
      </button>
      <select
        aria-label="Grid step"
        value={snap.step}
        onChange={(e) => onChange({ ...snap, step: Number(e.target.value) })}
        className="rounded border border-bamboo-200 bg-white px-1 py-0.5 text-[11px] text-bamboo-800"
      >
        {SNAP_STEPS.map((s) => (
          <option key={s} value={s}>
            {s} m
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-pressed={snap.points}
        title="Snap onto member ends, joints and other control points"
        onClick={() => onChange({ ...snap, points: !snap.points })}
        className={toggle(snap.points)}
      >
        Points
      </button>
    </div>
  );
}

/** What was clicked in the 3D view, and the chain of nodes behind it, source first — each
 *  one a click away. */
export function PickTag({
  title,
  detail,
  chain,
  labelOf,
  isSelected,
  onSelect,
  onClose,
}: {
  title: string;
  detail: string;
  chain: string[];
  labelOf: (id: string) => string;
  isSelected: (id: string) => boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      role="status"
      aria-label="Picked in 3D"
      className="absolute right-2 top-2 max-w-[calc(100%-1rem)] rounded-md bg-white/95 px-2.5 py-1.5 text-[11px] shadow-sm sm:max-w-[60%]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="font-semibold text-bamboo-800">{title}</span>{" "}
          <span className="text-bamboo-600">{detail}</span>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onClose}
          className="-mr-1 rounded px-1 leading-none text-bamboo-500 hover:bg-bamboo-100"
        >
          ×
        </button>
      </div>
      {chain.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {chain.map((id, i) => (
            <Fragment key={id}>
              {i > 0 && (
                <span aria-hidden="true" className="text-bamboo-400">
                  ›
                </span>
              )}
              <button
                type="button"
                title={`Select ${id}`}
                aria-pressed={isSelected(id)}
                onClick={() => onSelect(id)}
                className={`rounded border px-1.5 py-0.5 ${
                  isSelected(id)
                    ? "border-leaf-600 bg-leaf-600 text-white"
                    : "border-bamboo-200 text-bamboo-700 hover:bg-bamboo-100"
                }`}
              >
                {labelOf(id)}
              </button>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
