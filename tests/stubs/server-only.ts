// Aliased in place of the real `server-only` package while running tests. That
// package exists only to make a build fail if a server module is pulled into a
// client bundle; in the test runner there is no such bundle, so it is a no-op.
export {};
