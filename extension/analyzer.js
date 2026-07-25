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

  function excerpt(text, maxLength = 96) {
    const clean = normalize(text);
    return clean.length > maxLength ? `${clean.slice(0, maxLength)}…` : clean;
  }

  function parseMessages(text) {
    const messages = [];
    const pattern = /(?:^|\n)\s*(用户|AI|助手|已确认事实|已确认边界|新日志)\s*[：:]\s*/g;
    const matches = Array.from(String(text || "").matchAll(pattern));
    for (let index = 0; index < matches.length; index += 1) {
      const start = matches[index].index + matches[index][0].length;
      const end = index + 1 < matches.length ? matches[index + 1].index : String(text || "").length;
      const label = matches[index][1];
      messages.push({
        role: label === "AI" || label === "助手" ? "assistant" : label === "用户" ? "user" : "evidence",
        label,
        text: normalize(String(text || "").slice(start, end))
      });
    }
    return messages.filter((item) => item.text);
  }

  function auxiliarySignals(clean) {
    const signals = [];
    const conclusionEarly = CONCLUSION_PATTERNS.test(clean.slice(0, 240));
    const certaintyCount = countMatches(clean, CERTAINTY_PATTERNS);
    const evidenceCount = countMatches(clean, EVIDENCE_PATTERNS);
    const explanationCount = countMatches(clean, EXPLANATION_PATTERNS);
    const actionCount = countMatches(clean, ACTION_PATTERNS);
    const duplicateCount = duplicateParagraphs(clean).duplicates.length;

    if (!conclusionEarly && clean.length > 420) signals.push("内容较长，且结论没有出现在前部。");
    if (certaintyCount > evidenceCount && certaintyCount > 0) signals.push("确定性措辞多于可见证据词。");
    if (explanationCount >= Math.max(4, actionCount * 2 + 2)) signals.push("解释信号明显多于行动与验证信号。");
    if (duplicateCount > 0) signals.push(`存在 ${duplicateCount} 组高相似段落。`);
    if (clean.length > 3200 && actionCount < 3) signals.push("内容很长，但行动与现实结果信号较少。");
    return signals;
  }

  function findDirectConflicts(clean, messages) {
    const conflicts = [];
    const assistantText = messages
      .filter((item) => item.role === "assistant")
      .map((item) => item.text)
      .join("\n");
    const anchorText = messages
      .filter((item) => item.role !== "assistant")
      .map((item) => item.text)
      .join("\n");
    const anchorExcerpt = excerpt(anchorText, 120);
    const assistantExcerpt = excerpt(assistantText, 120);

    const noModify = /(只(?:做)?诊断|只(?:做)?检查|先不要|不得|禁止)[^。！？\n]{0,28}(修改|改动|更改|调整|删除|发布|提交)/.test(anchorText)
      || /不要[^。！？\n]{0,16}(修改|改动|更改|调整)/.test(anchorText);
    const claimsMutation = /(?:已经|已)[^。！？\n]{0,24}(修改|改好|改动|更改|调整|删除|发布|提交|升级)/.test(assistantText);
    if (noModify && claimsMutation) {
      conflicts.push({
        evidence: `可见限制：“${anchorExcerpt}”；AI 回应：“${assistantExcerpt}”。两者在是否允许修改上直接冲突。`,
        action: "停止后续操作，先核对真实配置、日志或文件差异；确认确有修改后，再按用户批准的方式回退。"
      });
    }

    const stopExpansion = /(不要继续扩展|不要扩展|先停|停止[^。！？\n]{0,12}(扩展|架构|设计)|不得扩展)/.test(anchorText);
    const continuesExpansion = /(继续[^。！？\n]{0,30}(扩展|拆分|设计|补充)|(?:十二|多个|\d+个)[^。！？\n]{0,18}模块|完整架构|分成[^。！？\n]{0,16}阶段)/.test(assistantText)
      && !/(停止|不再)[^。！？\n]{0,12}(扩展|继续)/.test(assistantText);
    if (stopExpansion && continuesExpansion) {
      conflicts.push({
        evidence: `可见停止要求：“${anchorExcerpt}”；AI 后续回应：“${assistantExcerpt}”。后续仍在增加模块、阶段或架构。`,
        action: "停止扩展，只用一句话复述当前目标并等待用户确认。"
      });
    }

    const forbidsNewTasks = /(不要|不得|禁止)[^。！？\n]{0,18}(提出|新增|增加)[^。！？\n]{0,10}任务/.test(anchorText);
    const addsNewTasks = /(新增|增加|提出)[^。！？\n]{0,12}(任务|开发项)|(?:立刻|马上)?升级版本/.test(assistantText);
    if (forbidsNewTasks && addsNewTasks) {
      conflicts.push({
        evidence: `可见范围限制：“${anchorExcerpt}”；AI 回应：“${assistantExcerpt}”。新增任务或升级建议违反该限制。`,
        action: "删除新增任务和升级建议，只在用户规定字数内回答指定内容。"
      });
    }

    const lengthLimit = anchorText.match(/(\d+)\s*字以内/);
    const claimedLength = assistantText.match(/(?:先用|使用|写了?|给出)\s*(\d+)\s*字/);
    if (lengthLimit && claimedLength && Number(claimedLength[1]) > Number(lengthLimit[1])) {
      conflicts.push({
        evidence: `可见长度限制为 ${lengthLimit[1]} 字以内；AI 回应声称使用 ${claimedLength[1]} 字，两者直接冲突。`,
        action: `只保留指定答案，并压缩到 ${lengthLimit[1]} 字以内。`
      });
    }

    const partialVerification = /(只|仅)[^。！？\n]{0,30}(验证|复测)|尚未[^。！？\n]{0,24}(验证|复测)|未[^。！？\n]{0,18}(验证|复测)/.test(anchorText);
    const claimsAllVerified = /(全部|所有)[^。！？\n]{0,24}(完成现实验证|验证完成|已经完成)|可以正式发布/.test(assistantText);
    if (partialVerification && claimsAllVerified) {
      conflicts.push({
        evidence: `可见验证范围：“${anchorExcerpt}”；AI 回应：“${assistantExcerpt}”。局部验证被扩大为全部验证完成或可正式发布。`,
        action: "把结论恢复到已验证的实际范围，并只列出下一项尚未真实复测的流程。"
      });
    }

    return conflicts;
  }

  function missingContext(clean, messages) {
    const assistantMessages = messages.filter((item) => item.role === "assistant");
    const anchorMessages = messages.filter((item) => item.role !== "assistant");

    if (!assistantMessages.length) {
      return "最少补充一段需要检查的 AI 回应。";
    }
    if (!anchorMessages.length) {
      return "最少补充该 AI 回应之前的一条用户任务、限制、反馈或已确认事实。";
    }

    const correctionIndex = messages.findIndex((item) =>
      item.role === "user"
      && /(不对|不是这个意思|先停(?:[，。！!]|$)|^停止[。！!]?$)/.test(item.text));
    if (correctionIndex >= 0) {
      const hasEarlierAssistant = messages.slice(0, correctionIndex).some((item) => item.role === "assistant");
      const laterAssistants = messages.slice(correctionIndex + 1).filter((item) => item.role === "assistant");
      if (!hasEarlierAssistant && laterAssistants.length <= 1) {
        return "最少补充纠错前的 AI 回应，以及 AI 答应停止后的下一条实际回应。";
      }
    }

    const asksComparison = /(?:哪个|哪一个)[^。！？\n]{0,20}(?:更好|更合适|更优|更稳|更值得)|选[^。！？\n]{1,20}还是[^。！？\n]{1,20}/i.test(clean);
    const hasCriteria = /(成本|价格|速度|时间|安全|效果|质量|风险|预算|评价标准|比较标准|数据)/.test(clean);
    if (asksComparison && !hasCriteria) {
      return "最少补充一个最重要的评价标准，以及两个方案在该标准上的已知信息。";
    }

    const userText = messages.filter((item) => item.role === "user").map((item) => item.text).join("\n");
    const unresolvedReference = /(这个|那个|它|刚才|照旧)/.test(userText)
      && messages.length <= 2
      && !/(目标|限制|事实|结果|日志|配置|方案)/.test(userText);
    if (unresolvedReference) {
      return "最少补充关键指代所指的原内容。";
    }

    return "";
  }

  function analyzeQuick(text) {
    const clean = normalize(text);
    const messages = parseMessages(text);
    const conflicts = findDirectConflicts(clean, messages);
    const auxiliaries = auxiliarySignals(clean);

    if (conflicts.length) {
      return {
        verdict: "偏航",
        directEvidence: conflicts.map((item) => item.evidence),
        auxiliarySignals: auxiliaries,
        boundary: "该结论只说明可见回应与可见任务锚点直接冲突；不证明 AI 自述的现实动作确实发生，也不判断输入外部事实真伪。",
        nextAction: conflicts[0].action
      };
    }

    const missing = missingContext(clean, messages);
    if (missing) {
      return {
        verdict: "上下文不足",
        directEvidence: ["当前片段缺少支持偏航或未偏航判断所必需的任务锚点、对话顺序或现实证据。"],
        auxiliarySignals: auxiliaries,
        boundary: "当前不能给出偏航等级，也不能认可完成、修复、发布或事实正确。",
        nextAction: missing
      };
    }

    const anchor = messages.find((item) => item.role !== "assistant");
    const response = messages.find((item) => item.role === "assistant");
    return {
      verdict: "未发现偏航证据",
      directEvidence: [
        `可见任务锚点：“${excerpt(anchor ? anchor.text : "")}”`,
        `AI 回应未与该锚点形成可识别的直接冲突：“${excerpt(response ? response.text : "")}”`
      ],
      auxiliarySignals: auxiliaries,
      boundary: "未发现偏航证据不等于事实完全正确、执行成功、项目完成或可以放心执行；仍需用现实结果复验。",
      nextAction: "继续按当前可见目标推进，并在产生下一项现实结果后核对一次。"
    };
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

  global.ZhixingAnalyzer = { analyze, analyzeQuick };
})(typeof window !== "undefined" ? window : globalThis);
