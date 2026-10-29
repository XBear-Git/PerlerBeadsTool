import type { BeadPalette, BrandId } from "@/types";

import artkalData from "./artkal.json";
import hamaData from "./hama.json";
import perlerData from "./perler.json";

/**
 * 色卡注册表。
 * JSON 由 TypeScript 静态导入，构建时完成校验并随主包一起分发；
 * 后续新增品牌时，只需添加 JSON 并在 BRAND_IDS 中登记。
 */
const PALETTES: Record<BrandId, BeadPalette> = {
  perler: perlerData as BeadPalette,
  artkal: artkalData as BeadPalette,
  hama: hamaData as BeadPalette,
};

/** 供下拉框等 UI 使用的品牌顺序 */
export const BRAND_IDS: BrandId[] = ["perler", "artkal", "hama"];

/** 全部内置色卡 */
export const BEAD_PALETTES: BeadPalette[] = BRAND_IDS.map((id) => PALETTES[id]);

/** 默认品牌 */
export const DEFAULT_BRAND_ID: BrandId = "perler";

/** 按品牌 ID 读取色卡（ID 来源受 BrandId 约束，不会取到 undefined） */
export function getPalette(id: BrandId): BeadPalette {
  return PALETTES[id];
}
