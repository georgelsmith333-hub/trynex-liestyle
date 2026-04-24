# /design-studio — End-to-End Bug Audit

**URL:** https://trynexshop.com/design-studio
**Date:** April 24, 2026
**Method:** Static page inspection + screenshots at 1280×720 across multiple URL parameters (`?product=...`, `?tab=...`, `?view=back`). I cannot click, drag, type, upload, or submit on an external site, so anything that depends on a real interaction is flagged "verify manually" — but everything I list below is either visible in the screenshots, present in the page source, or reproducibly broken via URL.

---

## A. Critical / Blocking Bugs

### A1. The Design Studio has zero URL state — every action is lost on refresh and cannot be shared
I tried five different URL parameters that any reasonable design tool should respect:

| URL | Expected | Actual |
|---|---|---|
| `/design-studio?product=mug` | Coffee Mug selected | Default Unisex T-Shirt |
| `/design-studio?product=hoodie` | Hoodie selected | Default Unisex T-Shirt |
| `/design-studio?tab=text` | Text panel open | Default Upload panel |
| `/design-studio?tab=templates` | Templates panel open | Default Upload panel |
| `/design-studio?view=back` | Back of garment shown | Front shown |

This means: a customer cannot bookmark "I was designing a black hoodie back-side", cannot share the in-progress design over WhatsApp (your most common channel), cannot recover their work if they accidentally close the tab, cannot return from a "Sign in to save" prompt without losing everything, and Google can't index any product-specific design page. Every other modern customizer (Printful, Custom Ink, Vistaprint) preserves state in URL or local storage.

### A2. The garment mock-up image overflows the canvas
At 1280×720 the t-shirt model is so large that:
- Both sleeves are clipped by the left and right edges of the canvas container
- The hem is clipped by the bottom
- The "Print Area" dashed orange rectangle covers roughly 70% of the visible shirt height — far larger than any real screen-print zone (a real DTG print area is typically ~12×16 inches, ~⅓ of the shirt height)

On a phone or smaller laptop, this will be much worse — the user will only see part of the shirt and most of the canvas will be cropped sleeves.

### A3. Both "Add to Cart" buttons look disabled
The same defect from the broader site audit is concentrated here:
- **Top-right "Add to Cart"** — faded orange, looks identical to a disabled state
- **Bottom-right "Add Custom Unisex T-Shirt to Cart"** — same faded orange

In a flow where the entire goal of the page is "design then add to cart," the add-to-cart button must look unmistakably active. If anything, fade these buttons *only* when the user has not yet added a design (with helper text saying "upload an image or text first").

### A4. White color swatch is invisible on the white background
The first color circle in the color row is white, sitting on a `#FDFCFC` near-white canvas with no visible border. A first-time user will think the color row starts at black. Add a 1 px gray border on every swatch (especially light ones) and a solid 2 px brand-orange ring on the currently selected one.

### A5. No selected-color or selected-size indicator visible in default state
Looking at the screenshots, none of the 12 color circles have any "you are here" affordance, and only Size **M** is visibly highlighted (correctly). The selected color must show a clear ring; without it, users will click colors and not know which one they picked, especially after the page is rendering its preview in greyscale shirt only.

### A6. Two competing upload affordances are shown simultaneously
The right side panel has a big orange **"Upload Image"** button.
The center canvas has a separate **"Upload or add text · JPG, PNG · or pick a Template"** drop-zone box *inside* the Print Area dashed rectangle.

These do (presumably) the same thing. New users will not know which to use, and the inner box visually competes with the actual print preview area. Pick one upload entry point.

### A7. URL parameters that don't work also don't fail safely
None of the parameters above produce a 404 or a redirect — the page silently ignores them and acts as if they were never sent. That means a marketing email or a paid ad that sends a customer to `/design-studio?product=hoodie` will load the wrong product without any indication of failure. This is hard to debug after the fact and silently loses sales.

---

## B. High-Priority Functional Bugs (require manual verification on a real interactive session, but the page structure strongly suggests they exist)

> The following items I could not click-test, but are flagged because the static HTML, the labels, and the markup pattern make them very likely. Please walk through each one in a real browser.

### B1. Switching product likely doesn't update price, size options, or material badge
The page shows:
- Quantity row: "1 × ৳**480** = ৳480"
- Material badge: "**230GSM Cotton**"
- Size selector: **XS S M L XL XXL XXXL** (cotton-shirt sizes)

None of those are sensible defaults for Coffee Mug, Cap, or Water Bottle. Verify that clicking "Coffee Mug" actually:
- Changes the price (mug is ৳449 on the shop, not ৳480)
- Hides the size selector (mugs don't have apparel sizes)
- Hides or replaces the "230GSM Cotton" badge (mug is ceramic, not cotton)
- Shows a mug mock-up instead of the t-shirt photo

If any of these don't update, the customer will pay ৳480 for a ৳449 mug or vice-versa — that's a refund/chargeback risk and a brand-trust problem.

### B2. Cap likely shows wrong size options
Caps don't come in XS–XXXL — they come in One Size or S/M/L. Verify the cap product hides or replaces the apparel size pills.

### B3. Front / Back toggle presumably works for t-shirts but is meaningless for mug, cap, water bottle
Verify those products either hide the Front/Back toggle entirely, or show actually different mock-ups (mug-handle-left vs mug-handle-right is a real consideration; cap top vs cap front is another).

### B4. Print Area on the back of the shirt should differ from front
The back print area on a t-shirt is usually different (smaller, higher) than the front. Verify the dashed rectangle changes when you click "Back."

### B5. Add-to-cart with no design uploaded
Click "Add Custom Unisex T-Shirt to Cart" without uploading anything or adding any text. Either:
- The button is silently inactive (then it should be greyed out and the helper text should say so), or
- A blank custom shirt gets added to the cart at the custom-shirt price (then the customer pays a custom premium for a plain shirt and you have to refund them)

Both outcomes are bad. Correct behavior: button stays inactive until at least one design element exists, with hover text explaining why.

### B6. Image upload validation
The label says "JPG, PNG, or WebP · Max 10MB". Verify what happens when the user uploads:
- A 12 MB file (rejected with clear message? or silent failure?)
- A `.gif`, `.bmp`, `.heic` (very common from iPhones), `.svg`, `.pdf`
- A 200×200 px image (will print blurry — should warn)
- A CMYK image vs sRGB image (printers need RGB; should auto-convert or warn)
- A transparent-background PNG (works correctly?)
- An image with EXIF rotation (auto-rotated correctly?)

A real custom-print shop must catch low-resolution uploads — otherwise the customer pays for a custom shirt, receives a blurry one, and demands a refund.

### B7. Text tool — no font, color, alignment, or size specified
Clicking the "Text" tab presumably opens a panel. Verify it offers at minimum: font family, font size, color, alignment, bold/italic, and live preview. With nothing else than a text input, the customer will end up with default Arial 16 pt black, which is almost certainly not what they want.

### B8. Templates tab — verify it actually has templates
Page source contains the literal string "Templates" but I couldn't reach the panel. If clicking Templates opens an empty panel or a "Coming soon" message, hide the tab entirely until you have content.

### B9. Layers tab — verify it manages a real layer list
Same — verify the Layers tab does what users expect (reorder, lock, delete, hide individual elements). If it's empty or does nothing, hide it.

### B10. Print Zone toggle (eye icon, top right)
Has an eye icon, presumably toggles the dashed Print Area outline. Verify:
- It actually toggles (and the icon state changes correctly)
- It's keyboard accessible
- Hidden state still preserves the print constraint

### B11. Undo / Redo buttons
Verify they actually work, support Ctrl+Z / Ctrl+Shift+Z, and grey out correctly when there's nothing to undo / redo. In every screenshot they appear permanently greyed.

### B12. Cart hand-off
Verify that when you add a custom design to cart, the cart actually shows:
- A thumbnail of the rendered design (not just "Custom T-Shirt")
- The size, color, garment selected
- A way to edit the design from the cart (round-trips back to /design-studio with state restored — which it can't, per A1)

If the cart only shows generic info, customers will worry their design was lost.

### B13. Mobile drag & drop / pinch-to-zoom
The whole concept of a design studio breaks down without good touch interactions. Verify on a real phone whether you can:
- Drag your design inside the print area
- Pinch to scale
- Two-finger rotate
- Tap to select a layer

If the canvas is built with mouse-event-only handlers, the entire feature is broken on mobile.

---

## C. Medium-Priority UX & Copy Issues

### C1. Quantity equation is overly mathy
"1 × ৳480 = ৳480" looks like a calculator. Change to "Subtotal: ৳480" with the unit price shown smaller below.

### C2. No bulk-quantity pricing
A custom apparel shop typically offers tiers (e.g. 5+, 10+, 50+). Currently the price is strictly linear. A "Buy 5 get 10% off" tier here would meaningfully raise average order value.

### C3. Free-shipping helper text doesn't update with quantity
Below the cart button it says "Free shipping above ৳1,500". When the user increases quantity to 4 (4 × 480 = ৳1,920), the message should change to "✓ You qualify for free shipping" with a green check. Right now it's static.

### C4. Color circles have no tooltip or label
Hovering a swatch should show "Maroon", "Forest Green", "Royal Blue", etc. Right now the customer cannot tell red from burgundy, navy from royal, or olive from forest at a glance.

### C5. Size XXXL wraps to a second row
On the 1280-wide screenshot, "XS S M L XL XXL" fits in the row and "XXXL" jumps to a new line on its own. Either tighten spacing so all 7 fit, or use 2 evenly-balanced rows of 4 + 3.

### C6. "230GSM Cotton" badge is a chip on the canvas
It floats in the top-left of the canvas with no styling indicating it's just metadata. New users may think it's a button. Move it to the right column under "Garment Size" as informational text, or label it clearly ("Material: 230 GSM Cotton").

### C7. "FRONT" label in the canvas is redundant
There's already a Front / Back toggle directly above the canvas. The "FRONT" pill on the shirt is duplicate information.

### C8. Print Area label is inside the print box
The text "Print Area" sits at the top-inside of the dashed rectangle, *and* the inner upload box also sits inside it, so there are now three visually competing things in the same rectangle. Move "Print Area" outside the rectangle as a small caption.

### C9. Page title doesn't change when you switch products
The H1 always says "Design Studio · You imagine — we craft it." Add a sub-line like "Designing: Unisex T-Shirt — Front, Size M, White" so the user can see at a glance what they've configured. This also helps when shared via screenshot.

### C10. No "Save Design" or "Share Design" buttons
No way to come back to a half-finished design tomorrow, and no way to send the in-progress design to a friend for approval. For high-AOV custom orders, social proof and approval are huge — a "Send to a friend" WhatsApp share button would convert.

### C11. No "Reset" or "Start Over" button
Once you've added text, uploaded an image, picked a color, and changed size — there is no obvious way to wipe and start fresh.

### C12. No price update tied to size
At many print shops 2XL/3XL costs more than M (more fabric, more ink). Verify whether price changes per size — and if it should, expose it.

### C13. No estimated delivery date
The footer says "48hr Production" but the design studio doesn't show "Order in the next 4 hours and get it by Tuesday Apr 28." This is a proven conversion booster.

### C14. No live design preview overlay
The uploaded design should appear composited *onto the t-shirt mock-up* (so you see a realistic preview). Right now it lives in a floating square. Even a simple `mix-blend-mode: multiply` with a slight texture overlay on the mock-up image would make a huge difference.

### C15. Undo / Redo buttons have no tooltips
Hovering should say "Undo (Ctrl+Z)". Without a label, most users won't realize what those two arrow buttons do.

### C16. Product picker icons use emoji
The product tabs use 👕 ☕ 🧥 🧢 🧤 🥤. Emoji rendering varies wildly between OSes (Apple's hoodie emoji looks different from Windows', and Bangladesh users on older Android may not have a glove emoji at all). Use SVG icons matched to your brand.

### C17. Hoodie and Long Sleeve both use 🧥 / 🧤 emoji that don't match the labels
🧥 is a coat, not a long sleeve. 🧤 is a glove, not a hoodie. Customers may genuinely click the wrong one.

### C18. Inconsistent product naming
"Unisex T-Shirt", "Coffee Mug", "Unisex Long Sleeve", "Cap", "Unisex Hoodie", "Water Bottle" — three of six say "Unisex," three don't. Either mark them all or mark none.

### C19. The faded "Add to Cart" button at the very top has no clear scope
Is it "Add the current design" or "Open the cart"? It sits next to "Print Zone" which is a viewer toggle, so the grouping is confusing. There's already a primary CTA on the right; the top one should either become a cart icon link or be removed.

### C20. Header announcement bar overlaps the page header on this page too
Same site-wide bug — the orange ticker clips the logo and main nav, which is even more visible on the design studio because the page has its own dark "Design Studio" title bar that competes with it.

---

## D. Things I Could Not Test (please walk through these with a real browser)

1. **Actual upload flow** — drag-drop, file picker, upload progress, server response, error handling
2. **Text tool full feature set** — fonts, sizes, colors, multi-line, emoji
3. **Layers panel behavior** — reorder, lock, hide, delete
4. **Templates panel content** — what templates exist? Can you customize them?
5. **Add-to-cart end-to-end** — does the design actually persist into cart, checkout, and order?
6. **Mobile / tablet experience** — touch gestures, canvas size, drawer-style panels
7. **iPad / iPhone Safari** — known issues with `pointer-events`, `touch-action`, and CSS `aspect-ratio` on older iOS
8. **Slow 3G performance** — design tools often pull large mock-up images; verify graceful loading
9. **Keyboard accessibility** — can a user complete the full flow with keyboard only?
10. **Screen reader** — does the canvas have any meaningful aria description?

---

## E. Recommended Fix Order

**This week (critical):**
1. A1 — wire URL state (product, tab, view, color, size) into the Design Studio so refresh / share / bookmark all work
2. A2 — fix the canvas to keep the entire shirt visible at all viewport widths and shrink the print area to a realistic size
3. A3 — make the Add-to-Cart buttons look active by default
4. A4 / A5 — visible borders on swatches and an unmistakable "selected" state for color and size
5. A6 — pick one upload entry point and remove the other
6. B1, B2, B3 — verify and fix per-product price, size, and material switching

**Next:**
7. B5–B12 — the manual-test items in section B
8. C1, C3, C8, C9, C14 — the polish items that most affect conversion
9. C16 / C17 — replace emoji with proper SVG icons

Once A1–A6 and B1–B3 are fixed, the Design Studio will go from "looks broken" to "actually usable," which is the single biggest lift you can make to the site's conversion rate, since this is the core differentiator of the brand.
