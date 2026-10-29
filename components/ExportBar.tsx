"use client";

import { DownloadIcon, FileTextIcon, LoaderCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ExportFormat = "png" | "pdf";

export interface ExportBarProps {
  disabled: boolean;
  exporting: ExportFormat | null;
  totalBeads: number;
  uniqueColors: number;
  patternName: string;
  onPatternNameChange: (value: string) => void;
  onExportPng: () => void;
  onExportPdf: () => void;
}

/** 导出区：PNG 走 Canvas 原生导出，PDF 走 jsPDF 矢量绘制 */
export function ExportBar({
  disabled,
  exporting,
  totalBeads,
  uniqueColors,
  patternName,
  onPatternNameChange,
  onExportPng,
  onExportPdf,
}: ExportBarProps) {
  const busy = exporting !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>导出图纸</CardTitle>
        <CardDescription>
          PNG 适合屏幕对照；PDF 为矢量网格，适合打印。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pattern-name">图纸名称</Label>
          <Input
            id="pattern-name"
            value={patternName}
            maxLength={40}
            placeholder="例如：暗夜魔女"
            onChange={(event) => onPatternNameChange(event.target.value)}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            onClick={onExportPng}
            disabled={disabled || busy}
            size="lg"
          >
            {exporting === "png" ? (
              <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
            ) : (
              <DownloadIcon data-icon="inline-start" />
            )}
            下载 PNG
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onExportPdf}
            disabled={disabled || busy}
            size="lg"
          >
            {exporting === "pdf" ? (
              <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
            ) : (
              <FileTextIcon data-icon="inline-start" />
            )}
            下载 PDF
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {disabled
            ? "生成图纸后即可导出。"
            : `将导出 ${totalBeads} 颗拼豆、${uniqueColors} 种颜色的图纸。`}
        </p>
      </CardContent>
    </Card>
  );
}
