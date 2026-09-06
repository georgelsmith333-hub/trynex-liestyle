---
name: Smart release status
description: The status contract between regenerated staging manifests and structural versus visual Smart Mockup release gates.
---

Regenerated Smart Mockup staging manifests can intentionally remain `candidate` while the runtime-role manifest is accepted. Structural validation must accept that staging state and emit a separate `structurally-verified` release result; visual approval stays false until explicit visual review.

**Why:** The generator uses `candidate` to keep visual promotion fail-closed, while the release gate needs to validate the new PSD/runtime package before any visual decision.

**How to apply:** Treat 188-surface structural checks, runtime-role checks, and visual approval as separate gates. Never change `visualApproval` or use `--approve-visual` merely to make a structural validator pass.