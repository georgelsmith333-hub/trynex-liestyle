import { Slider } from "@/components/ui/slider";
import { Crop, Expand, FlipHorizontal, FlipVertical, Sun, Contrast, Droplets, Eraser, Maximize2, Loader2, Wand2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useDesignStore, useSelectedLayer } from "@/hooks/useDesignStore";
import { ImageCropExtendDialog } from "./ImageCropExtendDialog";

type ImageAction = "remove-bg" | "upscale" | "auto-fix" | null;

interface ImagePanelProps {
  onRemoveBackground?: () => void;
  onUpscale?: () => void;
  onAutoFix?: () => void;
  onOpenAiReference?: () => void;
  onApplyImage?: (dataUrl: string) => Promise<void> | void;
  busyAction?: ImageAction;
}

export function ImagePanel({ onRemoveBackground, onUpscale, onAutoFix, onOpenAiReference, onApplyImage, busyAction = null }: ImagePanelProps) {
  const layer = useSelectedLayer();
  const updateLayer = useDesignStore((s) => s.updateLayer);
  const [cropExtendMode, setCropExtendMode] = useState<"crop" | "extend" | null>(null);

  if (!layer || layer.type !== "image") {
    return <div className="p-4 text-[11px] text-gray-400">Select an image layer to adjust.</div>;
  }

  const set = (key: keyof typeof layer, value: number) => updateLayer(layer.id, { [key]: value } as Partial<typeof layer>);
  const busy = busyAction !== null;

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Quick image tools</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onRemoveBackground}
            disabled={busy || !onRemoveBackground}
            className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-2 text-[10px] font-black text-emerald-700 transition hover:bg-emerald-100 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
          >
            {busyAction === "remove-bg" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
            {busyAction === "remove-bg" ? "Removing…" : "Remove background"}
          </button>
          <button
            type="button"
            onClick={onUpscale}
            disabled={busy || !onUpscale}
            className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-violet-200 bg-violet-50 px-2 py-2 text-[10px] font-black text-violet-700 transition hover:bg-violet-100 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
          >
            {busyAction === "upscale" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Maximize2 className="h-4 w-4" />}
            {busyAction === "upscale" ? "Preparing…" : "HD upscale"}
          </button>
          <button
            type="button"
            onClick={onAutoFix}
            disabled={busy || !onAutoFix}
            className="col-span-2 flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-2 py-2 text-[10px] font-black text-orange-700 transition hover:bg-orange-100 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
          >
            {busyAction === "auto-fix" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busyAction === "auto-fix" ? "Improving…" : "Auto-fix image"}
          </button>
          <button
            type="button"
            onClick={onOpenAiReference}
            disabled={busy || !onOpenAiReference}
            className="col-span-2 flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-2 py-2 text-[10px] font-black text-violet-700 transition hover:bg-violet-100 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
          >
            <Wand2 className="h-3.5 w-3.5" /> Refine this image with AI
          </button>
        </div>
        <p className="mt-2 text-[10px] leading-4 text-gray-400">Image changes stay visible on the product preview and export. AI reference edits require your approval before becoming a layer.</p>
      </div>

      <div className="border-t border-gray-100 pt-3">
        <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Crop & extend</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCropExtendMode("crop")}
            disabled={!onApplyImage}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-2 py-2 text-[10px] font-black text-orange-700 transition hover:bg-orange-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Crop className="h-4 w-4" /> Crop image
          </button>
          <button
            type="button"
            onClick={() => setCropExtendMode("extend")}
            disabled={!onApplyImage}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-2 py-2 text-[10px] font-black text-blue-700 transition hover:bg-blue-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Expand className="h-4 w-4" /> Extend canvas
          </button>
        </div>
        <p className="mt-2 text-[10px] leading-4 text-gray-400">Use the frame handles to remove edges, or add transparent room around the artwork without changing its content.</p>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold text-gray-500">
          <span className="flex items-center gap-1"><Sun className="h-3 w-3" /> Brightness</span>
          <span>{layer.brightness ?? 100}%</span>
        </div>
        <Slider value={[layer.brightness ?? 100]} min={0} max={200} step={1} onValueChange={([v]) => set("brightness", v)} />
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold text-gray-500">
          <span className="flex items-center gap-1"><Contrast className="h-3 w-3" /> Contrast</span>
          <span>{layer.contrast ?? 100}%</span>
        </div>
        <Slider value={[layer.contrast ?? 100]} min={0} max={200} step={1} onValueChange={([v]) => set("contrast", v)} />
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold text-gray-500">
          <span className="flex items-center gap-1"><Droplets className="h-3 w-3" /> Saturation</span>
          <span>{layer.saturation ?? 100}%</span>
        </div>
        <Slider value={[layer.saturation ?? 100]} min={0} max={200} step={1} onValueChange={([v]) => set("saturation", v)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => updateLayer(layer.id, { flipH: !layer.flipH })} aria-label="Flip horizontally" aria-pressed={!!layer.flipH} className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[10px] font-bold transition-colors active:scale-[0.98] ${layer.flipH ? "border-orange-300 bg-orange-50 text-orange-600" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"}`}><FlipHorizontal className="h-3.5 w-3.5" /><span>{layer.flipH ? "Horizontal on" : "Flip horizontal"}</span></button>
        <button type="button" onClick={() => updateLayer(layer.id, { flipV: !layer.flipV })} aria-label="Flip vertically" aria-pressed={!!layer.flipV} className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[10px] font-bold transition-colors active:scale-[0.98] ${layer.flipV ? "border-orange-300 bg-orange-50 text-orange-600" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"}`}><FlipVertical className="h-3.5 w-3.5" /><span>{layer.flipV ? "Vertical on" : "Flip vertical"}</span></button>
      </div>
      {cropExtendMode && onApplyImage && (
        <ImageCropExtendDialog
          layer={layer}
          initialMode={cropExtendMode}
          onApply={onApplyImage}
          onClose={() => setCropExtendMode(null)}
        />
      )}
    </div>
  );
}
