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
  const xMin = bb.min.x;
  const yMin = bb.min.y;
  const xSize = (bb.max.x - bb.min.x) || 1;
  const ySize = (bb.max.y - bb.min.y) || 1;

  const vertCount = newPos.length / 3;
  const uv = new Float32Array(vertCount * 2);
  for (let i = 0; i < vertCount; i++) {
    let u = (newPos[i * 3]     - xMin) / xSize;
    const v = 1 - (newPos[i * 3 + 1] - yMin) / ySize;
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
  const meshes = useMemo(() => collectMeshes(scene), [scene]);
  const baseGeo = meshes[0]?.geometry ?? null;

  // Hemisphere-filtered overlays — front-facing triangles get the front
  // texture, back-facing triangles get the back texture. No bleed possible.
  const frontGeo = useFrontOverlayGeometry(baseGeo);
  const backGeo = useBackOverlayGeometry(baseGeo);

  if (!baseGeo) return null;

  return (
    <group scale={2.6}>
      <mesh geometry={baseGeo} castShadow receiveShadow>
        <meshStandardMaterial
          color={garmentColor}
          roughness={0.82}
          metalness={0.02}
          normalMap={FABRIC_MAPS?.normal ?? null}
          normalScale={new THREE.Vector2(0.18, 0.18)}
          roughnessMap={FABRIC_MAPS?.rough ?? null}
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
  roughness = 0.82,
}: {
  modelPath: string;
  frontTex?: THREE.Texture | null;
  backTex?: THREE.Texture | null;
  garmentColor: string;
  roughness?: number;
}) {
  const { scene } = useGLTF(modelPath) as { scene: THREE.Group };
  const meshes = useMemo(() => collectMeshes(scene), [scene]);
  const bodyGeo = meshes[0]?.geometry ?? null;

  const frontGeo = useFrontOverlayGeometry(bodyGeo);
  const backGeo = useBackOverlayGeometry(bodyGeo);

  if (meshes.length === 0) return null;

  return (
    <group>
      {/* Base colour for every part — apply procedural fabric maps */}
      {meshes.map((m, i) => (
        <mesh key={i} geometry={m.geometry} castShadow receiveShadow>
          <meshStandardMaterial
            color={garmentColor}
            roughness={roughness}
            metalness={0.01}
            normalMap={FABRIC_MAPS?.normal ?? null}
            normalScale={new THREE.Vector2(0.18, 0.18)}
            roughnessMap={FABRIC_MAPS?.rough ?? null}
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
      roughness={0.82}
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
      roughness={0.84}
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
  const meshes = useMemo(() => collectMeshes(scene), [scene]);
  const crownGeo = meshes[0]?.geometry ?? null;
  const frontGeo = useFrontOverlayGeometry(crownGeo);

  if (meshes.length === 0) return null;

  // crown = meshes[0], brim = meshes[1] (matches generator order)
  return (
    <group>
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
      wrapTex.repeat.set(-1, 1);
      wrapTex.offset.set(0.25, 0);
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

/** Overlay shown while GLB / texture assets are streaming in.
 *  MUST be rendered as a sibling of <Canvas>, not inside it. */
export function ViewerLoadingOverlay() {
  const { active, progress, total, loaded } = useProgress();
  if (!active || total === 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(255,255,255,0.6)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        pointerEvents: "none",
        zIndex: 3,
        color: "#475569",
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 12,
        fontWeight: 600,
        gap: 10,
      }}
      aria-live="polite"
    >
      <div
        style={{
          width: 36, height: 36, borderRadius: "50%",
          border: "3px solid rgba(232,93,4,0.18)",
          borderTopColor: "#E85D04",
          animation: "trynex-spin 0.8s linear infinite",
        }}
      />
      <div>Loading 3D preview… {Math.round(progress)}%</div>
      <div style={{ fontSize: 10, opacity: 0.7 }}>
        {loaded}/{total} asset{total === 1 ? "" : "s"}
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
