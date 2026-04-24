# Technology Stack: Tampermonkey Userscript Development

**Project:** CoolCollege 作答详情解锁脚本
**Researched:** 2026-04-24

## Recommended Stack

### Core Framework
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Tampermonkey API | Current (2025) | Userscript engine | De facto standard userscript manager with wide browser support (Chrome, Firefox, Edge, Safari) | HIGH |
| Vanilla JavaScript | ES6+ | Primary language | All modern browsers support ES6+ features natively, no transpilation needed for simple scripts | HIGH |
| MutationObserver | Web API | Dynamic DOM watching | Native API for detecting DOM changes in SPA, far more efficient than polling | HIGH |
| window.onurlchange | Tampermonkey API | SPA route detection | Tampermonkey 原生 API, 比 hashchange/popstate 更可靠, 专门为 SPA 设计 | HIGH |

### Metadata Structure (Standard Directives)

Tampermonkey requires a metadata block at the top of the script with these standard directives:

```javascript
// ==UserScript==
// @name         CoolCollege 作答详情解锁
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  解锁酷学院考试数据页面的灰色「作答详情」按钮
// @author       You
// @match        https://pro.coolcollege.cn/*
// @grant        window.onurlchange
// @run-at       document-idle
// ==/UserScript==
```

**Required Directives:**
- `@name` - Display name of the script shown in Tampermonkey UI
- `@match` - URL pattern(s) where script should run. Format: `<protocol>://<domain><path>`
  - Use `*` as wildcard: `https://*.example.com/*` matches all subdomains and paths
  - Use multiple `@match` lines for multiple patterns
  - **Important:** `<all_urls>` is not supported; use `*://*/*` instead
  - Scheme part accepts `http*://` to match both http and https
- `@grant` - Whitelists GM_* functions and special window APIs
  - Use `// @grant none` when no GM APIs needed -- disables sandbox for simpler execution
  - Default (empty `@grant` list) is different from `@grant none` -- don't omit when you need nothing
  - When `@grant none` is used, no `GM_*` functions are available, but `GM_info` remains accessible

**Common Optional Directives:**
- `@namespace` - Helps identify script uniquely, prevents name collisions
- `@version` - For automatic updates (semantic versioning)
- `@description` - Brief description of what the script does
- `@author` - Script author
- `@icon` / `@iconURL` - Icon shown in UI
- `@homepage` / `@website` / `source` - Project URLs
- `@updateURL` / `@downloadURL` - For automatic updates
- `@run-at` - Control when script injects:
  - `document-start` - As soon as possible
  - `document-body` - When body element appears
  - `document-end` - When DOMContentLoaded fires
  - `document-idle` - After DOMContentLoaded (DEFAULT, recommended for this project)
  - `context-menu` - When user clicks browser context menu item
- `@require` - Include external JavaScript files (e.g., jQuery, Lodash)
- `@resource` - Preload resources like CSS, images (accessed via `GM_getResourceURL`)

**Confidence: HIGH** (verified from Tampermonkey official documentation via Context7)

### Handling SPA (Single-Page Application) Sites

For React/SPA sites like CoolCollege that dynamically load content:

| Technique | Purpose | Best Practice | Confidence |
|-----------|---------|---------------|------------|
| **window.onurlchange** | Detect URL route changes | Tampermonkey 原生 API. Use with `// @grant window.onurlchange`. 比 hashchange/popstate 更可靠, 专门为 SPA 路由检测设计. Feature is supported if `window.onurlchange === null` | HIGH |
| **MutationObserver** | Detect DOM additions/modifications | Watch specific containers, not entire document. Use debouncing (100-300ms) to limit excessive callbacks | HIGH |
| **Debouncing** | Prevent excessive reprocessing | Throttle handler execution with trailing debounce after last DOM change | HIGH |
| **WeakSet / data attributes** | Avoid redundant processing | Track already processed buttons/elements to prevent duplicate event handlers | HIGH |

**Recommended SPA Handling Pattern:**

```javascript
// ==UserScript==
// @match        https://pro.coolcollege.cn/*
// @grant        window.onurlchange
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  // Track processed elements to avoid duplicates
  const processedButtons = new WeakSet();
  let observer = null;

  // Debounce utility
  let debounceTimer;
  const debounce = (fn, delay) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fn, delay);
  };

  // Main processing function
  const scanAndProcess = () => {
    document.querySelectorAll('tr').forEach(row => {
      if (row.dataset.ccProcessed) return;
      // ... extract React Fiber, enable button, add click handler
      row.dataset.ccProcessed = 'true';
    });
  };

  // Setup MutationObserver for DOM changes
  const startObserver = () => {
    if (observer) observer.disconnect();

    observer = new MutationObserver(() => {
      debounce(scanAndProcess, 150);
    });

    const container = document.querySelector('.ant-table-body') || document.body;
    observer.observe(container, { childList: true, subtree: true });

    // Initial scan
    debounce(scanAndProcess, 100);
  };

  // Handle URL changes via Tampermonkey native API
  // This is the recommended way to detect SPA navigation
  if (window.onurlchange === null) {
    // Feature is supported
    window.addEventListener('urlchange', (info) => {
      if (location.hash.includes('/training/examination/exam-data')) {
        // Wait for React to render the new route
        setTimeout(startObserver, 300);
      }
    });
  }

  // Fallback: hashchange for non-onurlchange environments
  window.addEventListener('hashchange', () => {
    if (location.hash.includes('/training/examination/exam-data')) {
      setTimeout(startObserver, 300);
    }
  });

  // Initial run
  startObserver();
})();
```

**Key Points:**
1. `window.onurlchange` is Tampermonkey's official SPA detection API -- prefer over manual polling
2. Always use `subtree: true` and `childList: true` to detect nested changes
3. Observe only the specific container that changes, not the entire `document`
4. Use `WeakSet` or `data-*` attributes for processed elements to avoid duplicate event handlers
5. Debounce is essential -- DOM changes fire frequently in SPA
6. Disconnect old observer before creating new one on route change

**Confidence: HIGH** (window.onurlchange verified from Tampermonkey official docs via Context7)

### Development Workflow

| Approach | Usage | Recommendation | Confidence |
|----------|-------|----------------|------------|
| **Local .user.js file** | Simple scripts (< 200 lines) | 本项目推荐. Create `.user.js` file locally, drag-drop install to Tampermonkey, or use file:// URL | HIGH |
| **Direct Tampermonkey editor** | Quick fixes, tiny scripts | Tampermonkey 内置编辑器, 适合微调但不适合版本控制 | HIGH |
| **Vite + vite-plugin-monkey** | Larger scripts, TypeScript, multi-file | 现代开发流程, 支持 HMR、自动生成 metadata、TypeScript | MEDIUM |

**Recommended Workflow for This Project:**

1. Create `.user.js` file locally in project directory
2. Install to Tampermonkey via drag-drop or file:// URL
3. Edit locally with preferred editor (version control with Git)
4. Refresh browser tab to reload script after changes
5. For Tampermonkey file:// access: enable "Allow access to file URLs" in extension settings

**Modern Workflow (for reference, not needed for this project):**

```bash
# Scaffold new project with vite-plugin-monkey
npm create monkey@latest
# Choose template: vanilla, TypeScript, Vue, React, Preact, Svelte, Solid
cd my-script
npm install
npm run dev
# Auto-generates userscript with hot reload via Tampermonkey
```

Features of vite-plugin-monkey:
- Auto-generates metadata block from vite.config.ts
- Automatic `@grant` detection based on code usage
- Hot module replacement during development
- CDN support for external dependencies (auto `@require`)
- TypeScript support out of box

**Confidence: MEDIUM** (vite-plugin-monkey is popular and well-maintained but overkill for this project)

### Supporting Libraries

Project constraints: "no third-party dependencies". Only native browser APIs are used.

| Library | Purpose | When to Use |
|---------|---------|-------------|
| **None** | - | This project -- all APIs are native browser APIs | This project |
| **jQuery** | DOM querying | Legacy codebases only -- avoid in 2025, native `querySelector` is sufficient |
| **TypeScript** | Type safety | Larger maintained scripts with vite-plugin-monkey |
| **@types/tampermonkey** | Type definitions for GM_* API | TypeScript projects only |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Script Engine | Tampermonkey | Violentmonkey | Tampermonkey has largest user base and best compatibility; Violentmonkey is fine but less popular |
| DOM Change Detection | MutationObserver | setInterval polling | Polling wastes CPU, fires at wrong times; MutationObserver is native and event-driven |
| SPA Route Detection | window.onurlchange | hashchange + popstate | onurlchange is Tampermonkey's official solution; use hashchange only as fallback |
| Sandbox Mode | @grant none | Default sandbox | When no GM_* APIs needed, running without sandbox avoids context issues accessing page JS |
| Development | Local file editing | Direct Tampermonkey UI editor | Version control with Git is easier; better developer experience |
| Build System | None (vanilla JS) | vite-plugin-monkey | Overkill for a single-file script under 200 lines; adds unnecessary complexity |

## Best Practices Summary

1. **Be specific with @match** -- don't use `*://*/*` unless necessary; running everywhere impacts performance
2. **Use window.onurlchange for SPA** -- Tampermonkey's native API, more reliable than hashchange/popstate for detecting SPA route changes
3. **Debounce MutationObserver** -- never process every single DOM change, batch them with 100-300ms delay
4. **Track processed elements** -- use WeakSet or `data-*` attributes to prevent duplicate event handlers
5. **Observe only what changes** -- watch specific containers, not entire document
6. **Disconnect old observers** -- before creating new ones on route change, call `observer.disconnect()`
7. **Don't mutate React state** -- only read from Fiber, never write; modify DOM directly for visual changes
8. **Use @grant none when possible** -- simpler execution context, no sandbox issues; but use specific grants when you need GM APIs
9. **IIFE wrapping** -- always wrap in IIFE to avoid polluting global scope
10. **Mark script initialized** -- add `window.__yourScriptName` check to prevent double initialization

## Installation (for development with vite-plugin-monkey)

```bash
# Only if choosing the modern workflow (NOT recommended for this project)
npm create monkey@latest
cd coolcollege-unlock
npm install
npm install -D @types/tampermonkey
```

**For this project (simple vanilla JS):**
- Create `coolcollege-unlock.user.js` file
- Install to Tampermonkey via drag-drop or file:// URL
- No npm/node needed

## Sources

- [Tampermonkey Official Documentation - @match](https://www.tampermonkey.net/documentation.php?q=include) -- HIGH confidence, verified via Context7
- [Tampermonkey Official Documentation - @grant](https://www.tampermonkey.net/documentation.php?q=meta%3Agrant) -- HIGH confidence, verified via Context7
- [Tampermonkey Official Documentation - window.onurlchange](https://www.tampermonkey.net/documentation.php?q=api%3Awindow.onurlchange) -- HIGH confidence, verified via Context7
- [vite-plugin-monkey GitHub](https://github.com/lisonge/vite-plugin-monkey) -- MEDIUM confidence, verified via Context7
- MutationObserver patterns for SPA userscripts -- MEDIUM confidence, community standard
