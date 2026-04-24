# Phase 1: 脚本脚手架与路由感知 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 1-脚本脚手架与路由感知
**Areas discussed:** URL 匹配策略, 初始化日志风格, 路由检测方案

---

## URL 匹配策略

| Option | Description | Selected |
|--------|-------------|----------|
| 宽匹配 + 路由过滤 | @match 匹配整个站点，脚本内通过 hash 判断目标页 | |
| 精确匹配考试数据页 | @match 精确到 exam-data 路径，缩小激活范围 | ✓ |

**User's choice:** 精确匹配考试数据页
**Notes:** 缩小脚本激活范围，避免非目标页面不必要执行

---

## 初始化日志风格

| Option | Description | Selected |
|--------|-------------|----------|
| 简洁模式 | 仅输出关键节点：初始化、路由变化、目标页激活 | ✓ |
| 调试模式 | 包含 DOM 检查、URL 解析、Fiber 探测等详细信息 | |

**User's choice:** 简洁模式
**Notes:** 遵循 KISS 原则

---

## 路由检测方案

| Option | Description | Selected |
|--------|-------------|----------|
| 纯 onurlchange | 仅 Tampermonkey 原生 API，简单可靠 | ✓ |
| onurlchange + 降级 | 主用 onurlchange，不可用时降级到 hashchange + popstate | |

**User's choice:** 纯 onurlchange，无降级
**Notes:** KISS 原则 — Tampermonkey 生态下 onurlchange 已足够可靠

---

## Claude's Discretion

- metadata 头部完整字段选择（@description, @icon, @version 等）
- @grant 声明选择
- 脚本文件命名
- 初始化函数组织结构

## Deferred Ideas

None
