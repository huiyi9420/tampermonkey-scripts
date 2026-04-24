# Project Research Summary

**Project:** CoolCollege 作答详情解锁脚本
**Domain:** Tampermonkey userscript for React SPA (CoolCollege pro.coolcollege.cn)
**Researched:** 2026-04-24
**Confidence:** MEDIUM-HIGH

## Executive Summary

This is a single-file Tampermonkey userscript that unlocks disabled "作答详情" buttons on the CoolCollege exam data page. The core challenge is extracting `submit_id` from React Fiber (Ant Design Table), since the data is not exposed in the DOM. The standard 2025 approach is vanilla ES6+ JavaScript with only native browser APIs -- no third-party dependencies, no build system. Tampermonkey's native `window.onurlchange` API combined with `MutationObserver` and debouncing handles SPA navigation and dynamic table updates efficiently.

The five-phase roadmap (Bootstrapper -> DOM Observer -> React Fiber Extraction -> Button Processing -> Testing) reflects the natural dependency chain: each phase builds on the previous. The most significant risk is that React Fiber property names are private and fragile -- the site could update React and break the script without warning. Mitigation is multi-property fallbacks, defensive error handling, and a strategy for on-site debugging.

## Key Findings

### Recommended Stack

**Core technologies:**
- **Tampermonkey** -- de facto standard userscript manager with `window.onurlchange` native SPA detection API (Tampermonkey official docs via Context7)
- **Vanilla ES6+ JavaScript** -- no transpilation needed, all modern browsers support it natively (HIGH confidence)
- **MutationObserver + debouncing** -- native event-driven DOM watching, far more efficient than polling (HIGH confidence)
- **@grant none** -- running without sandbox avoids context issues when no GM_* APIs are needed; use `GM_openInTab` when tab opening is needed

**Metadata directives:**
- `@match https://pro.coolcollege.cn/*` -- specific URL pattern, never `*://*/*`
- `@grant window.onurlchange` -- Tampermonkey's official SPA route detection, preferred over `hashchange`/`popstate`
- `@run-at document-idle` -- start after DOMContentLoaded, wait for React hydration

**Recommended development workflow:**
- Single `.user.js` file locally, drag-drop install to Tampermonkey
- No build system needed for a script under 200 lines
- vite-plugin-monkey is available for larger TypeScript projects but is overkill here

### Expected Features

**Must have (table stakes):**
- Detect disabled buttons via CSS class or attribute inspection
- Remove disabled styling (color: #ccc -> #1890ff, cursor: not-allowed -> pointer, opacity, pointerEvents)
- Extract `submit_id` from React Fiber by traversing `memoizedProps` up the `fiber.return` chain
- Construct correct navigation URL using `exam_id`, `task_id`, `submit_id` from current URL + record data
- Add click handler to open details in new tab via `GM_openInTab` or `window.open`
- MutationObserver with debounce (100-300ms trailing) to handle dynamic table loading
- SPA route change detection via `window.onurlchange` (primary) + `hashchange` (fallback)
- Mark processed elements with `data-userscript-processed` to avoid duplicate processing

**Should have (differentiators):**
- Multiple React Fiber property key fallbacks (`__reactFiber$`, `__reactInternalInstance$`, `_reactInternals`)
- Auto-retry with short delay when Fiber traversal fails on first attempt
- `requestIdleCallback` to defer processing to idle periods
- Visual feedback on processed buttons (subtle highlight or icon change)

**Defer (v2+):**
- Visual feedback marking -- nice-to-have, not required for MVP
- Multiple Fiber key fallbacks beyond known patterns -- add only if needed
- Idle callback processing -- only if performance issues are observed
- Support for platforms beyond CoolCollege

**Anti-features to explicitly avoid:**
- Modify backend data or bypass authentication -- only read data already loaded by authenticated user
- Change scores or exam results -- unlock viewing only
- Inject third-party libraries -- keep self-contained and lightweight
- Fixed-interval polling -- always prefer MutationObserver
- Deep React state mutation -- read-only access via Fiber
- Persistent storage modifications -- all changes are DOM-local

### Architecture Approach

Five clean components with single-direction data flow:

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Bootstrapper** | Controls script init timing, waits for DOM and React hydration | DOM Observer |
| **DOM Observer** | MutationObserver watches table container for DOM changes | Button Processor |
| **React Fiber Extractor** | Traverses Fiber chain from `<tr>` to extract `record` data | Button Processor |
| **Button Processor** | Removes disabled CSS, injects click event handler | URL Router |
| **URL Router** | Extracts `exam_id`/`task_id` from current URL, constructs full target URL, opens new tab | Browser API |

**Data flow:** URL change -> MutationObserver detects DOM update -> debounced scan -> `extractRecordFromRow()` traverses Fiber -> if `show_record === false` -> `enableButton()` removes styling + adds click handler -> click -> `buildDetailUrl()` constructs URL -> `GM_openInTab()` opens new tab.

**Code organization order:** utility functions (extractRecord, buildDetailUrl) -> core components (processRow, processExistingRows, enableButton) -> observer (startObserver) -> initialization (init, startUrlWatcher) -> launch.

**Key patterns:**
- Use `WeakSet` or `data-*` attributes for processed element tracking
- `e.stopPropagation()` in click handler to prevent React's own handler from intercepting
- Disconnect old observer before creating new one on route change
- Keep it functional, no classes needed -- script lifecycle matches page lifecycle

### Critical Pitfalls

1. **React Fiber property name fragility (HIGH)** -- `__reactInternalInstance$` varies by React version (React 18 uses `__reactFiber$`). Prevention: try all known keys with fallback chain, wrap in try-catch, fail gracefully.
2. **CSS class hash instability (HIGH)** -- `.exam-record-operate___2q2xH` contains a CSS Modules hash that changes on site rebuild. Prevention: use text content or DOM structure relationships as primary selectors, keep class-based selectors as fallback.
3. **MutationObserver memory leak (HIGH)** -- creating observers without calling `disconnect()` on route change. Prevention: save observer reference, call `disconnect()` before creating new one, use single global observer.
4. **SPA route change timing (MEDIUM)** -- script runs once at page load, not on subsequent React Router navigation. Prevention: `window.onurlchange` + `hashchange`/`popstate` listener, re-scan on route match.
5. **Event listener duplication (MEDIUM)** -- repeated scans rebind click handlers, causing multiple tabs on one click. Prevention: `data-userscript-processed` marking, `removeEventListener` before add, event delegation on parent container.
6. **React state inconsistency (MEDIUM)** -- modifying DOM but not React's internal event handlers, so clicks are intercepted. Prevention: `e.stopPropagation()` and full click handler takeover.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: 脚手架与路由感知
**Rationale:** Script cannot do anything without correct metadata and init timing. This foundation must come first.
**Delivers:** Working `@match`/`@grant` metadata, URL routing detection via `window.onurlchange` + `hashchange` fallback, initial scan trigger on correct page.
**Addresses:** STACK metadata, SPA route detection pattern.
**Avoids:** Missing `@grant` for `window.onurlchange`, running on wrong pages, multiple script injections via `window.__scriptNameInited` guard.

### Phase 2: DOM 变化监听
**Rationale:** Without MutationObserver, dynamic table content from React SPA will never be detected. This is the prerequisite for all DOM processing.
**Delivers:** MutationObserver watching `.ant-table-body` container, debounce (150-300ms trailing), `data-processed` marking to prevent duplicates, disconnect/ reconnect on route change.
**Addresses:** Dynamic table loading, duplicate processing prevention.
**Avoids:** Pitfall 3 (observer memory leak), Pitfall 5 (duplicate event binding).

### Phase 3: React Fiber 数据提取
**Rationale:** This is the core technical challenge. Extracting `submit_id` from React Fiber is what everything else depends on, and it is inherently fragile and site-specific.
**Delivers:** `extractRecordFromRow()` with multi-key fallback (`__reactFiber$`, `__reactInternalInstance$`, `_reactInternals`), upward traversal of `fiber.return` chain, defensive error handling, auto-retry mechanism.
**Addresses:** Table stakes feature -- extract `submit_id` from record data.
**Avoids:** Pitfall 1 (Fiber property fragility) -- mitigate via fallback chain; **requires on-site debugging** to validate actual property names.

### Phase 4: 按钮启用与 URL 跳转
**Rationale:** Once data extraction works, enabling buttons and constructing URLs is straightforward. This delivers the core user-facing value.
**Delivers:** `enableButton()` removes disabled CSS (color, cursor, opacity, pointerEvents, disabled class), `buildDetailUrl()` extracts `exam_id`/`task_id` from current URL + `submit_id` from record, `GM_openInTab` opens details in new tab, `e.stopPropagation()` prevents React interception.
**Addresses:** All button processing and navigation features from FEATURES.md.
**Avoids:** Pitfall 5 (duplicate event binding), Pitfall 6 (React state inconsistency).

### Phase 5: 测试与健壮性验证
**Rationale:** All fragile dependencies converge here. This phase validates the script works under real conditions and catches issues from Phase 3's inherent fragility.
**Delivers:** Edge case handling (empty rows, missing fields), error logging with fallbacks, verification of all phase integration points, performance check under load.
**Addresses:** Robustness, graceful degradation.
**Avoids:** Silent failures, user confusion from intermittent breakage.

### Phase Ordering Rationale

- Phase 1 must come first: defines execution context and init timing
- Phase 2 is prerequisite for all DOM processing: nothing works without MutationObserver
- Phase 3 is the core technical risk: requires on-site debugging, can't be fully validated without it
- Phase 4 depends on Phases 2+3: needs both observer and data extraction working
- Phase 5 is last: validates everything and handles edge cases discovered during integration

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (React Fiber extraction):** Requires on-site debugging. Actual property names on target site may differ from documented patterns. Plan for runtime validation step.
- **Phase 4 (Button enable):** CSS class/selector strategy may need adjustment after Phase 3 reveals actual DOM structure.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Tampermonkey metadata is well-documented via Context7 official docs
- **Phase 2:** MutationObserver patterns are established community practice
- **Phase 5:** General testing principles apply

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Tampermonkey API and metadata verified from official documentation via Context7 |
| Features | HIGH | All features well-understood from project requirements, clear table stakes defined |
| Architecture | MEDIUM | Standard community patterns, but React Fiber extraction is inherently fragile and site-specific |
| Pitfalls | HIGH | Major pitfalls identified from community experience, mitigations documented |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Actual React Fiber property names on target site:** Cannot be verified without on-site debugging. Document expected names but implement fallback chain.
- **CSS class hash stability:** `.exam-record-operate___2q2xH` is a known risk. Validate selector strategy during Phase 3 on-site work.
- **URL pattern validation:** Actual URL pattern for target details page needs verification on target site.
- **React hydration timing:** Actual delay needed before elements appear may differ from the 300-500ms estimated.

## Sources

### Primary (HIGH confidence)
- Tampermonkey Official Documentation -- `@match`, `@grant`, `window.onurlchange`, `GM_openInTab` -- verified via Context7
- MDN Web Docs -- MutationObserver, `requestIdleCallback` -- native browser APIs

### Secondary (MEDIUM confidence)
- Community userscript development patterns -- React Fiber traversal, SPA handling
- vite-plugin-monkey GitHub -- alternative build workflow reference
- Ant Design Table internal structure -- `record` in `memoizedProps` of row fiber

### Tertiary (LOW confidence)
- Specific CSS class names and hashes on CoolCollege -- requires on-site verification
- Specific React version on target site -- affects Fiber property names
- Exact URL pattern for details page navigation -- requires on-site debugging

---

*Research completed: 2026-04-24*
*Ready for roadmap: yes*
