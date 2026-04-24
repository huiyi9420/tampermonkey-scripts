# Domain Pitfalls: React SPA 油猴脚本

**Domain:** Tampermonkey 油猴脚本操作 React 单页应用
**Researched:** 2026-04-24

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

---

### Pitfall 1: React Fiber 内部属性访问脆弱性

**What goes wrong:**
依赖私有属性如 `__reactInternalInstance$`、`_internal`、`__reactFiber$` 获取 React 状态数据，这些属性名在不同 React 版本中会变化，属性结构也可能改变。

**Why it happens:**
React 不暴露公开 API 获取 DOM 元素对应的 Fiber 节点，开发者被迫使用私有属性 hack。但 React 版本升级（甚至网站自己的小版本更新）都可能改变这些内部属性。

**Consequences:**
- 网站更新 React 版本后脚本完全失效
- 只能靠用户反馈才能发现问题
- 需要紧急修复重新发布

**本项目案例：**
当前方案通过 `tr.__reactInternalInstance$...memoizedProps.record` 获取 `submit_id`，这个属性名 `__reactInternalInstance$` 在 React 18 中已经变为 `__reactFiber$`。

**Prevention:**
- 尝试多个可能的属性名 fallback：
  ```javascript
  function getFiber(node) {
    return node.__reactFiber$ ||
           node.__reactInternalInstance$ ||
           node._reactInternalFiber;
  }
  ```
- 添加防御性检查，属性不存在时报错但不崩溃
- 在 `try-catch` 中访问 Fiber，任何错误都优雅降级
- 备选方案：从 table 数据源或者 URL 中提取数据

**Detection:**
检查脚本日志是否有 "Cannot read property 'memoizedProps' of undefined" 错误。

---

### Pitfall 2: SPA 路由切换时机问题

**What goes wrong:**
脚本只在页面初始加载时运行一次，React 路由切换后新页面 DOM 没有被处理；或者路由离开后脚本残留事件监听导致内存泄漏。

**Why it happens:**
传统网页是完整页面加载，而 SPA 路由切换是动态替换 DOM，不会触发完整页面 reload。油猴的 `@run-at document-start` 或 `document-idle` 只执行一次。

**Consequences:**
- 用户导航到目标页面后按钮仍然不可点击
- 需要手动刷新才能生效，用户体验极差
- 多次切换路由后性能下降

**Prevention:**
- 使用 `popstate` 事件监听路由变化
- 使用 `MutationObserver` 监听容器 DOM 变化
- 使用 `hashchange` 事件监听 hash 路由变化（本项目是 hash 路由）
- 路由变化后重新扫描并处理目标按钮
- 使用节流避免过于频繁的重新扫描

**本项目应对：**
监听 `hashchange` 和 `popstate`，URL 匹配目标路径 `#/training/examination/exam-data` 时自动执行。

---

### Pitfall 3: MutationObserver 内存泄漏

**What goes wrong:**
创建了 MutationObserver 但在 DOM 替换后没有调用 `disconnect()`，导致观察者持续监听已移除的 DOM 节点，不断执行回调，造成 CPU 占用过高。

**Why it happens:**
SPA 不断替换 DOM 树，每次路由变化都创建新的 observer，但旧的 observer 没有被清理。闭包持有对旧 DOM 的引用，垃圾回收无法回收。

**Consequences:**
- 页面越来越慢，最终卡住浏览器
- 多次执行同一处理逻辑导致重复绑定事件
- 多个重复按钮或重复点击处理程序

**Prevention:**
- 保存 observer 引用，路由变化前先调用 `disconnect()`
- 使用单个全局 observer，不要每次变化都创建新的
- 使用 `{ subtree: true, childList: true }` 只监听需要的变化
- 在 `disconnect` 后移除所有事件监听器

**Detection:**
开发者工具 Performance 记录看 Scripting 时间是否持续增长，检查 MutationObserver 实例数量。

---

### Pitfall 4: DOM 操作竞态条件

**What goes wrong:**
脚本在 React 完成渲染前就尝试修改 DOM，修改被 React 重新渲染覆盖掉；或者 React 正在更新 DOM 时脚本同时修改，产生冲突。

**Why it happens:**
- 油猴 `@run-at document-idle` 不等 React hydration 完成
- 数据异步加载完成前，表格行还没有渲染出来
- 脚本查询 `document.querySelectorAll` 返回空，没找到元素就放弃了

**Consequences:**
- 脚本"有时有效有时无效"，间歇性失效
- 需要手动刷新多次才能生效
- 调试困难，因为刷新通常能解决

**Prevention:**
- 使用 `setTimeout` 或 `requestAnimationFrame` 延迟处理
- 使用 `MutationObserver` 等待元素出现再处理
- 实现一个简单的轮询检查（最多 10-20 次，避免无限轮询）
- 使用 debounce 合并多次 DOM 变化，避免重复处理
- 处理完元素后标记 `data-processed="true"` 避免重复处理

**本项目应对：**
目标表格数据是异步加载的，必须等待 `tr` 元素出现在 DOM 中才能处理。

---

## Moderate Pitfalls

### Pitfall 1: CSS 类名脆弱依赖

**What goes wrong:**
依赖被压缩过的 CSS 类名如 `.exam-record-operate___2q2xH` 来定位元素，网站重新构建后 CSS 模块哈希会变化。

**Why it happens:**
目标网站使用 CSS Modules 或 CSS-in-JS，类名包含内容哈希，每次构建哈希都变。

**Consequences:**
网站重新部署后脚本找不到元素，完全失效。

**Prevention:**
- 使用文本内容选择：`querySelector("span:contains('作答详情')")` 或自定义实现
- 使用 DOM 结构关系：`table tr td:last-child span` 更稳定
- 使用属性选择替代类名
- 组合多个条件定位，增加鲁棒性

**本项目案例：**
当前 `.exam-record-operate___2q2xH` 就属于会变的哈希类名，需要更稳定的定位策略。

---

### Pitfall 2: 事件监听器重复绑定

**What goes wrong:**
每次 DOM 更新都重新绑定点击事件处理器，导致一次点击触发多次跳转，打开多个重复标签页。

**Why it happens:**
DOM 更新后重新扫描所有按钮，已经处理过的按钮又被绑定一次事件。没有去重机制。

**Consequences:**
用户点击一次打开 N 个相同标签页，非常烦扰。

**Prevention:**
- 在处理过的元素上标记 `data-script-processed`
- 绑定前先 `removeEventListener` 再添加
- 使用事件委托，把监听器绑在父容器上而不是每个按钮上

---

### Pitfall 3: React 状态不一致

**What goes wrong:**
只修改 DOM 的可见性样式（去除 `cursor: not-allowed`，改颜色），但不修改 React 内部状态，导致点击仍然被 React 的事件处理器拦截。

**Why it happens:**
开发者以为改了 DOM 就够了，实际上 React 的点击处理器可能内部有检查。

**Consequences:**
按钮看起来可点击了，但点击没反应或者跳转到错误地址。

**Prevention:**
- 如果可以，修改 React 的 props 或 state 让 React 自己重新渲染
- 移除原有的点击处理器，自己完全接管点击
- 阻止原事件冒泡，自己处理跳转

---

## Minor Pitfalls

### Pitfall 1: 脚本多次注入

**What goes wrong:**
同一个脚本在页面上被注入多次，多个 MutationObserver 同时运行，重复处理同一个元素。

**Why it happens:**
- `@match` 模式过于宽泛，导航后重新注入
- Tampermonkey 在 SPA 导航中有时会重复注入
- 用户安装了多次脚本

**Prevention:**
- 检查 `window.__yourScriptNameInited` 标记，如果已存在就退出
- 使用 IIFE 或模块化避免污染全局命名空间
- 初始化时清理旧的全局标记

---

### Pitfall 2: 不安全的 `eval`/innerHTML 绕过 CSP

**What goes wrong:**
尝试注入内联脚本，但网站启用了 Content Security Policy，被浏览器拦截。

**Why it happens:**
开发者想用 `eval` 或者 `<script>` 注入代码访问页面变量，但 CSP 阻止内联脚本。

**Prevention:**
- 油猴脚本本身已经在页面环境中运行，不需要额外注入 `<script>`
- 如果一定要和页面通信，使用 `window.postMessage`
- 大多数情况下用户脚本直接在正确的上下文中运行，不需要绕 CSP

---

### Pitfall 3: 无限轮询

**What goes wrong:**
为了等待元素出现，使用 `setInterval` 无限轮询，即使元素已经找到也不清理定时器。

**Why it happens:**
忘记调用 `clearInterval`。

**Consequences:**
每秒都执行查询，浪费 CPU。

**Prevention:**
- 限制最大尝试次数（如 20 次，间隔 200ms = 4 秒超时）
- 找到元素后立即清理定时器
- 改用 MutationObserver 更高效

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| 初始 DOM 查询 | 找不到元素，过早放弃 | 实现轮询 + MutationObserver 双保险 |
| React Fiber 数据提取 | 属性名不存在，获取到 undefined | 多属性 fallback，完整 try-catch |
| 路由监听 | 路由切换后不生效 | 监听 hashchange + popstate，URL 匹配时自动重运行 |
| MutationObserver 实现 | 内存泄漏，重复触发 | 单个 observer，disconnect 旧的，标记已处理元素 |
| 点击处理 | 一次点击打开多个标签页 | 标记已处理，去抖，事件委托 |

## 本项目特定风险

| 风险点 | 严重程度 | 缓解措施 |
|--------|----------|----------|
| `__reactInternalInstance$` 属性名变化 | HIGH | 尝试多个备选属性名，添加错误处理 |
| CSS 类名哈希变化 | HIGH | 改用基于文本和结构的选择器 |
| 异步表格数据加载 | MEDIUM | MutationObserver 等待 tr 出现 |
| hash 路由切换 | MEDIUM | 监听 hashchange 事件 |

## Sources

- 油猴脚本开发社区经验总结：常见 React SPA 集成问题
- React 内部实现：Fiber 结构不公开稳定性保证
- MDN: MutationObserver 使用最佳实践
- 本项目上下文：目标网站使用 CSS Modules 和 React Fiber

---

## 调试建议

当脚本出现问题时，按这个顺序检查：

1. **元素找不到？** → 检查 CSS 类名是否变化，看 DOM 结构
2. **获取不到 submit_id？** → 检查 Fiber 属性名是否变了，console.log 实际属性
3. **第一次没用刷新就好？** → 时机问题，增加等待机制
4. **点一下开很多窗？** → 重复绑定事件，检查去重标记
5. **越来越卡？** → 内存泄漏，检查 observer 和定时器清理
