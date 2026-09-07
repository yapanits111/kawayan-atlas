"use client";

import dynamic from "next/dynamic";

// React Flow + WebGL are client-only.
const DesignEditor = dynamic(
  () => import("@/components/design/DesignEditor").then((m) => m.DesignEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[60vh] items-center justify-center text-bamboo-600">
        Loading Design Lab…
      </div>
    ),
  },
);

export default function DesignPage() {
  return <DesignEditor />;
}
