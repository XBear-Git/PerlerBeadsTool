"use client";

import { useMemo, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import {
  CropIcon,
  LoaderCircleIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  cropImageToBlob,
  MAX_CROP_OUTPUT,
  type CroppedImage,
} from "@/lib/cropImage";

const ASPECT_PRESETS = [
  { id: "1:1", label: "1:1", width: 1, height: 1 },
  { id: "4:3", label: "4:3", width: 4, height: 3 },
  { id: "3:4", label: "3:4", width: 3, height: 4 },
  { id: "16:9", label: "16:9", width: 16, height: 9 },
  { id: "9:16", label: "9:16", width: 9, height: 16 },
] as const;

function greatestCommonDivisor(a: number, b: number): number {
  let left = Math.abs(Math.round(a));
  let right = Math.abs(Math.round(b));
  while (right > 0) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return left || 1;
}

function reduceRatio(width: number, height: number): { width: number; height: number } {
  const divisor = greatestCommonDivisor(width, height);
  return {
    width: Math.max(1, Math.round(width / divisor)),
    height: Math.max(1, Math.round(height / divisor)),
  };
}

export interface CropperModalProps {
  imageSrc: string;
  fileName: string;
  imageWidth: number;
  imageHeight: number;
  onCancel: () => void;
  /** 确认后把裁剪结果交给上层，通常由 useBeadProject.applyCrop 接收 */
  onConfirm: (result: CroppedImage) => Promise<void> | void;
}

/**
 * 上传后的图片裁剪弹窗。
 *
 * react-easy-crop 负责交互与 croppedAreaPixels 计算；
 * 确认时通过 lib/cropImage 把源图重绘为裁剪后的 PNG Blob。
 */
export function CropperModal({
  imageSrc,
  fileName,
  imageWidth,
  imageHeight,
  onCancel,
  onConfirm,
}: CropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(1);
  const [activePreset, setActivePreset] = useState("1:1");
  const [customWidth, setCustomWidth] = useState("1");
  const [customHeight, setCustomHeight] = useState("1");
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const outputSize = useMemo(() => {
    if (!croppedAreaPixels) return null;

    const sourceWidth = Math.max(1, Math.round(croppedAreaPixels.width));
    const sourceHeight = Math.max(1, Math.round(croppedAreaPixels.height));
    const scale = Math.min(
      1,
      MAX_CROP_OUTPUT / Math.max(sourceWidth, sourceHeight),
    );

    return {
      width: Math.max(1, Math.round(sourceWidth * scale)),
      height: Math.max(1, Math.round(sourceHeight * scale)),
    };
  }, [croppedAreaPixels]);

  const applyAspect = (presetId: string, width: number, height: number) => {
    if (width <= 0 || height <= 0) return;

    const ratio = reduceRatio(width, height);
    setAspect(width / height);
    setActivePreset(presetId);
    setCrop({ x: 0, y: 0 });
    setCustomWidth(String(ratio.width));
    setCustomHeight(String(ratio.height));
  };

  const updateCustomRatio = (nextWidth: string, nextHeight: string) => {
    setCustomWidth(nextWidth);
    setCustomHeight(nextHeight);

    const width = Number.parseFloat(nextWidth);
    const height = Number.parseFloat(nextHeight);
    if (
      Number.isFinite(width) &&
      Number.isFinite(height) &&
      width > 0 &&
      height > 0
    ) {
      setAspect(width / height);
      setActivePreset("custom");
      setCrop({ x: 0, y: 0 });
    }
  };

  const handleConfirm = async () => {
    if (!croppedAreaPixels || isSaving) return;

    setIsSaving(true);
    setError(null);

    try {
      const result = await cropImageToBlob(imageSrc, croppedAreaPixels, {
        maxOutputSize: MAX_CROP_OUTPUT,
      });
      await onConfirm(result);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "裁剪失败，请重新调整后重试。",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isSaving) onCancel();
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
        showCloseButton={!isSaving}
      >
        <DialogHeader>
          <DialogTitle>裁剪图片</DialogTitle>
          <DialogDescription>
            {fileName} · 原图 {imageWidth} × {imageHeight} px
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative h-[42vh] min-h-60 w-full overflow-hidden rounded-lg bg-neutral-900">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              minZoom={1}
              maxZoom={4}
              showGrid
              objectFit="contain"
              zoomWithScroll={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, croppedArea) =>
                setCroppedAreaPixels(croppedArea)
              }
            />
          </div>

          <div className="space-y-2">
            <Label>常用比例</Label>
            <div className="flex flex-wrap gap-1.5">
              {ASPECT_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  size="sm"
                  variant={activePreset === preset.id ? "default" : "outline"}
                  onClick={() =>
                    applyAspect(preset.id, preset.width, preset.height)
                  }
                  disabled={isSaving}
                >
                  {preset.label}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant={activePreset === "original" ? "default" : "outline"}
                onClick={() =>
                  applyAspect("original", imageWidth, imageHeight)
                }
                disabled={isSaving}
              >
                原图
              </Button>
              {activePreset === "custom" ? (
                <Badge variant="secondary">自定义</Badge>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="crop-ratio-width" className="text-xs">
                自定义宽度比
              </Label>
              <Input
                id="crop-ratio-width"
                type="number"
                min={1}
                max={9999}
                step={1}
                value={customWidth}
                className="w-20"
                disabled={isSaving}
                onChange={(event) =>
                  updateCustomRatio(event.target.value, customHeight)
                }
              />
            </div>
            <span className="pb-2 text-sm text-muted-foreground">:</span>
            <div className="space-y-1">
              <Label htmlFor="crop-ratio-height" className="text-xs">
                高度比
              </Label>
              <Input
                id="crop-ratio-height"
                type="number"
                min={1}
                max={9999}
                step={1}
                value={customHeight}
                className="w-20"
                disabled={isSaving}
                onChange={(event) =>
                  updateCustomRatio(customWidth, event.target.value)
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ZoomOutIcon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <Slider
              min={1}
              max={4}
              step={0.01}
              value={[zoom]}
              disabled={isSaving}
              onValueChange={(value) => {
                const next = Array.isArray(value) ? value[0] : value;
                if (typeof next === "number") setZoom(next);
              }}
              aria-label="裁剪缩放"
            />
            <ZoomInIcon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="w-10 text-right text-xs text-muted-foreground">
              {zoom.toFixed(1)}×
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              {outputSize
                ? `输出像素：${outputSize.width} × ${outputSize.height} px`
                : "拖动图片或调整缩放以设置裁剪区域"}
            </span>
            <span>最长边上限 {MAX_CROP_OUTPUT} px</span>
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={() => {
              void handleConfirm();
            }}
            disabled={!croppedAreaPixels || isSaving}
          >
            {isSaving ? (
              <LoaderCircleIcon
                data-icon="inline-start"
                className="animate-spin"
              />
            ) : (
              <CropIcon data-icon="inline-start" />
            )}
            使用裁剪结果
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
