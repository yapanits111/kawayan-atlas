"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NODE_DEFS, CATEGORIES } from "@/lib/design/nodeDefs";

// Mirrors the node header colours in GraphNode, as a small category dot.
const CAT_COLOR: Record<string, string> = {
  Geometry: "#538343",
  Bamboo: "#9a8248",
  Analysis: "#8c4e2e",
  Output: "#a9623a",
};

/** Searchable, categorised palette for adding a node — replaces a flat 27-item select.
 *  Type to filter by label / kind / category; Enter adds the top match, Escape closes. */
export function AddNodeMenu({ onAdd }: { onAdd: (type: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as globalThis.Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  // Reset + focus the search box each time it opens.
  useEffect(() => {
    if (!open) return;
    setQ("");
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return CATEGORIES.map((cat) => ({
      cat,
      items: Object.values(NODE_DEFS).filter(
        (d) =>
          d.category === cat &&
          (!needle ||
            d.label.toLowerCase().includes(needle) ||
            d.type.toLowerCase().includes(needle) ||
            cat.toLowerCase().includes(needle)),
      ),
    })).filter((g) => g.items.length > 0);
  }, [q]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  function pick(type: string) {
    onAdd(type);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-bamboo-300 bg-white px-3 py-1.5 text-sm text-bamboo-800 hover:bg-bamboo-100"
      >
        + Add node…
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-bamboo-200 bg-white shadow-lg">
          <div className="border-b border-bamboo-100 p-2">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && flat.length) pick(flat[0].type);
                else if (e.key === "Escape") setOpen(false);
              }}
              placeholder="Search nodes…"
              className="w-full rounded border border-bamboo-200 px-2 py-1 text-sm outline-none focus:border-leaf-500"
            />
          </div>
          <div className="max-h-72 overflow-auto py-1">
            {flat.length === 0 ? (
              <div className="px-3 py-2 text-xs text-bamboo-500">No nodes match “{q}”.</div>
            ) : (
              groups.map((g) => (
                <div key={g.cat}>
                  <div className="px-3 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-bamboo-400">
                    {g.cat}
                  </div>
                  {g.items.map((d) => (
                    <button
                      key={d.type}
                      onClick={() => pick(d.type)}
                      className="flex w-full items-center gap-2 px-3 py-1 text-left text-sm text-bamboo-800 hover:bg-bamboo-50"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: CAT_COLOR[g.cat] }}
                      />
                      {d.label}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
