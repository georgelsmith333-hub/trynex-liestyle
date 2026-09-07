# Design Studio Correction Design

Date: 2026-09-07
Status: approved for implementation

## Goal

Make the customer-facing TryNex Design Studio trustworthy on desktop and mobile:
uploaded artwork must remain visibly composited onto the selected photoreal
product, touch editing must feel deliberate, background removal must fail fast
without losing the original, and the add-to-cart action must remain reachable at
the bottom of a phone viewport.

## Scope

- Public `/design-studio` customer flow.
- 2D editor, 3D preview, export, cart snapshot, and persisted studio draft.
- T-shirt, long sleeve, hoodie, mug, cap, and water bottle mockup families.
- No replacement of the validated Smart v10.3 runtime or private PSD/PSB contract.
- No changes to storefront auth, payments, order persistence, or admin permissions.

## Design decisions

### 1. One visible preview authority

The live 2D preview uses the canonical surface and runtime roles in a
deterministic order: studio background, product base, artwork clipped to the
print zone with approved shading, then protected details/highlights. A failed or
in-flight render keeps the previous successful frame visible and presents a
small non-blocking status. The SVG product layer remains an interaction-safe
fallback for empty/disabled surfaces, not a second competing product silhouette.

The same surface, print-zone geometry, and layer data continue to feed 3D,
server export, cart previews, and persisted drafts.

### 2. Immediate upload and intentional tools

File upload decodes and places the source immediately. Auto-fix is optional
post-processing and cannot delay first paint. One tap selects an image, while a
double tap/double click opens the image tools. Selection frames, resize handles,
rotate, and delete controls use pointer capture, stop propagation, and minimum
44px touch targets. Original image data stays unchanged if any processing step
fails.

Background removal is local-first where available, has a short server timeout,
and always exposes clear progress/error feedback. The original layer remains
usable after timeout, rate limit, decode, or transparency-validation failure.

### 3. Responsive composition

Desktop keeps the canvas and tools visible together. Mobile uses a dedicated
bottom sheet with a stable scroll region, explicit drag handle, safe-area
padding, and no overlap between tools, canvas controls, and purchase actions.
The tools FAB is positioned relative to the purchase dock.

### 4. Sticky purchase dock

Mobile receives one fixed bottom purchase dock with product context, quantity,
price, validation state, and a large add-to-cart button. It uses viewport-safe
area padding and reserves document space so it never covers the editor. The
desktop header action remains the primary desktop CTA; mobile does not duplicate
competing floating CTAs.

### 5. Mockup acceptance audit

For each family, verify canonical faces/colors, print mask bounds, protected
details, 2D preview, 3D preview, export, and cart thumbnail. Mug side/wrap
routing and bottle cap/key-ring details are explicit checks. Missing or
unreviewed assets fail closed; no legacy namespace or synthetic fallback is
introduced.

## Error handling

- Keep the last good visual frame while image assets load.
- Show actionable, non-destructive errors for upload, processing, export, and
  cart preparation.
- Disable checkout/export only when the surface contract or print quality
  genuinely blocks the operation, and explain why.
- Never discard original artwork because a derived image operation failed.

## Verification

Run focused editor/compositor tests, storefront typecheck and production build,
API typecheck/build where touched, mockup matrix validators, and proxied
desktop/mobile preview checks. Exercise upload → visible mockup → select →
drag/resize/rotate → crop/extend → optional background removal → 2D/3D →
export/cart, while checking browser console output and safe-area behavior.