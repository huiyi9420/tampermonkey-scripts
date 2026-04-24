// ==UserScript==
// @name         CoolCollege 作答详情解锁
// @namespace    https://github.com/coolcollege-unlock
// @version      0.3.0
// @description  解锁酷学院考试数据页面的作答详情按钮，支持查看历史考试作答详情及下载试题
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

  const SCRIPT_NAME = 'CoolCollege 作答详情解锁';
  const TARGET_PATH = '/training/examination/exam-data';
  const QUESTION_BANK_HOST = 'question.a2008q.top';

  // 题库网站：同步 token 到 Tampermonkey 跨域存储
  if (window.location.hostname === QUESTION_BANK_HOST) {
    const token = localStorage.getItem('accessToken');
    if (token) {
      GM_setValue('qb_token', token);
      console.log(`[${SCRIPT_NAME}] 题库 token 已同步`);
    }
    return;
  }

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

  // ===== 数据获取 =====

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

  function getEid() {
    return localStorage.getItem('enterpriseId');
  }

  function getUid() {
    return localStorage.getItem('uid');
  }

  function getToken() {
    return localStorage.getItem('token');
  }

  function getExamId() {
    const hash = window.location.hash;
    if (!hash) return null;
    const queryPart = hash.split('?')[1];
    if (!queryPart) return null;
    const params = new URLSearchParams(queryPart);
    return params.get('exam_id');
  }

  // ===== DOM 辅助 =====

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

  /**
   * 定位操作列中的容器 div
   * @returns {HTMLElement|null}
   */
  function getOperateContainer(row) {
    const fixRightCell = row.querySelector('.ant-table-cell-fix-right');
    if (!fixRightCell) return null;
    return fixRightCell.querySelector('div') || fixRightCell;
  }

  // ===== 按钮处理 =====

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

    const data = { record, eid, examId };

    // 解锁灰色「作答详情」按钮
    unlockDetailButton(row, data);

    // 添加「下载试题」按钮（所有行）
    addDownloadButton(row, data);

    // 添加「上传题目」按钮（所有行）
    addUploadButton(row, data);

    console.log(
      `[${SCRIPT_NAME}] 提取成功: submit_id=${record.submit_id}, ` +
      `show_record=${record.show_record}, eid=${eid}, examId=${examId}`
    );
  }

  /**
   * 解锁「作答详情」按钮：修改样式 + 绑定点击跳转
   */
  function unlockDetailButton(row, data) {
    const { record, eid, examId } = data;

    if (record.show_record !== "false") return;

    const container = getOperateContainer(row);
    if (!container) {
      console.warn(`[${SCRIPT_NAME}] 未找到操作列容器`);
      return;
    }

    const spans = container.querySelectorAll('span');
    let detailSpan = null;
    for (const span of spans) {
      if (span.textContent.trim() === '作答详情') {
        detailSpan = span;
        break;
      }
    }

    if (!detailSpan) {
      console.warn(`[${SCRIPT_NAME}] 未找到「作答详情」span`);
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

  /**
   * 添加「下载试题」按钮
   * 调用 submit-info API 获取完整试题数据，保存为 ExamResponse.json
   */
  function addDownloadButton(row, data) {
    const { record, eid, examId } = data;

    const container = getOperateContainer(row);
    if (!container) return;

    // 创建下载按钮（与「作答详情」上下对齐）
    const downloadSpan = document.createElement('span');
    downloadSpan.textContent = '下载试题';
    downloadSpan.style.cssText = 'display:block;color:rgb(0, 122, 255);cursor:pointer;margin-top:4px;';

    downloadSpan.addEventListener('click', function (e) {
      e.stopPropagation();
      downloadExamPaper(record, eid, examId);
    });

    container.appendChild(downloadSpan);
  }

  /**
   * 获取考试标题
   */
  function getExamTitle() {
    const el = document.querySelector('.exam-title');
    return el?.textContent?.trim() || 'Exam';
  }

  /**
   * 生成下载文件名：姓名_考试题目_得分_作答时长_交卷时间.json
   */
  function buildFileName(record) {
    const userName = localStorage.getItem('name') || '';
    const title = getExamTitle();
    const score = `${record.score}分`;
    const durationSec = parseInt(record.answer_duration, 10) || 0;
    const duration = `${Math.floor(durationSec / 60)}分${durationSec % 60}秒`;
    const time = new Date(parseInt(record.submit_time, 10));
    const timeStr = `${time.getFullYear()}${String(time.getMonth() + 1).padStart(2, '0')}${String(time.getDate()).padStart(2, '0')}_${String(time.getHours()).padStart(2, '0')}${String(time.getMinutes()).padStart(2, '0')}`;

    const parts = [userName, title, score, duration, timeStr].filter(Boolean);
    return `${parts.join('_')}.json`;
  }

  /**
   * 调用 API 下载试题并保存为 JSON 文件
   */
  function downloadExamPaper(record, eid, examId) {
    const uid = getUid();
    const token = getToken();

    if (!uid || !token || !eid) {
      console.warn(`[${SCRIPT_NAME}] 缺少必要参数: uid=${uid}, token=${token ? '有' : '无'}, eid=${eid}`);
      return;
    }

    const apiUrl = `https://coolapi.coolcollege.cn/new-exam-api/v2/enterprises/${eid}/users/${uid}/exams/${examId}/submit-info/${record.submit_id}?task_id=${record.task_id}`;
    const fileName = buildFileName(record);

    console.log(`[${SCRIPT_NAME}] 正在下载试题: ${fileName}`);

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
          console.warn(`[${SCRIPT_NAME}] API 请求失败: ${response.status}`);
          return;
        }

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
          console.warn(`[${SCRIPT_NAME}] 解析响应失败: ${err.message}`);
        }
      },
      onerror: function () {
        console.warn(`[${SCRIPT_NAME}] 网络请求失败`);
      }
    });
  }

  // ===== 上传题库 =====

  const QUESTION_BANK_URL = 'https://question.a2008q.top';

  /**
   * 从 API 响应中递归查找第一个数字值（题目数量）
   */
  function findNumberValue(obj) {
    if (typeof obj === 'number') return obj;
    if (typeof obj !== 'object' || obj === null) return null;
    for (const val of Object.values(obj)) {
      const found = findNumberValue(val);
      if (found !== null) return found;
    }
    return null;
  }

  /**
   * 添加「上传题库」按钮
   */
  function addUploadButton(row, data) {
    const { record, eid, examId } = data;

    const container = getOperateContainer(row);
    if (!container) return;

    const uploadSpan = document.createElement('span');
    uploadSpan.textContent = '上传题库';
    uploadSpan.style.cssText = 'display:block;color:rgb(0, 122, 255);cursor:pointer;margin-top:4px;';

    uploadSpan.addEventListener('click', function (e) {
      e.stopPropagation();
      handleUploadExamPaper(record, eid, examId, uploadSpan);
    });

    container.appendChild(uploadSpan);
  }

  /**
   * 上传题库完整流程：获取试题 → 上传到题库系统
   */
  function handleUploadExamPaper(record, eid, examId, buttonEl) {
    const uid = getUid();
    const token = getToken();

    if (!uid || !token || !eid) {
      console.warn(`[${SCRIPT_NAME}] 缺少必要参数`);
      return;
    }

    // 检查题库 token
    const authToken = GM_getValue('qb_token', null);
    if (!authToken) {
      console.warn(`[${SCRIPT_NAME}] 题库系统未登录，正在打开登录页面`);
      GM_openInTab(`${QUESTION_BANK_URL}/list`, { active: true });
      buttonEl.textContent = '未登录，登录后重试';
      buttonEl.style.color = '#faad14';
      return;
    }

    const apiUrl = `https://coolapi.coolcollege.cn/new-exam-api/v2/enterprises/${eid}/users/${uid}/exams/${examId}/submit-info/${record.submit_id}?task_id=${record.task_id}`;

    buttonEl.textContent = '获取中...';
    buttonEl.style.color = '#999';

    // 第一步：获取试题数据
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
          console.warn(`[${SCRIPT_NAME}] 获取试题失败: ${response.status}`);
          resetUploadButton(buttonEl);
          return;
        }
        // 第二步：上传到题库系统
        uploadToQuestionBank(response.responseText, record, buttonEl, authToken);
      },
      onerror: function () {
        console.warn(`[${SCRIPT_NAME}] 获取试题网络失败`);
        resetUploadButton(buttonEl);
      }
    });
  }

  /**
   * 上传 JSON 数据到题库系统
   */
  function uploadToQuestionBank(jsonString, record, buttonEl, authToken) {
    const fileName = buildFileName(record);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const file = new File([blob], fileName, { type: 'application/json' });

    const formData = new FormData();
    formData.append('file', file);

    buttonEl.textContent = '上传中...';

    GM_xmlhttpRequest({
      method: 'POST',
      url: `${QUESTION_BANK_URL}/api/question/upload`,
      headers: {
        'authorization': authToken
      },
      data: formData,
      onload: function (response) {
        if (response.status === 200) {
          try {
            const result = JSON.parse(response.responseText);
            // 响应格式: {"code":0,"data":{"message":"已添加50条"}}
            const match = (result?.data?.message || '').match(/\d+/);
            const count = match ? match[0] : '';
            const msg = count ? `成功${count}题` : '已上传';
            console.log(`[${SCRIPT_NAME}] 上传成功: ${fileName} - ${msg}`);
            buttonEl.textContent = msg;
            buttonEl.style.color = '#52c41a';
          } catch {
            console.log(`[${SCRIPT_NAME}] 上传成功: ${fileName}`);
            buttonEl.textContent = '已上传';
            buttonEl.style.color = '#52c41a';
          }
        } else if (response.status === 401 || response.status === 403) {
          console.warn(`[${SCRIPT_NAME}] 题库认证已过期，请重新登录`);
          GM_setValue('qb_token', null);
          GM_openInTab(`${QUESTION_BANK_URL}/list`, { active: true });
          buttonEl.textContent = '登录过期，登录后重试';
          buttonEl.style.color = '#faad14';
        } else {
          console.warn(`[${SCRIPT_NAME}] 上传失败: ${response.status} ${response.responseText}`);
          buttonEl.textContent = '上传失败';
          buttonEl.style.color = '#ff4d4f';
        }
      },
      onerror: function () {
        console.warn(`[${SCRIPT_NAME}] 上传网络失败`);
        buttonEl.textContent = '上传失败';
        buttonEl.style.color = '#ff4d4f';
      }
    });
  }

  function resetUploadButton(buttonEl) {
    buttonEl.textContent = '上传题库';
    buttonEl.style.color = 'rgb(0, 122, 255)';
  }

  // ===== MutationObserver =====

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

  // SPA 路由切换：目标页面间导航时重新初始化（如考试 A → 考试 B）
  if (typeof window.onurlchange === 'object' && window.onurlchange === null) {
    window.addEventListener('urlchange', () => {
      init();
    });
  }
})();
