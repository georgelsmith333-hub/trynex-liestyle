import { useRef, useEffect, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Transformer } from "react-konva";
import Konva from "konva";
import { useDesignStore, useSelectedLayer } from "@/hooks/useDesignStore";
import { DesignLayer } from "./DesignLayer";
import { Layer as LayerType, PrintZone } from "./types";
import { LiveCompositorPreview } from "./LiveCompositorPreview";
import type { ComposerLayer, UnifiedMockupSurface } from "../design-studio/composer";
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
  /** Shared compositor input for the live visual preview. */
  liveSurface?: UnifiedMockupSurface;
  liveGarmentColor?: string;
  liveLayers?: ComposerLayer[];
  liveCurvature?: number;
  liveFabricTexture?: boolean;
  liveEnabled?: boolean;
  /** Keep the legacy Konva artwork visible for local PSD staging only. */
  interactionOnly?: boolean;
  /** Print zone in the 1000×1000 coordinate space. CanvasArea maps it to the stage size. */
  printZone: PrintZone;
  /** Active product face; only this face may be selected or transformed. */
  activeFace?: string;
  /** View transform applied to the complete board, including the mockup preview. */
  zoom?: number;
  panX?: number;
  panY?: number;
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

function getClientPoint(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
  const source = event.evt as MouseEvent & {
    touches?: TouchList;
    changedTouches?: TouchList;
  };
  const touch = source.touches?.[0] ?? source.changedTouches?.[0];
  return {
    clientX: touch?.clientX ?? source.clientX,
    clientY: touch?.clientY ?? source.clientY,
  };
}

function getTouchPair(event: Konva.KonvaEventObject<TouchEvent>) {
  const touches = Array.from(event.evt.touches);
  if (touches.length < 2) return null;
  const [first, second] = touches;
  return {
    distance: Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY),
    angle: Math.atan2(second.clientY - first.clientY, second.clientX - first.clientX),
  };
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

export function CanvasArea({
  width,
  height,
  mockup,
  overlay,
  mockupImg,
  liveSurface,
  liveGarmentColor,
  liveLayers,
  liveCurvature,
  liveFabricTexture,
  liveEnabled = true,
  interactionOnly = false,
  printZone,
  activeFace = "front",
  zoom = 1,
  panX = 0,
  panY = 0,
  onCanvasAction,
  onDrawStart,
  onDrawMove,
  onDrawEnd,
  onPickColor,
  onOpenImageTools,
}: Props) {
  const trRef = useRef<Konva.Transformer>(null);
  const drawingRef = useRef(false);
  const pinchRef = useRef<{ distance: number; angle: number; scale: number; rotation: number } | null>(null);
  const {
    layers,
    selectedIds,
    activeTool,
    selectLayer,
    clearSelection,
    setActiveTool,
    deleteLayer,
    beginHistoryGroup,
    commit,
    updateLayer,
  } = useDesignStore();
  const selectedLayer = useSelectedLayer();
  const [img, setImg] = useState<HTMLImageElement | null>(mockupImg ?? null);
  const visibleLayers = layers.filter((layer) => (layer.face ?? "front") === activeFace);
  const viewRef = useRef<HTMLDivElement>(null);

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
    if (!selectedLayer || selectedIds.length !== 1 || (selectedLayer.face ?? "front") !== activeFace) return null;
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable
        || target?.tagName === "INPUT"
        || target?.tagName === "TEXTAREA"
        || target?.tagName === "SELECT"
      ) return;
      if (event.key === "Escape") {
        clearSelection();
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedLayer && (selectedLayer.face ?? "front") === activeFace) {
        event.preventDefault();
        deleteLayer(selectedLayer.id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeFace, clearSelection, deleteLayer, selectedLayer]);

  const getCanvasPoint = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const bounds = viewRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    const { clientX, clientY } = getClientPoint(event);
    return {
      x: (clientX - bounds.left) / Math.max(0.01, zoom),
      y: (clientY - bounds.top) / Math.max(0.01, zoom),
    };
  };

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
        touchAction: "none",
      }}
    >
      <div
        ref={viewRef}
        className="absolute inset-0"
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: "center center",
          width,
          height,
        }}
      >
        {mockup}
        {liveSurface && liveGarmentColor && liveLayers && (
          <LiveCompositorPreview
            width={width}
            height={height}
            surface={liveSurface}
            garmentColor={liveGarmentColor}
            layers={liveLayers}
            curvature={liveCurvature}
            fabricTexture={liveFabricTexture}
            enabled={liveEnabled}
          />
        )}
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
        style={{ touchAction: "none" }}
        onMouseDown={(e: Konva.KonvaEventObject<MouseEvent>) => {
          const stage = e.target.getStage();
          const point = getCanvasPoint(e);
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
          const point = getCanvasPoint(e);
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
          const pinch = getTouchPair(e);
          if (pinch && selectedLayer && selectedIds.length === 1 && !selectedLayer.locked && (selectedLayer.face ?? "front") === activeFace) {
            e.evt.preventDefault();
            beginHistoryGroup();
            pinchRef.current = {
              ...pinch,
              scale: selectedLayer.transform.scale,
              rotation: selectedLayer.transform.rotation,
            };
            return;
          }
          const point = getCanvasPoint(e);
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
          const pinch = getTouchPair(e);
          const start = pinchRef.current;
          if (pinch && start && selectedLayer) {
            e.evt.preventDefault();
            const nextScale = Math.max(0.05, Math.min(8, start.scale * (pinch.distance / Math.max(1, start.distance))));
            const nextRotation = start.rotation + ((pinch.angle - start.angle) * 180) / Math.PI;
            updateLayer(selectedLayer.id, {
              transform: {
                ...selectedLayer.transform,
                scale: nextScale,
                scaleX: nextScale,
                scaleY: nextScale,
                rotation: nextRotation,
              },
            }, { history: false });
            return;
          }
          if (activeTool !== "draw" || !drawingRef.current) return;
          const point = getCanvasPoint(e);
          if (!point) return;
          onDrawMove?.({ x: Math.round((point.x - center.x) / scale), y: Math.round((point.y - center.y) / scale) });
        }}
        onTouchEnd={() => {
          if (pinchRef.current) {
            pinchRef.current = null;
            commit();
            return;
          }
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
            {visibleLayers.map((layer: LayerType) => (
            <DesignLayer
              key={layer.id}
              layer={layer}
              isSelected={selectedIds.includes(layer.id)}
              onSelect={() => selectLayer(layer.id)}
              onOpenImageTools={layer.type === "image" ? onOpenImageTools : undefined}
              interactionOnly={interactionOnly}
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
        {selectedLayer && selectedIds.length === 1 && (selectedLayer.face ?? "front") === activeFace && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-20 border-2 border-orange-500 shadow-[0_0_0_1px_rgba(255,255,255,0.8)]"
            style={{
              left: center.x + selectedLayer.transform.x * scale,
              top: center.y + selectedLayer.transform.y * scale,
              width: getArtworkDimensions(selectedLayer, scale).width,
              height: getArtworkDimensions(selectedLayer, scale).height,
              transform: `translate(-50%, -50%) rotate(${selectedLayer.transform.rotation}deg)`,
              transformOrigin: "center center",
              borderStyle: selectedLayer.visible ? "solid" : "dashed",
            }}
          />
        )}
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
    </div>
  );
}
