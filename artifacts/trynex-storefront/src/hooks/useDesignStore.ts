import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Draft } from "immer";
import {
  type Layer,
  type Face,
  type MugMode,
  type ToolType,
  type RightTab,
  type SaveStatus,
  type DesignProduct,
  type LinkedStoreProduct,
  DRAFT_VERSION,
  type DraftPayload,
} from "@/pages/studio/types";
import { PRODUCTS } from "@/pages/design-studio/mockups";

export interface HistoryFrame {
  layers: Layer[];
  productId: string;
  color: { name: string; hex: string };
  activeFace: Face;
  mugMode: MugMode;
  selectedIds: string[];
}

export interface DesignStoreState {
  selectedProduct: DesignProduct;
  selectedColor: { name: string; hex: string };
  activeFace: Face;
  mugMode: MugMode;
  selectedSize: string;
  quantity: number;

  layers: Layer[];
  selectedIds: string[];
  history: HistoryFrame[];
  future: HistoryFrame[];
  historyGroup: HistoryFrame | null;

  activeTool: ToolType;
  zoom: number;
  panX: number;
  panY: number;
  showPrintZone: boolean;
  fabricTexture: boolean;
  snapGuides: { v: boolean; h: boolean };

  activeTab: RightTab;
  showProductPicker: boolean;
  productSearch: string;
  productPickerCategory: "all" | DesignProduct["category"];
  mobileToolOpen: boolean;
  mobileTab: "product" | "color" | "edit";
  show3D: boolean;
  isMobile: boolean;

  linkedStoreProduct: LinkedStoreProduct | null;

  saveStatus: SaveStatus;
  hasDraft: boolean;
  legacyDraftFound: { version: number } | null;
}

export interface DesignStoreActions {
  setProduct: (product: DesignProduct) => void;
  setColor: (color: { name: string; hex: string }) => void;
  setFace: (face: Face) => void;
  setMugMode: (mode: MugMode) => void;
  setMugView: (mode: MugMode) => void;
  switchProduct: (
    product: DesignProduct,
    color: { name: string; hex: string },
    transforms: Array<{ id: string; transform: Layer["transform"] }>,
    mugMode: MugMode,
  ) => void;
  setSize: (size: string) => void;
  setQuantity: (qty: number | ((prev: number) => number)) => void;

  addLayer: (layer: Layer) => void;
  updateLayer: (
    id: string,
    patch: Partial<Layer> | ((layer: Layer) => Layer),
    options?: { history?: boolean },
  ) => void;
  deleteLayer: (id: string) => void;
  moveLayer: (id: string, direction: "up" | "down") => void;
  reorderLayers: (layers: Layer[]) => void;
  setLayerVisibility: (id: string, visible: boolean) => void;
  setLayerLock: (id: string, locked: boolean) => void;
  selectLayer: (id: string | null, multi?: boolean) => void;
  clearSelection: () => void;
  setLayers: (layers: Layer[]) => void;
  applyDraft: (draft: DraftPayload) => void;

  undo: () => void;
  redo: () => void;
  beginHistoryGroup: () => void;
  commit: () => void;

  setActiveTool: (tool: ToolType) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  resetView: () => void;
  setShowPrintZone: (show: boolean) => void;
  setFabricTexture: (enabled: boolean) => void;

  setActiveTab: (tab: RightTab) => void;
  setShowProductPicker: (show: boolean) => void;
  setProductSearch: (q: string) => void;
  setProductPickerCategory: (cat: "all" | DesignProduct["category"]) => void;
  setMobileToolOpen: (open: boolean) => void;
  setMobileTab: (tab: "product" | "color" | "edit") => void;
  setShow3D: (show: boolean) => void;
  setIsMobile: (mobile: boolean) => void;

  setLinkedStoreProduct: (product: LinkedStoreProduct | null) => void;

  setSaveStatus: (status: SaveStatus) => void;
  setHasDraft: (has: boolean) => void;
  setLegacyDraftFound: (draft: { version: number } | null) => void;
}

export type DesignStore = DesignStoreState & DesignStoreActions;

const initialProduct = PRODUCTS[0];
const initialColor = initialProduct.colors[0];

const initialState: DesignStoreState = {
  selectedProduct: initialProduct,
  selectedColor: initialColor,
  activeFace: "front",
  mugMode: "side1",
  selectedSize: "M",
  quantity: 1,

  layers: [],
  selectedIds: [],
  history: [],
  future: [],
  historyGroup: null,

  activeTool: "select",
  zoom: 1,
  panX: 0,
  panY: 0,
  // Guides are an audit tool, not part of the default customer editing experience.
  // Users can enable them explicitly from the studio controls when checking safe areas.
  showPrintZone: false,
  // Texture is an optional proofing effect; it must not add grain or haze to
  // a new customer design before the user explicitly enables it.
  fabricTexture: false,
  snapGuides: { v: false, h: false },

  activeTab: "upload",
  showProductPicker: false,
  productSearch: "",
  productPickerCategory: "all",
  mobileToolOpen: false,
  mobileTab: "product",
  show3D: false,
  isMobile: false,

  linkedStoreProduct: null,

  saveStatus: "idle",
  hasDraft: false,
  legacyDraftFound: null,
};

type DS = Draft<DesignStoreState>;

function makeHistoryFrame(state: DS): HistoryFrame {
  return {
    layers: JSON.parse(JSON.stringify(state.layers)) as Layer[],
    productId: state.selectedProduct.id,
    color: { ...state.selectedColor },
    activeFace: state.activeFace,
    mugMode: state.mugMode,
    selectedIds: [...state.selectedIds],
  };
}

function historyFrameMatchesState(frame: HistoryFrame, state: DS) {
  return (
    frame.productId === state.selectedProduct.id
    && frame.color.hex.toLowerCase() === state.selectedColor.hex.toLowerCase()
    && frame.activeFace === state.activeFace
    && frame.mugMode === state.mugMode
    && JSON.stringify(frame.layers) === JSON.stringify(state.layers)
  );
}

function captureHistory(state: DS) {
  state.history.push(makeHistoryFrame(state));
  if (state.history.length > 50) state.history.shift();
  state.future = [];
}

export const useDesignStore = create<DesignStore>()(
  immer((set, get) => ({
    ...initialState,

    setProduct: (product) => {
      set((state: DS) => {
        if (state.selectedProduct.id !== product.id) captureHistory(state);
        state.selectedProduct = product;
        state.selectedColor = product.colors.find((c: { hex: string; name: string }) => c.hex === state.selectedColor.hex) ?? product.colors[0];
        if (!["mug", "tshirt", "longsleeve", "hoodie"].includes(product.category)) {
          state.activeFace = "front";
        }
      });
    },
    setColor: (color) => {
      set((state: DS) => {
        if (state.selectedColor.hex.toLowerCase() !== color.hex.toLowerCase()) captureHistory(state);
        state.selectedColor = color;
      });
    },
    setFace: (face) => {
      set((state: DS) => {
        if (state.activeFace !== face) captureHistory(state);
        state.activeFace = face;
      });
    },
    setMugMode: (mode) => {
      set((state: DS) => {
        if (state.mugMode !== mode) captureHistory(state);
        state.mugMode = mode;
      });
    },
    setMugView: (mode) => {
      set((state: DS) => {
        const nextFace = mode === "side2" ? "back" : "front";
        if (state.mugMode !== mode || state.activeFace !== nextFace) captureHistory(state);
        state.mugMode = mode;
        state.activeFace = nextFace;
      });
    },
    switchProduct: (product, color, transforms, mugMode) => {
      set((state: DS) => {
        const nextFace = product.category === "mug" && mugMode === "side2" ? "back" : "front";
        const changed = state.selectedProduct.id !== product.id
          || state.selectedColor.hex.toLowerCase() !== color.hex.toLowerCase()
          || state.activeFace !== nextFace
          || state.mugMode !== (product.category === "mug" ? mugMode : "side1")
          || transforms.some(({ id, transform }) => {
            const current = state.layers.find((layer: Layer) => layer.id === id);
            return current && JSON.stringify(current.transform) !== JSON.stringify(transform);
          });
        if (!changed) return;
        captureHistory(state);
        state.selectedProduct = product;
        state.selectedColor = color;
        state.activeFace = nextFace;
        state.mugMode = product.category === "mug" ? mugMode : "side1";
        for (const { id, transform } of transforms) {
          const layer = state.layers.find((item: Layer) => item.id === id);
          if (layer) layer.transform = transform;
        }
      });
    },
    setSize: (size) => {
      set((state: DS) => {
        state.selectedSize = size;
      });
    },
    setQuantity: (qty) => {
      set((state: DS) => {
        state.quantity = typeof qty === "function" ? qty(state.quantity) : qty;
      });
    },

    addLayer: (layer) => {
      set((state: DS) => {
        captureHistory(state);
        state.layers.push(layer);
      });
    },
    updateLayer: (id, patch, options) => {
      set((state: DS) => {
        const idx = state.layers.findIndex((l: Layer) => l.id === id);
        if (idx === -1) return;
        const next = typeof patch === "function" ? patch(state.layers[idx]) : { ...state.layers[idx], ...patch };
        if (JSON.stringify(next) === JSON.stringify(state.layers[idx])) return;
        if (options?.history !== false && !state.historyGroup) captureHistory(state);
        state.layers[idx] = next as Layer;
      });
    },
    deleteLayer: (id) => {
      set((state: DS) => {
        if (!state.layers.some((layer: Layer) => layer.id === id)) return;
        captureHistory(state);
        state.layers = state.layers.filter((l: Layer) => l.id !== id);
        state.selectedIds = state.selectedIds.filter((sid: string) => sid !== id);
      });
    },
    moveLayer: (id, direction) => {
      set((state: DS) => {
        const idx = state.layers.findIndex((l: Layer) => l.id === id);
        if (idx === -1) return;
        const target = direction === "up" ? idx + 1 : idx - 1;
        if (target < 0 || target >= state.layers.length) return;
        captureHistory(state);
        const temp = state.layers[idx];
        state.layers[idx] = state.layers[target];
        state.layers[target] = temp;
      });
    },
    reorderLayers: (layers) => {
      set((state: DS) => {
        captureHistory(state);
        state.layers = layers;
      });
    },
    setLayerVisibility: (id, visible) => {
      set((state: DS) => {
        const l = state.layers.find((x: Layer) => x.id === id);
        if (l && l.visible !== visible) {
          captureHistory(state);
          l.visible = visible;
        }
      });
    },
    setLayerLock: (id, locked) => {
      set((state: DS) => {
        const l = state.layers.find((x: Layer) => x.id === id);
        if (l && l.locked !== locked) {
          captureHistory(state);
          l.locked = locked;
        }
      });
    },
    selectLayer: (id, multi) => {
      set((state: DS) => {
        if (!id) {
          state.selectedIds = [];
          return;
        }
        if (multi) {
          if (state.selectedIds.includes(id)) {
            state.selectedIds = state.selectedIds.filter((sid: string) => sid !== id);
          } else {
            state.selectedIds.push(id);
          }
        } else {
          state.selectedIds = [id];
        }
      });
    },
    clearSelection: () => {
      set((state: DS) => {
        state.selectedIds = [];
      });
    },
    setLayers: (layers) => {
      set((state: DS) => {
        state.layers = layers;
      });
    },
    applyDraft: (draft) => {
      set((state: DS) => {
        if (draft.version !== DRAFT_VERSION) {
          state.legacyDraftFound = { version: draft.version };
          return;
        }
        state.layers = draft.layers ?? [];
        if (draft.color) state.selectedColor = draft.color;
        if (draft.size) state.selectedSize = draft.size;
        if (draft.mugMode) state.mugMode = draft.mugMode as MugMode;
        if (draft.linkedStoreProductId && draft.linkedStoreProductName && draft.linkedStoreProductPrice) {
          state.linkedStoreProduct = {
            id: draft.linkedStoreProductId,
            name: draft.linkedStoreProductName,
            price: draft.linkedStoreProductPrice,
          };
        }
      });
    },

    beginHistoryGroup: () => {
      set((state: DS) => {
        if (state.historyGroup) return;
        state.historyGroup = makeHistoryFrame(state);
        state.future = [];
      });
    },
    // Finish a gesture transaction. Updates made while the group was open are
    // represented by one pre-gesture frame, regardless of pointer frequency.
    commit: () => {
      set((state: DS) => {
        const frame = state.historyGroup;
        if (!frame) return;
        state.historyGroup = null;
        if (historyFrameMatchesState(frame, state)) return;
        state.history.push(frame);
        if (state.history.length > 50) state.history.shift();
      });
    },
    undo: () => {
      set((state: DS) => {
        state.historyGroup = null;
        if (state.history.length === 0) return;
        const frame = state.history.pop()!;
        state.future.push(makeHistoryFrame(state));
        state.layers = frame.layers;
        state.selectedProduct = PRODUCTS.find((p: DesignProduct) => p.id === frame.productId) ?? state.selectedProduct;
        state.selectedColor = frame.color;
        state.activeFace = frame.activeFace;
        state.mugMode = frame.mugMode;
        state.selectedIds = frame.selectedIds;
      });
    },
    redo: () => {
      set((state: DS) => {
        state.historyGroup = null;
        if (state.future.length === 0) return;
        const frame = state.future.pop()!;
        state.history.push(makeHistoryFrame(state));
        state.layers = frame.layers;
        state.selectedProduct = PRODUCTS.find((p: DesignProduct) => p.id === frame.productId) ?? state.selectedProduct;
        state.selectedColor = frame.color;
        state.activeFace = frame.activeFace;
        state.mugMode = frame.mugMode;
        state.selectedIds = frame.selectedIds;
      });
    },

    setActiveTool: (tool) => {
      set((state: DS) => {
        state.activeTool = tool;
      });
    },
    setZoom: (zoom) => {
      set((state: DS) => {
        state.zoom = Math.max(0.25, Math.min(4, zoom));
      });
    },
    setPan: (x, y) => {
      set((state: DS) => {
        state.panX = x;
        state.panY = y;
      });
    },
    resetView: () => {
      set((state: DS) => {
        state.zoom = 1;
        state.panX = 0;
        state.panY = 0;
      });
    },
    setShowPrintZone: (show) => {
      set((state: DS) => {
        state.showPrintZone = show;
      });
    },
    setFabricTexture: (enabled) => {
      set((state: DS) => {
        state.fabricTexture = enabled;
      });
    },

    setActiveTab: (tab) => {
      set((state: DS) => {
        state.activeTab = tab;
      });
    },
    setShowProductPicker: (show) => {
      set((state: DS) => {
        state.showProductPicker = show;
        if (show) {
          state.productSearch = "";
          state.productPickerCategory = "all";
        }
      });
    },
    setProductSearch: (q) => {
      set((state: DS) => {
        state.productSearch = q;
      });
    },
    setProductPickerCategory: (cat) => {
      set((state: DS) => {
        state.productPickerCategory = cat;
      });
    },
    setMobileToolOpen: (open) => {
      set((state: DS) => {
        state.mobileToolOpen = open;
      });
    },
    setMobileTab: (tab) => {
      set((state: DS) => {
        state.mobileTab = tab;
      });
    },
    setShow3D: (show) => {
      set((state: DS) => {
        state.show3D = show;
      });
    },
    setIsMobile: (mobile) => {
      set((state: DS) => {
        state.isMobile = mobile;
        if (mobile) state.showPrintZone = false;
      });
    },

    setLinkedStoreProduct: (product) => {
      set((state: DS) => {
        state.linkedStoreProduct = product;
      });
    },

    setSaveStatus: (status) => {
      set((state: DS) => {
        state.saveStatus = status;
      });
    },
    setHasDraft: (has) => {
      set((state: DS) => {
        state.hasDraft = has;
      });
    },
    setLegacyDraftFound: (draft) => {
      set((state: DS) => {
        state.legacyDraftFound = draft;
      });
    },
  }))
);

/* Computed selectors */
export function useCurrentFace(): Face {
  const isMug = useDesignStore((s) => s.selectedProduct.category === "mug");
  const mugMode = useDesignStore((s) => s.mugMode);
  const activeFace = useDesignStore((s) => s.activeFace);
  return isMug ? (mugMode === "side1" ? "front" : "back") : activeFace;
}

export function useCurrentFaceLayers(): Layer[] {
  const face = useCurrentFace();
  return useDesignStore((s) => s.layers.filter((l: Layer) => (l.face ?? "front") === face));
}

export function useSupportsBack(): boolean {
  return useDesignStore((s) => ["tshirt", "longsleeve", "hoodie", "mug"].includes(s.selectedProduct.category));
}

export function useIsMugProduct(): boolean {
  return useDesignStore((s) => s.selectedProduct.category === "mug");
}

export function useIsWrapMode(): boolean {
  const isMug = useIsMugProduct();
  const hasFront = useDesignStore((s) => s.layers.some((l: Layer) => (l.face ?? "front") === "front"));
  const hasBack = useDesignStore((s) => s.layers.some((l: Layer) => (l.face ?? "front") === "back"));
  return isMug && hasFront && hasBack;
}

export function useCanvasZoomed(): boolean {
  return useDesignStore((s) => s.zoom !== 1 || s.panX !== 0 || s.panY !== 0);
}

export function useSelectedLayer(): Layer | undefined {
  const selectedIds = useDesignStore((s) => s.selectedIds);
  const layers = useDesignStore((s) => s.layers);
  if (selectedIds.length !== 1) return undefined;
  return layers.find((l: Layer) => l.id === selectedIds[0]);
}

export function useCanUndo(): boolean {
  return useDesignStore((s) => s.history.length > 0);
}

export function useCanRedo(): boolean {
  return useDesignStore((s) => s.future.length > 0);
}
