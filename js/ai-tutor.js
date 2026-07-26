/**
 * 辰泽教育 — AI Tutor Chat
 * Intelligent Q&A assistant for 专升本 education.
 */

(function() {
  'use strict';

  // ── DOM refs ──
  const messagesEl = document.getElementById('chatMessages');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSendBtn');

  // ── Knowledge base ──
  const knowledgeBase = {
    '虚拟语气': `**虚拟语气 (Subjunctive Mood)** 是专升本英语的重要考点。

**核心分类：**

1️⃣ **与现在事实相反**
   \`If + 主语 + 过去式 (be→were)，主语 + would/could + 动词原形\`
   *例：If I were you, I would study harder.*

2️⃣ **与过去事实相反**
   \`If + 主语 + had + 过去分词，主语 + would/could have + 过去分词\`
   *例：If I had studied, I would have passed.*

3️⃣ **与将来事实相反**
   \`If + 主语 + should/were to + 动词原形...\`

4️⃣ **名词性从句中的虚拟语气**
   suggest/advise/demand/order 等动词后的 that 从句用 \`(should) + 动词原形\`
   *例：I suggest that he (should) study more.*

5️⃣ **wish 的用法**
   - 与现在相反 → 过去式
   - 与过去相反 → 过去完成式
   - 与将来相反 → would/could + 动词原形

💡 **高频考点：** 条件句中 "if" 省略时，要把 were/had/should 提到主语前（倒装）。`,

    '专升本': `**专升本考试**是中国专科生升入本科的选拔性考试。

**考试科目（各省略有差异）：**

📚 **公共课：**
- **大学英语**（必考，分值最高）
- **高等数学**（理工类）或 **大学语文**（文史类）
- **计算机基础**（部分省份）

📖 **专业课：** 根据报考专业而定

⏰ **时间安排：**
- 报名时间：一般 3-4 月
- 考试时间：一般 4-5 月
- 录取时间：6-7 月

💪 **备考建议：**
1. 提前 6-8 个月开始准备
2. 英语是拉开差距的关键
3. 重视历年真题
4. 合理规划时间，循序渐进

需要我针对具体科目给你建议吗？`,

    '英语': `**专升本英语备考攻略：**

📌 **考试重点：**
- **词汇：** 掌握 3500-4000 核心词汇
- **语法：** 虚拟语气、定语从句、非谓语动词、倒装
- **阅读理解：** 4-5 篇，占分比重最大
- **写作：** 议论文/应用文，120-150 词
- **翻译：** 英译汉/汉译英

📖 **推荐复习方案：**
1. **基础阶段（前 3 个月）：** 每天背 30-50 个单词，系统学习语法
2. **强化阶段（中间 2 个月）：** 专项训练各题型
3. **冲刺阶段（最后 1 个月）：** 刷真题，限时模拟

🎯 **阅读理解技巧：**
- 先看题干，定位关键词
- 注意转折词（but, however, yet）
- 选项中的绝对词（all, never, must）通常不对

有什么具体的题型想深入练习吗？`,

    '高数': `**专升本高等数学备考指南：**

📌 **考试范围：**
1. **函数、极限、连续**（基础）
2. **一元函数微分学**（导数、微分）
3. **一元函数积分学**（不定积分、定积分）
4. **多元函数微积分**（偏导数、二重积分）
5. **常微分方程**（一阶、二阶）

📖 **极限计算常用方法：**
- 直接代入法
- 因式分解约去零因子
- 两个重要极限公式
- 洛必达法则（0/0 或 ∞/∞ 型）

💡 **高频考点：**
- 求极限：每年必考
- 导数的几何意义（切线方程）
- 定积分求面积、体积
- 微分方程的通解

需要我具体讲解某个知识点吗？`,

    '语文': `**专升本大学语文备考要点：**

📌 **考试内容：**
1. **文学常识**（约占 20%）
   - 中国古代文学史
   - 中国现当代文学
   - 外国文学常识
2. **阅读理解**（约占 30%）
   - 文言文阅读
   - 现代文阅读
3. **写作**（约占 40%）
   - 议论文写作
   - 记叙文/散文

📖 **必读篇目：**
- 《诗经》选篇
- 唐诗宋词代表作
- 鲁迅作品
- 朱自清散文

✍️ **作文技巧：**
- 开头要简洁有力
- 段落主题明确
- 善用引用和排比
- 结尾升华主题

需要我帮你梳理某个具体知识点吗？`,

    '作文': `**专升本英语作文万能模板：**

📌 **议论文结构：**

**开头段：**
\`\`\`
Recently, the issue of ______ has aroused widespread concern.
As for whether it is a blessing or a curse, different people hold different views.
\`\`\`

**主体段：**
\`\`\`
On the one hand, some people argue that ______.
The reasons are as follows. First, ______. Second, ______.
On the other hand, others believe that ______.
For instance, ______.
\`\`\`

**结尾段：**
\`\`\`
In my opinion, ______.
Only by ______ can we ______.
To conclude, ______.
\`\`\`

💡 **高分技巧：**
1. 适当使用高级词汇
2. 灵活运用复杂句式（定语从句、倒装句）
3. 注意逻辑连接词
4. 保持卷面整洁

✍️ **需要我帮你写一段范文吗？**`,

    '阅读': `**英语阅读理解高分技巧：**

🎯 **做题步骤：**

1️⃣ **先读题干，不读选项**
   - 圈出关键词（人名、时间、专有名词）
   - 判断题型（细节题/推断题/主旨题）

2️⃣ **带着问题读文章**
   - 重点关注首尾段和每段首句
   - 遇到关键词时标记位置

3️⃣ **排除法选答案**
   - ❌ 过于绝对（all, never, must）
   - ❌ 与原文不符
   - ❌ 无中生有
   - ✅ 同义替换

📊 **六大题型：**
| 题型 | 占比 | 难度 |
|------|------|------|
| 细节题 | 40% | ⭐⭐ |
| 推断题 | 25% | ⭐⭐⭐ |
| 主旨题 | 15% | ⭐⭐⭐ |
| 词义题 | 10% | ⭐⭐ |
| 态度题 | 5% | ⭐⭐⭐⭐ |
| 结构题 | 5% | ⭐⭐⭐ |

需要我找一篇文章带你实战练习吗？`
  };

  const defaultResponses = [
    '这是一个很好的问题！让我帮你梳理一下关键知识点。📚\n\n专升本考试中，这个知识点主要从以下几个方面考查：\n1. 基础概念的理解\n2. 在不同语境中的应用\n3. 与相关知识点的联系\n\n建议你先从教材例题入手，然后通过真题巩固。需要我更具体地讲解某个方面吗？',
    '针对你的问题，我建议分三步来学习：\n\n**第一步：理解概念**\n先搞清楚基本定义和原理，这是打基础。\n\n**第二步：掌握方法**\n学习解题思路和技巧，形成自己的方法论。\n\n**第三步：实战训练**\n通过做题检验掌握程度，查漏补缺。\n\n每天坚持 1-2 小时，半个月就能看到明显进步！💪',
    '这个问题在专升本考试中属于**高频考点**。🎯\n\n近 3 年真题统计显示，这个知识点的出现频率超过 80%。\n\n**备考建议：**\n- 先把教材例题做 3 遍\n- 再找近 5 年真题中的相关题目集中训练\n- 最后整理错题本，针对薄弱点反复练习\n\n需要我出一道例题帮你巩固一下吗？',
    '好问题！让我用最简单的方式解释给你听。😊\n\n可以把这个问题理解成一个"公式"：\n\n**核心逻辑：** A → B → C\n\n其中：\n- A 是已知条件\n- B 是解题关键步骤\n- C 是最终答案\n\n**记忆口诀：**\n"先看条件再找路，关键步骤别糊涂，\n公式定理要记牢，举一反三真功夫。"\n\n需要我带你做一道例题吗？',
    '我来帮你系统梳理一下这个知识点：\n\n📋 **知识框架：**\n┌─────────────────┐\n│  基本概念        │  ← 理解定义\n├─────────────────┤\n│  核心公式/定理   │  ← 记忆和应用\n├─────────────────┤\n│  常见题型       │  ← 解题方法\n├─────────────────┤\n│  易错点提醒     │  ← 避免踩坑\n├─────────────────┤\n│  真题实战       │  ← 检验成果\n└─────────────────┘\n\n每个环节都很重要，建议你按照这个框架来复习，效率最高！'
  ];

  let responseIndex = 0;

  // ── Utility ──
  function getNow() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function scrollToBottom() {
    setTimeout(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }, 50);
  }

  // ── Message rendering ──
  function addMessage(type, text) {
    const div = document.createElement('div');
    div.className = 'chat-msg chat-msg--' + type;

    const avatar = document.createElement('div');
    avatar.className = 'chat-msg__avatar';
    avatar.textContent = type === 'ai' ? 'AI' : '你';

    const content = document.createElement('div');
    content.className = 'chat-msg__content';

    const bubble = document.createElement('div');
    bubble.className = 'chat-msg__bubble';
    bubble.innerHTML = renderMarkdown(text);

    const time = document.createElement('div');
    time.className = 'chat-msg__time';
    time.textContent = getNow();

    content.appendChild(bubble);
    content.appendChild(time);
    div.appendChild(avatar);
    div.appendChild(content);
    messagesEl.appendChild(div);

    scrollToBottom();
    return div;
  }

  function addThinking() {
    const div = document.createElement('div');
    div.className = 'chat-msg chat-msg--ai chat-msg--thinking';
    div.id = 'thinkingMsg';

    const avatar = document.createElement('div');
    avatar.className = 'chat-msg__avatar';
    avatar.textContent = 'AI';

    const content = document.createElement('div');
    content.className = 'chat-msg__content';

    const bubble = document.createElement('div');
    bubble.className = 'chat-msg__bubble';
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('span');
      dot.className = 'thinking-dot';
      bubble.appendChild(dot);
    }

    content.appendChild(bubble);
    div.appendChild(avatar);
    div.appendChild(content);
    messagesEl.appendChild(div);

    scrollToBottom();
    return div;
  }

  function removeThinking() {
    const el = document.getElementById('thinkingMsg');
    if (el) el.remove();
  }

  // ── Simple markdown renderer ──
  function renderMarkdown(text) {
    // Code blocks
    text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    // Inline code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Line breaks
    text = text.replace(/\n/g, '<br>');
    return text;
  }

  // ── Response generation ──
  function findResponse(query) {
    const lower = query.toLowerCase();

    // Check knowledge base for keyword matches
    const keys = Object.keys(knowledgeBase);
    for (const key of keys) {
      if (lower.includes(key)) {
        return knowledgeBase[key];
      }
    }

    // Check for common question patterns
    if (lower.includes('how') || lower.includes('how to') || lower.includes('怎么') || lower.includes('如何')) {
      responseIndex = (responseIndex + 1) % defaultResponses.length;
      return defaultResponses[responseIndex];
    }

    if (lower.includes('what') || lower.includes('什么') || lower.includes('哪些') || lower.includes('哪些')) {
      return defaultResponses[0];
    }

    if (lower.includes('为什么') || lower.includes('why')) {
      return defaultResponses[2];
    }

    // Default
    responseIndex = (responseIndex + 1) % defaultResponses.length;
    return defaultResponses[responseIndex];
  }

  // ── Send message ──
  function sendMessage(text) {
    if (!text.trim()) return;

    // Add user message
    addMessage('user', text);
    chatInput.value = '';
    sendBtn.disabled = true;

    // Show thinking
    addThinking();

    // Simulate AI response delay
    const delay = 800 + Math.random() * 1200;
    setTimeout(() => {
      removeThinking();
      const reply = findResponse(text);
      addMessage('ai', reply);
      sendBtn.disabled = false;
      chatInput.focus();
    }, delay);
  }

  // ── Welcome message ──
  function showWelcome() {
    const div = document.createElement('div');
    div.className = 'welcome-msg';
    div.innerHTML = `
      <div class="welcome-msg__icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
        </svg>
      </div>
      <h2>你好！我是 AI 助教</h2>
      <p>我是你的专属学习伴侣，随时为你解答专升本备考中的任何问题！</p>
    `;
    messagesEl.appendChild(div);

    // Initial greeting
    setTimeout(() => {
      addMessage('ai', '你好呀！👋 我是辰泽教育的 AI 学习助教。\n\n你可以问我任何专升本备考的问题，比如：\n- 💬 "虚拟语气有哪些用法？"\n- 💬 "高数极限怎么求？"\n- 💬 "帮我分析这道英语阅读题"\n\n告诉我你想学什么，我们开始吧！🚀');
    }, 500);
  }

  // ── Event listeners ──
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage(chatInput.value);
  });

  chatInput.addEventListener('input', () => {
    sendBtn.disabled = !chatInput.value.trim();
  });

  // Suggested questions
  document.querySelectorAll('.ai-suggestion').forEach(btn => {
    btn.addEventListener('click', () => {
      sendMessage(btn.dataset.query);
    });
  });

  // ── Init ──
  showWelcome();
  chatInput.focus();

})();
