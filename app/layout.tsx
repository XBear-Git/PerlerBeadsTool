import type { Metadata } from "next";
import { Geist } from "next/font/google";

import "./globals.css";

import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "拼豆图纸生成器 | Perler Beads Pattern Studio",
  description:
    "上传任意图片，自动像素化并匹配 Perler / Artkal / Hama 拼豆色卡，生成带网格与色号的实体图纸，支持 PNG / PDF 导出。",
  keywords: ["拼豆", "Perler", "Artkal", "Hama", "像素画", "图纸生成"],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className={cn("font-sans", geist.variable)}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
