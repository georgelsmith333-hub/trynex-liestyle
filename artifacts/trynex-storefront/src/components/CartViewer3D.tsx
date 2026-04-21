/* ═══════════════════════════════════════════════════════
   CART VIEWER 3D — compact interactive 3D garment preview
   Loads pre-composed design texture URLs (stored at cart time)
   so it never needs raw Layer objects — tiny bundle cost.
   Uses the shared garment3d helpers so rendering matches the studio exactly.
════════════════════════════════════════════════════════ */
import { useRef, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Environment } from "@react-three/drei";
import {
  RealisticShirt,
  LongSleeveBody,
  HoodieBody,
  CapBody,
  MugBody,
  useUrlTexture,
} from "./garment3d";

/**
 * Unified camera controller for garments (non-mug):
 *   Phase 1 (ticks 0–80): brief auto-rotate intro so user sees the 3D shape
 *   Phase 2 (tick > 80):  smoothly lerp to the selected face and hold
 *
 * For mug: always auto-rotate (user never switches face).
 */
function CameraController({
  activeFace,
  isMug,
}: {
  activeFace: "front" | "back";
  isMug: boolean;
}) {
  const tickRef = useRef(0);
  const INTRO_TICKS = 80;

  useFrame(({ camera }) => {
    tickRef.current++;
    const radius = isMug ? 3.4 : 4.0;
    const camY   = isMug ? 0.4 : 0.2;

    if (isMug) {
      // Mug: keep auto-rotating indefinitely until user grabs OrbitControls
      const angle = -tickRef.current * 0.008;
      camera.position.x = Math.sin(angle) * radius;
      camera.position.z = Math.cos(angle) * radius;
      camera.position.y = camY;
      camera.lookAt(0, 0, 0);
      return;
    }

    if (tickRef.current <= INTRO_TICKS) {
      // Garment intro: slow spin to show the 3D shape
      const angle = -tickRef.current * 0.010;
      camera.position.x = Math.sin(angle) * radius;
      camera.position.z = Math.cos(angle) * radius;
      camera.position.y = camY;
      camera.lookAt(0, 0, 0);
    } else {
      // Garment face lock: lerp toward selected face
      const targetY = activeFace === "back" ? Math.PI : 0;
      const cur  = Math.atan2(camera.position.x, camera.position.z);
      const next = cur + (targetY - cur) * 0.08;
      camera.position.x = Math.sin(next) * radius;
      camera.position.z = Math.cos(next) * radius;
      camera.position.y = camY;
      camera.lookAt(0, 0, 0);
    }
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

export default function CartViewer3D({
  garmentColor,
  category,
  frontTexUrl,
  backTexUrl,
}: CartViewer3DProps) {
  const isMug = category === "mug";
  // Garments with front and back faces — toggle visible for all, even without back design
  const hasFrontBack = category === "tshirt" || category === "longsleeve" || category === "hoodie";
  const [face, setFace] = useState<"front" | "back">("front");

  const frontTex = useUrlTexture(frontTexUrl);
  const backTex  = useUrlTexture(backTexUrl);
  // Mug: design texture (transparent bg); garmentColor applied via material base
  const mugTex = useUrlTexture(isMug ? frontTexUrl : undefined);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Front/Back toggle — shown for all garments with both faces */}
      {hasFrontBack && (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 2,
            display: "flex",
            gap: 4,
            background: "rgba(255,255,255,0.9)",
            padding: 3,
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {(["front", "back"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFace(f)}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                background: face === f ? "#E85D04" : "transparent",
                color: face === f ? "#fff" : "#475569",
              }}
            >
              {f === "front" ? "Front" : "Back"}
            </button>
          ))}
        </div>
      )}

      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.2, 4], fov: 38 }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.6} />
          <directionalLight
            position={[3, 4, 5]}
            intensity={1.1}
            castShadow
            shadow-mapSize-width={512}
            shadow-mapSize-height={512}
          />
          <directionalLight position={[-4, 2, -3]} intensity={0.35} color="#bcd6ff" />

          <Environment preset="city" />

          {/* Unified camera: auto-rotate intro → face lock (or continuous for mug) */}
          <CameraController activeFace={face} isMug={isMug} />

          {category === "mug" && (
            <MugBody wrapTex={mugTex} garmentColor={garmentColor} />
          )}
          {category === "tshirt" && (
            <RealisticShirt frontTex={frontTex} backTex={backTex} garmentColor={garmentColor} />
          )}
          {category === "longsleeve" && (
            <LongSleeveBody frontTex={frontTex} backTex={backTex} garmentColor={garmentColor} />
          )}
          {category === "hoodie" && (
            <HoodieBody frontTex={frontTex} backTex={backTex} garmentColor={garmentColor} />
          )}
          {category === "cap" && (
            <CapBody frontTex={frontTex} garmentColor={garmentColor} />
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
    </div>
  );
}
