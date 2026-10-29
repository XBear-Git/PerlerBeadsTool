import { describe, expect, it } from "vitest";

import { fitGridSize, downsamplePixels } from "@/lib/pixelate";

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

describe("downsamplePixels", () => {
  it("按 2×2 区域平均颜色", () => {
    const data = new Uint8ClampedArray([
      255, 0, 0, 255, 0, 255, 0, 255,
      0, 0, 255, 255, 255, 255, 255, 255,
    ]);

    expect(downsamplePixels(data, 2, 2, { width: 1, height: 1 })).toEqual([
      [[128, 128, 128]],
    ]);
  });

  it("数据长度不匹配时抛出错误", () => {
    expect(() =>
      downsamplePixels(new Uint8ClampedArray(8), 2, 2, { width: 1, height: 1 }),
    ).toThrow();
  });
});
