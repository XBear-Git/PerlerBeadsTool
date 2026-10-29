import type { GridSize } from "@/types";

/**
 * 像素化模块（主线程部分）。
 *
 * 主线程只负责文件读取、尺寸换算与校验；真正的降采样、颜色匹配
 * 在 lib/workers/match.worker.ts 中通过 OffscreenCanvas 完成，
 * 避免大图/大网格阻塞 UI。
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

/** 从 URL 读取图片，并校验自然尺寸；调用方负责 URL 生命周期 */
export async function loadImageUrl(url: string): Promise<LoadedImage> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("图片解码失败，请更换文件重试。"));
    element.src = url;
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
}

/** 读取本地文件为 HTMLImageElement，并在加载完成后释放临时 URL */
export async function loadImageFile(file: File): Promise<LoadedImage> {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await loadImageUrl(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** 读取裁剪后的 Blob；返回的 HTMLImageElement 仍然可绘制 */
export async function loadImageBlob(blob: Blob): Promise<LoadedImage> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await loadImageUrl(objectUrl);
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
