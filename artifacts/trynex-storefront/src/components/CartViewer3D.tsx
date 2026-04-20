/* ═══════════════════════════════════════════════════════
   CART VIEWER 3D — compact interactive 3D garment preview
   Loads pre-composed design texture URLs (stored at cart time)
   so it never needs raw Layer objects — tiny bundle cost.
════════════════════════════════════════════════════════ */
import { useMemo, useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";

/* ── Realistic GLB shirt — uses the SAME UV mapping strategy as the studio's
   ProductViewer3D so the design lands exactly where the user placed it.
   The composed texture (composeDesignTexture) is a 1000×1000 transparent
   canvas with the layers already positioned correctly in the print zone,
   so we apply it directly to the shirt mesh's UVs (no cropping). */
function RealisticShirt({ designUrl, garmentColor }: { designUrl?: string; garmentColor: string }) {
  const { scene } = useGLTF("/models/tshirt.glb") as { scene: THREE.Group };
  const shirtGeo = useMemo(() => {
    let g: THREE.BufferGeometry | null = null;
    scene.traverse(o => {
      if ((o as THREE.Mesh).isMesh && !g) g = (o as THREE.Mesh).geometry as THREE.BufferGeometry;
    });
    return g;
  }, [scene]);
  const designTex = useMemo(() => {
    if (!designUrl) return null;
    const t = new THREE.TextureLoader().load(designUrl);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [designUrl]);
  if (!shirtGeo) return null;
  return (
    <group scale={2.6}>
      <mesh geometry={shirtGeo} castShadow receiveShadow>
        <meshStandardMaterial color={garmentColor} roughness={0.78} metalness={0.02} />
      </mesh>
      {designTex && (
        <mesh geometry={shirtGeo} scale={1.001}>
          <meshStandardMaterial
            map={designTex}
            transparent
            roughness={0.65}
            metalness={0}
            depthWrite={false}
            alphaTest={0.02}
          />
        </mesh>
      )}
    </group>
  );
}
useGLTF.preload("/models/tshirt.glb");

/* ── Garment panel shape (tee silhouette) ──────────── */
function useGarmentGeo(width: number, height: number) {
  return useMemo(() => {
    const w = width, h = height;
    const halfW = w / 2;
    const shoulderY = h * 0.35;
    const sleeveOutX = halfW + w * 0.12;
    const sleeveBottomY = h * 0.20;
    const bodyEdgeX = halfW * 0.78;
    const s = new THREE.Shape();
    s.moveTo(w * 0.10, h * 0.50);
    s.bezierCurveTo(w * 0.05, h * 0.48, w * -0.05, h * 0.50, w * -0.10, h * 0.50);
    s.bezierCurveTo(w * -0.10, h * 0.50, w * -0.18, h * 0.45, w * -0.20, shoulderY);
    s.lineTo(-sleeveOutX, sleeveBottomY);
    s.lineTo(-sleeveOutX + w * 0.05, h * 0.10);
    s.lineTo(-bodyEdgeX, h * 0.10);
    s.lineTo(-bodyEdgeX, -h * 0.50);
    s.lineTo(bodyEdgeX, -h * 0.50);
    s.lineTo(bodyEdgeX, h * 0.10);
    s.lineTo(sleeveOutX - w * 0.05, h * 0.10);
    s.lineTo(sleeveOutX, sleeveBottomY);
    s.lineTo(w * 0.20, shoulderY);
    s.bezierCurveTo(w * 0.18, h * 0.45, w * 0.10, h * 0.50, w * 0.10, h * 0.50);
    s.closePath();

    const g = new THREE.ShapeGeometry(s, 24);
    g.computeBoundingBox();
    const bbox = g.boundingBox!;
    const sizeX = bbox.max.x - bbox.min.x;
    const sizeY = bbox.max.y - bbox.min.y;
    const uvAttr = g.attributes.uv as THREE.BufferAttribute;
    const posAttr = g.attributes.position as THREE.BufferAttribute;
    const curveDepth = sizeX * 0.06;
    const bodyRadius = sizeX * 0.32;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const u = (x - bbox.min.x) / sizeX;
      const v = (y - bbox.min.y) / sizeY;
      uvAttr.setXY(i, u, v);
      const sleeveDamp = Math.max(0, 1 - Math.max(0, Math.abs(x) - bodyRadius) / (sizeX * 0.18));
      const verticalDamp = Math.sin(Math.PI * v);
      const z = curveDepth * Math.cos((Math.PI * (x - bbox.min.x)) / sizeX - Math.PI / 2)
              * sleeveDamp * verticalDamp;
      posAttr.setZ(i, z);
    }
    uvAttr.needsUpdate = true;
    posAttr.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, [width, height]);
}

function GarmentPanel({
  designUrl,
  garmentColor,
  side,
  width = 2.4,
  height = 3.0,
  zOffset,
}: {
  designUrl?: string;
  garmentColor: string;
  side: "front" | "back";
  width?: number;
  height?: number;
  zOffset: number;
}) {
  const geo = useGarmentGeo(width, height);

  const designTex = useMemo(() => {
    if (!designUrl) return null;
    const tex = new THREE.TextureLoader().load(designUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, [designUrl]);

  return (
    <group position={[0, 0, zOffset]} rotation={[0, side === "back" ? Math.PI : 0, 0]}>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial color={garmentColor} roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      {designTex && (
        <mesh geometry={geo} position={[0, 0, 0.001]}>
          <meshStandardMaterial
            map={designTex}
            transparent
            roughness={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}

/* ── Mug body ──────────────────────────────────────── */
function MugBody({ designUrl, garmentColor }: { designUrl?: string; garmentColor: string }) {
  const bodyGeo = useMemo(() => new THREE.CylinderGeometry(0.7, 0.7, 1.65, 96, 1, true), []);
  const innerGeo = useMemo(() => new THREE.CylinderGeometry(0.66, 0.66, 1.6, 64, 1, true), []);
  const bottomGeo = useMemo(() => new THREE.CircleGeometry(0.7, 64), []);
  const handleGeo = useMemo(() => new THREE.TorusGeometry(0.32, 0.07, 24, 64, Math.PI * 1.3), []);

  const wrapTex = useMemo(() => {
    if (!designUrl) return null;
    const tex = new THREE.TextureLoader().load(designUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(-1, 1);
    tex.offset.set(0.25, 0);
    return tex;
  }, [designUrl]);

  return (
    <group position={[0, -0.05, 0]}>
      <mesh geometry={bodyGeo} castShadow receiveShadow>
        <meshPhysicalMaterial
          map={wrapTex ?? undefined}
          color="#ffffff"
          roughness={0.25}
          metalness={0.05}
          clearcoat={0.6}
          clearcoatRoughness={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={innerGeo}>
        <meshStandardMaterial color="#1a1a1a" side={THREE.BackSide} roughness={0.5} />
      </mesh>
      <mesh geometry={bottomGeo} position={[0, -0.825, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color={garmentColor} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.825, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.66, 0.7, 64]} />
        <meshStandardMaterial color="#d8d8d8" roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={handleGeo} position={[0.78, 0, 0]} rotation={[0, Math.PI / 2, Math.PI / 2 - 0.1]} castShadow>
        <meshPhysicalMaterial color={garmentColor} roughness={0.3} clearcoat={0.4} />
      </mesh>
    </group>
  );
}

/* ── Auto-rotate on load, then user takes over ─────── */
function AutoRotate({ isMug }: { isMug: boolean }) {
  const tickRef = useRef(0);
  useFrame(({ camera }) => {
    if (tickRef.current > 120) return; // stop after ~2 seconds
    tickRef.current++;
    const radius = isMug ? 3.4 : 4.0;
    const angle = -tickRef.current * 0.008;
    camera.position.x = Math.sin(angle) * radius;
    camera.position.z = Math.cos(angle) * radius;
    camera.position.y = isMug ? 0.4 : 0.2;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/* ── Public component ──────────────────────────────── */
export interface CartViewer3DProps {
  garmentColor: string;
  /** product category — controls which 3D shape to render */
  category: "tshirt" | "longsleeve" | "hoodie" | "mug" | "cap";
  /** Pre-composed design texture URL (transparent bg, design at correct UV position) */
  frontTexUrl?: string;
  /** Back-face design texture URL */
  backTexUrl?: string;
}

export default function CartViewer3D({ garmentColor, category, frontTexUrl, backTexUrl }: CartViewer3DProps) {
  const isMug = category === "mug";

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.2, 4], fov: 38 }}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
      style={{ width: "100%", height: "100%", background: "transparent" }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 4, 5]} intensity={1.1} castShadow
          shadow-mapSize-width={512} shadow-mapSize-height={512} />
        <directionalLight position={[-4, 2, -3]} intensity={0.35} color="#bcd6ff" />

        <Environment preset="city" />
        <AutoRotate isMug={isMug} />

        {isMug ? (
          <MugBody designUrl={frontTexUrl} garmentColor={garmentColor} />
        ) : category === "tshirt" ? (
          <RealisticShirt designUrl={frontTexUrl} garmentColor={garmentColor} />
        ) : (
          <>
            <GarmentPanel designUrl={frontTexUrl} garmentColor={garmentColor} side="front" zOffset={0.02} />
            <GarmentPanel designUrl={backTexUrl} garmentColor={garmentColor} side="back" zOffset={-0.02} />
          </>
        )}

        <ContactShadows
          position={[0, isMug ? -0.85 : -1.55, 0]}
          opacity={0.3}
          blur={2.4}
          scale={6}
          far={3}
        />

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={isMug ? 2.4 : 3}
          maxDistance={isMug ? 5 : 6}
          minPolarAngle={Math.PI * 0.25}
          maxPolarAngle={Math.PI * 0.65}
        />
      </Suspense>
    </Canvas>
  );
}
