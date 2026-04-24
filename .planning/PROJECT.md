# CoolCollege 作答详情解锁脚本

## What This Is

一个 Tampermonkey 油猴脚本，运行在酷学院（pro.coolcollege.cn）考试数据页面，自动将灰色不可点击的「作答详情」按钮变为可点击状态，并正确跳转到作答详情页面。面向需要在酷学院平台查看历史考试作答详情的用户。

## Core Value

所有考试记录（无论及格与否）的作答详情按钮都必须可点击并正确跳转。

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] 灰色「作答详情」按钮自动变为蓝色可点击状态
- [ ] 点击按钮正确跳转到对应记录的作答详情页面
- [ ] 支持页面动态加载（SPA 路由切换、表格数据刷新）
- [ ] 兼容 Ant Design 表格组件

### Out of Scope

- 修改考试分数或成绩 — 仅修改前端展示，不触碰后端数据
- 支持其他平台 — 仅针对 pro.coolcollege.cn
- 自动登录或绕过权限验证 — 用户必须自行登录

## Context

### 技术分析结果

- **目标网站**: pro.coolcollege.cn（酷学院在线学习平台）
- **目标页面**: `#/training/examination/exam-data`（考试数据页）
- **前端框架**: React + Ant Design（ant-table 组件）
- **按钮结构**: `<div class="exam-record-operate___2q2xH"><span>作答详情</span></div>`
- **禁用机制**: 前端根据 `show_record` 字段（值为 `"false"`）将按钮渲染为灰色（`cursor: not-allowed`, `color: rgb(204, 204, 204)`）
- **数据来源**: 通过 React Fiber（`__reactInternalInstance$`）从 `tr` 行元素获取 `record` 数据

### 关键数据字段

```
record = {
  submit_id: "2290426976449728512",   // 提交ID（存在！）
  exam_id: (从URL参数获取),
  task_id: (从URL参数获取),
  show_record: "false",                // 控制按钮是否可点击
  score: 0,
  exam_result: "failed"
}
```

### 跳转 URL 格式

```
https://pro.coolcollege.cn/sub-sys/kuxueyuan-manage/prod/split?eid={enterprise_id}
#/training/examination/new-exam/parse?exam_id={exam_id}&submit_id={submit_id}&task_id={task_id}&user_id=
```

## Constraints

- **Tech Stack**: Tampermonkey / Greasemonkey 用户脚本（JavaScript）
- **Browser**: Chrome / Firefox（Tampermonkey 支持）
- **Dependencies**: 仅使用浏览器原生 API，不依赖第三方库
- **SPA 兼容**: 必须使用 MutationObserver 或定时器处理动态 DOM 变化

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 通过 React Fiber 获取 record 数据 | 最可靠的方式获取每行记录的 submit_id，无需额外 API 调用 | — Pending |
| MutationObserver + 去抖 | SPA 页面 DOM 频繁变化，需要高效监听 | — Pending |
| 新标签页打开作答详情 | 保持原页面不丢失 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-24 after initialization*
