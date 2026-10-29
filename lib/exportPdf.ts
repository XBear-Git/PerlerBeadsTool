import { computeStats } from "@/lib/stats";
import type { BeadGrid } from "@/types";

/**
 * PDF 导出封装。
 *
 * 说明：
 * - 使用 jsPDF 的矢量绘图，网格和色块都是矢量，放大不糊；
 * - jsPDF 内置字体不含中文，因此 PDF 内文案与色号统一使用 ASCII，
 *   色名留在网页端展示；若后续需要中文，可在 public/fonts 放 TTF 并注册；
 * - 大图多页排版属于进阶功能，这里先保证「整图缩放 + 材料清单」可用。
 */

export interface PdfExportOptions {
  brandName: string;
  showCodes?: boolean;
  title?: string;
}

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 8;
const HEADER_HEIGHT = 10;
const FOOTER_HEIGHT = 8;

function formatFilename(brand: string, cols: number, rows: number): string {
  const safeBrand = brand.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  return `beads-${safeBrand}-${cols}x${rows}.pdf`;
}

export async function exportGridToPdf(
  grid: BeadGrid,
  options: PdfExportOptions,
): Promise<void> {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  if (rows === 0 || cols === 0) {
    throw new Error("图纸为空，无法导出 PDF。");
  }

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const title = options.title ?? "Perler Beads Pattern";
  const stats = computeStats(grid);

  const contentWidth = PAGE_WIDTH - MARGIN * 2;
  const contentHeight =
    PAGE_HEIGHT - MARGIN * 2 - HEADER_HEIGHT - FOOTER_HEIGHT;
  const cellSize = Math.min(contentWidth / cols, contentHeight / rows);
  const gridWidth = cellSize * cols;
  const gridHeight = cellSize * rows;
  const startX = MARGIN + (contentWidth - gridWidth) / 2;
  const startY = MARGIN + HEADER_HEIGHT;

  pdf.setProperties({ title, creator: "Perler Beads Tool" });

  // ---------- 图纸页 ----------
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(17, 24, 39);
  pdf.text(title, MARGIN, MARGIN + 4.5);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(90, 100, 115);
  pdf.text(
    `${options.brandName} | ${cols} x ${rows} | ${stats.total} beads | ${stats.uniqueColors} colors`,
    MARGIN,
    MARGIN + 8.5,
  );

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const cell = grid[y][x];
      pdf.setFillColor(cell.rgb[0], cell.rgb[1], cell.rgb[2]);
      pdf.rect(
        startX + x * cellSize,
        startY + y * cellSize,
        cellSize,
        cellSize,
        "F",
      );
    }
  }

  // 网格线
  pdf.setDrawColor(80, 90, 105);
  pdf.setLineWidth(0.08);
  for (let x = 0; x <= cols; x += 1) {
    pdf.line(
      startX + x * cellSize,
      startY,
      startX + x * cellSize,
      startY + gridHeight,
    );
  }
  for (let y = 0; y <= rows; y += 1) {
    pdf.line(
      startX,
      startY + y * cellSize,
      startX + gridWidth,
      startY + y * cellSize,
    );
  }

  // 色号：格子足够大时才绘制
  if ((options.showCodes ?? true) && cellSize >= 3.2) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(Math.max(3, cellSize * 0.9));

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const cell = grid[y][x];
        const [r, g, b] = cell.rgb;
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        if (luminance > 155) {
          pdf.setTextColor(31, 41, 55);
        } else {
          pdf.setTextColor(255, 255, 255);
        }
        pdf.text(
          cell.color.code,
          startX + x * cellSize + cellSize / 2,
          startY + y * cellSize + cellSize / 2 + cellSize * 0.28,
          { align: "center" },
        );
      }
    }
  }

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(120, 128, 140);
  pdf.text(
    "Generated with Perler Beads Tool - 1:1 color reference only",
    MARGIN,
    PAGE_HEIGHT - MARGIN,
  );

  // ---------- 材料清单页 ----------
  pdf.addPage();
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(17, 24, 39);
  pdf.text("Bead list", MARGIN, MARGIN + 5);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(90, 100, 115);
  pdf.text(
    `${stats.uniqueColors} colors | ${stats.total} beads total`,
    MARGIN,
    MARGIN + 10,
  );

  let cursorY = MARGIN + 20;
  const rowHeight = 7;
  const swatch = 4.5;

  for (let i = 0; i < stats.items.length; i += 1) {
    if (cursorY > PAGE_HEIGHT - MARGIN - rowHeight) {
      pdf.addPage();
      cursorY = MARGIN + 10;
    }

    const item = stats.items[i];
    pdf.setFillColor(item.color.hex);
    pdf.setDrawColor(180, 185, 195);
    pdf.setLineWidth(0.15);
    pdf.rect(MARGIN, cursorY - swatch + 1, swatch, swatch, "FD");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(31, 41, 55);
    pdf.text(item.color.code, MARGIN + 8, cursorY);

    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(90, 100, 115);
    pdf.text(item.color.hex, MARGIN + 22, cursorY);
    pdf.text(
      `x ${item.count}  (${(item.ratio * 100).toFixed(1)}%)`,
      MARGIN + 48,
      cursorY,
    );

    cursorY += rowHeight;
  }

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(140, 148, 160);
    pdf.text(
      `Page ${page} / ${pageCount}`,
      PAGE_WIDTH - MARGIN,
      PAGE_HEIGHT - MARGIN,
      { align: "right" },
    );
  }

  pdf.save(formatFilename(options.brandName, cols, rows));
}
