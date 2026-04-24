<!-- GSD:project-start source:PROJECT.md -->
## Project

**CoolCollege 作答详情解锁脚本**

一个 Tampermonkey 油猴脚本，运行在酷学院（pro.coolcollege.cn）考试数据页面，自动将灰色不可点击的「作答详情」按钮变为可点击状态，并正确跳转到作答详情页面。面向需要在酷学院平台查看历史考试作答详情的用户。

**Core Value:** 所有考试记录（无论及格与否）的作答详情按钮都必须可点击并正确跳转。

### Constraints

- **Tech Stack**: Tampermonkey / Greasemonkey 用户脚本（JavaScript）
- **Browser**: Chrome / Firefox（Tampermonkey 支持）
- **Dependencies**: 仅使用浏览器原生 API，不依赖第三方库
- **SPA 兼容**: 必须使用 MutationObserver 或定时器处理动态 DOM 变化
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Framework
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Tampermonkey API | Current (2025) | Userscript engine | De facto standard userscript manager with wide browser support (Chrome, Firefox, Edge, Safari) | HIGH |
| Vanilla JavaScript | ES6+ | Primary language | All modern browsers support ES6+ features natively, no transpilation needed for simple scripts | HIGH |
| MutationObserver | Web API | Dynamic DOM watching | Native API for detecting DOM changes in SPA, far more efficient than polling | HIGH |
| window.onurlchange | Tampermonkey API | SPA route detection | Tampermonkey 原生 API, 比 hashchange/popstate 更可靠, 专门为 SPA 设计 | HIGH |
### Metadata Structure (Standard Directives)
- `@name` - Display name of the script shown in Tampermonkey UI
- `@match` - URL pattern(s) where script should run. Format: `<protocol>://<domain><path>`
- `@grant` - Whitelists GM_* functions and special window APIs
- `@namespace` - Helps identify script uniquely, prevents name collisions
- `@version` - For automatic updates (semantic versioning)
- `@description` - Brief description of what the script does
- `@author` - Script author
- `@icon` / `@iconURL` - Icon shown in UI
- `@homepage` / `@website` / `source` - Project URLs
- `@updateURL` / `@downloadURL` - For automatic updates
- `@run-at` - Control when script injects:
- `@require` - Include external JavaScript files (e.g., jQuery, Lodash)
- `@resource` - Preload resources like CSS, images (accessed via `GM_getResourceURL`)
### Handling SPA (Single-Page Application) Sites
| Technique | Purpose | Best Practice | Confidence |
|-----------|---------|---------------|------------|
| **window.onurlchange** | Detect URL route changes | Tampermonkey 原生 API. Use with `// @grant window.onurlchange`. 比 hashchange/popstate 更可靠, 专门为 SPA 路由检测设计. Feature is supported if `window.onurlchange === null` | HIGH |
| **MutationObserver** | Detect DOM additions/modifications | Watch specific containers, not entire document. Use debouncing (100-300ms) to limit excessive callbacks | HIGH |
| **Debouncing** | Prevent excessive reprocessing | Throttle handler execution with trailing debounce after last DOM change | HIGH |
| **WeakSet / data attributes** | Avoid redundant processing | Track already processed buttons/elements to prevent duplicate event handlers | HIGH |
### Development Workflow
| Approach | Usage | Recommendation | Confidence |
|----------|-------|----------------|------------|
| **Local .user.js file** | Simple scripts (< 200 lines) | 本项目推荐. Create `.user.js` file locally, drag-drop install to Tampermonkey, or use file:// URL | HIGH |
| **Direct Tampermonkey editor** | Quick fixes, tiny scripts | Tampermonkey 内置编辑器, 适合微调但不适合版本控制 | HIGH |
| **Vite + vite-plugin-monkey** | Larger scripts, TypeScript, multi-file | 现代开发流程, 支持 HMR、自动生成 metadata、TypeScript | MEDIUM |
# Scaffold new project with vite-plugin-monkey
# Choose template: vanilla, TypeScript, Vue, React, Preact, Svelte, Solid
# Auto-generates userscript with hot reload via Tampermonkey
- Auto-generates metadata block from vite.config.ts
- Automatic `@grant` detection based on code usage
- Hot module replacement during development
- CDN support for external dependencies (auto `@require`)
- TypeScript support out of box
### Supporting Libraries
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
## Installation (for development with vite-plugin-monkey)
# Only if choosing the modern workflow (NOT recommended for this project)
- Create `coolcollege-unlock.user.js` file
- Install to Tampermonkey via drag-drop or file:// URL
- No npm/node needed
## Sources
- [Tampermonkey Official Documentation - @match](https://www.tampermonkey.net/documentation.php?q=include) -- HIGH confidence, verified via Context7
- [Tampermonkey Official Documentation - @grant](https://www.tampermonkey.net/documentation.php?q=meta%3Agrant) -- HIGH confidence, verified via Context7
- [Tampermonkey Official Documentation - window.onurlchange](https://www.tampermonkey.net/documentation.php?q=api%3Awindow.onurlchange) -- HIGH confidence, verified via Context7
- [vite-plugin-monkey GitHub](https://github.com/lisonge/vite-plugin-monkey) -- MEDIUM confidence, verified via Context7
- MutationObserver patterns for SPA userscripts -- MEDIUM confidence, community standard
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
