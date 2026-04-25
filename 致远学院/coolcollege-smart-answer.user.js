// ==UserScript==
// @name         CoolCollege 智能辅助答题
// @namespace    https://github.com/coolcollege-unlock
// @version      2.2.0
// @description  自动匹配题库答案，用颜色标注选项与匹配率，实时动态预测得分区间，支持个人中心拦截、考试页辅助、详情页分析
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
  const CONCURRENCY = 5;
  const COLORS = {
    high: { bg: 'rgba(82, 196, 26, 0.15)', border: '#52c41a', text: '#389e0d' },
    medium: { bg: 'rgba(250, 173, 20, 0.15)', border: '#faad14', text: '#d48806' },
    low: { bg: 'rgba(210, 77, 8, 0.15)', border: '#d46b08', text: '#873800' }
  };

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

  function searchQuestionBank(questionText, authToken) {
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: `${QUESTION_BANK_URL}/api/question?current=1&pageSize=${SEARCH_PAGE_SIZE}&topic=${encodeURIComponent(questionText)}`,
        headers: { 'authorization': authToken },
        onload: function (response) {
          try {
            const result = JSON.parse(response.responseText);
            if (result.code !== 0 || !result.data?.data?.length) {
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

  // ===== 答案匹配判定 =====

  /**
   * 将题库 answer 文本映射为选项字母
   */
  /**
   * 归一化文本：去标点空格，用于模糊比较
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

  function matchAnswerToOption(ans, optText) {
    // 1. 精确匹配
    if (ans === optText) return true;
    // 2. 归一化后精确匹配
    if (normalizeText(ans) === normalizeText(optText)) return true;
    // 3. 选项包含答案：要求答案占选项 60% 以上，防止短答案误匹配长选项
    if (optText.includes(ans) && ans.length > optText.length * 0.6) return true;
    // 4. 归一化后包含匹配
    const normAns = normalizeText(ans);
    const normOpt = normalizeText(optText);
    if (normOpt.includes(normAns) && normAns.length > normOpt.length * 0.6) return true;
    return false;
  }

  function mapAnswerToLetters(question, bankAnswer) {
    const answers = bankAnswer.split('|').map(a => cleanAnswerText(a.trim()));
    const suggestedLetters = [];

    for (const ans of answers) {
      // 单字母直接匹配
      if (/^[A-Z]$/.test(ans)) {
        suggestedLetters.push(ans);
        continue;
      }
      for (const opt of question.options) {
        if (matchAnswerToOption(ans, opt.text)) {
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
      // 多选：必须完全匹配（不多不少）
      if (suggestedLetters.length !== correctLetters.length) return false;
      const suggested = new Set(suggestedLetters);
      return correctLetters.every(l => suggested.has(l));
    } else {
      // 单选：建议的首个字母匹配正确答案
      return suggestedLetters.length > 0 && correctLetters.includes(suggestedLetters[0]);
    }
  }

  // ===== 选项匹配与标注 =====

  function highlightOptions(question, bankResult) {
    const { similarity, item } = bankResult;
    if (similarity < MATCH_THRESHOLD || !item?.answer) return;

    const colorScheme = similarity >= HIGH_CONFIDENCE ? COLORS.high : COLORS.medium;
    const answers = item.answer.split('|').map(a => a.trim());

    for (const opt of question.options) {
      const matched = answers.some(ans => {
        const cleaned = cleanAnswerText(ans);
        // 单字母直接匹配选项
        if (/^[A-Z]$/.test(cleaned)) return cleaned === opt.letter;
        return matchAnswerToOption(cleaned, opt.text);
      });
      if (matched) {
        applyHighlight(opt.element, colorScheme);
      }
    }

    showMatchBadge(question.div, similarity);
  }

  function applyHighlight(element, colorScheme) {
    element.style.cssText = `
      background: ${colorScheme.bg};
      border: 1px solid ${colorScheme.border};
      border-radius: 4px;
      padding: 2px 6px;
      margin: 2px 0;
      transition: all 0.3s ease;
    `;
  }

  function showMatchBadge(questionDiv, similarity) {
    if (questionDiv.querySelector('.qb-match-badge')) return;

    const pct = Math.round(similarity * 100);
    const bgColor = similarity >= HIGH_CONFIDENCE ? '#52c41a' : '#faad14';

    // 确保题目容器可做绝对定位参考
    questionDiv.style.position = 'relative';

    const badge = document.createElement('div');
    badge.className = 'qb-match-badge';
    badge.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      padding: 1px 8px;
      border-radius: 0 0 4px 0;
      font-size: 11px;
      color: #fff;
      background: ${bgColor};
      line-height: 1.5;
    `;
    badge.textContent = `匹配${pct}%`;

    questionDiv.appendChild(badge);
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

    initPrediction();
    const progressBar = createProgressBar(total);
    const queue = [...questions];

    async function worker() {
      while (queue.length > 0) {
        const question = queue.shift();
        try {
          const result = await searchQuestionBank(question.pureText, authToken);
          if (result && result.item) {
            highlightOptions(question, result);

            // 判定 bank 答案是否正确
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
        // 每完成一题，动态更新预测分数
        updateLiveScore(questions);
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker()));
    setTimeout(() => progressBar.remove(), 2000);

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

    initPrediction();
    const progressBar = createProgressBar(total);
    const queue = [...questions];

    async function worker() {
      while (queue.length > 0) {
        const question = queue.shift();
        try {
          const result = await searchQuestionBank(question.pureText, authToken);
          if (result && result.item) {
            highlightOptions(question, result);

            // 考试页无正确答案，信任题库匹配结果
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
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker()));
    setTimeout(() => progressBar.remove(), 2000);
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
