# SEZ Studio — Liquid Desktop

面向 AI、SaaS 与硬件品牌的液态玻璃工作室体验。主站是一块可以操作的手机桌面，电脑上还可以进入完整的 SEZ 电脑桌面；桌面内包含 **SEZ Studio** 服务、报价、案例与项目简报窗口。

**在线地址：** https://sezgta.github.io/sez/

## 两套桌面

### SEZ 手机桌面

点击站点任意「唤醒 SEZ」进入：

- 实时首页、天气组件、四枚玻璃应用图标与玻璃 Dock。
- 天气 / 笔记 / 照片 / 设置四个应用。
- 控制中心、搜索、音乐、专注四个系统模块。
- 笔记自动保存在本机，音乐使用 Web Audio 实时合成环境音，专注支持 25 / 45 / 5 分钟计时。
- 应用从图标位置展开；从底部上滑或点击横条返回；Esc 逐层退出。

### SEZ 电脑桌面

点击首屏「电脑桌面」或顶部「Studio」进入：

- 菜单栏、桌面图标、玻璃小组件、底部 Dock 与可拖动的多窗口。
- 欢迎、天气、笔记、照片、音乐、设置、专注、Studio 八个窗口。
- 窗口支持拖动、缩放、最小化、最大化、双击标题栏最大化、关闭与层级置顶。
- 透明液态玻璃窗口：壁纸透视、激活窗口 SVG 折射、跟随鼠标的玻璃高光。
- 控制中心、Spotlight 搜索（⌘/Ctrl + K）、壁纸与光色切换、柔和流动开关。

## SEZ Studio 商业层

Studio 窗口包含：

- **服务包**：Liquid Sprint / Liquid Launch / Experience Retainer。
- **报价范围**：¥30k–50k、¥80k–200k、¥15k–40k / mo。
- **案例**：SEZ 自研案例 + Aurora、Morrow 两个明确标注的概念研究。
- **流程**：诊断 → 编排 → 构建 → 发布。
- **项目简报表单**：姓名、邮箱、产品、预算、时间、介绍与联系授权。
- 表单可生成并复制项目简报；配置邮箱或表单端点后可直接发送。
- 顶部「Studio」、页尾「SEZ Studio」、电脑桌面图标与 Dock 都可以打开它。

### 接单配置

商业联系信息集中在 `studio-config.js`：

```js
window.SEZ_STUDIO = {
  email: '',     // 你的接单邮箱
  endpoint: '',  // 可选：接收 JSON POST 的表单端点
};
```

当前为空，表单处于「生成并复制简报」模式。填入真实接单邮箱后重新部署，提交按钮会变成「发送项目简报」，并打开预填邮件草稿。若使用 Formspree / 自建 Cloudflare Worker，把 HTTPS endpoint 填进第二项即可直接 POST。

## 移动端加固

- 触控镜片使用 pointer capture + window 级释放，拖出预览区域、滚动、切后台都会收起，不再卡泡。
- 关闭了移动端高成本的 SVG 位移滤镜和全屏模糊，改用轻量 blur/渐变。
- 手机视口使用 `100svh`，避免地址栏伸缩导致桌面跳动。
- 返回键通过 history state 关闭桌面，不再离开页面或重载；页面禁止下拉刷新和横向溢出。
- 横屏时显示旋转提示；手机上的 Studio 通过页尾按钮打开全屏窗口。
- 应用打开 / 关闭在移动端改用轻量位移淡入，避免全屏缩放带来的闪退风险。

## 技术 / 部署

- 原生 HTML / CSS / JavaScript，无构建步骤、无第三方运行时依赖。
- CSS 变量、`backdrop-filter`、SVG `feTurbulence + feDisplacementMap` 液态折射。
- Web Animations API 窗口与应用动画；Web Audio API 生成环境音。
- 页面中没有任何 `<a>` 标签或外部跳转链接。
- 主站与全部资源托管在 GitHub Pages，服务期记录为 **2026-11-11 → 2027-11-11**。

## 本地预览

```powershell
cd "D:\鱼的工作区\liquid-glass-site"
python -m http.server 4173
```

打开 `http://127.0.0.1:4173/`。

## 文件

- `index.html` — 主站、手机桌面、电脑桌面、Studio
- `styles.css` — 主站与手机桌面
- `app.js` — 主站交互与触控镜片
- `desktop.js` — 手机桌面控制器
- `pc.css` / `pc.js` — 电脑桌面、透明玻璃窗口、Studio 窗口与表单
- `studio-config.js` — 商业接单配置
- `assets/` — 壁纸、图标、社交分享图

## 版权

SEZ © 2026 · 独立概念体验。  
灵感来自 Kyant0 的开源 Backdrop 项目，Apache-2.0。
