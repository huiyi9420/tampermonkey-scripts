# Phase 2: DOM 变化监听 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 2-DOM变化监听
**Areas discussed:** Observer 目标元素

---

## Observer 目标元素

| Option | Description | Selected |
|--------|-------------|----------|
| 监听 body | 监听 document.body 的 subtree 变化，更稳定但依赖去抖控制性能 | |
| 精确查找 ant-table | 用 CSS 选择器定位 .ant-table 元素，精确但可能随网站更新失效 | |
| 精确 + 回退 | 先尝试查找 .ant-table，找不到则回退到 body | ✓ |

**User's choice:** 精确 + 回退
**Notes:** 平衡精确性和健壮性

---

## Claude's Discretion

- `data-processed` 属性值的命名
- 去抖函数的具体实现
- 回调函数中遍历新行元素的逻辑

## Deferred Ideas

None