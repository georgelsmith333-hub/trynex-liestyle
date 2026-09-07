import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const studio = readFileSync(new URL("./DesignStudioV2.tsx", import.meta.url), "utf8");
const canvasArea = readFileSync(new URL("./CanvasArea.tsx", import.meta.url), "utf8");
const imagePanel = readFileSync(new URL("./panels/ImagePanel.tsx", import.meta.url), "utf8");
const productSwitcher = readFileSync(new URL("./toolbar/ProductSwitcher.tsx", import.meta.url), "utf8");
const clipArt = readFileSync(new URL("./ClipArtBrowser.tsx", import.meta.url), "utf8");
const qrPanel = readFileSync(new URL("./QRCodePanel.tsx", import.meta.url), "utf8");

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
    expect(canvasArea).toContain("shadow-[0_0_0_9999px_rgba(15,23,42,0.13)]");
    expect(canvasArea).toContain("Scale artwork from");
    expect(canvasArea).toContain("Rotate artwork");
    expect(canvasArea).toContain('borderEnabled={selectedLayer?.type !== "image"}');
  });
});