"use client";

import { useState } from "react";
import { SchedulePanel } from "./SchedulePanel";
import { ChecksPanel } from "./ChecksPanel";
import { InventoryPanel } from "./InventoryPanel";
import type { CheckResult, InventoryReport, Schedule } from "@/lib/design/types";

type Tab = "cutlist" | "checks" | "inventory";

export function OutputPanel({
  schedule,
  checks,
  inventory,
}: {
  schedule: Schedule | null;
  checks: CheckResult | null;
  inventory: InventoryReport | null;
}) {
  const [tab, setTab] = useState<Tab>("cutlist");
  const flagCount = checks?.summary.flagged ?? 0;
  const unplaced = inventory?.unmatched.length ?? 0;

  const tabs: { key: Tab; label: string }[] = [
    { key: "cutlist", label: "Cut-list" },
    { key: "checks", label: `Checks${flagCount > 0 ? ` (${flagCount})` : ""}` },
    { key: "inventory", label: `Inventory${unplaced > 0 ? ` (${unplaced}!)` : ""}` },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 border-b border-bamboo-200 bg-bamboo-50 px-2 pt-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-t-md px-3 py-1 text-xs font-semibold ${
              tab === t.key ? "bg-white text-leaf-800" : "text-bamboo-600 hover:text-leaf-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {tab === "cutlist" ? (
          <SchedulePanel schedule={schedule} />
        ) : tab === "checks" ? (
          <ChecksPanel checks={checks} />
        ) : (
          <InventoryPanel report={inventory} />
        )}
      </div>
    </div>
  );
}
