import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { PNG } from "pngjs";

const projectRoot = process.cwd();
const runtimeRoot = join(projectRoot, "artifacts/trynex-storefront/public/mockups/psd-master-v10/runtime-roles");
const manifestPath = join(runtimeRoot, "manifest.json");
const expectedColors = {
  tshirt: ["white", "black", "navy", "maroon", "olive", "sky-blue", "grey", "red"],
  longsleeve: ["white", "black", "charcoal", "heather-grey", "navy", "royal-blue", "forest-green", "burgundy", "red", "sand"],
  hoodie: ["white", "black", "charcoal", "heather-grey", "navy", "royal-blue", "forest-green", "burgundy", "red", "sand"],
  mug: ["white", "black", "navy", "red", "green", "purple", "sky-blue", "pink", "maroon", "orange"],
  cap: ["white", "black", "navy", "maroon", "olive", "red", "grey", "forest"],
  waterbottle: ["white"],
};
const expectedViews = {
  tshirt: ["front", "back", "left-sleeve", "right-sleeve", "neck-label"],
  longsleeve: ["front", "back", "left-sleeve", "right-sleeve", "neck-label"],
  hoodie: ["front", "back", "left-sleeve", "right-sleeve", "neck-label"],
  mug: ["front", "back", "wrap"],
  cap: ["front", "back"],
  waterbottle: ["front", "back"],
};
const expectedRoles = ["studioBackground", "base", "shadow", "protected", "highlight", "printMask"];

if (!existsSync(manifestPath)) throw new Error(`Missing v10.3 runtime manifest: ${relative(projectRoot, manifestPath)}`);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const errors = [];
if (manifest.schema !== "trynex-smartobject-runtime-roles/v1") errors.push("unexpected runtime role manifest schema");
if (manifest.status !== "accepted") errors.push(`runtime manifest status is ${manifest.status}, expected accepted`);
if (manifest.surfaceCount !== 188 || manifest.surfaces?.length !== 188) {
  errors.push(`runtime surface count is ${manifest.surfaces?.length ?? 0}, expected 188`);
}

const expectedKeys = new Set(
  Object.entries(expectedColors).flatMap(([family, colors]) =>
    colors.flatMap((color) => expectedViews[family].map((view) => `${family}/${color}/${view}`)),
  ),
);
const actualKeys = new Set();
for (const surface of manifest.surfaces ?? []) {
  if (actualKeys.has(surface.surfaceKey)) errors.push(`duplicate surface: ${surface.surfaceKey}`);
  actualKeys.add(surface.surfaceKey);
  if (!expectedKeys.has(surface.surfaceKey)) errors.push(`unexpected surface: ${surface.surfaceKey}`);
  for (const role of expectedRoles) {
    const entry = surface.roles?.[role];
    if (!entry?.path || !/^[a-f0-9]{64}$/.test(entry.sha256 ?? "")) {
      errors.push(`${surface.surfaceKey}: invalid ${role} manifest entry`);
      continue;
    }
    const marker = "runtime-roles/";
    const markerIndex = entry.path.indexOf(marker);
    const publicPath = markerIndex >= 0
      ? join(runtimeRoot, entry.path.slice(markerIndex + marker.length))
      : "";
    if (!publicPath || !existsSync(publicPath)) {
      errors.push(`${surface.surfaceKey}: missing ${role} asset`);
      continue;
    }
    const digest = createHash("sha256").update(readFileSync(publicPath)).digest("hex");
    if (digest !== entry.sha256) errors.push(`${surface.surfaceKey}: ${role} checksum mismatch`);
    const png = readFileSync(publicPath);
    if (png.length < 26 || png.readUInt32BE(0) !== 0x89504e47 || png.toString("ascii", 12, 16) !== "IHDR") {
      errors.push(`${surface.surfaceKey}: ${role} is not a PNG`);
    } else if (png.readUInt32BE(16) !== 1024 || png.readUInt32BE(20) !== 1024) {
      errors.push(`${surface.surfaceKey}: ${role} is not 1024x1024`);
    } else if (role === "protected") {
      const decoded = PNG.sync.read(png);
      let visible = false;
      for (let index = 3; index < decoded.data.length; index += 4) {
        if (decoded.data[index] > 0) {
          visible = true;
          break;
        }
      }
      if (!visible) errors.push(`${surface.surfaceKey}: protected role is fully transparent`);
    }
  }
}
for (const key of expectedKeys) if (!actualKeys.has(key)) errors.push(`missing surface: ${key}`);

const sourceRoot = join(projectRoot, "artifacts/trynex-storefront/src");
const forbiddenRoots = ["/mockups/smart-v4/", "/mockups/smart-v7/", "/mockups/smart-v8/", "/mockups/smart-v9/", "/mockups/waterbottle-v11/"];
const walk = (dir) => {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
};
for (const file of walk(sourceRoot).filter((file) => /\.(ts|tsx|js|jsx)$/.test(file))) {
  const text = readFileSync(file, "utf8");
  for (const root of forbiddenRoots) if (text.includes(root)) errors.push(`${relative(projectRoot, file)}: retired runtime reference ${root}`);
}

if (errors.length) {
  console.error(JSON.stringify({ expectedSurfaces: expectedKeys.size, actualSurfaces: actualKeys.size, errors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({
  expectedSurfaces: expectedKeys.size,
  runtimeRoles: expectedKeys.size * expectedRoles.length,
  status: "accepted",
  root: relative(projectRoot, runtimeRoot),
}, null, 2));
