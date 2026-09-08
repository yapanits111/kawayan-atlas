"use client";

import { VERIFICATION_LABEL, type Schedule } from "@/lib/design/types";

function toCSV(schedule: Schedule): string {
  const header = [
    "id", "kind", "length_m", "detail", "nodes", "layup", "verification",
    "cut_start_deg", "cut_end_deg",
  ];
  const lines = [header.join(",")];
  for (const r of schedule.rows) {
    lines.push(
      [
        r.id,
        r.kind,
        r.length_m,
        `"${r.detail}"`,
        r.nodes ?? "",
        `"${r.layup ?? ""}"`,
        `"${r.verification ? VERIFICATION_LABEL[r.verification] : ""}"`,
        r.cut_start_deg ?? "",
        r.cut_end_deg ?? "",
      ].join(","),
    );
  }
  if (schedule.joints.length) {
    lines.push("");
    lines.push("# Joint schedule");
    lines.push(["id", "type", "members", "member_ids", "angle_deg", "x_m", "y_m", "z_m"].join(","));
    for (const j of schedule.joints) {
      lines.push(
        [j.id, `"${j.type}"`, j.members, `"${j.memberIds}"`, j.angle_deg ?? "", j.x, j.y, j.z].join(","),
      );
    }
  }
  return lines.join("\n");
}

function scheduleHTML(schedule: Schedule): string {
  const engineered = schedule.rows.some((r) => r.verification === "outside-iso22156");
  const rows = schedule.rows
    .map(
      (r) =>
        `<tr><td>${r.id}</td><td>${r.kind}</td><td>${r.length_m} m</td>` +
        `<td>${r.detail}${r.layup ? `<br><span class="sub">${r.layup}</span>` : ""}</td>` +
        `<td>${r.nodes ?? ""}</td>` +
        `<td>${r.cut_start_deg ?? ""}</td><td>${r.cut_end_deg ?? ""}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Kawayan Atlas — Cut-list</title>
    <style>
      body{font-family:system-ui,sans-serif;color:#33291f;margin:32px}
      h1{font-family:Georgia,serif;color:#33522a;font-size:22px;margin:0 0 4px}
      h2{font-family:Georgia,serif;color:#33522a;font-size:15px;margin:22px 0 6px}
      .totals{color:#635130;font-size:13px;margin-bottom:16px}
      table{border-collapse:collapse;width:100%;font-size:12px}
      th,td{border:1px solid #d9cfb2;padding:6px 8px;text-align:left}
      th{background:#f2f7f0}
      .sub{color:#8a7a5a;font-size:10px}
      .note{margin-top:14px;padding:8px 10px;border-left:3px solid #a9623a;background:#faf6ee;font-size:11px;color:#635130}
      .foot{margin-top:20px;font-size:10px;color:#8a7a5a}
    </style></head><body>
    <h1>🎋 Kawayan Atlas — Fabrication cut-list</h1>
    <div class="totals">${schedule.totals.count} elements · ${schedule.totals.totalLength_m} m total${schedule.totals.jointCount > 0 ? ` · ${schedule.totals.jointCount} joints` : ""}${schedule.totals.estCulms > 0 ? ` · ~${schedule.totals.estCulms} culms` : ""}</div>
    <table><thead><tr><th>ID</th><th>Kind</th><th>Length</th><th>Detail</th><th>Nodes</th><th>Cut start°</th><th>Cut end°</th></tr></thead>
    <tbody>${rows}</tbody></table>
    ${schedule.joints.length ? `<h2>Joint schedule</h2>
    <table><thead><tr><th>ID</th><th>Type</th><th>Members</th><th>Meeting</th><th>Angle</th><th>Location (x, y, z)</th></tr></thead>
    <tbody>${schedule.joints
      .map(
        (j) =>
          `<tr><td>${j.id}</td><td>${j.type}</td><td>${j.members}</td><td>${j.memberIds}</td>` +
          `<td>${j.angle_deg != null ? `${j.angle_deg}°` : ""}</td><td>${j.x}, ${j.y}, ${j.z} m</td></tr>`,
      )
      .join("")}</tbody></table>` : ""}
    ${engineered ? `<div class="note"><strong>Validation status.</strong> This schedule contains processed or engineered bamboo (strips, splits, laminates). ISO 22156:2021 covers <em>round culms</em> and explicitly excludes glue-laminated, cross-laminated, oriented-strand, and densified bamboo — those elements have no settled international code path, and their structural validation rests on manufacturer data and project-specific engineering.</div>` : ""}
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
            {schedule.totals.jointCount > 0 && (
              <span><strong>{schedule.totals.jointCount}</strong> joints</span>
            )}
            {/* Only round-culm work is ordered as whole poles; a strip-only design has none. */}
            {schedule.totals.estCulms > 0 && (
              <span>~<strong>{schedule.totals.estCulms}</strong> culms</span>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-bamboo-50 text-bamboo-500">
                <tr>
                  <th className="px-3 py-1.5">ID</th>
                  <th className="px-2 py-1.5">Kind</th>
                  <th className="px-2 py-1.5">Length</th>
                  <th className="px-2 py-1.5">Nodes</th>
                  <th className="px-2 py-1.5">Detail</th>
                </tr>
              </thead>
              <tbody>
                {schedule.rows.map((r) => (
                  <tr key={r.id} className="border-t border-bamboo-100">
                    <td className="px-3 py-1 font-medium text-leaf-800">{r.id}</td>
                    <td className="px-2 py-1 capitalize">
                      {r.kind}
                      {r.verification === "outside-iso22156" && (
                        <span
                          title={VERIFICATION_LABEL["outside-iso22156"]}
                          className="ml-1 rounded bg-bamboo-100 px-1 text-[10px] font-semibold normal-case text-clay-600"
                        >
                          no code
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1 tabular-nums">{r.length_m} m</td>
                    <td className="px-2 py-1 tabular-nums text-bamboo-600">{r.nodes ?? "—"}</td>
                    <td className="px-2 py-1 text-bamboo-700">
                      {r.detail}
                      {r.layup && <div className="text-[10px] text-bamboo-500">{r.layup}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {schedule.joints.length > 0 && (
              <>
                <div className="border-t border-bamboo-200 bg-bamboo-50 px-3 py-1.5 text-xs font-semibold text-leaf-800">
                  Joint schedule
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-bamboo-50 text-bamboo-500">
                    <tr>
                      <th className="px-3 py-1.5">ID</th>
                      <th className="px-2 py-1.5">Type</th>
                      <th className="px-2 py-1.5">Meeting</th>
                      <th className="px-2 py-1.5">Angle</th>
                      <th className="px-2 py-1.5">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.joints.map((j) => (
                      <tr key={j.id} className="border-t border-bamboo-100">
                        <td className="px-3 py-1 font-medium text-leaf-800">{j.id}</td>
                        <td className="px-2 py-1 text-bamboo-700">{j.type}</td>
                        <td className="px-2 py-1 text-bamboo-600">{j.memberIds}</td>
                        <td className="px-2 py-1 tabular-nums">
                          {j.angle_deg != null ? `${j.angle_deg}°` : "—"}
                        </td>
                        <td className="px-2 py-1 tabular-nums text-bamboo-600">
                          {j.x}, {j.y}, {j.z} m
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
