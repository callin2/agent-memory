import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["tests/vitest.setup.ts"],
    include: [
      "tests/unit/**/*.test.ts",
      "tests/scenarios/**/*.test.ts",
      "tests/integration/**/*.test.ts",
    ],
    // Scenario files `tests/scenarios/a*.test.ts` are executable scenario definitions for
    // the custom runner (`tests/scenarios/index.ts`), not Vitest suites.
    exclude: ["node_modules", "dist", "tests/scenarios/a*.test.ts"],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
});
