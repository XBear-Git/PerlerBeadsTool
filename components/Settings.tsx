"use client";

import { InfoIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BEAD_PALETTES } from "@/data/beads";
import type { GridSize, ProjectSettings } from "@/types";

const GRID_OPTIONS = [32, 48, 64, 96, 128] as const;

export interface SettingsProps {
  settings: ProjectSettings;
  gridSize: GridSize | null;
  paletteColorCount: number;
  paletteVerified: boolean;
  disabled?: boolean;
  onChange: (patch: Partial<ProjectSettings>) => void;
}

/** 参数区：品牌、网格尺寸、抖动与色号标注 */
export function Settings({
  settings,
  gridSize,
  paletteColorCount,
  paletteVerified,
  disabled = false,
  onChange,
}: SettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>2. 图纸参数</CardTitle>
        <CardDescription>
          品牌切换与网格调整会实时重算；抖动会增加用色数量。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="brand-select">拼豆品牌</Label>
          <Select
            value={settings.brandId}
            onValueChange={(value) => {
              if (value === "perler" || value === "artkal" || value === "hama") {
                onChange({ brandId: value });
              }
            }}
            disabled={disabled}
          >
            <SelectTrigger id="brand-select" className="w-full">
              <SelectValue>
                {(value) => {
                  const selected = BEAD_PALETTES.find(
                    (palette) => palette.id === value,
                  );
                  return selected
                    ? `${selected.name} · ${selected.colors.length} 色`
                    : "选择品牌";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {BEAD_PALETTES.map((palette) => (
                <SelectItem key={palette.id} value={palette.id}>
                  {palette.name} · {palette.colors.length} 色
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              当前色卡共 {paletteColorCount} 色
              {paletteVerified ? null : "（示例数据，待按官方色卡校对）"}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="grid-select">网格最长边</Label>
          <Select
            value={String(settings.maxSide)}
            onValueChange={(value) => {
              if (!value) return;
              const next = Number.parseInt(value, 10);
              if (Number.isFinite(next)) onChange({ maxSide: next });
            }}
            disabled={disabled}
          >
            <SelectTrigger id="grid-select" className="w-full">
              <SelectValue>
                {(value) => (value ? `${value} 格` : "选择网格")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {GRID_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} 格
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {gridSize
              ? `当前图纸：${gridSize.width} × ${gridSize.height} 格`
              : "上传后按原图比例自动计算另一边。"}
          </p>
        </div>

        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="dither-switch">抖动算法</Label>
              <p className="text-xs text-muted-foreground">
                Floyd-Steinberg，改善渐变色过渡。
              </p>
            </div>
            <Switch
              id="dither-switch"
              checked={settings.dither}
              onCheckedChange={(checked) => onChange({ dither: checked })}
              disabled={disabled}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="codes-switch">格内色号</Label>
              <p className="text-xs text-muted-foreground">
                预览较小时自动隐藏，导出时按格子大小绘制。
              </p>
            </div>
            <Switch
              id="codes-switch"
              checked={settings.showCodes}
              onCheckedChange={(checked) => onChange({ showCodes: checked })}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
          <Badge variant="outline">LAB + CIEDE2000</Badge>
          <Badge variant="outline">Canvas 像素化</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
