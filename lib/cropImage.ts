/** 裁剪区域，与 react-easy-crop 的 croppedAreaPixels 结构一致（单位：源图像素） */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 裁剪输出的最长边上限（像素） */
export const MAX_CROP_OUTPUT = 4096;

export interface CroppedImage {
  blob: Blob;
  width: number;
  height: number;
}

export interface CropImageOptions {
  /** 输出最长边上限，避免超大裁剪结果占用过多内存 */
  maxOutputSize?: number;
  mimeType?: "image/png" | "image/jpeg" | "image/webp";
  quality?: number;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("裁剪源图加载失败。"));
    image.src = src;
  });
}

/**
 * 按源图像素区域裁剪并输出 Blob。
 *
 * 使用 Canvas 重绘而不是直接压缩原图，保证坐标基于 react-easy-crop
 * 返回的 croppedAreaPixels；输出 PNG 以保留像素画的硬边缘和透明区域。
 */
export async function cropImageToBlob(
  imageSrc: string,
  area: CropArea,
  options: CropImageOptions = {},
): Promise<CroppedImage> {
  const image = await loadImageElement(imageSrc);

  const sx = Math.max(0, Math.round(area.x));
  const sy = Math.max(0, Math.round(area.y));
  const sourceWidth = Math.min(Math.round(area.width), image.naturalWidth - sx);
  const sourceHeight = Math.min(
    Math.round(area.height),
    image.naturalHeight - sy,
  );

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error("裁剪区域无效，请重新调整。");
  }

  const maxOutputSize = Math.max(16, options.maxOutputSize ?? MAX_CROP_OUTPUT);
  const scale = Math.min(
    1,
    maxOutputSize / Math.max(sourceWidth, sourceHeight),
  );
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("当前浏览器不支持 Canvas 2D，无法完成裁剪。");
  }

  context.imageSmoothingEnabled = scale < 1;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    sx,
    sy,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  );

  const mimeType = options.mimeType ?? "image/png";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("裁剪结果导出失败，请重试。"));
      },
      mimeType,
      options.quality,
    );
  });

  return { blob, width, height };
}
