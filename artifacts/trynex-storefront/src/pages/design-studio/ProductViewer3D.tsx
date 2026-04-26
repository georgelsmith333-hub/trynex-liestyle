/* ═══════════════════════════════════════════════════════
   PRODUCT VIEWER 3D — realtime preview using R3F

   Mug wrap texture layout (2048×768):
     [0 – 1024]    = Left Side  (front face layers, handle-side ≈ right)
     [1024 – 2048] = Right Side (back face layers, handle-side ≈ left)

   UV offset = 0.25 (set in MugBody):
     u_geo=0.00 (+Z front)  → u_tex=0.25 → canvas x=512  (centre left half) ✓
     u_geo=0.50 (−Z back)   → u_tex=0.75 → canvas x=1536 (centre right half) ✓

   Wrap mode: back layers compose into full 2048 canvas (no half-split).
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
  WaterBottleBody,
  ResettableOrbitControls,
  ViewerLoadingOverlay,
  NoWebGLFallback,
  StudioLightRig,
  hasWebGL2,
  VIEWER_DEFAULTS,
  VIEWER_FRAMING,
  VIEWER_FRAMING_BACK,
} from "../../components/garment3d";

interface FacePayload {
  layers: ComposerLayer[];
  printZone: ComposerPrintZone;
  baseHeight: number;
}

export interface ProductViewer3DProps {
  product: DesignProduct;
  garmentColor: string;
  front: FacePayload;
  back?: FacePayload;
  activeFace?: "front" | "back";
  /** True when the mug is in "Full Wrap" mode — back layers fill the full 360° body. */
  isWrapMode?: boolean;
}

/* ── Generic face texture (garments: tshirt / longsleeve / hoodie / cap) ─── */
function useFaceTexture(
  face: FacePayload | undefined,
  garmentColor: string | null,
  opts: { outW: number; outH: number; clipToPrintZone?: boolean }
): THREE.CanvasTexture | null {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const [, setVersion] = useState(0);

  if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
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
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, garmentColor, opts.outW, opts.outH, clipFlag]);

  return face ? textureRef.current : null;
}

/* ── Mug cylindrical wrap texture ────────────────────────────────────────────
   2048×768 canvas:
     [0–1024]    = Left Side (front layers)
     [1024–2048] = Right Side (back layers)
   In Wrap mode the back layers are composed at full 2048 width so the design
   runs continuously all the way around the cylinder.
──────────────────────────────────────────────────────────────────────────── */
function useMugWrapTexture(
  front: FacePayload,
  back: FacePayload | undefined,
  isWrapMode: boolean
): THREE.CanvasTexture | null {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cacheRef  = useRef<Map<string, HTMLImageElement>>(new Map());
  const texRef    = useRef<THREE.CanvasTexture | null>(null);
  const [, setVersion] = useState(0);

  if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
  if (!texRef.current) {
    const tex = new THREE.CanvasTexture(canvasRef.current);
    tex.colorSpace  = THREE.SRGBColorSpace;
    tex.anisotropy  = 8;
    tex.wrapS       = THREE.RepeatWrapping;
    tex.wrapT       = THREE.ClampToEdgeWrapping;
    tex.repeat.set(1, 1);
    tex.offset.set(0.25, 0);
    tex.flipY       = true;
    texRef.current  = tex;
  }

  const makeSig = (f: FacePayload | undefined) =>
    f
      ? f.layers.map((l) =>
          l.type === "image"
            ? [l.visible, l.transform, l.src.slice(0, 64)]
            : [l.visible, l.transform, l.text, l.color]
        )
      : [];

  const sig = JSON.stringify({
    wrap: isWrapMode,
    fl: makeSig(front),
    bl: makeSig(back),
    pz: front.printZone,
  });

  useEffect(() => {
    const mainCanvas = canvasRef.current!;
    mainCanvas.width  = 2048;
    mainCanvas.height = 768;
    const ctx = mainCanvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 2048, 768);

    let cancelled = false;

    (async () => {
      if (isWrapMode && back && back.layers.length > 0) {
        /* ── WRAP MODE: back layers span the full 2048 canvas ── */
        const tmp = document.createElement("canvas");
        await composeLayers({
          canvas: tmp,
          baseHeight: back.baseHeight,
          printZone: back.printZone,
          layers: back.layers,
          garmentColor: null,
          outW: 2048,
          outH: 768,
          imageCache: cacheRef.current,
          clipToPrintZone: false,
          blendMode: "source-over",
        });
        if (!cancelled) ctx.drawImage(tmp, 0, 0);
      } else {
        /* ── SIDE MODE: each face goes into its half of the canvas ── */

        if (front.layers.length > 0) {
          /* Left Side (front face) → left half [0–1024] */
          const tmp = document.createElement("canvas");
          await composeLayers({
            canvas: tmp,
            baseHeight: front.baseHeight,
            printZone: front.printZone,
            layers: front.layers,
            garmentColor: null,
            outW: 1024,
            outH: 768,
            imageCache: cacheRef.current,
            clipToPrintZone: true,
            blendMode: "source-over",
          });
          if (!cancelled) ctx.drawImage(tmp, 0, 0);
        }

        if (back && back.layers.length > 0) {
          /* Right Side (back face) → right half [1024–2048] */
          const tmp = document.createElement("canvas");
          await composeLayers({
            canvas: tmp,
            baseHeight: back.baseHeight,
            printZone: back.printZone,
            layers: back.layers,
            garmentColor: null,
            outW: 1024,
            outH: 768,
            imageCache: cacheRef.current,
            clipToPrintZone: true,
            blendMode: "source-over",
          });
          if (!cancelled) ctx.drawImage(tmp, 1024, 0);
        }
      }

      if (!cancelled && texRef.current) {
        texRef.current.needsUpdate = true;
        setVersion((v) => v + 1);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return texRef.current;
}

/* ── Water-bottle wrap texture ───────────────────────────────────────────────
   2048×1024 canvas — design composited into the LEFT half [0–1024].
   With tex.offset.set(0.25, 0) the CylinderGeometry +Z face maps to canvas
   x≈512 (centre of left half) so the design appears on the front of the bottle.
   The right half stays transparent → design is hidden on the back side.
──────────────────────────────────────────────────────────────────────────── */
function useBottleWrapTexture(
  front: FacePayload,
  active: boolean
): THREE.CanvasTexture | null {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cacheRef  = useRef<Map<string, HTMLImageElement>>(new Map());
  const texRef    = useRef<THREE.CanvasTexture | null>(null);
  const [, setVersion] = useState(0);

  if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
  if (!texRef.current && active) {
    const tex = new THREE.CanvasTexture(canvasRef.current);
    tex.colorSpace  = THREE.SRGBColorSpace;
    tex.anisotropy  = 8;
    tex.wrapS       = THREE.RepeatWrapping;
    tex.wrapT       = THREE.ClampToEdgeWrapping;
    tex.repeat.set(1, 1);
    tex.offset.set(0.25, 0); // +Z front → canvas centre-left
    tex.flipY       = true;
    texRef.current  = tex;
  }

  const sig = active
    ? JSON.stringify({
        fl: front.layers.map((l) =>
          l.type === "image"
            ? [l.visible, l.transform, l.src.slice(0, 64)]
            : [l.visible, l.transform, l.text, l.color]
        ),
        pz: front.printZone,
      })
    : "";

  useEffect(() => {
    if (!active) return;
    const mainCanvas = canvasRef.current!;
    mainCanvas.width  = 2048;
    mainCanvas.height = 1024;
    const ctx = mainCanvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 2048, 1024);

    if (front.layers.length === 0) {
      if (texRef.current) { texRef.current.needsUpdate = true; setVersion(v => v + 1); }
      return;
    }

    let cancelled = false;
    (async () => {
      const tmp = document.createElement("canvas");
      await composeLayers({
        canvas: tmp,
        baseHeight: front.baseHeight,
        printZone: front.printZone,
        layers: front.layers,
        garmentColor: null,
        outW: 1024,
        outH: 1024,
        imageCache: cacheRef.current,
        clipToPrintZone: true,
        blendMode: "source-over",
      });
      if (!cancelled) ctx.drawImage(tmp, 0, 0);
      if (!cancelled && texRef.current) {
        texRef.current.needsUpdate = true;
        setVersion((v) => v + 1);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, active]);

  return active ? texRef.current : null;
}

/* ── Camera rig: smooth orbit to the active face ─────────────────────────── */
function CameraRig({
  activeFace,
  category,
}: {
  activeFace: "front" | "back";
  category: "tshirt" | "longsleeve" | "hoodie" | "cap" | "mug" | "waterbottle";
}) {
  const f = VIEWER_FRAMING[category];
  const b = VIEWER_FRAMING_BACK[category] || {};
  const hasBackFace = category === "tshirt" || category === "longsleeve" || category === "hoodie";
  const isBack = hasBackFace && activeFace === "back";
  const targetY = isBack ? Math.PI : 0;
  const radius  = isBack && b.radius   !== undefined ? b.radius   : f.radius;
  const cameraY = isBack && b.cameraY  !== undefined ? b.cameraY  : f.cameraY;

  useFrame(({ camera }) => {
    const cur  = Math.atan2(camera.position.x, camera.position.z);
    const next = cur + (targetY - cur) * 0.06;
    camera.position.x = Math.sin(next) * radius;
    camera.position.z = Math.cos(next) * radius;
    camera.position.y = cameraY;
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
  isWrapMode = false,
}: ProductViewer3DProps) {
  const isMug         = product.category === "mug";
  const isWaterBottle = product.category === "waterbottle";
  const isGarment     = !isMug && !isWaterBottle;

  /* Mug: combined cylindrical wrap texture from both sides */
  const mugTex = useMugWrapTexture(
    isMug ? front : { layers: [], printZone: front.printZone, baseHeight: front.baseHeight },
    isMug ? back : undefined,
    isMug && isWrapMode
  );

  /* Water bottle: front-face-only wrap texture */
  const bottleTex = useBottleWrapTexture(front, isWaterBottle);

  /* Garments (tshirt / longsleeve / hoodie / cap): transparent per-face overlays */
  const frontTex = useFaceTexture(
    isGarment ? front : undefined,
    null,
    { outW: 1024, outH: 1024, clipToPrintZone: true }
  );
  const backTex = useFaceTexture(
    isGarment && back ? back : undefined,
    null,
    { outW: 1024, outH: 1024, clipToPrintZone: true }
  );

  const supports3D = useMemo(() => hasWebGL2(), []);

  /* Fallback 2D composition for WebGL-less devices */
  const [fallbackUrl, setFallbackUrl] = useState<string | undefined>();
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
    }).then(() => setFallbackUrl(c.toDataURL("image/png")));
  }, [supports3D, front]);

  /* No WebGL2 → flat 2D photo mockup fallback */
  if (!supports3D) {
    return (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <NoWebGLFallback
          garmentSrc={product.frontSrc}
          designSrc={fallbackUrl}
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
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      >
        <Suspense fallback={null}>
          <StudioLightRig rim />
          <Environment preset="city" />
          <CameraRig activeFace={activeFace} category={product.category} />

          {product.category === "mug" && (
            <MugBody wrapTex={mugTex ?? undefined} garmentColor={garmentColor} />
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

          {product.category === "waterbottle" && (
            <WaterBottleBody wrapTex={bottleTex} garmentColor={garmentColor} />
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
