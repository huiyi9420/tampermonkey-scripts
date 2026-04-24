# Phase 1: 脚本脚手架与路由感知 - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

建立 Tampermonkey 脚本的 metadata 配置、URL 匹配规则和 SPA 路由检测机制。确保脚本在 pro.coolcollege.cn 考试数据页面正确激活，并能在 SPA 路由切换时重新初始化。

**涵盖需求：** INIT-01, INIT-02, INIT-03, INIT-04

</domain>

<decisions>
## Implementation Decisions

### URL 匹配策略
- **D-01:** ~~精确匹配~~ → **修正为宽匹配 + 路由过滤**（`*://pro.coolcollege.cn/*`），原因：`@match` 不匹配 URL hash fragment，目标页面使用 hash 路由 `#/training/examination/exam-data`，精确匹配永远不命中。由 `isTargetPage()` 做 `href.includes()` 过滤

### 日志风格
- **D-02:** 简洁模式 — 仅输出关键节点日志（脚本初始化、路由变化检测、目标页面激活），不输出冗余调试信息

### 路由检测方案
- **D-03:** 纯 `window.onurlchange`（Tampermonkey 原生 API），不添加 hashchange/popstate 降级方案。KISS 原则 — 保持简单，Tampermonkey 生态下 onurlchange 已足够可靠

### Claude's Discretion
- metadata 头部完整字段选择（@description, @icon, @version 等）
- @grant 声明（后续 Phase 4 需要 GM_openInTab，Phase 1 需 window.onurlchange）
- 脚本文件命名
- 初始化函数的组织结构

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specifications
- `.planning/PROJECT.md` — 项目愿景、技术约束、关键决策
- `.planning/REQUIREMENTS.md` — INIT-01 到 INIT-04 需求定义及完整上下文（按钮结构、数据字段、跳转 URL 格式）
- `.planning/ROADMAP.md` — Phase 1 目标和成功标准

### External References
- Tampermonkey `@match` 文档 — URL 匹配规则语法
- Tampermonkey `window.onurlchange` API — SPA 路由检测机制，需 `// @grant window.onurlchange` 声明

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- 无 — 这是全新项目的首个阶段

### Established Patterns
- 无 — 此阶段将建立项目的基础模式

### Integration Points
- 后续 Phase 2（DOM 变化监听）将依赖此阶段建立的路由检测回调机制
- 后续 Phase 4（按钮处理）将依赖此阶段的 @grant 声明（特别是 GM_openInTab）

</code_context>

<specifics>
## Specific Ideas

- 目标页面 URL 路径：`#/training/examination/exam-data`（hash 路由）
- `window.onurlchange` 检测条件：`window.onurlchange === null` 表示支持此特性
- 成功标准明确：控制台需输出初始化日志确认脚本在页面加载和路由切换时均被触发

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-脚本脚手架与路由感知*
*Context gathered: 2026-04-24*
