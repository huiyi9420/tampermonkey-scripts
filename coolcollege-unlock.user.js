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

  /**
   * 当前 MutationObserver 实例引用，用于生命周期管理
   */
  let currentObserver = null;

  /**
   * 暂存每行提取的 record 数据，供 Phase 4 按钮处理使用
   * key: 行 DOM 元素, value: { record, eid, examId }
   */
  const rowDataMap = new Map();

  function isTargetPage() {
    return window.location.href.includes(TARGET_PATH);
  }

  // ===== Phase 2: DOM 变化监听辅助函数 =====

  // ===== Phase 3: React Fiber 数据提取 =====

  /**
   * Fiber key 前缀列表，按优先级排序 (D-01, D-02)
   * React 17: __reactInternalInstance$ (已验证酷学院使用)
   * React 18: __reactFiber$
   * 旧版本: _reactInternals
   */
  const FIBER_KEY_PREFIXES = [
    '__reactInternalInstance$',
    '__reactFiber$',
    '_reactInternals'
  ];

  /**
   * 从表格行元素中通过 React Fiber 提取 record 数据对象 (D-03)
   * @param {HTMLElement} row - 表格行元素 (.ant-table-row)
   * @returns {Object|null} record 对象，失败返回 null
   */
  function getRecordFromRow(row) {
    // 遍历行元素的所有属性，查找 Fiber key
    const keys = Object.keys(row);
    let fiberKey = null;
    for (const prefix of FIBER_KEY_PREFIXES) {
      fiberKey = keys.find(k => k.startsWith(prefix));
      if (fiberKey) break;
    }

    if (!fiberKey) {
      console.warn(`[${SCRIPT_NAME}] 未找到 Fiber 属性，跳过行`);
      return null;
    }

    const fiber = row[fiberKey];

    // 已验证路径: fiber.return.memoizedProps.record (depth=1)
    const record = fiber?.return?.memoizedProps?.record;

    if (!record) {
      console.warn(`[${SCRIPT_NAME}] Fiber 路径中未找到 record 对象`);
      return null;
    }

    return record;
  }

  /**
   * 从 localStorage 获取 enterprise_id (D-05)
   * @returns {string|null} eid 字符串，失败返回 null
   */
  function getEid() {
    return localStorage.getItem('enterpriseId');
  }

  /**
   * 从当前页面 URL hash 参数中解析 exam_id (D-06)
   * URL 格式: #/training/examination/exam-data?exam_id=xxx&from=myTask&task_id=xxx
   * @returns {string|null} exam_id 字符串，失败返回 null
   */
  function getExamId() {
    const hash = window.location.hash;
    if (!hash) return null;
    const queryPart = hash.split('?')[1];
    if (!queryPart) return null;
    const params = new URLSearchParams(queryPart);
    return params.get('exam_id');
  }

  // ===== Phase 3: Fiber 数据提取结束 =====

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
          // 酷学院数据行使用 .ant-table-row 类名，无 data-row-key 属性
          node.querySelectorAll?.('.ant-table-row').forEach(r => rows.push(r));
        }
      }
    }
    return rows;
  }

  /**
   * 处理单行表格：提取 Fiber 数据并暂存 (D-07)
   * Phase 3: Fiber 数据提取与暂存，Phase 4 在此基础上添加按钮处理
   * @param {HTMLElement} row - 表格行元素
   */
  function processRow(row) {
    const record = getRecordFromRow(row);
    if (!record) return;

    // 检查关键字段 submit_id (DATA-03)
    if (!record.submit_id) {
      console.warn(`[${SCRIPT_NAME}] record 缺少 submit_id，跳过行`);
      return;
    }

    const eid = getEid();
    const examId = getExamId();

    // 暂存到 Map (D-07)
    rowDataMap.set(row, { record, eid, examId });

    // Phase 4: 解锁按钮 (BTN-01~05)
    unlockDetailButton(row, { record, eid, examId });

    console.log(
      `[${SCRIPT_NAME}] 提取成功: submit_id=${record.submit_id}, ` +
      `show_record=${record.show_record}, eid=${eid}, examId=${examId}`
    );
  }

  // ===== Phase 4: 按钮解锁 =====

  /**
   * 解锁「作答详情」按钮：修改样式 + 绑定点击跳转 (BTN-01~05, D-03~06)
   * @param {HTMLElement} row - 表格行元素
   * @param {{ record: Object, eid: string|null, examId: string|null }} data - 暂存数据
   */
  function unlockDetailButton(row, data) {
    const { record, eid, examId } = data;

    // BTN-01: 仅处理 show_record === "false" 的行 (D-03)
    if (record.show_record !== "false") return;

    // D-01, D-02: 定位「作答详情」span — 通过文本内容而非类名
    const fixRightCell = row.querySelector('.ant-table-cell-fix-right');
    if (!fixRightCell) {
      console.warn(`[${SCRIPT_NAME}] 未找到 .ant-table-cell-fix-right 单元格，可能页面结构已变化`);
      return;
    }

    // 查找包含"作答详情"文本的 span
    const spans = fixRightCell.querySelectorAll('span');
    let detailSpan = null;
    for (const span of spans) {
      if (span.textContent.trim() === '作答详情') {
        detailSpan = span;
        break;
      }
    }

    if (!detailSpan) {
      console.warn(`[${SCRIPT_NAME}] 未找到「作答详情」span，可能页面结构已变化`);
      return;
    }

    // BTN-02: 修改样式为蓝色可点击 (D-03, D-04)
    detailSpan.style.color = 'rgb(0, 122, 255)';
    detailSpan.style.cursor = 'pointer';

    // BTN-03, BTN-04: 绑定点击事件，GM_openInTab 打开新标签页 (D-05)
    detailSpan.addEventListener('click', function (e) {
      e.stopPropagation();

      // BTN-05: 构造跳转 URL (D-06)
      const params = new URLSearchParams();
      if (examId) params.set('exam_id', examId);
      if (record.submit_id) params.set('submit_id', record.submit_id);
      if (record.task_id) params.set('task_id', record.task_id);
      if (eid) params.set('eid', eid);

      const url = `https://pro.coolcollege.cn/training/examination/exam-detail?${params.toString()}`;

      console.log(`[${SCRIPT_NAME}] 打开作答详情: ${url}`);
      GM_openInTab(url, { active: true });
    });

    console.log(
      `[${SCRIPT_NAME}] 已解锁按钮: submit_id=${record.submit_id}`
    );
  }

  // ===== Phase 4: 按钮解锁结束 =====

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
      processRow(row);
    }
    console.log(`[${SCRIPT_NAME}] 处理了 ${unprocessed.length} 行`);
  }

  /**
   * 去抖后的 processRows（300ms 尾部去抖）
   */
  const debouncedProcessRows = debounce(processRows, 300);

  // ===== Phase 2 辅助函数结束 =====

  function init() {
    // D-05: 清理旧 Observer
    if (currentObserver) {
      currentObserver.disconnect();
      currentObserver = null;
    }
    if (!isTargetPage()) {
      return;
    }
    console.log(`[${SCRIPT_NAME}] 目标页面已激活，开始初始化`);

    // D-01: 精确 + 回退策略查找观察目标
    const target =
      document.querySelector('.ant-table-tbody') ||
      document.querySelector('.ant-table') ||
      document.body;

    // D-02: 创建 MutationObserver
    const observer = new MutationObserver((mutations) => {
      debouncedProcessRows(mutations);
    });
    currentObserver = observer;

    // 开始观察
    observer.observe(target, { childList: true, subtree: true });
    console.log(`[${SCRIPT_NAME}] Observer 启动，观察 ${target.className || 'body'}`);

    // Pitfall 1 缓解：主动处理已存在的行（避免表格在 init() 之前已加载）
    const existingRows = target.querySelectorAll('.ant-table-row:not([data-processed])');
    for (const row of existingRows) {
      processRow(row);
      row.setAttribute('data-processed', 'true');
    }
    if (existingRows.length > 0) {
      console.log(`[${SCRIPT_NAME}] 主动处理了 ${existingRows.length} 行`);
    }

    // 时机修复：如果回退到了 body，延迟重试定位精确目标
    if (target === document.body) {
      setTimeout(() => {
        const preciseTarget =
          document.querySelector('.ant-table-tbody') ||
          document.querySelector('.ant-table');
        if (preciseTarget && currentObserver) {
          currentObserver.disconnect();
          currentObserver.observe(preciseTarget, { childList: true, subtree: true });
          console.log(`[${SCRIPT_NAME}] Observer 升级，观察 ${preciseTarget.className}`);

          // 重新处理精确目标下已存在的行
          const lateRows = preciseTarget.querySelectorAll('.ant-table-row:not([data-processed])');
          for (const row of lateRows) {
            processRow(row);
            row.setAttribute('data-processed', 'true');
          }
          if (lateRows.length > 0) {
            console.log(`[${SCRIPT_NAME}] 延迟处理了 ${lateRows.length} 行`);
          }
        }
      }, 1000);
    }
  }

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
