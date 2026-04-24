// ==UserScript==
// @name         CoolCollege 作答详情解锁（仅解锁）
// @namespace    https://github.com/coolcollege-unlock
// @version      1.0.0
// @description  解锁酷学院考试数据页面的灰色「作答详情」按钮
// @author       zhaolulu
// @match        *://pro.coolcollege.cn/*
// @grant        window.onurlchange
// @grant        GM_openInTab
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const SCRIPT_NAME = '作答详情解锁';
  const TARGET_PATH = '/training/examination/exam-data';

  if (!window.location.href.includes(TARGET_PATH)) {
    if (typeof window.onurlchange === 'object' && window.onurlchange === null) {
      window.addEventListener('urlchange', () => {
        if (window.location.href.includes(TARGET_PATH)) location.reload();
      });
    }
    return;
  }

  let currentObserver = null;

  const FIBER_KEY_PREFIXES = [
    '__reactInternalInstance$',
    '__reactFiber$',
    '_reactInternals'
  ];

  function getRecordFromRow(row) {
    const keys = Object.keys(row);
    let fiberKey = null;
    for (const prefix of FIBER_KEY_PREFIXES) {
      fiberKey = keys.find(k => k.startsWith(prefix));
      if (fiberKey) break;
    }
    if (!fiberKey) return null;
    const fiber = row[fiberKey];
    return fiber?.return?.memoizedProps?.record || null;
  }

  function getEid() {
    return localStorage.getItem('enterpriseId');
  }

  function getExamId() {
    const hash = window.location.hash;
    if (!hash) return null;
    const queryPart = hash.split('?')[1];
    if (!queryPart) return null;
    return new URLSearchParams(queryPart).get('exam_id');
  }

  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

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

  function processRow(row) {
    const record = getRecordFromRow(row);
    if (!record || !record.submit_id) return;

    if (record.show_record !== "false") return;

    const fixRightCell = row.querySelector('.ant-table-cell-fix-right');
    if (!fixRightCell) return;

    const spans = fixRightCell.querySelectorAll('span');
    let detailSpan = null;
    for (const span of spans) {
      if (span.textContent.trim() === '作答详情') {
        detailSpan = span;
        break;
      }
    }
    if (!detailSpan) return;

    const eid = getEid();
    const examId = getExamId();

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

    console.log(`[${SCRIPT_NAME}] 已解锁: submit_id=${record.submit_id}`);
  }

  const MARK = 'data-unlock-processed';
  const debouncedProcess = debounce(function (mutations) {
    const rows = extractNewRows(mutations).filter(r => !r.hasAttribute(MARK));
    if (!rows.length) return;
    rows.forEach(r => { r.setAttribute(MARK, '1'); processRow(r); });
  }, 300);

  function init() {
    if (currentObserver) { currentObserver.disconnect(); currentObserver = null; }
    console.log(`[${SCRIPT_NAME}] 初始化`);

    const target = document.querySelector('.ant-table-tbody') || document.querySelector('.ant-table') || document.body;
    currentObserver = new MutationObserver(debouncedProcess);
    currentObserver.observe(target, { childList: true, subtree: true });

    target.querySelectorAll(`.ant-table-row:not([${MARK}])`).forEach(r => { processRow(r); r.setAttribute(MARK, '1'); });

    if (target === document.body) {
      setTimeout(() => {
        const precise = document.querySelector('.ant-table-tbody') || document.querySelector('.ant-table');
        if (precise && currentObserver) {
          currentObserver.disconnect();
          currentObserver.observe(precise, { childList: true, subtree: true });
          precise.querySelectorAll(`.ant-table-row:not([${MARK}])`).forEach(r => { processRow(r); r.setAttribute(MARK, '1'); });
        }
      }, 1000);
    }
  }

  init();
  if (typeof window.onurlchange === 'object' && window.onurlchange === null) {
    window.addEventListener('urlchange', () => init());
  }
})();
