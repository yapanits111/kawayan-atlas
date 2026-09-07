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

function scheduleHTML(schedule: Schedule): string {
  const rows = schedule.rows
    .map(
      (r) =>
        `<tr><td>${r.id}</td><td>${r.kind}</td><td>${r.length_m} m</td><td>${r.detail}</td>` +
        `<td>${r.cut_start_deg ?? ""}</td><td>${r.cut_end_deg ?? ""}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Kawayan Atlas — Cut-list</title>
    <style>
      body{font-family:system-ui,sans-serif;color:#33291f;margin:32px}
      h1{font-family:Georgia,serif;color:#33522a;font-size:22px;margin:0 0 4px}
      .totals{color:#635130;font-size:13px;margin-bottom:16px}
      table{border-collapse:collapse;width:100%;font-size:12px}
      th,td{border:1px solid #d9cfb2;padding:6px 8px;text-align:left}
      th{background:#f2f7f0}
      .foot{margin-top:20px;font-size:10px;color:#8a7a5a}
    </style></head><body>
    <h1>🎋 Kawayan Atlas — Fabrication cut-list</h1>
    <div class="totals">${schedule.totals.count} elements · ${schedule.totals.totalLength_m} m total · ~${schedule.totals.estCulms} culms</div>
    <table><thead><tr><th>ID</th><th>Kind</th><th>Length</th><th>Detail</th><th>Cut start°</th><th>Cut end°</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="foot">Advisory fabrication document — verify against real, measured poles and a qualified engineer before building.</div>
    </body></html>`;
}

export function SchedulePanel({ schedule }: { schedule: Schedule | null }) {
  function printPDF() {
    if (!schedule) return;
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(scheduleHTML(schedule));
    doc.close();
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }

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
        <div className="flex gap-1.5">
          <button
            onClick={printPDF}
            disabled={!schedule || schedule.rows.length === 0}
            className="rounded-md border border-bamboo-300 bg-white px-3 py-1 text-xs font-semibold text-bamboo-800 hover:bg-bamboo-100 disabled:opacity-50"
          >
            PDF
          </button>
          <button
            onClick={exportCSV}
            disabled={!schedule || schedule.rows.length === 0}
            className="rounded-md bg-leaf-600 px-3 py-1 text-xs font-semibold text-white hover:bg-leaf-700 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
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
