/**
 * Build the browser runtime role exports from the same reviewed source-photo
 * pixels used by build-smartobject-mockups.mjs.
 *
 * Editable PSD/PSB masters and runtime roles remain in staging. The optional
 * --public directory receives only the reviewed PNG roles plus the manifest.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { CANONICAL, pngBytes, protectedDetails, readPng, shadowMap, highlightMap, solid } from "./build-smartobject-mockups.mjs";
import { PNG } from "pngjs";

const REPO = path.resolve(import.meta.dirname, "..");
const stagingRoot = path.resolve(process.argv[process.argv.indexOf("--staging") + 1] ?? path.join(REPO, "dist-mockups", "staging", "smart-v10-v3"));
const publicRootArg = process.argv.indexOf("--public");
const publicRoot = publicRootArg >= 0 ? path.resolve(process.argv[publicRootArg + 1]) : null;
const roleRoot = path.join(stagingRoot, "runtime-roles");
const sourceRoot = path.join(stagingRoot, "sources");
const stagingManifestPath = path.join(stagingRoot, "manifest.json");
const CANVAS = 1024;

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function roleEntry(filePath, sourceLayerPrefix) {
  const bytes = readFileSync(filePath);
  return {
    path: path.relative(REPO, filePath),
    sha256: sha256(bytes),
    sourceLayerPrefix,
  };
}

function hasVisibleAlpha(filePath) {
  const decoded = PNG.sync.read(readFileSync(filePath));
  for (let index = 3; index < decoded.data.length; index += 4) {
    if (decoded.data[index] > 0) return true;
  }
  return false;
}

function printMask(zone) {
  const data = new Uint8Array(CANVAS * CANVAS * 4);
  for (let y = Math.max(0, zone.y); y < Math.min(CANVAS, zone.y + zone.h); y++) {
    for (let x = Math.max(0, zone.x); x < Math.min(CANVAS, zone.x + zone.w); x++) {
      const i = (y * CANVAS + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = 255;
    }
  }
  return { data, width: CANVAS, height: CANVAS };
}

function removeFiles(root) {
  if (!existsSync(root)) return;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) rmSync(file, { recursive: true, force: true });
    else rmSync(file, { force: true });
  }
}

if (!existsSync(stagingManifestPath)) throw new Error(`missing staging manifest: ${stagingManifestPath}`);
const stagingManifest = JSON.parse(readFileSync(stagingManifestPath, "utf8"));
if (stagingManifest.surfaceCount !== 188 || stagingManifest.surfaces?.length !== 188) {
  throw new Error(`expected 188 staged surfaces, found ${stagingManifest.surfaces?.length ?? 0}`);
}

removeFiles(roleRoot);
mkdirSync(roleRoot, { recursive: true });
const runtimeSurfaces = [];

for (const row of stagingManifest.surfaces) {
  const sourcePath = path.join(sourceRoot, row.family, row.color, `${row.view}.png`);
  if (!existsSync(sourcePath)) throw new Error(`missing derived base source: ${path.relative(REPO, sourcePath)}`);
  const base = readPng(sourcePath);
  const zone = row.printZone;
  const surfaceDir = path.join(roleRoot, row.family, row.color);
  mkdirSync(surfaceDir, { recursive: true });
  const prefix = `${row.view}`;
  const roles = [
    ["studioBackground", solid(CANVAS, CANVAS, 250, 248, 245, 255), "00 Studio Background"],
    ["base", base, "10 Product Base"],
    ["shadow", shadowMap(base), "20 Shadow / Fold Map"],
    ["protected", protectedDetails(base, row.family, row.view, zone), "40 Protected Details"],
    ["highlight", highlightMap(base), "50 Highlight / Material Response"],
    ["printMask", printMask(zone), "60 Print Zone Mask"],
  ];
  const manifestRoles = {};
  for (const [role, image, sourceLayerPrefix] of roles) {
    const filename = `${prefix}-${role === "printMask" ? "print-mask" : role}.png`;
    const filePath = path.join(surfaceDir, filename);
    writeFileSync(filePath, pngBytes(image));
    manifestRoles[role] = roleEntry(filePath, sourceLayerPrefix);
  }
  if (!hasVisibleAlpha(manifestRoles.protected.path)) {
    throw new Error(`${row.family}/${row.color}/${row.view}: protected role is empty`);
  }
  runtimeSurfaces.push({
    surfaceKey: `${row.family}/${row.color}/${row.view}`,
    family: row.family,
    color: row.color,
    view: row.view,
    printZone: row.printZone,
    normalizedFrame: row.normalizedFrame,
    masterPath: row.masterPath,
    masterChecksum: row.masterChecksum,
    masterSize: statSync(path.resolve(REPO, row.masterPath)).size,
    masterFormat: row.masterFormat,
    smartObject: row.smartObject,
    reviewStatus: row.reviewStatus,
    roles: manifestRoles,
    blendModes: { shadow: "multiply", highlight: "screen", protected: "source-over" },
  });
}

const runtimeManifest = {
  schema: "trynex-smartobject-runtime-roles/v1",
  status: "accepted",
  sourceManifest: path.relative(REPO, stagingManifestPath),
  sourceMasterCount: 188,
  surfaceCount: runtimeSurfaces.length,
  runtimeRoot: path.relative(REPO, roleRoot),
  protectedDetails: {
    source: "reviewed v10 source-photo edge extraction",
    sourceLayerPrefix: "40 Protected Details",
    nonEmptyRequired: true,
  },
  surfaces: runtimeSurfaces,
};
writeFileSync(path.join(roleRoot, "manifest.json"), `${JSON.stringify(runtimeManifest, null, 2)}\n`);

if (publicRoot) {
  const publicRoleRoot = path.join(publicRoot, "runtime-roles");
  removeFiles(publicRoleRoot);
  mkdirSync(publicRoleRoot, { recursive: true });
  for (const row of runtimeSurfaces) {
    const sourceDir = path.join(roleRoot, row.family, row.color);
    const targetDir = path.join(publicRoleRoot, row.family, row.color);
    mkdirSync(targetDir, { recursive: true });
    for (const role of ["studioBackground", "base", "shadow", "protected", "highlight", "printMask"]) {
      const filename = `${row.view}-${role === "printMask" ? "print-mask" : role}.png`;
      writeFileSync(path.join(targetDir, filename), readFileSync(path.join(sourceDir, filename)));
      row.roles[role].path = path.relative(REPO, path.join(publicRoleRoot, row.family, row.color, filename));
    }
  }
  const publicManifest = { ...runtimeManifest, runtimeRoot: path.relative(REPO, publicRoleRoot), surfaces: runtimeSurfaces };
  writeFileSync(path.join(publicRoleRoot, "manifest.json"), `${JSON.stringify(publicManifest, null, 2)}\n`);
}

console.log(JSON.stringify({
  status: "accepted",
  surfaceCount: runtimeSurfaces.length,
  stagingRuntime: path.relative(REPO, roleRoot),
  publicRuntime: publicRoot ? path.relative(REPO, path.join(publicRoot, "runtime-roles")) : null,
}, null, 2));