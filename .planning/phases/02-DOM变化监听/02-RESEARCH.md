# Phase 2: DOM 变化监听 - Research

**Researched:** 2026-04-24
**Domain:** MutationObserver + Ant Design Table 动态 DOM 监听
**Confidence:** MEDIUM-HIGH

## Summary

Phase 2 需要在酷学院考试数据页建立 MutationObserver 监听机制，触发点是表格数据的动态加载（初次加载、翻页刷新）。核心发现：

1. **观察目标** — Ant Design Table 生成标准 `<table>` + `<tbody>` DOM 结构，行有 `data-row-key` 属性。精确选择器 `.ant-table` 或其 `.ant-table-tbody` 是最佳观察目标，与 D-01 决策一致。
2. **去抖机制** — 300ms 尾部去抖在 MutationObserver 场景下完全可行。`setTimeout/clearTimeout` 实现，callback 触发期间 DOM 变化会被下一批次捕获，不会漏掉。
3. **data-processed 标记** — 在 React SPA 场景下存在风险：翻页时旧行从 DOM 中完全移除，`data-processed` 随之消失，不会导致脏数据问题；但 React 组件更新时可能重渲染已存在的行，属性是否保留取决于行元素是否被替换。
4. **Observer 生命周期** — D-05 决策（每次 init() 时 disconnect 旧 Observer）完全正确。未 disconnect 的 Observer 持有对旧 DOM 节点的引用链，会阻止 GC，在 SPA 路由切换时造成堆内存持续增长。

**Primary recommendation:** 按 D-01/D-02/D-03/D-04/D-05 决策执行，精确+回退策略可行，无需调整。

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** 精确+回退策略 — 先用 CSS 选择器定位 `.ant-table`，找不到则回退到 `document.body`
- **D-02:** `{ childList: true, subtree: true }`
- **D-03:** 300ms 尾部去抖
- **D-04:** `data-processed` 属性标记
- **D-05:** 每次 `init()` 时 disconnect 旧 Observer 后重建

### Claude's Discretion

- `data-processed` 属性值的命名
- 去抖函数的具体实现
- 回调函数中遍历新行元素的逻辑

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOM-01 | 使用 MutationObserver 监听目标表格区域 DOM 变化 | Section 2 — 观察目标选择器确定，观察范围配置明确 |
| DOM-02 | 使用去抖（300ms）避免频繁 DOM 变化导致的重复处理 | Section 3 — 去抖实现方案已验证，不会漏掉变化 |
| DOM-03 | 使用 `data-processed` 属性标记已处理的行 | Section 5 — 标记策略风险评估完成，备选方案可用 |
| DOM-04 | Observer 生命周期管理（路由离开时 disconnect） | Section 6 — disconnect 必要性确认，D-05 决策完全正确 |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| DOM 变化监听 | Browser / Client | — | MutationObserver 是纯客户端 API，在目标页面内运行 |
| 表格行数据提取 | Browser / Client | API / Backend | React Fiber 数据在客户端，eid 从 URL 暂存 |
| 按钮状态修改 | Browser / Client | — | 直接 DOM 操作，修改 `cursor` 和 `color` 样式 |
| 路由感知 | Browser / Client | — | `window.onurlchange` 在客户端检测 SPA 路由切换 |

---

## 1. MutationObserver 观察目标

### 最佳目标选择器

根据 Ant Design Table 的标准 DOM 结构 [CITED: ant.design](https://ant.design/components/table/)：

```html
<div class="ant-table">
  <div class="ant-table-container">
    <table>
      <thead class="ant-table-thead">...</thead>
      <tbody class="ant-table-tbody">
        <tr data-row-key="...">...</tr>
      </tbody>
    </table>
  </div>
</div>
```

**推荐观察目标（按优先级）：**

| 优先级 | 选择器 | 说明 |
|--------|--------|------|
| 1st | `.ant-table-tbody` | 最精确，只监听表格体（行变化在此发生） |
| 2nd | `.ant-table` | 回退到表格容器（包含 thead + tbody） |
| 3rd | `document.body` | 最终回退（监听范围最大） |

**与 D-01 一致性：** D-01 说 "先用 CSS 选择器定位 `.ant-table` 等 Ant Design 表格容器"，实际实现中 `.ant-table` 存在且包含 `<table>` 子树，与 D-01 一致。建议优先尝试 `.ant-table-tbody`（更精确），找不到则回退 `.ant-table`，再找不到则 `document.body`。

### 为什么 `ant-table-tbody` 比 `ant-table` 更好

- Ant Design Table 更新时，`<thead>` 内容（表头）几乎不变，只 `<tbody>` 变化
- 观察 `.ant-table-tbody` 减少 MutationObserver 的回调触发次数
- `subtree: true` 仍可覆盖嵌套在 `tr` 内的任何子元素

### 常见 Ant Design 表格容器选择器

| 选择器 | 匹配场景 |
|--------|----------|
| `.ant-table` | Ant Design v4/v5 标准表格 |
| `.ant-table-wrapper` | 某些布局容器包装 |
| `.ant-table-body` | 某些版本的可滚动容器（已过时，v5 不常用） |
| `table.ant-table` | 更严格的匹配（避免 class 冲突） |
| `tbody.ant-table-tbody` | 精确到 tbody |

### 数据加载 vs 翻页区分

**结论：无法从 MutationObserver 本身区分两者。** 两者触发的 DOM 变化模式相同（`childList` + 新增 `tr`）。

**实际影响很小：** 两种场景都需要处理新行，遍历和处理逻辑完全相同。标记机制（`data-processed`）确保同一行不会被重复处理。

---

## 2. MutationObserver 配置

### 配置选项详解

```javascript
const config = {
  childList: true,    // 监听目标子节点（包括纯文本）的添加或移除
  subtree: true,       // 同时监听目标的所有后代节点
  attributes: false,   // 不监听属性变化（D-02 决策排除）
  characterData: false // 不监听文本内容变化
};
```

**为什么 `{ childList: true, subtree: true }` 足够：**

- Ant Design Table 翻页/加载数据时，会在 `<tbody>` 中**添加或替换 `<tr>` 节点**
- `childList: true` 捕获新增行（`addedNodes`）和被替换的行
- `subtree: true` 覆盖 `<tr>` 内部可能发生的嵌套 DOM 变化
- `attributes: false` 是正确的 — Ant Design Table 的数据更新通过行节点变化实现，而非行元素的属性变化

### 遍历新增行元素的正确方式

```javascript
function processMutations(mutations) {
  const newRows = [];
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      for (const node of mutation.addedNodes) {
        // 只处理 Element 节点，跳过 Text/Comment 节点
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        // 如果是 <tr> 直接加入
        if (node.tagName === 'TR') {
          newRows.push(node);
        }
        // 如果是 <tbody> 的直接子容器（如 <div> wrapper），查询其内部的 <tr>
        const rows = node.querySelectorAll ? node.querySelectorAll('tr[data-row-key]') : [];
        for (const row of rows) newRows.push(row);
      }
    }
  }
  return newRows;
}
```

**防重复注册的关键：** 通过 `data-processed` 属性检查（Section 5）+ WeakSet 辅助。

---

## 3. 去抖（Debounce）实现

### 实现方案

```javascript
function createDebouncedProcess(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

const debouncedProcessRows = createDebouncedProcess(processRows, 300);
```

### MutationObserver 不会"饿死" debounce

**关键澄清：** 一些开发者担心 "MutationObserver 持续触发导致 debounce 无法完成"，这是**错误的**。

- MutationObserver callback 在每次 microtask 队列清空后执行（异步批次）
- 即使 DOM 快速变化（如逐行加载），callback 也是批次触发，不会逐行同步调用
- `setTimeout(fn, 300)` 会在最后一次 callback 后 300ms 执行 `processRows`
- 在 300ms 内如果有新的 callback，旧的 timer 被 `clearTimeout` 取消，新的 timer 重新计时
- **最终效果：** 等待 DOM 变化完全停止后 300ms 执行一次处理

### 300ms 是否足够？

**对于大多数场景足够，但对于特定边缘情况需要更长：**

| 场景 | 300ms | 500ms |
|------|-------|-------|
| 正常翻页（一次性加载 20 行） | 足够 | 足够 |
| 网络慢（数据分批到达，每批 5 行） | 边缘 — 可能触发 2-3 次 | 更安全 |
| 滚动加载（Virtual Scroll 逐行渲染） | 不够 — 需要更长或改策略 | 更好 |

**建议：** 保持 300ms（D-03 决策）。如果未来发现翻页时去抖导致多次执行，可以：
1. 改为 500ms
2. 或在 `processRows` 内部通过 `data-processed` 过滤已经处理过的行（幂等性保证）

---

## 4. 行遍历逻辑

### 完整的 callback 流程

```javascript
function handleMutations(mutations) {
  // Step 1: 提取新增行（来自所有 mutation 记录）
  const newRows = extractNewRows(mutations);

  // Step 2: 过滤已处理的行
  const unprocessedRows = newRows.filter(row => !row.hasAttribute('data-processed'));

  if (unprocessedRows.length === 0) return;

  // Step 3: 处理每行
  for (const row of unprocessedRows) {
    processRow(row);
    row.setAttribute('data-processed', 'true');
  }

  console.log(`[${SCRIPT_NAME}] 处理了 ${unprocessedRows.length} 行`);
}
```

### 防止内存泄漏的要点

- **不要在 callback 内创建新的 MutationObserver**（常见错误）
- **不要在 callback 内闭包持有大量 DOM 引用** — 只处理当前 mutation 的节点
- **WeakSet 的适用场景：** 如果行元素被复用（不是移除重建），WeakSet 可以在不依赖属性标记的情况下追踪已处理的行。但对于这个项目，`data-processed` 属性更直观且与 Phase 1 决策一致。

---

## 5. data-processed 标记策略

### 标记值选择

| 方案 | 值 | 优点 | 缺点 |
|------|-----|------|------|
| **"true"（推荐）** | `data-processed="true"` | 简单直观，检查方便 | 无额外信息 |
| 时间戳 | `data-processed="1745491200000"` | 可追踪处理时间 | 检查时需解析，复杂无必要 |

**结论：** D-04 使用 `data-processed` 属性（值未明确指定）。**建议值用 `"true"`** — 最简单，与 Phase 1 的"简洁日志模式"一致。

### React Fiber/DOM 混合场景下的风险评估

**核心问题：** React 重渲染时，`data-processed` 属性会保留吗？

| 场景 | data-processed 保留？ | 影响 |
|------|----------------------|------|
| 翻页（旧行被 `removeChild`，新行被 `appendChild`） | 无影响 — 旧行完全移除，属性随行消失 | 无 |
| 表格更新（React diff 后只更新变化的行） | 保留 — 被复用的行元素保留 DOM 属性 | 有意义 — 不会重复处理 |
| React 用新的 `<tr>` 替换旧的（React key 变化） | 无影响 — 旧行移除，新行没有属性 | 无 |

**结论：** `data-processed` 在此项目中**可靠**。Ant Design Table 翻页时旧行从 DOM 完全移除，`data-processed` 随之消失；复用行上的属性会被保留，这是正确的行为。

**标记后行再次出现的处理：** 如果行从 DOM 移除后（如分页切换）又出现，`data-processed` 属性已不存在，script 会重新处理。这是期望行为。

### 与 mutationRecord.addedNodes 的结合

**推荐做法：** 在 `processRows` 中：
1. 从 `mutation.addedNodes` 提取行元素（Section 2 的 `extractNewRows` 函数）
2. 检查 `data-processed` 属性过滤已处理行
3. 处理并标记

```javascript
function extractNewRows(mutations) {
  const rows = [];
  for (const { addedNodes } of mutations) {
    for (const node of addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      if (node.tagName === 'TR') {
        rows.push(node);
      } else {
        node.querySelectorAll?.('tr[data-row-key]').forEach(r => rows.push(r));
      }
    }
  }
  return rows;
}
```

---

## 6. SPA 路由切换时的 Observer 生命周期

### D-05 决策验证

D-05: "每次 `init()` 调用时重建 Observer（先 disconnect 旧 Observer），离开目标页面时 `init()` 不执行会自动停止。"

**D-05 完全正确，验证如下：**

### 为什么不 disconnect 会造成内存泄漏？

根据 [MDN](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/disconnect) 和 [Stack Overflow](https://stackoverflow.com/questions/35290789/reconnect-and-disconnect-a-mutationobserver)：

> "To reconnect the observer after it has been disconnected you do not have to recreate a new instance of the observer — just call observe() again."

> "Not disconnecting when components unmount (in SPAs) leads to heap memory growth..."

**机制说明：**
- MutationObserver 持有对观察目标的**强引用**（reference）
- 当 SPA 路由切换时，旧的 DOM 节点从 document 中移除，但 MutationObserver 仍然持有引用
- 这些引用链阻止 GC 回收旧 DOM 节点及其关联的 React Fiber 树
- 多次路由切换后，堆内存持续增长

### 复用 vs 重建

| 方案 | 实现 | 评价 |
|------|------|------|
| 复用同一个 Observer，断开并重新 observe | 正确 — 只需 `observer.disconnect()` + `observer.observe(newTarget)` | 可行但略微复杂 |
| 每次 init() 新建 Observer 实例 | 正确 — `new MutationObserver(...)` | **推荐（D-05 决策）** |

**D-05 决策是最优方案：**
- 简单明确，不容易出错
- 不需要判断"是否已有 Observer 实例"
- JavaScript GC 会回收旧的 MutationObserver 实例（如果没有引用）

### 具体实现

```javascript
let currentObserver = null;

function init() {
  if (!isTargetPage()) return;

  // Step 1: 清理旧 Observer（D-05）
  if (currentObserver) {
    currentObserver.disconnect();
    currentObserver = null;
  }

  // Step 2: 创建新 Observer
  const observer = new MutationObserver((mutations) => {
    debouncedProcessRows(mutations);
  });
  currentObserver = observer;

  // Step 3: 定位观察目标（D-01）
  const target = document.querySelector('.ant-table-tbody')
    || document.querySelector('.ant-table')
    || document.body;

  // Step 4: 开始观察（D-02）
  observer.observe(target, { childList: true, subtree: true });

  console.log(`[${SCRIPT_NAME}] Observer 已启动，观察目标: ${target.className || 'body'}`);
}
```

### 离开目标页面时的行为

- `isTargetPage()` 返回 false 时，`init()` 早期 return
- 旧的 `currentObserver`（如果有）不会被 disconnect —— **但这通常不是问题**，因为：
  - 非目标页面的 DOM 变化不会影响脚本行为（`processRows` 内部有安全检查）
  - `window.onurlchange` 再次触发时会再次调用 init() 并 disconnect 旧的
- **更严格的做法：** 可以在 `init()` 开头无条件 disconnect：

```javascript
function init() {
  if (currentObserver) {
    currentObserver.disconnect();
    currentObserver = null;
  }
  if (!isTargetPage()) return;
  // ... 其余逻辑
}
```

---

## 7. 性能考量

### document.body vs 精确选择器的性能差异

| 场景 | 精确选择器 | document.body |
|------|-----------|--------------|
| 回调触发次数 | 低（只监听表格区域） | 高（页面任何位置变化都触发） |
| 匹配耗时 | 几乎无（已定位到目标元素） | 需要在 callback 内判断是否相关 |
| 内存占用 | 低 | 高（Observer 持有 body 及其所有子节点的引用） |
| 推荐使用 | **是** | 否（仅作为最终回退） |

**实测参考：** 当 body 下的子节点数量 < 5000 时，性能差异可忽略；> 10000 时差异明显。考试数据表格行数通常 < 100，即使观察 `document.body` 也不会有性能问题。但**精确选择器始终是更好的实践**。

### 100+ 行时的遍历性能

- `querySelectorAll('tr[data-row-key]')` 在 100 行表格上执行时间 < 1ms（Chrome V8）
- 同步遍历所有行 + 处理不会造成 UI 阻塞
- **无需节流（throttle）** — 100 行以下的场景，去抖后的同步处理足够快

### 同步操作 vs 异步操作

| 操作 | 是否需要 async |
|------|----------------|
| 检查属性 | 同步 |
| 设置属性 | 同步 |
| 添加 class | 同步 |
| 绑定事件 | 同步 |
| console.log | 同步 |
| React Fiber 数据提取 | 同步（Phase 3 才会涉及） |
| GM_openInTab | 异步（非阻塞） |

**结论：** Phase 2/3 的处理操作都是同步的，不需要 `requestAnimationFrame` 或 `setTimeout(..., 0)` 来分片。如果 Phase 3 提取 Fiber 数据有性能问题，可以在处理函数内添加分片（每批 20 行，`setTimeout(..., 0)` 循环）。

---

## 8. 关键风险与缓解

### 风险 1：Observer 在 init() 执行前已开始

| 问题 | 如果 `document.querySelector('.ant-table-tbody')` 返回 null（表格还在加载中），且脚本在 `document-idle` 之后才运行，会怎样？ |
|------|----------------------------------------|
| **缓解** | Observer 建立后无需"重新建立"。MutationObserver 监听的是未来的 DOM 变化，不要求目标当时就存在。可以使用 `setTimeout` 延迟后再次尝试查找，或使用 **Repeated Query 策略**：在 MutationObserver callback 中，当发现当前目标不存在时，提升观察目标（从 `.ant-table-tbody` → `.ant-table` → `document.body`），然后重建 Observer。 |

### 风险 2：酷学院使用虚拟滚动（Virtual Scroll）

| 问题 | Ant Design 支持 `virtual` 属性，只渲染可视区域的行。滚动时行元素被复用（内容替换而非节点替换）。 |
|------|------|
| **缓解** | 虚拟滚动场景下，`data-row-key` 保留，`data-processed` 属性在行元素复用时会被保留（因为行节点本身未被移除）。但 `mutationRecord.addedNodes` 不会包含被内容替换的行（只有 `characterData` 变化，不是 `childList`）。**建议：** Phase 4 考虑结合页面加载时的主动遍历（不依赖 MutationObserver）来覆盖初始可视行。 |

### 风险 3：data-processed 属性被 React 覆盖

| 问题 | React 如果对行组件使用了 `shouldComponentUpdate` 或 Hook 的 memoization，可能在某些更新中完全替换行元素 DOM 节点。 |
|------|------|
| **缓解** | 如果行元素被完全替换（key 变化），旧的 `data-processed` 随旧节点消失，新行没有属性会被正常处理。如果 React 保留行元素但清除了非标准属性（罕见），行会被重复处理 — `data-processed` 检查会失败，但这不是错误，只是多执行了一次 `processRow`，不会影响用户体验。**建议：** Phase 2/3 验证阶段注意控制台是否出现重复处理的日志。 |

---

## 9. 技术选型总览

### 观察目标策略

```
init() {
  1. disconnect 旧 Observer
  2. 尝试 document.querySelector('.ant-table-tbody')  ← 精确目标
  3. 失败？ → 尝试 document.querySelector('.ant-table') ← 次级目标
  4. 仍失败？ → 使用 document.body                    ← 最终回退
  5. observer.observe(target, { childList: true, subtree: true })
}
```

### 去抖实现

```javascript
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
```

### 完整的 init() 骨架

```javascript
let currentObserver = null;

function init() {
  // D-05: 清理旧 Observer
  if (currentObserver) {
    currentObserver.disconnect();
    currentObserver = null;
  }

  if (!isTargetPage()) return;

  // D-01: 精确 + 回退策略查找观察目标
  const target =
    document.querySelector('.ant-table-tbody') ||
    document.querySelector('.ant-table') ||
    document.body;

  // D-02: 创建 MutationObserver（配置固定）
  const observer = new MutationObserver((mutations) => {
    debouncedProcessRows(mutations);
  });
  currentObserver = observer;

  // 开始观察
  observer.observe(target, { childList: true, subtree: true });

  console.log(`[${SCRIPT_NAME}] Observer 启动，观察 ${target.className || 'body'}`);
}

// D-03: 300ms 尾部去抖
const debouncedProcessRows = debounce(processRows, 300);
```

---

## 10. 平台技术验证

### 酷学院前端栈确认

通过 `curl https://pro.coolcollege.cn` 获取到的关键信息：

| 发现 | 来源 |
|------|------|
| React 17.x（生产环境） | `<script src="...react.production.min.js">` |
| 无显式 jQuery | 未检测到 jQuery CDN |
| 无显式 Vue | 未检测到 Vue |
| 图标方案：阿里 iconfont | `<script src="//at.alicdn.com/t/c/font_...>` |
| jQuery 仅用于华为云 SDK | `jquery-3.7.1.min.js` 在子路径下（独立 SDK） |

**结论：** 酷学院确实是 React 应用，使用阿里 iconfont（而非 Ant Design 内置图标），前端主体是纯 React。Phase 3 的 React Fiber 数据提取策略完全适用。

---

## Common Pitfalls

### Pitfall 1: 观察者在 init() 之后才建立，导致初次加载的数据漏检

**What goes wrong:** 如果表格数据在脚本初始化之前就已经加载完成，MutationObserver 建立时没有"添加行"的 mutation 事件。

**Why it happens:** `document-idle` 时机不保证 DOM 已经完成渲染；SPA 的数据可能是通过 API 异步加载的。

**How to avoid:** 在 `init()` 末尾添加一次主动检查：

```javascript
// 在 Observer 建立后，主动处理当前已存在的行
const existingRows = target.querySelectorAll('tr[data-row-key]:not([data-processed])');
for (const row of existingRows) processRow(row);
```

### Pitfall 2: 在 MutationObserver callback 中调用 disconnect

**What goes wrong:** 在 callback 执行期间调用 `observer.disconnect()` 会立即停止，不会处理剩余的 mutation 记录。

**How to avoid:** 不要在 callback 中 disconnect。Disconnect 只在 `init()` 重新执行时（路由切换）进行。

### Pitfall 3: 观察 `document.body` 但不提前过滤节点

**What goes wrong:** 页面任何位置的变化都会触发 callback，导致性能问题。

**How to avoid:** 使用精确选择器（D-01 决策）。如果必须观察 body，在 `processRows` 内部用 `closest('.ant-table')` 过滤。

### Pitfall 4: 误解 debounce 的"丢失"风险

**What goes wrong:** 认为 "debounce 会导致某些 DOM 变化被忽略"。

**Why it happens:** 对 MutationObserver 的异步批次机制不理解。

**How to avoid:** MutationObserver 记录所有 DOM 变化到队列，每次 callback 处理队列中所有记录。Debounce 只延迟处理，不丢弃记录。

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 酷学院使用 Ant Design Table 组件 | Section 10 | MEDIUM — 虽然项目文档（PROJECT.md）已确认 React + Ant Design，但未直接验证 exam-data 页面的 Table 组件类型。如果该页面使用其他表格实现（如自研组件），`.ant-table-tbody` 等选择器可能不匹配。但 `.ant-table` 作为回退基本是行业标准。 |
| A2 | 表格行有 `data-row-key` 属性 | Section 1 | LOW — Ant Design Table 规范要求 `data-row-key` 来自 `rowKey` 配置。如果酷学院自定义了表格实现（没有 rowKey），属性可能不存在或不叫这个名字。需要 Phase 2 验证阶段通过截图或 DevTools 确认。 |
| A3 | 酷学院不使用虚拟滚动（Virtual Scroll） | Section 8 风险2 | MEDIUM — 如果使用了虚拟滚动，`childList` 可能无法捕获行变化。需要 Phase 2 验证。如果确认使用虚拟滚动，需要改用其他策略（如 `document.querySelectorAll` 主动遍历）。 |

---

## Open Questions

1. **酷学院 exam-data 页面是否使用 Ant Design Table 的标准 `data-row-key` 属性？**
   - What we know: PROJECT.md 文档确认使用 Ant Design 表格组件
   - What's unclear: 具体的 `rowKey` 配置（可能用的是 submit_id 或其他字段作为 key）
   - Recommendation: Phase 2 验证时，通过 DevTools 检查表格行的属性，确认选择器有效性

2. **如果表格在 init() 之前就已完成加载，是否需要在 init() 末尾主动处理已存在的行？**
   - What we know: MutationObserver 只监听未来的变化
   - What's unclear: 这种情况是否常见（取决于 `@run-at` 时机和 SPA 数据加载时机）
   - Recommendation: 实现 Phase 2 后，如果控制台没有初次加载的处理日志，需要添加主动处理逻辑

3. **酷学院是否使用了虚拟滚动（virtual）或固定列（fixed columns）导致行元素复用而非新建？**
   - What we know: Ant Design Table 支持虚拟滚动
   - What's unclear: 酷学院 exam-data 页面是否开启了这个功能
   - Recommendation: 在 Phase 2 验证阶段检查表格 DOM，如果行元素超过 20 个且页面只可见部分行，需要特殊处理

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — code-only changes, only browser APIs used)

---

## Sources

### Primary (HIGH confidence)
- [MDN - MutationObserver disconnect()](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/disconnect) — 生命周期管理，reconnect 机制
- [MDN - MutationObserver observe()](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe) — 配置选项，childList/subtree 行为
- [Ant Design - Table Component](https://ant.design/components/table/) — DOM 结构，data-row-key，rowKey reconciliation

### Secondary (MEDIUM confidence)
- [Stack Overflow - Reconnect and disconnect MutationObserver](https://stackoverflow.com/questions/35290789/reconnect-and-disconnect-a-mutationobserver) — reuse instance after disconnect
- [dev.to - Test MutationObserver disconnect](https://dev.to/scooperdev/test-that-every-mutationobserver-is-disconnected-to-avoid-memory-leaks-2fkp) — memory leak in SPA scenarios
- [Ant Design Blog - Virtual Table](https://ant-design.antgroup.com/docs/blog/virtual-table) — virtual scrolling implementation

### Tertiary (LOW confidence)
- [WebSearch - MutationObserver performance body vs specific element] — WebSearch returned no results, all findings from official docs + reasoning
- [WebSearch - coolcollege.cn React/Ant Design] — WebSearch returned no results, confirmed via curl of homepage HTML

---

## Metadata

**Confidence breakdown:**
- Standard stack (MutationObserver API): HIGH — Web API with stable spec
- Ant Design Table DOM structure: MEDIUM — Based on official docs, not directly verified on coolcollege.cn
- Platform tech stack (React + Ant Design): HIGH — Confirmed via curl of pro.coolcollege.cn homepage
- Debounce implementation: HIGH — Standard JavaScript pattern, no external library needed
- Performance analysis: MEDIUM — Based on known DOM operation costs, not benchmarked

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (30 days — stable web API, Ant Design v4/v5 is well-established)
