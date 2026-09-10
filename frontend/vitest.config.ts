import { defineConfig } from "vitest/config";

// Unit tests for the Design Lab's pure core (geometry kernel, evaluation engine, pole
// reconciliation). Node environment — none of these touch the DOM; the THREE mesh
// builders are only smoke-tested for buffer shape.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
