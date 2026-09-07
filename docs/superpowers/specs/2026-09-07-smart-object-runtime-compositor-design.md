# Smart Object Runtime Compositor

## Goal

Make the browser preview, thumbnails, exports, cart images, and API-rendered
mockups use the same PSD/PSB-derived full-canvas layer order. Artwork must sit
inside the printable Smart Object zone while product details that belong above
the artwork—especially hoodie drawstrings, hood seams, collars, cuffs, handles,
and bottle hardware—remain visible.

## Source and runtime contract

The private PSD/PSB masters remain the editable source of truth. The browser
does not receive or render those masters directly. Each approved surface uses
the validated six browser-safe runtime roles:

1. `studioBackground`
2. `base`
3. user artwork clipped to the Smart Object print zone
4. `shadow` with multiply compositing
5. `highlight` with screen compositing
6. `protected` with source-over compositing

The API continues to validate the master, source identity, geometry, checksums,
and six-role manifest before a surface is approved.

## Implementation

The shared canvas compositor remains the only customer-facing render path. The
live 3D viewer will request the complete composed canvas rather than an
artwork-only texture cropped to the print zone. The photo billboard receives
that full composite as one texture, preserving the same product frame while
keeping full-canvas protected details in the result.

The WebGL-less fallback and server/export paths will use the same full
compositor. The mug wrap path will compose each face with the same full result
before placing the faces on the cylindrical texture.

## Error handling

Disabled surfaces, missing roles, contract errors, and image load failures
continue to fail explicitly. No placeholder garment or synthetic fallback is
introduced for an approved surface.

## Verification

Add regression coverage for the live compositor contract and protected-detail
ordering, then run the complete storefront tests, typecheck, production build,
workflow smoke checks, and visual preview verification across the catalog.