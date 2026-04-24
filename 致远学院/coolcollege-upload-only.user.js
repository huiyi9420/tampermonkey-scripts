// ==UserScript==
// @name         CoolCollege 上传题库
// @namespace    https://github.com/coolcollege-unlock
// @version      1.0.0
// @description  在酷学院考试数据页面添加「上传题库」按钮，一键获取试题并上传到题库系统
// @author       zhaolulu
// @match        *://pro.coolcollege.cn/*
// @match        *://question.a2008q.top/*
// @grant        window.onurlchange
// @grant        GM_openInTab
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      coolapi.coolcollege.cn
// @connect      question.a2008q.top
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const SCRIPT_NAME = '上传题库';
  const TARGET_PATH = '/training/examination/exam-data';
  const QUESTION_BANK_HOST = 'question.a2008q.top';
  const QUESTION_BANK_URL = 'https://question.a2008q.top';

  // 题库网站：同步 token 到 Tampermonkey 跨域存储
  if (window.location.hostname === QUESTION_BANK_HOST) {
    const token = localStorage.getItem('accessToken');
    if (token) {
      GM_setValue('qb_token', token);
      console.log(`[${SCRIPT_NAME}] 题库 token 已同步`);
    }
    return;
  }

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

  function findNumberValue(obj) {
    if (typeof obj === 'number') return obj;
    if (typeof obj !== 'object' || obj === null) return null;
    for (const val of Object.values(obj)) {
      const found = findNumberValue(val);
      if (found !== null) return found;
    }
    return null;
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
    span.textContent = '上传题库';
    span.style.cssText = 'display:block;color:rgb(0, 122, 255);cursor:pointer;margin-top:4px;';
    span.addEventListener('click', function (e) {
      e.stopPropagation();
      handleUpload(record, getEid(), getExamId(), span);
    });
    container.appendChild(span);
  }

  function handleUpload(record, eid, examId, btn) {
    const uid = getUid();
    const token = getToken();
    if (!uid || !token || !eid) { console.warn(`[${SCRIPT_NAME}] 缺少必要参数`); return; }

    const authToken = GM_getValue('qb_token', null);
    if (!authToken) {
      console.warn(`[${SCRIPT_NAME}] 题库系统未登录`);
      GM_openInTab(`${QUESTION_BANK_URL}/list`, { active: true });
      btn.textContent = '未登录，登录后重试';
      btn.style.color = '#faad14';
      return;
    }

    const apiUrl = `https://coolapi.coolcollege.cn/new-exam-api/v2/enterprises/${eid}/users/${uid}/exams/${examId}/submit-info/${record.submit_id}?task_id=${record.task_id}`;
    btn.textContent = '获取中...';
    btn.style.color = '#999';

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
        if (response.status !== 200) {
          console.warn(`[${SCRIPT_NAME}] 获取失败: ${response.status}`);
          resetBtn(btn);
          return;
        }
        uploadToBank(response.responseText, record, btn, authToken);
      },
      onerror: function () { console.warn(`[${SCRIPT_NAME}] 获取网络失败`); resetBtn(btn); }
    });
  }

  function uploadToBank(jsonString, record, btn, authToken) {
    const fileName = buildFileName(record);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const file = new File([blob], fileName, { type: 'application/json' });
    const formData = new FormData();
    formData.append('file', file);

    btn.textContent = '上传中...';

    GM_xmlhttpRequest({
      method: 'POST',
      url: `${QUESTION_BANK_URL}/api/question/upload`,
      headers: { 'authorization': authToken },
      data: formData,
      onload: function (response) {
        if (response.status === 200) {
          try {
            const result = JSON.parse(response.responseText);
            // 响应格式: {"code":0,"data":{"message":"已添加50条"}}
            const match = (result?.data?.message || '').match(/\d+/);
            const count = match ? match[0] : '';
            const msg = count ? `成功${count}题` : '已上传';
            console.log(`[${SCRIPT_NAME}] 上传成功: ${msg}`);
            btn.textContent = msg;
            btn.style.color = '#52c41a';
          } catch {
            btn.textContent = '已上传';
            btn.style.color = '#52c41a';
          }
        } else if (response.status === 401 || response.status === 403) {
          console.warn(`[${SCRIPT_NAME}] 认证过期`);
          GM_setValue('qb_token', null);
          GM_openInTab(`${QUESTION_BANK_URL}/list`, { active: true });
          btn.textContent = '登录过期，登录后重试';
          btn.style.color = '#faad14';
        } else {
          console.warn(`[${SCRIPT_NAME}] 上传失败: ${response.status}`);
          btn.textContent = '上传失败';
          btn.style.color = '#ff4d4f';
        }
      },
      onerror: function () {
        console.warn(`[${SCRIPT_NAME}] 上传网络失败`);
        btn.textContent = '上传失败';
        btn.style.color = '#ff4d4f';
      }
    });
  }

  function resetBtn(btn) {
    btn.textContent = '上传题库';
    btn.style.color = 'rgb(0, 122, 255)';
  }

  const MARK = 'data-upload-processed';
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
