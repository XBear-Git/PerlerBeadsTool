import { describe, expect, it } from "vitest";

import {
  buildPatternFilename,
  DEFAULT_PATTERN_NAME,
  sanitizeFilenamePart,
} from "@/lib/filename";

describe("sanitizeFilenamePart", () => {
  it("保留中文与空格", () => {
    expect(sanitizeFilenamePart("暗夜魔女")).toBe("暗夜魔女");
    expect(sanitizeFilenamePart("  Dark  Witch  ")).toBe("Dark Witch");
  });

  it("移除非法文件名字符", () => {
    expect(sanitizeFilenamePart('a<b>c:d"e/f\\g|h?i*j')).toBe("abcdefghij");
  });

  it("空值或只有非法字符时回退默认名称", () => {
    expect(sanitizeFilenamePart("")).toBe(DEFAULT_PATTERN_NAME);
    expect(sanitizeFilenamePart("///")).toBe(DEFAULT_PATTERN_NAME);
    expect(sanitizeFilenamePart("...")).toBe(DEFAULT_PATTERN_NAME);
  });

  it("去掉结尾的点与空格", () => {
    expect(sanitizeFilenamePart("暗夜魔女. ")).toBe("暗夜魔女");
  });
});

describe("buildPatternFilename", () => {
  it("按 图纸名-品牌-长x宽 生成文件名", () => {
    expect(
      buildPatternFilename({
        patternName: "暗夜魔女",
        brandName: "Perler",
        cols: 48,
        rows: 36,
        extension: "pdf",
      }),
    ).toBe("暗夜魔女-Perler-48x36.pdf");

    expect(
      buildPatternFilename({
        patternName: "暗夜魔女",
        brandName: "Hama",
        cols: 128,
        rows: 72,
        extension: "png",
      }),
    ).toBe("暗夜魔女-Hama-128x72.png");
  });

  it("空名称时使用默认名称", () => {
    expect(
      buildPatternFilename({
        patternName: "",
        brandName: "Artkal",
        cols: 32,
        rows: 32,
        extension: "pdf",
      }),
    ).toBe(`${DEFAULT_PATTERN_NAME}-Artkal-32x32.pdf`);
  });
});
