"use client";

import { useState } from "react";
import { SchedulePanel } from "./SchedulePanel";
import { ChecksPanel } from "./ChecksPanel";
import type { CheckResult, Schedule } from "@/lib/design/types";

export function OutputPanel({
  schedule,
  checks,
}: {
  schedule: Schedule | null;
  checks: CheckResult | null;
}) {
  const [tab, setTab] = useState<"cutlist" | "checks">("cutlist");
  const flagCount = checks?.summary.flagged ?? 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 border-b border-bamboo-200 bg-bamboo-50 px-2 pt-1.5">
        <button
          onClick={() => setTab("cutlist")}
          className={`rounded-t-md px-3 py-1 text-xs font-semibold ${
            tab === "cutlist" ? "bg-white text-leaf-800" : "text-bamboo-600 hover:text-leaf-700"
          }`}
        >
          Cut-list
        </button>
        <button
          onClick={() => setTab("checks")}
          className={`rounded-t-md px-3 py-1 text-xs font-semibold ${
            tab === "checks" ? "bg-white text-leaf-800" : "text-bamboo-600 hover:text-leaf-700"
          }`}
        >
          Checks{flagCount > 0 ? ` (${flagCount})` : ""}
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {tab === "cutlist" ? (
          <SchedulePanel schedule={schedule} />
        ) : (
          <ChecksPanel checks={checks} />
        )}
      </div>
    </div>
  );
}
