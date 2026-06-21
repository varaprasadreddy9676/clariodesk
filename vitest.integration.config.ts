import { defineConfig } from "vitest/config";

// Integration tests use Testcontainers (real Postgres) and need Docker running.
// Kept separate from the fast unit suite so `npm test` stays Docker-free.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.itest.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    pool: "forks",
  },
});
