// ==UserScript==
// @name         CoolCollege 作答详情解锁
// @namespace    https://github.com/coolcollege-unlock
// @version      0.2.0
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

  // 非目标页面：仅注册路由监听，不做任何初始化
  if (!window.location.href.includes(TARGET_PATH)) {
    if (typeof window.onurlchange === 'object' && window.onurlchange === null) {
      window.addEventListener('urlchange', () => {
        if (window.location.href.includes(TARGET_PATH)) location.reload();
      });
    }
    return;
  }

  /**
   * 当前 MutationObserver 实例引用
   */
  let currentObserver = null;

  /**
   * 暂存每行提取的 record 数据
   */
  const rowDataMap = new Map();

  // ===== Phase 3: React Fiber 数据提取 =====

  /**
   * Fiber key 前缀列表，按优先级排序
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
   * 从表格行元素中通过 React Fiber 提取 record 数据对象
   * @param {HTMLElement} row - 表格行元素 (.ant-table-row)
   * @returns {Object|null} record 对象，失败返回 null
   */
  function getRecordFromRow(row) {
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
    const record = fiber?.return?.memoizedProps?.record;

    if (!record) {
      console.warn(`[${SCRIPT_NAME}] Fiber 路径中未找到 record 对象`);
      return null;
    }

    return record;
  }

  /**
   * 从 localStorage 获取 enterprise_id
   * @returns {string|null} eid 字符串，失败返回 null
   */
  function getEid() {
    return localStorage.getItem('enterpriseId');
  }

  /**
   * 从当前页面 URL hash 参数中解析 exam_id
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
   */
  function extractNewRows(mutations) {
    const rows = [];
    for (const { addedNodes } of mutations) {
      for (const node of addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.tagName === 'TR') {
          rows.push(node);
        } else {
          node.querySelectorAll?.('.ant-table-row').forEach(r => rows.push(r));
        }
      }
    }
    return rows;
  }

  /**
   * 处理单行表格：提取 Fiber 数据并暂存
   */
  function processRow(row) {
    const record = getRecordFromRow(row);
    if (!record) return;

    if (!record.submit_id) {
      console.warn(`[${SCRIPT_NAME}] record 缺少 submit_id，跳过行`);
      return;
    }

    const eid = getEid();
    const examId = getExamId();

    rowDataMap.set(row, { record, eid, examId });
    unlockDetailButton(row, { record, eid, examId });

    console.log(
      `[${SCRIPT_NAME}] 提取成功: submit_id=${record.submit_id}, ` +
      `show_record=${record.show_record}, eid=${eid}, examId=${examId}`
    );
  }

  // ===== Phase 4: 按钮解锁 =====

  /**
   * 解锁「作答详情」按钮：修改样式 + 绑定点击跳转
   */
  function unlockDetailButton(row, data) {
    const { record, eid, examId } = data;

    if (record.show_record !== "false") return;

    const fixRightCell = row.querySelector('.ant-table-cell-fix-right');
    if (!fixRightCell) {
      console.warn(`[${SCRIPT_NAME}] 未找到 .ant-table-cell-fix-right 单元格，可能页面结构已变化`);
      return;
    }

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

    detailSpan.style.color = 'rgb(0, 122, 255)';
    detailSpan.style.cursor = 'pointer';

    detailSpan.addEventListener('click', function (e) {
      e.stopPropagation();

      const eidParam = eid ? `eid=${eid}` : '';
      const hashParams = new URLSearchParams();
      if (examId) hashParams.set('exam_id', examId);
      if (record.submit_id) hashParams.set('submit_id', record.submit_id);
      if (record.task_id) hashParams.set('task_id', record.task_id);
      hashParams.set('user_id', '');

      const url = `https://pro.coolcollege.cn/sub-sys/kuxueyuan-manage/prod/split?${eidParam}#/training/examination/new-exam/parse?${hashParams.toString()}`;

      console.log(`[${SCRIPT_NAME}] 打开作答详情: ${url}`);
      GM_openInTab(url, { active: true });
    });

    console.log(`[${SCRIPT_NAME}] 已解锁按钮: submit_id=${record.submit_id}`);
  }

  // ===== Phase 4: 按钮解锁结束 =====

  /**
   * 处理新增的表格行（使用 data-processed 过滤重复处理）
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

  const debouncedProcessRows = debounce(processRows, 300);

  function init() {
    if (currentObserver) {
      currentObserver.disconnect();
      currentObserver = null;
    }

    console.log(`[${SCRIPT_NAME}] 目标页面已激活，开始初始化`);

    const target =
      document.querySelector('.ant-table-tbody') ||
      document.querySelector('.ant-table') ||
      document.body;

    const observer = new MutationObserver((mutations) => {
      debouncedProcessRows(mutations);
    });
    currentObserver = observer;

    observer.observe(target, { childList: true, subtree: true });
    console.log(`[${SCRIPT_NAME}] Observer 启动，观察 ${target.className || 'body'}`);

    const existingRows = target.querySelectorAll('.ant-table-row:not([data-processed])');
    for (const row of existingRows) {
      processRow(row);
      row.setAttribute('data-processed', 'true');
    }
    if (existingRows.length > 0) {
      console.log(`[${SCRIPT_NAME}] 主动处理了 ${existingRows.length} 行`);
    }

    if (target === document.body) {
      setTimeout(() => {
        const preciseTarget =
          document.querySelector('.ant-table-tbody') ||
          document.querySelector('.ant-table');
        if (preciseTarget && currentObserver) {
          currentObserver.disconnect();
          currentObserver.observe(preciseTarget, { childList: true, subtree: true });
          console.log(`[${SCRIPT_NAME}] Observer 升级，观察 ${preciseTarget.className}`);

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

  init();
})();
