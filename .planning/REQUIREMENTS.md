# Requirements: CoolCollege 作答详情解锁脚本

**Defined:** 2026-04-24
**Core Value:** 所有考试记录的作答详情按钮都可点击并正确跳转

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Script Metadata & Initialization

- [x] **INIT-01**: 脚本包含正确的 Tampermonkey metadata（@name, @match, @grant 等）
- [x] **INIT-02**: 脚本仅在 `pro.coolcollege.cn` 的考试数据页面激活
- [x] **INIT-03**: 脚本通过 `window.onurlchange` 检测 SPA 路由切换，支持页面间导航
- [x] **INIT-04**: 脚本在页面初次加载和路由切换时均能正确初始化

### DOM Observation

- [ ] **DOM-01**: 使用 MutationObserver 监听目标表格区域 DOM 变化
- [ ] **DOM-02**: 使用去抖（300ms）避免频繁 DOM 变化导致的重复处理
- [ ] **DOM-03**: 使用 `data-processed` 属性标记已处理的行，避免重复操作
- [ ] **DOM-04**: 正确管理 Observer 生命周期（路由离开时 disconnect）

### Data Extraction

- [ ] **DATA-01**: 通过 React Fiber 属性获取表格行的 `record` 数据对象
- [ ] **DATA-02**: 支持多个 Fiber 属性名 fallback（`__reactInternalInstance$`、`__reactFiber$`、`_reactInternals`）
- [ ] **DATA-03**: 从 `record` 中提取 `submit_id`、`exam_id`、`task_id`、`show_record` 等字段
- [ ] **DATA-04**: 从页面 URL 或 API 请求中获取 `enterprise_id`（eid）

### Button Processing

- [ ] **BTN-01**: 检测所有 `show_record === "false"` 的灰色作答详情按钮
- [ ] **BTN-02**: 将灰色按钮样式修改为蓝色可点击（`color: rgb(0, 122, 255); cursor: pointer`）
- [ ] **BTN-03**: 为按钮绑定点击事件处理器
- [ ] **BTN-04**: 点击时使用 `GM_openInTab` 在新标签页打开作答详情
- [ ] **BTN-05**: 跳转 URL 格式正确（包含 exam_id、submit_id、task_id、eid）

### Error Handling

- [ ] **ERR-01**: Fiber 属性不存在时优雅降级（跳过该行而非报错）
- [ ] **ERR-02**: record 数据缺失 `submit_id` 时跳过该行
- [ ] **ERR-03**: 页面结构变化导致选择器失效时输出控制台警告

## v2 Requirements

Deferred to future release.

### Enhancement

- **ENH-01**: 自动检测并支持其他类似禁用场景（重考按钮等）
- **ENH-02**: 提供脚本配置面板（自定义选择器、颜色等）
- **ENH-03**: 支持批量打开多个作答详情

## Out of Scope

| Feature | Reason |
|---------|--------|
| 修改考试分数 | 仅修改前端展示，不触碰后端数据 |
| 自动登录 | 用户必须自行登录 |
| 支持其他平台 | 仅针对 pro.coolcollege.cn |
| 构建工具/打包 | 单文件脚本，不需要 |
| 第三方库依赖 | 仅使用浏览器原生 API + Tampermonkey API |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INIT-01 | Phase 1 | Complete |
| INIT-02 | Phase 1 | Complete |
| INIT-03 | Phase 1 | Complete |
| INIT-04 | Phase 1 | Complete |
| DOM-01 | Phase 2 | Pending |
| DOM-02 | Phase 2 | Pending |
| DOM-03 | Phase 2 | Pending |
| DOM-04 | Phase 2 | Pending |
| DATA-01 | Phase 3 | Pending |
| DATA-02 | Phase 3 | Pending |
| DATA-03 | Phase 3 | Pending |
| DATA-04 | Phase 3 | Pending |
| BTN-01 | Phase 4 | Pending |
| BTN-02 | Phase 4 | Pending |
| BTN-03 | Phase 4 | Pending |
| BTN-04 | Phase 4 | Pending |
| BTN-05 | Phase 4 | Pending |
| ERR-01 | Phase 4 | Pending |
| ERR-02 | Phase 4 | Pending |
| ERR-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 20 (4 phases)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-24*
*Last updated: 2026-04-24 after roadmap creation*
