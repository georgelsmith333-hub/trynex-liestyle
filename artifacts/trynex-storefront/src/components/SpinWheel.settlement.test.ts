import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const spinWheel = readFileSync(new URL("./SpinWheel.tsx", import.meta.url), "utf8");

describe("SpinWheel result settlement", () => {
  it("settles a reward from the wheel animation lifecycle rather than a fixed timer", () => {
    expect(spinWheel).toContain("onAnimationComplete={() => { if (!reducedMotion) void settleSpin(); }}");
    expect(spinWheel).toContain("if (reducedMotion) void settleSpin();");
    expect(spinWheel).not.toContain("}, 5200);");
  });

  it("does not issue a reward when the motion lifecycle fails to complete", () => {
    expect(spinWheel).toContain("The wheel animation timed out before settlement. No reward was shown; please retry.");
    expect(spinWheel).toContain("pendingSpinRef.current = null;");
    expect(spinWheel).toContain("const SPIN_WATCHDOG_MS = 8000;");
    expect(spinWheel).toContain("}, SPIN_WATCHDOG_MS);");
  });
});
