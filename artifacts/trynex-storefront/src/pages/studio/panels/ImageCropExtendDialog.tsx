import { useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Crop, Expand, Loader2, X } from "lucide-react";
import type { ImageLayer } from "../types";

type Mode = "crop" | "extend";
type CropRect = { x: number; y: number; w: number; h: number };
type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

interface Props {
  layer: ImageLayer;
  initialMode: Mode;
  onApply: (dataUrl: string) => Promise<void> | void;
  onClose: () => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function readImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("This image could not be prepared for editing."));
    image.src = src;
  });
}

export function ImageCropExtendDialog({ layer, initialMode, onApply, onClose }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, w: 1, h: 1 });
  const [extensionPercent, setExtensionPercent] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    kind: "move" | "resize";
    handle?: Handle;
    startX: number;
    startY: number;
    startCrop: CropRect;
  } | null>(null);

  const getPoint = (event: React.PointerEvent) => {
    const bounds = previewRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0 || bounds.height === 0) return null;
    return {
      x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
      y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1),
    };
  };

  const startCropDrag = (event: React.PointerEvent, kind: "move" | "resize", handle?: Handle) => {
    if (mode !== "crop") return;
    const point = getPoint(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { kind, handle, startX: point.x, startY: point.y, startCrop: crop };
  };

  const moveCropDrag = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = getPoint(event);
    if (!point) return;
    const dx = point.x - drag.startX;
    const dy = point.y - drag.startY;
    const next = { ...drag.startCrop };

    if (drag.kind === "move") {
      next.x = clamp(drag.startCrop.x + dx, 0, 1 - next.w);
      next.y = clamp(drag.startCrop.y + dy, 0, 1 - next.h);
    } else {
      const handle = drag.handle;
      const right = drag.startCrop.x + drag.startCrop.w;
      const bottom = drag.startCrop.y + drag.startCrop.h;
      if (handle?.includes("w")) {
        next.x = clamp(drag.startCrop.x + dx, 0, right - 0.05);
        next.w = right - next.x;
      }
      if (handle?.includes("e")) {
        next.w = clamp(drag.startCrop.w + dx, 0.05, 1 - drag.startCrop.x);
      }
      if (handle?.includes("n")) {
        next.y = clamp(drag.startCrop.y + dy, 0, bottom - 0.05);
        next.h = bottom - next.y;
      }
      if (handle?.includes("s")) {
        next.h = clamp(drag.startCrop.h + dy, 0.05, 1 - drag.startCrop.y);
      }
    }
    setCrop(next);
  };

  const finishCropDrag = (event: React.PointerEvent) => {
    if (dragRef.current) {
      dragRef.current = null;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture may already have been released when the pointer left.
      }
    }
  };

  const applyCrop = async () => {
    setBusy(true);
    setError(null);
    try {
      const image = await readImage(layer.src);
      const sx = Math.round(crop.x * image.naturalWidth);
      const sy = Math.round(crop.y * image.naturalHeight);
      const sw = Math.max(1, Math.round(crop.w * image.naturalWidth));
      const sh = Math.max(1, Math.round(crop.h * image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser cannot crop the image.");
      context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
      await onApply(canvas.toDataURL("image/png"));
      onClose();
    } catch (reason) {
      setBusy(false);
      setError(reason instanceof Error ? reason.message : "The crop could not be applied. Your original image is unchanged.");
    }
  };

  const applyExtend = async () => {
    setBusy(true);
    setError(null);
    try {
      const image = await readImage(layer.src);
      const padding = Math.max(1, Math.round(Math.min(image.naturalWidth, image.naturalHeight) * extensionPercent / 100));
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth + padding * 2;
      canvas.height = image.naturalHeight + padding * 2;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser cannot extend the image.");
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, padding, padding);
      await onApply(canvas.toDataURL("image/png"));
      onClose();
    } catch (reason) {
      setBusy(false);
      setError(reason instanceof Error ? reason.message : "The canvas could not be extended. Your original image is unchanged.");
    }
  };

  const handles: Array<{ id: Handle; className: string }> = [
    { id: "nw", className: "-left-2 -top-2 cursor-nwse-resize" },
    { id: "n", className: "left-1/2 -top-2 -translate-x-1/2 cursor-ns-resize" },
    { id: "ne", className: "-right-2 -top-2 cursor-nesw-resize" },
    { id: "e", className: "-right-2 top-1/2 -translate-y-1/2 cursor-ew-resize" },
    { id: "se", className: "-bottom-2 -right-2 cursor-nwse-resize" },
    { id: "s", className: "-bottom-2 left-1/2 -translate-x-1/2 cursor-ns-resize" },
    { id: "sw", className: "-bottom-2 -left-2 cursor-nesw-resize" },
    { id: "w", className: "-left-2 top-1/2 -translate-y-1/2 cursor-ew-resize" },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="image-crop-extend-title">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-[#faf9f6] shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <div>
            <h2 id="image-crop-extend-title" className="text-sm font-black text-gray-900">Image tools</h2>
            <p className="mt-0.5 text-[11px] text-gray-500">Adjust the artwork before placing it on the product.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close image tools" className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-2 border-b border-gray-200 bg-white px-4 py-3">
          <button type="button" onClick={() => setMode("crop")} aria-pressed={mode === "crop"} className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black transition ${mode === "crop" ? "border-orange-400 bg-orange-50 text-orange-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
            <Crop className="h-4 w-4" /> Crop
          </button>
          <button type="button" onClick={() => setMode("extend")} aria-pressed={mode === "extend"} className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black transition ${mode === "extend" ? "border-orange-400 bg-orange-50 text-orange-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
            <Expand className="h-4 w-4" /> Extend
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          <div
            ref={previewRef}
            className="relative mx-auto w-full max-w-[460px] overflow-hidden rounded-2xl border border-gray-300 bg-[linear-gradient(45deg,#f1f1f1_25%,transparent_25%),linear-gradient(-45deg,#f1f1f1_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1f1f1_75%),linear-gradient(-45deg,transparent_75%,#f1f1f1_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0px]"
            style={{ aspectRatio: `${Math.max(1, layer.naturalW)} / ${Math.max(1, layer.naturalH)}` }}
            onPointerMove={moveCropDrag}
            onPointerUp={finishCropDrag}
            onPointerCancel={finishCropDrag}
          >
            <img src={layer.src} alt="Artwork being edited" className="absolute inset-0 h-full w-full object-contain" />
            {mode === "crop" ? (
              <div
                className="absolute border-2 border-orange-500 bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.42)]"
                style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
                onPointerDown={(event) => startCropDrag(event, "move")}
              >
                <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,transparent_33%,rgba(255,255,255,0.55)_33%,rgba(255,255,255,0.55)_33.5%,transparent_33.5%,transparent_66%,rgba(255,255,255,0.55)_66%,rgba(255,255,255,0.55)_66.5%,transparent_66.5%),linear-gradient(to_bottom,transparent_33%,rgba(255,255,255,0.55)_33%,rgba(255,255,255,0.55)_33.5%,transparent_33.5%,transparent_66%,rgba(255,255,255,0.55)_66%,rgba(255,255,255,0.55)_66.5%,transparent_66.5%)]" />
                {handles.map(({ id, className }) => (
                  <button
                    key={id}
                    type="button"
                    aria-label={`Resize crop ${id}`}
                    className={`absolute h-4 w-4 rounded-full border-2 border-white bg-orange-600 shadow ${className}`}
                    onPointerDown={(event) => startCropDrag(event, "resize", id)}
                  />
                ))}
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-bold text-white">Transparent padding preview</div>
              </div>
            )}
          </div>

          {mode === "crop" ? (
            <p className="mt-3 text-center text-[11px] leading-4 text-gray-500">Drag inside the frame to move it. Use the orange handles to crop away unwanted edges.</p>
          ) : (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-bold text-gray-600">Transparent padding on every side</p>
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 20, 30].map((value) => (
                  <button key={value} type="button" onClick={() => setExtensionPercent(value)} aria-pressed={extensionPercent === value} className={`min-h-11 rounded-xl border text-xs font-black transition ${extensionPercent === value ? "border-orange-400 bg-orange-50 text-orange-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>{value}%</button>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-center gap-3 text-gray-500" aria-hidden="true">
                <ArrowLeft className="h-4 w-4" /><ArrowUp className="h-4 w-4" /><ArrowDown className="h-4 w-4" /><ArrowRight className="h-4 w-4" />
              </div>
              <p className="mt-2 text-center text-[11px] leading-4 text-gray-500">Extend keeps your artwork unchanged and adds transparent room around it for easier placement.</p>
            </div>
          )}
          {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-[11px] font-semibold leading-4 text-red-700">{error}</p>}
        </div>

        <div className="flex gap-2 border-t border-gray-200 bg-white p-4">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-xs font-black text-gray-600 transition hover:bg-gray-50 disabled:opacity-60">Cancel</button>
          <button type="button" onClick={() => void (mode === "crop" ? applyCrop() : applyExtend())} disabled={busy} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 px-3 text-xs font-black text-white shadow-md transition hover:shadow-lg disabled:cursor-wait disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {busy ? "Applying…" : mode === "crop" ? "Apply crop" : `Add ${extensionPercent}% padding`}
          </button>
        </div>
      </div>
    </div>
  );
}