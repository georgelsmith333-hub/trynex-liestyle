import { describe, expect, it } from "vitest";
import { fitImageScale, fitImageTransform } from "./autoFit";

const zone = { w: 520, h: 580 };

describe("print-zone auto-fit", () => {
  it("contains a wide image inside both print-zone edges", () => {
    const scale = fitImageScale(2400, 800, zone, { padding: 1 });
    expect(2400 * scale).toBeCloseTo(520);
    expect(800 * scale).toBeLessThanOrEqual(580);
  });

  it("contains a tall image inside both print-zone edges", () => {
    const scale = fitImageScale(800, 2400, zone, { padding: 1 });
    expect(800 * scale).toBeLessThanOrEqual(520);
    expect(2400 * scale).toBeCloseTo(580);
  });

  it("uses the smaller axis for square art and preserves its aspect ratio", () => {
    const transform = fitImageTransform(1000, 1000, zone, { padding: 0.92 });
    expect(transform.scale).toBeCloseTo((520 * 0.92) / 1000);
    expect(transform.scaleX).toBe(1);
    expect(transform.scaleY).toBe(1);
  });

  it("fits the same artwork safely in narrow bottle and cap zones", () => {
    const bottle = fitImageScale(1600, 900, { w: 276, h: 590 }, { padding: 0.92 });
    const cap = fitImageScale(1600, 900, { w: 540, h: 320 }, { padding: 0.92 });
    expect(1600 * bottle).toBeLessThanOrEqual(276 * 0.92 + 0.0001);
    expect(900 * bottle).toBeLessThanOrEqual(590 * 0.92 + 0.0001);
    expect(1600 * cap).toBeLessThanOrEqual(540 * 0.92 + 0.0001);
    expect(900 * cap).toBeLessThanOrEqual(320 * 0.92 + 0.0001);
  });
});