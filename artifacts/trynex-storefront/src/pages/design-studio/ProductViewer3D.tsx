/* ═══════════════════════════════════════════════════════
   PRODUCT VIEWER 3D — realtime preview using R3F
   • T-shirt/longsleeve/hoodie  → dual flat plane meshes (front + back), camera flips
   • Mug                        → open cylinder + handle, full 360° wrap texture
   • Cap                        → flat front panel
   Texture data comes from offscreen canvases composed by ../composer.ts
════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import {
  composeLayers,
  type ComposerLayer,
  type ComposerPrintZone,
} from "./composer";
import type { DesignProduct } from "./mockups";

interface FacePayload {
  layers: ComposerLayer[];
  printZone: ComposerPrintZone;
  baseHeight: number;
}

export interface ProductViewer3DProps {
  product: DesignProduct;
  garmentColor: string;
  /** "front" face content (always present) */
  front: FacePayload;
  /** "back" face content — only used for tshirt/longsleeve/hoodie */
  back?: FacePayload;
  /** Which face the user is currently viewing/editing — camera will rotate to it */
  activeFace?: "front" | "back";
}

/** Hook: build a CanvasTexture that re-composes whenever its inputs change. */
function useFaceTexture(face: FacePayload | undefined, garmentColor: string | null, opts: {
  outW: number; outH: number; clipToPrintZone?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const [, setVersion] = useState(0);

  if (!canvasRef.current) {
    canvasRef.current = document.createElement("canvas");
  }
  if (!textureRef.current) {
    const tex = new THREE.CanvasTexture(canvasRef.current);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    textureRef.current = tex;
  }

  // Stable signature so React only recomposes when something meaningful changes
  const sig = face ? JSON.stringify({
    g: garmentColor,
    z: face.printZone,
    h: face.baseHeight,
    l: face.layers.map(l => l.type === "image"
      ? [l.visible, l.transform, l.naturalW, l.naturalH, l.src.slice(0, 64)]
      : [l.visible, l.transform, l.text, l.fontFamily, l.fontSize, l.fontStyle, l.fontWeight, l.color]),
  }) : "";

  // Stash the latest `face` object in a ref so the effect can read it without
  // having to list it in deps. Listing the prop directly would cause the
  // effect to fire on every parent re-render (parents typically pass freshly
  // constructed `{ layers, printZone, baseHeight }` payload objects each
  // render), wasting an offscreen-canvas recomposition per render even when
  // no layer or color actually changed. The `sig` string already captures
  // every input that matters, and is the only thing the effect really needs
  // to react to.
  const faceRef = useRef(face);
  faceRef.current = face;
  const clipFlag = opts.clipToPrintZone ?? true;

  useEffect(() => {
    const f = faceRef.current;
    if (!f) return;
    let cancelled = false;
    composeLayers({
      canvas: canvasRef.current!,
      baseHeight: f.baseHeight,
      printZone: f.printZone,
      layers: f.layers,
      garmentColor,
      outW: opts.outW,
      outH: opts.outH,
      imageCache: cacheRef.current,
      clipToPrintZone: clipFlag,
      blendMode: "multiply",
    }).then(() => {
      if (cancelled) return;
      if (textureRef.current) textureRef.current.needsUpdate = true;
      setVersion(v => v + 1);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, garmentColor, opts.outW, opts.outH, clipFlag]);

  return textureRef.current;
}

/* ──────────────────────── MUG ──────────────────────── */
function Mug({ wrapTex, garmentColor }: { wrapTex: THREE.CanvasTexture | null; garmentColor: string }) {
  const groupRef = useRef<THREE.Group>(null);
  // Mug body — open cylinder
  const bodyGeo = useMemo(() => new THREE.CylinderGeometry(0.7, 0.7, 1.65, 96, 1, true), []);
  const innerGeo = useMemo(() => new THREE.CylinderGeometry(0.66, 0.66, 1.6, 64, 1, true), []);
  const bottomGeo = useMemo(() => new THREE.CircleGeometry(0.7, 64), []);
  const handleGeo = useMemo(() => new THREE.TorusGeometry(0.32, 0.07, 24, 64, Math.PI * 1.3), []);

  useEffect(() => {
    if (wrapTex) {
      // Tile = 1 wrap; flip so artwork reads correctly when looking at the front
      wrapTex.wrapS = THREE.RepeatWrapping;
      wrapTex.wrapT = THREE.ClampToEdgeWrapping;
      wrapTex.repeat.set(-1, 1);
      wrapTex.offset.set(0.25, 0); // align print-zone center with the front of the mug
      wrapTex.needsUpdate = true;
    }
  }, [wrapTex]);

  return (
    <group ref={groupRef} position={[0, -0.05, 0]}>
      {/* outer shell */}
      <mesh geometry={bodyGeo} castShadow receiveShadow>
        <meshPhysicalMaterial
          map={wrapTex ?? undefined}
          color={"#ffffff"}
          roughness={0.25}
          metalness={0.05}
          clearcoat={0.6}
          clearcoatRoughness={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* inner liner */}
      <mesh geometry={innerGeo}>
        <meshStandardMaterial color={"#1a1a1a"} side={THREE.BackSide} roughness={0.5} />
      </mesh>
      {/* bottom cap */}
      <mesh geometry={bottomGeo} position={[0, -0.825, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color={garmentColor} roughness={0.35} />
      </mesh>
      {/* top rim */}
      <mesh position={[0, 0.825, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.66, 0.7, 64]} />
        <meshStandardMaterial color={"#d8d8d8"} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* handle */}
      <mesh
        geometry={handleGeo}
        position={[0.78, 0, 0]}
        rotation={[0, Math.PI / 2, Math.PI / 2 - 0.1]}
        castShadow
      >
        <meshPhysicalMaterial color={garmentColor} roughness={0.3} clearcoat={0.4} />
      </mesh>
    </group>
  );
}

/* ──────────── TEE / LONGSLEEVE / HOODIE / CAP ──────── */
/** A single garment "panel" — a slightly soft rounded plane with a shape mask
   matching the silhouette of the product. Done with a custom rounded-rect shape. */
function GarmentPanel({
  texture,
  garmentColor,
  side,
  width,
  height,
  zOffset,
}: {
  texture: THREE.CanvasTexture | null;
  garmentColor: string;
  side: "front" | "back";
  width: number;
  height: number;
  zOffset: number;
}) {
  // Build a tee-shaped silhouette (works as a stylized stand-in for hoodie/longsleeve too).
  const shape = useMemo(() => {
    const w = width, h = height;
    const halfW = w / 2;
    const shoulderY = h * 0.35;
    const sleeveOutX = halfW + w * 0.12;
    const sleeveBottomY = h * 0.20;
    const bodyEdgeX = halfW * 0.78;
    const s = new THREE.Shape();
    // start at the right collar
    s.moveTo(w * 0.10, h * 0.50);
    // collar up & over (left → right)
    s.bezierCurveTo(w * 0.05, h * 0.48, w * -0.05, h * 0.50, w * -0.10, h * 0.50);
    // up to neckline top via collar
    s.bezierCurveTo(w * -0.10, h * 0.50, w * -0.18, h * 0.45, w * -0.20, shoulderY);
    // shoulder out → sleeve
    s.lineTo(-sleeveOutX, sleeveBottomY);
    s.lineTo(-sleeveOutX + w * 0.05, h * 0.10);
    s.lineTo(-bodyEdgeX, h * 0.10);
    // body left side → hem
    s.lineTo(-bodyEdgeX, -h * 0.50);
    s.lineTo(bodyEdgeX, -h * 0.50);
    // body right side → sleeve
    s.lineTo(bodyEdgeX, h * 0.10);
    s.lineTo(sleeveOutX - w * 0.05, h * 0.10);
    s.lineTo(sleeveOutX, sleeveBottomY);
    s.lineTo(w * 0.20, shoulderY);
    s.bezierCurveTo(w * 0.18, h * 0.45, w * 0.10, h * 0.50, w * 0.10, h * 0.50);
    s.closePath();
    return s;
  }, [width, height]);

  const geo = useMemo(() => {
    const g = new THREE.ShapeGeometry(shape, 12);
    // Map UVs from shape bbox so [printZone] maps correctly
    g.computeBoundingBox();
    const bbox = g.boundingBox!;
    const sizeX = bbox.max.x - bbox.min.x;
    const sizeY = bbox.max.y - bbox.min.y;
    const uvAttr = g.attributes.uv as THREE.BufferAttribute;
    const posAttr = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      uvAttr.setXY(i, (x - bbox.min.x) / sizeX, (y - bbox.min.y) / sizeY);
    }
    uvAttr.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, [shape]);

  return (
    <group position={[0, 0, zOffset]} rotation={[0, side === "back" ? Math.PI : 0, 0]}>
      {/* base garment (so silhouette has its real fabric color even in transparent texture areas) */}
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial color={garmentColor} roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      {/* printed artwork on top */}
      {texture && (
        <mesh geometry={geo} position={[0, 0, 0.001]}>
          <meshStandardMaterial
            map={texture}
            transparent
            roughness={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}

function CameraRig({ activeFace, isMug }: { activeFace: "front" | "back"; isMug: boolean }) {
  // Smoothly rotate camera around Y axis to face the active side
  const targetY = isMug ? 0 : (activeFace === "back" ? Math.PI : 0);
  useFrame(({ camera }) => {
    const radius = isMug ? 3.4 : 4.0;
    // current angle of camera
    const cur = Math.atan2(camera.position.x, camera.position.z);
    // Lerp toward target, but only if user isn't actively orbiting (best-effort)
    const next = cur + (targetY - cur) * 0.06;
    camera.position.x = Math.sin(next) * radius;
    camera.position.z = Math.cos(next) * radius;
    camera.position.y = isMug ? 0.4 : 0.2;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function ProductViewer3D({
  product,
  garmentColor,
  front,
  back,
  activeFace = "front",
}: ProductViewer3DProps) {
  const isMug = product.category === "mug";

  // For the mug, build a wide texture (~ 2π:height ratio) at high resolution
  const mugTex = useFaceTexture(
    isMug ? front : undefined,
    garmentColor,
    { outW: 2048, outH: 768, clipToPrintZone: true }
  );

  // For tee/longsleeve/hoodie/cap — front + back textures with transparent bg
  // so the underlying garment-colored mesh shows through outside the print.
  const frontTex = useFaceTexture(
    !isMug ? front : undefined,
    null,
    { outW: 1024, outH: 1024, clipToPrintZone: true }
  );
  const backTex = useFaceTexture(
    !isMug && back ? back : undefined,
    null,
    { outW: 1024, outH: 1024, clipToPrintZone: true }
  );

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 0.2, 4], fov: 35 }}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
      style={{ width: "100%", height: "100%", background: "transparent" }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[3, 4, 5]}
          intensity={1.1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-4, 2, -3]} intensity={0.35} color={"#bcd6ff"} />

        <Environment preset="city" />

        <CameraRig activeFace={activeFace} isMug={isMug} />

        {isMug ? (
          <Mug wrapTex={mugTex} garmentColor={garmentColor} />
        ) : (
          <>
            <GarmentPanel
              texture={frontTex}
              garmentColor={garmentColor}
              side="front"
              width={2.4}
              height={3.0}
              zOffset={0.02}
            />
            <GarmentPanel
              texture={backTex}
              garmentColor={garmentColor}
              side="back"
              width={2.4}
              height={3.0}
              zOffset={-0.02}
            />
          </>
        )}

        <ContactShadows
          position={[0, isMug ? -0.85 : -1.55, 0]}
          opacity={0.35}
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
