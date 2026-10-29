"use client";

import { useRef, useState } from "react";
import { ImageIcon, RotateCcwIcon, UploadCloudIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_FILE_BYTES,
} from "@/lib/pixelate";
import { cn } from "@/lib/utils";
import type { GridSize } from "@/types";

export interface UploaderProps {
  onFile: (file: File) => void;
  fileName: string | null;
  dimensions: GridSize | null;
  disabled?: boolean;
  onReset: () => void;
}

/** 图片上传区：点击/拖拽上传，格式与大小在 hook 中二次校验 */
export function Uploader({
  onFile,
  fileName,
  dimensions,
  disabled = false,
  onReset,
}: UploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>上传图片</CardTitle>
        <CardDescription>
          支持 PNG / JPG / WebP，单张不超过 {MAX_FILE_BYTES / 1024 / 1024} MB。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="上传图片"
          onClick={openPicker}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openPicker();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            if (!disabled) handleFiles(event.dataTransfer.files);
          }}
          className={cn(
            "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors outline-none",
            "border-border hover:border-primary/50 hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
            isDragging && "border-primary bg-primary/5",
            disabled && "pointer-events-none opacity-60",
          )}
        >
          {fileName ? (
            <>
              <ImageIcon className="size-8 text-primary" aria-hidden="true" />
              <div className="space-y-1">
                <p className="max-w-full truncate text-sm font-medium">
                  {fileName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dimensions
                    ? `原图 ${dimensions.width} × ${dimensions.height} px`
                    : "正在读取图片信息…"}
                </p>
              </div>
              <Badge variant="secondary">已载入 · 点击可更换</Badge>
            </>
          ) : (
            <>
              <UploadCloudIcon
                className="size-9 text-muted-foreground"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <p className="text-sm font-medium">拖拽图片到这里</p>
                <p className="text-xs text-muted-foreground">
                  或点击选择本地文件
                </p>
              </div>
            </>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="sr-only"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
        />

        {fileName ? (
          <div className="mt-3 flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={onReset}>
              <RotateCcwIcon data-icon="inline-start" />
              清除图片
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
