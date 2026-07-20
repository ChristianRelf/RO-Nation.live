import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    // Every test file shares one Postgres and takes row locks on it. Running files
    // in parallel would have them stepping on each other's rows between resets, so
    // the concurrency being tested has to happen WITHIN a test, not across files.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Injected into the worker process (globalSetup runs in a different process, so
    // env set there would not reach the tests). A real, non-default AUTH_SECRET keeps
    // the instrumentation fail-fast happy if anything imports it; ROBUX on lets the
    // paid-tier idempotency fixtures actually issue.
    env: {
      AUTH_SECRET: "test-secret-not-a-default-0123456789",
      ROBUX_TICKETS_ENABLED: "true",
      // The third key. Both are required by gamePassSalesAllowed(), so without this
      // every game-pass test would pass for the wrong reason: "payments_off" is a
      // refusal, and a suite that only ever sees the switch shut proves nothing about
      // the rail behind it. The pure-function matrix in gamepass-rail.test.ts passes
      // its switches explicitly and does not read these.
      ROBUX_GAMEPASS_ENABLED: "true",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // server-only throws the moment it is imported outside a React Server
      // Component bundle. In the test runner it is meaningless - alias it to an
      // empty module so importing the server libs under test does not blow up.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});
