import { describe, expect, it } from "vitest";

import {
  createPaletteMatcher,
  deltaE2000,
  hexToRgb,
  rgbToHex,
} from "@/lib/colorMatch";
import { getPalette } from "@/data/beads";
import type { Rgb } from "@/types";

describe("颜色空间转换", () => {
  it("hex 与 rgb 可以互相转换", () => {
    expect(hexToRgb("#FF8000")).toEqual([255, 128, 0]);
    expect(rgbToHex([255, 128, 0])).toBe("#FF8000");
  });

  it("拒绝非法颜色值", () => {
    expect(() => hexToRgb("#FFF")).toThrow();
    expect(() => hexToRgb("red")).toThrow();
  });
});

describe("CIEDE2000", () => {
  it("相同颜色色差为 0", () => {
    expect(deltaE2000([50, 2.6772, -79.7751], [50, 2.6772, -79.7751])).toBe(0);
  });

  it("与 Sharma 基准数据一致", () => {
    // Sharma et al. (2005) 测试集第 1 组
    const distance = deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485]);
    expect(distance).toBeCloseTo(2.0425, 3);
  });
});

describe("色卡匹配", () => {
  const palette = getPalette("perler");
  const matcher = createPaletteMatcher(palette);

  it("纯白匹配到白色色号", () => {
    expect(matcher.match([255, 255, 255]).color.code).toBe("P01");
  });

  it("近似色也能匹配到色卡内的颜色", () => {
    const result = matcher.match([250, 250, 248] as Rgb);
    expect(palette.colors).toContain(result.color);
    expect(result.distance).toBeLessThan(3);
  });
});
