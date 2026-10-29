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
  BeadCell,
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

/** 手动改色最多保留的撤销步数 */
export const MAX_EDIT_HISTORY = 10;

interface ManualEdit {
  row: number;
  col: number;
  /** 改色前的格子，用于撤销 */
  before: BeadCell;
}

function gridsEqual(a: BeadGrid, b: BeadGrid | null): boolean {
  if (!b || a.length !== b.length) return false;

  for (let row = 0; row < a.length; row += 1) {
    if (a[row].length !== b[row].length) return false;

    for (let col = 0; col < a[row].length; col += 1) {
      const left = a[row][col];
      const right = b[row][col];
      if (
        left.color.code !== right.color.code ||
        left.color.hex !== right.color.hex
      ) {
        return false;
      }
    }
  }

  return true;
}

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
  /** 是否有尚未清除的手动修改 */
  isDirty: boolean;
  /** 当前可撤销步数，最多 MAX_EDIT_HISTORY */
  undoCount: number;
  canUndo: boolean;
  canClearEdits: boolean;
  updateSettings: (patch: Partial<ProjectSettings>) => void;
  loadFile: (file: File) => Promise<void>;
  reset: () => void;
  selectBrush: (color: BeadColor | null) => void;
  paintCell: (row: number, col: number) => void;
  undo: () => void;
  clearEdits: () => void;
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
  /** 自动生成的原始图纸，用于「清空修改」 */
  const [baseGrid, setBaseGrid] = useState<BeadGrid | null>(null);
  const [editHistory, setEditHistory] = useState<ManualEdit[]>([]);
  const [isDirty, setIsDirty] = useState(false);

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
        setBaseGrid(nextGrid);
        setEditHistory([]);
        setIsDirty(false);
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
    setBaseGrid(null);
    setEditHistory([]);
    setIsDirty(false);
    setBrushColor(null);
    setError(null);
    setIsProcessing(false);
  }, []);

  const updateSettings = useCallback((patch: Partial<ProjectSettings>) => {
    setSettings((previous) => ({ ...previous, ...patch }));
  }, []);

  const paintCell = useCallback(
    (row: number, col: number) => {
      if (!brushColor || !grid) return;

      const cell = grid[row]?.[col];
      if (!cell || cell.color.code === brushColor.code) return;

      const next = grid.map((line) => [...line]);
      next[row][col] = { color: brushColor, rgb: hexToRgb(brushColor.hex) };

      setGrid(next);
      setEditHistory((previous) => [
        ...previous.slice(-(MAX_EDIT_HISTORY - 1)),
        { row, col, before: cell },
      ]);
      setIsDirty(true);
    },
    [brushColor, grid],
  );

  const undo = useCallback(() => {
    const last = editHistory[editHistory.length - 1];
    if (!last || !grid) return;

    const next = grid.map((line) => [...line]);
    next[last.row][last.col] = last.before;

    setGrid(next);
    setEditHistory((previous) => previous.slice(0, -1));
    setIsDirty(!gridsEqual(next, baseGrid));
  }, [baseGrid, editHistory, grid]);

  const clearEdits = useCallback(() => {
    if (!baseGrid) return;

    // 恢复到自动生成结果；复制行数组，避免后续绘制影响 baseGrid
    setGrid(baseGrid.map((line) => [...line]));
    setEditHistory([]);
    setIsDirty(false);
  }, [baseGrid]);

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
    isDirty,
    undoCount: editHistory.length,
    canUndo: editHistory.length > 0,
    canClearEdits: isDirty,
    updateSettings,
    loadFile,
    reset,
    selectBrush: setBrushColor,
    paintCell,
    undo,
    clearEdits,
  };
}
