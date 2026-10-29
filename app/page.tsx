"use client";

import { useRef, useState } from "react";
import { SparklesIcon } from "lucide-react";

import { BomList } from "@/components/BomList";
import { CropperModal } from "@/components/CropperModal";
import { ExportBar, type ExportFormat } from "@/components/ExportBar";
import { Preview } from "@/components/Preview";
import { Settings } from "@/components/Settings";
import { Uploader } from "@/components/Uploader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useBeadProject } from "@/hooks/useBeadProject";
import { exportGridToPdf } from "@/lib/exportPdf";
import {
  buildPatternFilename,
  DEFAULT_PATTERN_NAME,
} from "@/lib/filename";
import {
  canvasToPngBlob,
  downloadBlob,
  renderPattern,
} from "@/lib/render";

export default function HomePage() {
  const project = useBeadProject();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [patternName, setPatternName] = useState(DEFAULT_PATTERN_NAME);

  const { grid, palette, settings, stats } = project;
  const cols = grid?.[0]?.length ?? 0;
  const rows = grid?.length ?? 0;

  const handleExportPng = async () => {
    if (!grid) return;
    setExporting("png");
    setExportError(null);

    try {
      // 导出使用独立画布，避免受预览缩放影响
      const exportCanvas = document.createElement("canvas");
      renderPattern(exportCanvas, grid, {
        cellSize: 32,
        padding: 16,
        showGrid: true,
        showCodes: settings.showCodes,
        pixelRatio: 1,
      });
      const blob = await canvasToPngBlob(exportCanvas);
      downloadBlob(
        blob,
        buildPatternFilename({
          patternName,
          brandName: palette.name,
          cols,
          rows,
          extension: "png",
        }),
      );
    } catch (cause) {
      setExportError(
        cause instanceof Error ? cause.message : "导出 PNG 失败，请重试。",
      );
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    if (!grid) return;
    setExporting("pdf");
    setExportError(null);

    try {
      await exportGridToPdf(grid, {
        brandName: palette.name,
        patternName,
        showCodes: settings.showCodes,
      });
    } catch (cause) {
      setExportError(
        cause instanceof Error ? cause.message : "导出 PDF 失败，请重试。",
      );
    } finally {
      setExporting(null);
    }
  };

  return (
    <main className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-10">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <SparklesIcon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  拼豆图纸生成器
                </h1>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Perler Beads Pattern Studio · 上传图片，即刻生成可照着拼的图纸
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">LAB + CIEDE2000</Badge>
            <Badge variant="outline">PNG / PDF 导出</Badge>
          </div>
        </header>

        {project.error || exportError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>处理失败</AlertTitle>
            <AlertDescription>{project.error ?? exportError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-4">
            <Uploader
              onFile={(file) => {
                void project.startCrop(file);
              }}
              fileName={project.sourceName}
              dimensions={project.sourceSize}
              disabled={project.isProcessing || project.isPreparingCrop}
              onReset={project.reset}
            />

            <Preview
              grid={grid}
              palette={palette}
              showCodes={settings.showCodes}
              brushColor={project.brushColor}
              isProcessing={project.isProcessing}
              isDirty={project.isDirty}
              undoCount={project.undoCount}
              canUndo={project.canUndo}
              canClearEdits={project.canClearEdits}
              canvasRef={canvasRef}
              onSelectBrush={project.selectBrush}
              onPaint={project.paintCell}
              onUndo={project.undo}
              onClearEdits={project.clearEdits}
            />

            <BomList stats={stats} paletteName={palette.name} />
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6">
            <Settings
              settings={settings}
              gridSize={project.gridSize}
              disabled={project.isProcessing}
              onChange={project.updateSettings}
            />

            <ExportBar
              disabled={!grid || project.isProcessing || project.isPreparingCrop}
              exporting={exporting}
              totalBeads={stats?.total ?? 0}
              uniqueColors={stats?.uniqueColors ?? 0}
              patternName={patternName}
              onPatternNameChange={setPatternName}
              onExportPng={() => {
                void handleExportPng();
              }}
              onExportPdf={() => {
                void handleExportPdf();
              }}
            />

          </aside>
        </div>
      </div>

      {project.cropRequest ? (
        <CropperModal
          key={project.cropRequest.imageUrl}
          imageSrc={project.cropRequest.imageUrl}
          fileName={project.cropRequest.fileName}
          imageWidth={project.cropRequest.width}
          imageHeight={project.cropRequest.height}
          onCancel={project.cancelCrop}
          onConfirm={(result) => project.applyCrop(result.blob)}
        />
      ) : null}
    </main>
  );
}
