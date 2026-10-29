import { describe, expect, it } from "vitest";

import { computeStats } from "@/lib/stats";
import type { BeadCell, BeadGrid } from "@/types";

const red: BeadCell = {
  color: { code: "P05", name: "红色", hex: "#E32636" },
  rgb: [227, 38, 54],
};
const white: BeadCell = {
  color: { code: "P01", name: "白色", hex: "#FFFFFF" },
  rgb: [255, 255, 255],
};

describe("computeStats", () => {
  it("按色号聚合并计算占比", () => {
    const grid: BeadGrid = [
      [red, red],
      [white, red],
    ];

    const stats = computeStats(grid);

    expect(stats.total).toBe(4);
    expect(stats.transparent).toBe(0);
    expect(stats.transparentRatio).toBe(0);
    expect(stats.uniqueColors).toBe(2);
    expect(stats.items[0]).toMatchObject({ count: 3 });
    expect(stats.items[0].ratio).toBeCloseTo(0.75);
    expect(stats.items[1]).toMatchObject({ count: 1 });
  });

  it("透明格不计入总数、颜色数与占比", () => {
    const grid: BeadGrid = [
      [red, null],
      [null, red],
    ];

    const stats = computeStats(grid);

    expect(stats.total).toBe(2);
    expect(stats.transparent).toBe(2);
    expect(stats.transparentRatio).toBe(0.5);
    expect(stats.uniqueColors).toBe(1);
    expect(stats.items[0]).toMatchObject({ count: 2 });
    expect(stats.items[0].ratio).toBe(1);
  });

  it("空图纸返回零值", () => {
    expect(computeStats([])).toEqual({
      total: 0,
      transparent: 0,
      transparentRatio: 0,
      uniqueColors: 0,
      items: [],
    });
  });
});
