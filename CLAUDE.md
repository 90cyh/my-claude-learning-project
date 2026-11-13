# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 仓库性质：编号文件夹 = 产品阶段

- `001.产品PRD（产品经理）/` — 产品需求文档（PRD），**整个项目的事实来源**。含多个版本文档；**以编号最大/最新者为准**（当前：V1.0.2，云端账户 + 自建后端），历史版本仅作留存。
- `002.网站开发/` — PRD 的实现（简记，个人记账 Web 应用）。
- `003.前端代码（前端工程师）/` — 前端工程：`app/` 为多页前端（首页/明细/统计/我的/登录/注册，共享资产在 `app/assets/`）；`backend/` 为 Node.js + Express + MySQL 后端（`npm start` 启动，静态托管 `app/` 并提供 `/api/*`，连接 004 的 `jianji` 库）。Stitch 原始产物与设计令牌（DESIGN.md）归档于 `002.产品UI原型（美术设计）/UI原型/`。
- `004.数据库脚本（数据库管理员DBA）` — 数据库设计（设计文档 + 初始化脚本：7 表 / 3 视图 / 2 触发器 / 分类种子数据），依据 PRD V1.0.1 第 5/7 章；目标库为 **MySQL 8.0.16+**（utf8mb4，用户指定环境）。表结构一次建齐（含 V1.1 的账户/预算），应用层按版本逐步启用。

新阶段按编号顺延创建文件夹（003…）。目录与文档均使用中文命名。

## 常用命令

无构建、无依赖、无测试框架、无 package.json：

```
# 运行：直接在浏览器打开（file:// 协议可用，无需服务器）
Start-Process "002.网站开发\index.html"

# 语法校验（唯一可用的自动检查）
node --check "002.网站开发\app.js"
```

改动后无法自动化验证 UI——需要用户在浏览器中人工确认。

## 架构

### 实现约束（002.网站开发）

- 纯原生 HTML/CSS/JS，零依赖、零构建。**必须保持普通 `<script src>` 标签（禁用 ES modules）**，否则 file:// 直开失效。
- `index.html` 头部有一段内联主题预载脚本（读 localStorage 设置 `data-theme`），必须保持在 `<head>` 中样式表之前，否则深色主题首帧闪白。
- 无框架、无虚拟 DOM：每次数据变更调用 `renderAll()` 全量重渲染，各视图渲染函数幂等（`renderHome` / `renderList` / `renderStats` / `renderMe`）。
- `index.html` 与 `app.js` 之间是约 40 个元素 ID 的隐式契约，改一边必须同步另一边。
- 图表为手写 SVG 字符串（无图表库），遵循 dataviz 规范：柱宽 ≤24px、4px 圆头方角基线、扇区间 2px 表面色间隔、文字永不使用数据色、悬停 tooltip 默认存在、图例列表即文字兜底视图、单序列图表用品牌粉不加图例。

### 数据

- 存储于 `localStorage`（key：`jianji.v1`），结构 `{ txns: [...], settings: { theme } }`；全部本地、无网络请求（PRD 设计原则「单机优先，隐私第一」）。
- 9 个分类是代码内置常量（`CATS`），不存库；分类色跟随分类实体，不随排名重排。
- CSV 导出（PRD 5.5）：UTF-8 with BOM、9 个固定字段、标准 CSV 转义，此格式不可随意变更。

### 设计系统（PRD 6.3 = styles.css 令牌）

- 全部颜色是 **CSS 自定义属性令牌**（`--plane`、`--ink`、`--brand`、`--cat-*` 等），明暗两套为**独立选定值而非自动反色**，主题切换只换 `data-theme` 下的变量值。
- PRD 6.3 中的色值经过 WCAG 对比度与色觉模拟实测（数据记录在 PRD 6.3 各表格中），**不要凭感觉改色值**；若必须调整，需重新验证并同步更新 PRD 表格。
- 分类图标 = 分类色 12% 淡染底 + 分类色图形（`color-mix` 实现）。

### 架构（003：前端 + 后端）

- **启动**：`cd 003.前端代码（前端工程师）/backend && npm start` → http://localhost:3000（静态托管 `../app`，同时提供 `/api/*`）；数据库连接见 `backend/db.js`（可用 `DB_HOST/DB_USER/DB_PASS` 环境变量覆盖）。
- **后端 API**（均需登录态，Cookie `jj_session`）：`/api/auth/register|login|me|logout`、`/api/home/summary`（首页卡片汇总）、`/api/budget`（总预算）、`/api/user/settings-summary`（我的页汇总）、`/api/user/avatar`（头像 base64）、`/api/user/setting`（偏好）、`/api/account`（资金账户）、`/api/user/data-reset`（清空账本）。
- **会话**：服务端 session 表 + HttpOnly Cookie；前端 `assets/js/auth.js` 只问状态，不存凭证。
- **主题系统**：`assets/css/theme.css` 定义明/暗两套 CSS 变量（PRD 6.3.2 梅紫暗调），`tailwind-config.js` 全部色值引用变量（`rgb(var(--c-x) / <alpha-value>)`）；`assets/js/theme.js` 负责应用与持久化（light/dark/auto）。**改色值只改 theme.css**，勿在页面写死颜色。
- **前端约定**：页面用 `<script src>`（禁 ES modules）；`assets/js/shell.js` 注入页头/底部导航/头像菜单（改一处四页生效）；各页逻辑在 `assets/js/pages/`。
- **金额打码/算式求和**：偏好存 `user_setting` 表（key: `theme`/`arith`/`privacy_mask`），localStorage 即时生效 + 服务端持久化。

## 范围纪律（改功能前必读）

- 当前实现限定 PRD **V1.0.2 范围：支出记账 + 统计 + 云端账户（注册/登录/退出）+ 我的页资料与偏好**。收入记账、分类预算、备份恢复属 V1.1，自定义分类、PWA 属 V1.2——不要顺手实现，除非用户明确要求。
- 002.网站开发（旧实现，localStorage 版）与 003（当前工程，MySQL 版）并存：**以 003 为准**，002 仅作历史参考。
- PRD 1.3「明确不做」清单（社交/理财/广告/OCR 等）在任何版本均不规划。
- 「3 步记账」是硬约束（设计原则第一条）：任何给记账路径增加步骤的改动都要拒绝或先与用户确认。
- 金额校验规则：> 0、≤ 2 位小数、≤ 99,999,999.99、日期不可未来、可补记 365 天内。

## 文档维护约定

PRD 有版本修订记录表，对产品行为的实质变更（范围、规则、设计系统）应同步更新 PRD 对应章节并追加修订记录；实现与 PRD 冲突时，以用户最新指示为准并回写文档。
