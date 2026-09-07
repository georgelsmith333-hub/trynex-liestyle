import { describe, expect, it } from "vitest";
import { createSmartMockupManifest, validateSmartMockupManifest } from "./smart-mockup-manifest";

const validManifest = () => createSmartMockupManifest({
  category: "hoodie",
  colorSlug: "navy",
  face: "front",
  sourceKitKey: "hoodie:navy:front",
  manifestRevision: "smart-v10.3",
    editableMasterPath: "dist-mockups/staging/smart-v10-v3/masters/hoodie/hoodie-navy-front.psd",
    masterStatus: "verified",
  baseSrc: "/mockups/psd-master-v10/runtime-roles/hoodie/navy/front-base.png",
  cutoutSrc: "/mockups/psd-master-v10/runtime-roles/hoodie/navy/front-base.png",
  alphaMode: "opaque-photo",
  normalizedFrame: { canvasWidth: 1000, canvasHeight: 1000, x: 0, y: 0, w: 1000, h: 1000 },
  printZone: { x: 170, y: 120, w: 677, h: 737 },
});

describe("smart mockup manifest contract", () => {
  it("accepts a complete approved surface and checks its source identity", () => {
    const manifest = validManifest();
    expect(validateSmartMockupManifest(manifest, {
      category: "hoodie",
      colorSlug: "navy",
      face: "front",
      sourceKitKey: "hoodie:navy:front",
    })).toEqual([]);
  });

  it("reports missing approval reason, assets, and unsafe geometry instead of normalizing them", () => {
    const manifest = validManifest();
    manifest.runtimeStatus = "disabled";
    manifest.disabledReason = "";
    manifest.assets.baseSrc = "";
    manifest.normalizedFrame.w = 0;
    manifest.printZone.h = Number.NaN;
    manifest.masks.duplicateBasePass = true;

    expect(validateSmartMockupManifest(manifest)).toEqual(expect.arrayContaining([
      "disabled surface is missing a reason",
      "base and cutout assets are required",
      "geometry contains a non-finite value",
      "normalized frame is invalid",
      "mask contract is unsafe",
    ]));
  });

  it("rejects an opaque approved photo with a separate tintable cutout", () => {
    const manifest = validManifest();
    manifest.assets.cutoutSrc = "/mockups/psd-master-v10/runtime-roles/hoodie/navy/front-shadow.png";
    expect(validateSmartMockupManifest(manifest)).toContain("opaque photo must not have a separate tintable cutout");
  });

  it("rejects a verified master without editable source provenance", () => {
    const manifest = validManifest();
    manifest.editableMasterPath = undefined;
    expect(validateSmartMockupManifest(manifest)).toContain("verified master is missing its editable source path");
  });
});