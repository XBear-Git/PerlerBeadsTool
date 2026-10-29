import { describe, expect, it } from "vitest";

import {
  createPdfTiles,
  PDF_CELLS_PER_PAGE_X,
  PDF_CELLS_PER_PAGE_Y,
  toColumnLabel,
} from "@/lib/exportPdf";

describe("toColumnLabel", () => {
  it("把列索引转换为 Excel 风格标签", () => {
    expect(toColumnLabel(0)).toBe("A");
    expect(toColumnLabel(25)).toBe("Z");
    expect(toColumnLabel(26)).toBe("AA");
    expect(toColumnLabel(51)).toBe("AZ");
    expect(toColumnLabel(52)).toBe("BA");
    expect(toColumnLabel(701)).toBe("ZZ");
    expect(toColumnLabel(702)).toBe("AAA");
  });

  it("拒绝非法索引", () => {
    expect(() => toColumnLabel(-1)).toThrow();
    expect(() => toColumnLabel(1.5)).toThrow();
  });
});

describe("createPdfTiles", () => {
  it("32×32 以内为单页", () => {
    expect(createPdfTiles(32, 32)).toEqual([
      { index: 1, colStart: 0, rowStart: 0, cols: 32, rows: 32 },
    ]);
  });

  it("48×36 拆成 2×2 共 4 页", () => {
    const tiles = createPdfTiles(48, 36);

    expect(tiles).toHaveLength(4);
    expect(tiles[0]).toMatchObject({ colStart: 0, rowStart: 0, cols: 32, rows: 32 });
    expect(tiles[1]).toMatchObject({ colStart: 32, rowStart: 0, cols: 16, rows: 32 });
    expect(tiles[2]).toMatchObject({ colStart: 0, rowStart: 32, cols: 32, rows: 4 });
    expect(tiles[3]).toMatchObject({ colStart: 32, rowStart: 32, cols: 16, rows: 4 });
  });

  it("分页大小常量与约定一致", () => {
    expect(PDF_CELLS_PER_PAGE_X).toBe(32);
    expect(PDF_CELLS_PER_PAGE_Y).toBe(32);
  });

  it("空图纸或非法尺寸抛错", () => {
    expect(() => createPdfTiles(0, 10)).toThrow();
    expect(() => createPdfTiles(10, 0)).toThrow();
    expect(() => createPdfTiles(10.5, 10)).toThrow();
  });
});
