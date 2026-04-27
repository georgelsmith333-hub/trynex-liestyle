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

// Ref type for drei's <OrbitControls> — derived from the component itself so
// we don't need to depend on `three-stdlib` directly.
type OrbitControlsRef = React.ElementRef<typeof OrbitControls>;

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

  // Hemisphere-filtered overlays — front-facing triangles get the front
  // texture, back-facing triangles get the back texture. No bleed possible.
  const frontGeo = useFrontOverlayGeometry(baseGeo);
  const backGeo = useBackOverlayGeometry(baseGeo);

  if (!baseGeo) return null;

  return (
    <group scale={2.6}>
      <mesh geometry={baseGeo} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={garmentColor}
          roughness={0.88}
          metalness={0.02}
          normalMap={FABRIC_MAPS?.normal ?? null}
          normalScale={new THREE.Vector2(0.18, 0.18)}
          roughnessMap={FABRIC_MAPS?.rough ?? null}
          sheen={0.3}
          sheenRoughness={0.8}
          sheenColor={garmentColor}
        />
      </mesh>
      {frontTex && frontGeo && (
        <mesh geometry={frontGeo} scale={1.003}>
          <meshStandardMaterial
            map={frontTex} transparent roughness={0.65} metalness={0}
            depthWrite={false} alphaTest={0.02} side={THREE.FrontSide}
          />
        </mesh>
      )}
      {backTex && backGeo && (
        <mesh geometry={backGeo} scale={1.003}>
          <meshStandardMaterial
            map={backTex} transparent roughness={0.65} metalness={0}
            depthWrite={false} alphaTest={0.02} side={THREE.FrontSide}
          />
        </mesh>
      )}
    </group>
  );
}
useGLTF.preload("/models/tshirt.glb");

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

  if (meshes.length === 0) return null;

  // The script-generated longsleeve/hoodie GLBs are authored at ~3 model
  // units tall (see scripts/generate-models.cjs: width 2.55-2.60,
  // height 3.05-3.10). The real tshirt.glb asset is ~1 unit tall and
  // uses scale={2.6}. To land at the same on-screen size as RealisticShirt
  // (~2.6 units final), we scale the generated geo by 2.6/3.05 ≈ 0.85.
  // Without this the garments rendered at ~7 units tall and one inner
  // panel completely filled the viewport, which is what the user saw as
  // "flat blank shapes".
  return (
    <group scale={0.85}>
      {/* Base colour for every part — apply procedural fabric maps */}
      {meshes.map((m, i) => (
        <mesh key={i} geometry={m.geometry} castShadow receiveShadow>
          <meshPhysicalMaterial
            color={garmentColor}
            roughness={roughness}
            metalness={0.01}
            normalMap={FABRIC_MAPS?.normal ?? null}
            normalScale={new THREE.Vector2(0.18, 0.18)}
            roughnessMap={FABRIC_MAPS?.rough ?? null}
            sheen={0.3}
            sheenRoughness={0.85}
            sheenColor={garmentColor}
          />
        </mesh>
      ))}
      {frontTex && frontGeo && (
        <mesh geometry={frontGeo} scale={1.003}>
          <meshStandardMaterial
            map={frontTex} transparent roughness={roughness - 0.14}
            depthWrite={false} alphaTest={0.02} side={THREE.FrontSide}
          />
        </mesh>
      )}
      {backTex && backGeo && (
        <mesh geometry={backGeo} scale={1.003}>
          <meshStandardMaterial
            map={backTex} transparent roughness={roughness - 0.14}
            depthWrite={false} alphaTest={0.02} side={THREE.FrontSide}
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
useGLTF.preload("/models/longsleeve.glb");

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
useGLTF.preload("/models/hoodie.glb");

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
useGLTF.preload("/models/cap.glb");

/* ─────────────────────── MUG ─────────────────────────── */
export function MugBody({
  wrapTex,
  garmentColor,
}: {
  wrapTex?: THREE.Texture | null;
  garmentColor: string;
}) {
  const { scene } = useGLTF("/models/mug.glb") as { scene: THREE.Group };
  const meshes = useMemo(() => collectMeshes(scene), [scene]);

  useEffect(() => {
    if (wrapTex) {
      wrapTex.wrapS = THREE.RepeatWrapping;
      wrapTex.wrapT = THREE.ClampToEdgeWrapping;
      // Wrap canvas layout (2048×768):
      //   [0–1024]    = Left Side (front face) — design centred at canvas x=512
      //   [1024–2048] = Right Side (back face) — design centred at canvas x=1536
      //
      // THREE CylinderGeometry UV convention (thetaStart=0, CW from +Y):
      //   u=0.00 → +Z (front, camera-facing)
      //   u=0.25 → +X (handle side)
      //   u=0.50 → −Z (back)
      //   u=0.75 → −X (left)
      //
      // We need u_geo=0 (front) → canvas x=512 (centre of left half) → u_tex=0.25
      // Solve: u_tex = u_geo + offset  →  0.25 = 0 + 0.25  → offset = 0.25
      // Verify: u_geo=0.50 (back) → u_tex=0.75 → canvas x=1536 (centre right) ✓
      wrapTex.repeat.set(1, 1);
      wrapTex.offset.set(0.25, 0);
      wrapTex.flipY = true;
      wrapTex.needsUpdate = true;
    }
  }, [wrapTex]);

  if (meshes.length < 5) return null;

  const [bodyGeo, innerGeo, bottomGeo, rimGeo, handleGeo] = meshes.map((m) => m.geometry);

  return (
    <group>
      <mesh geometry={bodyGeo} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={garmentColor}
          roughness={0.22}
          metalness={0.02}
          clearcoat={0.78}
          clearcoatRoughness={0.12}
          side={THREE.DoubleSide}
          roughnessMap={FABRIC_MAPS?.rough ?? null}
        />
      </mesh>

      {wrapTex && (
        <mesh geometry={bodyGeo} scale={1.001}>
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

      <mesh geometry={innerGeo}>
        <meshStandardMaterial color={"#161616"} side={THREE.BackSide} roughness={0.55} />
      </mesh>

      <mesh geometry={bottomGeo}>
        <meshStandardMaterial color={garmentColor} roughness={0.40} />
      </mesh>

      <mesh geometry={rimGeo}>
        <meshPhysicalMaterial color={garmentColor} roughness={0.30} clearcoat={0.3} side={THREE.DoubleSide} />
      </mesh>

      <mesh geometry={handleGeo} castShadow>
        <meshPhysicalMaterial color={garmentColor} roughness={0.28} clearcoat={0.55} clearcoatRoughness={0.2} />
      </mesh>
    </group>
  );
}
useGLTF.preload("/models/mug.glb");

/* ─────────────────────── PHOTO BILLBOARD 3D ─────────
 * Used for Hoodie, Long Sleeve, and Structured Cap — products where
 * the procedurally generated GLB geometry looked flat and unrealistic.
 *
 * Approach: map the REAL product photo as a texture onto a plane in the
 * 3D scene. The R3F environment (city HDRI) adds specular highlights and
 * ambient light, making the photo look three-dimensionally lit. A second
 * plane slightly in front carries the design texture overlay.
 *
 * Two planes (front + back) are stacked back-to-back so the camera can
 * orbit 360° and always see the correct face of the garment.
 *────────────────────────────────────────────────────── */
export function PhotoMockupMesh({
  frontPhotoSrc,
  backPhotoSrc,
  frontTex,
  backTex,
  activeFace = "front",
  planeW = 2.60,
  planeH = 2.60,
}: {
  frontPhotoSrc: string;
  backPhotoSrc?: string;
  frontTex?: THREE.Texture | null;
  backTex?: THREE.Texture | null;
  activeFace?: "front" | "back";
  planeW?: number;
  planeH?: number;
}) {
  const frontPhotoTex = useUrlTexture(frontPhotoSrc);
  const backPhotoTex  = useUrlTexture(backPhotoSrc ?? frontPhotoSrc);

  const planeGeo = useMemo(
    () => new THREE.PlaneGeometry(planeW, planeH),
    [planeW, planeH]
  );

  // Shared physical material settings — subtle clearcoat gives the photo a
  // slight glossy sheen under the studio light rig, making it look tangible.
  const baseMat = (tex: THREE.Texture | null | undefined) => ({
    map: tex ?? undefined,
    roughness: 0.78 as number,
    metalness: 0.03 as number,
    clearcoat: 0.18 as number,
    clearcoatRoughness: 0.35 as number,
    transparent: true as const,
    alphaTest: 0.01,
    side: THREE.FrontSide,
  });

  return (
    <group>
      {/* ── FRONT face ─────────────────────────────────── */}
      <mesh geometry={planeGeo} position={[0, 0, 0.006]} castShadow receiveShadow>
        <meshPhysicalMaterial {...baseMat(frontPhotoTex)} />
      </mesh>
      {frontTex && (
        <mesh geometry={planeGeo} position={[0, 0, 0.012]}>
          <meshStandardMaterial
            map={frontTex} transparent roughness={0.72} metalness={0}
            depthWrite={false} alphaTest={0.02} side={THREE.FrontSide}
          />
        </mesh>
      )}

      {/* ── BACK face (rotated 180° around Y) ──────────── */}
      <mesh geometry={planeGeo} position={[0, 0, -0.006]} rotation={[0, Math.PI, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial {...baseMat(backPhotoTex)} />
      </mesh>
      {backTex && (
        <mesh geometry={planeGeo} position={[0, 0, -0.012]} rotation={[0, Math.PI, 0]}>
          <meshStandardMaterial
            map={backTex} transparent roughness={0.72} metalness={0}
            depthWrite={false} alphaTest={0.02} side={THREE.FrontSide}
          />
        </mesh>
      )}
    </group>
  );
}

/* ─────────────────────── WATER BOTTLE / TUMBLER ────── */
/**
 * Procedural tumbler shape — no GLB file required.
 * Profile: tapered cylindrical body + shoulder taper + narrow neck + lid + base disk.
 * The design wrap texture sits on the main body cylinder whose side UVs wrap
 * naturally around the circumference (identical offset=0.25 trick as MugBody).
 */
export function WaterBottleBody({
  wrapTex,
  garmentColor,
}: {
  wrapTex?: THREE.Texture | null;
  garmentColor: string;
}) {
  // Main printable body — open-ended cylinder so UVs wrap the side only
  const bodyGeo = useMemo(
    () => new THREE.CylinderGeometry(0.360, 0.440, 2.08, 80, 1, true),
    []
  );
  // Shoulder taper (body → neck transition)
  const shoulderGeo = useMemo(
    () => new THREE.CylinderGeometry(0.222, 0.360, 0.25, 64, 1, false),
    []
  );
  // Narrow neck
  const neckGeo = useMemo(
    () => new THREE.CylinderGeometry(0.210, 0.210, 0.22, 48, 1, false),
    []
  );
  // Screw-top lid (slightly flared)
  const lidGeo = useMemo(
    () => new THREE.CylinderGeometry(0.258, 0.240, 0.14, 48, 1, false),
    []
  );
  // Flat base disk
  const baseDiskGeo = useMemo(() => new THREE.CircleGeometry(0.440, 64), []);

  // Y positions (body centre at 0, half-height = 1.04):
  //   body:     y ∈ [-1.04, +1.04]
  //   shoulder: height 0.25 → y ∈ [+1.04, +1.29] → centre = +1.165
  //   neck:     height 0.22 → y ∈ [+1.29, +1.51] → centre = +1.400
  //   lid:      height 0.14 → y ∈ [+1.51, +1.65] → centre = +1.580
  //   base disk: y = -1.04

  return (
    <group scale={1.05}>
      {/* ── Main body (base colour) ───────────────────── */}
      <mesh geometry={bodyGeo} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={garmentColor}
          roughness={0.25}
          metalness={0.18}
          clearcoat={0.80}
          clearcoatRoughness={0.10}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* ── Design wrap overlay (front-face only) ──────── */}
      {wrapTex && (
        <mesh geometry={bodyGeo} scale={[1.003, 1, 1.003]}>
          <meshStandardMaterial
            map={wrapTex}
            transparent
            roughness={0.28}
            metalness={0}
            depthWrite={false}
            alphaTest={0.015}
            side={THREE.FrontSide}
          />
        </mesh>
      )}

      {/* ── Base disk ─────────────────────────────────── */}
      <mesh geometry={baseDiskGeo} position={[0, -1.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshPhysicalMaterial
          color={garmentColor}
          roughness={0.38}
          metalness={0.12}
          clearcoat={0.4}
        />
      </mesh>

      {/* ── Shoulder ─────────────────────────────────── */}
      <mesh geometry={shoulderGeo} position={[0, 1.165, 0]} castShadow>
        <meshPhysicalMaterial
          color={garmentColor}
          roughness={0.25}
          metalness={0.18}
          clearcoat={0.80}
          clearcoatRoughness={0.10}
        />
      </mesh>

      {/* ── Neck ─────────────────────────────────────── */}
      <mesh geometry={neckGeo} position={[0, 1.400, 0]} castShadow>
        <meshPhysicalMaterial
          color={garmentColor}
          roughness={0.28}
          metalness={0.16}
          clearcoat={0.65}
          clearcoatRoughness={0.12}
        />
      </mesh>

      {/* ── Lid ──────────────────────────────────────── */}
      <mesh geometry={lidGeo} position={[0, 1.580, 0]} castShadow>
        <meshPhysicalMaterial
          color={garmentColor}
          roughness={0.40}
          metalness={0.10}
          clearcoat={0.30}
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
  mug:         { radius: 3.4, cameraY:  0.40, minDistance: 2.4, maxDistance: 5.0, shadowY: -0.85 },
  waterbottle: { radius: 2.9, cameraY:  0.32, minDistance: 2.0, maxDistance: 4.6, shadowY: -1.12 },
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
  garmentColor = "#ffffff",
  message = "Your browser does not support 3D preview. Showing the 2D mockup instead.",
}: {
  garmentSrc?: string;
  designSrc?: string;
  garmentColor?: string;
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
        {garmentSrc && (
          <img
            src={garmentSrc}
            alt="Product mockup"
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "contain",
              backgroundColor: garmentColor,
              mixBlendMode: "multiply",
            }}
          />
        )}
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

  return <OrbitControls ref={ref} {...props} />;
}

/** Three-point lighting rig: key (warm) + fill (cool) + rim (cool back-light).
 *  Centralises lighting so studio & cart match exactly. */
export function StudioLightRig({ rim = true }: { rim?: boolean }) {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[3, 4, 5]}
        intensity={1.05}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-4, 2, -3]} intensity={0.32} color={"#bcd6ff"} />
      {rim && (
        <directionalLight position={[0, 3, -6]} intensity={0.55} color={"#ffe9c8"} />
      )}
    </>
  );
}
