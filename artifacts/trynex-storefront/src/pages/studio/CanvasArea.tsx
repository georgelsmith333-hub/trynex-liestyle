import { useRef, useEffect, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Transformer } from "react-konva";
import Konva from "konva";
import { useDesignStore, useSelectedLayer } from "@/hooks/useDesignStore";
import { DesignLayer } from "./DesignLayer";
import { Layer as LayerType, PrintZone } from "./types";
import { X } from "lucide-react";

interface CanvasPoint {
  x: number;
  y: number;
}

interface Props {
  width: number;
  height: number;
  /** Optional React node rendered behind the Konva stage as the mockup (e.g. GarmentSVG). */
  mockup?: React.ReactNode;
  /** Optional pointer-safe raster detail pass rendered above editable artwork. */
  overlay?: React.ReactNode;
  /** Optional native image element to use as the mockup background inside Konva. */
  mockupImg?: HTMLImageElement;
  /** Print zone in the 1000×1000 coordinate space. CanvasArea maps it to the stage size. */
  printZone: PrintZone;
  /** Scale the design layer rendering so it aligns with the mockup print zone. */
  stageScale?: number;
  /** Called with a point in the 1000×1000 product coordinate system when a creation tool is used. */
  onCanvasAction?: (point: CanvasPoint) => void;
  /** Called while the Draw tool is pressed, with the full point path in product coordinates. */
  onDrawStart?: (point: CanvasPoint) => void;
  onDrawMove?: (point: CanvasPoint) => void;
  onDrawEnd?: () => void;
  /** Called with a sampled hex colour when the eyedropper is used. */
  onPickColor?: (hex: string) => void;
  /** Opens the full image tools workflow for an image-layer double activation. */
  onOpenImageTools?: () => void;
}

function rgbaToHex(r: number, g: number, b: number, a: number) {
  if (a < 16) return null;
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function getArtworkDimensions(layer: LayerType, scale: number) {
  if (layer.type === "image") {
    return {
      width: Math.max(28, layer.naturalW * Math.abs(layer.transform.scaleX ?? layer.transform.scale) * scale),
      height: Math.max(28, layer.naturalH * Math.abs(layer.transform.scaleY ?? layer.transform.scale) * scale),
    };
  }
  if (layer.type === "text") {
    const fontSize = layer.fontSize * Math.abs(layer.transform.scale) * scale;
    return {
      width: Math.max(48, layer.text.length * fontSize * 0.62),
      height: Math.max(32, fontSize * 1.35),
    };
  }
  return {
    width: Math.max(28, layer.width * Math.abs(layer.transform.scaleX ?? layer.transform.scale) * scale),
    height: Math.max(28, layer.height * Math.abs(layer.transform.scaleY ?? layer.transform.scale) * scale),
  };
}

export function CanvasArea({ width, height, mockup, overlay, mockupImg, printZone, onCanvasAction, onDrawStart, onDrawMove, onDrawEnd, onPickColor, onOpenImageTools }: Props) {
  const trRef = useRef<Konva.Transformer>(null);
  const drawingRef = useRef(false);
  const { layers, selectedIds, activeTool, selectLayer, clearSelection, setActiveTool, deleteLayer } = useDesignStore();
  const selectedLayer = useSelectedLayer();
  const [img, setImg] = useState<HTMLImageElement | null>(mockupImg ?? null);

  useEffect(() => {
    if (mockupImg) setImg(mockupImg);
  }, [mockupImg]);

  // Map the 1000×1000 product viewBox to the stage width/height.
  const scale = width / 1000;
  const pz = {
    x: printZone.x * scale,
    y: printZone.y * scale,
    w: printZone.w * scale,
    h: printZone.h * scale,
  };
  const center = { x: pz.x + pz.w / 2, y: pz.y + pz.h / 2 };
  const deleteButtonPosition = (() => {
    if (!selectedLayer || selectedIds.length !== 1 || !selectedLayer.visible) return null;
    const dimensions = getArtworkDimensions(selectedLayer, scale);
    const angle = (selectedLayer.transform.rotation * Math.PI) / 180;
    const localX = dimensions.width / 2 + 22;
    const localY = -dimensions.height / 2 - 22;
    const x = center.x + selectedLayer.transform.x * scale + localX * Math.cos(angle) - localY * Math.sin(angle) - 22;
    const y = center.y + selectedLayer.transform.y * scale + localX * Math.sin(angle) + localY * Math.cos(angle) - 22;
    return {
      left: Math.max(4, Math.min(width - 48, x)),
      top: Math.max(4, Math.min(height - 48, y)),
    };
  })();

  // Sync transformer with the selected layer(s).
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const stage = tr.getStage();
    if (!stage) return;
    if (selectedIds.length === 1) {
      const node = stage.findOne((node: Konva.Node) => node.getAttr("layerId") === selectedIds[0]);
      if (node) {
        tr.nodes([node]);
        tr.getLayer()?.batchDraw();
      }
    } else {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedIds, layers]);

  return (
    <div
      className="relative rounded-3xl overflow-hidden select-none"
      style={{
        width,
        height,
        background: "radial-gradient(ellipse at 50% 35%, #ffffff 0%, #f8f8f8 55%, #f0f0f0 100%)",
        border: "1px solid #e5e5e7",
        boxShadow: "0 6px 40px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)",
        isolation: "isolate",
      }}
    >
      {mockup}
      {layers.length === 0 && (
        <div
          className="absolute inset-x-0 bottom-3 z-10 flex justify-center pointer-events-none px-4"
          aria-live="polite"
        >
          <div className="max-w-[280px] rounded-full border border-orange-200/80 bg-white/88 px-4 py-2 text-center shadow-sm backdrop-blur-sm">
            <p className="text-xs font-bold text-gray-700">Upload artwork to preview your design</p>
          </div>
        </div>
      )}
      <Stage
        width={width}
        height={height}
        className="absolute inset-0"
        onMouseDown={(e: Konva.KonvaEventObject<MouseEvent>) => {
          const stage = e.target.getStage();
          const point = stage?.getPointerPosition();
          if (!stage || !point) return;
          const mapped = { x: Math.round((point.x - center.x) / scale), y: Math.round((point.y - center.y) / scale) };

          if (activeTool === "eyedrop") {
            try {
              const snapshot = stage.toCanvas({ pixelRatio: 1 });
              const sample = snapshot.getContext("2d")?.getImageData(Math.round(point.x), Math.round(point.y), 1, 1).data;
              const hex = sample ? rgbaToHex(sample[0], sample[1], sample[2], sample[3]) : null;
              if (hex) onPickColor?.(hex);
            } catch (error) {
              console.warn("[studio] Could not sample canvas colour", error);
            }
            setActiveTool("select");
            return;
          }

          if (activeTool === "draw") {
            drawingRef.current = true;
            onDrawStart?.(mapped);
            return;
          }

          if (activeTool !== "select") {
            onCanvasAction?.(mapped);
            setActiveTool("select");
            return;
          }

          if (e.target === stage) clearSelection();
        }}
        onMouseMove={(e: Konva.KonvaEventObject<MouseEvent>) => {
          if (activeTool !== "draw" || !drawingRef.current) return;
          const point = e.target.getStage()?.getPointerPosition();
          if (!point) return;
          onDrawMove?.({ x: Math.round((point.x - center.x) / scale), y: Math.round((point.y - center.y) / scale) });
        }}
        onMouseUp={() => {
          if (!drawingRef.current) return;
          drawingRef.current = false;
          onDrawEnd?.();
          setActiveTool("select");
        }}
        onTouchStart={(e: Konva.KonvaEventObject<TouchEvent>) => {
          const stage = e.target.getStage();
          const point = stage?.getPointerPosition();
          if (!stage || !point) return;
          const mapped = { x: Math.round((point.x - center.x) / scale), y: Math.round((point.y - center.y) / scale) };
          if (activeTool === "draw") {
            drawingRef.current = true;
            onDrawStart?.(mapped);
            return;
          }
          if (activeTool !== "select") {
            onCanvasAction?.(mapped);
            setActiveTool("select");
            return;
          }
          if (e.target === stage) clearSelection();
        }}
        onTouchMove={(e: Konva.KonvaEventObject<TouchEvent>) => {
          if (activeTool !== "draw" || !drawingRef.current) return;
          const point = e.target.getStage()?.getPointerPosition();
          if (!point) return;
          onDrawMove?.({ x: Math.round((point.x - center.x) / scale), y: Math.round((point.y - center.y) / scale) });
        }}
        onTouchEnd={() => {
          if (!drawingRef.current) return;
          drawingRef.current = false;
          onDrawEnd?.();
          setActiveTool("select");
        }}
      >
        <Layer>
          {img && <KonvaImage image={img} width={width} height={height} listening={false} />}
        </Layer>
        <Layer style={{ mixBlendMode: "source-over" }}>
          {layers.map((layer: LayerType) => (
            <DesignLayer
              key={layer.id}
              layer={layer}
              isSelected={selectedIds.includes(layer.id)}
              onSelect={() => selectLayer(layer.id)}
              onOpenImageTools={layer.type === "image" ? onOpenImageTools : undefined}
              stageScale={scale}
              printZoneCenter={center}
              printZoneSize={{ w: pz.w, h: pz.h }}
            />
          ))}
          <Transformer
            ref={trRef}
            rotateEnabled
            flipEnabled
            anchorSize={8}
            borderStroke="#E85D04"
            anchorStroke="#E85D04"
            anchorFill="#ffffff"
          />
        </Layer>
      </Stage>
      {overlay}
      {deleteButtonPosition && (
        <button
          type="button"
          aria-label={`Delete ${selectedLayer?.name || "selected artwork"}`}
          title="Delete selected artwork"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (selectedLayer) deleteLayer(selectedLayer.id);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              if (selectedLayer) deleteLayer(selectedLayer.id);
            }
          }}
          className="absolute z-30 flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-red-600 text-white shadow-[0_4px_14px_rgba(185,28,28,0.4)] transition hover:bg-red-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-200 active:scale-95"
          style={{
            left: deleteButtonPosition.left,
            top: deleteButtonPosition.top,
            touchAction: "manipulation",
          }}
        >
          <X className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
