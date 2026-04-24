# Feature Landscape

**Domain:** Tampermonkey userscript for enabling disabled UI elements in React SPA
**Researched:** 2026-04-24

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Detect disabled "作答详情" buttons** | Core functionality requirement | Low | Target by class `.exam-record-operate___2q2xH` within Ant Design table rows |
| **Remove visual disabled styling** | Buttons must look clickable (blue instead of gray) | Low | Override CSS: `color` from #ccc to primary blue, `cursor` from `not-allowed` to `pointer` |
| **Extract submit_id from table row** | Need submit_id to construct correct URL | Medium | Traverse React Fiber from `tr` element to access `record` data |
| **Construct correct navigation URL** | Jump to right answer details page | Low | Use URL pattern with `exam_id`, `task_id`, `submit_id` from current context + record |
| **Add click handler to open details** | Button must actually do something when clicked | Low | Add click event listener that opens URL in new tab |
| **Handle dynamic table loading** | Data loads after page render in SPA | Medium | MutationObserver to detect when table rows are added/updated |
| **Handle SPA route changes** | User navigates via React Router without full page reload | Medium | Watch for URL hash changes and `popstate` events |
| **Avoid duplicate processing** | Same button shouldn't be processed multiple times | Low | Mark processed buttons with a data attribute |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Debounced MutationObserver** | Better performance on DOM-heavy pages, avoids excessive processing | Medium | 100-200ms debounce balances responsiveness and performance |
| **Multiple React Fiber detection strategies** | More robust against React version changes and minification | Medium | Check for all known key variations: `__reactInternalInstance$`, `__reactFiber$`, `_reactInternals` |
| **Recursive Fiber traversal** | Handles different React component tree depths | Medium | Walk up/down Fiber tree to find the node containing `record` data |
| **Auto-retry for delayed data** | Some tables load data asynchronously after DOM is ready | Low | Retry traversal a few times with short delay if record not found on first try |
| **Open in new tab instead of same-tab navigation** | Preserves original filtering/scroll position on exam list | Low | Uses `window.open()` with `noopener` for security |
| **Visual feedback when enabled** | User sees which buttons were enabled by script | Low | Subtle background highlight or icon change indicates processed buttons |
| **Idle callback processing** | Defer processing to idle periods to avoid blocking main thread | Low | Uses `requestIdleCallback` when available for better UX |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Modify backend data / bypass authentication** | Out of scope, illegal/unethical access | Only work with data already loaded in the browser by the authenticated user |
| **Change scores or exam results** | Out of scope per requirements | Only unlock viewing, don't alter any data |
| **Support multiple platforms outside CoolCollege** | Project scope is specific to pro.coolcollege.cn | Keep selectors and URL logic targeted |
| **Inject third-party libraries** | Userscripts should be self-contained and lightweight | Use only native browser APIs |
| **Polling with fixed intervals** | Inefficient compared to MutationObserver | Use MutationObserver with debouncing |
| **Deep React state mutation** | Can cause unexpected side effects in React app | Read-only access to get record data, don't mutate React state |
| **Persistent modifications to localStorage/sessionStorage** | Unnecessary and can break app state | All changes are DOM-local, revert on page unload |

## Feature Dependencies

```
React Fiber traversal → Extract submit_id from record → Construct URL → Add click handler
                   ↓
        Remove disabled CSS styling

MutationObserver → Detect new rows → Detect disabled buttons → Process button
            ↓
    Debounce prevents excessive calls

SPA route detection → Trigger re-scan → Process new page content

Data attribute marking → Prevent duplicate processing
```

**Dependency chain explanation:**
1. Core DOM processing depends on ability to extract data via React Fiber
2. All dynamic content depends on MutationObserver
3. URL construction depends on successful data extraction
4. Debounce is a wrapper around MutationObserver processing

## Key Technical Patterns

### How to detect and modify disabled UI elements

**Pattern 1: CSS class/style-based detection**
- Look for elements with disabled styling (gray text, `cursor: not-allowed`, `opacity < 1`)
- Remove or override disabled CSS classes
- Override inline styles if needed

**Pattern 2: Attribute-based detection**
- Check for `disabled` attribute on buttons/inputs
- Remove the attribute with `removeAttribute('disabled')`

**Pattern 3: Mark processed elements**
- Add `data-userscript-processed="true"` to avoid re-processing
- Check this attribute before processing any element

**Code pattern example:**
```javascript
function isButtonProcessed(button) {
  return button.hasAttribute('data-userscript-processed');
}

function markProcessed(button) {
  button.setAttribute('data-userscript-processed', 'true');
}

function enableButton(button) {
  // Override styles
  button.style.color = '#1890ff'; // Ant Design primary blue
  button.style.cursor = 'pointer';
  button.style.opacity = '1';
  // Remove disabled attribute if present
  button.removeAttribute('disabled');
  markProcessed(button);
}
```

### React/Vue DOM manipulation techniques

**React Fiber traversal pattern:**
Every DOM element mounted by React has a React Fiber internal property that can be used to access the component's props and state.

```javascript
function getReactFiberKey(node) {
  // Try all possible key variations from different React versions/minification
  const keys = [
    '__reactInternalInstance$',
    '__reactFiber$',
    '_reactInternals',
    '__reactInternalInstance'
  ];
  for (const key of keys) {
    if (key in node) return key;
  }
  return null;
}

function findRecordInFiber(startNode) {
  const fiberKey = getReactFiberKey(startNode);
  if (!fiberKey) return null;
  
  let fiber = startNode[fiberKey];
  // Traverse upward until we find a fiber with the record data
  for (let i = 0; i < 50 && fiber; i++) {
    // Check for record in memoizedProps, pendingProps, or stateNode
    const props = fiber.memoizedProps;
    if (props && props.record) {
      return props.record;
    }
    // Sometimes record is in children
    if (Array.isArray(props && props.children)) {
      for (const child of props.children) {
        if (child && child.props && child.props.record) {
          return child.props.record;
        }
      }
    }
    fiber = fiber.return;
  }
  return null;
}
```

**Key considerations:**
- Different React versions use different property names
- React 18+ may use `__reactFiber$` prefix with random suffix
- Need to search for the key pattern using regex or trial-and-error
- **Don't mutate Fiber objects** — only read data you need

**Vue alternatives:**
For Vue apps, the pattern is similar but uses different properties:
- `__vnode` or `__vueParentComponent` for Vue 3
- `__v_cache` or `_vnode` for older Vue versions

### SPA routing detection

Common patterns in hash-based SPAs (like CoolCollege with `#/...`):

**Method 1: Hash change detection**
```javascript
window.addEventListener('hashchange', () => {
  // Rescan page after route change
  setTimeout(() => scanForDisabledButtons(), 100);
});
```

**Method 2: Popstate detection**
```javascript
window.addEventListener('popstate', () => {
  scanForDisabledButtons();
});
```

**Method 3: MutationObserver on document body**
Catches any DOM changes from navigation:
```javascript
const observer = new MutationObserver((mutations) => {
  // Check if any mutations added table-related nodes
  const hasNewRows = mutations.some(mut => 
    Array.from(mut.addedNodes).some(n => 
      n.nodeType === 1 && (
        n.tagName === 'TR' || 
        n.querySelector('.exam-record-operate___2q2xH')
      )
    )
  );
  if (hasNewRows) {
    debouncedScan();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
```

**Best practice:** Combine all three methods for maximum reliability.

### Performance considerations

**1. Debounce MutationObserver processing**
- MutationObserver fires many events during DOM updates
- Debounce with 100-200ms delay to avoid excessive processing
- Leading/trailing debounce: trailing works best here

**2. Limit search scope**
- Don't scan the entire document every time
- If target is in an Ant Design table with known class, only search within that table
- Early exit when enough buttons have been processed

**3. Avoid unnecessary DOM queries**
- Cache selectors when possible
- Use `querySelectorAll` once, not multiple times in loops

**4. Use requestIdleCallback**
```javascript
function scanWhenIdle() {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => scanForDisabledButtons(), { timeout: 1000 });
  } else {
    setTimeout(() => scanForDisabledButtons(), 100);
  }
}
```

**5. Disconnect observer when not needed**
- If script runs on specific URL, disconnect when navigating away
- However, for SPA, you usually want it always connected

**6. Throttle fiber traversal**
- Traversing React Fiber is cheap but not free
- Limit traversal depth (50 steps max)
- Stop searching once you find what you need

## MVP Recommendation

Prioritize:
1. **Detect disabled buttons** - Target the specific selector used by CoolCollege
2. **Remove disabled styling** - Make them look clickable
3. **Extract submit_id via React Fiber** - Core challenge for this project
4. **Add click handler to open details** - Make the button actually work
5. **Basic MutationObserver for dynamic content** - Handle table loading

Defer:
- **Visual feedback marking** - Nice to have, but not required for MVP
- **Multiple Fiber key fallbacks** - Start with known keys that work on target site, add fallbacks if needed
- **Idle callback processing** - Only needed if performance issues observed

## Sources

- General knowledge of React DOM internals and userscript patterns (LOW confidence, requires validation on target site)
- Common MutationObserver patterns for SPA userscripts
- Known techniques for accessing React component data from DOM nodes in userscripts
