<div align="center">

# QRAFT

**参数化二维码生成器 · Parametric QR code generator**

纯前端静态站点，参考 [QRBTF](https://qrbtf.com) 的形态独立实现，零后端、零上传。

</div>

---

## 特性

- **8 种骨架**：经典、圆角、圆点、液态、线条、竖线、菱形、花瓣
- **4 种定位点**：方形、圆角、圆形、花瓣
- **颜色**：前景 / 背景取色，线性渐变 + 角度调节，透明背景
- **内嵌标志**：上传图片或直接拖到预览区，尺寸可调，自动切到 H 级容错
- **导出**：PNG（最高 4096px）/ SVG，矢量格式可无限放大
- **容错等级** L / M / Q / H 可选，实时显示矩阵尺寸
- **可分享链接**：`?text=…&style=dot&eye=circle&ecc=H&theme=dark&lang=en`
- 深浅色主题、中英双语、移动端适配，设置自动保存在本地

所有二维码都在浏览器里生成，没有任何请求离开你的设备。

## 快速开始

```bash
npm install
npm run dev      # http://localhost:4173
npm run build    # 输出到 dist/
npm run preview  # 预览构建产物
```

## 部署到 GitHub Pages

仓库已内置工作流（`.github/workflows/deploy.yml`），推到 `main` 即自动构建发布：

1. 新建一个**公开**仓库（例如 `qraft`），不要勾选初始化 README；
2. `git remote add origin git@github.com:<你的用户名>/qraft.git && git push -u origin main`；
3. 工作流首次运行会自动开启 Pages，完成后访问
   `https://<你的用户名>.github.io/qraft/`。

> 站点使用相对路径构建（`base: "./"`），放在仓库子路径或自定义域名下都能直接工作。

## 实现要点

- `src/qr.ts` — 用 `qrcode-generator` 生成布尔矩阵
- `src/render.ts` — 几何引擎。所有模块都表达为 SVG path，因此同一套几何既能画到
  `<svg>`，也能通过 `Path2D` 画到 `<canvas>`，预览与导出永远一致
- `src/App.tsx` — 状态、交互与导出逻辑

**关于可扫描性**：艺术化的模块会削弱二维码结构的可读性，代码里做了两点处理——
定位点单独绘制且保留标准几何；圆点 / 液态 / 菱形三种样式会把 5×5 校正图案
（alignment pattern）换成专用的环形结构。全部 8 种样式 × 长/短文本均通过
[jsQR](https://github.com/cozmo/jsQR) 解码验证，加标志时建议使用 H 级容错。

## 关于 QRBTF

[QRBTF](https://github.com/latentcat/qrbtf) 是 Latent Cat 的作品，采用 GPL-3.0 协议，
它的**参数化**部分完全在浏览器里运行，**AI** 部分则依赖他们自训练的模型与接口。

本项目是独立编写的静态实现：只借鉴了「参数化二维码生成器」这个产品形态与界面思路，
没有使用 QRBTF 的任何代码或素材，因此以 MIT 协议发布。AI 生成能力不在复刻范围内。

## License

[MIT](LICENSE)
