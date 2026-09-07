"use client";

import type { Schedule } from "@/lib/design/types";

function toCSV(schedule: Schedule): string {
  const header = ["id", "kind", "length_m", "detail", "cut_start_deg", "cut_end_deg"];
  const lines = [header.join(",")];
  for (const r of schedule.rows) {
    lines.push(
      [
        r.id,
        r.kind,
        r.length_m,
        `"${r.detail}"`,
        r.cut_start_deg ?? "",
        r.cut_end_deg ?? "",
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function SchedulePanel({ schedule }: { schedule: Schedule | null }) {
  function exportCSV() {
    if (!schedule) return;
    const blob = new Blob([toCSV(schedule)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kawayan-cutlist.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-bamboo-200 px-3 py-2">
        <div className="text-sm font-semibold text-leaf-800">Cut-list &amp; schedule</div>
        <button
          onClick={exportCSV}
          disabled={!schedule || schedule.rows.length === 0}
          className="rounded-md bg-leaf-600 px-3 py-1 text-xs font-semibold text-white hover:bg-leaf-700 disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      {!schedule || schedule.rows.length === 0 ? (
        <div className="p-3 text-xs text-bamboo-600">
          Connect elements into a <strong>Schedule</strong> node to generate a cut-list.
        </div>
      ) : (
        <>
          <div className="flex gap-4 border-b border-bamboo-100 px-3 py-1.5 text-xs text-bamboo-700">
            <span><strong>{schedule.totals.count}</strong> elements</span>
            <span><strong>{schedule.totals.totalLength_m}</strong> m total</span>
            <span>~<strong>{schedule.totals.estCulms}</strong> culms</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-bamboo-50 text-bamboo-500">
                <tr>
                  <th className="px-3 py-1.5">ID</th>
                  <th className="px-2 py-1.5">Kind</th>
                  <th className="px-2 py-1.5">Length</th>
                  <th className="px-2 py-1.5">Detail</th>
                </tr>
              </thead>
              <tbody>
                {schedule.rows.map((r) => (
                  <tr key={r.id} className="border-t border-bamboo-100">
                    <td className="px-3 py-1 font-medium text-leaf-800">{r.id}</td>
                    <td className="px-2 py-1 capitalize">{r.kind}</td>
                    <td className="px-2 py-1 tabular-nums">{r.length_m} m</td>
                    <td className="px-2 py-1 text-bamboo-700">{r.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
