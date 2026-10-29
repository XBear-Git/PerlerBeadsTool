import type {
  BeadCell,
  BeadColor,
  BeadGrid,
  BeadPalette,
  Lab,
  PixelMatrix,
  Rgb,
} from "@/types";

/**
 * 颜色匹配模块。
 *
 * 思路：
 * 1. 把 sRGB 转到 CIELAB（先线性化，再经 XYZ D65 转换）；
 * 2. 用 CIEDE2000 计算感知色差。相比直接算 RGB 欧氏距离，
 *    CIEDE2000 在低饱和、蓝色、肤色区域更接近人眼判断；
 * 3. 对每个像素遍历色卡取最小色差。
 *
 * 复杂度：单个像素 O(P)，P 为色卡颜色数；整张图 O(W·H·P)。
 * 色卡通常只有几十色，且对重复 RGB 做了缓存，浏览器端可以轻松处理 128×128 网格。
 */

const D65_X = 0.95047;
const D65_Y = 1;
const D65_Z = 1.08883;

const RAD = Math.PI / 180;

function clampChannel(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(255, Math.max(0, Math.round(value)));
}

/** 解析 #RRGGBB / RRGGBB；非法输入抛错，避免静默产出错误色卡 */
export function hexToRgb(hex: string): Rgb {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) {
    throw new Error(`非法颜色值：${hex}，应为 #RRGGBB`);
  }
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/** RGB 转 #RRGGBB（大写） */
export function rgbToHex(rgb: Rgb): string {
  return `#${rgb.map((channel) => clampChannel(channel).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/** sRGB 通道线性化（去除 gamma） */
function srgbToLinear(channel: number): number {
  const c = clampChannel(channel) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Lab 的 f(t) 分段函数 */
function labF(t: number): number {
  const delta = 6 / 29;
  return t > delta ** 3 ? Math.cbrt(t) : t / (3 * delta ** 2) + 4 / 29;
}

/** sRGB → CIELAB（D65 白点） */
export function rgbToLab(rgb: Rgb): Lab {
  const r = srgbToLinear(rgb[0]);
  const g = srgbToLinear(rgb[1]);
  const b = srgbToLinear(rgb[2]);

  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / D65_X;
  const y = (r * 0.2126729 + g * 0.7151522 + b * 0.072175) / D65_Y;
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / D65_Z;

  const fx = labF(x);
  const fy = labF(y);
  const fz = labF(z);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000 色差；返回值越小越接近，约 1 为刚可察觉差异 */
export function deltaE2000(lab1: Lab, lab2: Lab): number {
  const [l1, a1, b1] = lab1;
  const [l2, a2, b2] = lab2;

  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const cBar = (c1 + c2) / 2;

  const cBar7 = cBar ** 7;
  const g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + 25 ** 7)));

  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);

  const h1p = c1p === 0 ? 0 : (Math.atan2(b1, a1p) / RAD + 360) % 360;
  const h2p = c2p === 0 ? 0 : (Math.atan2(b2, a2p) / RAD + 360) % 360;

  const deltaLp = l2 - l1;
  const deltaCp = c2p - c1p;

  let deltaHp = 0;
  if (c1p * c2p !== 0) {
    deltaHp = h2p - h1p;
    if (deltaHp > 180) deltaHp -= 360;
    if (deltaHp < -180) deltaHp += 360;
  }

  const deltaBigHp =
    2 * Math.sqrt(c1p * c2p) * Math.sin((deltaHp * RAD) / 2);

  const lBarP = (l1 + l2) / 2;
  const cBarP = (c1p + c2p) / 2;

  let hBarP: number;
  if (c1p * c2p === 0) {
    hBarP = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hBarP = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    hBarP = (h1p + h2p + 360) / 2;
  } else {
    hBarP = (h1p + h2p - 360) / 2;
  }

  const t =
    1 -
    0.17 * Math.cos((hBarP - 30) * RAD) +
    0.24 * Math.cos(2 * hBarP * RAD) +
    0.32 * Math.cos((3 * hBarP + 6) * RAD) -
    0.2 * Math.cos((4 * hBarP - 63) * RAD);

  const deltaTheta = 30 * Math.exp(-(((hBarP - 275) / 25) ** 2));
  const cBarP7 = cBarP ** 7;
  const rc = 2 * Math.sqrt(cBarP7 / (cBarP7 + 25 ** 7));

  const lOffset = lBarP - 50;
  const sl = 1 + (0.015 * lOffset ** 2) / Math.sqrt(20 + lOffset ** 2);
  const sc = 1 + 0.045 * cBarP;
  const sh = 1 + 0.015 * cBarP * t;
  const rt = -Math.sin(2 * deltaTheta * RAD) * rc;

  const lTerm = deltaLp / sl;
  const cTerm = deltaCp / sc;
  const hTerm = deltaBigHp / sh;

  return Math.sqrt(
    lTerm ** 2 + cTerm ** 2 + hTerm ** 2 + rt * cTerm * hTerm,
  );
}

export interface ColorMatch {
  color: BeadColor;
  /** CIEDE2000 色差 */
  distance: number;
}

export interface PaletteMatcher {
  palette: BeadPalette;
  /** 查找色卡中与给定 RGB 最接近的颜色 */
  match(rgb: Rgb): ColorMatch;
}

/**
 * 为一张色卡建立匹配器。
 * 预计算 Lab 值与缓存都是为了避免在逐像素循环里重复转换。
 */
export function createPaletteMatcher(palette: BeadPalette): PaletteMatcher {
  if (palette.colors.length === 0) {
    throw new Error(`色卡 ${palette.name} 为空`);
  }

  const entries = palette.colors.map((color) => ({
    color,
    lab: rgbToLab(hexToRgb(color.hex)),
  }));

  const cache = new Map<number, ColorMatch>();

  return {
    palette,
    match(rgb: Rgb): ColorMatch {
      const r = clampChannel(rgb[0]);
      const g = clampChannel(rgb[1]);
      const b = clampChannel(rgb[2]);
      const key = (r << 16) | (g << 8) | b;

      const cached = cache.get(key);
      if (cached) return cached;

      const lab = rgbToLab([r, g, b]);
      let best = entries[0];
      let bestDistance = deltaE2000(lab, best.lab);

      for (let i = 1; i < entries.length; i += 1) {
        const distance = deltaE2000(lab, entries[i].lab);
        if (distance < bestDistance) {
          best = entries[i];
          bestDistance = distance;
        }
      }

      const result: ColorMatch = { color: best.color, distance: bestDistance };
      cache.set(key, result);
      return result;
    },
  };
}

/** 无抖动匹配：逐像素找最近色 */
export function matchPixelsToPalette(
  pixels: PixelMatrix,
  matcher: PaletteMatcher,
): BeadGrid {
  return pixels.map((row) =>
    row.map((rgb): BeadCell => {
      const { color } = matcher.match(rgb);
      return { color, rgb: hexToRgb(color.hex) };
    }),
  );
}
