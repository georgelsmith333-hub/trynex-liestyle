/* ═══════════════════════════════════════════════════════
   GARMENT 3D — shared geometry & material helpers
   Used by both ProductViewer3D (studio) and CartViewer3D (cart/checkout/admin)
   so the two views always render identically.

   GLB models (public/models/):
     tshirt.glb      → real apparel mesh
     hoodie.glb      → ExtrudeGeometry body + SphereGeometry hood (2 primitives)
     longsleeve.glb  → ExtrudeGeometry body with long sleeves (1 primitive)
     cap.glb         → SphereGeometry crown + ExtrudeGeometry brim (2 primitives)
     mug.glb         → 5 primitives: body / inner / bottom / rim / handle

   ⚠️  Primitive ordering contract: code below destructures meshes[] by fixed index
   (matching the order emitted by scripts/generate-models.cjs). If models are ever
   re-exported, verify the generator's addMesh() call order is unchanged, or switch
   to name-based selection (mesh.name lookup) to avoid silent mismatch.

   UV contract (garments):
     UVs are normalised to [0,1] across the XY bounding box of each mesh.
     Design textures (composeLayers output) also cover a [0,1] UV space
     (1024×1024 canvas = 1000-unit coordinate space), so the print zone
     falls in the correct region with no extra UV transform needed.

   Design overlay strategy:
     Front design: same GLB mesh, scale 1.003, THREE.FrontSide
     Back design:  same GLB mesh in a [0,π,0] rotation, scale 1.003, THREE.FrontSide
     The Y-rotation makes those polygons' "front normals" face the camera only
     when orbited to the back — naturally occluded when viewing from the front.

   Mug:
     5 separate primitives loaded via useGLTF; each gets its own material:
       body   → ceramic PBR + wrap texture (RepeatWrapping)
       inner  → dark (BackSide) to read as hollow cavity
       bottom → garment colour, matte
       rim    → garment colour, slight clearcoat
       handle → garment colour, clearcoat ceramic
════════════════════════════════════════════════════════ */
import { useMemo, useEffect } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

// Print-zone constants imported for reference / future UV-crop helpers
// (the design texture already encodes the correct zone via composeLayers)
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

/**
 * Collect all Mesh objects from a GLTF scene in depth-first order.
 * A single-primitive GLTF node loads as THREE.Mesh;
 * a multi-primitive GLTF node loads as THREE.Group with Mesh children.
 */
function collectMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  return meshes;
}

/* ─────────────────────────────── T-SHIRT (GLB) ───────── */
/**
 * Renders the tshirt.glb mesh.
 * Front and back design overlays each use THREE.FrontSide:
 *   Front design stays at default orientation — visible from the front.
 *   Back design is in a [0,π,0]-rotated wrapper so its normals face the
 *   camera only when the camera is on the back side of the mesh.
 */
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
  const geo = meshes[0]?.geometry ?? null;

  if (!geo) return null;

  return (
    <group scale={2.6}>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial color={garmentColor} roughness={0.78} metalness={0.02} />
      </mesh>
      {frontTex && (
        <mesh geometry={geo} scale={1.003}>
          <meshStandardMaterial
            map={frontTex} transparent roughness={0.65} metalness={0}
            depthWrite={false} alphaTest={0.02} side={THREE.FrontSide}
          />
        </mesh>
      )}
      {backTex && (
        <group rotation={[0, Math.PI, 0]}>
          <mesh geometry={geo} scale={1.003}>
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
/**
 * Renders any multi-part garment GLB.
 * All primitives get garment color; front + back design overlays applied to
 * the body primitive (index 0) only.
 */
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

  if (meshes.length === 0) return null;

  return (
    <group>
      {/* Base colour for every part */}
      {meshes.map((m, i) => (
        <mesh key={i} geometry={m.geometry} castShadow receiveShadow>
          <meshStandardMaterial color={garmentColor} roughness={roughness} metalness={0.01} />
        </mesh>
      ))}
      {/* Front design overlay — body mesh (index 0) only */}
      {frontTex && (
        <mesh geometry={meshes[0].geometry} scale={1.003}>
          <meshStandardMaterial
            map={frontTex} transparent roughness={roughness - 0.14}
            depthWrite={false} alphaTest={0.02} side={THREE.FrontSide}
          />
        </mesh>
      )}
      {/* Back design overlay */}
      {backTex && (
        <group rotation={[0, Math.PI, 0]}>
          <mesh geometry={meshes[0].geometry} scale={1.003}>
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

  if (meshes.length === 0) return null;

  // crown = meshes[0], brim = meshes[1] (matches generator order)
  return (
    <group>
      {meshes.map((m, i) => (
        <mesh key={i} geometry={m.geometry} castShadow receiveShadow>
          <meshStandardMaterial color={garmentColor} roughness={i === 1 ? 0.7 : 0.75} metalness={0.02} />
        </mesh>
      ))}
      {/* Design on crown (index 0) only */}
      {frontTex && (
        <mesh geometry={meshes[0].geometry} scale={1.003}>
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
/**
 * Multi-part ceramic mug loaded from mug.glb (5 primitives):
 *   [0] body   → ceramic PBR + wrap design texture
 *   [1] inner  → dark BackSide material (hollow cavity)
 *   [2] bottom → garment colour, matte
 *   [3] rim    → garment colour, clearcoat
 *   [4] handle → garment colour, clearcoat ceramic
 *
 * The wrap texture covers a 360° band; offset.set(0.25, 0) aligns the
 * print-zone centre to the front-facing side of the cylinder (matching MUG_PZ).
 */
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
      {/* body — base ceramic shell, garment colour only (no texture here) */}
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

      {/* design decal — transparent overlay so non-printed pixels leave
          garment colour visible; confined to the wrap band via UV repeat/offset */}
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

      {/* inner liner — dark back-side so the cavity reads as hollow */}
      <mesh geometry={innerGeo}>
        <meshStandardMaterial color={"#161616"} side={THREE.BackSide} roughness={0.55} />
      </mesh>

      {/* solid bottom — garment colour */}
      <mesh geometry={bottomGeo}>
        <meshStandardMaterial color={garmentColor} roughness={0.40} />
      </mesh>

      {/* top rim ring — garment colour, slight clearcoat */}
      <mesh geometry={rimGeo}>
        <meshPhysicalMaterial color={garmentColor} roughness={0.30} clearcoat={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* handle — garment colour, full clearcoat */}
      <mesh geometry={handleGeo} castShadow>
        <meshPhysicalMaterial color={garmentColor} roughness={0.28} clearcoat={0.55} clearcoatRoughness={0.2} />
      </mesh>
    </group>
  );
}
useGLTF.preload("/models/mug.glb");
