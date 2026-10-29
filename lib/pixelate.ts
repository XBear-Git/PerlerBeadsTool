import type { GridSize, PixelMatrix, Rgb } from "@/types";

/**
 * 像素化模块。
 *
 * 思路：先用浏览器 Canvas 把原图高质量缩放到目标网格大小（GPU/原生实现，
 * 比在 JS 里逐像素采样快得多），再用 getImageData 读出 RGB 矩阵。
 * 复杂度：缩放由浏览器完成；读取阶段 O(W·H)，W/H 为网格尺寸而非原图尺寸。
 */

/** 允许上传的 MIME 类型（不接收 SVG，避免脚本注入） */
export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

/** 单文件大小上限：20 MB */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** 原图像素总数上限：4000 万，避免移动端解码大图时内存溢出 */
export const MAX_SOURCE_PIXELS = 40_000_000;

/** 网格最短边与最长边限制 */
export const MIN_GRID_SIDE = 8;
export const MAX_GRID_SIDE = 160;

export interface LoadedImage {
  image: HTMLImageElement;
  width: number;
  height: number;
}

/** 上传前校验；返回错误文案，通过则返回 null */
export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return "仅支持 PNG、JPG/JPEG、WebP 格式的图片。";
  }
  if (file.size === 0) {
    return "文件为空，请重新选择。";
  }
  if (file.size > MAX_FILE_BYTES) {
    return `图片不能超过 ${MAX_FILE_BYTES / 1024 / 1024} MB。`;
  }
  return null;
}

/** 读取本地文件为 HTMLImageElement，并用自然尺寸做二次校验 */
export async function loadImageFile(file: File): Promise<LoadedImage> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("图片解码失败，请更换文件重试。"));
      element.src = objectUrl;
    });

    const width = image.naturalWidth;
    const height = image.naturalHeight;

    if (width === 0 || height === 0) {
      throw new Error("图片尺寸无效。");
    }
    if (width * height > MAX_SOURCE_PIXELS) {
      throw new Error("图片像素总量过大（超过 4000 万），请先压缩后再上传。");
    }

    return { image, width, height };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * 保持宽高比，把原图最长边映射为 maxSide 格。
 * 例如 1200×800、maxSide=48 → 48×32。
 */
export function fitGridSize(
  sourceWidth: number,
  sourceHeight: number,
  maxSide: number,
): GridSize {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error("图片尺寸必须为正数。");
  }

  const limit = Math.min(
    MAX_GRID_SIDE,
    Math.max(MIN_GRID_SIDE, Math.round(maxSide)),
  );

  if (sourceWidth >= sourceHeight) {
    return {
      width: limit,
      height: Math.max(1, Math.round((limit * sourceHeight) / sourceWidth)),
    };
  }

  return {
    width: Math.max(1, Math.round((limit * sourceWidth) / sourceHeight)),
    height: limit,
  };
}

/**
 * 按面积平均降采样（纯函数版本，便于测试或在 Worker 中使用）。
 * data 为 RGBA 连续数组，长度必须为 width*height*4。
 */
export function downsamplePixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  target: GridSize,
): PixelMatrix {
  if (data.length !== width * height * 4) {
    throw new Error("RGBA 数据长度与图片尺寸不匹配。");
  }
  if (target.width <= 0 || target.height <= 0) {
    throw new Error("目标网格尺寸必须为正数。");
  }

  const matrix: Rgb[][] = [];

  for (let ty = 0; ty < target.height; ty += 1) {
    const row: Rgb[] = [];
    const y0 = Math.floor((ty * height) / target.height);
    const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * height) / target.height));

    for (let tx = 0; tx < target.width; tx += 1) {
      const x0 = Math.floor((tx * width) / target.width);
      const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * width) / target.width));

      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;

      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const offset = (y * width + x) * 4;
          r += data[offset];
          g += data[offset + 1];
          b += data[offset + 2];
          count += 1;
        }
      }

      row.push([
        Math.round(r / count),
        Math.round(g / count),
        Math.round(b / count),
      ]);
    }

    matrix.push(row);
  }

  return matrix;
}

/**
 * 用 Canvas 把图片缩放到目标网格并读出像素矩阵。
 * 必须在浏览器环境调用。
 */
export function pixelateImage(
  image: CanvasImageSource,
  target: GridSize,
): PixelMatrix {
  if (typeof document === "undefined") {
    throw new Error("pixelateImage 只能在浏览器中调用。");
  }

  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("当前浏览器不支持 Canvas 2D。");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, target.width, target.height);

  const { data } = context.getImageData(0, 0, target.width, target.height);
  const matrix: Rgb[][] = [];

  for (let y = 0; y < target.height; y += 1) {
    const row: Rgb[] = [];
    for (let x = 0; x < target.width; x += 1) {
      const offset = (y * target.width + x) * 4;
      row.push([data[offset], data[offset + 1], data[offset + 2]]);
    }
    matrix.push(row);
  }

  return matrix;
}
