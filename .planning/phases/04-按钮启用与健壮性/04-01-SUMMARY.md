---
phase: 04-按钮启用与健壮性
plan: 01
subsystem: ui
tags: [tampermonkey, userscript, dom-manipulation, gm_openintab, button-unlock]

# Dependency graph
requires:
  - phase: 03-ReactFiber数据提取
    provides: processRow 函数、rowDataMap Map、getRecordFromRow/getEid/getExamId
provides:
  - unlockDetailButton 函数 - 解锁灰色作答详情按钮并绑定点击跳转
  - processRow 扩展 - 在数据提取后自动调用按钮解锁
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [text-based-span-location, urlsearchparams-url-construction, gm_openintab-navigation]

key-files:
  created: []
  modified:
    - coolcollege-unlock.user.js

key-decisions:
  - "按钮定位通过文本内容匹配而非 CSS Modules 哈希类名，避免网站更新导致失效"
  - "URL 使用 URLSearchParams 标准构造，参数来自页面 Fiber 数据（非用户输入）"
  - "仅处理 show_record === 'false' 的行，不影响正常可点击按钮"

patterns-established:
  - "文本内容定位模式：querySelectorAll('span') + textContent.trim() 匹配"
  - "URL 安全构造模式：URLSearchParams + 条件参数设置"

requirements-completed: [BTN-01, BTN-02, BTN-03, BTN-04, BTN-05, ERR-01, ERR-02, ERR-03]

# Metrics
duration: 1min
completed: 2026-04-24
---

# Phase 4 Plan 01: 按钮解锁实现 Summary

**解锁 show_record=false 的灰色「作答详情」span，修改为蓝色可点击并通过 GM_openInTab 在新标签页打开作答详情页**

## Performance

- **Duration:** 1 min
- **Started:** 2026-04-24T13:33:22Z
- **Completed:** 2026-04-24T13:35:10Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- 实现 unlockDetailButton 函数，完整覆盖 BTN-01~05 和 ERR-03 需求
- processRow 在 rowDataMap.set 后自动调用 unlockDetailButton，数据流完整
- 灰色 span 变为蓝色可点击（color: rgb(0, 122, 255); cursor: pointer）
- 点击事件通过 GM_openInTab 在新标签页打开，URL 包含 exam_id/submit_id/task_id/eid 四个参数
- 选择器失效时输出 console.warn 警告，不影响页面正常使用

## Task Commits

Each task was committed atomically:

1. **Task 1: 添加 unlockDetailButton 函数并在 processRow 中调用** - `7e29140` (feat)
2. **Task 2: 端到端验证 -- 代码完整性检查与错误处理审查** - 无代码修改（纯验证任务）

**Plan metadata:** (pending)

_Note: TDD tasks may have multiple commits (test -> feat -> refactor)_

## Files Created/Modified
- `coolcollege-unlock.user.js` - 新增 unlockDetailButton 函数（66 行），修改 processRow 添加解锁调用

## Decisions Made
- 按钮定位通过文本内容「作答详情」匹配 span，而非依赖 CSS Modules 哈希类名（exam-record-operate___2q2xH），避免网站更新导致失效
- URL 使用 URLSearchParams 标准构造，每个参数有 null 检查，仅设置非空参数
- GM_openInTab 使用 { active: true } 立即激活新标签页
- 事件回调中 e.stopPropagation() 阻止事件冒泡，避免触发行选择等父级事件

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 4 是最终交付阶段，所有核心功能已实现
- 脚本完整流程：页面检测 -> MutationObserver 监听 -> 行数据提取 -> 按钮解锁 -> 点击跳转
- 需要在浏览器中安装脚本进行实际验证（访问酷学院考试数据页面）

---
*Phase: 04-按钮启用与健壮性*
*Completed: 2026-04-24*

## Self-Check: PASSED

- coolcollege-unlock.user.js: FOUND
- 04-01-SUMMARY.md: FOUND
- Task 1 commit 7e29140: FOUND
- JavaScript syntax check: PASSED
