// ==UserScript==
// @name         CoolCollege 作答详情解锁
// @namespace    https://github.com/coolcollege-unlock
// @version      0.1.1
// @description  解锁酷学院考试数据页面的作答详情按钮，支持查看历史考试作答详情
// @author       zhaolulu
// @match        *://pro.coolcollege.cn/*
// @grant        window.onurlchange
// @grant        GM_openInTab
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const SCRIPT_NAME = 'CoolCollege 作答详情解锁';
  const TARGET_PATH = '/training/examination/exam-data';

  function isTargetPage() {
    return window.location.href.includes(TARGET_PATH);
  }

  function init() {
    if (!isTargetPage()) {
      return;
    }
    console.log(`[${SCRIPT_NAME}] 目标页面已激活，开始初始化`);
    // Phase 2-4 的实际处理逻辑将在此处添加
  }

  // ===== Phase 2: DOM 变化监听辅助函数 =====

  /**
   * 尾部去抖函数
   * @param {Function} fn - 要去抖的函数
   * @param {number} delay - 延迟毫秒数
   */
  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /**
   * 当前 MutationObserver 实例引用，用于生命周期管理
   */
  let currentObserver = null;

  /**
   * 从 MutationRecord 中提取新增的表格行
   * @param {MutationRecord[]} mutations
   * @returns {HTMLElement[]} 表格行数组
   */
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

  /**
   * 处理单行表格（Phase 2 存根，Phase 4 填充实际按钮处理逻辑）
   * @param {HTMLElement} row - 表格行元素
   */
  function processRow(row) {
    console.log(`[${SCRIPT_NAME}] 处理行: ${row.getAttribute('data-row-key') || 'unknown'}`);
  }

  /**
   * 处理新增的表格行（使用 data-processed 过滤重复处理）
   * @param {MutationRecord[]} mutations
   */
  function processRows(mutations) {
    const newRows = extractNewRows(mutations);
    const unprocessed = newRows.filter(row => !row.hasAttribute('data-processed'));
    if (unprocessed.length === 0) return;
    for (const row of unprocessed) {
      row.setAttribute('data-processed', 'true');
    }
    console.log(`[${SCRIPT_NAME}] 处理了 ${unprocessed.length} 行`);
  }

  /**
   * 去抖后的 processRows（300ms 尾部去抖）
   */
  const debouncedProcessRows = debounce(processRows, 300);

  // ===== Phase 2 辅助函数结束 =====

  // 页面初次加载时执行
  init();

  // SPA 路由切换检测
  if (typeof window.onurlchange === 'object' && window.onurlchange === null) {
    window.addEventListener('urlchange', (event) => {
      console.log(`[${SCRIPT_NAME}] 检测到路由变化: ${event.url}`);
      init();
    });
  }
})();
