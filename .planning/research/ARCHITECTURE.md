# Architecture Patterns

**Domain:** Tampermonkey 用户脚本（目标 React SPA）
**Researched:** 2026-04-24

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Tampermonkey Script                        │
├─────────────────────────────────────────────────────────────┤
│  1. Bootstrapper         - 脚本初始化时机控制               │
│  2. DOM Observer         - MutationObserver 监听变化        │
│  3. React Fiber Extractor - 从 DOM 提取 React 数据         │
│  4. Button Processor     - 按钮修改和点击处理               │
│  5. URL Router           - 构造跳转 URL 并打开新页面       │
└─────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Bootstrapper** | 决定脚本何时初始化，等待 DOM 就绪 | DOM Observer |
| **DOM Observer** | 监听表格区域 DOM 变化，检测新增行数据 | Button Processor |
| **React Fiber Extractor** | 从 DOM 元素提取 React fiber 链，获取 record 数据 | Button Processor |
| **Button Processor** | 移除禁用样式，注入点击事件处理器 | URL Router |
| **URL Router** | 从当前 URL 提取参数，构造目标 URL，打开新标签页 | Browser API |

### Data Flow

```
URL 变化 (SPA 路由)
    ↓
MutationObserver 检测到 DOM 变化
    ↓
触发去抖后的处理函数
    ↓
扫描表格行 <tr> 元素
    ↓
对每行提取 React Fiber → 获取 record 数据
    ↓
如果 show_record 为 false → 找到作答详情按钮
    ↓
移除禁用样式 → 注入点击处理器
    ↓
点击 → 构造完整 URL → 新标签页打开
```

## Patterns to Follow

### Pattern 1: 延迟初始化策略

**What:** 不要在脚本加载时立即处理，等待页面路由完成和 React 渲染完成后再启动。

**When:** SPA 应用通常在客户端完成路由匹配和数据拉取，DOM 不会在文档加载时就就绪。

**示例代码:**
```javascript
// ==UserScript==
// @name         CoolCollege Unlock
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Unlock answer details on CoolCollege
// @author       You
// @match        https://pro.coolcollege.cn/*
// @grant        GM_openInTab
// ==/UserScript==

(function() {
    'use strict';

    // 策略1: DOMContentLoaded 后再启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // 已经加载完成，延迟一小段等待 React  hydration
        setTimeout(init, 500);
    }

    function init() {
        // 检查是否在目标页面
        if (!location.hash.startsWith('#/training/examination/exam-data')) {
            // SPA 路由变化，等待后续观察
            startUrlWatcher();
            return;
        }
        startObserver();
    }
})();
```

**为什么:** React 应用在客户端 hydration 完成前 DOM 结构不完整，提前处理会找不到元素。

### Pattern 2: MutationObserver + 防抖

**What:** 使用 MutationObserver 监听目标区域的 DOM 变化，配合防抖避免频繁执行。

**When:** React SPA 数据动态加载，表格行会异步添加，路由切换会替换整个内容区。

**示例代码:**
```javascript
function startObserver() {
    const tableContainer = document.querySelector('.ant-table-body') || document.body;

    let debounceTimer;
    const observer = new MutationObserver((mutations) => {
        // 防抖: 500ms 内多次变化只处理一次
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            processExistingRows();
        }, 500);
    });

    observer.observe(tableContainer, {
        childList: true,
        subtree: true
    });

    // 立即处理已有内容
    processExistingRows();
}

function processExistingRows() {
    const rows = document.querySelectorAll('.ant-table-tbody tr');
    rows.forEach(row => {
        if (row.dataset.processed) return; // 去重: 已经处理过不再处理
        processRow(row);
        row.dataset.processed = 'true';
    });
}
```

**为什么:**
- `childList: true` + `subtree: true` 能捕获所有新增节点
- 防抖避免了短时间内重复处理多次，提升性能
- `data-processed` 标记避免重复处理同一行

### Pattern 3: React Fiber 数据提取

**What:** 从 DOM 元素遍历 React Fiber 链找到对应的 props 中的 record 数据。

**When:** React 渲染的数据存储在 Fiber 树中，不在 DOM 上，需要通过内部属性提取。

**示例代码:**
```javascript
function extractRecordFromRow(rowElement) {
    // React 16/17: __reactInternalInstance$
    // React 18+: _reactInternals
    let fiber = rowElement.__reactInternalInstance$ ||
                rowElement._reactInternals ||
                rowElement.__reactFiber$;

    if (!fiber) return null;

    // 向上遍历 Fiber 链找到包含 record 的组件
    const maxDepth = 20;
    let depth = 0;
    while (fiber && depth < maxDepth) {
        // 检查当前 fiber 是否有 memoizedProps
        const props = fiber.memoizedProps;
        if (props) {
            // Ant Design 表格行通常 record 在 props
            if (props.record) {
                return props.record;
            }
            // 某些情况在 children 或其他位置
            if (props.children && Array.isArray(props.children)) {
                for (const child of props.children) {
                    if (child && child.props && child.props.record) {
                        return child.props.record;
                    }
                }
            }
        }
        fiber = fiber.return;
        depth++;
    }

    return null;
}
```

**关键要点:**
- React 版本不同属性名不同需要兼容 (`__reactInternalInstance$`, `__reactFiber$`, `_reactInternals`)
- 需要向上遍历 `fiber.return` 链才能找到包含数据的父组件
- Ant Design Table 的 `record` 在行组件的 `memoizedProps` 中

### Pattern 4: 点击处理注入

**What:** 直接替换或在现有按钮上添加点击事件处理器，阻止默认行为并执行跳转。

**When:** 原按钮被 React 禁用点击处理，需要我们自己接管。

**示例代码:**
```javascript
function enableButton(button, record) {
    // 移除禁用样式
    button.style.pointerEvents = 'auto';
    button.style.cursor = 'pointer';
    button.style.color = '#1890ff'; // Ant Design 蓝色

    // 移除现有的禁用类
    button.classList.remove('ant-btn-disabled');

    // 添加点击处理器
    button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation(); // 阻止 React 事件触发

        const targetUrl = buildDetailUrl(record);
        // 使用 GM_openInTab 在新标签页打开
        GM_openInTab(targetUrl, {active: true});
    });
}

function buildDetailUrl(record) {
    // 从当前 URL 提取参数
    const currentUrl = location.href;
    const examIdMatch = currentUrl.match(/exam_id=([^&]+)/);
    const taskIdMatch = currentUrl.match(/task_id=([^&]+)/);

    const examId = examIdMatch ? examIdMatch[1] : record.exam_id;
    const taskId = taskIdMatch ? taskIdMatch[1] : record.task_id;
    const submitId = record.submit_id;

    // 从当前 URL 提取 enterprise id
    const eidMatch = currentUrl.match(/eid=([^&]+)/);
    const baseUrl = eidMatch
        ? `https://pro.coolcollege.cn/sub-sys/kuxueyuan-manage/prod/split?eid=${eidMatch[1]}`
        : location.origin + location.pathname;

    return `${baseUrl}#/training/examination/new-exam/parse?exam_id=${examId}&submit_id=${submitId}&task_id=${taskId}&user_id=`;
}
```

**为什么:**
- `e.stopPropagation()` 阻止 React 的事件处理器接收到点击
- 使用 `GM_openInTab` 确保油猴权限正确，新标签页打开不影响原页面
- 保留现有 DOM 结构只修改样式和行为，避免触发 React 重渲染

### Pattern 5: URL 变化监听

**What:** 监听 `hashchange` 和 `popstate` 事件应对 SPA 路由切换。

**When:** React Router 通常使用 hash 路由或 HTML5 history API。

**示例代码:**
```javascript
function startUrlWatcher() {
    let lastUrl = location.href;

    // 检查 URL 变化的定时器（兼容 history.pushState）
    const urlChecker = setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            if (location.hash.startsWith('#/training/examination/exam-data')) {
                // 进入目标页面，启动观察者
                setTimeout(() => {
                    startObserver();
                }, 300);
            }
        }
    }, 1000);

    // 同时监听 hashchange
    window.addEventListener('hashchange', () => {
        if (location.hash.startsWith('#/training/examination/exam-data')) {
            setTimeout(() => {
                startObserver();
            }, 300);
        }
    });
}
```

**为什么:**
- history.pushState 不会触发 `popstate` 事件，定时器轮询是简单可靠的兼容方案
- 1 秒轮询对性能影响可忽略，但能及时检测路由变化

## Anti-Patterns to Avoid

### Anti-Pattern 1: 使用 setInterval 轮询全表而不用 MutationObserver

**What:** 每隔几百毫秒扫描整个表格而不使用 MutationObserver。

**Why bad:**
- 恒定轮询浪费 CPU 资源，页面卡顿
- 处理时机不准确，可能在 DOM 更新中间处理导致错误

**Instead:** 使用 MutationObserver 只在变化发生时处理，配合防抖。

### Anti-Pattern 2: 修改 DOM 后没有标记已处理导致重复注入

**What:** 每次处理都重新给所有按钮绑定事件，同一个按钮被绑定多次。

**Why bad:**
- 点击时会触发多次打开多个相同标签页
- 内存泄漏，事件监听器累积

**Instead:** 给处理过的行添加 `data-processed="true"` 标记，跳过已处理行。

### Anti-Pattern 3: 直接替换整个按钮而不是修改现有元素

**What:** 删除原按钮，创建一个新的按钮元素替换它。

**Why bad:**
- 可能触发 React 的重渲染，导致我们的修改被覆盖
- 破坏原有的 DOM 结构可能引发意外问题

**Instead:** 只修改样式和添加事件监听器，保持原有 DOM 结构。

### Anti-Pattern 4: 从页面文本提取 submit_id 而不是从 React Fiber

**What:** 尝试通过正则匹配表格文本提取 submit_id。

**Why bad:**
- 页面布局变化会导致提取失败
- 不可靠，submit_id 不一定在页面可见文本中

**Instead:** 使用 React Fiber 从内部数据结构提取，最可靠。

## Scalability Considerations

| Concern | At 10 rows | At 100 rows | At 1000 rows |
|---------|------------|-------------|--------------|
| **Memory usage** | 标记已处理行，无问题 | 无问题 | 少量额外内存，DOM 存在就占用 |
| **Processing time** | 瞬发 | <10ms | ~50ms，防抖后用户无感知 |
| **Observer overhead** | 可忽略 | 可忽略 | MutationObserver 本身高效，依然可忽略 |
| **Fiber traversal** | 快 | 可接受 | 每次遍历深度有限，仍可接受 |

**优化建议:**
- 如果需要处理 1000+ 行，可以使用 IntersectionObserver 只处理可见行
- 分页场景下，翻页后原有行会被移除，`data-processed` 标记随 DOM 移除自动清理

## Build Order Implications

脚本代码建议的组织顺序:

1. **工具函数** - `extractRecordFromRow`, `buildDetailUrl` 等纯函数
2. **核心组件** - `processRow`, `processExistingRows`, `enableButton`
3. **观察者** - `startObserver` (MutationObserver 初始化)
4. **初始化** - `init`, `startUrlWatcher`
5. **启动** - 调用 `init()`

避免使用类，保持函数式风格，油猴脚本生命周期和页面一致，不需要实例状态管理。

## Sources

- 社区实践总结: React Fiber 提取模式在用户脚本中广泛使用，通过遍历 `fiber.return` 链获取组件 props
- MutationObserver 是现代浏览器标准，比轮询更高效
- Tampermonkey `GM_openInTab` API 文档: https://www.tampermonkey.net/documentation.php#GM_openInTab
