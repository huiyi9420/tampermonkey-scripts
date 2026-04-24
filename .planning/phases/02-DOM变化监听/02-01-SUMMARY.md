---
phase: 02-DOM变化监听
plan: 01
subsystem: core
tags: [MutationObserver, 去抖, SPA, DOM监听]
dependency:
  requires: [基础骨架]
  provides: [DOM变化检测, 行标记]
  affects: [按钮处理]
tech_stack:
  added: [MutationObserver, 300ms debounce, data-processed 去重, currentObserver 生命周期管理]
  patterns: [精确+回退目标选择, 尾部去抖, 避免重复处理]
key_files:
  created: []
  modified: [coolcollege-unlock.user.js]
decisions:
  - D-01: 观察目标优先级 .ant-table-tbody → .ant-table → document.body
  - D-02: MutationObserver 配置 childList: true + subtree: true
  - D-03: 300ms 尾部去抖防止频繁处理
  - D-04: data-processed 属性标记已处理行避免重复
  - D-05: init() 入口先断开旧 Observer 清理生命周期
metrics:
  duration_seconds: 120
  completed_date: 2026-04-24
  tasks_total: 3
  tasks_completed: 3
  files_modified: 1
---

# Phase 02 Plan 01: DOM变化监听框架实现总结

## 目标

在 `coolcollege-unlock.user.js` 中建立完整的 MutationObserver 监听机制，使脚本能可靠检测酷学院考试数据页面的表格动态加载，为后续按钮处理（Phase 4）提供触发入口。

## 任务执行记录

| 任务 | 名称 | 状态 | 提交 |
| ---- | ---- | ---- | ---- |
| 1 | 添加辅助函数（debounce、currentObserver、extractNewRows、processRow、processRows、debouncedProcessRows）| ✓ 完成 | b1e94f6 |
| 2 | 完善 init() 函数（实现 MutationObserver 启动 + 生命周期管理 + 主动行处理） | ✓ 完成 | 1728d85 |
| 3 | 验证完整性（grep 检查所有关键代码片段存在） | ✓ 完成（修复后） | ee28878 |

## 实现内容

### 新增函数和变量

- **`debounce(fn, delay)`** - 尾部去抖函数，300ms 延迟，防止频繁 DOM 变化导致重复处理
- **`currentObserver`** - 全局变量保存当前 Observer 实例引用，用于生命周期管理（路由切换时断开旧监听）
- **`extractNewRows(mutations)`** - 从 MutationRecord 中提取新增的 tr[data-row-key] 行
- **`processRow(row)`** - 单行处理存根（Phase 2 仅打印日志，Phase 4 填充实际按钮处理）
- **`processRows(mutations)`** - 批量处理新增行，使用 data-processed 过滤已处理行
- **`debouncedProcessRows`** - processRows 的 300ms 去抖版本

### 重构 init() 函数

完整实现包含以下决策点：

1. **D-05 生命周期管理** - init() 开头先 `currentObserver.disconnect()` 断开旧 Observer
2. **D-01 目标查找** - 优先级：`.ant-table-tbody` → `.ant-table` → `document.body`
3. **D-02 Observer 创建** - `new MutationObserver` 使用 `debouncedProcessRows` 回调
4. **观察配置** - `{ childList: true, subtree: true }` 监听所有子树变化
5. **Pitfall 1 缓解** - init() 末尾主动查询 `tr[data-row-key]:not([data-processed])` 并处理已存在行
6. **日志输出** - 每个关键步骤输出简洁日志，便于调试

## 关键验证结果（10/10 通过）

| 检查项 | 结果 | 次数 |
| ---- | ---- | ---- |
| debounce 函数 | PASS | 1 |
| currentObserver 变量 | PASS | 1 |
| MutationObserver 实例化 | PASS | 1 |
| Observer 配置 childList+subtree | PASS | 1 |
| disconnect 调用 | PASS | 1 |
| data-processed 标记（>=3次） | PASS | 5 |
| 主动行处理 querySelectorAll | PASS | 1 |
| Observer 启动日志 | PASS | 1 |
| 去抖包装 | PASS | 1 |
| extractNewRows 调用 | PASS | 1 |

## 偏差记录

### Auto-fixed Issues

**1. [Rule 1 - Bug] 修复了变量引用顺序和重复声明问题**
- **Found during:** Task 3 语法检查
- **Issue:** `currentObserver` 在 init() 之后声明，虽然变量提升能工作但不清晰；重构时错误导致整个辅助函数块重复声明，造成 `debouncedProcessRows` 重复定义语法错误
- **Fix**: 将 `currentObserver` 移到 init() 之前，删除重复的辅助函数块
- **Files modified**: coolcollege-unlock.user.js
- **Commit**: ee28878

## 已知存根

- `processRow(row)` - 仅打印日志，实际按钮处理逻辑在 Phase 4 实现

## 威胁标记

（本阶段仅建立监听框架，未引入新的安全风险）

## 自检查

- [x] 所有任务执行完成 ✓
- [x] 每个任务单独提交 ✓
- [x] SUMMARY.md 创建 ✓
- [x] 所有 10 项验证通过 ✓
- [x] JavaScript 语法正确 ✓

## Self-Check: PASSED
