"use client";

import { useEffect, type MouseEvent, type RefObject } from "react";
import { Grid3X3Icon, LoaderCircleIcon, PaintbrushIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DEFAULT_CELL_SIZE,
  renderPattern,
} from "@/lib/render";
import { cn } from "@/lib/utils";
import type { BeadColor, BeadGrid, BeadPalette } from "@/types";

const PREVIEW_PADDING = 12;
const PREVIEW_PIXEL_RATIO = 2;

export interface PreviewProps {
  grid: BeadGrid | null;
  palette: BeadPalette;
  showCodes: boolean;
  brushColor: BeadColor | null;
  isProcessing: boolean;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onSelectBrush: (color: BeadColor | null) => void;
  onPaint: (row: number, col: number) => void;
}

/** 图纸预览：Canvas 渲染 + 手动画笔取色 */
export function Preview({
  grid,
  palette,
  showCodes,
  brushColor,
  isProcessing,
  canvasRef,
  onSelectBrush,
  onPaint,
}: PreviewProps) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid) return;

    renderPattern(canvas, grid, {
      cellSize: DEFAULT_CELL_SIZE,
      padding: PREVIEW_PADDING,
      showGrid: true,
      showCodes,
      pixelRatio: PREVIEW_PIXEL_RATIO,
    });
  }, [canvasRef, grid, showCodes]);

  const handleCanvasClick = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!grid || !brushColor) return;

    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // CSS 坐标 → 逻辑坐标（canvas 内部按 pixelRatio 放大了）
    const scale = canvas.width / rect.width / PREVIEW_PIXEL_RATIO;
    const x = (event.clientX - rect.left) * scale - PREVIEW_PADDING;
    const y = (event.clientY - rect.top) * scale - PREVIEW_PADDING;

    const col = Math.floor(x / DEFAULT_CELL_SIZE);
    const row = Math.floor(y / DEFAULT_CELL_SIZE);

    if (row < 0 || row >= grid.length) return;
    if (col < 0 || col >= (grid[0]?.length ?? 0)) return;

    onPaint(row, col);
  };

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>3. 图纸预览</CardTitle>
        <CardDescription>
          {grid
            ? `${grid[0]?.length ?? 0} × ${grid.length} 格 · ${palette.name}`
            : "上传图片后自动生成带网格与色号的图纸。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative flex min-h-64 items-center justify-center overflow-auto rounded-xl border bg-muted/30 p-3">
          {grid ? (
            <canvas
              ref={canvasRef}
              aria-label="拼豆图纸预览"
              onClick={handleCanvasClick}
              className={cn(
                "h-auto max-h-[560px] w-auto max-w-full rounded-sm bg-white shadow-sm",
                brushColor ? "cursor-crosshair" : "cursor-default",
              )}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
              <Grid3X3Icon className="size-10" aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">暂无图纸</p>
                <p className="text-xs">请先上传一张图片</p>
              </div>
            </div>
          )}

          {isProcessing ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-[1px]">
              <LoaderCircleIcon
                className="size-6 animate-spin text-primary"
                aria-hidden="true"
              />
              <p className="text-xs font-medium text-muted-foreground">
                正在生成图纸…
              </p>
            </div>
          ) : null}
        </div>

        {grid ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <PaintbrushIcon className="size-3.5" aria-hidden="true" />
                <span>
                  {brushColor
                    ? `画笔：${brushColor.code} ${brushColor.name}，点击图纸改色`
                    : "选择下方色块后可点击图纸手动改色"}
                </span>
              </div>
              {brushColor ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => onSelectBrush(null)}
                >
                  取消画笔
                </Button>
              ) : null}
            </div>

            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-lg border p-2">
              {palette.colors.map((color) => {
                const active = brushColor?.code === color.code;
                return (
                  <button
                    key={color.code}
                    type="button"
                    title={`${color.code} ${color.name} ${color.hex}`}
                    aria-label={`画笔 ${color.code} ${color.name}`}
                    aria-pressed={active}
                    onClick={() => onSelectBrush(active ? null : color)}
                    className={cn(
                      "size-7 rounded-md border transition-transform outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring",
                      active && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                    )}
                    style={{ backgroundColor: color.hex }}
                  />
                );
              })}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
