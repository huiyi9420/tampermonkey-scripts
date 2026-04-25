// ==UserScript==
// @name         CoolCollege 智能辅助答题
// @namespace    https://github.com/coolcollege-unlock
// @version      2.3.0
// @description  精准匹配题库答案，选项左侧绿色高亮 + 下方匹配结果区块，实时动态预测得分区间，支持个人中心拦截、考试页辅助、详情页分析
// @author       zhaolulu
// @match        *://pro.coolcollege.cn/*
// @match        *://question.a2008q.top/*
// @grant        window.onurlchange
// @grant        GM_openInTab
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      question.a2008q.top
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const SCRIPT_NAME = '智能辅助答题';
  const DETAIL_PATH = '/training/examination/new-exam/parse';
  const EXAMING_PATH = '/training/examination/new-exam/examing';
  const PROFILE_HASH = '/personal/profile';
  const QUESTION_BANK_HOST = 'question.a2008q.top';
  const QUESTION_BANK_URL = 'https://question.a2008q.top';

  // ===== 题库网站：同步 token =====
  if (window.location.hostname === QUESTION_BANK_HOST) {
    const token = localStorage.getItem('accessToken');
    if (token) {
      GM_setValue('qb_token', token);
      console.log(`[${SCRIPT_NAME}] 题库 token 已同步`);
    }
    return;
  }

  // ===== 常量 =====
  const MATCH_THRESHOLD = 0.6;
  const HIGH_CONFIDENCE = 0.95;
  const SEARCH_PAGE_SIZE = 5;
  const MIN_CONCURRENCY = 5;
  const MAX_CONCURRENCY = 15;
  const LATENCY_SAMPLE_SIZE = 5;
  const LATENCY_HIGH_MS = 2000;
  const LATENCY_LOW_MS = 800;

  /**
   * 自适应并发控制器
   * - 初始并发 15，根据实际请求延迟动态调整
   * - 延迟 > 2s：减少 2（下限 5）
   * - 延迟 < 800ms：增加 1（上限 15）
   */
  let adaptiveMaxWorkers = MAX_CONCURRENCY;
  const latencyHistory = [];

  function adjustConcurrency(latencyMs) {
    latencyHistory.push(latencyMs);
    if (latencyHistory.length < LATENCY_SAMPLE_SIZE) return;

    // 只保留最近的样本
    if (latencyHistory.length > LATENCY_SAMPLE_SIZE * 2) {
      latencyHistory.splice(0, LATENCY_SAMPLE_SIZE);
    }

    const recent = latencyHistory.slice(-LATENCY_SAMPLE_SIZE);
    const avgLatency = recent.reduce((a, b) => a + b, 0) / recent.length;

    if (avgLatency > LATENCY_HIGH_MS && adaptiveMaxWorkers > MIN_CONCURRENCY) {
      adaptiveMaxWorkers = Math.max(MIN_CONCURRENCY, adaptiveMaxWorkers - 2);
      console.log(`[${SCRIPT_NAME}] 延迟增高(${Math.round(avgLatency)}ms)，并发降至 ${adaptiveMaxWorkers}`);
    } else if (avgLatency < LATENCY_LOW_MS && adaptiveMaxWorkers < MAX_CONCURRENCY) {
      adaptiveMaxWorkers = Math.min(MAX_CONCURRENCY, adaptiveMaxWorkers + 1);
      console.log(`[${SCRIPT_NAME}] 延迟正常(${Math.round(avgLatency)}ms)，并发升至 ${adaptiveMaxWorkers}`);
    }
  }

  // ===== 工具函数 =====

  function getAuthToken() {
    return GM_getValue('qb_token', null);
  }

  // ===== 登录状态检查 =====

  function validateToken(token) {
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: `${QUESTION_BANK_URL}/api/question?current=1&pageSize=1`,
        headers: { 'authorization': token },
        onload: function (response) {
          try {
            const result = JSON.parse(response.responseText);
            resolve(result.code === 0);
          } catch {
            resolve(false);
          }
        },
        onerror: function () { resolve(false); }
      });
    });
  }

  function showLoginPanel(onReady) {
    if (document.getElementById('qb-login-panel')) return;

    const overlay = document.createElement('div');
    overlay.id = 'qb-login-panel';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      z-index: 100000;
      background: rgba(0, 0, 0, 0.45);
      display: flex; align-items: center; justify-content: center;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      background: #fff; border-radius: 12px;
      padding: 32px 40px; text-align: center;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      max-width: 400px; width: 90%;
    `;

    const icon = document.createElement('div');
    icon.style.cssText = `
      width: 48px; height: 48px; margin: 0 auto 16px;
      border-radius: 50%; background: #fff7e6;
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; color: #faad14;
    `;
    icon.textContent = '\u26A0';

    const title = document.createElement('h3');
    title.style.cssText = 'margin: 0 0 8px; font-size: 18px; color: #262626;';
    title.textContent = '题库系统未登录';

    const desc = document.createElement('p');
    desc.id = 'qb-login-desc';
    desc.style.cssText = 'margin: 0 0 24px; font-size: 14px; color: #8c8c8c; line-height: 1.6;';
    desc.textContent = '辅助答题功能需要登录题库系统才能正常工作。请先登录题库系统，然后返回此页面检查登录状态。';

    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';

    const loginBtn = document.createElement('button');
    loginBtn.textContent = '登录题库系统';
    loginBtn.style.cssText = `
      width: 100%; padding: 10px 0; border: none; border-radius: 6px;
      background: #1890ff; color: #fff; font-size: 15px; cursor: pointer;
      transition: background 0.2s;
    `;
    loginBtn.addEventListener('mouseover', () => { loginBtn.style.background = '#40a9ff'; });
    loginBtn.addEventListener('mouseout', () => { loginBtn.style.background = '#1890ff'; });
    loginBtn.addEventListener('click', () => {
      GM_openInTab(`${QUESTION_BANK_URL}/list`, { active: true });
    });

    const checkBtn = document.createElement('button');
    checkBtn.textContent = '检查登录状态';
    checkBtn.style.cssText = `
      width: 100%; padding: 10px 0; border: 1px solid #d9d9d9; border-radius: 6px;
      background: #fff; color: #595959; font-size: 15px; cursor: pointer;
      transition: all 0.2s;
    `;
    checkBtn.addEventListener('mouseover', () => {
      checkBtn.style.borderColor = '#1890ff'; checkBtn.style.color = '#1890ff';
    });
    checkBtn.addEventListener('mouseout', () => {
      checkBtn.style.borderColor = '#d9d9d9'; checkBtn.style.color = '#595959';
    });
    checkBtn.addEventListener('click', async () => {
      checkBtn.textContent = '检查中...';
      checkBtn.disabled = true;
      checkBtn.style.opacity = '0.6';

      const token = getAuthToken();
      if (token && await validateToken(token)) {
        card.style.transition = 'all 0.3s ease';
        card.style.transform = 'scale(0.95)';
        card.style.opacity = '0';
        setTimeout(() => {
          overlay.remove();
          onReady();
        }, 300);
      } else {
        checkBtn.textContent = '检查登录状态';
        checkBtn.disabled = false;
        checkBtn.style.opacity = '1';
        const descEl = document.getElementById('qb-login-desc');
        if (descEl) {
          descEl.style.color = '#ff4d4f';
          descEl.textContent = '仍未检测到有效登录，请确认已在题库系统完成登录后重试。';
          setTimeout(() => { descEl.style.color = '#8c8c8c'; }, 3000);
        }
      }
    });

    btnGroup.appendChild(loginBtn);
    btnGroup.appendChild(checkBtn);

    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(btnGroup);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  // ===== 就绪确认浮窗 =====

  function showReadyConfirm(onContinue) {
    if (document.getElementById('qb-ready-panel')) return;

    const overlay = document.createElement('div');
    overlay.id = 'qb-ready-panel';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      z-index: 100000;
      background: rgba(0, 0, 0, 0.45);
      display: flex; align-items: center; justify-content: center;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      background: #fff; border-radius: 12px;
      padding: 32px 40px; text-align: center;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      max-width: 400px; width: 90%;
    `;

    const icon = document.createElement('div');
    icon.style.cssText = `
      width: 48px; height: 48px; margin: 0 auto 16px;
      border-radius: 50%; background: #f6ffed;
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; color: #52c41a;
    `;
    icon.textContent = '\u2713';

    const title = document.createElement('h3');
    title.style.cssText = 'margin: 0 0 8px; font-size: 18px; color: #262626;';
    title.textContent = '辅助答题已就绪';

    const desc = document.createElement('p');
    desc.style.cssText = 'margin: 0 0 24px; font-size: 14px; color: #8c8c8c; line-height: 1.6;';
    desc.textContent = '题库系统已登录，辅助答题功能将在考试页面自动启动。';

    const continueBtn = document.createElement('button');
    continueBtn.textContent = '继续';
    continueBtn.style.cssText = `
      width: 100%; padding: 10px 0; border: none; border-radius: 6px;
      background: #52c41a; color: #fff; font-size: 15px; cursor: pointer;
      transition: background 0.2s;
    `;
    continueBtn.addEventListener('mouseover', () => { continueBtn.style.background = '#73d13d'; });
    continueBtn.addEventListener('mouseout', () => { continueBtn.style.background = '#52c41a'; });
    continueBtn.addEventListener('click', () => {
      card.style.transition = 'all 0.3s ease';
      card.style.transform = 'scale(0.95)';
      card.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
        onContinue();
      }, 300);
    });

    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(continueBtn);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  // ===== 题目提取 =====

  function extractQuestions() {
    const questionDivs = document.querySelectorAll('div[class*="question"]');
    const questions = [];

    for (const div of questionDivs) {
      const options = div.querySelectorAll('.ant-radio-wrapper, .ant-checkbox-wrapper');
      if (options.length === 0) continue;

      const titleEl = div.querySelector('div[class*="question-title"]');
      const subjectEl = div.querySelector('p[class*="subject"]');
      const rawText = subjectEl?.textContent?.trim() || titleEl?.textContent?.trim() || '';
      const fullText = div.textContent;

      // 清洗题目文本
      let pureText = rawText
        .replace(/^\d+\.\s*【[^】]+】/, '')
        .replace(/（\d+分）.*$/, '')
        .replace(/\(\d+分\).*$/, '')
        .trim();

      // 提取分值
      const pointMatch = fullText.match(/[（(](\d+)分[）)]/);
      const pointValue = pointMatch ? parseInt(pointMatch[1], 10) : 0;

      // 提取正确答案字母
      const correctMatch = fullText.match(/正确答案[：:]\s*([A-Z、]+)/);
      let correctLetters = [];
      if (correctMatch) {
        correctLetters = correctMatch[1].split(/[、]/).filter(l => /^[A-Z]$/.test(l));
      }

      const isMultiChoice = options[0]?.querySelector('input')?.type === 'checkbox';

      const optionList = [];
      options.forEach(opt => {
        const text = opt.textContent?.trim() || '';
        const match = text.match(/^[A-Z][：:]\s*(.+)$/);
        optionList.push({
          letter: text[0],
          text: match ? match[1] : text,
          element: opt
        });
      });

      questions.push({
        div,
        pureText,
        isMultiChoice,
        options: optionList,
        pointValue,
        correctLetters,
        bankResult: null
      });
    }

    return questions;
  }

  // ===== 文本相似度 =====

  function calcSimilarity(a, b) {
    const normalize = (s) => s.replace(/[\s，。？！、；：""''（）《》【】\(\)\[\]\{\},.?!;:'"<>/\\@#$%^&*+=\-_~`|·…—\-]/g, '');
    const setA = new Set(normalize(a));
    const setB = new Set(normalize(b));
    if (setA.size === 0 && setB.size === 0) return 1;
    if (setA.size === 0 || setB.size === 0) return 0;

    let intersection = 0;
    for (const ch of setA) {
      if (setB.has(ch)) intersection++;
    }

    return intersection / (setA.size + setB.size - intersection);
  }

  // ===== 题库搜索 =====

  /**
   * 认证失效标志：一旦检测到，停止所有 worker
   */
  let authExpired = false;

  function searchQuestionBank(questionText, authToken) {
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: `${QUESTION_BANK_URL}/api/question?current=1&pageSize=${SEARCH_PAGE_SIZE}&topic=${encodeURIComponent(questionText)}`,
        headers: { 'authorization': authToken },
        onload: function (response) {
          try {
            const result = JSON.parse(response.responseText);
            // 认证失效：code 不为 0 且不是"无数据"
            if (result.code !== 0) {
              resolve({ authFailed: true });
              return;
            }
            if (!result.data?.data?.length) {
              resolve(null);
              return;
            }

            let bestMatch = null;
            let bestScore = 0;

            for (const item of result.data.data) {
              const score = calcSimilarity(questionText, item.topic);
              if (score > bestScore) {
                bestScore = score;
                bestMatch = item;
              }
            }

            resolve({ item: bestMatch, similarity: bestScore });
          } catch {
            resolve(null);
          }
        },
        onerror: function () { resolve(null); }
      });
    });
  }

  /**
   * 处理认证失效：清除 token、停止队列、弹登录面板
   */
  function handleAuthExpired(progressBar) {
    if (authExpired) return; // 防止多个 worker 重复触发
    authExpired = true;
    GM_setValue('qb_token', null);
    if (progressBar) progressBar.remove();
    console.warn(`[${SCRIPT_NAME}] 题库认证已过期，请重新登录`);
    showLoginPanel(() => {
      // 重新登录后刷新页面重新匹配
      location.reload();
    });
  }

  // ===== 文本工具 =====

  /**
   * 归一化文本：去标点空格，用于精确比较
   */
  function normalizeText(s) {
    return s.replace(/[\s，。？！、；：""''（）《》【】\(\)\[\]\{\},.?!;:'"<>/\\@#$%^&*+=\-_~`|·…—\-]/g, '');
  }

  /**
   * 清理题库答案文本：去除字母前缀（如 "A：消息队列" → "消息队列"）
   */
  function cleanAnswerText(ans) {
    return ans.replace(/^[A-Z][：:]\s*/, '').trim();
  }

  // ===== 答案匹配判定 =====

  /**
   * 精准匹配：仅精确/归一化精确匹配（用于高亮选项）
   * 解决 "支持" 被误匹配到 "不支持" 的问题
   */
  function matchAnswerExact(ans, optText) {
    if (ans === optText) return true;
    if (normalizeText(ans) === normalizeText(optText)) return true;
    return false;
  }

  /**
   * 模糊匹配：包含关系（仅用于 mapAnswerToLetters 判定得分）
   */
  function matchAnswerFuzzy(ans, optText) {
    if (matchAnswerExact(ans, optText)) return true;
    if (optText.includes(ans) && ans.length > optText.length * 0.6) return true;
    const normAns = normalizeText(ans);
    const normOpt = normalizeText(optText);
    if (normOpt.includes(normAns) && normAns.length > normOpt.length * 0.6) return true;
    return false;
  }

  /**
   * 将题库 answer 文本映射为选项字母（用于得分预测）
   */
  function mapAnswerToLetters(question, bankAnswer) {
    const answers = bankAnswer.split('|').map(a => cleanAnswerText(a.trim()));
    const suggestedLetters = [];

    for (const ans of answers) {
      if (/^[A-Z]$/.test(ans)) {
        suggestedLetters.push(ans);
        continue;
      }
      for (const opt of question.options) {
        if (matchAnswerFuzzy(ans, opt.text)) {
          suggestedLetters.push(opt.letter);
          break;
        }
      }
    }

    return suggestedLetters;
  }

  /**
   * 判断 bank 建议的答案是否与正确答案一致
   */
  function isAnswerCorrect(suggestedLetters, correctLetters, isMultiChoice) {
    if (correctLetters.length === 0) return false;

    if (isMultiChoice) {
      if (suggestedLetters.length !== correctLetters.length) return false;
      const suggested = new Set(suggestedLetters);
      return correctLetters.every(l => suggested.has(l));
    } else {
      return suggestedLetters.length > 0 && correctLetters.includes(suggestedLetters[0]);
    }
  }

  // ===== 精准高亮 + 匹配结果展示 =====

  /**
   * 精准高亮选项（左侧绿色边框）
   */
  function applyPreciseHighlight(element) {
    element.style.cssText = `
      background: rgba(82, 196, 26, 0.18) !important;
      border-left: 3px solid #52c41a !important;
      border-radius: 0 4px 4px 0 !important;
      padding-left: 10px !important;
      transition: all 0.2s ease;
    `;
  }

  /**
   * 展示题库匹配结果区块（选项下方，仿解析区域样式）
   * 多选题每个答案渲染一行
   */
  function showMatchResultBlock(question, bankResult) {
    const { similarity, item } = bankResult;
    if (similarity < MATCH_THRESHOLD || !item?.answer) return;
    if (question.div.querySelector('.qb-result-block')) return;

    const pct = Math.round(similarity * 100);
    const pctColor = similarity >= HIGH_CONFIDENCE ? '#52c41a' : '#faad14';

    // 解析每个答案
    const answers = item.answer.split('|').map(a => a.trim());
    const answerEntries = [];

    for (const ans of answers) {
      const cleaned = cleanAnswerText(ans);
      if (/^[A-Z]$/.test(cleaned)) {
        // 纯字母答案
        answerEntries.push({ letter: cleaned, text: '' });
      } else {
        // 文本答案：通过精准匹配找对应选项字母
        let matchedLetter = null;
        for (const opt of question.options) {
          if (matchAnswerExact(cleaned, opt.text)) {
            matchedLetter = opt.letter;
            break;
          }
        }
        answerEntries.push({ letter: matchedLetter, text: cleaned });
      }
    }

    // 构建区块
    const block = document.createElement('div');
    block.className = 'qb-result-block';
    block.style.cssText = `
      margin-top: 12px; padding: 10px 14px;
      background: #fffbe6; border: 1px solid #ffe58f;
      border-radius: 4px; font-size: 14px; line-height: 1.8;
    `;

    // 标题行
    const titleDiv = document.createElement('div');
    titleDiv.style.cssText = `
      font-weight: 600; font-size: 14px; margin-bottom: 6px;
      display: flex; align-items: center; gap: 8px; color: #262626;
    `;

    const titleText = document.createElement('span');
    titleText.textContent = '题库匹配';

    const pctBadge = document.createElement('span');
    pctBadge.style.cssText = `
      display: inline-block; padding: 1px 8px; border-radius: 3px;
      font-size: 12px; color: #fff; background: ${pctColor}; font-weight: 500;
    `;
    pctBadge.textContent = `匹配 ${pct}%`;

    titleDiv.appendChild(titleText);
    titleDiv.appendChild(pctBadge);
    block.appendChild(titleDiv);

    // 每个答案一行
    for (const entry of answerEntries) {
      const line = document.createElement('div');
      line.style.cssText = `
        display: flex; align-items: baseline; gap: 6px;
        padding: 3px 10px;
        background: rgba(255, 163, 64, 0.12);
        border: 1px solid rgba(255, 163, 64, 0.3);
        border-radius: 3px; margin-top: 4px;
        color: #873800; font-size: 13px;
      `;

      const letterSpan = document.createElement('span');
      letterSpan.style.cssText = 'font-weight:700;color:#389e0d;min-width:18px;';
      letterSpan.textContent = entry.letter || '?';

      line.appendChild(letterSpan);
      if (entry.text) {
        const textSpan = document.createElement('span');
        textSpan.style.cssText = 'font-weight:500;word-break:break-all;';
        textSpan.textContent = entry.text;
        line.appendChild(textSpan);
      }

      block.appendChild(line);
    }

    question.div.appendChild(block);
  }

  /**
   * 主入口：精准高亮 + 结果区块展示
   */
  function highlightAndShowResult(question, bankResult) {
    const { similarity, item } = bankResult;
    if (similarity < MATCH_THRESHOLD || !item?.answer) return;

    const answers = item.answer.split('|').map(a => a.trim());

    // 精准高亮选项
    for (const opt of question.options) {
      const matched = answers.some(ans => {
        const cleaned = cleanAnswerText(ans);
        if (/^[A-Z]$/.test(cleaned)) return cleaned === opt.letter;
        return matchAnswerExact(cleaned, opt.text);
      });
      if (matched) {
        applyPreciseHighlight(opt.element);
      }
    }

    // 展示匹配结果区块
    showMatchResultBlock(question, bankResult);
  }

  /**
   * 自动选中匹配的选项（仅考试页使用）
   * 多选题：先取消所有已选，再勾选匹配项
   */
  function autoSelectAnswer(question, bankResult) {
    const { similarity, item } = bankResult;
    if (similarity < MATCH_THRESHOLD || !item?.answer) return;

    const answers = item.answer.split('|').map(a => a.trim());

    // 判断每个选项是否匹配
    const matchedSet = new Set();
    for (const opt of question.options) {
      const matched = answers.some(ans => {
        const cleaned = cleanAnswerText(ans);
        if (/^[A-Z]$/.test(cleaned)) return cleaned === opt.letter;
        return matchAnswerExact(cleaned, opt.text);
      });
      if (matched) matchedSet.add(opt.letter);
    }

    if (question.isMultiChoice) {
      // 多选：先取消所有已选中的，再勾选匹配项
      for (const opt of question.options) {
        const input = opt.element.querySelector('input');
        if (!input) continue;
        if (input.checked && !matchedSet.has(opt.letter)) {
          opt.element.click(); // 取消选中
        }
      }
      for (const opt of question.options) {
        const input = opt.element.querySelector('input');
        if (!input) continue;
        if (!input.checked && matchedSet.has(opt.letter)) {
          opt.element.click(); // 勾选
        }
      }
    } else {
      // 单选：直接点击匹配项
      for (const opt of question.options) {
        if (matchedSet.has(opt.letter)) {
          const input = opt.element.querySelector('input');
          if (input && !input.checked) {
            opt.element.click();
          }
          break; // 单选只点一个
        }
      }
    }
  }

  // ===== 动态得分预测 =====

  let predScoreDisplay = null;

  function initPrediction() {
    const titleDiv = document.querySelector('.title___3rebw');
    if (!titleDiv) return;

    const span = document.createElement('span');
    span.className = 'qb-prediction';
    span.style.cssText = `
      margin-left: 8px;
      padding: 5px 10px;
      border: 1px solid #91d5ff;
      border-radius: 3px;
      background: rgba(24, 144, 255, 0.06);
      font-size: 14px;
      font-weight: normal;
      color: #595959;
      line-height: 1.4;
    `;

    const display = document.createElement('span');
    display.id = 'qb-score-display';
    display.style.cssText = `
      color: #1890ff;
      font-weight: 600;
      display: inline-block;
      transition: transform 0.15s ease;
    `;
    display.textContent = '计算中...';

    span.appendChild(document.createTextNode('预测得分: '));
    span.appendChild(display);
    titleDiv.appendChild(span);

    predScoreDisplay = display;
  }

  function updateLiveScore(questions) {
    if (!predScoreDisplay) return;

    let minScore = 0;
    let maxScore = 0;

    for (const q of questions) {
      if (!q.bankResult || !q.bankResult.isCorrect) continue;
      const sim = q.bankResult.similarity;
      const pts = q.pointValue;

      if (sim >= HIGH_CONFIDENCE) {
        minScore += pts;
        maxScore += pts;
      } else if (sim >= MATCH_THRESHOLD) {
        maxScore += pts;
      }
    }

    minScore = Math.round(minScore * 10) / 10;
    maxScore = Math.round(maxScore * 10) / 10;

    const scoreText = minScore === maxScore
      ? `${minScore}分`
      : `${minScore} ~ ${maxScore}分`;

    predScoreDisplay.textContent = scoreText;
    // 数字跳动微动画
    predScoreDisplay.style.transform = 'scale(1.4)';
    setTimeout(() => { predScoreDisplay.style.transform = 'scale(1)'; }, 150);
  }

  // ===== 并发控制 =====

  async function processAllQuestions(questions, authToken) {
    const total = questions.length;
    let completed = 0;
    let activeWorkers = 0;
    authExpired = false;
    adaptiveMaxWorkers = MAX_CONCURRENCY;
    latencyHistory.length = 0;

    initPrediction();
    const progressBar = createProgressBar(total);
    const queue = [...questions];

    async function worker() {
      activeWorkers++;
      while (queue.length > 0 && !authExpired) {
        // 并发缩减：多余的 worker 主动退出
        if (activeWorkers > adaptiveMaxWorkers) {
          activeWorkers--;
          return;
        }

        const question = queue.shift();
        const startTime = Date.now();
        try {
          const result = await searchQuestionBank(question.pureText, authToken);
          adjustConcurrency(Date.now() - startTime);

          if (result?.authFailed) {
            handleAuthExpired(progressBar);
            return;
          }
          if (result && result.item) {
            highlightAndShowResult(question, result);

            const suggestedLetters = mapAnswerToLetters(question, result.item.answer);
            const correct = isAnswerCorrect(suggestedLetters, question.correctLetters, question.isMultiChoice);

            question.bankResult = {
              similarity: result.similarity,
              isCorrect: correct,
              suggestedLetters
            };
          }
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] 搜索失败: ${e.message}`);
        }
        completed++;
        updateProgress(progressBar, completed, total);
        updateLiveScore(questions);
      }
      activeWorkers--;
    }

    await Promise.all(Array.from({ length: MAX_CONCURRENCY }, () => worker()));
    if (!authExpired) setTimeout(() => progressBar.remove(), 2000);

    // 最终确认更新
    updateLiveScore(questions);
  }

  // ===== 进度条 =====

  function createProgressBar(total) {
    const bar = document.createElement('div');
    bar.id = 'qb-progress-bar';
    bar.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
      background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      padding: 8px 16px; display: flex; align-items: center; gap: 12px;
      font-size: 14px; color: #333;
    `;

    const label = document.createElement('span');
    label.id = 'qb-progress-label';
    label.textContent = `题库匹配中 0/${total}...`;

    const track = document.createElement('div');
    track.style.cssText = `
      flex: 1; height: 6px; background: #f0f0f0; border-radius: 3px; overflow: hidden;
    `;

    const fill = document.createElement('div');
    fill.id = 'qb-progress-fill';
    fill.style.cssText = `
      height: 100%; width: 0%;
      background: linear-gradient(90deg, #1890ff, #52c41a);
      border-radius: 3px; transition: width 0.3s ease;
    `;

    track.appendChild(fill);
    bar.appendChild(label);
    bar.appendChild(track);
    document.body.appendChild(bar);
    return bar;
  }

  function updateProgress(bar, completed, total) {
    const label = bar.querySelector('#qb-progress-label');
    const fill = bar.querySelector('#qb-progress-fill');
    const pct = Math.round((completed / total) * 100);
    if (label) label.textContent = completed >= total ? `匹配完成 ${total}/${total}` : `题库匹配中 ${completed}/${total}...`;
    if (fill) fill.style.width = `${pct}%`;
  }

  // ===== 个人中心按钮拦截 =====

  let profileObserver = null;

  function initProfileGuard() {
    if (profileObserver) { profileObserver.disconnect(); profileObserver = null; }
    console.log(`[${SCRIPT_NAME}] 个人中心拦截初始化`);

    function interceptButton(btn) {
      const text = btn.textContent?.trim();
      if (text !== '开始考试' && text !== '重考') return;
      if (btn.hasAttribute('data-qb-intercepted')) return;
      btn.setAttribute('data-qb-intercepted', '1');

      btn.addEventListener('click', async function (e) {
        // 放行标记：确认后二次点击时直接通过
        if (btn.hasAttribute('data-qb-allowed')) {
          btn.removeAttribute('data-qb-allowed');
          return;
        }

        e.stopPropagation();
        e.preventDefault();

        const authToken = getAuthToken();
        if (authToken && await validateToken(authToken)) {
          showReadyConfirm(() => {
            btn.setAttribute('data-qb-allowed', '1');
            btn.click();
          });
        } else {
          GM_setValue('qb_token', null);
          showLoginPanel(() => {
            btn.setAttribute('data-qb-allowed', '1');
            btn.click();
          });
        }
      }, true);
    }

    document.querySelectorAll('button').forEach(interceptButton);

    profileObserver = new MutationObserver((mutations) => {
      for (const { addedNodes } of mutations) {
        for (const node of addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.tagName === 'BUTTON') interceptButton(node);
          node.querySelectorAll?.('button').forEach(interceptButton);
        }
      }
    });
    profileObserver.observe(document.body, { childList: true, subtree: true });
  }

  // ===== 考试页辅助 =====

  function initExamAssist() {
    console.log(`[${SCRIPT_NAME}] 考试页辅助初始化`);

    const authToken = getAuthToken();
    if (!authToken) {
      console.warn(`[${SCRIPT_NAME}] 考试页未检测到题库 token`);
      return;
    }

    validateToken(authToken).then(valid => {
      if (!valid) {
        console.warn(`[${SCRIPT_NAME}] 考试页题库 token 无效`);
        return;
      }

      function tryExtract(retries) {
        if (retries <= 0) {
          console.warn(`[${SCRIPT_NAME}] 考试页未发现题目`);
          return;
        }
        const questions = extractQuestions();
        if (questions.length > 0) {
          console.log(`[${SCRIPT_NAME}] 考试页发现 ${questions.length} 道题`);
          processExamQuestions(questions, authToken);
        } else {
          console.log(`[${SCRIPT_NAME}] 等待题目加载，剩余重试 ${retries} 次`);
          setTimeout(() => tryExtract(retries - 1), 1000);
        }
      }

      setTimeout(() => tryExtract(10), 1000);
    });
  }

  async function processExamQuestions(questions, authToken) {
    const total = questions.length;
    let completed = 0;
    let activeWorkers = 0;
    authExpired = false;
    adaptiveMaxWorkers = MAX_CONCURRENCY;
    latencyHistory.length = 0;

    initPrediction();
    const progressBar = createProgressBar(total);
    const queue = [...questions];

    async function worker() {
      activeWorkers++;
      while (queue.length > 0 && !authExpired) {
        if (activeWorkers > adaptiveMaxWorkers) {
          activeWorkers--;
          return;
        }

        const question = queue.shift();
        const startTime = Date.now();
        try {
          const result = await searchQuestionBank(question.pureText, authToken);
          adjustConcurrency(Date.now() - startTime);

          if (result?.authFailed) {
            handleAuthExpired(progressBar);
            return;
          }
          if (result && result.item) {
            highlightAndShowResult(question, result);
            autoSelectAnswer(question, result);

            question.bankResult = {
              similarity: result.similarity,
              isCorrect: true,
              suggestedLetters: []
            };
          }
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] 搜索失败: ${e.message}`);
        }
        completed++;
        updateProgress(progressBar, completed, total);
        updateLiveScore(questions);
      }
      activeWorkers--;
    }

    await Promise.all(Array.from({ length: MAX_CONCURRENCY }, () => worker()));
    if (!authExpired) setTimeout(() => progressBar.remove(), 2000);
    updateLiveScore(questions);
  }

  // ===== 答题详情页主流程 =====

  function startMatching() {
    const authToken = getAuthToken();

    setTimeout(() => {
      const questions = extractQuestions();
      if (questions.length === 0) {
        console.log(`[${SCRIPT_NAME}] 未发现题目，1秒后重试`);
        setTimeout(() => {
          const retry = extractQuestions();
          if (retry.length > 0) {
            console.log(`[${SCRIPT_NAME}] 发现 ${retry.length} 道题`);
            processAllQuestions(retry, authToken);
          }
        }, 1000);
        return;
      }

      console.log(`[${SCRIPT_NAME}] 发现 ${questions.length} 道题`);
      processAllQuestions(questions, authToken);
    }, 500);
  }

  async function initDetailPage() {
    console.log(`[${SCRIPT_NAME}] 答题详情页初始化`);

    const authToken = getAuthToken();

    if (authToken && await validateToken(authToken)) {
      startMatching();
    } else {
      GM_setValue('qb_token', null);
      showLoginPanel(() => {
        console.log(`[${SCRIPT_NAME}] 登录验证通过，开始匹配`);
        startMatching();
      });
    }
  }

  // ===== 路由分发器 =====

  function route() {
    const href = window.location.href;

    // 清理上一页的观察器
    if (profileObserver) {
      profileObserver.disconnect();
      profileObserver = null;
    }

    if (href.includes(DETAIL_PATH)) {
      initDetailPage();
    } else if (href.includes(EXAMING_PATH)) {
      initExamAssist();
    } else if (href.includes(PROFILE_HASH)) {
      initProfileGuard();
    }
  }

  route();

  if (typeof window.onurlchange === 'object' && window.onurlchange === null) {
    window.addEventListener('urlchange', () => route());
  }
})();
