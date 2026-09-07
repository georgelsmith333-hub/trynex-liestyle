import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePsdMaster } from "./psdMasterParser";

const fixtureRoot = new URL("../../../../dist-mockups/staging/smart-v10-v3/masters/", import.meta.url);

describe("PSD/PSB master parser", () => {
  it("parses a real PSD and extracts the embedded Smart Object", () => {
    const buffer = readFileSync(new URL("tshirt/tshirt-black-front.psd", fixtureRoot));
    const result = parsePsdMaster(buffer, "tshirt-black-front.psd", "image/vnd.adobe.photoshop");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.format).toBe("psd");
    expect(result.value.canvas).toEqual({ width: 1024, height: 1024 });
    expect(result.value.smartObject.layerName).toContain("SMART OBJECT");
    expect(result.value.smartObject.transform).toHaveLength(8);
    expect(result.value.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("parses a real PSB and requires the PSB signature and MIME", () => {
    const buffer = readFileSync(new URL("mug/mug-white-front.psb", fixtureRoot));
    const result = parsePsdMaster(buffer, "mug-white-front.psb", "application/vnd.adobe.photoshop");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.format).toBe("psb");
    expect(result.value.smartObject.smartObjectId).toBeTruthy();
  });

  it("rejects invalid bytes and extension/signature mismatches before parsing", () => {
    const invalid = parsePsdMaster(Buffer.from("not a photoshop document"), "shirt.psd", "image/vnd.adobe.photoshop");
    expect(invalid).toEqual({
      ok: false,
      errors: ["The uploaded file is not a valid PSD/PSB document."],
    });

    const realPsd = readFileSync(new URL("tshirt/tshirt-black-front.psd", fixtureRoot));
    const mismatch = parsePsdMaster(realPsd, "shirt.psb", "application/vnd.adobe.photoshop");
    expect(mismatch.ok).toBe(false);
    if (mismatch.ok) return;
    expect(mismatch.errors).toEqual(expect.arrayContaining([
      "The file signature is PSD but the filename is PSB.",
      "The file MIME type does not match the PSD signature.",
    ]));
  });
});