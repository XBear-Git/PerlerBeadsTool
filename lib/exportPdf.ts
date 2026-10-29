import type { jsPDF as JsPdfDocument } from "jspdf";

import {
  buildPatternFilename,
  DEFAULT_PATTERN_NAME,
} from "@/lib/filename";
import { PDF_FONT_FAMILY, registerPdfFont } from "@/lib/pdfFont";
import { computeStats } from "@/lib/stats";
import type { BeadCell, BeadGrid } from "@/types";

/**
 * PDF 导出封装（A4 自动分页）。
 *
 * 版式约定：
 * - A4 纵向 210 × 297 mm，每页最多 32 × 32 格；
 * - 每页顶部标出该页覆盖的列范围（A、B…AA）与行范围（1、2…）；
 * - 图纸页按「先左右、后上下」拆分，页脚统一标注 Page x / y；
 * - 材料清单固定在所有图纸页之后，内容过多时自动续页。
 *
 * 说明：jsPDF 内置字体不含中文，PDF 中的标题、坐标、色号与色名均使用 ASCII；
 * 网页端仍展示完整中文界面。若需中文 PDF，可在 public/fonts 放 TTF 后注册。
 */

export const PDF_PAGE_WIDTH = 210;
export const PDF_PAGE_HEIGHT = 297;

/** 每页固定格数（横向 / 纵向） */
export const PDF_CELLS_PER_PAGE_X = 32;
export const PDF_CELLS_PER_PAGE_Y = 32;

const MARGIN = 8;
const HEADER_HEIGHT = 14;
const FOOTER_HEIGHT = 8;
const ROW_LABEL_WIDTH = 7;
const COL_LABEL_HEIGHT = 5;
const BOM_ROW_HEIGHT = 7;

export interface PdfExportOptions {
  brandName: string;
  /** 用户自定义的图纸名称，用于 PDF 标题与文件名 */
  patternName: string;
  showCodes?: boolean;
}

/** 一页图纸覆盖的数据范围（索引均从 0 开始） */
export interface PdfTile {
  /** 图纸页序号，从 1 开始 */
  index: number;
  colStart: number;
  rowStart: number;
  cols: number;
  rows: number;
}

/** 0 → A，25 → Z，26 → AA，701 → ZZ，702 → AAA */
export function toColumnLabel(index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error("列索引必须是非负整数");
  }

  let value = index + 1;
  let label = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }

  return label;
}

/** 把整张图纸按 32×32 拆成 PDF 页 */
export function createPdfTiles(cols: number, rows: number): PdfTile[] {
  if (
    !Number.isInteger(cols) ||
    !Number.isInteger(rows) ||
    cols <= 0 ||
    rows <= 0
  ) {
    throw new Error("图纸行列数必须为正整数");
  }

  const tiles: PdfTile[] = [];

  for (let rowStart = 0; rowStart < rows; rowStart += PDF_CELLS_PER_PAGE_Y) {
    for (let colStart = 0; colStart < cols; colStart += PDF_CELLS_PER_PAGE_X) {
      tiles.push({
        index: tiles.length + 1,
        colStart,
        rowStart,
        cols: Math.min(PDF_CELLS_PER_PAGE_X, cols - colStart),
        rows: Math.min(PDF_CELLS_PER_PAGE_Y, rows - rowStart),
      });
    }
  }

  return tiles;
}

const TITLE_MAX_WIDTH = PDF_PAGE_WIDTH - MARGIN * 2;
const TITLE_MAX_HEIGHT = 6;

/** 统一字体切换：注册成功时全部使用 Noto Sans SC，否则回退内置字体 */
function setPdfFont(
  pdf: JsPdfDocument,
  hasCjkFont: boolean,
  size: number,
  bold = false,
): void {
  pdf.setFont(
    hasCjkFont ? PDF_FONT_FAMILY : "helvetica",
    hasCjkFont ? "normal" : bold ? "bold" : "normal",
  );
  pdf.setFontSize(size);
}

/**
 * 将中文/混合标题栅格化为高分辨率 PNG。
 * jsPDF 内置 Helvetica 不含中文字形，直接写文字会乱码；
 * 用 Canvas 以系统字体绘制后再嵌入，可支持任意中文图纸名。
 */
function createTitleImage(text: string): {
  dataUrl: string;
  width: number;
  height: number;
} {
  const fontSize = 64;
  const paddingX = 8;

  const canvas = document.createElement("canvas");
  const measureContext = canvas.getContext("2d");
  if (!measureContext) {
    throw new Error("当前浏览器不支持 Canvas 2D，无法渲染中文 PDF 标题。");
  }

  const font = `700 ${fontSize}px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", "Segoe UI", sans-serif`;
  measureContext.font = font;
  const metrics = measureContext.measureText(text);

  canvas.width = Math.max(1, Math.ceil(metrics.width + paddingX * 2));
  canvas.height = Math.ceil(fontSize * 1.4);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("当前浏览器不支持 Canvas 2D，无法渲染中文 PDF 标题。");
  }

  context.font = font;
  context.textBaseline = "middle";
  context.fillStyle = "#111827";
  context.fillText(text, paddingX, canvas.height / 2);

  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * 绘制页标题：
 * - 注册中文字体后，所有标题都用 Noto Sans SC 矢量文字；
 * - 字体加载失败时，ASCII 回退 Helvetica，中文回退 Canvas 位图。
 */
function drawTitle(
  pdf: JsPdfDocument,
  title: string,
  hasCjkFont: boolean,
): void {
  if (hasCjkFont) {
    let fontSize = 13;
    setPdfFont(pdf, true, fontSize, true);

    while (pdf.getTextWidth(title) > TITLE_MAX_WIDTH && fontSize > 8) {
      fontSize -= 0.5;
      setPdfFont(pdf, true, fontSize, true);
    }

    pdf.setTextColor(17, 24, 39);
    pdf.text(title, MARGIN, MARGIN + 5);
    return;
  }

  if (/^[\x20-\x7E]+$/.test(title)) {
    pdf.setFont("helvetica", "bold");
    let fontSize = 13;
    pdf.setFontSize(fontSize);

    while (pdf.getTextWidth(title) > TITLE_MAX_WIDTH && fontSize > 8) {
      fontSize -= 0.5;
      pdf.setFontSize(fontSize);
    }

    pdf.setTextColor(17, 24, 39);
    pdf.text(title, MARGIN, MARGIN + 5);
    return;
  }

  const image = createTitleImage(title);
  let height = TITLE_MAX_HEIGHT;
  let width = (image.width / image.height) * height;

  if (width > TITLE_MAX_WIDTH) {
    width = TITLE_MAX_WIDTH;
    height = (image.height / image.width) * width;
  }

  pdf.addImage(image.dataUrl, "PNG", MARGIN, MARGIN - 0.8, width, height);
}

function readableTextColor(cell: BeadCell): [number, number, number] {
  const [r, g, b] = cell.rgb;
  return 0.299 * r + 0.587 * g + 0.114 * b > 155
    ? [31, 41, 55]
    : [255, 255, 255];
}

/**
 * 绘制一页图纸（含标题、列/行坐标、网格与色号）。
 * cellSize 在所有页保持一致，保证跨页打印后格子等大。
 */
function drawPatternPage(
  pdf: JsPdfDocument,
  grid: BeadGrid,
  tile: PdfTile,
  tileCount: number,
  cols: number,
  rows: number,
  totalBeads: number,
  transparentCells: number,
  hasCjkFont: boolean,
  options: PdfExportOptions,
  cellSize: number,
  gridX: number,
  gridY: number,
): void {
  const patternName = options.patternName.trim() || DEFAULT_PATTERN_NAME;

  drawTitle(pdf, `${patternName} - Part ${tile.index} / ${tileCount}`, hasCjkFont);

  const firstColumn = toColumnLabel(tile.colStart);
  const lastColumn = toColumnLabel(tile.colStart + tile.cols - 1);
  const firstRow = tile.rowStart + 1;
  const lastRow = tile.rowStart + tile.rows;

  setPdfFont(pdf, hasCjkFont, 7.5);
  pdf.setTextColor(90, 100, 115);
  const infoLine = hasCjkFont
    ? `${options.brandName} | ${cols} × ${rows} 格 | 列 ${firstColumn}-${lastColumn} | 行 ${firstRow}-${lastRow} | ${totalBeads} 颗${transparentCells > 0 ? ` | ${transparentCells} 透明` : ""}`
    : `${options.brandName} | ${cols} x ${rows} cells | columns ${firstColumn}-${lastColumn} | rows ${firstRow}-${lastRow} | ${totalBeads} beads${transparentCells > 0 ? ` | ${transparentCells} transparent` : ""}`;

  pdf.text(infoLine, MARGIN, MARGIN + 10);

  // 1. 填色（透明格留空）
  for (let localRow = 0; localRow < tile.rows; localRow += 1) {
    for (let localCol = 0; localCol < tile.cols; localCol += 1) {
      const cell = grid[tile.rowStart + localRow][tile.colStart + localCol];
      if (!cell) continue;

      pdf.setFillColor(cell.rgb[0], cell.rgb[1], cell.rgb[2]);
      pdf.rect(
        gridX + localCol * cellSize,
        gridY + localRow * cellSize,
        cellSize,
        cellSize,
        "F",
      );
    }
  }

  // 2. 网格线
  pdf.setDrawColor(80, 90, 105);
  pdf.setLineWidth(0.08);
  for (let localCol = 0; localCol <= tile.cols; localCol += 1) {
    const x = gridX + localCol * cellSize;
    pdf.line(x, gridY, x, gridY + tile.rows * cellSize);
  }
  for (let localRow = 0; localRow <= tile.rows; localRow += 1) {
    const y = gridY + localRow * cellSize;
    pdf.line(gridX, y, gridX + tile.cols * cellSize, y);
  }

  pdf.setDrawColor(31, 41, 55);
  pdf.setLineWidth(0.35);
  pdf.rect(
    gridX,
    gridY,
    tile.cols * cellSize,
    tile.rows * cellSize,
    "S",
  );

  // 3. 格内色号
  if ((options.showCodes ?? true) && cellSize >= 3.2) {
    setPdfFont(pdf, hasCjkFont, Math.max(3.2, cellSize * 0.95), true);

    for (let localRow = 0; localRow < tile.rows; localRow += 1) {
      for (let localCol = 0; localCol < tile.cols; localCol += 1) {
        const cell = grid[tile.rowStart + localRow][tile.colStart + localCol];
        if (!cell) continue;

        const [r, g, b] = readableTextColor(cell);
        pdf.setTextColor(r, g, b);
        pdf.text(
          cell.color.code,
          gridX + localCol * cellSize + cellSize / 2,
          gridY + localRow * cellSize + cellSize * 0.8,
          { align: "center" },
        );
      }
    }
  }

  // 4. 行列坐标（全局索引，便于跨页定位）
  setPdfFont(pdf, hasCjkFont, 5.5, true);
  pdf.setTextColor(71, 85, 105);

  for (let localCol = 0; localCol < tile.cols; localCol += 1) {
    pdf.text(
      toColumnLabel(tile.colStart + localCol),
      gridX + (localCol + 0.5) * cellSize,
      gridY - 1.8,
      { align: "center" },
    );
  }

  for (let localRow = 0; localRow < tile.rows; localRow += 1) {
    pdf.text(
      String(tile.rowStart + localRow + 1),
      gridX - 1.5,
      gridY + (localRow + 0.5) * cellSize + 0.8,
      { align: "right" },
    );
  }
}

/** 绘制一页材料清单 */
function drawBomPage(
  pdf: JsPdfDocument,
  items: ReturnType<typeof computeStats>["items"],
  pageIndex: number,
  pageCount: number,
  brandName: string,
  totalBeads: number,
  uniqueColors: number,
  transparentCells: number,
  hasCjkFont: boolean,
  startIndex: number,
  endIndex: number,
): void {
  const title = hasCjkFont
    ? pageIndex === 0
      ? "材料清单"
      : "材料清单（续）"
    : pageIndex === 0
      ? "Bead list"
      : "Bead list (continued)";

  setPdfFont(pdf, hasCjkFont, 14, true);
  pdf.setTextColor(17, 24, 39);
  pdf.text(title, MARGIN, MARGIN + 5);

  setPdfFont(pdf, hasCjkFont, 8);
  pdf.setTextColor(90, 100, 115);
  const summary =
    pageIndex === 0
      ? hasCjkFont
        ? `${brandName} | ${uniqueColors} 色 | ${totalBeads} 颗${transparentCells > 0 ? ` | ${transparentCells} 透明` : ""}`
        : `${brandName} | ${uniqueColors} colors | ${totalBeads} beads total${transparentCells > 0 ? ` | ${transparentCells} transparent` : ""}`
      : hasCjkFont
        ? `${brandName} | 第 ${pageIndex + 1} / ${pageCount} 页`
        : `${brandName} | page ${pageIndex + 1} / ${pageCount}`;

  pdf.text(summary, MARGIN, MARGIN + 10);

  // 表头
  setPdfFont(pdf, hasCjkFont, 6.5, true);
  pdf.setTextColor(120, 128, 140);
  pdf.text(hasCjkFont ? "色号" : "Code", MARGIN + 6, MARGIN + 16);
  pdf.text(hasCjkFont ? "名称" : "Name", MARGIN + 24, MARGIN + 16);
  pdf.text("Hex", MARGIN + 112, MARGIN + 16);
  pdf.text(hasCjkFont ? "数量" : "Qty", PDF_PAGE_WIDTH - MARGIN, MARGIN + 16, {
    align: "right",
  });

  let cursorY = MARGIN + 21;

  for (let index = startIndex; index < endIndex; index += 1) {
    const item = items[index];

    // 色块
    pdf.setFillColor(item.color.hex);
    pdf.setDrawColor(180, 185, 195);
    pdf.setLineWidth(0.15);
    pdf.rect(MARGIN, cursorY - 3.4, 4.4, 4.4, "FD");

    // 色号
    setPdfFont(pdf, hasCjkFont, 8, true);
    pdf.setTextColor(31, 41, 55);
    pdf.text(item.color.code, MARGIN + 7, cursorY);

    // 色名
    setPdfFont(pdf, hasCjkFont, 7.5);
    pdf.setTextColor(71, 85, 105);
    pdf.text(item.color.name, MARGIN + 24, cursorY);

    // hex
    setPdfFont(pdf, hasCjkFont, 7);
    pdf.setTextColor(120, 128, 140);
    pdf.text(item.color.hex, MARGIN + 112, cursorY);

    // 数量与占比
    setPdfFont(pdf, hasCjkFont, 7.5);
    pdf.setTextColor(31, 41, 55);
    pdf.text(
      `${item.count}  (${(item.ratio * 100).toFixed(1)}%)`,
      PDF_PAGE_WIDTH - MARGIN,
      cursorY,
      { align: "right" },
    );

    cursorY += BOM_ROW_HEIGHT;
  }
}

/** 所有页面完成后统一写页脚，确保 Page x / y 中的 y 是最终总页数 */
function drawFooters(pdf: JsPdfDocument, hasCjkFont: boolean): void {
  const pageCount = pdf.getNumberOfPages();

  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    setPdfFont(pdf, hasCjkFont, 7);
    pdf.setTextColor(140, 148, 160);
    pdf.text(
      hasCjkFont ? "由拼豆图纸生成器导出" : "Generated with Perler Beads Tool",
      MARGIN,
      PDF_PAGE_HEIGHT - MARGIN,
    );
    pdf.text(
      hasCjkFont ? `第 ${page} / ${pageCount} 页` : `Page ${page} / ${pageCount}`,
      PDF_PAGE_WIDTH - MARGIN,
      PDF_PAGE_HEIGHT - MARGIN,
      { align: "right" },
    );
  }
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

  const tiles = createPdfTiles(cols, rows);
  const stats = computeStats(grid);

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const hasCjkFont = await registerPdfFont(pdf);

  pdf.setProperties({
    title: options.patternName.trim() || DEFAULT_PATTERN_NAME,
    creator: "Perler Beads Tool",
  });

  // 统一格子尺寸：以 32 格宽为基准，并保证纵向不超出页脚
  const availableTop = MARGIN + HEADER_HEIGHT + COL_LABEL_HEIGHT;
  const availableBottom = PDF_PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT;
  const contentWidth = PDF_PAGE_WIDTH - MARGIN * 2 - ROW_LABEL_WIDTH;
  const contentHeight = availableBottom - availableTop;

  const cellSize = Math.min(
    contentWidth / PDF_CELLS_PER_PAGE_X,
    contentHeight / PDF_CELLS_PER_PAGE_Y,
  );

  const gridX = MARGIN + ROW_LABEL_WIDTH;
  const gridY =
    availableTop +
    Math.max(0, (contentHeight - cellSize * PDF_CELLS_PER_PAGE_Y) / 2);

  tiles.forEach((tile, index) => {
    if (index > 0) pdf.addPage();
    drawPatternPage(
      pdf,
      grid,
      tile,
      tiles.length,
      cols,
      rows,
      stats.total,
      stats.transparent,
      hasCjkFont,
      options,
      cellSize,
      gridX,
      gridY,
    );
  });

  // ---------- 材料清单（最后一页起） ----------
  const bomTop = MARGIN + 21;
  const bomBottom = PDF_PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT;
  const bomRowsPerPage = Math.max(
    1,
    Math.floor((bomBottom - bomTop) / BOM_ROW_HEIGHT),
  );
  const bomPageCount = Math.max(
    1,
    Math.ceil(stats.items.length / bomRowsPerPage),
  );

  for (let pageIndex = 0; pageIndex < bomPageCount; pageIndex += 1) {
    pdf.addPage();
    drawBomPage(
      pdf,
      stats.items,
      pageIndex,
      bomPageCount,
      options.brandName,
      stats.total,
      stats.uniqueColors,
      stats.transparent,
      hasCjkFont,
      pageIndex * bomRowsPerPage,
      Math.min(stats.items.length, (pageIndex + 1) * bomRowsPerPage),
    );
  }

  drawFooters(pdf, hasCjkFont);

  pdf.save(
    buildPatternFilename({
      patternName: options.patternName,
      brandName: options.brandName,
      cols,
      rows,
      extension: "pdf",
    }),
  );
}
