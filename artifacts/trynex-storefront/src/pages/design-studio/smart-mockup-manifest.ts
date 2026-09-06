export type SmartMockupCategory = "mug" | "cap" | "waterbottle" | "tshirt" | "longsleeve" | "hoodie";
export type SmartMockupFace = "front" | "back" | "left-sleeve" | "right-sleeve" | "neck-label" | "wrap";
export type SmartMockupAlphaMode = "opaque-photo" | "transparent-cutout";
export type SmartMockupRuntimeStatus = "approved" | "disabled";

export interface SmartMockupRuntimeRoles {
  studioBackground: string;
  base: string;
  shadow: string;
  protected: string;
  highlight: string;
  printMask: string;
}

export interface SmartObjectPrintZone {
  x: number;
  y: number;
  w: number;
  h: number;
  shape?: string;
}

export interface SmartMockupManifest {
  schema: "trynex-smart-mockup/v3";
  manifestRevision: string;
  masterFormat: "psd" | "psb";
  masterStatus: "verified" | "manifest-only";
  runtimeStatus: SmartMockupRuntimeStatus;
  disabledReason?: string;
  category: SmartMockupCategory;
  colorSlug: string;
  face: SmartMockupFace;
  sourceKitKey: string;
  editableMasterPath?: string;
  assets: {
    baseSrc: string;
    cutoutSrc: string;
    alphaMode: SmartMockupAlphaMode;
    runtimeRoles?: SmartMockupRuntimeRoles;
    printableMaskSrc?: string;
    exclusionMaskSrc?: string;
    detailMaskSrc?: string;
  };
  normalizedFrame: { canvasWidth: number; canvasHeight: number; x: number; y: number; w: number; h: number };
  printZone: SmartObjectPrintZone;
  protectedDetails: string[];
  warp: {
    mode: "flat" | "cylinder" | "perspective" | "cap-panel";
    curvature: number;
    seamPadding: number;
    preserveAspect: boolean;
  };
  masks: {
    shadow: "source-luminance-multiply";
    highlight: "source-luminance-screen";
    clipToPrintZone: true;
    preserveProtectedDetails: true;
    duplicateBasePass: false;
  };
  shading: {
    multiplyOpacity: number;
    screenOpacity: number;
    grainOpacity: number;
  };
}

const CATEGORY_DEFAULTS: Record<SmartMockupCategory, SmartMockupManifest["warp"]> = {
  mug: { mode: "cylinder", curvature: 0.16, seamPadding: 0.035, preserveAspect: true },
  cap: { mode: "cap-panel", curvature: 0.10, seamPadding: 0.025, preserveAspect: true },
  waterbottle: { mode: "cylinder", curvature: 0.16, seamPadding: 0.04, preserveAspect: true },
  tshirt: { mode: "flat", curvature: 0, seamPadding: 0.02, preserveAspect: true },
  longsleeve: { mode: "flat", curvature: 0, seamPadding: 0.02, preserveAspect: true },
  hoodie: { mode: "flat", curvature: 0, seamPadding: 0.02, preserveAspect: true },
};

const PROTECTED_DETAILS: Record<SmartMockupCategory, string[]> = {
  mug: ["rim", "handle", "base"],
  cap: ["brim", "crown-seams", "rear-opening", "strap"],
  waterbottle: ["lid", "key-ring-loop", "side-carabiner", "shoulder", "rounded-base"],
  tshirt: ["collar", "sleeve-edges", "seams", "hem"],
  longsleeve: ["collar", "cuffs", "sleeve-edges", "seams", "hem"],
  hoodie: ["hood", "drawstrings", "pocket", "cuffs", "seams", "hem"],
};

export function createSmartMockupManifest(args: {
  category: SmartMockupCategory;
  colorSlug?: string;
  face?: SmartMockupFace;
  sourceKitKey: string;
  manifestRevision?: string;
  editableMasterPath?: string;
  masterStatus?: SmartMockupManifest["masterStatus"];
  runtimeStatus?: SmartMockupRuntimeStatus;
  disabledReason?: string;
  baseSrc?: string;
  cutoutSrc?: string;
  alphaMode?: SmartMockupAlphaMode;
  runtimeRoles?: SmartMockupRuntimeRoles;
  printableMaskSrc?: string;
  exclusionMaskSrc?: string;
  detailMaskSrc?: string;
  normalizedFrame: SmartMockupManifest["normalizedFrame"];
  printZone: SmartObjectPrintZone;
}): SmartMockupManifest {
  const face = args.face ?? "front";
  const colorSlug = args.colorSlug ?? "white";
  const baseSrc = args.baseSrc ?? "";
  const cutoutSrc = args.cutoutSrc ?? baseSrc;
  const masterStatus = args.masterStatus ?? "manifest-only";
  return {
    schema: "trynex-smart-mockup/v3",
    manifestRevision: args.manifestRevision ?? "runtime-v3.1",
    masterFormat: args.editableMasterPath?.toLowerCase().endsWith(".psb") ? "psb" : "psd",
    masterStatus,
    runtimeStatus: args.runtimeStatus ?? "approved",
    disabledReason: args.disabledReason,
    category: args.category,
    colorSlug,
    face,
    sourceKitKey: args.sourceKitKey,
    editableMasterPath: args.editableMasterPath,
    assets: {
      baseSrc,
      cutoutSrc,
      alphaMode: args.alphaMode ?? "transparent-cutout",
      runtimeRoles: args.runtimeRoles,
      printableMaskSrc: args.printableMaskSrc,
      exclusionMaskSrc: args.exclusionMaskSrc,
      detailMaskSrc: args.detailMaskSrc,
    },
    normalizedFrame: args.normalizedFrame,
    printZone: args.printZone,
    protectedDetails: PROTECTED_DETAILS[args.category],
    warp: CATEGORY_DEFAULTS[args.category],
    masks: {
      shadow: "source-luminance-multiply",
      highlight: "source-luminance-screen",
      clipToPrintZone: true,
      preserveProtectedDetails: true,
      duplicateBasePass: false,
    },
    // The source kits already carry product lighting. Keep synthetic passes
    // restrained and never use a duplicate full-frame garment as a mask.
    shading: {
      multiplyOpacity: 0.06,
      screenOpacity: 0.025,
      grainOpacity: 0.02,
    },
  };
}

export function validateSmartMockupManifest(
  manifest: SmartMockupManifest,
  expected?: Partial<Pick<SmartMockupManifest, "category" | "colorSlug" | "face" | "sourceKitKey">>,
): string[] {
  const errors: string[] = [];
  if (manifest.schema !== "trynex-smart-mockup/v3") errors.push("unsupported schema");
  if (!manifest.manifestRevision.trim()) errors.push("missing manifest revision");
  if (!manifest.sourceKitKey.trim()) errors.push("missing source-kit key");
  if (manifest.runtimeStatus !== "approved" && manifest.runtimeStatus !== "disabled") errors.push("unsupported runtime status");
  if (manifest.runtimeStatus === "disabled" && !manifest.disabledReason?.trim()) errors.push("disabled surface is missing a reason");
  if (manifest.masterStatus === "verified" && !manifest.editableMasterPath?.trim()) errors.push("verified master is missing its editable source path");
  if (!manifest.assets.baseSrc || !manifest.assets.cutoutSrc) errors.push("base and cutout assets are required");
  if (manifest.assets.alphaMode !== "opaque-photo" && manifest.assets.alphaMode !== "transparent-cutout") errors.push("unsupported alpha mode");
  if (manifest.assets.alphaMode === "opaque-photo" && manifest.runtimeStatus === "approved" && manifest.assets.cutoutSrc !== manifest.assets.baseSrc) {
    errors.push("opaque photo must not have a separate tintable cutout");
  }
  const numericValues = [
    manifest.normalizedFrame.canvasWidth, manifest.normalizedFrame.canvasHeight,
    manifest.normalizedFrame.x, manifest.normalizedFrame.y, manifest.normalizedFrame.w, manifest.normalizedFrame.h,
    manifest.printZone.x, manifest.printZone.y, manifest.printZone.w, manifest.printZone.h,
    manifest.warp.curvature, manifest.warp.seamPadding,
  ];
  if (numericValues.some((value) => !Number.isFinite(value))) errors.push("geometry contains a non-finite value");
  if (manifest.normalizedFrame.canvasWidth <= 0 || manifest.normalizedFrame.canvasHeight <= 0 || manifest.normalizedFrame.w <= 0 || manifest.normalizedFrame.h <= 0) {
    errors.push("normalized frame is invalid");
  }
  if (manifest.printZone.w <= 0 || manifest.printZone.h <= 0) errors.push("print zone is invalid");
  if (!manifest.masks.clipToPrintZone || !manifest.masks.preserveProtectedDetails || manifest.masks.duplicateBasePass) {
    errors.push("mask contract is unsafe");
  }
  if (expected) {
    if (expected.category && manifest.category !== expected.category) errors.push("category does not match source-kit key");
    if (expected.colorSlug && manifest.colorSlug !== expected.colorSlug) errors.push("color does not match source-kit key");
    if (expected.face && manifest.face !== expected.face) errors.push("face does not match source-kit key");
    if (expected.sourceKitKey && manifest.sourceKitKey !== expected.sourceKitKey) errors.push("source-kit key mismatch");
  }
  return errors;
}
