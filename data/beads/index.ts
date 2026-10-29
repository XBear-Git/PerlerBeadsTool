import type { BeadColor, BeadPalette, BrandId } from "@/types";

import artkalData from "./artkal.json";
import hamaData from "./hama.json";
import perlerData from "./perler.json";

/**
 * 色卡源数据格式（data/beads/*.json）。
 * 允许携带冗余的 rgb 字段，导入时会校验其与 hex 是否一致。
 */
interface RawBeadColor {
  code: string;
  name: string;
  hex: string;
  rgb?: number[];
}

interface RawBeadPalette {
  brand: string;
  verified?: boolean;
  colors: RawBeadColor[];
}

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

const SOURCES: Record<BrandId, RawBeadPalette> = {
  perler: perlerData,
  artkal: artkalData,
  hama: hamaData,
};

/** 供下拉框等 UI 使用的品牌顺序 */
export const BRAND_IDS: BrandId[] = ["perler", "artkal", "hama"];

function parseHex(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/**
 * 校验并归一化为应用内部色卡结构。
 * 任一色号重复、hex 非法或 rgb 与 hex 不一致都会在构建/启动时直接报错，
 * 避免坏数据静默进入匹配流程。
 */
function normalizePalette(id: BrandId, source: RawBeadPalette): BeadPalette {
  const brand = source.brand?.trim();
  if (!brand) {
    throw new Error(`色卡 ${id} 缺少 brand 字段`);
  }
  if (!Array.isArray(source.colors) || source.colors.length === 0) {
    throw new Error(`色卡 ${id} 的 colors 必须是非空数组`);
  }

  const codes = new Set<string>();
  const colors: BeadColor[] = source.colors.map((color, index) => {
    const label = `${brand} 第 ${index + 1} 个颜色`;

    const code = color.code?.trim();
    if (!code) {
      throw new Error(`${label} 缺少 code`);
    }
    if (codes.has(code)) {
      throw new Error(`${label} 色号重复：${code}`);
    }
    codes.add(code);

    const name = color.name?.trim();
    if (!name) {
      throw new Error(`${brand} ${code} 缺少 name`);
    }

    if (!HEX_PATTERN.test(color.hex)) {
      throw new Error(`${brand} ${code} 的 hex 非法：${color.hex}`);
    }

    if (color.rgb !== undefined) {
      const expected = parseHex(color.hex);
      const matches =
        Array.isArray(color.rgb) &&
        color.rgb.length === 3 &&
        color.rgb.every(
          (channel, channelIndex) =>
            Number.isInteger(channel) &&
            channel >= 0 &&
            channel <= 255 &&
            channel === expected[channelIndex],
        );

      if (!matches) {
        throw new Error(
          `${brand} ${code} 的 rgb ${JSON.stringify(color.rgb)} 与 hex ${color.hex} 不一致`,
        );
      }
    }

    return { code, name, hex: color.hex.toUpperCase() };
  });

  return {
    id,
    name: brand,
    description: `${brand} 常用色卡（${colors.length} 色）`,
    verified: source.verified ?? false,
    colors,
  };
}

const PALETTES: Record<BrandId, BeadPalette> = {
  perler: normalizePalette("perler", SOURCES.perler),
  artkal: normalizePalette("artkal", SOURCES.artkal),
  hama: normalizePalette("hama", SOURCES.hama),
};

/** 全部内置色卡 */
export const BEAD_PALETTES: BeadPalette[] = BRAND_IDS.map((id) => PALETTES[id]);

/** 默认品牌 */
export const DEFAULT_BRAND_ID: BrandId = "perler";

/** 按品牌 ID 读取色卡（ID 来源受 BrandId 约束，不会取到 undefined） */
export function getPalette(id: BrandId): BeadPalette {
  return PALETTES[id];
}
