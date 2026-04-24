# Phase 2: DOM 变化监听 - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

使用 MutationObserver 监听酷学院考试数据页面的表格 DOM 变化，包括表格数据初次加载和后续刷新/翻页。通过精确 + 回退策略定位观察目标，并使用去抖和标记机制避免重复处理。

**涵盖需求：** DOM-01, DOM-02, DOM-03, DOM-04

</domain>

<decisions>
## Implementation Decisions

### Observer 目标元素
- **D-01:** 精确 + 回退策略 — 先用 CSS 选择器定位 `.ant-table` 等 Ant Design 表格容器，找到则观察其 subtree，找不到则回退到观察 `document.body`

### MutationObserver 配置
- **D-02:** 使用 `{ childList: true, subtree: true }` 配置（标准配置，足够监听表格行变化）
- 不需要监听 `attributes` 变化（表格数据变化通过 DOM 子树变化体现）

### 去抖配置
- **D-03:** 300ms 尾部去抖 — 等待最后一次 DOM 变化后 300ms 无新变化再执行处理

### 行标记策略
- **D-04:** 使用 `data-processed` 属性标记已处理的行，通过 `querySelectorAll('[data-processed]')` 检测已处理行

### Observer 生命周期
- **D-05:** 每次 `init()` 调用时重建 Observer（先 disconnect 旧 Observer），离开目标页面时 `init()` 不执行会自动停止

### 日志风格
- 继承 Phase 1 简洁模式 — 仅输出关键节点日志

### Claude's Discretion
- `data-processed` 属性值的命名（如 "true" / 时间戳）
- 去抖函数的具体实现（setTimeout + clearTimeout）
- 回调函数中遍历新行元素的逻辑

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specifications
- `.planning/PROJECT.md` — 项目愿景、技术约束、关键决策
- `.planning/REQUIREMENTS.md` — DOM-01 到 DOM-04 需求定义
- `.planning/ROADMAP.md` — Phase 2 目标（"可靠检测表格数据的动态加载，为后续按钮处理提供触发机制"）和成功标准
- `.planning/phases/01-脚本脚手架与路由感知/01-CONTEXT.md` — Phase 1 决策（D-02 日志风格、D-03 纯 onurlchange）

### 技术参考
- MDN MutationObserver — API 语法、配置选项、disconnect 生命周期管理
- Phase 1 产出 `coolcollege-unlock.user.js` — 现有脚本结构，init() 函数是 Phase 2 的接入点

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `coolcollege-unlock.user.js` — Phase 1 产出，init() 函数是 Phase 2 的接入点
- `window.onurlchange` 路由检测机制 — Phase 2 在 init() 中建立 Observer

### Established Patterns
- 简洁日志模式（`console.log` 关键节点）
- 条件检测（`window.onurlchange === null`）

### Integration Points
- Phase 2 在 `init()` 函数体内添加 MutationObserver 逻辑（Phase 1 的 init() 只是骨架）
- Phase 2 完成后，init() 将包含完整的初始化流程
- Phase 3（数据提取）将在 Phase 2 的行遍历逻辑上添加 React Fiber 数据提取

</code_context>

<specifics>
## Specific Ideas

- Ant Design 表格容器选择器：`.ant-table`（精确查找）或 `document.body`（回退）
- 去抖时间窗口：300ms
- 标记属性：`data-processed="true"`（用于标记已处理的行）
- Observer 在 init() 调用时创建，路由切换时旧 Observer 会自动丢弃（init() 重新执行会重建）

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-DOM变化监听*
*Context gathered: 2026-04-24*