// Fail-fast on insecure configuration - at SERVER STARTUP, not at build.
//
// register() is Next's one hook that runs once when the server actually boots to
// serve traffic, and that timing is the whole point. `next build` sets
// NODE_ENV=production with none of these secrets present, so a build-time check
// would fail every CI build and every Docker image build. This fires only on a
// real boot, where the secrets are supposed to be there - and refuses to come up
// if they are still the shipped defaults.
//
// The risk it closes: AUTH_SECRET silently falls back to a known string
// (lib/env.ts, docker-compose.yml). With the default in place, session cookies are
// signed with a secret that is in the public repo - so anyone can forge one and be
// any user, including a ranked one. A site that boots in that state looks perfectly
// healthy right up until it is owned. Better to not boot.

export async function register() {
  // Node.js server runtime only. The edge runtime (e.g. the OG image route) runs
  // register() too but has a restricted process.env, and these secrets are a
  // Node-server concern - so skip it there rather than false-positive.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;

  const problems: string[] = [];

  // The two known AUTH_SECRET defaults: lib/env.ts's fallback and the one baked
  // into docker-compose.yml. Either means forgeable sessions.
  const authSecret = process.env.AUTH_SECRET ?? "";
  const AUTH_DEFAULTS = [
    "dev-insecure-secret-change-me",
    "please-change-this-secret",
    "change-me-to-a-long-random-string",
  ];
  if (!authSecret || AUTH_DEFAULTS.includes(authSecret) || authSecret.length < 16) {
    problems.push(
      "AUTH_SECRET is unset, too short (<16 chars), or a known default - session cookies would be forgeable.",
    );
  }

  // The game/API root key. Its defaults are docker-compose.yml's "change-me" and
  // .env.example's placeholder. A guessed root key is unscoped access to every
  // write endpoint (lib/apikey.ts).
  const gameApiKey = process.env.GAME_API_KEY ?? "";
  const GAME_DEFAULTS = ["change-me", "change-me-to-a-long-random-string"];
  if (!gameApiKey || GAME_DEFAULTS.includes(gameApiKey)) {
    problems.push(
      "GAME_API_KEY is unset or a known default - it is an unscoped master key for the write API.",
    );
  }

  // The Postgres password, as it appears in DATABASE_URL. The compose default is
  // postgresql://ronation:ronation@db:5432/… - the ":ronation@" is the password
  // nobody changed; ":please-change" catches an obviously-templated one.
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (/:ronation@/.test(dbUrl) || /:please-change[^@]*@/.test(dbUrl)) {
    problems.push(
      "DATABASE_URL still carries the default Postgres password - set POSTGRES_PASSWORD.",
    );
  }

  // The dev-login backdoor (src/app/api/auth/dev/route.ts) mints a member session
  // for any username with no credential - it exists for local demos only. It is
  // normally gated by the ABSENCE of Roblox creds, but a production instance
  // brought up before its OAuth app is provisioned would leave that gate open, so
  // refuse to boot if it is explicitly enabled here. (The route itself also 404s
  // in production now; this stops the misconfiguration at the door.)
  if (process.env.ALLOW_DEV_LOGIN === "true") {
    problems.push(
      "ALLOW_DEV_LOGIN is 'true' - the credential-free dev login backdoor must not be enabled in production.",
    );
  }

  if (problems.length > 0) {
    const line = "═".repeat(60);
    const message = [
      "",
      line,
      " FATAL: refusing to start in production with insecure configuration",
      line,
      ...problems.map((p) => `  ✗ ${p}`),
      "",
      "  Set real secrets in the environment and restart. See .env.example.",
      line,
      "",
    ].join("\n");

    // Throwing from register() aborts server startup - which is exactly the point.
    throw new Error(message);
  }
}
