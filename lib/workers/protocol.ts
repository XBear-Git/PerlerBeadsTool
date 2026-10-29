import type { BeadPalette, GridSize } from "../../types";

/** Uint16 中的透明哨兵值；正常色卡下标必须小于该值 */
export const TRANSPARENT_PALETTE_INDEX = 0xffff;

/** 主线程 → Worker：传输已解码的 ImageBitmap（零拷贝） */
export interface MatchWorkerRequest {
  type: "process";
  id: number;
  image: ImageBitmap;
  size: GridSize;
  palette: BeadPalette;
  dither: boolean;
}

/** Worker → 主线程：返回每格在色卡中的下标，buffer 参与 Transferable 传输 */
export interface MatchWorkerSuccess {
  type: "result";
  id: number;
  width: number;
  height: number;
  indices: ArrayBuffer;
}

export interface MatchWorkerFailure {
  type: "error";
  id: number;
  message: string;
}

export type MatchWorkerResponse = MatchWorkerSuccess | MatchWorkerFailure;
