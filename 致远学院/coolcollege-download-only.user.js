// ==UserScript==
// @name         CoolCollege 下载试题
// @namespace    https://github.com/coolcollege-unlock
// @version      1.0.0
// @description  在酷学院考试数据页面添加「下载试题」按钮，一键下载完整试题 JSON
// @author       zhaolulu
// @match        *://pro.coolcollege.cn/*
// @grant        window.onurlchange
// @grant        GM_xmlhttpRequest
// @connect      coolapi.coolcollege.cn
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const SCRIPT_NAME = '下载试题';
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

  function getEid() { return localStorage.getItem('enterpriseId'); }
  function getUid() { return localStorage.getItem('uid'); }
  function getToken() { return localStorage.getItem('token'); }
  function getExamId() {
    const hash = window.location.hash;
    if (!hash) return null;
    const q = hash.split('?')[1];
    if (!q) return null;
    return new URLSearchParams(q).get('exam_id');
  }

  function getExamTitle() {
    const el = document.querySelector('.exam-title');
    return el?.textContent?.trim() || 'Exam';
  }

  function buildFileName(record) {
    const userName = localStorage.getItem('name') || '';
    const title = getExamTitle();
    const score = `${record.score}分`;
    const sec = parseInt(record.answer_duration, 10) || 0;
    const dur = `${Math.floor(sec / 60)}分${sec % 60}秒`;
    const t = new Date(parseInt(record.submit_time, 10));
    const ts = `${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, '0')}${String(t.getDate()).padStart(2, '0')}_${String(t.getHours()).padStart(2, '0')}${String(t.getMinutes()).padStart(2, '0')}`;
    return [userName, title, score, dur, ts].filter(Boolean).join('_') + '.json';
  }

  function debounce(fn, delay) {
    let timer = null;
    return function (...args) { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), delay); };
  }

  function extractNewRows(mutations) {
    const rows = [];
    for (const { addedNodes } of mutations) {
      for (const node of addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.tagName === 'TR') rows.push(node);
        else node.querySelectorAll?.('.ant-table-row').forEach(r => rows.push(r));
      }
    }
    return rows;
  }

  function processRow(row) {
    const record = getRecordFromRow(row);
    if (!record || !record.submit_id) return;

    const fixRightCell = row.querySelector('.ant-table-cell-fix-right');
    if (!fixRightCell) return;
    const container = fixRightCell.querySelector('div') || fixRightCell;

    const span = document.createElement('span');
    span.textContent = '下载试题';
    span.style.cssText = 'display:block;color:rgb(0, 122, 255);cursor:pointer;margin-top:4px;';
    span.addEventListener('click', function (e) {
      e.stopPropagation();
      downloadExamPaper(record, getEid(), getExamId());
    });
    container.appendChild(span);
  }

  function downloadExamPaper(record, eid, examId) {
    const uid = getUid();
    const token = getToken();
    if (!uid || !token || !eid) { console.warn(`[${SCRIPT_NAME}] 缺少必要参数`); return; }

    const apiUrl = `https://coolapi.coolcollege.cn/new-exam-api/v2/enterprises/${eid}/users/${uid}/exams/${examId}/submit-info/${record.submit_id}?task_id=${record.task_id}`;
    const fileName = buildFileName(record);

    console.log(`[${SCRIPT_NAME}] 正在下载: ${fileName}`);

    GM_xmlhttpRequest({
      method: 'GET',
      url: apiUrl,
      headers: {
        'accept': 'application/json, text/plain, */*',
        'content-type': 'application/json',
        'enterprise-id': eid,
        'app-id': '3829',
        'x-access-token': token
      },
      onload: function (response) {
        if (response.status !== 200) { console.warn(`[${SCRIPT_NAME}] 请求失败: ${response.status}`); return; }
        try {
          const json = JSON.parse(response.responseText);
          const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
          console.log(`[${SCRIPT_NAME}] 下载成功: ${fileName}`);
        } catch (err) {
          console.warn(`[${SCRIPT_NAME}] 解析失败: ${err.message}`);
        }
      },
      onerror: function () { console.warn(`[${SCRIPT_NAME}] 网络失败`); }
    });
  }

  const MARK = 'data-download-processed';
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
