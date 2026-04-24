# Phase 4: 按钮启用与健壮性 - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning
**Mode:** Auto-generated (browser-verified data)

<domain>
## Phase Boundary

基于 Phase 3 提取的 record 数据，检测 `show_record === "false"` 的行，将灰色的「作答详情」span 元素改为蓝色可点击，绑定点击事件在新标签页打开作答详情页面。同时添加完善的错误处理，确保异常情况不影响页面正常使用。

**涵盖需求：** BTN-01, BTN-02, BTN-03, BTN-04, BTN-05, ERR-01, ERR-02, ERR-03

</domain>

<decisions>
## Implementation Decisions

### 按钮定位策略
- **D-01:** 「作答详情」不是 `<button>` 元素，而是 `<span>` 元素。定位方式：在每行 `.ant-table-row` 内查找 `.ant-table-cell-fix-right` 单元格，然后查找其中包含"作答详情"文本的 span
- **D-02:** 「作答详情」span 的父级是 `<div class="exam-record-operate___2q2xH">`（CSS Modules 哈希类名，不可靠），应通过文本内容定位而非类名

### 按钮样式修改
- **D-03:** 灰色 span 改为蓝色可点击：`color: rgb(0, 122, 255); cursor: pointer;`（仅修改 show_record 为 false 的行）
- **D-04:** 不移除原有 span，只修改 style 属性和添加 click 事件

### 点击跳转
- **D-05:** 使用 `GM_openInTab` 在新标签页打开作答详情（已在 @grant 中声明）
- **D-06:** 跳转 URL 格式需要根据酷学院实际页面确定。从 record 数据和 URL 参数构造完整 URL

### 错误处理
- **D-07:** Fiber 数据不存在时优雅降级（已在 Phase 3 processRow 中处理，跳过该行）
- **D-08:** record 数据缺失 submit_id 时跳过（已在 Phase 3 处理）
- **D-09:** 页面结构变化导致选择器失效时输出控制台警告

### 日志风格
- 继承 Phase 1/2/3 简洁模式

### Claude's Discretion
- 跳转 URL 的具体格式（需要根据实际页面确定）
- 按钮点击后的视觉反馈（如 hover 效果）
- 选择器失效时的降级策略

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specifications
- `.planning/REQUIREMENTS.md` — BTN-01 到 BTN-05, ERR-01 到 ERR-03
- `.planning/ROADMAP.md` — Phase 4 目标和成功标准
- `.planning/phases/03-ReactFiber数据提取/03-CONTEXT.md` — Phase 3 的 record 数据结构

### 技术参考
- Phase 3 产出 `coolcollege-unlock.user.js` — processRow() 和 rowDataMap 是 Phase 4 的数据来源
- 浏览器 DevTools 验证结果 — 「作答详情」span 元素的实际 DOM 结构

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `rowDataMap` — Phase 3 的 Map 数据暂存，key 是行 DOM 元素，value 是 `{ record, eid, examId }`
- `processRow(row)` — Phase 3 已实现 Fiber 数据提取，Phase 4 在此基础上添加按钮处理

### Integration Points
- Phase 4 在 `processRow(row)` 函数末尾添加按钮处理逻辑
- Phase 4 使用 `rowDataMap.get(row)` 获取已提取的数据

### 浏览器验证的关键发现
- 「作答详情」元素结构：
  ```html
  <td class="ant-table-cell ant-table-cell-fix-right ant-table-cell-fix-right-first">
    <div class="exam-record-operate___2q2xH">  <!-- CSS Modules hash, 不可靠 -->
      <span class="undefined">作答详情</span>  <!-- class 字面量是 "undefined" -->
    </div>
  </td>
  ```
- 灰色状态：`color: rgb(204, 204, 204); cursor: not-allowed;`
- `show_record: "false"` 控制是否灰色
- Phase 3 processRow 中已有 `show_record` 字段判断逻辑

</code_context>

<specifics>
## Specific Ideas

- 定位「作答详情」span：`row.querySelector('.ant-table-cell-fix-right')` → 找到包含"作答详情"文本的 span
- 修改样式：`span.style.color = 'rgb(0, 122, 255)'; span.style.cursor = 'pointer';`
- 点击跳转：`GM_openInTab(url, { active: true });`
- URL 参数来源：`rowDataMap.get(row)` 中的 `record.submit_id`, `record.task_id`, `examId`, `eid`

</specifics>

<deferred>
## Deferred Ideas

None — this is the final delivery phase

</deferred>

---

*Phase: 04-按钮启用与健壮性*
*Context gathered: 2026-04-24 via browser DevTools analysis*
