import { useEffect, useRef } from "react";
import {
  composeMockupSurface,
  type ComposerLayer,
  type UnifiedMockupSurface,
} from "../design-studio/composer";

interface Props {
  width: number;
  height: number;
  surface: UnifiedMockupSurface;
  garmentColor: string;
  layers: ComposerLayer[];
  curvature?: number;
  fabricTexture?: boolean;
  enabled?: boolean;
}

/**
 * The editor's visual authority. Konva remains responsible for selection and
 * manipulation, while this canvas renders the exact same surface used by
 * export, cart, and 3D. Rendering into a scratch canvas is intentional:
 * loading a new surface or artwork must never blank the last good frame.
 */
export function LiveCompositorPreview({
  width,
  height,
  surface,
  garmentColor,
  layers,
  curvature = 0,
  fabricTexture = false,
  enabled = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageCacheRef = useRef(new Map<string, HTMLImageElement>());
  const renderIdRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const renderId = ++renderIdRef.current;
    const scratch = document.createElement("canvas");

    const render = async () => {
      try {
        await composeMockupSurface({
          canvas: scratch,
          surface,
          garmentColor,
          layers,
          outSize: Math.max(1, Math.round(width)),
          imageCache: imageCacheRef.current,
          curvature,
          fabricTexture,
        });

        if (renderId !== renderIdRef.current) return;
        const target = canvasRef.current;
        const context = target?.getContext("2d");
        if (!target || !context) return;

        target.width = Math.max(1, Math.round(width));
        target.height = Math.max(1, Math.round(height));
        context.drawImage(scratch, 0, 0, target.width, target.height);
      } catch (error) {
        // Keep the last successful frame visible. The surrounding surface
        // availability state is responsible for explaining hard failures.
        console.warn("[studio] live compositor frame was not updated", error);
      }
    };

    void render();
    return () => {
      renderIdRef.current += 1;
    };
  }, [curvature, enabled, fabricTexture, garmentColor, height, layers, surface, width]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
      style={{ width, height }}
    />
  );
}