import { describe, expect, it } from "vitest";

import { fitGridSize } from "@/lib/pixelate";

describe("fitGridSize", () => {
  it("横图保持比例并限制最长边", () => {
    expect(fitGridSize(1200, 800, 48)).toEqual({ width: 48, height: 32 });
  });

  it("竖图交换长短边", () => {
    expect(fitGridSize(800, 1200, 48)).toEqual({ width: 32, height: 48 });
  });

  it("超长图最短边至少为 1", () => {
    expect(fitGridSize(10000, 10, 64)).toEqual({ width: 64, height: 1 });
  });

  it("非法尺寸抛出错误", () => {
    expect(() => fitGridSize(0, 100, 48)).toThrow();
  });
});
