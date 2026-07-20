// The session cookie's NAME, and nothing else.
//
// It lives in its own module for one reason: the middleware needs it, and
// lib/session.ts - where it used to be, and where everything that actually reads a
// session still lives - opens with `import "server-only"`. Middleware runs on the
// edge, so importing that file from it throws at build.
//
// The alternative was to retype "ron_session" in middleware.ts. That string is the
// difference between the portal's sign-in gate working and silently sending every
// signed-in person back to the login page forever, and a typo in it would not fail
// any build or any test - it would just quietly gate everybody out. One constant,
// imported by both.
//
// NOTE what is deliberately NOT here: cookieOptions, the signing key, and every
// function that mints or verifies a session. Those stay in lib/session.ts behind
// server-only, because the edge has no business holding them - see the long note on
// the gate in middleware.ts about why it checks only that the cookie EXISTS.
export const USER_COOKIE = "ron_session";
