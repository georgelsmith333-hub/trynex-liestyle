/* ═══════════════════════════════════════════════════════
   GARMENT 3D — shared geometry & material helpers
   Used by both ProductViewer3D (studio) and CartViewer3D (cart/checkout/admin)
   so the two views always render identically.

   GLB models (public/models/):
     tshirt.glb      → real apparel mesh (authored UVs ignored — we re-project)
     hoodie.glb      → ExtrudeGeometry body + SphereGeometry hood (2 primitives)
     longsleeve.glb  → ExtrudeGeometry body with long sleeves (1 primitive)
     cap.glb         → SphereGeometry crown + ExtrudeGeometry brim (2 primitives)
     mug.glb         → 5 primitives: body / inner / bottom / rim / handle

   ⚠️  Primitive ordering contract: code below destructures meshes[] by fixed index
   (matching the order emitted by scripts/generate-models.cjs).

   ── Design-overlay UV strategy ──────────────────────────
   The design canvas is a 1024×1024 (or 2048×768 for mug) texture rendered into
   a unified 1000-unit coordinate space. To guarantee the design lands on the
   FRONT of the garment regardless of how the source GLB was UV-unwrapped, we
   compute a fresh planar-projection UV set from the mesh's local XY positions:

     u = (x - xMin) / xSize
     v = 1 − (y - yMin) / ySize        (flip-Y matches THREE flipY default)

   Front overlay: planar +Z projection, side=FrontSide (only front polys draw).
   Back overlay:  same mesh wrapped in a [0, π, 0]-rotated group so its
                  front-normals only face the camera when orbited to the back.
                  We mirror U (u → 1 − u) so the rotated text reads correctly.

   The BASE mesh keeps the GLB's authored UVs (or no UVs at all — it only
   uses a flat color material), so we never touch it.
════════════════════════════════════════════════════════ */
import { useMemo, useEffect, useRef } from "react";
import * as THREE from "three";
import { useGLTF, useProgress, OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { hasWebGL2 } from "../pages/design-studio/composer";

// Keep the ref contract local so duplicate React type trees from the mobile
// workspace cannot collapse ElementRef<typeof OrbitControls> to never.
type OrbitControlsRef = { reset: () => void };

export { hasWebGL2 };

/* ───────── Procedural fabric / ceramic micro-surface maps ─────────
 * Generated once at module load so every viewer instance shares the
 * same THREE.CanvasTexture (no per-render allocation, no asset files).
 * Cotton: faint cross-weave normal + speckled roughness modulation.
 * Ceramic: fine speckled roughness for the mug glaze.
 */
function makeFabricMaps(): { normal: THREE.Texture; rough: THREE.Texture } | null {
  if (typeof document === "undefined") return null;
  const SIZE = 256;
  // Normal map — encode a subtle cross-weave pattern.
  const normalCanvas = document.createElement("canvas");
  normalCanvas.width = normalCanvas.height = SIZE;
  const nctx = normalCanvas.getContext("2d");
  if (!nctx) return null;
  const nimg = nctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      // Two perpendicular sine waves at thread frequency
      const wx = Math.sin((x / SIZE) * Math.PI * 64) * 0.18;
      const wy = Math.sin((y / SIZE) * Math.PI * 64) * 0.18;
      const i = (y * SIZE + x) * 4;
      nimg.data[i]     = Math.round(128 + wx * 127);
      nimg.data[i + 1] = Math.round(128 + wy * 127);
      nimg.data[i + 2] = 255;
      nimg.data[i + 3] = 255;
    }
  }
  nctx.putImageData(nimg, 0, 0);
  const normalTex = new THREE.CanvasTexture(normalCanvas);
  normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;
  normalTex.repeat.set(8, 8);
  normalTex.colorSpace = THREE.NoColorSpace;

  // Roughness modulation — subtle speckled noise
  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = roughCanvas.height = SIZE;
  const rctx = roughCanvas.getContext("2d");
  if (!rctx) return null;
  const rimg = rctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < rimg.data.length; i += 4) {
    const v = 200 + Math.floor((Math.random() - 0.5) * 60);
    rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = v;
    rimg.data[i + 3] = 255;
  }
  rctx.putImageData(rimg, 0, 0);
  const roughTex = new THREE.CanvasTexture(roughCanvas);
  roughTex.wrapS = roughTex.wrapT = THREE.RepeatWrapping;
  roughTex.repeat.set(8, 8);
  roughTex.colorSpace = THREE.NoColorSpace;

  return { normal: normalTex, rough: roughTex };
}

const FABRIC_MAPS = makeFabricMaps();

// Print-zone constants imported for reference / future UV-crop helpers
export {
  TSHIRT_PZ,
  LONGSLEEVE_PZ,
  HOODIE_PZ,
  CAP_PZ,
  MUG_PZ,
  WATERBOTTLE_PZ,
} from "../pages/design-studio/mockups";

/**
 * adjustGarmentColor — ensures extreme garment colours (pure white / pure black)
 * have enough tonal separation to show 3-D form under studio lighting.
 *
 * Pure white (#F8F7F4) reflects all directional light uniformly → flat blob.
 * Pure black (#1a1a1a) absorbs almost all light → invisible silhouette.
 *
 * We nudge near-white to a warm off-white and near-black to a dark charcoal
 * so the shape contours and fabric micro-texture remain legible.
 * All other colours are returned unchanged.
 */
export function adjustGarmentColor(hex: string): string {
  if (!hex || hex.length < 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Perceived luminance (Rec. 601)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum > 0.88) return "#ffffff";   // near-white → pure white so photo looks correct
  if (lum < 0.15) return "#2e2e2e";   // dark charcoal — catches #1a1a1a / #1C1917 correctly
  return hex;
}

/* ─────────────────────────────── helpers ─────────────── */

/** Load a texture from a URL (memoised). Returns null when url is falsy. */
export function useUrlTexture(url: string | undefined): THREE.Texture | null {
  return useMemo(() => {
    if (!url) return null;
    const t = new THREE.TextureLoader().load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
}

/** Collect all Mesh objects from a GLTF scene in depth-first order. */
function collectMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  return meshes;
}

/**
 * Build a NEW geometry containing only the triangles of `src` whose averaged
 * face-normal lies in the requested Z hemisphere (front = +Z, back = −Z).
 * This is the key correctness step: filtering by normal guarantees the
 * front/back overlays are physically isolated to their respective panels,
 * so a design painted onto the front never bleeds onto back-of-shirt or
 * side polygons (and vice versa).
 *
 * UVs on the resulting geometry are planar-projected from the +Z direction
 * over its OWN local XY bounding box (so the kept triangles span [0,1]).
 * For the back hemisphere, U is mirrored so the design reads correctly
 * when the back camera orbits around to face it.
 *
 * Performance: O(triCount) one-shot build at module mount; memoised by
 * source geometry, so the per-frame render path pays nothing.
 */
function buildHemisphereOverlay(
  src: THREE.BufferGeometry,
  hemisphere: "front" | "back",
  threshold: number = 0.15
): THREE.BufferGeometry | null {
  // Compute per-vertex normals on a clone so we don't mutate the source
  const tmp = src.clone();
  tmp.computeVertexNormals();
  const pos = tmp.attributes.position;
  const norm = tmp.attributes.normal;
  const idx = tmp.index;

  const triCount = idx ? Math.floor(idx.count / 3) : Math.floor(pos.count / 3);
  const wantPositive = hemisphere === "front";
  const flipU = hemisphere === "back";

  // First pass: collect triangle indices that match the hemisphere
  const keptTriIdx: number[] = [];
  for (let t = 0; t < triCount; t++) {
    const a = idx ? idx.getX(t * 3)     : t * 3;
    const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    const nz = (norm.getZ(a) + norm.getZ(b) + norm.getZ(c)) / 3;
    if (wantPositive ? nz > threshold : nz < -threshold) {
      keptTriIdx.push(a, b, c);
    }
  }
  if (keptTriIdx.length === 0) return null;

  // Second pass: deduplicate vertices into a compact new geometry
  const vertMap = new Map<number, number>();
  const newPos: number[] = [];
  const newIdx: number[] = [];
  for (const oldI of keptTriIdx) {
    let newI = vertMap.get(oldI);
    if (newI === undefined) {
      newI = newPos.length / 3;
      newPos.push(pos.getX(oldI), pos.getY(oldI), pos.getZ(oldI));
      vertMap.set(oldI, newI);
    }
    newIdx.push(newI);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(newPos, 3));
  geo.setIndex(newIdx);
  geo.computeBoundingBox();

  // Planar +Z UV projection over the kept-triangles bounding box
  const bb = geo.boundingBox!;
  let xMin = bb.min.x;
  let yMin = bb.min.y;
  let xSize = (bb.max.x - bb.min.x) || 1;
  let ySize = (bb.max.y - bb.min.y) || 1;

  // Per-category UV padding so that a design at the centre of the 2D print zone
  // lands on the actual print panel (chest / cap-front / upper-back) of the GLB,
  // not on the top of the dome / hood / hem.
  //
  // V mapping below is `v = (geomY - yMin) / ySize`. With THREE's default
  // flipY=true on CanvasTextures, sampling v=1 returns the TOP of the source
  // canvas (y=0). So vertices with high geometry-Y (top of garment) sample
  // canvas top — designs read right-side-up.
  const cat = src.userData.category;
  if (hemisphere === "front") {
    if (cat === "cap") {
      // Cap dome bbox spans top→bottom of crown; the printable front panel
      // sits in the LOWER-FRONT of the dome. Shift the V window down.
      yMin -= ySize * 0.55;
      ySize *= 1.10;
    } else if (cat === "hoodie") {
      // Body-only mesh used for both front+back overlay; print zone sits a
      // touch lower than geometric centre because of the hood mass above.
      yMin -= ySize * 0.10;
      ySize *= 1.15;
    } else if (cat === "longsleeve") {
      yMin -= ySize * 0.04;
      ySize *= 1.06;
    }
  } else {
    if (cat === "hoodie") {
      yMin -= ySize * 0.05;
      ySize *= 1.10;
    } else if (cat === "longsleeve") {
      ySize *= 1.06;
    }
  }

  const vertCount = newPos.length / 3;
  const uv = new Float32Array(vertCount * 2);
  for (let i = 0; i < vertCount; i++) {
    let u = (newPos[i * 3]     - xMin) / xSize;
    const v = (newPos[i * 3 + 1] - yMin) / ySize;
    if (flipU) u = 1 - u;
    uv[i * 2]     = u;
    uv[i * 2 + 1] = v;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

/** Hook variants — memoise by source geometry identity. */
function useFrontOverlayGeometry(src: THREE.BufferGeometry | null | undefined) {
  return useMemo(() => (src ? buildHemisphereOverlay(src, "front") : null), [src]);
}
function useBackOverlayGeometry(src: THREE.BufferGeometry | null | undefined) {
  return useMemo(() => (src ? buildHemisphereOverlay(src, "back") : null), [src]);
}

/* ─────────────────────────────── T-SHIRT (GLB) ───────── */
export function RealisticShirt({
  frontTex,
  backTex,
  garmentColor,
}: {
  frontTex?: THREE.Texture | null;
  backTex?: THREE.Texture | null;
  garmentColor: string;
}) {
  const { scene } = useGLTF("/models/tshirt.glb") as { scene: THREE.Group };
  const meshes = useMemo(() => {
    const ms = collectMeshes(scene);
    ms.forEach(m => { m.geometry.userData.category = "tshirt"; });
    return ms;
  }, [scene]);
  const baseGeo = meshes[0]?.geometry ?? null;

  const frontGeo = useFrontOverlayGeometry(baseGeo);
  const backGeo = useBackOverlayGeometry(baseGeo);

  const renderColor = useMemo(() => {
    if (!garmentColor) return "#ffffff";
    const h = garmentColor.replace("#", "");
    if (h.length === 6) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      if ((0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.88) return "#ffffff";
    }
    return garmentColor;
  }, [garmentColor]);

  if (!baseGeo) return null;

  return (
    <group scale={2.6}>
      <mesh geometry={baseGeo} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={renderColor}
          roughness={0.85}
          metalness={0.0}
          normalMap={FABRIC_MAPS?.normal ?? null}
          normalScale={new THREE.Vector2(0.40, 0.40)}
          roughnessMap={FABRIC_MAPS?.rough ?? null}
          sheen={0.6}
          sheenRoughness={0.72}
          sheenColor={renderColor}
          envMapIntensity={0.55}
        />
      </mesh>
      {frontTex && frontGeo && (
        <mesh geometry={frontGeo} scale={1.003}>
            <meshStandardMaterial
              map={frontTex} transparent roughness={0.72} metalness={0}
              normalMap={FABRIC_MAPS?.normal ?? null}
              normalScale={new THREE.Vector2(0.12, 0.12)}
              depthWrite={false} alphaTest={0.02} side={THREE.FrontSide}
              envMapIntensity={0.3}
              blending={THREE.NormalBlending}
            />
        </mesh>
      )}
      {backTex && backGeo && (
        <mesh geometry={backGeo} scale={1.003}>
          <meshStandardMaterial
            map={backTex} transparent roughness={0.72} metalness={0}
            normalMap={FABRIC_MAPS?.normal ?? null}
            normalScale={new THREE.Vector2(0.12, 0.12)}
            depthWrite={false} alphaTest={0.02} side={THREE.FrontSide}
            envMapIntensity={0.3}
            blending={THREE.NormalBlending}
          />
        </mesh>
      )}
    </group>
  );
}
// useGLTF.preload("/models/tshirt.glb"); // GLB not bundled — T-shirt uses PhotoMockupMesh

/* ─── Shared garment body (hoodie / longsleeve) ────────── */
function GarmentGLB({
  modelPath,
  frontTex,
  backTex,
  garmentColor,
  roughness = 0.88,
}: {
  modelPath: string;
  frontTex?: THREE.Texture | null;
  backTex?: THREE.Texture | null;
  garmentColor: string;
  roughness?: number;
}) {
  const { scene } = useGLTF(modelPath) as { scene: THREE.Group };
  const meshes = useMemo(() => {
    const ms = collectMeshes(scene);
    // modelPath starts with "/models/", e.g. "/models/hoodie.glb"
    const cat = modelPath.split("/").pop()?.split(".")[0];
    ms.forEach(m => { m.geometry.userData.category = cat; });
    return ms;
  }, [scene, modelPath]);
  const bodyGeo = meshes[0]?.geometry ?? null;

  const frontGeo = useFrontOverlayGeometry(bodyGeo);
  const backGeo = useBackOverlayGeometry(bodyGeo);

  // Adjust extreme garment colours so white/black show 3-D form under lighting
  const renderColor = useMemo(() => adjustGarmentColor(garmentColor), [garmentColor]);

  if (meshes.length === 0) return null;

  return (
    <group scale={0.85}>
      {/* Base colour for every part — apply procedural fabric maps */}
      {meshes.map((m, i) => (
        <mesh key={i} geometry={m.geometry} castShadow receiveShadow>
          <meshPhysicalMaterial
            color={renderColor}
            roughness={roughness}
            metalness={0.0}
            normalMap={FABRIC_MAPS?.normal ?? null}
            normalScale={new THREE.Vector2(0.40, 0.40)}
            roughnessMap={FABRIC_MAPS?.rough ?? null}
            sheen={0.6}
            sheenRoughness={0.72}
            sheenColor={renderColor}
            envMapIntensity={0.55}
          />
        </mesh>
      ))}
      {frontTex && frontGeo && (
        <mesh geometry={frontGeo} scale={1.003}>
          <meshStandardMaterial
            map={frontTex} transparent roughness={roughness - 0.14}
            normalMap={FABRIC_MAPS?.normal ?? null}
            normalScale={new THREE.Vector2(0.12, 0.12)}
            depthWrite={false} alphaTest={0.02} side={THREE.FrontSide}
            envMapIntensity={0.3}
            blending={THREE.NormalBlending}
          />
        </mesh>
      )}
      {backTex && backGeo && (
        <mesh geometry={backGeo} scale={1.003}>
          <meshStandardMaterial
            map={backTex} transparent roughness={roughness - 0.14}
            normalMap={FABRIC_MAPS?.normal ?? null}
            normalScale={new THREE.Vector2(0.12, 0.12)}
            depthWrite={false} alphaTest={0.02} side={THREE.FrontSide}
            envMapIntensity={0.3}
            blending={THREE.NormalBlending}
          />
        </mesh>
      )}
    </group>
  );
}

/* ─────────────────────── LONGSLEEVE ──────────────────── */
export function LongSleeveBody({
  frontTex, backTex, garmentColor,
}: {
  frontTex?: THREE.Texture | null;
  backTex?: THREE.Texture | null;
  garmentColor: string;
}) {
  return (
    <GarmentGLB
      modelPath="/models/longsleeve.glb"
      frontTex={frontTex}
      backTex={backTex}
      garmentColor={garmentColor}
      roughness={0.88}
    />
  );
}
// useGLTF.preload("/models/longsleeve.glb"); // GLB not bundled — CartViewer3D uses PhotoMockupMesh

/* ─────────────────────── HOODIE ──────────────────────── */
export function HoodieBody({
  frontTex, backTex, garmentColor,
}: {
  frontTex?: THREE.Texture | null;
  backTex?: THREE.Texture | null;
  garmentColor: string;
}) {
  return (
    <GarmentGLB
      modelPath="/models/hoodie.glb"
      frontTex={frontTex}
      backTex={backTex}
      garmentColor={garmentColor}
      roughness={0.88}
    />
  );
}
// useGLTF.preload("/models/hoodie.glb"); // GLB not bundled — CartViewer3D uses PhotoMockupMesh

/* ─────────────────────── CAP ─────────────────────────── */
export function CapBody({
  frontTex, garmentColor,
}: {
  frontTex?: THREE.Texture | null;
  garmentColor: string;
}) {
  const { scene } = useGLTF("/models/cap.glb") as { scene: THREE.Group };
  const meshes = useMemo(() => {
    const ms = collectMeshes(scene);
    ms.forEach(m => { m.geometry.userData.category = "cap"; });
    return ms;
  }, [scene]);
  const crownGeo = meshes[0]?.geometry ?? null;
  const frontGeo = useFrontOverlayGeometry(crownGeo);

  if (meshes.length === 0) return null;

  // crown = meshes[0], brim = meshes[1] (matches generator order).
  // Generator authors the cap at radius 1.1 (~1.4 units wide) — without an
  // explicit scale wrapper the cap rendered at a different size than the
  // other garments and the camera framed only its inner crown panel,
  // which the user described as a "flat blank shape". Wrap in scale 1.6
  // so the cap visually matches the tee/hoodie scene size.
  return (
    <group scale={1.6}>
      {meshes.map((m, i) => (
        <mesh key={i} geometry={m.geometry} castShadow receiveShadow>
          <meshStandardMaterial color={garmentColor} roughness={i === 1 ? 0.7 : 0.75} metalness={0.02} />
        </mesh>
      ))}
      {frontTex && frontGeo && (
        <mesh geometry={frontGeo} scale={1.003}>
          <meshStandardMaterial
            map={frontTex} transparent roughness={0.6}
            depthWrite={false} alphaTest={0.02} side={THREE.FrontSide}
          />
        </mesh>
      )}
    </group>
  );
}
// useGLTF.preload("/models/cap.glb"); // GLB not bundled — CartViewer3D uses PhotoMockupMesh

/* ─────────────────────── MUG ─────────────────────────── */
export function MugBody({
  wrapTex,
  garmentColor,
  isWrapMode = false,
  activeFace = "front",
}: {
  wrapTex?: THREE.Texture | null;
  garmentColor: string;
  isWrapMode?: boolean;
  activeFace?: "front" | "back";
}) {
  const H     = 1.80;
  const R_TOP = 0.72;
  const R_BOT = 0.65;
  const SEG   = 80;

  // Outer body — open-ended so Three.js generates clean side UVs (u wraps 0→1).
  const bodyGeo = useMemo(
    () => new THREE.CylinderGeometry(R_TOP, R_BOT, H, SEG, 1, true),
    []
  );

  // Front-half overlay for single-side mode.
  // Half-cylinder spanning −X → +Z → +X with a planar XY UV projection so the
  // design maps straight onto the front face without wrapping around the handle side.
  // UV: u = (x + R_TOP) / (2·R_TOP),  v = (y + H/2) / H
  const frontOverlayGeo = useMemo(() => {
    const geo = new THREE.CylinderGeometry(
      R_TOP + 0.004, R_BOT + 0.004, H,
      80, 1, true,
      (3 * Math.PI) / 2,
      Math.PI,
    );
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const uvArr = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uvArr[i * 2]     = (pos.getX(i) + R_TOP) / (2 * R_TOP);
      uvArr[i * 2 + 1] = (pos.getY(i) + H / 2) / H;
    }
    geo.setAttribute("uv", new THREE.BufferAttribute(uvArr, 2));
    return geo;
  }, []);

  // Inner ceramic liner — visible when the camera looks down into the cup.
  const innerGeo = useMemo(
    () => new THREE.CylinderGeometry(R_TOP - 0.04, R_BOT - 0.04, H - 0.03, SEG, 1, false),
    []
  );

  // Flat base disk.
  const bottomGeo = useMemo(() => new THREE.CircleGeometry(R_BOT, SEG), []);

  // Horizontal rim torus at the top lip.
  const rimGeo = useMemo(() => new THREE.TorusGeometry(R_TOP, 0.028, 16, SEG), []);

  // C-shaped handle on the +X (right) side — smooth TubeGeometry curve.
  const handleGeo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(R_TOP - 0.01,  H / 2 - 0.22, 0),
      new THREE.Vector3(R_TOP + 0.44,  H / 2 - 0.40, 0),
      new THREE.Vector3(R_TOP + 0.58,  0.08,          0),
      new THREE.Vector3(R_TOP + 0.44, -H / 2 + 0.52, 0),
      new THREE.Vector3(R_BOT - 0.01, -H / 2 + 0.38, 0),
    ]);
    return new THREE.TubeGeometry(curve, 40, 0.058, 12, false);
  }, []);

  useEffect(() => {
    if (!wrapTex) return;
    if (isWrapMode) {
      wrapTex.wrapS = THREE.RepeatWrapping;
      wrapTex.wrapT = THREE.ClampToEdgeWrapping;
      wrapTex.repeat.set(1, 1);
      wrapTex.offset.set(0.25, 0);
      wrapTex.flipY = true;
    } else {
      wrapTex.wrapS = THREE.ClampToEdgeWrapping;
      wrapTex.wrapT = THREE.ClampToEdgeWrapping;
      wrapTex.repeat.set(0.5, 1);
      wrapTex.offset.set(0.0, 0.0);
      wrapTex.flipY = true;
    }
    wrapTex.needsUpdate = true;
  }, [wrapTex, isWrapMode]);

  return (
    <group>
      {/* Outer body — high-fidelity ceramic glaze: strong clearcoat, near-zero metalness */}
      <mesh geometry={bodyGeo} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={garmentColor}
          roughness={0.14}
          metalness={0.0}
          clearcoat={0.95}
          clearcoatRoughness={0.06}
          reflectivity={0.92}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* Single-side: planar front-half overlay */}
      {wrapTex && !isWrapMode && (
        <mesh
          geometry={frontOverlayGeo}
          rotation-y={activeFace === "back" ? Math.PI : 0}
        >
          <meshStandardMaterial
            map={wrapTex}
            transparent
            roughness={0.25}
            metalness={0}
            depthWrite={false}
            alphaTest={0.02}
            side={THREE.FrontSide}
          />
        </mesh>
      )}

      {/* Full wrap: design spans entire 360° body */}
      {wrapTex && isWrapMode && (
        <mesh geometry={bodyGeo} scale={1.002}>
          <meshStandardMaterial
            map={wrapTex}
            transparent
            roughness={0.25}
            metalness={0}
            depthWrite={false}
            alphaTest={0.02}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Inner liner — warm off-white ceramic colour */}
      <mesh geometry={innerGeo}>
        <meshStandardMaterial color="#efe8df" side={THREE.BackSide} roughness={0.55} />
      </mesh>

      {/* Bottom disk — slightly more matte than body (unglazed foot ring) */}
      <mesh geometry={bottomGeo} position={[0, -H / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshPhysicalMaterial
          color={garmentColor}
          roughness={0.55}
          metalness={0.0}
          clearcoat={0.12}
        />
      </mesh>

      {/* Rim torus — polished glazed lip */}
      <mesh geometry={rimGeo} position={[0, H / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshPhysicalMaterial
          color={garmentColor}
          roughness={0.10}
          metalness={0.0}
          clearcoat={1.0}
          clearcoatRoughness={0.04}
          reflectivity={1.0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Handle — C-shape on the right (+X) side — ceramic glaze */}
      <mesh geometry={handleGeo} castShadow>
        <meshPhysicalMaterial
          color={garmentColor}
          roughness={0.16}
          metalness={0.0}
          clearcoat={0.90}
          clearcoatRoughness={0.08}
          reflectivity={0.88}
        />
      </mesh>
    </group>
  );
}

/* ─────────────────────── PHOTO BILLBOARD 3D ─────────
 * Used for apparel, mugs, caps, and water bottles — products where the
 * procedurally generated GLB geometry looked flat and unrealistic.
 *
 * Approach: map the REAL product photo or PSD-derived full-canvas composite as
 * a texture onto a plane in the 3D scene. The R3F environment adds specular
 * highlights and ambient light, while the full composite preserves protected
 * product details above the Smart Object artwork.
 *
 * Two planes (front + back) are stacked back-to-back so the camera can
 * orbit 360° and always see the correct face of the product.
 *────────────────────────────────────────────────────── */
export function PhotoMockupMesh({
  frontPhotoSrc,
  backPhotoSrc,
  frontTex,
  backTex,
  frontCompositeTex,
  backCompositeTex,
  activeFace = "front",
  planeW = 2.60,
  planeH = 2.60,
  frontTint,
  backTint,
  frontFrame,
  backFrame,
}: {
  frontPhotoSrc: string;
  backPhotoSrc?: string;
  frontTex?: THREE.Texture | null;
  backTex?: THREE.Texture | null;
  /** Full-canvas PSD-derived preview. When present it replaces the split
   * photo/artwork planes so protected details stay above the Smart Object. */
  frontCompositeTex?: THREE.Texture | null;
  backCompositeTex?: THREE.Texture | null;
  activeFace?: "front" | "back";
  planeW?: number;
  planeH?: number;
  /** Explicit resolver tint for each face. Exact-color photos pass undefined. */
  frontTint?: string;
  backTint?: string;
  /** Normalized source frame used to crop the billboard texture. */
  frontFrame?: { canvasWidth: number; canvasHeight: number; x: number; y: number; w: number; h: number };
  backFrame?: { canvasWidth: number; canvasHeight: number; x: number; y: number; w: number; h: number };
}) {
  const frontPhotoTex = useUrlTexture(frontPhotoSrc);
  const backPhotoTex  = useUrlTexture(backPhotoSrc ?? frontPhotoSrc);

  const cropTexture = useMemo(
    () => (
      texture: THREE.Texture | null,
      frame?: { canvasWidth: number; canvasHeight: number; x: number; y: number; w: number; h: number },
    ) => {
      if (!texture || !frame) return texture;
      const cropped = texture.clone();
      cropped.wrapS = THREE.ClampToEdgeWrapping;
      cropped.wrapT = THREE.ClampToEdgeWrapping;
      cropped.repeat.set(frame.w / frame.canvasWidth, frame.h / frame.canvasHeight);
      cropped.offset.set(
        frame.x / frame.canvasWidth,
        1 - (frame.y + frame.h) / frame.canvasHeight,
      );
      cropped.needsUpdate = true;
      return cropped;
    },
    [],
  );
  const frontBillboardTex = useMemo(
    () => cropTexture(frontPhotoTex, frontFrame),
    [cropTexture, frontPhotoTex, frontFrame],
  );
  const backBillboardTex = useMemo(
    () => cropTexture(backPhotoTex, backFrame ?? frontFrame),
    [cropTexture, backPhotoTex, backFrame, frontFrame],
  );
  const frontDesignTex = useMemo(
    () => cropTexture(frontTex ?? null, frontFrame),
    [cropTexture, frontTex, frontFrame],
  );
  const backDesignTex = useMemo(
    () => cropTexture(backTex ?? null, backFrame ?? frontFrame),
    [cropTexture, backTex, backFrame, frontFrame],
  );
  // The back plane is rotated 180° around Y. Flip the cropped design texture
  // back across U so logos and text read correctly from the back camera.
  const backDesignTexMirrored = useMemo(() => {
    if (!backDesignTex) return null;
    const mirrored = backDesignTex.clone();
    mirrored.repeat.set(-1, 1);
    mirrored.offset.set(1, 0);
    mirrored.needsUpdate = true;
    return mirrored;
  }, [backDesignTex]);
  const frontCompositeBillboardTex = useMemo(
    () => cropTexture(frontCompositeTex ?? null, frontFrame),
    [cropTexture, frontCompositeTex, frontFrame],
  );
  const backCompositeBillboardTex = useMemo(
    () => cropTexture(backCompositeTex ?? null, backFrame ?? frontFrame),
    [cropTexture, backCompositeTex, backFrame, frontFrame],
  );
  const frontAspect = frontFrame ? frontFrame.w / Math.max(1, frontFrame.h) : 1;
  const backAspect = backFrame ? backFrame.w / Math.max(1, backFrame.h) : frontAspect;
  const resolvedPlaneW = planeW * Math.max(frontAspect, backAspect);

  const planeGeo = useMemo(
    () => new THREE.PlaneGeometry(resolvedPlaneW, planeH),
    [resolvedPlaneW, planeH]
  );

  // Shared physical material settings — clearcoat gives a slight glossy sheen.
  // The material colour is non-white only for an explicitly tintable cutout.
  const baseMat = (tex: THREE.Texture | null | undefined, tint?: string) => ({
    map: tex ?? undefined,
    color: tint ?? "#ffffff",
    roughness: 0.72 as number,
    metalness: 0.0 as number,
    clearcoat: 0.12 as number,
    clearcoatRoughness: 0.45 as number,
    envMapIntensity: 0.65 as number,
    transparent: true as const,
    alphaTest: 0.01,
    side: THREE.FrontSide,
  });

  return (
    <group>
      {/*
       * Render only the active face. Rendering front and back transparent
       * billboards at the same time lets the inactive silhouette bleed through
       * alpha pixels, especially on dark colour assets, and the shadow map then
       * creates the old "ghost mockup" reported in the studio. The camera rig
       * already rotates to the selected face, so the inactive pair is not
       * needed for the current preview.
       */}
      {activeFace === "front" && (
        <>
          {frontCompositeBillboardTex ? (
            <mesh geometry={planeGeo} position={[0, 0, 0.006]}>
              <meshPhysicalMaterial {...baseMat(frontCompositeBillboardTex)} />
            </mesh>
          ) : (
            <>
              <mesh geometry={planeGeo} position={[0, 0, 0.006]}>
                <meshPhysicalMaterial {...baseMat(frontBillboardTex, frontTint)} />
              </mesh>
              {frontDesignTex && (
                <mesh geometry={planeGeo} position={[0, 0, 0.012]}>
                  <meshStandardMaterial
                    map={frontDesignTex} transparent roughness={0.72} metalness={0}
                    depthWrite={false} alphaTest={0.02} side={THREE.FrontSide}
                  />
                </mesh>
              )}
            </>
          )}
        </>
      )}

      {activeFace === "back" && (
        <>
          {backCompositeBillboardTex ? (
            <mesh geometry={planeGeo} position={[0, 0, -0.006]} rotation={[0, Math.PI, 0]}>
              <meshPhysicalMaterial {...baseMat(backCompositeBillboardTex)} />
            </mesh>
          ) : (
            <>
              <mesh geometry={planeGeo} position={[0, 0, -0.006]} rotation={[0, Math.PI, 0]}>
                <meshPhysicalMaterial {...baseMat(backBillboardTex, backTint ?? frontTint)} />
              </mesh>
              {backDesignTexMirrored && (
                <mesh geometry={planeGeo} position={[0, 0, -0.012]} rotation={[0, Math.PI, 0]}>
                  <meshStandardMaterial
                    map={backDesignTexMirrored} transparent roughness={0.72} metalness={0}
                    depthWrite={false} alphaTest={0.02} side={THREE.FrontSide}
                  />
                </mesh>
              )}
            </>
          )}
        </>
      )}
    </group>
  );
}

/* ─────────────────────── WATER BOTTLE / SPORT CARABINER ────── */
/**
 * Procedural geometry — no GLB required.
 * Shape: straight aluminium cylinder + short shoulder taper + threaded neck +
 * black screw cap + chrome carabiner clip ring.
 * UVs wrap around the cylinder side; offset=0.5 centres the design on the front.
 */
export function WaterBottleBody({
  wrapTex,
  garmentColor: _legacyGarmentColor,
}: {
  wrapTex?: THREE.Texture | null;
  garmentColor: string;
}) {
  // The supplied product is a white sublimation-coated aluminium blank. Keep
  // the substrate neutral even if a legacy draft contains a colored swatch;
  // only the artwork layer varies.
  const sublimationBlank = "#f4f3f1";

  // ── Main printable body: straight cylinder (open-ended for UV wrap) ──
  // Uniform radius 0.38 — no taper — matches the real bottle silhouette.
  const bodyGeo = useMemo(
    () => new THREE.CylinderGeometry(0.38, 0.38, 2.10, 80, 1, true),
    []
  );

  // UV offset=0.5 → canvas centre aligns with the +Z front face.
  useEffect(() => {
    if (!wrapTex) return;
    wrapTex.wrapS  = THREE.RepeatWrapping;
    wrapTex.wrapT  = THREE.ClampToEdgeWrapping;
    wrapTex.repeat.set(1, 1);
    wrapTex.offset.set(0.5, 0);
    wrapTex.flipY  = true;
    wrapTex.needsUpdate = true;
  }, [wrapTex]);

  // ── Body top disk (closed at top of cylinder) ──
  const bodyTopGeo  = useMemo(() => new THREE.CircleGeometry(0.38, 64), []);
  // ── Body bottom disk ──
  const bodyBotGeo  = useMemo(() => new THREE.CircleGeometry(0.38, 64), []);

  // ── Shoulder taper: wide body → narrow neck ──
  const shoulderGeo = useMemo(
    () => new THREE.CylinderGeometry(0.20, 0.38, 0.22, 64, 1, false),
    []
  );

  // ── Neck thread section ──
  const neckGeo = useMemo(
    () => new THREE.CylinderGeometry(0.19, 0.20, 0.16, 48, 1, false),
    []
  );

  // ── Black screw cap (cylinder) ──
  const capGeo = useMemo(
    () => new THREE.CylinderGeometry(0.215, 0.215, 0.22, 48, 1, false),
    []
  );
  // Cap top disk
  const capTopGeo = useMemo(() => new THREE.CircleGeometry(0.215, 48), []);

  // ── Carabiner ring loop — open torus at the cap top ──
  const carabinerRingGeo = useMemo(
    () => new THREE.TorusGeometry(0.145, 0.022, 16, 40, Math.PI * 1.72),
    []
  );
  // Straight carabiner bar (closes the loop at the bottom)
  const carabinerBarGeo  = useMemo(
    () => new THREE.CylinderGeometry(0.018, 0.018, 0.29, 12, 1, false),
    []
  );

  // ── Y-axis layout (body centre = 0, half-height = 1.05):
  //   body:       [-1.05, +1.05]
  //   shoulder:   h=0.22  → centre = 1.05 + 0.11 = 1.16
  //   neck:       h=0.16  → centre = 1.27 + 0.08 = 1.35
  //   cap:        h=0.22  → centre = 1.43 + 0.11 = 1.54
  //   cap top:    y = 1.65
  //   carabiner:  y = 1.78

  return (
    <group scale={0.60}>
      {/* ── Main glossy body (white sublimation-coated aluminium) ── */}
      <mesh geometry={bodyGeo} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={sublimationBlank}
          roughness={0.22}
          metalness={0.0}
          clearcoat={1.0}
          clearcoatRoughness={0.04}
          reflectivity={0.7}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* ── Design wrap overlay ── */}
      {wrapTex && (
        <mesh geometry={bodyGeo} scale={[1.003, 1, 1.003]}>
          <meshStandardMaterial
            map={wrapTex}
            transparent
            roughness={0.08}
            metalness={0}
            depthWrite={false}
            alphaTest={0.015}
            side={THREE.FrontSide}
          />
        </mesh>
      )}

      {/* ── Bottom blank disk ── */}
      <mesh geometry={bodyBotGeo} position={[0, -1.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshPhysicalMaterial
          color={sublimationBlank}
          roughness={0.30}
          metalness={0.0}
          clearcoat={0.5}
        />
      </mesh>

      {/* ── White blank shoulder taper ── */}
      <mesh geometry={shoulderGeo} position={[0, 1.16, 0]} castShadow>
        <meshPhysicalMaterial
          color={sublimationBlank}
          roughness={0.22}
          metalness={0.0}
          clearcoat={1.0}
          clearcoatRoughness={0.04}
        />
      </mesh>

      {/* ── White blank neck thread section ── */}
      <mesh geometry={neckGeo} position={[0, 1.35, 0]} castShadow>
        <meshPhysicalMaterial
          color={sublimationBlank}
          roughness={0.24}
          metalness={0.0}
          clearcoat={0.8}
        />
      </mesh>

      {/* ── Black screw cap ── */}
      <mesh geometry={capGeo} position={[0, 1.54, 0]} castShadow>
        <meshPhysicalMaterial
          color="#0f0f0f"
          roughness={0.40}
          metalness={0.0}
          clearcoat={0.45}
          clearcoatRoughness={0.25}
        />
      </mesh>

      {/* ── Cap top disk ── */}
      <mesh geometry={capTopGeo} position={[0, 1.65, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshPhysicalMaterial
          color="#0f0f0f"
          roughness={0.50}
          metalness={0.0}
        />
      </mesh>

      {/* ── Chrome carabiner ring — open torus, slightly tilted ── */}
      <mesh
        geometry={carabinerRingGeo}
        position={[0, 1.80, 0]}
        rotation={[Math.PI / 2, 0, 0.18]}
        castShadow
      >
        <meshPhysicalMaterial
          color="#d4d4d4"
          roughness={0.08}
          metalness={0.95}
          clearcoat={0.9}
          clearcoatRoughness={0.04}
          reflectivity={1.0}
        />
      </mesh>

      {/* ── Carabiner straight closing bar ── */}
      <mesh
        geometry={carabinerBarGeo}
        position={[0, 1.71, -0.145]}
        rotation={[0, 0, 0]}
        castShadow
      >
        <meshPhysicalMaterial
          color="#c8c8c8"
          roughness={0.12}
          metalness={0.90}
          clearcoat={0.8}
        />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════
   SHARED 3D-VIEWER INFRASTRUCTURE
   Used by ProductViewer3D + CartViewer3D so the studio,
   PDP, cart, checkout and admin previews behave identically.
════════════════════════════════════════════════════════ */

/** Single source of truth for camera + render parameters used by every
 *  3D viewer in the app. Only `preserveDrawingBuffer` legitimately varies
 *  (studio needs it for snapshot export; cart never snapshots). */
export const VIEWER_DEFAULTS = {
  fov: 36,
  cameraPosition: [0, 0.2, 4] as [number, number, number],
  dpr: [1, 1.5] as [number, number],
  shadowOpacity: 0.32,
  shadowBlur: 2.4,
  shadowScale: 6,
  shadowFar: 3,
};

/** Per-category framing — every product's 3D model has different proportions
 *  (hoodie has a tall hood, cap is short and wide, mug is narrow & half-height,
 *  long sleeve has wide sleeves). These constants frame each one so the FRONT
 *  PRINT AREA fills the centre of the viewport — the user sees their design
 *  exactly where they placed it in 2D. */
export type ViewerCategory = "tshirt" | "longsleeve" | "hoodie" | "cap" | "mug" | "waterbottle";
export const VIEWER_FRAMING: Record<ViewerCategory, {
  /** Camera distance from origin */
  radius: number;
  /** Camera height — positive looks slightly down, negative looks up */
  cameraY: number;
  /** Soft min/max for OrbitControls dolly */
  minDistance: number;
  maxDistance: number;
  /** Y position of the contact-shadow plane */
  shadowY: number;
}> = {
  tshirt:      { radius: 4.0, cameraY:  0.20, minDistance: 3.0, maxDistance: 6.0, shadowY: -1.55 },
  longsleeve:  { radius: 4.0, cameraY:  0.10, minDistance: 2.8, maxDistance: 5.5, shadowY: -1.30 },
  hoodie:      { radius: 4.0, cameraY:  0.10, minDistance: 2.8, maxDistance: 5.5, shadowY: -1.30 },
  cap:         { radius: 3.0, cameraY:  0.05, minDistance: 2.2, maxDistance: 4.5, shadowY: -1.05 },
  mug:         { radius: 3.5, cameraY:  0.10, minDistance: 2.8, maxDistance: 6.0, shadowY: -0.40 },
  waterbottle: { radius: 3.5, cameraY:  0.18, minDistance: 2.8, maxDistance: 6.0, shadowY: -0.65 },
};

/**
 * Camera framing for BACK views — for some products, the back panel
 * is framed differently to ensure the print area (upper back)
 * is perfectly centered in the viewport.
 */
export const VIEWER_FRAMING_BACK: Partial<Record<ViewerCategory, Partial<typeof VIEWER_FRAMING["tshirt"]>>> = {
  hoodie:     { cameraY: 0.70 },
  longsleeve: { cameraY: 0.35 },
  tshirt:     { cameraY: 0.35 },
};

/** Overlay shown while GLB / texture assets are streaming in.
 *  MUST be rendered as a sibling of <Canvas>, not inside it. */
export function ViewerLoadingOverlay() {
  const { active, progress } = useProgress();
  if (!active) return null;
  const pct = Math.round(Math.max(progress, 2));
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(255,255,255,0.92)",
        pointerEvents: "none",
        zIndex: 3,
        gap: 14,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
      aria-live="polite"
      aria-label={`Loading 3D preview, ${pct}%`}
    >
      {/* Animated product silhouette skeleton */}
      <div style={{ position: "relative", width: 72, height: 72 }}>
        <div
          style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "linear-gradient(135deg, #fff7ed, #fef3c7)",
            border: "2px solid rgba(232,93,4,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Rotating ring */}
          <div
            style={{
              position: "absolute",
              width: 66, height: 66,
              borderRadius: "50%",
              border: "3px solid rgba(232,93,4,0.1)",
              borderTopColor: "#E85D04",
              animation: "trynex-spin 0.9s linear infinite",
            }}
          />
          {/* Inner icon placeholder */}
          <div
            style={{
              width: 28, height: 32,
              borderRadius: 4,
              background: "rgba(232,93,4,0.08)",
            }}
          />
        </div>
      </div>
      {/* Progress bar */}
      <div style={{ width: 140 }}>
        <div
          style={{
            height: 4,
            borderRadius: 9999,
            background: "rgba(232,93,4,0.12)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              borderRadius: 9999,
              background: "linear-gradient(90deg, #E85D04, #FB8500)",
              transition: "width 0.35s ease",
            }}
          />
        </div>
        <div
          style={{
            marginTop: 8,
            textAlign: "center",
            fontSize: 11,
            fontWeight: 600,
            color: "#94a3b8",
            letterSpacing: "0.04em",
          }}
        >
          Loading 3D preview… {pct}%
        </div>
      </div>
      <style>{`@keyframes trynex-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

/** Replacement for a 3D viewer when WebGL2 isn't available.
 *  Layers the user's design over the garment mockup so personalization is
 *  still visible. `garmentSrc` is the white-cutout PNG (multiply-tinted by
 *  garmentColor) and `designSrc` is the composed design texture. */
export function NoWebGLFallback({
  garmentSrc,
  designSrc,
  compositeSrc,
  garmentColor = "#ffffff",
  requiresTint = false,
  message = "Your browser does not support 3D preview. Showing the 2D mockup instead.",
}: {
  garmentSrc?: string;
  designSrc?: string;
  /** Complete PSD-derived canvas, including base, shading, and protected details. */
  compositeSrc?: string;
  garmentColor?: string;
  requiresTint?: boolean;
  message?: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        padding: 16,
        textAlign: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{
        position: "relative",
        width: "85%",
        maxHeight: "75%",
        aspectRatio: "1 / 1",
      }}>
        {compositeSrc ? (
          <img
            src={compositeSrc}
            alt="Product mockup with your design"
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "contain",
            }}
          />
        ) : garmentSrc && requiresTint ? (
          <svg
            viewBox="0 0 1024 1024"
            width="100%"
            height="100%"
            style={{ position: "absolute", inset: 0, overflow: "visible" }}
            aria-hidden="true"
          >
            <defs>
              <filter id="fallback-garment-tint" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
                <feFlood floodColor={garmentColor} result="flood" />
                <feBlend in="flood" in2="SourceGraphic" mode="multiply" result="blended" />
                <feComposite in="blended" in2="SourceGraphic" operator="in" />
              </filter>
            </defs>
            <image
              href={garmentSrc}
              x="0"
              y="0"
              width="1024"
              height="1024"
              preserveAspectRatio="xMidYMid meet"
              filter="url(#fallback-garment-tint)"
            />
          </svg>
        ) : garmentSrc ? (
          <img
            src={garmentSrc}
            alt="Product mockup"
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "contain",
            }}
          />
        ) : null}
        {designSrc && (
          <img
            src={designSrc}
            alt="Your design"
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "contain",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: "#64748b", maxWidth: 280 }}>
        {message}
      </div>
    </div>
  );
}

/** OrbitControls with double-tap (or double-click) → reset camera.
 *  Drop-in replacement; forwards every prop. */
export function ResettableOrbitControls(props: React.ComponentProps<typeof OrbitControls>) {
  const ref = useRef<OrbitControlsRef>(null);
  const { gl } = useThree();
  const lastTapRef = useRef(0);

  useEffect(() => {
    const el = gl.domElement;
    const reset = () => {
      ref.current?.reset();
    };
    const onPointer = (e: PointerEvent) => {
      // Only treat single-finger taps as candidates so pinch-zoom is unaffected.
      // PointerEvent.isPrimary is part of the standard DOM spec.
      if (e.pointerType === "touch" && !e.isPrimary) return;
      const now = performance.now();
      if (now - lastTapRef.current < 320) {
        reset();
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    };
    el.addEventListener("pointerup", onPointer);
    el.addEventListener("dblclick", reset);
    return () => {
      el.removeEventListener("pointerup", onPointer);
      el.removeEventListener("dblclick", reset);
    };
  }, [gl]);

  // drei's control instance is structurally richer than the reset-only
  // contract above; the ref is intentionally narrowed at this interop edge.
  return <OrbitControls ref={ref as never} {...props} />;
}

/** Studio-quality lighting rig — hemisphere sky/ground + five-point directional.
 *  Hemisphere light gives natural top-to-bottom luminance gradient so white
 *  garments show 3-D form (sky is warm, ground is cool → visible fold shadows)
 *  and black garments remain legible (sky light provides top highlight).
 *  Ambient reduced; directional contrast increased for crisper depth on all
 *  garment colours.  Matches professional POD studio look (Printful / Teespring). */
export function StudioLightRig({ rim = true }: { rim?: boolean }) {
  return (
    <>
      {/* Hemisphere sky/ground — primary depth cue for light + dark garments */}
      <hemisphereLight
        args={["#f5f0e8", "#2a2620", 0.72]}
      />
      {/* Key light — large soft box from upper-left front (main shadow-caster) */}
      <directionalLight
        position={[2.5, 5, 6]}
        intensity={1.40}
        color={"#fffaf2"}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
      />
      {/* Front-kick — soft frontal fill to brighten the chest/print area */}
      <directionalLight position={[0, 1, 7]} intensity={0.38} color={"#ffffff"} />
      {/* Fill — cool blue-grey from screen-right for colour separation */}
      <directionalLight position={[-5, 2, -2]} intensity={0.28} color={"#c8dcff"} />
      {/* Top specular — overhead softbox for clearcoat surfaces (mug, bottle cap) */}
      <directionalLight position={[0, 9, 2]} intensity={0.55} color={"#ffffff"} />
      {rim && (
        /* Rim / back-light — warm brand-orange edge separation */
        <directionalLight position={[0.5, 4, -7]} intensity={0.62} color={"#ffcc80"} />
      )}
    </>
  );
}
