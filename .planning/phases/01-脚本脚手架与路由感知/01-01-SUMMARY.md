---
phase: 01-脚本脚手架与路由感知
plan: 01
subsystem: userscript
tags: [tampermonkey, userscript, spa, onurlchange, coolcollege]

# Dependency graph
requires: []
provides:
  - Tampermonkey 用户脚本完整脚手架 (coolcollege-unlock.user.js)
  - SPA 路由检测机制 (window.onurlchange)
  - init() 初始化入口点供后续 Phase 挂载
affects: [02-DOM变化监听, 03-React-Fiber数据提取, 04-按钮启用与健壮性]

# Tech tracking
tech-stack:
  added: [tampermonkey-userscript, vanilla-js-es6]
  patterns: [iife-wrapper, spa-route-detection-via-onurlchange, href-includes-path-matching]

key-files:
  created: [coolcollege-unlock.user.js]
  modified: []

key-decisions:
  - "D-01: @match 精确匹配考试数据页面 URL，缩小脚本激活范围"
  - "D-02: 简洁日志模式，仅输出关键节点（初始化激活、路由变化）"
  - "D-03: 纯 window.onurlchange 检测 SPA 路由，无 hashchange/popstate 降级方案"

patterns-established:
  - "IIFE 包裹: (function () { 'use strict'; ... })() 隔离脚本作用域"
  - "常量定义: SCRIPT_NAME 和 TARGET_PATH 作为脚本级常量"
  - "路由检测模式: window.onurlchange === null 判断 Tampermonkey 支持，addEventListener('urlchange') 监听变化"
  - "日志格式: [${SCRIPT_NAME}] 前缀统一控制台输出"

requirements-completed: [INIT-01, INIT-02, INIT-03, INIT-04]

# Metrics
duration: 4min
completed: 2026-04-24
---

# Phase 1 Plan 01: 脚本脚手架与路由感知 Summary

**Tampermonkey 用户脚手架：完整 metadata 配置、pro.coolcollege.cn 精确 URL 匹配、window.onurlchange SPA 路由检测与 init() 入口点**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-24T05:54:35Z
- **Completed:** 2026-04-24T05:58:33Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- 创建完整的 Tampermonkey 用户脚本，包含 @name, @match, @grant, @run-at 等所有必需 metadata
- 实现基于 window.onurlchange 的 SPA 路由检测，支持页面初次加载和路由切换时的自动初始化
- 建立 init() 入口函数，为后续 Phase 2-4 的 DOM 监听、数据提取、按钮处理提供挂载点

## Task Commits

Each task was committed atomically:

1. **Task 1: 创建 Tampermonkey metadata 与脚本骨架** - `c8f354e` (feat)
2. **Task 2: 实现 SPA 路由检测与初始化逻辑** - `05e15df` (feat)

## Files Created/Modified
- `coolcollege-unlock.user.js` - 完整 Tampermonkey 用户脚本，包含 metadata、IIFE 包裹、路由检测和初始化逻辑

## Decisions Made
- D-01: @match 使用 `*://pro.coolcollege.cn/*training/examination/exam-data*` 精确匹配考试数据页面，缩小激活范围
- D-02: 日志采用简洁模式，仅输出初始化激活和路由变化两个关键节点
- D-03: 使用纯 window.onurlchange 检测 SPA 路由，不添加 hashchange/popstate 降级方案（KISS 原则）
- 预先声明 @grant GM_openInTab，为 Phase 4 按钮跳转做准备

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 脚本脚手架和路由检测已就绪，Phase 2 可在 init() 函数中添加 MutationObserver DOM 监听逻辑
- init() 在页面加载和路由切换时均被正确调用，为 Phase 2 提供了可靠的触发时机
- 无阻塞项

## Self-Check: PASSED

| Item | Status |
|------|--------|
| coolcollege-unlock.user.js | FOUND |
| 01-01-SUMMARY.md | FOUND |
| Commit c8f354e (Task 1) | FOUND |
| Commit 05e15df (Task 2) | FOUND |

---
*Phase: 01-脚本脚手架与路由感知*
*Completed: 2026-04-24*
