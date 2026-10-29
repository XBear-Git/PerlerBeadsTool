import { hexToRgb, type PaletteMatcher } from "@/lib/colorMatch";
import type { BeadCell, BeadGrid, PixelMatrix, Rgb } from "@/types";

/**
 * Floyd-Steinberg 误差扩散抖动。
 *
 * 思路：按行扫描像素，匹配到最近色卡颜色后，把「原色 - 实际颜色」的误差
 * 按 7/16、3/16、5/16、1/16 的比例扩散给右、左下、下、右下邻居。
 * 这样渐变区域会交替使用相邻色号，视觉上比直接量化更平滑。
 *
 * 复杂度：O(W·H·P)，与无抖动匹配同阶，只多了常数级的误差分发。
 * 透明像素保持 null，不参与匹配，也不会接收/扩散误差。
 * 注意：抖动会提高色号数量，材料成本可能上升，因此作为可选开关。
 */

const WEIGHTS = [
  { dx: 1, dy: 0, weight: 7 / 16 },
  { dx: -1, dy: 1, weight: 3 / 16 },
  { dx: 0, dy: 1, weight: 5 / 16 },
  { dx: 1, dy: 1, weight: 1 / 16 },
] as const;

function clamp(value: number): number {
  return Math.min(255, Math.max(0, value));
}

export function ditherToPalette(
  pixels: PixelMatrix,
  matcher: PaletteMatcher,
): BeadGrid {
  const height = pixels.length;
  const width = pixels[0]?.length ?? 0;

  if (height === 0 || width === 0) return [];

  // 复制成可写入的浮点缓冲，避免修改调用方数据；null 表示透明
  const buffer = pixels.map((row) =>
    row.map((rgb) => (rgb ? [rgb[0], rgb[1], rgb[2]] : null)),
  );
  const grid: BeadGrid = [];

  for (let y = 0; y < height; y += 1) {
    const row: (BeadCell | null)[] = [];

    for (let x = 0; x < width; x += 1) {
      const current = buffer[y][x];
      if (!current) {
        row.push(null);
        continue;
      }

      const rgb: Rgb = [
        Math.round(clamp(current[0])),
        Math.round(clamp(current[1])),
        Math.round(clamp(current[2])),
      ];

      const { color } = matcher.match(rgb);
      const actual = hexToRgb(color.hex);
      row.push({ color, rgb: actual });

      const errorR = rgb[0] - actual[0];
      const errorG = rgb[1] - actual[1];
      const errorB = rgb[2] - actual[2];

      for (const { dx, dy, weight } of WEIGHTS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny >= height) continue;

        const target = buffer[ny][nx];
        if (!target) continue;

        target[0] += errorR * weight;
        target[1] += errorG * weight;
        target[2] += errorB * weight;
      }
    }

    grid.push(row);
  }

  return grid;
}
