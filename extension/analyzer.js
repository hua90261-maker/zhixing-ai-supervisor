(function (global) {
  "use strict";

  const FEEDBACK_PATTERNS = [
    /不是这个意思/g, /不对/g, /没有回应/g, /没回应/g, /别扩展/g,
    /不要继续/g, /先停/g, /停止/g, /跑偏/g, /偏了/g, /废话/g,
    /先给结论/g, /东扯西扯/g, /忘记/g, /没有推进/g
  ];
  const ASSUMPTION_PATTERNS = /(可能|也许|或许|推测|猜测|大概|似乎|看起来|应该是|我认为|倾向于)/;
  const FACT_PATTERNS = /(已确认|实际|日志|测试|结果|数据显示|用户明确|已经完成|已完成|运行成功|验证通过|现实中)/;
  const CERTAINTY_PATTERNS = /(一定是|肯定是|必然|毫无疑问|就是因为|确定是|显然)/g;
  const EVIDENCE_PATTERNS = /(证据|日志|测试|数据|来源|结果|复现|截图|实际|验证)/g;
  const EXPLANATION_PATTERNS = /(因为|所以|本质上|换句话说|也就是说|这意味着|原因是|从.*角度|可以理解为)/g;
  const ACTION_PATTERNS = /(执行|完成|测试|验证|部署|提交|安装|运行|修复|上线|交付|生成文件|创建项目|实际结果|复验)/g;
  const CONCLUSION_PATTERNS = /(结论|先说结论|当前判断|建议是|下一步|应该先|必须先)/;

  function normalize(text) {
    return String(text || "").replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
  }

  function splitSentences(text) {
    return normalize(text)
      .split(/(?<=[。！？!?；;\n])/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 6);
  }

  function countMatches(text, pattern) {
    const matches = text.match(pattern);
    return matches ? matches.length : 0;
  }

  function tokenize(text) {
    return new Set(normalize(text).toLowerCase().replace(/[，。！？、；：,.!?;:\-—()（）\[\]【】"“”'‘’]/g, " ").split(/\s+/).filter(Boolean));
  }

  function jaccard(a, b) {
    const A = tokenize(a);
    const B = tokenize(b);
    if (!A.size || !B.size) return 0;
    let intersection = 0;
    A.forEach((item) => { if (B.has(item)) intersection += 1; });
    return intersection / (A.size + B.size - intersection);
  }

  function duplicateParagraphs(text) {
    const paragraphs = normalize(text).split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length >= 35);
    const duplicates = [];
    for (let i = 0; i < paragraphs.length; i += 1) {
      for (let j = i + 1; j < paragraphs.length; j += 1) {
        const score = jaccard(paragraphs[i], paragraphs[j]);
        if (score >= 0.58) duplicates.push({ i, j, score });
      }
    }
    return { paragraphs, duplicates };
  }

  function extractEvidence(sentences) {
    const facts = [];
    const assumptions = [];
    for (const sentence of sentences) {
      if (ASSUMPTION_PATTERNS.test(sentence)) {
        assumptions.push(sentence);
      } else if (FACT_PATTERNS.test(sentence)) {
        facts.push(sentence);
      }
      if (facts.length >= 5 && assumptions.length >= 5) break;
    }
    return { facts: facts.slice(0, 5), assumptions: assumptions.slice(0, 5) };
  }

  function analyze(text, context) {
    const clean = normalize(text);
    const goal = normalize(context && context.goal);
    const success = normalize(context && context.success);
    const sentences = splitSentences(clean);
    const firstBlock = clean.slice(0, 240);
    const feedbackCount = FEEDBACK_PATTERNS.reduce((sum, regex) => sum + countMatches(clean, regex), 0);
    const certaintyCount = countMatches(clean, CERTAINTY_PATTERNS);
    const evidenceCount = countMatches(clean, EVIDENCE_PATTERNS);
    const explanationCount = countMatches(clean, EXPLANATION_PATTERNS);
    const actionCount = countMatches(clean, ACTION_PATTERNS);
    const conclusionEarly = CONCLUSION_PATTERNS.test(firstBlock);
    const dup = duplicateParagraphs(clean);
    const evidence = extractEvidence(sentences);

    let score = 0;
    const signals = [];

    if (!goal) {
      score += 2;
      signals.push("没有固定当前目标，后续内容容易把讨论方向替换成新的问题。");
    }
    if (!success) {
      score += 1;
      signals.push("没有完成标准，无法判断解释、动作与现实结果之间的差距。");
    }
    if (!conclusionEarly && clean.length > 420) {
      score += 2;
      signals.push("较长内容没有先给出明确结论，用户需要自行寻找答案。");
    }
    if (feedbackCount > 0) {
      score += Math.min(3, feedbackCount);
      signals.push(`检测到 ${feedbackCount} 个纠错或停止反馈，应优先回应反馈，而不是继续扩展原方向。`);
    }
    if (certaintyCount > evidenceCount && certaintyCount > 0) {
      score += 2;
      signals.push("确定性措辞多于可见证据，存在把判断升级为事实的风险。");
    }
    if (explanationCount >= Math.max(4, actionCount * 2 + 2)) {
      score += 2;
      signals.push("解释信号明显多于执行与验证信号，可能出现“解释替代推进”。");
    }
    if (dup.duplicates.length > 0) {
      score += Math.min(2, dup.duplicates.length);
      signals.push(`检测到 ${dup.duplicates.length} 组高相似段落，可能存在重复包装而非信息增量。`);
    }
    if (clean.length > 3200 && actionCount < 3) {
      score += 1;
      signals.push("内容很长但行动与现实结果较少，建议压缩到当前唯一优先动作。");
    }
    if (evidence.assumptions.length > evidence.facts.length + 2) {
      score += 1;
      signals.push("可识别的假设明显多于事实，当前不适合做不可逆决定。");
    }
    if (!signals.length) signals.push("未发现明显结构性偏航，但仍需用现实结果复验当前判断。");

    let risk = "low";
    if (score >= 6) risk = "high";
    else if (score >= 3) risk = "medium";

    let conclusion = "可以继续，但必须用现实结果复验";
    let gate = "允许最小、可逆的下一步";
    let nextAction = "明确下一项能够产生现实结果的动作，并在动作后记录结果。";
    let mainIssue = "缺少现实复验";

    if (risk === "high") {
      conclusion = "建议暂停扩展，先重建目标与证据";
      gate = "暂停新增动作；仅允许补证据或回退";
      nextAction = "先用一句话确认当前主要问题，再找出支撑后续工作的第一个未验证承重假设。";
      mainIssue = feedbackCount ? "纠错反馈未被优先处理" : "方向与证据失去约束";
    } else if (risk === "medium") {
      conclusion = "方向可能偏移，先做一次最小校正";
      gate = "只允许低成本、可逆测试";
      nextAction = !goal
        ? "补写当前唯一目标与完成标准，然后重新分析。"
        : "把当前结论拆成事实、假设和缺失证据，再选择一个最小测试。";
      mainIssue = explanationCount > actionCount * 2 ? "解释多于现实推进" : "假设与事实边界不清";
    } else if (!conclusionEarly && clean.length > 420) {
      mainIssue = "结论位置不清晰";
    }

    const progressState = actionCount === 0
      ? "未发现明确执行或验证结果"
      : actionCount <= 2
        ? "存在少量行动信号，需确认结果"
        : "存在行动记录，仍需验收是否真实通过";

    const prompt = buildPrompt({
      goal,
      success,
      conclusion,
      mainIssue,
      gate,
      nextAction,
      signals: signals.slice(0, 5)
    });

    return {
      score,
      risk,
      conclusion,
      gate,
      nextAction,
      mainIssue,
      progressState,
      signals,
      facts: evidence.facts,
      assumptions: evidence.assumptions,
      prompt,
      metrics: {
        length: clean.length,
        feedbackCount,
        certaintyCount,
        evidenceCount,
        explanationCount,
        actionCount,
        duplicatePairs: dup.duplicates.length
      }
    };
  }

  function buildPrompt(data) {
    const signalLines = data.signals.map((item, index) => `${index + 1}. ${item}`).join("\n");
    return [
      "暂停继续扩展，先按以下监督要求处理当前任务。",
      "",
      `当前目标：${data.goal || "尚未确认，请先向用户复述并确认。"}`,
      `完成标准：${data.success || "尚未确认，不得自行宣布完成。"}`,
      `当前主要问题：${data.mainIssue}`,
      `当前行动闸门：${data.gate}`,
      "",
      "请按顺序回答：",
      "1. 第一行直接给出当前结论，不写铺垫。",
      "2. 分开列出已确认事实、待验证假设、缺失证据。",
      "3. 指出支撑后续工作的第一个未经验证的承重假设。",
      "4. 说明本轮实际推进了什么；如果只有解释，明确写“尚未推进”。",
      `5. 下一步只做这一项：${data.nextAction}`,
      "6. 说明什么结果出现时必须停止、回退或改变判断。",
      "",
      "本次检测到的风险：",
      signalLines,
      "",
      "限制：不要新增模块，不重复已有观点，不把建议、文档或动作数量当成完成结果。"
    ].join("\n");
  }

  global.ZhixingAnalyzer = { analyze };
})(typeof window !== "undefined" ? window : globalThis);
