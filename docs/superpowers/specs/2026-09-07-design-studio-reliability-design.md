# Design Studio Reliability and Smart v10.3 Contract

## Goal

Make the customer Design Studio trustworthy across all six product families, valid
faces, responsive breakpoints, cart/export flows, and the reviewed Smart v10.3
runtime. The editor must expose deterministic image selection, zoom, transform,
crop, and four-sided canvas extension behavior without requiring deep design tools.
The runtime must preserve product geometry and PSD/PSB provenance without exposing
editable masters publicly.

## Architecture

The existing realtime browser editor remains the source of interaction state. A
shared normalized surface model is the boundary between product resolution,
compositing, 2D interaction, 3D preview, export, cart, and order metadata.

- Surface geometry is represented in one explicit normalized coordinate space and
  converted only at asset/render boundaries.
- Canvas interaction receives only layers for the active product face.
- Zoom and pan are stage transforms; pointer coordinates are inverse-transformed
  before layer hit testing and mutation.
- Crop changes the source image and extension stores independent left, right, top,
  and bottom offsets. The displayed artwork bounds are preserved when possible.
- Mug Wrap resolves the canonical Wrap surface and uses an explicit equirectangular
  composition rather than treating front and back as a generic pair.
- 2D and 3D composition share resolved curvature, role ordering, and protected
  detail semantics. A 3D artwork texture must not duplicate a photographic base or
  protected role pass.
- PSD/PSB identity is stored as versioned metadata in the cart/order boundary.
  Masters remain private/staging-only; only reviewed runtime derivatives are public.

## Data flow

1. Product and face selection resolve a canonical surface and normalized print zone.
2. The editor filters layers to that face and renders the selected layer bounds,
   controls, and current stage transform.
3. Image tools update source pixels plus crop/extension metadata and preserve a
   single grouped history transaction.
4. The same resolved surface and layer state feed the 2D compositor, 3D texture,
   export payload, and cart snapshot.
5. Cart/checkout persist the approved runtime identity and editable master
   provenance as metadata only.
6. The API validates the identity and runtime role checksums at order/render
   boundaries; incomplete or candidate surfaces fail closed.

## Error handling

- Missing, candidate, checksum-mismatched, or geometrically unsafe surfaces remain
  unavailable rather than falling back to a different color, face, or family.
- Remote image tools set CORS before loading and show a recoverable error when a
  source cannot be exported safely.
- Export and cart errors remain actionable and do not silently replace a failed
  surface with a white T-shirt or neutral placeholder.
- Production gateway behavior is verified through the proxied API path, including
  the mockup render POST.

## Verification

- Static contract tests cover all six families, canonical faces, normalized frame
  conversion, Wrap routing, role metadata, and runtime-to-master links.
- Store tests cover zoom/pan, active-face filtering, click/double-click semantics,
  grouped transform/tool history, four-sided extension, and crop round-trips.
- Typechecks, focused/full available tests, production builds, matrix validators,
  Smart Object audits, proxied API checks, and desktop/tablet/mobile previews run
  after reconciliation.
- GitHub `main` is updated only after the local source and runtime checks pass.