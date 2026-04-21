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
import { useMemo, useEffect } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

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
 * Clone a geometry and override its UVs with a planar +Z projection
 * normalised to the mesh's local XY bounding box. This guarantees the
 * design canvas (which spans [0,1] in UV space) lands on the FRONT of the
 * geometry regardless of how the GLB was authored.
 *
 * flipU=true mirrors U so a back-side overlay (whose host group is rotated
 * 180° around Y) still reads "right way around" when viewed from the back.
 */
function planarProjectGeometry(
  src: THREE.BufferGeometry,
  flipU: boolean = false
): THREE.BufferGeometry {
  const geo = src.clone();
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const xMin = bb.min.x;
  const yMin = bb.min.y;
  const xSize = (bb.max.x - bb.min.x) || 1;
  const ySize = (bb.max.y - bb.min.y) || 1;

  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    let u = (pos.getX(i) - xMin) / xSize;
    const v = 1 - (pos.getY(i) - yMin) / ySize;
    if (flipU) u = 1 - u;
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** Hook variant of planarProjectGeometry — memoises by source geometry id. */
function usePlanarGeometry(
  src: THREE.BufferGeometry | null | undefined,
  flipU: boolean = false
): THREE.BufferGeometry | null {
  return useMemo(() => {
    if (!src) return null;
    return planarProjectGeometry(src, flipU);
  }, [src, flipU]);
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

  // Re-projected UV variants for front/back overlays
  const frontGeo = usePlanarGeometry(baseGeo, false);
  const backGeo = usePlanarGeometry(baseGeo, true);

  if (!baseGeo) return null;

  return (
    <group scale={2.6}>
      <mesh geometry={baseGeo} castShadow receiveShadow>
        <meshStandardMaterial color={garmentColor} roughness={0.78} metalness={0.02} />
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
        <group rotation={[0, Math.PI, 0]}>
          <mesh geometry={backGeo} scale={1.003}>
            <meshStandardMaterial
              map={backTex} transparent roughness={0.65} metalness={0}
              depthWrite={false} alphaTest={0.02} side={THREE.FrontSide}
            />
          </mesh>
        </group>
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

  const frontGeo = usePlanarGeometry(bodyGeo, false);
  const backGeo = usePlanarGeometry(bodyGeo, true);

  if (meshes.length === 0) return null;

  return (
    <group>
      {/* Base colour for every part */}
      {meshes.map((m, i) => (
        <mesh key={i} geometry={m.geometry} castShadow receiveShadow>
          <meshStandardMaterial color={garmentColor} roughness={roughness} metalness={0.01} />
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
        <group rotation={[0, Math.PI, 0]}>
          <mesh geometry={backGeo} scale={1.003}>
            <meshStandardMaterial
              map={backTex} transparent roughness={roughness - 0.14}
              depthWrite={false} alphaTest={0.02} side={THREE.FrontSide}
            />
          </mesh>
        </group>
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
  const frontGeo = usePlanarGeometry(crownGeo, false);

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
          clearcoat={0.70}
          clearcoatRoughness={0.15}
          side={THREE.DoubleSide}
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
