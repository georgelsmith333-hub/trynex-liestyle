export const SMART_V10_RELEASE_VERSION = "smart-v10.3" as const;
export const SMART_V10_INGESTION_SCHEMA = "trynex-smart-mockup-ingestion/v1" as const;

export const REQUIRED_RUNTIME_ROLES = [
  "studioBackground",
  "base",
  "shadow",
  "protected",
  "highlight",
  "printMask",
] as const;

export type RuntimeRole = (typeof REQUIRED_RUNTIME_ROLES)[number];

type SurfaceCategory = "tshirt" | "longsleeve" | "hoodie" | "mug" | "cap" | "waterbottle";
type SurfaceFace = "front" | "back" | "left-sleeve" | "right-sleeve" | "neck-label" | "wrap";

const SURFACE_COLORS: Record<SurfaceCategory, readonly string[]> = {
  tshirt: ["white", "black", "navy", "maroon", "olive", "sky-blue", "grey", "red"],
  longsleeve: ["white", "black", "charcoal", "heather-grey", "navy", "royal-blue", "forest-green", "burgundy", "red", "sand"],
  hoodie: ["white", "black", "charcoal", "heather-grey", "navy", "royal-blue", "forest-green", "burgundy", "red", "sand"],
  mug: ["white", "black", "navy", "red", "green", "purple", "sky-blue", "pink", "maroon", "orange"],
  cap: ["white", "black", "navy", "maroon", "olive", "red", "grey", "forest"],
  waterbottle: ["white"],
};

const SURFACE_FACES: Record<SurfaceCategory, readonly SurfaceFace[]> = {
  tshirt: ["front", "back", "left-sleeve", "right-sleeve", "neck-label"],
  longsleeve: ["front", "back", "left-sleeve", "right-sleeve", "neck-label"],
  hoodie: ["front", "back", "left-sleeve", "right-sleeve", "neck-label"],
  mug: ["front", "back", "wrap"],
  cap: ["front", "back"],
  waterbottle: ["front", "back"],
};

export type RuntimeRoleAsset = {
  path: string;
  sha256: string;
  sourceLayerPrefix: string;
};

export type SmartMockupIngestionManifest = {
  schema: typeof SMART_V10_INGESTION_SCHEMA;
  releaseVersion: typeof SMART_V10_RELEASE_VERSION;
  sourceKitKey: string;
  category: SurfaceCategory;
  color: string;
  face: SurfaceFace;
  master: {
    fileName: string;
    mime: string;
    size: number;
    sha256: string;
    provenance: "catalog-psd-smart-object";
    smartObjectLayer: string;
    smartObjectId?: string;
    smartObjectType?: string;
    smartObjectBounds?: { x: number; y: number; w: number; h: number };
    smartObjectTransform?: number[];
    geometry: {
      canvasWidth: number;
      canvasHeight: number;
      x: number;
      y: number;
      w: number;
      h: number;
    };
  };
  runtimeRoles: Record<RuntimeRole, RuntimeRoleAsset>;
  printZone: { x: number; y: number; w: number; h: number };
  blendModes: {
    shadow: "multiply";
    highlight: "screen";
    protected: "source-over";
  };
};

export type MockupMetadataForValidation = {
  masterFileName?: unknown;
  masterFileMime?: unknown;
  masterFileSize?: unknown;
  masterFileSha256?: unknown;
  sourceKitKey?: unknown;
  face?: unknown;
  color?: unknown;
};

export type ContractValidationResult<T> = {
  value?: T;
  errors: string[];
};

export function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseSurfaceKey(value: unknown): { category: SurfaceCategory; color: string; face: SurfaceFace } | null {
  if (typeof value !== "string") return null;
  const [category, color, face, ...rest] = value.split("/");
  if (rest.length || !(category in SURFACE_COLORS) || !color || !face) return null;
  const typedCategory = category as SurfaceCategory;
  if (!SURFACE_COLORS[typedCategory].includes(color) || !SURFACE_FACES[typedCategory].includes(face as SurfaceFace)) {
    return null;
  }
  return { category: typedCategory, color, face: face as SurfaceFace };
}

function expectedRolePath(sourceKitKey: string, role: RuntimeRole): string {
  const [category, color, face] = sourceKitKey.split("/");
  const fileRole = role === "printMask" ? "print-mask" : role;
  return `/mockups/psd-master-v10/runtime-roles/${category}/${color}/${face}-${fileRole}.png`;
}

function validateGeometry(
  value: unknown,
  label: string,
  errors: string[],
  normalized = false,
): value is { x: number; y: number; w: number; h: number } {
  if (!isRecord(value)) {
    errors.push(`${label} is required`);
    return false;
  }
  const values = ["x", "y", "w", "h"].map((key) => value[key]);
  if (values.some((item) => !isFiniteNumber(item))) {
    errors.push(`${label} contains non-finite values`);
    return false;
  }
  const [x, y, w, h] = values as number[];
  if (w <= 0 || h <= 0 || (normalized && (x < 0 || y < 0 || x + w > 1 || y + h > 1))) {
    errors.push(`${label} has invalid bounds`);
    return false;
  }
  return true;
}

export function validateSmartMockupIngestionManifest(
  input: unknown,
  metadata: MockupMetadataForValidation,
): ContractValidationResult<SmartMockupIngestionManifest> {
  const errors: string[] = [];
  if (!isRecord(input)) return { errors: ["manifestJson must be an object"] };

  if (input.schema !== SMART_V10_INGESTION_SCHEMA) errors.push(`schema must be ${SMART_V10_INGESTION_SCHEMA}`);
  if (input.releaseVersion !== SMART_V10_RELEASE_VERSION) errors.push(`releaseVersion must be ${SMART_V10_RELEASE_VERSION}`);

  const parsedKey = parseSurfaceKey(input.sourceKitKey);
  if (!parsedKey) {
    errors.push("sourceKitKey must be an approved category/color/face path");
  } else {
    if (input.category !== parsedKey.category) errors.push("category does not match sourceKitKey");
    if (input.color !== parsedKey.color) errors.push("color does not match sourceKitKey");
    if (input.face !== parsedKey.face) errors.push("face does not match sourceKitKey");
  }

  if (metadata.sourceKitKey !== input.sourceKitKey) errors.push("sourceKitKey does not match the database binding");
  if (metadata.face !== undefined && metadata.face !== null && metadata.face !== input.face) errors.push("face does not match the database binding");
  if (metadata.color !== undefined && metadata.color !== null && metadata.color !== input.color) errors.push("color does not match the database binding");

  const master = input.master;
  if (!isRecord(master)) {
    errors.push("master metadata is required");
  } else {
    const fileName = typeof master.fileName === "string" ? master.fileName : "";
    const mime = typeof master.mime === "string" ? master.mime : "";
    const size = master.size;
    const format = /\.psb$/i.test(fileName) ? "psb" : /\.psd$/i.test(fileName) ? "psd" : null;
    if (!format) errors.push("master.fileName must end in .psd or .psb");
    const expectedMime = format === "psb" ? "application/vnd.adobe.photoshop" : "image/vnd.adobe.photoshop";
    if (!["image/vnd.adobe.photoshop", "application/vnd.adobe.photoshop", "image/x-photoshop"].includes(mime)) {
      errors.push("master.mime must be a Photoshop PSD/PSB MIME type");
    } else if (format && mime !== expectedMime && !(format === "psd" && mime === "image/x-photoshop")) {
      errors.push("master MIME type does not match the file extension");
    }
    if (!Number.isInteger(size) || Number(size) <= 0) errors.push("master.size must be a positive integer");
    if (!isSha256(master.sha256)) errors.push("master.sha256 must be a SHA-256 checksum");
    if (metadata.masterFileName !== undefined && metadata.masterFileName !== null && metadata.masterFileName !== master.fileName) {
      errors.push("master file name does not match the uploaded file");
    }
    if (metadata.masterFileMime !== undefined && metadata.masterFileMime !== null && metadata.masterFileMime !== master.mime) {
      errors.push("master MIME type does not match the uploaded file");
    }
    if (metadata.masterFileSize !== undefined && metadata.masterFileSize !== null && Number(metadata.masterFileSize) !== Number(master.size)) {
      errors.push("master size does not match the uploaded file");
    }
    if (metadata.masterFileSha256 !== master.sha256) errors.push("master checksum does not match the uploaded file checksum");
    if (master.provenance !== "catalog-psd-smart-object") errors.push("master provenance must be catalog-psd-smart-object");
    if (typeof master.smartObjectLayer !== "string" || !master.smartObjectLayer.trim()) errors.push("master.smartObjectLayer is required");
    if (master.smartObjectBounds !== undefined) validateGeometry(master.smartObjectBounds, "master.smartObjectBounds", errors);
    if (
      master.smartObjectTransform !== undefined &&
      (!Array.isArray(master.smartObjectTransform) ||
        master.smartObjectTransform.length !== 8 ||
        master.smartObjectTransform.some((value) => !isFiniteNumber(value)))
    ) {
      errors.push("master.smartObjectTransform must contain eight finite values");
    }
    validateGeometry(master.geometry, "master.geometry", errors);
  }

  const roles = input.runtimeRoles;
  if (!isRecord(roles)) {
    errors.push("runtimeRoles must contain all six approved roles");
  } else if (parsedKey) {
    for (const role of REQUIRED_RUNTIME_ROLES) {
      const asset = roles[role];
      if (!isRecord(asset)) {
        errors.push(`runtimeRoles.${role} is missing`);
        continue;
      }
      if (asset.path !== expectedRolePath(input.sourceKitKey as string, role)) {
        errors.push(`runtimeRoles.${role}.path is not the approved v10.3 path`);
      }
      if (!isSha256(asset.sha256)) errors.push(`runtimeRoles.${role}.sha256 must be a SHA-256 checksum`);
      if (typeof asset.sourceLayerPrefix !== "string" || !asset.sourceLayerPrefix.trim()) {
        errors.push(`runtimeRoles.${role}.sourceLayerPrefix is required`);
      }
    }
  }

  validateGeometry(input.printZone, "printZone", errors, true);
  if (!isRecord(input.blendModes) ||
      input.blendModes.shadow !== "multiply" ||
      input.blendModes.highlight !== "screen" ||
      input.blendModes.protected !== "source-over") {
    errors.push("blendModes must preserve the approved shadow/highlight/protected contract");
  }

  return errors.length ? { errors } : { value: input as SmartMockupIngestionManifest, errors: [] };
}

export function validateRenderSurfaceManifest(input: unknown): ContractValidationResult<SmartMockupIngestionManifest> {
  return validateSmartMockupIngestionManifest(input, {
    masterFileName: isRecord(input) && isRecord(input.master) ? input.master.fileName : undefined,
    masterFileMime: isRecord(input) && isRecord(input.master) ? input.master.mime : undefined,
    masterFileSize: isRecord(input) && isRecord(input.master) ? input.master.size : undefined,
    masterFileSha256: isRecord(input) && isRecord(input.master) ? input.master.sha256 : undefined,
    sourceKitKey: isRecord(input) ? input.sourceKitKey : undefined,
    face: isRecord(input) ? input.face : undefined,
    color: isRecord(input) ? input.color : undefined,
  });
}