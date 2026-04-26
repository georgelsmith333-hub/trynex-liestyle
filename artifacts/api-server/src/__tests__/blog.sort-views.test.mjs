// Smoke tests for the GET /api/blog?sort=views endpoint (Task #15).
//
// Run against a live API server (defaults to http://localhost:8080):
//   API_BASE=http://localhost:8080 node artifacts/api-server/src/__tests__/blog.sort-views.test.mjs

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

console.log(`blog sort=views tests against ${BASE}`);

await test("GET /api/blog returns 200 with posts array", async () => {
  const r = await fetch(`${BASE}/api/blog?published=true&limit=10`);
  assert.equal(r.status, 200, `expected 200, got ${r.status}`);
  const body = await r.json();
  assert.ok(Array.isArray(body.posts), "expected posts to be an array");
});

await test("GET /api/blog?sort=views returns 200 with posts array", async () => {
  const r = await fetch(`${BASE}/api/blog?published=true&sort=views&limit=10`);
  assert.equal(r.status, 200, `expected 200, got ${r.status}`);
  const body = await r.json();
  assert.ok(Array.isArray(body.posts), "expected posts to be an array");
});

await test("GET /api/blog?sort=views returns posts ordered by viewCount descending", async () => {
  const r = await fetch(`${BASE}/api/blog?published=true&sort=views&limit=50`);
  assert.equal(r.status, 200, `expected 200, got ${r.status}`);
  const { posts } = await r.json();
  if (posts.length < 2) return;
  for (let i = 1; i < posts.length; i++) {
    assert.ok(
      posts[i - 1].viewCount >= posts[i].viewCount,
      `posts[${i - 1}].viewCount (${posts[i - 1].viewCount}) < posts[${i}].viewCount (${posts[i].viewCount}) — not sorted desc`
    );
  }
});

await test("GET /api/blog (no sort param) returns posts with newest first", async () => {
  const r = await fetch(`${BASE}/api/blog?published=true&limit=50`);
  assert.equal(r.status, 200, `expected 200, got ${r.status}`);
  const { posts } = await r.json();
  const nonFeatured = posts.filter(p => !p.featured);
  if (nonFeatured.length < 2) return;
  for (let i = 1; i < nonFeatured.length; i++) {
    const a = new Date(nonFeatured[i - 1].createdAt).getTime();
    const b = new Date(nonFeatured[i].createdAt).getTime();
    assert.ok(
      a >= b,
      `posts[${i - 1}].createdAt (${nonFeatured[i - 1].createdAt}) is older than posts[${i}].createdAt (${nonFeatured[i].createdAt})`
    );
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
