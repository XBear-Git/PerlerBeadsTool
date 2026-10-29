import { hexToRgb } from "@/lib/colorMatch";
import type { BeadCell, BeadGrid, BeadPalette, GridSize } from "@/types";
import {
  TRANSPARENT_PALETTE_INDEX,
  type MatchWorkerFailure,
  type MatchWorkerRequest,
  type MatchWorkerResponse,
  type MatchWorkerSuccess,
} from "@/lib/workers/protocol";

/**
 * Worker 调用封装。
 *
 * - 主线程把 HTMLImageElement / ImageBitmap 交给 createImageBitmap，
 *   再以 Transferable 方式把 ImageBitmap 转移给 Worker（零拷贝）；
 * - Worker 只回传 Uint16Array 的 buffer（同样 Transferable），
 *   主线程用色卡把它重建为 BeadGrid；
 * - 所有请求通过自增 id 关联 Promise，支持取消。
 */

export interface ProcessImageOptions {
  image: ImageBitmapSource;
  size: GridSize;
  palette: BeadPalette;
  dither: boolean;
  signal?: AbortSignal;
}

interface PendingRequest {
  width: number;
  height: number;
  palette: BeadPalette;
  resolve: (grid: BeadGrid) => void;
  reject: (reason: unknown) => void;
  cleanup: () => void;
}

let worker: Worker | null = null;
let nextRequestId = 1;
const pending = new Map<number, PendingRequest>();

function createAbortError(): Error {
  const error = new Error("图片处理已取消。");
  error.name = "AbortError";
  return error;
}

function rejectAll(reason: unknown): void {
  for (const request of pending.values()) {
    request.cleanup();
    request.reject(reason);
  }
  pending.clear();
}

function buildGrid(
  palette: BeadPalette,
  width: number,
  height: number,
  buffer: ArrayBuffer,
): BeadGrid {
  const indices = new Uint16Array(buffer);
  if (indices.length !== width * height) {
    throw new Error("Worker 返回的像素数量与网格尺寸不一致。");
  }

  const cells: BeadCell[] = palette.colors.map((color) => ({
    color,
    rgb: hexToRgb(color.hex),
  }));

  const grid: BeadGrid = [];
  for (let y = 0; y < height; y += 1) {
    const row: (BeadCell | null)[] = [];
    for (let x = 0; x < width; x += 1) {
      const index = indices[y * width + x];
      if (index === TRANSPARENT_PALETTE_INDEX) {
        row.push(null);
        continue;
      }

      const cell = cells[index];
      if (!cell) {
        throw new Error(`Worker 返回了越界的色卡下标：${index}`);
      }
      row.push(cell);
    }
    grid.push(row);
  }

  return grid;
}

function handleMessage(event: MessageEvent<MatchWorkerResponse>): void {
  const message = event.data;
  const request = pending.get(message.id);
  if (!request) return;

  pending.delete(message.id);
  request.cleanup();

  if (message.type === "error") {
    request.reject(new Error((message as MatchWorkerFailure).message));
    return;
  }

  const success = message as MatchWorkerSuccess;
  if (success.width !== request.width || success.height !== request.height) {
    request.reject(
      new Error(
        `Worker 返回尺寸不一致：期望 ${request.width}×${request.height}，实际 ${success.width}×${success.height}`,
      ),
    );
    return;
  }

  try {
    request.resolve(
      buildGrid(request.palette, success.width, success.height, success.indices),
    );
  } catch (cause) {
    request.reject(cause);
  }
}

function failWorker(reason: unknown): void {
  const current = worker;
  worker = null;
  current?.terminate();
  rejectAll(reason);
}

function ensureWorker(): Worker {
  if (worker) return worker;
  if (typeof Worker === "undefined") {
    throw new Error("当前浏览器不支持 Web Worker。");
  }

  const created = new Worker(
    new URL("./workers/match.worker.ts", import.meta.url),
    { type: "module", name: "bead-match" },
  );

  created.onmessage = handleMessage;
  created.onerror = (event) => {
    event.preventDefault();
    failWorker(
      new Error(event.message || "颜色匹配 Worker 启动或运行失败。"),
    );
  };
  created.onmessageerror = () => {
    failWorker(new Error("Worker 返回的数据无法反序列化。"));
  };

  worker = created;
  return created;
}

/** 取消当前 Worker 中尚未完成的请求，并终止 Worker（下次请求时按需重建） */
export function cancelMatchWorker(): void {
  const current = worker;
  worker = null;

  if (current) {
    current.terminate();
  }
  if (pending.size > 0) {
    rejectAll(createAbortError());
  }
}

/**
 * 在 Worker 中完成「像素化 + 色卡匹配」。
 * 返回重建后的 BeadGrid；调用方无需关心 Worker 通信细节。
 */
export async function processImageInWorker({
  image,
  size,
  palette,
  dither,
  signal,
}: ProcessImageOptions): Promise<BeadGrid> {
  if (typeof window === "undefined") {
    throw new Error("processImageInWorker 只能在浏览器中调用。");
  }
  if (signal?.aborted) {
    throw createAbortError();
  }
  if (
    !Number.isInteger(size.width) ||
    !Number.isInteger(size.height) ||
    size.width <= 0 ||
    size.height <= 0
  ) {
    throw new Error("目标网格尺寸必须为正整数。");
  }

  // 每次请求都从原图重新生成 ImageBitmap，避免转移后主线程丢失源图
  const bitmap = await createImageBitmap(image);
  if (signal?.aborted) {
    bitmap.close();
    throw createAbortError();
  }

  const id = nextRequestId;
  nextRequestId += 1;

  return new Promise<BeadGrid>((resolve, reject) => {
    const onAbort = () => {
      if (!pending.has(id)) return;

      pending.delete(id);
      reject(createAbortError());

      // 当前 Worker 正在计算这张图，没有其它请求时直接终止以停止计算
      if (pending.size === 0) {
        const current = worker;
        worker = null;
        current?.terminate();
      }
    };

    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
    };

    pending.set(id, {
      width: size.width,
      height: size.height,
      palette,
      resolve,
      reject,
      cleanup,
    });
    signal?.addEventListener("abort", onAbort, { once: true });

    try {
      const instance = ensureWorker();
      const request: MatchWorkerRequest = {
        type: "process",
        id,
        image: bitmap,
        size,
        palette,
        dither,
      };
      // ImageBitmap 转移后主线程不可再用，Worker 内绘制完会 close
      instance.postMessage(request, [bitmap]);
    } catch (cause) {
      pending.delete(id);
      cleanup();
      bitmap.close();
      reject(cause);
    }
  });
}
