// Happy-path auth smoke tests for Task #8.
//
// Run against a live API server (defaults to http://localhost:8080):
//   API_BASE=http://localhost:8080 node artifacts/api-server/src/__tests__/auth.happy-path.test.mjs
//
// Tests:
//   1. POST /api/auth/guest         -> returns username + password + token
//   2. POST /api/auth/google (stub) -> in dev, accepts an unsigned credential
//                                     and returns a customer token
//
// Notes:
//   * Test #2 uses the dev fallback path (GOOGLE_CLIENT_ID unset). In
//     production the same endpoint REQUIRES a real Google-signed token.
//   * Tests are idempotent — guest sequence is auto-incremented; google
//     stub uses a unique sub/email per run.

import assert from "node:assert/strict";

const BASE = process.env.API_BASE ?? "http://localhost:8080";

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ok  ${name}`);
    passed += 1;
  } catch (err) {
    console.log(`  FAIL ${name}`);
    console.log(`       ${err.message}`);
    failed += 1;
  }
}

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

console.log(`auth happy-path tests against ${BASE}`);

await test("POST /api/auth/guest returns username + password + token", async () => {
  const r = await fetch(`${BASE}/api/auth/guest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Smoke Test Buyer" }),
  });
  assert.equal(r.status, 200, `expected 200, got ${r.status}`);
  const body = await r.json();
  assert.equal(body.success, true, "expected success:true");
  assert.ok(body.username, "missing username");
  assert.ok(body.password, "missing password");
  assert.ok(body.token, "missing token");
  assert.ok(body.customer?.email?.endsWith("@trynex.guest"), "guest email shape wrong");
  assert.equal(body.isGuest, true);
});

await test("POST /api/auth/google with unsigned dev credential returns a customer", async () => {
  const sub = `test-${Date.now()}`;
  const email = `smoke-${Date.now()}@example.com`;
  const header = b64url({ alg: "none", typ: "JWT" });
  const payload = b64url({
    sub,
    email,
    name: "Smoke Google User",
    email_verified: true,
    exp: Math.floor(Date.now() / 1000) + 3600,
    aud: process.env.GOOGLE_CLIENT_ID || "stub",
  });
  const credential = `${header}.${payload}.signature`;

  const r = await fetch(`${BASE}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });

  // In production with GOOGLE_CLIENT_ID set, signature verification will
  // (correctly) reject this stub. That is the expected secure path.
  if (process.env.NODE_ENV === "production" && process.env.GOOGLE_CLIENT_ID) {
    assert.equal(r.status, 401, "production must reject unsigned tokens");
    return;
  }

  assert.equal(r.status, 200, `expected 200 in dev, got ${r.status}`);
  const body = await r.json();
  assert.equal(body.success, true);
  assert.ok(body.token);
  assert.equal(body.customer?.email, email);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
