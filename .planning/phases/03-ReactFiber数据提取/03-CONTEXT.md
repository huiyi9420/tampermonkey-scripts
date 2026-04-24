# Phase 3: React Fiber 数据提取 - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase with browser-verified data)

<domain>
## Phase Boundary

在 Phase 2 建立的 DOM 监听机制上，为每个检测到的表格行通过 React Fiber 提取 record 数据对象及其关键字段（submit_id、show_record、task_id 等），并从 URL/localStorage 获取 eid。为 Phase 4 的按钮处理提供完整的数据基础。

**涵盖需求：** DATA-01, DATA-02, DATA-03, DATA-04

</domain>

<decisions>
## Implementation Decisions

### React Fiber 属性名
- **D-01:** 使用 `__reactInternalInstance$` 前缀匹配 Fiber key（已验证酷学院使用 React 17 风格 key: `__reactInternalInstance$4i0dp5wvif`）
- **D-02:** 支持 fallback 属性名列表：`__reactInternalInstance$` → `__reactFiber$` → `_reactInternals`

### Record 数据提取路径
- **D-03:** 从表格行元素（`.ant-table-row`）的 Fiber 开始，向上遍历 Fiber 树，depth=1 处即可获取 `record` 对象（已浏览器验证）
- **D-04:** Record 对象结构（已验证）：
  ```json
  {
    "answer_duration": "6",
    "exam_result": "failed",
    "makeup_exam": "false",
    "mark_name": "系统",
    "score": 0,
    "score_rate": "0%",
    "score_record_type": "highest",
    "show_record": "false",
    "submit_id": "2290426976449728512",
    "submit_time": "1776933566590",
    "task_id": "2289490214906892288",
    "total_score": 100
  }
  ```

### eid 获取方式
- **D-05:** 从 `localStorage.getItem('enterpriseId')` 获取 eid（已验证值为 `"1643792148006572038"`）

### exam_id 获取方式
- **D-06:** 从当前页面 URL hash 参数中解析 `exam_id`（URL 格式: `#/training/examination/exam-data?exam_id=xxx&...`）

### 数据存储
- **D-07:** 提取的数据通过全局变量/Map 暂存，供 Phase 4 按钮处理使用

### 日志风格
- 继承 Phase 1/2 简洁模式 — 仅输出关键节点日志

### Claude's Discretion
- getRecordFromRow 函数的具体遍历实现
- 数据暂存的具体数据结构
- Fiber key 前缀匹配的正则表达式

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specifications
- `.planning/REQUIREMENTS.md` — DATA-01 到 DATA-04 需求定义
- `.planning/ROADMAP.md` — Phase 3 目标和成功标准
- `.planning/phases/02-DOM变化监听/02-CONTEXT.md` — Phase 2 决策（D-04 data-processed 标记等）

### 技术参考
- Phase 2 产出 `coolcollege-unlock.user.js` — 现有脚本结构，processRow() 函数是 Phase 3 的接入点
- 浏览器 DevTools 验证结果 — Fiber key、record 结构、eid 来源均已确认

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `coolcollege-unlock.user.js` — Phase 1+2 产出，processRow() 函数是 Phase 3 的接入点
- `extractNewRows()` — Phase 2 已实现，返回 `.ant-table-row` 元素数组
- `debounce()` — Phase 2 已实现，300ms 去抖

### Established Patterns
- 简洁日志模式（`console.log` 关键节点）
- 条件检测（`isTargetPage()`）
- `currentObserver` 生命周期管理模式

### Integration Points
- Phase 3 在 `processRow(row)` 函数体内添加 Fiber 数据提取逻辑
- Phase 3 完成后，processRow 将从空实现变为包含完整数据提取的实现
- Phase 4 将在 processRow 的数据基础上执行按钮样式修改和事件绑定

### 浏览器验证的关键发现
- 酷学院使用 React 17（`__reactInternalInstance$` 前缀）
- Fiber key 后缀是随机字符串：`4i0dp5wvif`
- Record 在 Fiber 树中 depth=1 处（直接 return 的第一个 memoizedProps 中）
- 表格行 class: `ant-table-row ant-table-row-level-0`
- 行**没有** `data-row-key` 属性
- eid 在 localStorage 中 key 为 `enterpriseId`
- exam_id 在 URL hash 参数中

</code_context>

<specifics>
## Specific Ideas

- Fiber key 匹配：使用 `Object.keys(el).find(k => k.startsWith('__reactInternalInstance$') || k.startsWith('__reactFiber$'))`
- Record 获取路径：`fiber = el[fiberKey]` → `fiber.return.memoizedProps.record`
- eid 获取：`localStorage.getItem('enterpriseId')`
- exam_id 获取：从 `window.location.hash` 解析 URL 参数
- 数据暂存：使用 `Map` 以 row 元素为 key 存储 record 数据

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-ReactFiber数据提取*
*Context gathered: 2026-04-24 via browser DevTools analysis*
