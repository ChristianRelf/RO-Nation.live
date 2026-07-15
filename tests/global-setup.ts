import { execSync } from "node:child_process";

// Brings up a real Postgres for the suite, then applies the schema to it.
//
// Two ways in, in priority order:
//
//   1. DATABASE_URL is already set  → use it as-is. This is how CI runs (a Postgres
//      service container) and how a dev with their own database runs.
//   2. embedded-postgres is installed → boot a throwaway instance. This is the
//      "no Docker, no admin" path documented in SEATING.md; install it with
//      `npm i -D embedded-postgres` and it is picked up automatically.
//
// Either way, `prisma db push` then makes the schema match. The tests exercise the
// real seat/lock/idempotency logic against real Postgres row locks - an in-memory
// fake would prove nothing, because the thing under test IS the database behaviour.

export default async function setup() {
  let stopEmbedded: (() => Promise<void>) | null = null;

  if (!process.env.DATABASE_URL) {
    // Non-literal specifier so `tsc` does not try to resolve an optional dep that
    // is not installed in CI (CI uses the service container instead).
    const spec = "embedded-postgres";
    let EmbeddedPostgres: any;
    try {
      ({ default: EmbeddedPostgres } = await import(spec));
    } catch {
      throw new Error(
        "No DATABASE_URL set and embedded-postgres is not installed.\n" +
          "  • CI / your own DB: export DATABASE_URL=postgresql://…\n" +
          "  • Local throwaway:  npm i -D embedded-postgres, then run again.",
      );
    }

    const port = 55432;
    const pg = new EmbeddedPostgres({
      databaseDir: "./.pgdata-test",
      user: "rnl",
      password: "rnl",
      port,
      persistent: false,
    });
    await pg.initialise();
    await pg.start();
    await pg.createDatabase("rnl");
    process.env.DATABASE_URL = `postgresql://rnl:rnl@127.0.0.1:${port}/rnl`;
    stopEmbedded = async () => {
      await pg.stop();
    };
  }

  // Make the schema match. --skip-generate: the client is generated in its own step
  // (and already is, locally). --accept-data-loss is safe here - it is a test DB.
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    stdio: "inherit",
    env: process.env,
  });

  return async () => {
    if (stopEmbedded) await stopEmbedded();
  };
}
