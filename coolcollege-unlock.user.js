// ==UserScript==
// @name         CoolCollege 作答详情解锁
// @namespace    https://github.com/coolcollege-unlock
// @version      0.1.0
// @description  解锁酷学院考试数据页面的作答详情按钮，支持查看历史考试作答详情
// @author       zhaolulu
// @match        *://pro.coolcollege.cn/*training/examination/exam-data*
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

  // 页面初次加载时执行
  init();

  // SPA 路由切换检测（per D-03: 纯 window.onurlchange，无降级方案）
  if (typeof window.onurlchange === 'object' && window.onurlchange === null) {
    window.addEventListener('urlchange', (event) => {
      console.log(`[${SCRIPT_NAME}] 检测到路由变化: ${event.url}`);
      init();
    });
  }
})();
