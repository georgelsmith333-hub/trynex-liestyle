/* ═══════════════════════════════════════════════════════
   PRODUCT VIEWER 3D — realtime preview using R3F
   Uses the shared garment3d helpers so the studio preview
   matches the cart/checkout/admin 3D viewers exactly.

   Texture composition (live CanvasTexture from offscreen canvas):
     • Garment (tshirt/longsleeve/hoodie/cap) → front + back transparent textures
     • Mug → wide wrap texture (2048×768)
════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import {
  composeLayers,
  type ComposerLayer,
  type ComposerPrintZone,
} from "./composer";
import type { DesignProduct } from "./mockups";
import {
  RealisticShirt,
  LongSleeveBody,
  HoodieBody,
  CapBody,
  MugBody,
  ResettableOrbitControls,
  ViewerLoadingOverlay,
  NoWebGLFallback,
  StudioLightRig,
  hasWebGL2,
  VIEWER_DEFAULTS,
  VIEWER_FRAMING,
} from "../../components/garment3d";

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
function useFaceTexture(
  face: FacePayload | undefined,
  garmentColor: string | null,
  opts: { outW: number; outH: number; clipToPrintZone?: boolean }
): THREE.CanvasTexture | null {
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

  const sig = face
    ? JSON.stringify({
        g: garmentColor,
        z: face.printZone,
        h: face.baseHeight,
        l: face.layers.map((l) =>
          l.type === "image"
            ? [l.visible, l.transform, l.naturalW, l.naturalH, l.src.slice(0, 64)]
            : [l.visible, l.transform, l.text, l.fontFamily, l.fontSize, l.fontStyle, l.fontWeight, l.color]
        ),
      })
    : "";

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
      setVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, garmentColor, opts.outW, opts.outH, clipFlag]);

  return face ? textureRef.current : null;
}

/* ── Camera: smoothly orbits to face the active side, framing per category ── */
function CameraRig({
  activeFace,
  category,
}: {
  activeFace: "front" | "back";
  category: "tshirt" | "longsleeve" | "hoodie" | "cap" | "mug";
}) {
  const f = VIEWER_FRAMING[category];
  // Mug & cap have no separate "back" face — keep them facing front.
  const hasBackFace = category === "tshirt" || category === "longsleeve" || category === "hoodie";
  const targetY = hasBackFace && activeFace === "back" ? Math.PI : 0;
  useFrame(({ camera }) => {
    const cur = Math.atan2(camera.position.x, camera.position.z);
    const next = cur + (targetY - cur) * 0.06;
    camera.position.x = Math.sin(next) * f.radius;
    camera.position.z = Math.cos(next) * f.radius;
    camera.position.y = f.cameraY;
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

  // Mug: wide wrap texture — design only (transparent bg).
  // MugBody applies garmentColor directly as the body material base so that
  // cart (which loads the stored texture URL) and studio render identically.
  const mugTex = useFaceTexture(
    isMug ? front : undefined,
    null,
    { outW: 2048, outH: 768, clipToPrintZone: true }
  );

  // Garments: transparent front + back textures
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

  // WebGL2 capability check — gracefully degrade to 2D mockup if unsupported
  const supports3D = useMemo(() => hasWebGL2(), []);
  // Compose a one-shot 2D mockup (garment + design) for the WebGL-less fallback.
  // Lightweight: only runs when 3D isn't supported; reuses the same composer
  // pipeline used by the live texture so the personalization is faithful.
  const [fallbackDesignUrl, setFallbackDesignUrl] = useState<string | undefined>();
  useEffect(() => {
    if (supports3D || !front) return;
    const c = document.createElement("canvas");
    composeLayers({
      canvas: c,
      baseHeight: front.baseHeight,
      printZone: front.printZone,
      layers: front.layers,
      garmentColor: null,
      outW: 1024,
      outH: 1024,
      imageCache: new Map(),
      clipToPrintZone: true,
      blendMode: "source-over",
    }).then(() => setFallbackDesignUrl(c.toDataURL("image/png")));
  }, [supports3D, front]);

  if (!supports3D) {
    return (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <NoWebGLFallback
          garmentSrc={product.frontSrc}
          designSrc={fallbackDesignUrl}
          garmentColor={garmentColor}
        />
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
    <Canvas
      shadows
      dpr={VIEWER_DEFAULTS.dpr}
      camera={{ position: VIEWER_DEFAULTS.cameraPosition, fov: VIEWER_DEFAULTS.fov }}
      // preserveDrawingBuffer: true is studio-only — needed for the
      // "Save mockup" snapshot. Cart never snapshots, so it leaves it false.
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
      style={{ width: "100%", height: "100%", background: "transparent" }}
    >
      <Suspense fallback={null}>
        <StudioLightRig rim />

        <Environment preset="city" />
        <CameraRig activeFace={activeFace} category={product.category} />

        {product.category === "mug" && (
          <MugBody wrapTex={mugTex} garmentColor={garmentColor} />
        )}

        {product.category === "tshirt" && (
          <RealisticShirt
            frontTex={frontTex}
            backTex={backTex}
            garmentColor={garmentColor}
          />
        )}

        {product.category === "longsleeve" && (
          <LongSleeveBody
            frontTex={frontTex}
            backTex={backTex}
            garmentColor={garmentColor}
          />
        )}

        {product.category === "hoodie" && (
          <HoodieBody
            frontTex={frontTex}
            backTex={backTex}
            garmentColor={garmentColor}
          />
        )}

        {product.category === "cap" && (
          <CapBody frontTex={frontTex} garmentColor={garmentColor} />
        )}

        <ContactShadows
          position={[0, VIEWER_FRAMING[product.category].shadowY, 0]}
          opacity={VIEWER_DEFAULTS.shadowOpacity}
          blur={VIEWER_DEFAULTS.shadowBlur}
          scale={VIEWER_DEFAULTS.shadowScale}
          far={VIEWER_DEFAULTS.shadowFar}
        />

        <ResettableOrbitControls
          enablePan={false}
          enableZoom={true}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.7}
          zoomSpeed={0.8}
          minDistance={VIEWER_FRAMING[product.category].minDistance}
          maxDistance={VIEWER_FRAMING[product.category].maxDistance}
          minPolarAngle={Math.PI * 0.25}
          maxPolarAngle={Math.PI * 0.65}
          touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
        />
      </Suspense>
    </Canvas>
    <ViewerLoadingOverlay />
    </div>
  );
}
