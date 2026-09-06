import { useRef, useEffect, useState } from "react";
import { Image as KonvaImage, Text as KonvaText, Rect, Circle, Star, Line, RegularPolygon } from "react-konva";
import Konva from "konva";
import type { Layer, ImageLayer, TextLayer, ShapeLayer } from "./types";
import { useDesignStore } from "@/hooks/useDesignStore";
import { getGradientFill, getPatternFill } from "./gradient-utils";

interface Props {
  layer: Layer;
  isSelected: boolean;
  onSelect: () => void;
  onOpenImageTools?: () => void;
  stageScale?: number;
  printZoneCenter?: { x: number; y: number };
  printZoneSize?: { w: number; h: number };
}

export function DesignLayer({
  layer,
  isSelected,
  onSelect,
  onOpenImageTools,
  stageScale = 1,
  printZoneCenter = { x: 300, y: 300 },
  printZoneSize,
}: Props) {
  const shapeRef = useRef<Konva.Shape>(null);
  const updateLayer = useDesignStore((s) => s.updateLayer);
  const beginHistoryGroup = useDesignStore((s) => s.beginHistoryGroup);
  const commit = useDesignStore((s) => s.commit);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (layer.type === "image") {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => setImage(img);
      img.src = (layer as ImageLayer).src;
    }
  }, [layer.type, layer.type === "image" ? (layer as ImageLayer).src : null]);

  const cx = printZoneCenter.x + layer.transform.x * stageScale;
  const cy = printZoneCenter.y + layer.transform.y * stageScale;
  const scaleX = Math.max(0.01, Math.abs(layer.transform.scaleX ?? layer.transform.scale)) * stageScale;
  const scaleY = Math.max(0.01, Math.abs(layer.transform.scaleY ?? layer.transform.scale)) * stageScale;
  const baseScale = layer.transform.scale * stageScale;

  const dragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    updateLayer(layer.id, {
      transform: {
        ...layer.transform,
        x: (node.x() - printZoneCenter.x) / stageScale,
        y: (node.y() - printZoneCenter.y) / stageScale,
      },
    }, { history: false });
    commit();
  };

  const startGesture = () => beginHistoryGroup();

  const editText = () => {
    if (layer.type !== "text" || layer.locked) return;
    const current = (layer as TextLayer).text;
    const next = window.prompt("Edit text", current);
    if (next !== null && next !== current) {
      updateLayer(layer.id, { text: next });
      onSelect();
    }
  };

  const transformEnd = (e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    updateLayer(layer.id, {
      transform: {
        ...layer.transform,
        x: (node.x() - printZoneCenter.x) / stageScale,
        y: (node.y() - printZoneCenter.y) / stageScale,
        rotation: node.rotation(),
        scale: Math.max(0.01, Math.min(Math.abs(node.scaleX()), Math.abs(node.scaleY())) / stageScale),
        scaleX: Math.max(0.01, Math.abs(node.scaleX()) / stageScale),
        scaleY: Math.max(0.01, Math.abs(node.scaleY()) / stageScale),
      },
    }, { history: false });
    commit();
  };

  const common = {
    layerId: layer.id,
    rotation: layer.transform.rotation,
    opacity: layer.transform.opacity,
    draggable: !layer.locked,
    visible: layer.visible,
    onClick: onSelect,
    onTap: onSelect,
    onDragStart: startGesture,
    onDragEnd: dragEnd,
    onTransformStart: startGesture,
    onTransformEnd: transformEnd,
  };

  if (layer.type === "image" && image) {
    const imgLayer = layer as ImageLayer;
    return (
      <>
        <KonvaImage
          ref={shapeRef as any}
          image={image}
          width={imgLayer.naturalW}
          height={imgLayer.naturalH}
          x={cx}
          y={cy}
           scaleX={scaleX * (imgLayer.flipH ? -1 : 1)}
           scaleY={scaleY * (imgLayer.flipV ? -1 : 1)}
          offsetX={imgLayer.naturalW / 2}
          offsetY={imgLayer.naturalH / 2}
           layerId={layer.id}
          rotation={layer.transform.rotation}
          opacity={layer.transform.opacity}
          draggable={!layer.locked}
          visible={layer.visible}
          onClick={onSelect}
          onTap={onSelect}
           onDragStart={startGesture}
          onDblClick={() => {
            onSelect();
            onOpenImageTools?.();
          }}
          onDblTap={() => {
            onSelect();
            onOpenImageTools?.();
          }}
          onDragEnd={dragEnd}
           onTransformStart={startGesture}
          onTransformEnd={transformEnd}
          filters={[
            Konva.Filters.Brighten,
            Konva.Filters.Contrast,
            Konva.Filters.HSL,
          ]}
          brightness={(imgLayer.brightness ?? 100) / 100 - 1}
          contrast={(imgLayer.contrast ?? 100) / 100}
          saturation={(imgLayer.saturation ?? 100) / 100}
        />
      </>
    );
  }

  if (layer.type === "text") {
    const textLayer = layer as TextLayer;
    const fill: string | CanvasGradient = textLayer.gradient
      ? getGradientFill(textLayer.gradient, printZoneCenter, stageScale)
      : textLayer.color;
    return (
      <>
        <KonvaText
          ref={shapeRef as any}
          text={textLayer.text}
          fontFamily={textLayer.fontFamily}
          fontSize={textLayer.fontSize * baseScale}
          fontStyle={textLayer.fontStyle}
          fontWeight={textLayer.fontWeight}
          fill={fill}
          align={textLayer.textAlign || "center"}
          stroke={textLayer.strokeColor}
          strokeWidth={(textLayer.strokeWidth || 0) * baseScale}
          shadowColor={textLayer.shadowColor}
          shadowBlur={textLayer.shadowBlur || 0}
          shadowOffsetX={textLayer.shadowOffsetX || 0}
          shadowOffsetY={textLayer.shadowOffsetY || 0}
          letterSpacing={(textLayer.letterSpacing || 0) * baseScale}
          x={cx}
          y={cy}
           layerId={layer.id}
           scaleX={scaleX / Math.max(0.01, baseScale)}
           scaleY={scaleY / Math.max(0.01, baseScale)}
          rotation={layer.transform.rotation}
          opacity={layer.transform.opacity}
          draggable={!layer.locked}
          visible={layer.visible}
          onClick={onSelect}
          onTap={onSelect}
           onDragStart={startGesture}
          onDblClick={editText}
          onDblTap={editText}
          onDragEnd={dragEnd}
           onTransformStart={startGesture}
          onTransformEnd={transformEnd}
        />
      </>
    );
  }

  if (layer.type === "shape") {
    const shape = layer as ShapeLayer;
    const fill: string | CanvasGradient = typeof shape.fill === "string"
      ? shape.fill
      : shape.fill.type === "pattern"
      ? (getPatternFill(shape.fill, stageScale) as string | CanvasGradient)
      : getGradientFill(shape.fill, printZoneCenter, stageScale);
    const stroke = shape.strokeColor || "#111111";
    const strokeWidth = (shape.strokeWidth || 0) * baseScale;
    const w = shape.width * scaleX;
    const h = shape.height * scaleY;

    switch (shape.shapeType) {
      case "line": {
        const points = (shape.points && shape.points.length >= 4 ? shape.points : [-shape.width / 2, 0, shape.width / 2, 0]).map((point) => point * baseScale);
        const lineColor = shape.strokeColor || (typeof shape.fill === "string" ? shape.fill : "#111111");
        return (
          <>
            <Line
              ref={shapeRef as any}
              points={points}
              x={cx}
              y={cy}
              stroke={lineColor}
              strokeWidth={Math.max(4, strokeWidth)}
              lineCap="round"
              lineJoin="round"
              hitStrokeWidth={Math.max(18, 26 * baseScale)}
               layerId={layer.id}
              rotation={layer.transform.rotation}
              opacity={layer.transform.opacity}
              draggable={!layer.locked}
              visible={layer.visible}
              onClick={onSelect}
              onTap={onSelect}
               onDragStart={startGesture}
              onDragEnd={dragEnd}
               onTransformStart={startGesture}
              onTransformEnd={transformEnd}
            />
          </>
        );
      }
      case "rect":
        return (
          <>
             <Rect ref={shapeRef as any} width={w} height={h} x={cx} y={cy} offsetX={w / 2} offsetY={h / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...common} />
          </>
        );
      case "circle":
        return (
          <>
             <Circle ref={shapeRef as any} radius={w / 2} x={cx} y={cy} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...common} />
          </>
        );
      case "star":
        return (
          <>
             <Star ref={shapeRef as any} numPoints={5} innerRadius={w / 4} outerRadius={w / 2} x={cx} y={cy} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...common} />
          </>
        );
      case "polygon":
        return (
          <>
             <RegularPolygon ref={shapeRef as any} sides={shape.sides || 6} radius={w / 2} x={cx} y={cy} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...common} />
          </>
        );
      case "arrow":
        return (
          <>
            <Line
              ref={shapeRef as any}
              points={[0, 0, w, 0, w - 10 * baseScale, -10 * baseScale, w, 0, w - 10 * baseScale, 10 * baseScale]}
              stroke={fill}
              strokeWidth={8 * baseScale}
              lineCap="round"
              lineJoin="round"
              x={cx}
              y={cy}
               layerId={layer.id}
              rotation={layer.transform.rotation}
              opacity={layer.transform.opacity}
              draggable={!layer.locked}
              visible={layer.visible}
              onClick={onSelect}
              onTap={onSelect}
               onDragStart={startGesture}
              onDragEnd={dragEnd}
               onTransformStart={startGesture}
              onTransformEnd={transformEnd}
            />
          </>
        );
      default:
        return null;
    }
  }

  return null;
}
