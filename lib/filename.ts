/** 默认图纸名称（用户未填写时使用） */
export const DEFAULT_PATTERN_NAME = "拼豆图纸";

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

/**
 * 清理文件名片段：
 * - 去掉 Windows / macOS 不允许的字符；
 * - 合并连续空白；
 * - 去掉首尾的点与空格（Windows 不允许文件名以点/空格结尾）；
 * - 空值回退到默认文案。
 */
export function sanitizeFilenamePart(
  value: string,
  fallback = DEFAULT_PATTERN_NAME,
): string {
  const cleaned = value
    .normalize("NFKC")
    .replace(INVALID_FILENAME_CHARS, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .replace(/[.\s]+$/, "");

  return cleaned || fallback;
}

export interface PatternFilenameOptions {
  patternName: string;
  brandName: string;
  cols: number;
  rows: number;
  extension: "png" | "pdf";
}

/** 统一导出命名：图纸名-品牌-长x宽.扩展名，例如 暗夜魔女-Perler-48x36.png */
export function buildPatternFilename({
  patternName,
  brandName,
  cols,
  rows,
  extension,
}: PatternFilenameOptions): string {
  const name = sanitizeFilenamePart(patternName);
  const brand = sanitizeFilenamePart(brandName, "brand");
  return `${name}-${brand}-${cols}x${rows}.${extension}`;
}
