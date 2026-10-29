# 拼豆图纸生成器（Perler Beads Pattern Studio）

上传任意图片，自动像素化并匹配 Perler / Artkal / Hama 实际拼豆色卡，生成带网格线与色号的「实体图纸」，支持 PNG / PDF 下载与材料清单统计。

> 纯前端实现：图片只在本地浏览器处理，不上传服务器；全部算法在 Canvas / TypeScript 中完成。

## 功能状态

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| 图片上传与校验 | ✅ | 点击 / 拖拽，限制 PNG/JPG/WebP、20 MB、4000 万像素 |
| 图片裁剪 | ✅ | 上传后弹窗裁剪，支持缩放、常用比例与自定义比例 |
| 像素化 | ✅ | Worker + OffscreenCanvas 高质量降采样，最长边 32–128 格，保持宽高比 |
| 色盘匹配 | ✅ | Worker 内完成 sRGB → CIELAB + CIEDE2000 逐像素匹配 |
| 透明像素 | ✅ | alpha < 128 跳过匹配，BOM 与渲染排除，PNG 保留透明通道 |
| 图纸生成 | ✅ | 网格线、填色、格内色号，小格自动隐藏色号 |
| PNG 导出 | ✅ | 独立离屏画布渲染，32 px/格 |
| PDF 导出 | ✅ | jsPDF 矢量网格，A4 自动分页 |
| 自定义图纸名称 | ✅ | 用于 PDF 标题与 PNG/PDF 文件名：名称-品牌-长x宽 |
| 品牌切换 | ✅ | Perler / Artkal / Hama，实时重算 |
| 画布微调 | ✅ | 选色后点击格子改色，支持 10 步撤销与一键清空修改 |
| 材料清单（BOM） | ✅ | 按色号聚合，降序展示数量与占比 |
| Floyd-Steinberg 抖动 | ✅ | 可选开关；会增加用色数量 |
| 多页图纸 | ✅ | 每页 32×32 格，带页码与全局行列坐标 |
| 移动端适配 | ✅ | Tailwind 响应式，窄屏单列布局 |

## 技术栈

- **Next.js 16**（App Router）+ **React 19** + **TypeScript**（严格模式）
- **TailwindCSS 4** + **shadcn/ui**（Base UI 组件）
- **Canvas 2D**：像素化、图纸渲染
- **react-easy-crop**：上传后的交互式裁剪
- **Web Worker + OffscreenCanvas**：像素化与颜色匹配后台计算
- **jsPDF**：矢量 PDF 导出
- **Noto Sans SC（OFL）**：PDF 中文字体嵌入
- **Vitest**：核心算法单元测试
- **pnpm**：包管理

## 本地启动

要求：Node.js >= 20.9（本项目在 Node 24 下开发）、pnpm 12。

```bash
# 如未安装 pnpm
npm install -g pnpm

pnpm install
pnpm dev          # http://localhost:3000
```

其他命令：

```bash
pnpm build        # 生产构建
pnpm start        # 启动生产构建
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
pnpm test         # Vitest（一次性）
pnpm test:watch   # Vitest watch
```

本项目不需要任何环境变量。

## 目录结构

```text
app/
  page.tsx                 # 主页面：组合上传、参数、预览、BOM、导出
  layout.tsx               # 根布局、字体与元数据
  globals.css              # Tailwind + shadcn 主题变量
  icon.svg                 # 站点图标
components/
  Uploader.tsx             # 图片上传、拖拽与展示
  CropperModal.tsx         # 裁剪弹窗：缩放、比例、裁剪 Blob
  Settings.tsx             # 品牌、网格、抖动、色号开关
  Preview.tsx              # Canvas 图纸预览 + 画笔取色
  ExportBar.tsx            # PNG / PDF 导出与图纸名称
  BomList.tsx              # 材料清单表格
  ui/                      # shadcn/ui 基础组件
hooks/
  useBeadProject.ts        # 项目状态、裁剪、Worker 流水线
lib/
  pixelate.ts              # 图片读取、尺寸计算、URL/Blob 加载
  cropImage.ts             # 按裁剪像素区域输出 Blob
  colorMatch.ts            # RGB→LAB、CIEDE2000、色卡匹配
  matchClient.ts           # Worker 调用封装（Promise + Transferable）
  dither.ts                # Floyd-Steinberg 抖动
  render.ts                # 图纸 Canvas 渲染与 PNG 下载
  stats.ts                 # 材料清单统计
  exportPdf.ts             # PDF 导出封装
  pdfFont.ts               # Noto Sans SC 加载与 jsPDF 注册
  filename.ts              # 文件名清理与统一命名
  utils.ts                 # shadcn className 工具
  workers/
    match.worker.ts        # Worker：OffscreenCanvas 像素化 + 颜色匹配
    protocol.ts            # 主线程/Worker 共享消息类型
data/beads/
  perler.json              # Perler 常用色卡（42 色）
  artkal.json              # Artkal 常用色卡（41 色）
  hama.json                # Hama 常用色卡（57 色）
  index.ts                 # 色卡注册表 + 导入校验/归一化
types/
  index.ts                 # 全局类型
tests/
  colorMatch.test.ts       # 色差与匹配测试
  pixelate.test.ts         # 网格尺寸换算测试
  stats.test.ts            # BOM 统计测试
  exportPdf.test.ts        # 分页与列坐标测试
  palettes.test.ts         # 色卡格式与数量测试
  filename.test.ts         # 导出文件名测试
public/
  fonts/
    NotoSansSC-Regular.ttf # PDF 中文字体（OFL）
    OFL.txt                # SIL Open Font License
    README.md              # 字体来源与用途
README.md
AI_REPORT.md               # AI 编程报告（持续补充）
```

## 算法说明

### 像素化（Worker）

主线程读取图片并计算目标网格尺寸，然后 `createImageBitmap` 生成可转移位图，通过 `postMessage` 的 Transferable 列表把 `ImageBitmap` 零拷贝交给 Worker。Worker 用 `OffscreenCanvas.drawImage` 高质量缩放到目标网格，再由 `getImageData` 读出 RGB 矩阵；主线程不做逐像素采样。

复杂度 O(网格面积)，但计算和内存访问都发生在 Worker，不阻塞动画、输入和加载态渲染。

### 颜色匹配（Worker）

1. sRGB 通道线性化，经 XYZ（D65）转到 CIELAB；
2. 用 CIEDE2000 计算候选色差，取最小值；
3. 对相同 RGB 做缓存，单像素 O(P)，整图 O(W×H×P)，P 为色卡颜色数。

匹配完成后，Worker 只回传 `Uint16Array` 的色卡下标，并转移其 `buffer`；主线程以 O(W×H) 重建 `BeadGrid`。这样避免结构化克隆上万个 `BeadCell` 对象。

之所以不直接用 RGB 欧氏距离，是因为 CIEDE2000 在低饱和、肤色和蓝色区域更贴近人眼判断。

### 透明像素

- Worker 读取 `ImageData` 时检查 `data[offset + 3]`，alpha < 128 视为透明；
- 透明位置在 `PixelMatrix` / `BeadGrid` 中记为 `null`，不进入色卡匹配和抖动误差扩散；
- Worker 回传下标时使用 `0xFFFF` 作为透明哨兵，主线程还原为 `null`；
- Canvas 渲染只绘制有色格子，PNG 导出保留透明通道；PDF 中透明区域留白；
- BOM 不计入透明格，`PatternStats` 额外记录透明数量与占比；超过 5% 时材料清单显示提示。

### 抖动

Floyd-Steinberg 把量化误差按 7/16、3/16、5/16、1/16 扩散到右、左下、下、右下邻居。渐变更平滑，但会增加色号与材料成本，因此默认关闭。

### PDF 分页

- A4 纵向 210 × 297 mm，每页固定 32 × 32 格；超出的部分按「先左右、后上下」拆页。
- 列坐标使用表格风格字母（A…Z、AA…AZ、BA…），行坐标使用全局数字（1…N），跨页后仍能定位到整张图的位置。
- 每页页脚统一为 `Page x / y`，`y` 在全部页面生成后计算。
- 材料清单固定排在图纸页之后；颜色较多时自动续页，仍位于整个 PDF 的最后。
- 所有页面共用同一格子尺寸，打印后可等大拼接。

### 图纸名称与导出文件名

- 「图纸名称」可在导出区自定义，默认 `拼豆图纸`；
- PDF 页眉显示：`<图纸名称> - Part x / y`；
- PNG / PDF 统一命名：`<图纸名称>-<品牌>-<宽>x<高>.<扩展名>`，例如 `暗夜魔女-Perler-48x36.png`；
- 文件名会自动清理 `<>:"/\|?*` 等非法字符，并去掉结尾的点和空格；
- PDF 标题、坐标标签、材料清单、色名与页脚使用嵌入的 Noto Sans SC，中文不再依赖 Canvas 栅格化。

### 手动修改与撤销

- 自动生成的图纸会保存为 `baseGrid`，手动改色只修改当前 `grid`；
- 每次改色记录 `{ row, col, before }`，最多保留 10 步，超出后丢弃最早一步；
- 「撤销」回退最近一步；「清空修改」直接恢复 `baseGrid`，同时清空历史；
- 切换品牌、网格尺寸或抖动后重新生成图纸，历史会自动重置。

### 图片裁剪

上传后先进入裁剪弹窗：

- 支持自由拖动、1–4× 缩放；
- 常用比例：1:1、4:3、3:4、16:9、9:16、原图；
- 自定义宽高比；
- 实时显示裁剪输出像素，最长边上限 4096 px；
- 确认后由 `lib/cropImage.ts` 按 `croppedAreaPixels` 重绘为 PNG Blob，再通过 `useBeadProject.applyCrop()` 进入 Worker 像素化流程；取消则保留上一张图纸。

### PDF 中文字体

- 字体文件：`public/fonts/NotoSansSC-Regular.ttf`（约 2.1 MB，Noto Sans SC Regular）
- 导出时 `lib/pdfFont.ts` 通过 `fetch` 读取字体，转 base64 后调用：
  - `pdf.addFileToVFS("NotoSansSC-Regular.ttf", base64)`
  - `pdf.addFont("NotoSansSC-Regular.ttf", "NotoSansSC", "normal")`
- 注册成功后 PDF 的标题、色号、坐标、材料清单与页脚统一使用 `NotoSansSC`
- 字体加载失败时回退内置 Helvetica；中文标题再回退 Canvas 位图，保证导出不中断
- 字体采用 SIL Open Font License 1.1，许可文本见 `public/fonts/OFL.txt`；来源与用途见 `public/fonts/README.md`

## 色卡数据说明

`data/beads/*.json` 已替换为常用色号：Perler 42 色、Artkal 41 色、Hama 57 色。文件顶层使用 `brand` / `verified` / `colors`，每个颜色包含 `code`、`name`、`hex`，可选 `rgb`。

导入时 `data/beads/index.ts` 会校验并归一化：

- `brand` 非空、`colors` 非空；
- 同一品牌内色号唯一；
- `hex` 必须为 `#RRGGBB`；
- 如果提供 `rgb`，三个通道必须与 `hex` 完全一致；
- 校验失败会在构建/启动阶段直接抛错，避免坏数据静默进入匹配流程。

当前 `verified` 仍为 `false`，界面显示「常用色号，建议按官方色卡复核」；完成逐色校对后可改为 `true`。

## 已知限制 / 后续计划

- PDF 使用 Noto Sans SC 中文子集（约 9000 字形），极生僻汉字可能缺字；字体加载失败时回退内置字体。
- 色卡是常用色号，并非品牌官方全色系。
- 裁剪输出为 PNG，最长边上限 4096 px；极大原图会先降采样再进入像素化。
- 图像处理已迁移到 Web Worker；图纸预览与导出渲染仍在主线程，极大网格仍受 Canvas 尺寸与内存限制。
- 透明像素在 PNG 中保留 alpha 通道；PDF 没有透明概念，透明区域按纸张白色显示。

## 交付清单

- [x] 完整可运行源码
- [x] README
- [ ] AI 编程报告（`AI_REPORT.md` 框架已建立，开发过程中持续补充）
