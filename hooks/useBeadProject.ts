"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getPalette } from "@/data/beads";
import {
  createPaletteMatcher,
  hexToRgb,
  matchPixelsToPalette,
} from "@/lib/colorMatch";
import { ditherToPalette } from "@/lib/dither";
import {
  fitGridSize,
  loadImageFile,
  pixelateImage,
  validateImageFile,
  type LoadedImage,
} from "@/lib/pixelate";
import { computeStats } from "@/lib/stats";
import type {
  BeadColor,
  BeadGrid,
  BeadPalette,
  GridSize,
  PatternStats,
  ProjectSettings,
} from "@/types";

export const DEFAULT_SETTINGS: ProjectSettings = {
  brandId: "perler",
  maxSide: 48,
  dither: false,
  showCodes: true,
};

export interface UseBeadProjectResult {
  settings: ProjectSettings;
  palette: BeadPalette;
  sourceName: string | null;
  sourceSize: GridSize | null;
  grid: BeadGrid | null;
  gridSize: GridSize | null;
  stats: PatternStats | null;
  brushColor: BeadColor | null;
  error: string | null;
  isProcessing: boolean;
  hasImage: boolean;
  updateSettings: (patch: Partial<ProjectSettings>) => void;
  loadFile: (file: File) => Promise<void>;
  reset: () => void;
  selectBrush: (color: BeadColor | null) => void;
  paintCell: (row: number, col: number) => void;
}

/**
 * 项目状态与处理流水线。
 * 组件只负责展示/交互，图像处理全部收敛到这里，便于后续替换为 Web Worker。
 */
export function useBeadProject(): UseBeadProjectResult {
  const [settings, setSettings] = useState<ProjectSettings>(DEFAULT_SETTINGS);
  const [source, setSource] = useState<LoadedImage | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [grid, setGrid] = useState<BeadGrid | null>(null);
  const [brushColor, setBrushColor] = useState<BeadColor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const processTaskRef = useRef(0);
  const loadTaskRef = useRef(0);

  const palette = useMemo(
    () => getPalette(settings.brandId),
    [settings.brandId],
  );
  const matcher = useMemo(() => createPaletteMatcher(palette), [palette]);

  const stats = useMemo(
    () => (grid ? computeStats(grid) : null),
    [grid],
  );

  const gridSize = useMemo<GridSize | null>(() => {
    if (!grid || grid.length === 0 || !grid[0]) return null;
    return { width: grid[0].length, height: grid.length };
  }, [grid]);

  // 图片或参数变化时重算：像素化 → 匹配(可选抖动) → 图纸
  useEffect(() => {
    if (!source) {
      processTaskRef.current += 1;
      return;
    }

    const taskId = processTaskRef.current + 1;
    processTaskRef.current = taskId;

    // 让浏览器先完成一次绘制，避免大图计算阻塞输入反馈
    const timer = window.setTimeout(() => {
      setIsProcessing(true);
      try {
        const target = fitGridSize(source.width, source.height, settings.maxSide);
        const pixels = pixelateImage(source.image, target);
        const nextGrid = settings.dither
          ? ditherToPalette(pixels, matcher)
          : matchPixelsToPalette(pixels, matcher);

        if (processTaskRef.current !== taskId) return;

        setGrid(nextGrid);
        setBrushColor(null);
        setError(null);
      } catch (cause) {
        if (processTaskRef.current !== taskId) return;
        setError(
          cause instanceof Error ? cause.message : "处理图片时发生未知错误。",
        );
      } finally {
        if (processTaskRef.current === taskId) {
          setIsProcessing(false);
        }
      }
    }, 16);

    return () => window.clearTimeout(timer);
  }, [source, settings.maxSide, settings.dither, matcher]);

  const loadFile = useCallback(async (file: File) => {
    const message = validateImageFile(file);
    if (message) {
      setError(message);
      return;
    }

    const taskId = loadTaskRef.current + 1;
    loadTaskRef.current = taskId;
    setError(null);
    setIsProcessing(true);

    try {
      const loaded = await loadImageFile(file);
      if (loadTaskRef.current !== taskId) return;

      setSource(loaded);
      setSourceName(file.name);
      setBrushColor(null);
    } catch (cause) {
      if (loadTaskRef.current !== taskId) return;
      setError(
        cause instanceof Error ? cause.message : "读取图片失败，请重试。",
      );
      setIsProcessing(false);
    }
  }, []);

  const reset = useCallback(() => {
    loadTaskRef.current += 1;
    processTaskRef.current += 1;
    setSource(null);
    setSourceName(null);
    setGrid(null);
    setBrushColor(null);
    setError(null);
    setIsProcessing(false);
  }, []);

  const updateSettings = useCallback((patch: Partial<ProjectSettings>) => {
    setSettings((previous) => ({ ...previous, ...patch }));
  }, []);

  const paintCell = useCallback(
    (row: number, col: number) => {
      if (!brushColor) return;

      setGrid((previous) => {
        const cell = previous?.[row]?.[col];
        if (!previous || !cell || cell.color.code === brushColor.code) {
          return previous;
        }

        const next = previous.map((line) => [...line]);
        next[row][col] = { color: brushColor, rgb: hexToRgb(brushColor.hex) };
        return next;
      });
    },
    [brushColor],
  );

  return {
    settings,
    palette,
    sourceName,
    sourceSize: source ? { width: source.width, height: source.height } : null,
    grid,
    gridSize,
    stats,
    brushColor,
    error,
    isProcessing,
    hasImage: source !== null,
    updateSettings,
    loadFile,
    reset,
    selectBrush: setBrushColor,
    paintCell,
  };
}
