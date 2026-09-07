---
name: Smart v10.3 API ingestion boundary
description: The server-side contract that keeps uploaded PSD/PSB mockups fail-closed and aligned with the reviewed runtime role package.
---

Uploaded PSD/PSB mockups must never become `ready` from the presence of a preview alone. Readiness requires a reviewed Smart v10.3 manifest whose category/color/face identity matches the source-kit key, whose master metadata and SHA-256 match the upload metadata, and whose six runtime roles have approved paths, non-empty provenance labels, and checksums. The server renderer must consume that same contract and reject the legacy arbitrary base/mask/texture payload.

**Why:** A preview can look correct while the editable master, print geometry, or runtime role package points at a different surface. Marking it ready silently reintroduces unreviewed assets into export, cart, or order rendering.

**How to apply:** Keep arbitrary PSD/PSB uploads in `failed` with actionable errors. Only derive a manifest from the reviewed canonical runtime manifest for a matching canonical override; do not add a permissive fallback or manually toggle readiness in the admin UI.