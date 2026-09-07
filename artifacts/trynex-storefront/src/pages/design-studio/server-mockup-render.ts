import { getApiUrl } from "@/lib/utils";
import {
  composeDesignTexture,
  type ComposerLayer,
  type ComposerPrintZone,
  type UnifiedMockupSurface,
} from "./composer";

type RuntimeRole = "studioBackground" | "base" | "shadow" | "protected" | "highlight" | "printMask";

type ReleaseSurface = {
  surfaceKey: string;
  family: string;
  color: string;
  view: string;
  masterPath: string;
  masterChecksum: string;
  masterSize: number;
  masterFormat: "psd" | "psb";
  smartObject: {
    layerName: string;
    id: string;
    placed: string;
    transform: number[];
    proofDesign: string;
  };
  normalizedFrame: { canvasWidth: number; canvasHeight: number; x: number; y: number; w: number; h: number };
  printZone: { x: number; y: number; w: number; h: number };
  roles: Record<RuntimeRole, { path: string; sha256: string; sourceLayerPrefix: string }>;
};

type ReleaseManifest = {
  status: string;
  surfaces: ReleaseSurface[];
};

type ServerSurfaceManifest = {
  schema: "trynex-smart-mockup-ingestion/v1";
  releaseVersion: "smart-v10.3";
  sourceKitKey: string;
  category: ReleaseSurface["family"];
  color: string;
  face: ReleaseSurface["view"];
  master: {
    fileName: string;
    mime: "image/vnd.adobe.photoshop" | "application/vnd.adobe.photoshop";
    size: number;
    sha256: string;
    provenance: "catalog-psd-smart-object";
    smartObjectLayer: string;
    geometry: { canvasWidth: number; canvasHeight: number; x: number; y: number; w: number; h: number };
  };
  runtimeRoles: Record<RuntimeRole, { path: string; sha256: string; sourceLayerPrefix: string }>;
  printZone: { x: number; y: number; w: number; h: number };
  blendModes: { shadow: "multiply"; highlight: "screen"; protected: "source-over" };
};

type ServerRenderableSurface = Pick<UnifiedMockupSurface, "sourceKitKey" | "runtimeStatus" | "disabledReason" | "contractErrors">;

const RELEASE_MANIFEST_URL = "/mockups/psd-master-v10/runtime-roles/manifest.json";
const RUNTIME_ROOT = "/mockups/psd-master-v10/runtime-roles";
const ROLE_NAMES: RuntimeRole[] = ["studioBackground", "base", "shadow", "protected", "highlight", "printMask"];
let releaseManifestPromise: Promise<ReleaseManifest> | undefined;
const roleDataUrlCache = new Map<string, Promise<string>>();

function toSurfaceKey(sourceKitKey: string): string {
  const key = sourceKitKey.includes("/") ? sourceKitKey : sourceKitKey.replaceAll(":", "/");
  if (key.split("/").length !== 3) throw new Error("This mockup surface is not an approved Smart v10.3 source.");
  return key;
}

function toRoleUrl(surface: ReleaseSurface, role: RuntimeRole): string {
  const fileName = surface.roles[role]?.path.split("/").pop();
  if (!fileName) throw new Error(`The approved ${role} role is missing for ${surface.surfaceKey}.`);
  return `${RUNTIME_ROOT}/${surface.family}/${surface.color}/${fileName}`;
}

function basename(path: string): string {
  return path.split("/").pop() ?? "";
}

function toDataUrl(bytes: ArrayBuffer, contentType: string): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < view.length; offset += chunkSize) {
    binary += String.fromCharCode(...view.subarray(offset, Math.min(offset + chunkSize, view.length)));
  }
  return `data:${contentType || "image/png"};base64,${btoa(binary)}`;
}

async function fetchDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Approved runtime role unavailable (${response.status}): ${url}`);
  return toDataUrl(await response.arrayBuffer(), response.headers.get("content-type") || "image/png");
}

async function getReleaseManifest(): Promise<ReleaseManifest> {
  releaseManifestPromise ??= fetch(RELEASE_MANIFEST_URL, { cache: "no-store" }).then(async (response) => {
    if (!response.ok) throw new Error(`Approved Smart v10.3 manifest unavailable (${response.status}).`);
    const manifest = await response.json() as ReleaseManifest;
    if (manifest.status !== "accepted" || manifest.surfaces.length !== 188) {
      throw new Error("The active Smart v10.3 runtime manifest is not accepted.");
    }
    return manifest;
  });
  return releaseManifestPromise;
}

async function getServerSurface(surface: ServerRenderableSurface): Promise<{ manifest: ServerSurfaceManifest; roleImages: Record<RuntimeRole, string>; release: ReleaseSurface }> {
  if (surface.runtimeStatus !== "approved" || surface.contractErrors.length > 0) {
    throw new Error(surface.disabledReason ?? `Mockup surface ${surface.sourceKitKey} is not approved for server rendering.`);
  }
  const sourceKitKey = toSurfaceKey(surface.sourceKitKey);
  const release = (await getReleaseManifest()).surfaces.find((candidate) => candidate.surfaceKey === sourceKitKey);
  if (!release) throw new Error(`No approved Smart v10.3 release surface exists for ${sourceKitKey}.`);

  const runtimeRoles = Object.fromEntries(ROLE_NAMES.map((role) => [
    role,
    {
      path: `${RUNTIME_ROOT}/${release.family}/${release.color}/${basename(release.roles[role].path)}`,
      sha256: release.roles[role].sha256,
      sourceLayerPrefix: release.roles[role].sourceLayerPrefix,
    },
  ])) as ServerSurfaceManifest["runtimeRoles"];
  const manifest: ServerSurfaceManifest = {
    schema: "trynex-smart-mockup-ingestion/v1",
    releaseVersion: "smart-v10.3",
    sourceKitKey,
    category: release.family,
    color: release.color,
    face: release.view,
    master: {
      fileName: basename(release.masterPath),
        mime: release.masterFormat === "psb" ? "application/vnd.adobe.photoshop" : "image/vnd.adobe.photoshop",
        size: release.masterSize,
      sha256: release.masterChecksum,
      provenance: "catalog-psd-smart-object",
        smartObjectLayer: release.smartObject.layerName,
        geometry: { ...release.normalizedFrame },
    },
    runtimeRoles,
    printZone: {
      x: release.printZone.x / 1024,
      y: release.printZone.y / 1024,
      w: release.printZone.w / 1024,
      h: release.printZone.h / 1024,
    },
    blendModes: { shadow: "multiply", highlight: "screen", protected: "source-over" },
  };

  const roleImages = Object.fromEntries(await Promise.all(ROLE_NAMES.map(async (role) => {
    const url = toRoleUrl(release, role);
    let request = roleDataUrlCache.get(url);
    if (!request) {
      request = fetchDataUrl(url);
      roleDataUrlCache.set(url, request);
    }
    return [role, await request] as const;
  }))) as Record<RuntimeRole, string>;
  return { manifest, roleImages, release };
}

function cropArtworkToPrintZone(source: HTMLCanvasElement, printZone: ComposerPrintZone): string {
  const scale = source.width / 1000;
  const crop = document.createElement("canvas");
  crop.width = Math.max(1, Math.round(printZone.w * scale));
  crop.height = Math.max(1, Math.round(printZone.h * scale));
  const context = crop.getContext("2d");
  if (!context) throw new Error("Unable to prepare artwork for server rendering.");
  context.clearRect(0, 0, crop.width, crop.height);
  context.drawImage(
    source,
    Math.round(printZone.x * scale),
    Math.round(printZone.y * scale),
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height,
  );
  return crop.toDataURL("image/png");
}

export async function renderApprovedMockupOnServer({
  surface,
  printZone,
  layers,
  curvature = 0,
}: {
  surface: ServerRenderableSurface;
  printZone: ComposerPrintZone;
  layers: ComposerLayer[];
  curvature?: number;
}): Promise<string> {
  const serverSurface = await getServerSurface(surface);
  const artworkCanvas = document.createElement("canvas");
  await composeDesignTexture({
    canvas: artworkCanvas,
    printZone,
    layers,
    outSize: 1024,
    imageCache: new Map(),
    clipToPrintZone: true,
    curvature,
  });
  const response = await fetch(getApiUrl("/api/mockup/render"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      surface: serverSurface.manifest,
      runtimeRoleImages: serverSurface.roleImages,
      artwork: cropArtworkToPrintZone(artworkCanvas, printZone),
    }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(detail?.message || `Server mockup rendering failed (${response.status}).`);
  }
  return toDataUrl(await response.arrayBuffer(), response.headers.get("content-type") || "image/webp");
}