---
name: Print-area selection
description: Non-destructive Design Studio image selection behavior.
---

Selected image layers use the active product face's fixed print zone as the visible crop mask and control frame. Dragging the image repositions it under that mask; edge/corner handles scale its transform; the rotation control changes rotation. The source bitmap is not rewritten.

**Why:** a raw source-image selection rectangle makes the artwork appear disconnected from the product's printable edges, especially on mobile.

**How to apply:** keep the frame derived from the active face print-zone geometry, keep its controls pointer-active but the border pointer-transparent, and leave export/live compositor clipping as the final authority.