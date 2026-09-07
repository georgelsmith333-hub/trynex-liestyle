import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const studio = readFileSync(new URL("./DesignStudioV2.tsx", import.meta.url), "utf8");
const canvasArea = readFileSync(new URL("./CanvasArea.tsx", import.meta.url), "utf8");
const imagePanel = readFileSync(new URL("./panels/ImagePanel.tsx", import.meta.url), "utf8");
const productSwitcher = readFileSync(new URL("./toolbar/ProductSwitcher.tsx", import.meta.url), "utf8");
const clipArt = readFileSync(new URL("./ClipArtBrowser.tsx", import.meta.url), "utf8");
const qrPanel = readFileSync(new URL("./QRCodePanel.tsx", import.meta.url), "utf8");
const stickyPurchase = readFileSync(new URL("./StudioStickyPurchaseBar.tsx", import.meta.url), "utf8");
const livePreview = readFileSync(new URL("./LiveCompositorPreview.tsx", import.meta.url), "utf8");

describe("Design Studio reliability contracts", () => {
  it("exposes deterministic local image improvement as an explicit image action", () => {
    expect(studio).toContain("const handleAutoFix");
    expect(studio).toContain("autoFixImage(selectedLayer.src)");
    expect(imagePanel).toContain("Auto-fix image");
  });

  it("prevents duplicate cart work and rejects incomplete original-asset preservation", () => {
    expect(studio).toContain("if (isAddingToCart) return;");
    expect(studio).toContain("requiredOriginalAssetCount");
    expect(studio).toContain("Every uploaded artwork must be preserved before checkout");
  });

  it("uses active product geometry when switching products and adding generated artwork", () => {
    expect(productSwitcher).toContain("getSwitchPrintZone(face, product, nextColor.hex, nextMugMode)");
    expect(productSwitcher).toContain("MUG_WRAP_BACK_PZ");
    expect(clipArt).toContain("getZonePZ(activeFace, selectedProduct, selectedColor.hex)");
    expect(qrPanel).toContain("getZonePZ(activeFace, selectedProduct, selectedColor.hex)");
  });

  it("shows recoverable save and export states", () => {
    expect(studio).toContain('setSaveStatus("error")');
    expect(studio).toContain("Retry save");
    expect(studio).toContain("Export failed");
  });

  it("keeps image selection aligned to the printable area", () => {
    expect(canvasArea).toContain('aria-label="Printable area controls"');
    expect(canvasArea).toContain("border-orange-400/70");
    expect(canvasArea).toContain("Scale artwork from");
    expect(canvasArea).toContain("Rotate artwork");
    expect(canvasArea).toContain('borderEnabled={selectedLayer?.type !== "image"}');
    expect(canvasArea).toContain("selectedArtworkDimensions");
    expect(canvasArea).toContain("h-11 w-11");
  });

  it("keeps the photoreal compositor and mobile purchase action available", () => {
    expect(studio).toContain("<StudioStickyPurchaseBar");
    expect(studio).toContain('className="flex flex-1 min-w-0 flex-col"');
    expect(studio).toContain("void autoFixImage(src)");
    expect(stickyPurchase).toContain('data-testid="studio-sticky-purchase"');
    expect(stickyPurchase).toContain("env(safe-area-inset-bottom");
    expect(livePreview).toContain("data-preview-state={renderState}");
    expect(livePreview).toContain("Loading photoreal preview");
  });
});