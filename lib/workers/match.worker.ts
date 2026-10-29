import { createPaletteMatcher, matchPixelsToPalette } from "../colorMatch";
import { ditherToPalette } from "../dither";
import type { BeadGrid, BeadPalette, GridSize, PixelMatrix, Rgb } from "../../types";
import {
  TRANSPARENT_PALETTE_INDEX,
  type MatchWorkerRequest,
  type MatchWorkerResponse,
} from "./protocol";

/**
 * 颜色匹配 Worker。
 *
 * 职责：
 * 1. 用 OffscreenCanvas 把主线程传来的 ImageBitmap 缩放到目标网格；
 * 2. 读取 RGBA 像素并在 Worker 内完成 LAB / CIEDE2000 匹配（可选抖动）；
 * 3. 只把「每格的色卡下标」用 Uint16Array 回传，并用 Transferable 转移 buffer，
 *    避免把上万个 BeadCell 对象结构化克隆回主线程。
 *
 * 时间复杂度：O(W·H·P)，W/H 为网格尺寸，P 为色卡色数；主线程只做 O(W·H) 的结果重建。
 */

interface WorkerScope {
  postMessage(message: MatchWorkerResponse, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<MatchWorkerRequest>) => void) | null;
}

const scope = globalThis as unknown as WorkerScope;

function validateGridSize(size: GridSize): void {
  if (
    !Number.isInteger(size.width) ||
    !Number.isInteger(size.height) ||
    size.width <= 0 ||
    size.height <= 0
  ) {
    throw new Error("目标网格尺寸必须为正整数。");
  }
}

/** 使用 OffscreenCanvas 高质量降采样并读出像素矩阵 */
function pixelateBitmap(image: ImageBitmap, size: GridSize): PixelMatrix {
  if (typeof OffscreenCanvas === "undefined") {
    throw new Error("当前浏览器不支持 OffscreenCanvas，无法在 Worker 中处理图片。");
  }

  const canvas = new OffscreenCanvas(size.width, size.height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("当前浏览器不支持 OffscreenCanvas 2D。");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, size.width, size.height);

  const { data } = context.getImageData(0, 0, size.width, size.height);
  const matrix: PixelMatrix = [];

  for (let y = 0; y < size.height; y += 1) {
    const row: (Rgb | null)[] = [];
    for (let x = 0; x < size.width; x += 1) {
      const offset = (y * size.width + x) * 4;
      const alpha = data[offset + 3];

      // alpha < 128 视为透明，不参与颜色匹配
      if (alpha < 128) {
        row.push(null);
      } else {
        row.push([data[offset], data[offset + 1], data[offset + 2]]);
      }
    }
    matrix.push(row);
  }

  return matrix;
}

/** 把 BeadGrid 压缩为色卡下标数组，便于 Transferable 回传 */
function toPaletteIndices(grid: BeadGrid, palette: BeadPalette): Uint16Array {
  if (palette.colors.length > 0xffff) {
    throw new Error("色卡颜色数超过 65535，无法使用 Uint16 下标传输。");
  }

  const indexByCode = new Map<string, number>();
  palette.colors.forEach((color, index) => {
    indexByCode.set(color.code, index);
  });

  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const indices = new Uint16Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = grid[y][x];
      if (!cell) {
        indices[y * width + x] = TRANSPARENT_PALETTE_INDEX;
        continue;
      }

      const index = indexByCode.get(cell.color.code);
      if (index === undefined) {
        throw new Error(`Worker 匹配到未知色号：${cell.color.code}`);
      }
      indices[y * width + x] = index;
    }
  }

  return indices;
}

async function handleRequest(request: MatchWorkerRequest): Promise<void> {
  const { id, image, size, palette, dither } = request;

  try {
    validateGridSize(size);
    if (!Array.isArray(palette.colors) || palette.colors.length === 0) {
      throw new Error("色卡为空，无法进行颜色匹配。");
    }

    const pixels = pixelateBitmap(image, size);
    const matcher = createPaletteMatcher(palette);
    const grid = dither
      ? ditherToPalette(pixels, matcher)
      : matchPixelsToPalette(pixels, matcher);
    const indices = toPaletteIndices(grid, palette);
    const buffer = indices.buffer as ArrayBuffer;

    scope.postMessage(
      {
        type: "result",
        id,
        width: grid[0]?.length ?? 0,
        height: grid.length,
        indices: buffer,
      },
      [buffer],
    );
  } catch (cause) {
    scope.postMessage({
      type: "error",
      id,
      message:
        cause instanceof Error
          ? cause.message
          : "Worker 处理图片时发生未知错误。",
    });
  } finally {
    // 主线程已经把 ImageBitmap 所有权转移过来，完成后及时释放显存
    image.close();
  }
}

scope.onmessage = (event: MessageEvent<MatchWorkerRequest>) => {
  const request = event.data;
  if (!request || request.type !== "process") return;
  void handleRequest(request);
};
