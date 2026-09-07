"use client";

import type { CheckResult } from "@/lib/design/types";

export function ChecksPanel({ checks }: { checks: CheckResult | null }) {
  if (!checks) {
    return (
      <div className="p-3 text-xs text-bamboo-600">
        Add a <strong>Check (advisory)</strong> node after your elements to run coarse
        geometric sanity checks.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-clay-400/40 bg-clay-400/10 px-3 py-2 text-xs text-bamboo-900">
        <strong>Advisory only — not a verified analysis.</strong> {checks.disclaimer}
      </div>
      <div className="flex gap-4 border-b border-bamboo-100 px-3 py-1.5 text-xs text-bamboo-700">
        <span><strong>{checks.summary.checked}</strong> checked</span>
        <span><strong>{checks.summary.flagged}</strong> flagged</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {checks.flags.length === 0 ? (
          <div className="p-3 text-xs text-leaf-700">
            No geometric slenderness warnings at the current limit. (Still not a verified
            structure.)
          </div>
        ) : (
          <ul className="divide-y divide-bamboo-100 text-xs">
            {checks.flags.map((f, i) => (
              <li key={i} className="flex gap-2 px-3 py-1.5">
                <span
                  className={
                    f.severity === "warning" ? "text-clay-600" : "text-bamboo-500"
                  }
                >
                  {f.severity === "warning" ? "⚠" : "ℹ"}
                </span>
                <span className="font-medium text-leaf-800">{f.elementId}</span>
                <span className="text-bamboo-800">{f.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
