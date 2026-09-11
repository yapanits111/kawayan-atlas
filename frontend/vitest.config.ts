import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Unit tests for the Design Lab's pure core (geometry kernel, evaluation engine, pole
// reconciliation) and the API client run in Node; React component tests (*.test.tsx) run
// in jsdom with Testing Library.
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Match Next's "@/..." -> "src/..." path alias so imports resolve under Vitest.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    environmentMatchGlobs: [["**/*.test.tsx", "jsdom"]],
    setupFiles: ["src/test/setup.ts"],
  },
});
