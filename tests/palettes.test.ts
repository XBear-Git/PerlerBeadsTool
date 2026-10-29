import { describe, expect, it } from "vitest";

import { BEAD_PALETTES, BRAND_IDS, getPalette } from "@/data/beads";

describe("内置色卡", () => {
  it("三个品牌均已加载且非空", () => {
    expect(BEAD_PALETTES).toHaveLength(3);

    for (const id of BRAND_IDS) {
      const palette = getPalette(id);
      expect(palette.id).toBe(id);
      expect(palette.name.length).toBeGreaterThan(0);
      expect(palette.colors.length).toBeGreaterThan(0);
    }
  });

  it("每个品牌内色号唯一、hex 合法", () => {
    for (const palette of BEAD_PALETTES) {
      const codes = new Set(palette.colors.map((color) => color.code));
      expect(codes.size).toBe(palette.colors.length);

      for (const color of palette.colors) {
        expect(color.hex).toMatch(/^#[0-9A-F]{6}$/);
      }
    }
  });

  it("当前常用色卡数量符合数据文件", () => {
    expect(getPalette("perler").colors).toHaveLength(42);
    expect(getPalette("artkal").colors).toHaveLength(41);
    expect(getPalette("hama").colors).toHaveLength(57);
  });
});
