"use client";

import type { InventoryReport } from "@/lib/design/types";

function toCSV(r: InventoryReport): string {
  const lines = [["pole_id", "pole_length_m", "base_mm", "tip_mm", "piece_id", "at_m", "piece_length_m", "offcut_m"].join(",")];
  for (const p of r.poles) {
    if (!p.cuts.length) continue;
    for (const c of p.cuts) {
      lines.push([p.poleId, p.length, p.baseDiameter, p.tipDiameter, c.elementId, c.at, c.length, p.offcut].join(","));
    }
  }
  if (r.unmatched.length) {
    lines.push("", "# Unplaced pieces");
    lines.push(["piece_id", "length_m", "diameter_mm", "reason"].join(","));
    for (const u of r.unmatched) {
      lines.push([u.elementId, u.length, u.diameter, `"${u.reason}"`].join(","));
    }
  }
  return lines.join("\n");
}

export function InventoryPanel({ report }: { report: InventoryReport | null }) {
  if (!report) {
    return (
      <div className="p-3 text-xs text-bamboo-600">
        Add a <strong>Pole inventory</strong> node after your elements and paste your
        measured poles (<code>id, length_m, Ø base_mm, Ø tip_mm</code>) to reconcile the
        design against real stock.
      </div>
    );
  }

  const { totals } = report;
  const broached = report.poles.filter((p) => p.cuts.length > 0);

  function exportCSV() {
    const blob = new Blob([toCSV(report!)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kawayan-pole-assignment.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-clay-400/40 bg-clay-400/10 px-3 py-2 text-xs text-bamboo-900">
        <strong>Advisory yield estimate.</strong> {report.note}
      </div>

      <div className="flex items-center justify-between border-b border-bamboo-100 px-3 py-1.5">
        <div className="flex flex-wrap gap-3 text-xs text-bamboo-700">
          <span>
            <strong>{totals.piecesPlaced}</strong>/{totals.piecesTotal} pieces placed
          </span>
          <span>
            <strong>{totals.polesUsed}</strong>/{totals.polesAvailable} poles used
          </span>
          <span title="Whole length of every pole cut into">
            <strong>{totals.broachedLength}</strong> m broached
          </span>
          <span title="Metres that end up in members">
            <strong>{totals.cutLength}</strong> m in members
          </span>
          <span title="Offcut as a share of the poles broached">
            <strong>{totals.wastePct}%</strong> offcut
          </span>
        </div>
        <button
          onClick={exportCSV}
          className="rounded-md border border-bamboo-300 bg-white px-3 py-1 text-xs font-semibold text-bamboo-800 hover:bg-bamboo-100"
        >
          Export CSV
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {report.unmatched.length > 0 && (
          <div className="border-b border-clay-400/40 bg-clay-400/5 px-3 py-2">
            <div className="text-xs font-semibold text-clay-600">
              {report.unmatched.length} piece{report.unmatched.length > 1 ? "s" : ""} the yard cannot yield
            </div>
            <ul className="mt-1 space-y-0.5 text-[11px] text-bamboo-700">
              {report.unmatched.map((u) => (
                <li key={u.elementId}>
                  <span className="font-medium text-leaf-800">{u.elementId}</span> — {u.length} m,
                  Ø{u.diameter} mm: {u.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {broached.length === 0 ? (
          <div className="p-3 text-xs text-bamboo-600">
            No pole in the list can yield any piece in this design.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-bamboo-50 text-bamboo-500">
              <tr>
                <th className="px-3 py-1.5">Pole</th>
                <th className="px-2 py-1.5">Stock</th>
                <th className="px-2 py-1.5">Cuts (mark @ station)</th>
                <th className="px-2 py-1.5">Offcut</th>
              </tr>
            </thead>
            <tbody>
              {broached.map((p) => (
                <tr key={p.poleId} className="border-t border-bamboo-100 align-top">
                  <td className="px-3 py-1 font-medium text-leaf-800">{p.poleId}</td>
                  <td className="px-2 py-1 tabular-nums text-bamboo-600">
                    {p.length} m · Ø{p.baseDiameter}→{p.tipDiameter}
                  </td>
                  <td className="px-2 py-1 text-bamboo-700">
                    {p.cuts.map((c) => `${c.elementId} @ ${c.at} m (${c.length} m)`).join(" · ")}
                  </td>
                  <td className="px-2 py-1 tabular-nums text-bamboo-600">{p.offcut} m</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {report.processed.length > 0 && (
          <div className="border-t border-bamboo-100 px-3 py-2 text-[11px] text-bamboo-600">
            <strong>{report.processed.length}</strong> processed piece
            {report.processed.length > 1 ? "s" : ""} ({report.processed.slice(0, 8).join(", ")}
            {report.processed.length > 8 ? ", …" : ""}) are strips or laminates — cut from
            processed stock, not whole poles, so they are not assigned here.
          </div>
        )}
      </div>
    </div>
  );
}
