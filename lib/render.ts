import type { BeadGrid } from "@/types";

/**
 * 图纸渲染模块。
 * 用 Canvas 2D 绘制：可选底色 → 每格填色 → 网格线 → 色号。
 * 透明格（null）不填色，导出 PNG 时可保留透明通道。
 * 复杂度 O(W·H)；160×160 的网格约 2.5 万格，单帧绘制在桌面端通常 < 50ms。
 */

export const DEFAULT_CELL_SIZE = 24;
const DEFAULT_PADDING = 12;

export interface RenderOptions {
  /** 每格边长（CSS 像素） */
  cellSize?: number;
  /** 图纸四周留白 */
  padding?: number;
  showGrid?: boolean;
  showCodes?: boolean;
  /** 高分屏渲染倍率，导出时保持 1 */
  pixelRatio?: number;
  /** 可选底色；不传则保持透明背景 */
  background?: string;
}

/** 根据底色亮度选择可读的文字颜色 */
function readableTextColor(rgb: readonly [number, number, number]): string {
  const luminance = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  return luminance > 155 ? "#1f2937" : "#ffffff";
}

/**
 * 将图纸绘制到指定 canvas。
 * 返回逻辑尺寸（未乘 pixelRatio），调用方可据此设置 CSS 宽高。
 */
export function renderPattern(
  canvas: HTMLCanvasElement,
  grid: BeadGrid,
  options: RenderOptions = {},
): { width: number; height: number } {
  const cellSize = Math.max(4, options.cellSize ?? DEFAULT_CELL_SIZE);
  const padding = Math.max(0, options.padding ?? DEFAULT_PADDING);
  const showGrid = options.showGrid ?? true;
  const showCodes = options.showCodes ?? true;
  const pixelRatio = Math.max(1, options.pixelRatio ?? 1);
  const background = options.background;

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  const width = cols * cellSize + padding * 2;
  const height = rows * cellSize + padding * 2;

  canvas.width = Math.max(1, Math.round(width * pixelRatio));
  canvas.height = Math.max(1, Math.round(height * pixelRatio));

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("当前浏览器不支持 Canvas 2D。");
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
  }

  if (rows === 0 || cols === 0) {
    return { width, height };
  }

  // 1. 填色（透明格留空，不绘制）
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const cell = grid[y][x];
      if (!cell) continue;

      context.fillStyle = cell.color.hex;
      context.fillRect(
        padding + x * cellSize,
        padding + y * cellSize,
        cellSize,
        cellSize,
      );
    }
  }

  // 2. 网格线
  if (showGrid) {
    context.strokeStyle = "rgba(15, 23, 42, 0.28)";
    context.lineWidth = 1;
    context.beginPath();

    for (let x = 0; x <= cols; x += 1) {
      const px = padding + x * cellSize + 0.5;
      context.moveTo(px, padding);
      context.lineTo(px, padding + rows * cellSize);
    }
    for (let y = 0; y <= rows; y += 1) {
      const py = padding + y * cellSize + 0.5;
      context.moveTo(padding, py);
      context.lineTo(padding + cols * cellSize, py);
    }

    context.stroke();

    context.strokeStyle = "rgba(15, 23, 42, 0.75)";
    context.lineWidth = 2;
    context.strokeRect(
      padding - 0.5,
      padding - 0.5,
      cols * cellSize + 1,
      rows * cellSize + 1,
    );
  }

  // 3. 色号（格子太小时自动省略，避免糊成一团）
  if (showCodes && cellSize >= 16) {
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `600 ${Math.max(7, Math.floor(cellSize * 0.34))}px ui-sans-serif, system-ui, sans-serif`;

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const cell = grid[y][x];
        if (!cell) continue;

        context.fillStyle = readableTextColor(cell.rgb);
        context.fillText(
          cell.color.code,
          padding + x * cellSize + cellSize / 2,
          padding + y * cellSize + cellSize / 2 + 0.5,
        );
      }
    }
  }

  return { width, height };
}

/** Canvas → PNG Blob（导出前统一走这里，便于以后加白边/水印） */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("导出 PNG 失败，请重试。"));
      }
    }, "image/png");
  });
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
