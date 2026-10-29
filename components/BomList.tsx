"use client";

import { LayersIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PatternStats } from "@/types";

export interface BomListProps {
  stats: PatternStats | null;
  paletteName: string;
}

/** 材料清单：按用量降序展示色号、数量与占比 */
export function BomList({ stats, paletteName }: BomListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>材料清单（BOM）</CardTitle>
        <CardDescription>
          {stats
            ? `${paletteName} 色卡 · ${stats.uniqueColors} 色 · 共 ${stats.total} 颗`
            : "生成图纸后自动统计各色拼豆用量。"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {stats && stats.items.length > 0 ? (
          <div className="max-h-80 overflow-auto rounded-lg border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="w-10">色块</TableHead>
                  <TableHead>色号</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead className="w-24 text-right">占比</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.items.map((item) => (
                  <TableRow key={`${item.color.code}-${item.color.hex}`}>
                    <TableCell>
                      <span
                        className="block size-5 rounded border"
                        style={{ backgroundColor: item.color.hex }}
                        aria-label={item.color.name}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs font-medium">
                      {item.color.code}
                    </TableCell>
                    <TableCell className="text-xs">{item.color.name}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {item.count}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-xs text-muted-foreground">
                        {(item.ratio * 100).toFixed(1)}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center text-muted-foreground">
            <LayersIcon className="size-8" aria-hidden="true" />
            <p className="text-xs">暂无统计数据</p>
          </div>
        )}

        {stats ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary">合计 {stats.total} 颗</Badge>
            <Badge variant="outline">{stats.uniqueColors} 种颜色</Badge>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
