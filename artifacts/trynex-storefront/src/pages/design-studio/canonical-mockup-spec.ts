/**
 * TryNex canonical mockup contract.
 *
 * One garment specification drives V1, V2, editor previews, exports, and 3D
 * previews. A family is not considered complete unless every declared view uses
 * the same normalized garment geometry and the same color/material identity.
 * Editable PSD/PSB files are referenced honestly: `verified` means an actual
 * layered master has been checked into the asset pipeline; `manifest-only`
 * means the application contract exists but an editable master is still due.
 */

import type { Face, PrintZone, ProductColor, ProductType } from "./mockups";

export type MockupFamily = Extract<ProductType, "tshirt" | "longsleeve" | "hoodie" | "mug" | "cap" | "waterbottle">;
export type MockupView = Face | "wrap";
export type MockupMasterStatus = "verified" | "manifest-only";

export interface CanonicalViewSpec {
  view: MockupView;
  label: string;
  assetKey: string;
  printZone: PrintZone;
  required: boolean;
  orientation: "front" | "back" | "left" | "right" | "flat" | "wrap";
}

export interface CanonicalMockupSpec {
  family: MockupFamily;
  productType: MockupFamily;
  displayName: string;
  schema: "trynex-canonical-mockup/v1";
  masterFormat: "psd" | "psb";
  masterStatus: MockupMasterStatus;
  normalizedCanvas: { width: 1000; height: 1000 };
  colors: ProductColor[];
  views: CanonicalViewSpec[];
  geometry: {
    silhouetteId: string;
    frontBackPairId: string;
    colorMaterialId: string;
    aspectLock: true;
    protectedDetails: readonly string[];
  };
  acceptance: {
    noViewFallback: true;
    noCrossFamilyAssetReuse: true;
    sameColorIdentityAcrossViews: true;
    samePrintZoneCoordinateSpace: true;
  };
}

export const CANONICAL_MOCKUP_COLORS: Record<MockupFamily, ProductColor[]> = {
  tshirt: [
    { name: "White", hex: "#f8f7f4" }, { name: "Black", hex: "#1a1a1a" }, { name: "Navy", hex: "#1e3a5f" }, { name: "Maroon", hex: "#7f1d1d" },
    { name: "Olive", hex: "#4a5240" }, { name: "Sky Blue", hex: "#0ea5e9" }, { name: "Grey", hex: "#6b7280" }, { name: "Red", hex: "#dc2626" },
  ],
  longsleeve: [
    { name: "White", hex: "#f5f3f3" }, { name: "Black", hex: "#1a1a1a" }, { name: "Navy", hex: "#1e3a5f" }, { name: "Maroon", hex: "#7f1d1d" },
    { name: "Olive", hex: "#4a5240" }, { name: "Grey", hex: "#6b7280" }, { name: "Red", hex: "#dc2626" }, { name: "Sky Blue", hex: "#0ea5e9" },
    { name: "Burgundy", hex: "#6b1a2c" }, { name: "Forest", hex: "#166534" },
  ],
  hoodie: [
    { name: "White", hex: "#f2efe9" }, { name: "Black", hex: "#1a1a1a" }, { name: "Navy", hex: "#1e3a5f" }, { name: "Grey", hex: "#6b7280" },
    { name: "Maroon", hex: "#7f1d1d" }, { name: "Olive", hex: "#4a5240" }, { name: "Red", hex: "#dc2626" }, { name: "Sky Blue", hex: "#0ea5e9" },
    { name: "Forest", hex: "#166534" }, { name: "Burgundy", hex: "#6b1a2c" },
  ],
  mug: [
    { name: "White", hex: "#f5f5f5" }, { name: "Black", hex: "#1c1917" }, { name: "Navy", hex: "#1e3a5f" }, { name: "Red", hex: "#dc2626" },
    { name: "Green", hex: "#16a34a" }, { name: "Purple", hex: "#7c3aed" }, { name: "Sky Blue", hex: "#0ea5e9" }, { name: "Pink", hex: "#ec4899" },
    { name: "Maroon", hex: "#7f1d1d" }, { name: "Orange", hex: "#ea580c" },
  ],
  cap: [
    { name: "White", hex: "#f5f2ec" }, { name: "Black", hex: "#1a1a1a" }, { name: "Navy", hex: "#1e3a5f" }, { name: "Maroon", hex: "#7f1d1d" },
    { name: "Olive", hex: "#4a5240" }, { name: "Red", hex: "#dc2626" }, { name: "Grey", hex: "#6b7280" }, { name: "Forest", hex: "#166534" },
  ],
  // The supplied bottle is a white sublimation-coated aluminium blank. These are
  // not literal body-color variants; additional bottle colors require distinct
  // physical blank masters and must not be simulated by tinting this substrate.
  waterbottle: [
    { name: "White Sublimation Blank", hex: "#f4f3f1" },
  ],
};

export const CANONICAL_MOCKUP_SPECS: Record<MockupFamily, CanonicalMockupSpec> = {
  tshirt: {
family: "tshirt", productType: "tshirt", displayName: "Unisex T-Shirt",
    schema: "trynex-canonical-mockup/v1", masterFormat: "psd", masterStatus: "verified",
    normalizedCanvas: { width: 1000, height: 1000 },
    colors: CANONICAL_MOCKUP_COLORS.tshirt,
    geometry: {
      silhouetteId: "tshirt-unisex-crewneck-v1",
      frontBackPairId: "tshirt-front-back-v1",
      colorMaterialId: "tshirt-cotton-230gsm-v1",
      aspectLock: true,
      protectedDetails: ["collar", "sleeve-edges", "seams", "hem"],
    },
    views: [
      { view: "front", label: "Front", assetKey: "tshirt/{color}/front", printZone: { x: 240, y: 185, w: 520, h: 580 }, required: true, orientation: "front" },
      { view: "back", label: "Back", assetKey: "tshirt/{color}/back", printZone: { x: 240, y: 185, w: 520, h: 580 }, required: true, orientation: "back" },
      { view: "left-sleeve", label: "Left Sleeve", assetKey: "tshirt/{color}/left-sleeve", printZone: { x: 175, y: 175, w: 650, h: 650 }, required: true, orientation: "left" },
      { view: "right-sleeve", label: "Right Sleeve", assetKey: "tshirt/{color}/right-sleeve", printZone: { x: 175, y: 175, w: 650, h: 650 }, required: true, orientation: "right" },
      { view: "neck-label", label: "Neck Label", assetKey: "tshirt/{color}/neck-label", printZone: { x: 150, y: 265, w: 700, h: 470 }, required: true, orientation: "flat" },
    ],
    acceptance: { noViewFallback: true, noCrossFamilyAssetReuse: true, sameColorIdentityAcrossViews: true, samePrintZoneCoordinateSpace: true },
  },
  longsleeve: {
    family: "longsleeve", productType: "longsleeve", displayName: "Unisex Long Sleeve",
    schema: "trynex-canonical-mockup/v1", masterFormat: "psd", masterStatus: "verified",
    normalizedCanvas: { width: 1000, height: 1000 }, colors: CANONICAL_MOCKUP_COLORS.longsleeve,
    geometry: {
      silhouetteId: "longsleeve-unisex-cuff-v1", frontBackPairId: "longsleeve-front-back-v1", colorMaterialId: "longsleeve-cotton-240gsm-v1", aspectLock: true,
      protectedDetails: ["collar", "cuffs", "sleeve-edges", "seams", "hem"],
    },
    views: [
      { view: "front", label: "Front", assetKey: "longsleeve/{color}/front", printZone: { x: 312, y: 222, w: 376, h: 404 }, required: true, orientation: "front" },
      { view: "back", label: "Back", assetKey: "longsleeve/{color}/back", printZone: { x: 292, y: 195, w: 416, h: 458 }, required: true, orientation: "back" },
      { view: "left-sleeve", label: "Left Sleeve", assetKey: "longsleeve/{color}/left-sleeve", printZone: { x: 175, y: 175, w: 650, h: 650 }, required: true, orientation: "left" },
      { view: "right-sleeve", label: "Right Sleeve", assetKey: "longsleeve/{color}/right-sleeve", printZone: { x: 175, y: 175, w: 650, h: 650 }, required: true, orientation: "right" },
      { view: "neck-label", label: "Neck Label", assetKey: "longsleeve/{color}/neck-label", printZone: { x: 150, y: 265, w: 700, h: 470 }, required: true, orientation: "flat" },
    ],
    acceptance: { noViewFallback: true, noCrossFamilyAssetReuse: true, sameColorIdentityAcrossViews: true, samePrintZoneCoordinateSpace: true },
  },
  hoodie: {
    family: "hoodie", productType: "hoodie", displayName: "Unisex Hoodie",
    schema: "trynex-canonical-mockup/v1", masterFormat: "psd", masterStatus: "verified",
    normalizedCanvas: { width: 1000, height: 1000 }, colors: CANONICAL_MOCKUP_COLORS.hoodie,
    geometry: {
      silhouetteId: "hoodie-pullover-kangaroo-v1", frontBackPairId: "hoodie-front-back-v1", colorMaterialId: "hoodie-fleece-320gsm-v1", aspectLock: true,
      protectedDetails: ["hood", "drawstrings", "pocket", "cuffs", "seams", "hem"],
    },
    views: [
      { view: "front", label: "Front", assetKey: "hoodie/{color}/front", printZone: { x: 240, y: 270, w: 520, h: 400 }, required: true, orientation: "front" },
      { view: "back", label: "Back", assetKey: "hoodie/{color}/back", printZone: { x: 292, y: 184, w: 416, h: 448 }, required: true, orientation: "back" },
      { view: "left-sleeve", label: "Left Sleeve", assetKey: "hoodie/{color}/left-sleeve", printZone: { x: 175, y: 175, w: 650, h: 650 }, required: true, orientation: "left" },
      { view: "right-sleeve", label: "Right Sleeve", assetKey: "hoodie/{color}/right-sleeve", printZone: { x: 175, y: 175, w: 650, h: 650 }, required: true, orientation: "right" },
      { view: "neck-label", label: "Neck Label", assetKey: "hoodie/{color}/neck-label", printZone: { x: 150, y: 265, w: 700, h: 470 }, required: true, orientation: "flat" },
    ],
    acceptance: { noViewFallback: true, noCrossFamilyAssetReuse: true, sameColorIdentityAcrossViews: true, samePrintZoneCoordinateSpace: true },
  },
  mug: {
    family: "mug", productType: "mug", displayName: "Ceramic Mug",
    schema: "trynex-canonical-mockup/v1", masterFormat: "psb", masterStatus: "verified",
    normalizedCanvas: { width: 1000, height: 1000 }, colors: CANONICAL_MOCKUP_COLORS.mug,
    geometry: {
      silhouetteId: "mug-ceramic-standard-v1", frontBackPairId: "mug-side-pair-v1", colorMaterialId: "mug-ceramic-v1", aspectLock: true,
      protectedDetails: ["rim", "handle", "base"],
    },
    views: [
      { view: "front", label: "Side 1", assetKey: "mug/{color}/front", printZone: { x: 165, y: 220, w: 475, h: 580, shape: "mug-front-body" }, required: true, orientation: "front" },
      { view: "back", label: "Side 2", assetKey: "mug/{color}/back", printZone: { x: 384, y: 220, w: 451, h: 580, shape: "mug-back-body" }, required: true, orientation: "back" },
      { view: "wrap", label: "Full Wrap", assetKey: "mug/{color}/wrap", printZone: { x: 165, y: 220, w: 670, h: 580, shape: "mug-wrap-body" }, required: true, orientation: "wrap" },
    ],
    acceptance: { noViewFallback: true, noCrossFamilyAssetReuse: true, sameColorIdentityAcrossViews: true, samePrintZoneCoordinateSpace: true },
  },
  cap: {
    family: "cap", productType: "cap", displayName: "Structured Cap",
    schema: "trynex-canonical-mockup/v1", masterFormat: "psd", masterStatus: "verified",
    normalizedCanvas: { width: 1000, height: 1000 }, colors: CANONICAL_MOCKUP_COLORS.cap,
    geometry: {
      silhouetteId: "cap-structured-5panel-v1", frontBackPairId: "cap-front-back-v1", colorMaterialId: "cap-cotton-v1", aspectLock: true,
      protectedDetails: ["brim", "crown-seams", "rear-opening", "strap"],
    },
    views: [
      { view: "front", label: "Front", assetKey: "cap/{color}/front", printZone: { x: 240, y: 260, w: 540, h: 320, shape: "cap-front" }, required: true, orientation: "front" },
      { view: "back", label: "Back", assetKey: "cap/{color}/back", printZone: { x: 285, y: 270, w: 430, h: 230 }, required: true, orientation: "back" },
    ],
    acceptance: { noViewFallback: true, noCrossFamilyAssetReuse: true, sameColorIdentityAcrossViews: true, samePrintZoneCoordinateSpace: true },
  },
  waterbottle: {
    family: "waterbottle", productType: "waterbottle", displayName: "Water Bottle — White Sublimation Aluminium",
    schema: "trynex-canonical-mockup/v1", masterFormat: "psb", masterStatus: "verified",
    normalizedCanvas: { width: 1000, height: 1000 }, colors: CANONICAL_MOCKUP_COLORS.waterbottle,
    geometry: {
      silhouetteId: "waterbottle-aluminium-carabiner-v1", frontBackPairId: "waterbottle-front-back-v1", colorMaterialId: "waterbottle-aluminium-v1", aspectLock: true,
      protectedDetails: ["lid", "key-ring-loop", "side-carabiner", "shoulder", "rounded-base"],
    },
    views: [
      { view: "front", label: "Front", assetKey: "waterbottle/{color}/front", printZone: { x: 335, y: 320, w: 276, h: 590, shape: "bottle-body" }, required: true, orientation: "front" },
      { view: "back", label: "Back", assetKey: "waterbottle/{color}/back", printZone: { x: 335, y: 320, w: 276, h: 590, shape: "bottle-body" }, required: true, orientation: "back" },
    ],
    acceptance: { noViewFallback: true, noCrossFamilyAssetReuse: true, sameColorIdentityAcrossViews: true, samePrintZoneCoordinateSpace: true },
  },
};

export function getCanonicalMockupSpec(family: MockupFamily): CanonicalMockupSpec {
  return CANONICAL_MOCKUP_SPECS[family];
}

export function requiredCanonicalAssetKeys(family: MockupFamily): string[] {
  return CANONICAL_MOCKUP_SPECS[family].views.filter(v => v.required).map(v => v.assetKey);
}

export function validateCanonicalMockupSpec(spec: CanonicalMockupSpec): string[] {
  const errors: string[] = [];
  if (spec.normalizedCanvas.width !== 1000 || spec.normalizedCanvas.height !== 1000) errors.push(`${spec.family}: canvas must be 1000×1000`);
  if (new Set(spec.views.map(v => v.assetKey)).size !== spec.views.length) errors.push(`${spec.family}: duplicate view asset keys`);
  if (!spec.geometry.frontBackPairId) errors.push(`${spec.family}: missing front/back pair id`);
  for (const view of spec.views) {
    if (view.printZone.w <= 0 || view.printZone.h <= 0) errors.push(`${spec.family}/${view.view}: invalid print zone`);
    if (!view.assetKey.includes("{color}")) errors.push(`${spec.family}/${view.view}: asset key is not color-scoped`);
  }
  return errors;
}

export function validateAllCanonicalMockups(): string[] {
  return (Object.keys(CANONICAL_MOCKUP_SPECS) as MockupFamily[]).flatMap(family => validateCanonicalMockupSpec(CANONICAL_MOCKUP_SPECS[family]));
}
