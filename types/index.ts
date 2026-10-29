/**
 * 全局类型定义。
 * 约定：所有颜色使用 sRGB（0-255），像素矩阵按行优先（row-major）存储。
 */

/** 内置品牌标识 */
export type BrandId = "perler" | "artkal" | "hama";

/** sRGB 颜色三元组，取值范围 0-255 */
export type Rgb = readonly [number, number, number];

/** CIELAB 颜色三元组：L* 取值 0-100，a 与 b 通常为 -128~127 */
export type Lab = readonly [number, number, number];

/** 色卡中的单个颜色 */
export interface BeadColor {
  /** 品牌色号，例如 P01 */
  code: string;
  /** 中文颜色名，便于材料清单阅读 */
  name: string;
  /** sRGB 十六进制值，例如 #FFFFFF */
  hex: string;
}

/** 一个品牌的完整色卡 */
export interface BeadPalette {
  id: BrandId;
  name: string;
  description: string;
  /** 是否已与官方色卡逐色校对；示例数据为 false */
  verified: boolean;
  colors: BeadColor[];
}

/** 像素矩阵：pixels[row][col] = [r, g, b] */
export type PixelMatrix = Rgb[][];

/** 图纸中的一格：记录匹配到的色卡颜色及其实际 RGB */
export interface BeadCell {
  color: BeadColor;
  rgb: Rgb;
}

/** 图纸矩阵：grid[row][col] = BeadCell */
export type BeadGrid = BeadCell[][];

/** 网格尺寸（列数 × 行数） */
export interface GridSize {
  width: number;
  height: number;
}

/** 用户可调参数 */
export interface ProjectSettings {
  brandId: BrandId;
  /** 图像最长边映射到的格数，另一条边按比例换算 */
  maxSide: number;
  /** 是否启用 Floyd-Steinberg 抖动 */
  dither: boolean;
  /** 是否在图纸格内标注色号 */
  showCodes: boolean;
}

/** 材料清单中的一项 */
export interface BomItem {
  color: BeadColor;
  count: number;
  /** 占全部拼豆的比例，0-1 */
  ratio: number;
}

/** 材料清单统计结果 */
export interface PatternStats {
  total: number;
  uniqueColors: number;
  items: BomItem[];
}
