import { beforeEach, describe, expect, it } from "vitest";
import { useDesignStore } from "./useDesignStore";
import { PRODUCTS } from "@/pages/design-studio/mockups";

const imageLayer = {
  id: "layer-1",
  name: "Test artwork",
  type: "image" as const,
  visible: true,
  locked: false,
  face: "front" as const,
  transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
  src: "data:image/png;base64,iVBORw0KGgo=",
  naturalW: 512,
  naturalH: 512,
};

describe("Design Studio history", () => {
  beforeEach(() => {
    useDesignStore.setState(useDesignStore.getInitialState(), true);
  });

  it("restores and reapplies a layer visibility edit with undo and redo", () => {
    useDesignStore.getState().addLayer(imageLayer);
    useDesignStore.getState().setLayerVisibility(imageLayer.id, false);

    expect(useDesignStore.getState().layers[0].visible).toBe(false);

    useDesignStore.getState().undo();
    expect(useDesignStore.getState().layers[0].visible).toBe(true);

    useDesignStore.getState().redo();
    expect(useDesignStore.getState().layers[0].visible).toBe(false);
  });

  it("captures direct layer edits so text, image, and transform changes undo cleanly", () => {
    useDesignStore.getState().addLayer(imageLayer);
    useDesignStore.getState().updateLayer(imageLayer.id, {
      brightness: 135,
      transform: { ...imageLayer.transform, x: 42, rotation: 12 },
    });

    expect(useDesignStore.getState().layers[0]).toMatchObject({
      brightness: 135,
      transform: { x: 42, rotation: 12 },
    });

    useDesignStore.getState().undo();
    const undoneLayer = useDesignStore.getState().layers[0];
    expect(undoneLayer.transform).toEqual(imageLayer.transform);
    expect(undoneLayer).not.toHaveProperty("brightness");

    useDesignStore.getState().redo();
    expect(useDesignStore.getState().layers[0]).toMatchObject({
      brightness: 135,
      transform: { x: 42, rotation: 12 },
    });
  });

  it("restores a deleted layer and its selection, then reapplies deletion with redo", () => {
    useDesignStore.getState().addLayer(imageLayer);
    useDesignStore.getState().selectLayer(imageLayer.id);
    useDesignStore.getState().deleteLayer(imageLayer.id);

    expect(useDesignStore.getState().layers).toHaveLength(0);
    expect(useDesignStore.getState().selectedIds).toEqual([]);

    useDesignStore.getState().undo();
    expect(useDesignStore.getState().layers).toEqual([imageLayer]);
    expect(useDesignStore.getState().selectedIds).toEqual([imageLayer.id]);

    useDesignStore.getState().redo();
    expect(useDesignStore.getState().layers).toHaveLength(0);
    expect(useDesignStore.getState().selectedIds).toEqual([]);
  });

  it("groups a pointer gesture into one undo frame", () => {
    useDesignStore.getState().addLayer(imageLayer);
    const beforeGestureHistory = useDesignStore.getState().history.length;

    useDesignStore.getState().beginHistoryGroup();
    useDesignStore.getState().updateLayer(imageLayer.id, {
      transform: { ...imageLayer.transform, x: 20 },
    }, { history: false });
    useDesignStore.getState().updateLayer(imageLayer.id, {
      transform: { ...imageLayer.transform, x: 20, y: 34, rotation: 15 },
    }, { history: false });
    useDesignStore.getState().commit();

    expect(useDesignStore.getState().history).toHaveLength(beforeGestureHistory + 1);
    useDesignStore.getState().undo();
    expect(useDesignStore.getState().layers[0].transform).toEqual(imageLayer.transform);
  });

  it("clears redo after a new edit and treats empty history operations as no-ops", () => {
    const initial = useDesignStore.getState();
    useDesignStore.getState().undo();
    useDesignStore.getState().redo();
    expect(useDesignStore.getState().history).toEqual(initial.history);
    expect(useDesignStore.getState().future).toEqual(initial.future);

    useDesignStore.getState().addLayer(imageLayer);
    useDesignStore.getState().updateLayer(imageLayer.id, { brightness: 135 });
    useDesignStore.getState().undo();
    expect(useDesignStore.getState().future).toHaveLength(1);

    useDesignStore.getState().updateLayer(imageLayer.id, { contrast: 120 });
    expect(useDesignStore.getState().future).toHaveLength(0);
    useDesignStore.getState().redo();
    expect(useDesignStore.getState().layers[0]).not.toHaveProperty("brightness");
  });

  it("restores product refits and mug face/mode as one context frame", () => {
    useDesignStore.getState().addLayer(imageLayer);
    const mug = PRODUCTS.find((product) => product.category === "mug")!;
    const nextTransform = { ...imageLayer.transform, x: 18, y: -12, scale: 0.8 };

    useDesignStore.getState().switchProduct(mug, mug.colors[0], [{ id: imageLayer.id, transform: nextTransform }], "side2");
    expect(useDesignStore.getState().selectedProduct.id).toBe(mug.id);
    expect(useDesignStore.getState().activeFace).toBe("back");
    expect(useDesignStore.getState().mugMode).toBe("side2");
    expect(useDesignStore.getState().layers[0].transform).toEqual(nextTransform);

    useDesignStore.getState().undo();
    expect(useDesignStore.getState().selectedProduct.id).toBe(PRODUCTS[0].id);
    expect(useDesignStore.getState().activeFace).toBe("front");
    expect(useDesignStore.getState().mugMode).toBe("side1");
    expect(useDesignStore.getState().layers[0].transform).toEqual(imageLayer.transform);
  });

  it("restores a mug mode and face together", () => {
    useDesignStore.getState().setMugView("side2");
    expect(useDesignStore.getState()).toMatchObject({ mugMode: "side2", activeFace: "back" });

    useDesignStore.getState().undo();
    expect(useDesignStore.getState()).toMatchObject({ mugMode: "side1", activeFace: "front" });
  });
});
