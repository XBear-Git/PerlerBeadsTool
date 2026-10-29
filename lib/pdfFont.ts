import type { jsPDF as JsPdfDocument } from "jspdf";

/**
 * PDF 中文字体加载与注册。
 *
 * 使用 Noto Sans SC Regular（SIL Open Font License 1.1），
 * 字体文件位于 public/fonts/NotoSansSC-Regular.ttf。
 * 首次导出时 fetch 并转 base64，之后复用缓存，避免重复读取 2 MB 字体。
 */

export const PDF_FONT_FAMILY = "NotoSansSC";
export const PDF_FONT_FILE = "NotoSansSC-Regular.ttf";
export const PDF_FONT_URL = "/fonts/NotoSansSC-Regular.ttf";

let base64Promise: Promise<string> | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

/** 读取并缓存字体 base64；失败时清空缓存，允许下次重试 */
export function loadPdfFontBase64(): Promise<string> {
  if (!base64Promise) {
    base64Promise = fetch(PDF_FONT_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`加载 PDF 中文字体失败：HTTP ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then(arrayBufferToBase64)
      .catch((cause) => {
        base64Promise = null;
        throw cause;
      });
  }

  return base64Promise;
}

/**
 * 向 jsPDF 注册 Noto Sans SC。
 * 返回 false 表示字体加载失败，调用方可退回内置字体/标题位图方案。
 */
export async function registerPdfFont(
  pdf: JsPdfDocument,
): Promise<boolean> {
  try {
    const base64 = await loadPdfFontBase64();
    pdf.addFileToVFS(PDF_FONT_FILE, base64);
    pdf.addFont(PDF_FONT_FILE, PDF_FONT_FAMILY, "normal");
    return true;
  } catch (cause) {
    console.warn("PDF 中文字体加载失败，将使用内置字体。", cause);
    return false;
  }
}
