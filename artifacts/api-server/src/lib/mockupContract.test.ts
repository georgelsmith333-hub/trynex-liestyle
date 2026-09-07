import { describe, expect, it } from "vitest";
import {
  REQUIRED_RUNTIME_ROLES,
  SMART_V10_INGESTION_SCHEMA,
  SMART_V10_RELEASE_VERSION,
  validateRenderSurfaceManifest,
  validateSmartMockupIngestionManifest,
} from "./mockupContract";

const key = "tshirt/white/front";
const checksum = "a".repeat(64);

function validManifest() {
  return {
    schema: SMART_V10_INGESTION_SCHEMA,
    releaseVersion: SMART_V10_RELEASE_VERSION,
    sourceKitKey: key,
    category: "tshirt",
    color: "white",
    face: "front",
    master: {
      fileName: "tshirt-white-front.psd",
      mime: "image/vnd.adobe.photoshop",
      size: 1024,
      sha256: checksum,
      provenance: "catalog-psd-smart-object",
      smartObjectLayer: "Artwork",
      geometry: { canvasWidth: 1024, canvasHeight: 1024, x: 240, y: 185, w: 520, h: 580 },
    },
    runtimeRoles: Object.fromEntries(REQUIRED_RUNTIME_ROLES.map((role) => [
      role,
      {
        path: `/mockups/psd-master-v10/runtime-roles/tshirt/white/front-${role === "printMask" ? "print-mask" : role}.png`,
        sha256: checksum,
        sourceLayerPrefix: `${role} source layer`,
      },
    ])),
    printZone: { x: 0.234, y: 0.181, w: 0.508, h: 0.566 },
    blendModes: { shadow: "multiply", highlight: "screen", protected: "source-over" },
  };
}

const metadata = {
  masterFileName: "tshirt-white-front.psd",
  masterFileMime: "image/vnd.adobe.photoshop",
  masterFileSize: 1024,
  masterFileSha256: checksum,
  sourceKitKey: key,
  face: "front",
  color: "white",
};

describe("Smart v10.3 mockup contract", () => {
  it("accepts a complete source-kit manifest with all six runtime roles", () => {
    const result = validateSmartMockupIngestionManifest(validManifest(), metadata);
    expect(result.errors).toEqual([]);
    expect(result.value?.sourceKitKey).toBe(key);
    expect(Object.keys(result.value?.runtimeRoles ?? {})).toHaveLength(6);
  });

  it("rejects incomplete role packages and provenance/checksum mismatches", () => {
    const manifest = validManifest() as any;
    delete manifest.runtimeRoles.printMask;
    manifest.master.provenance = "preview-only";
    manifest.master.sha256 = "b".repeat(64);

    const result = validateSmartMockupIngestionManifest(manifest, metadata);
    expect(result.errors).toEqual(expect.arrayContaining([
      "runtimeRoles.printMask is missing",
      "master provenance must be catalog-psd-smart-object",
      "master checksum does not match the uploaded file checksum",
    ]));
  });

  it("rejects non-approved surface identities and role paths", () => {
    const manifest = validManifest() as any;
    manifest.sourceKitKey = "tshirt/white/diagonal";

    const result = validateRenderSurfaceManifest(manifest);
    expect(result.errors.some((error) => error.includes("sourceKitKey"))).toBe(true);
    manifest.sourceKitKey = key;
    manifest.runtimeRoles.base.path = "/uploads/arbitrary-base.png";
    const pathResult = validateRenderSurfaceManifest(manifest);
    expect(pathResult.errors.some((error) => error.includes("runtimeRoles.base.path"))).toBe(true);
  });
});