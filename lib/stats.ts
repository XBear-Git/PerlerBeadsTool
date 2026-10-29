import type { BeadGrid, BomItem, PatternStats } from "@/types";

/**
 * 材料清单（BOM）统计。
 * 以「色号 + hex」为键聚合；透明格（null）跳过，不计入总数与颜色数。
 * 复杂度 O(W·H)。
 */
export function computeStats(grid: BeadGrid): PatternStats {
  const counter = new Map<string, BomItem>();
  let total = 0;
  let transparent = 0;

  for (const row of grid) {
    for (const cell of row) {
      if (!cell) {
        transparent += 1;
        continue;
      }

      const key = `${cell.color.code}:${cell.color.hex}`;
      const existing = counter.get(key);

      if (existing) {
        existing.count += 1;
      } else {
        counter.set(key, { color: cell.color, count: 1, ratio: 0 });
      }
      total += 1;
    }
  }

  const items = [...counter.values()]
    .map((item) => ({
      ...item,
      ratio: total === 0 ? 0 : item.count / total,
    }))
    .sort((a, b) => b.count - a.count || a.color.code.localeCompare(b.color.code));

  const allCells = total + transparent;

  return {
    total,
    transparent,
    transparentRatio: allCells === 0 ? 0 : transparent / allCells,
    uniqueColors: items.length,
    items,
  };
}
