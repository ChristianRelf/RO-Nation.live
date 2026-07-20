import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { register } from "../src/instrumentation";

// The boot preflight, for the game-pass rail specifically.
//
// src/instrumentation.ts refuses to start a production server that would send buyers
// to roblox.com to pay with no way to verify that they did. That guard is the kind of
// code that runs once, at 3am, on a deploy nobody is watching - so it is worth pinning
// down that it actually fires, rather than trusting that it would.
//
// What it CANNOT check is the OAuth app's scopes; those live at Roblox and cost a real
// grant to read. See the runbook in SEATING.md - steps 1-4 there are the human half.
//
// ---- On mutating process.env ----------------------------------------------
//
// This file rewrites NODE_ENV and the secret vars, which is only safe because
// vitest.config.ts sets `fileParallelism: false` - no other test file is running while
// this one is. Keys are restored individually rather than by reassigning process.env
// wholesale: in Node, `process.env = obj` replaces the magic object with a plain one and
// later writes stop reaching the real environment.

const ORIGINAL = { ...process.env };

/** Restore every key this file touches, without replacing process.env itself. */
function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(ORIGINAL)) {
    if (value !== undefined) process.env[key] = value;
  }
}

function sane() {
  process.env.NEXT_RUNTIME = "nodejs";
  // Next's types declare NODE_ENV readonly. It is not, and the preflight only runs
  // when it reads "production" - so setting it is the whole point of this fixture.
  (process.env as Record<string, string | undefined>).NODE_ENV = "production";
  process.env.AUTH_SECRET = "a-real-secret-0123456789abcdef";
  process.env.GAME_API_KEY = "a-real-game-key-0123456789";
  process.env.DATABASE_URL = "postgresql://u:realpassword@h:5432/d";
  delete process.env.ALLOW_DEV_LOGIN;
  delete process.env.ROBUX_GAMEPASS_ENABLED;
  delete process.env.ROBUX_TICKETS_ENABLED;
  delete process.env.ROBLOX_CLIENT_ID;
  delete process.env.ROBLOX_CLIENT_SECRET;
}

beforeEach(sane);
afterAll(restoreEnv);

describe("game-pass preflight", () => {
  it("boots fine with the rail off", async () => {
    await expect(register()).resolves.toBeUndefined();
  });

  it("REFUSES to boot with the rail on and no OAuth app", async () => {
    process.env.ROBUX_GAMEPASS_ENABLED = "true";
    process.env.ROBUX_TICKETS_ENABLED = "true";
    await expect(register()).rejects.toThrow(/could never be verified as having paid/);
  });

  it("boots with the rail on and OAuth creds present", async () => {
    process.env.ROBUX_GAMEPASS_ENABLED = "true";
    process.env.ROBUX_TICKETS_ENABLED = "true";
    process.env.ROBLOX_CLIENT_ID = "id";
    process.env.ROBLOX_CLIENT_SECRET = "secret";
    await expect(register()).resolves.toBeUndefined();
  });

  it("warns but does not refuse when the rail is inert", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.ROBUX_GAMEPASS_ENABLED = "true";
    process.env.ROBLOX_CLIENT_ID = "id";
    process.env.ROBLOX_CLIENT_SECRET = "secret";
    // master switch absent
    await expect(register()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("INERT"));
    warn.mockRestore();
  });
});
