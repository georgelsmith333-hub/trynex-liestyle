import { createHash } from "node:crypto";
import express from "express";
import request from "supertest";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import {
  REQUIRED_RUNTIME_ROLES,
  SMART_V10_INGESTION_SCHEMA,
  SMART_V10_RELEASE_VERSION,
} from "../lib/mockupContract";
import mockupRenderRouter from "./mockupRender";

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use((req, _res, next) => {
  req.log = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } as any;
  next();
});
app.use("/api", mockupRenderRouter);

function checksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function createFixture() {
  const buffer = await sharp({
    create: {
      width: 4,
      height: 4,
      channels: 4,
      background: { r: 220, g: 220, b: 220, alpha: 1 },
    },
  } as any).png().toBuffer();
  const dataUrl = `data:image/png;base64,${buffer.toString("base64")}`;
  const sha256 = checksum(buffer);
  const sourceKitKey = "tshirt/white/front";
  const surface = {
    schema: SMART_V10_INGESTION_SCHEMA,
    releaseVersion: SMART_V10_RELEASE_VERSION,
    sourceKitKey,
    category: "tshirt",
    color: "white",
    face: "front",
    master: {
      fileName: "tshirt-white-front.psd",
      mime: "image/vnd.adobe.photoshop",
      size: 1024,
      sha256: "a".repeat(64),
      provenance: "catalog-psd-smart-object",
      smartObjectLayer: "Artwork",
      geometry: { canvasWidth: 4, canvasHeight: 4, x: 1, y: 1, w: 2, h: 2 },
    },
    runtimeRoles: Object.fromEntries(REQUIRED_RUNTIME_ROLES.map((role) => [
      role,
      {
        path: `/mockups/psd-master-v10/runtime-roles/tshirt/white/front-${role === "printMask" ? "print-mask" : role}.png`,
        sha256,
        sourceLayerPrefix: `${role} source layer`,
      },
    ])),
    printZone: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 },
    blendModes: { shadow: "multiply", highlight: "screen", protected: "source-over" },
  };
  const runtimeRoleImages = Object.fromEntries(REQUIRED_RUNTIME_ROLES.map((role) => [role, dataUrl]));
  return { surface, runtimeRoleImages, artwork: dataUrl };
}

describe("Smart v10.3 mockup renderer", () => {
  it("rejects the legacy arbitrary base/mask payload", async () => {
    const response = await request(app)
      .post("/api/mockup/render")
      .send({
        baseImage: "data:image/png;base64,AA==",
        artwork: "data:image/png;base64,AA==",
        mask: "data:image/png;base64,AA==",
        zone: { x: 0, y: 0, w: 1, h: 1 },
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("surface_contract_invalid");
  });

  it("renders only when the complete approved surface and all six role checksums are present", async () => {
    const fixture = await createFixture();
    const response = await request(app)
      .post("/api/mockup/render")
      .send(fixture);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("image/png");
    expect(response.headers["x-mockup-surface-key"]).toBe("tshirt/white/front");
    expect(response.body.length).toBeGreaterThan(0);
  });

  it("rejects a role image whose bytes do not match the approved checksum", async () => {
    const fixture = await createFixture();
    delete fixture.runtimeRoleImages.printMask;

    const response = await request(app)
      .post("/api/mockup/render")
      .send(fixture);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("image_must_be_data_url");
  });
});