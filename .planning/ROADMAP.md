# Roadmap: CoolCollege 作答详情解锁脚本

## Overview

一个 Tampermonkey 油猴脚本的完整开发路线，从脚本脚手架搭建到最终可用的按钮解锁功能。路线分 4 个阶段：先搭好脚本基础和路由感知（Phase 1），再建立 DOM 变化监听机制（Phase 2），然后攻克 React Fiber 数据提取的核心技术难题（Phase 3），最后实现按钮样式修改和跳转功能并确保健壮性（Phase 4）。

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: 脚本脚手架与路由感知** - 建立 Tampermonkey metadata、URL 匹配和 SPA 路由检测 (completed 2026-04-24)
- [x] **Phase 2: DOM 变化监听** - MutationObserver 监听表格区域，去抖处理，避免重复操作 (completed 2026-04-24)
- [x] **Phase 3: React Fiber 数据提取** - 从 React Fiber 获取 record 数据，提取 submit_id 等关键字段 (completed 2026-04-24)
- [x] **Phase 4: 按钮启用与健壮性** - 修改按钮样式、绑定点击跳转、完善错误处理 (completed 2026-04-24)

## Phase Details

### Phase 1: 脚本脚手架与路由感知
**Goal**: 脚本能在正确的页面和时机自动激活，感知 SPA 路由切换
**Depends on**: Nothing (first phase)
**Requirements**: INIT-01, INIT-02, INIT-03, INIT-04
**Success Criteria** (what must be TRUE):
  1. 脚本安装后在 Tampermonkey 管理面板可见，metadata 正确显示名称和匹配规则
  2. 访问 pro.coolcollege.cn 考试数据页面时脚本自动执行，访问其他页面时不执行
  3. 在考试数据页面内进行 SPA 导航（如切换到其他标签再切回）时，脚本能重新检测并触发初始化
  4. 控制台输出初始化日志，确认脚本在页面加载和路由切换时均被触发
**Plans**: 1 plan

Plans:
- [x] 01-01-PLAN.md — 创建 Tampermonkey metadata、URL 匹配、SPA 路由检测和初始化逻辑

### Phase 2: DOM 变化监听
**Goal**: 脚本能可靠检测表格数据的动态加载，为后续按钮处理提供触发机制
**Depends on**: Phase 1
**Requirements**: DOM-01, DOM-02, DOM-03, DOM-04
**Success Criteria** (what must be TRUE):
  1. 表格数据加载或更新时，脚本自动检测到变化并在控制台输出日志
  2. 快速连续的 DOM 变化（如数据刷新）不会导致重复处理，去抖生效
  3. 已处理的表格行被标记，后续 DOM 变化不会重复处理同一行
  4. 离开考试数据页面时 Observer 自动断开，不会在错误页面继续监听
**Plans**: 1 plan

Plans:
- [x] 02-01-PLAN.md — MutationObserver 监听表格区域，去抖处理，行标记去重

### Phase 3: React Fiber 数据提取
**Goal**: 能从每行表格数据中可靠提取 record 对象及其关键字段
**Depends on**: Phase 2
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. 对每行表格数据，脚本能通过 React Fiber 获取到完整的 record 对象并在控制台打印
  2. 当主 Fiber 属性名不可用时，自动尝试备选属性名，至少一种方式能成功获取数据
  3. 成功从 record 中提取 submit_id、show_record 等字段并在控制台输出
  4. enterprise_id (eid) 从当前页面 URL 或 API 请求中正确获取
**Plans**: 1 plan

Plans:
- [x] 03-01-PLAN.md — Fiber 数据提取函数（getRecordFromRow、getEid、getExamId）+ rowDataMap 暂存 + processRow 更新

### Phase 4: 按钮启用与健壮性
**Goal**: 所有 show_record 为 false 的作答详情按钮变蓝可点击，点击后正确跳转到详情页，异常情况优雅处理
**Depends on**: Phase 3
**Requirements**: BTN-01, BTN-02, BTN-03, BTN-04, BTN-05, ERR-01, ERR-02, ERR-03
**Success Criteria** (what must be TRUE):
  1. 页面加载后，所有 show_record 为 "false" 的灰色「作答详情」按钮自动变为蓝色可点击状态
  2. 点击已解锁的按钮后，在新标签页打开对应记录的作答详情页面
  3. 跳转 URL 包含正确的 exam_id、submit_id、task_id、eid 参数，页面正常加载
  4. 某些行的 Fiber 数据不存在或 submit_id 缺失时，脚本不报错，仅跳过这些行并在控制台输出警告
  5. 页面结构发生变化导致选择器失效时，控制台输出明确的警告信息，不影响页面正常使用
**Plans**: 1 plan

Plans:
- [x] 04-01-PLAN.md — unlockDetailButton 函数实现 + processRow 集成 + 错误处理验证

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 脚本脚手架与路由感知 | 1/1 | Complete   | 2026-04-24 |
| 2. DOM 变化监听 | 1/1 | Complete    | 2026-04-24 |
| 3. React Fiber 数据提取 | 1/1 | Complete    | 2026-04-24 |
| 4. 按钮启用与健壮性 | 1/1 | Complete    | 2026-04-24 |
