# Print-area selection controls

## Goal

When a customer clicks an uploaded image once in the Design Studio, the board
must make the product's printable area obvious instead of drawing the selection
box around the source bitmap. The customer should be able to reposition, scale,
and rotate the image while understanding that the print zone is the fixed crop
mask.

## Approved interaction

- The print-zone rectangle is fixed to the active product face geometry.
- The selected image remains draggable from its own Konva node.
- The print-zone frame shows eight edge/corner scale handles and a rotation
  handle. These controls update the image transform, not the source file.
- The image can extend beyond the frame; the shared compositor clips it to the
  print zone for product previews, exports, cart images, and orders.
- Non-image layers retain the existing layer-bounds transformer.
- The delete control follows the print-zone frame for selected images.

## Visual behavior

- The frame uses the existing orange TryNex accent and dashed border.
- A subtle dimmed outside-mask clarifies what will be cropped without hiding
  the editable image.
- The frame is pointer-transparent except for its controls, so normal image
  dragging still works.
- Mobile touch targets remain at least 16px for handles and 32px for rotation.

## Verification

- Typecheck and storefront regression tests must pass.
- The production build must pass.
- The Design Studio route must load without browser console errors at mobile and
  desktop sizes.
- The remaining manual visual check is selecting a real uploaded image and
  confirming the frame follows each active product face's print-zone geometry.