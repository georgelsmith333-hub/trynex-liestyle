---
name: Full-canvas Smart Object compositor
description: Runtime layer order and live-preview rule for PSD/PSB-derived mockups.
---

All customer-facing mockup paths must use one full-canvas composition: studio background, product base, artwork clipped to the Smart Object print zone, shadow multiply, highlight screen, then protected details source-over. The live viewer must not use an artwork-only print-zone texture as its product overlay.

**Why:** cropping the artwork texture before mapping it to the billboard removes full-canvas foreground details such as hoodie drawstrings and seams, making a real layered mockup look like a flat rectangle.

**How to apply:** keep the six runtime roles aligned across browser preview, WebGL fallback, thumbnails, cart/export, and API rendering; keep `protected` as the final foreground pass.