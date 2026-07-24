(() => {
  "use strict";

  const STORAGE_KEY = "zhixingSupervisorStateV1";
  const isExtension = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;

  const els = {
    goal: document.getElementById("goalInput"),
    success: document.getElementById("successInput"),
    input: document.getElementById("conversationInput"),
    charCount: document.getElementById("charCount"),
    status: document.getElementById("statusMessage"),
    resultSection: document.getElementById("resultSection"),
    conclusion: document.getElementById("resultConclusion"),
    risk: document.getElementById("riskBadge"),
    mainIssue: document.getElementById("mainIssue"),
    progressState: document.getElementById("progressState"),
    actionGate: document.getElementById("actionGate"),
    facts: document.getElementById("factList"),
    assumptions: document.getElementById("assumptionList"),
    signals: document.getElementById("signalList"),
    nextAction: document.getElementById("nextAction"),
    prompt: document.getElementById("promptOutput"),
    history: document.getElementById("historyList")
  };

  let state = {
    goal: "",
    success: "",
    draft: "",
    lastAnalysis: null,
    checkpoints: []
  };

  async function storageGet() {
    if (isExtension) {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      return result[STORAGE_KEY] || null;
    }
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (_) { return null; }
  }

  async function storageSet(value) {
    if (isExtension) return chrome.storage.local.set({ [STORAGE_KEY]: value });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }

  async function storageClear() {
    if (isExtension) return chrome.storage.local.remove(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  }

  function setStatus(message, kind = "neutral") {
    els.status.textContent = message;
    els.status.style.color = kind === "error" ? "#a33a37" : kind === "success" ? "#315c49" : "#6b7280";
  }

  function updateCharCount() {
    els.charCount.textContent = `${els.input.value.length} 字`;
  }

  function syncStateFromInputs() {
    state.goal = els.goal.value.trim();
    state.success = els.success.value.trim();
    state.draft = els.input.value;
  }

  let saveTimer;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      syncStateFromInputs();
      await storageSet(state);
    }, 250);
  }

  function listItems(element, items, emptyText) {
    element.innerHTML = "";
    if (!items.length) {
      const li = document.createElement("li");
      li.className = "empty-inline";
      li.textContent = emptyText;
      element.appendChild(li);
      return;
    }
    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      element.appendChild(li);
    });
  }

  function renderAnalysis(result) {
    els.resultSection.classList.remove("hidden");
    els.conclusion.textContent = result.conclusion;
    els.risk.textContent = result.risk === "high" ? "高风险" : result.risk === "medium" ? "中风险" : "低风险";
    els.risk.className = `risk-badge risk-${result.risk}`;
    els.mainIssue.textContent = result.mainIssue;
    els.progressState.textContent = result.progressState;
    els.actionGate.textContent = result.gate;
    els.nextAction.textContent = result.nextAction;
    els.prompt.value = result.prompt;
    listItems(els.facts, result.facts, "没有自动识别到可靠事实，请人工补充直接证据。");
    listItems(els.assumptions, result.assumptions, "没有自动识别到显式假设，仍需检查隐藏前提。");
    listItems(els.signals, result.signals, "未发现明显偏航信号。");
  }

  function renderHistory() {
    els.history.innerHTML = "";
    if (!state.checkpoints.length) {
      const p = document.createElement("p");
      p.className = "empty-state";
      p.textContent = "还没有保存的检查点。";
      els.history.appendChild(p);
      return;
    }
    state.checkpoints.slice(0, 8).forEach((item) => {
      const div = document.createElement("div");
      div.className = "history-item";
      const title = document.createElement("strong");
      title.textContent = item.goal || "未命名任务";
      const meta = document.createElement("span");
      meta.textContent = `${new Date(item.createdAt).toLocaleString()} · ${item.riskLabel || "未分析"}`;
      div.append(title, meta);
      els.history.appendChild(div);
    });
  }

  function runAnalysis() {
    syncStateFromInputs();
    if (state.draft.trim().length < 20) {
      setStatus("请先粘贴或读取一段需要监督的内容。", "error");
      return;
    }
    const result = window.ZhixingAnalyzer.analyze(state.draft, { goal: state.goal, success: state.success });
    state.lastAnalysis = result;
    renderAnalysis(result);
    storageSet(state);
    setStatus("分析完成。结果仅基于本地规则，需要用现实证据复验。", "success");
    els.resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function readSelection() {
    if (!isExtension) {
      setStatus("网页预览模式无法读取其他页面，请在Chrome扩展中使用。", "error");
      return;
    }
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) throw new Error("找不到当前标签页");
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => String(window.getSelection ? window.getSelection().toString() : "")
      });
      const selected = results && results[0] ? results[0].result : "";
      if (!selected || !selected.trim()) {
        setStatus("当前页面没有选中文字。请先拖动鼠标选择一段对话，再点击读取。", "error");
        return;
      }
      els.input.value = selected.trim();
      updateCharCount();
      scheduleSave();
      setStatus(`已读取 ${selected.trim().length} 字；未读取页面其他内容。`, "success");
    } catch (error) {
      setStatus(`读取失败：${error.message || "当前页面不允许扩展访问"}`, "error");
    }
  }

  async function saveCheckpoint() {
    syncStateFromInputs();
    if (!state.goal && !state.draft) {
      setStatus("当前没有可保存的目标或内容。", "error");
      return;
    }
    state.checkpoints.unshift({
      createdAt: new Date().toISOString(),
      goal: state.goal,
      success: state.success,
      draftExcerpt: state.draft.slice(0, 500),
      risk: state.lastAnalysis ? state.lastAnalysis.risk : null,
      riskLabel: state.lastAnalysis
        ? state.lastAnalysis.risk === "high" ? "高风险" : state.lastAnalysis.risk === "medium" ? "中风险" : "低风险"
        : "未分析"
    });
    state.checkpoints = state.checkpoints.slice(0, 30);
    await storageSet(state);
    renderHistory();
    setStatus("检查点已保存在本机浏览器中。", "success");
  }

  async function copyPrompt() {
    if (!els.prompt.value) return;
    await navigator.clipboard.writeText(els.prompt.value);
    setStatus("纠偏指令已复制。由你决定是否发送给当前AI。", "success");
  }

  function downloadJson() {
    syncStateFromInputs();
    const payload = {
      exportedAt: new Date().toISOString(),
      product: "知行 · AI认知监督台",
      version: "0.1.0",
      goal: state.goal,
      successCriteria: state.success,
      sourceText: state.draft,
      analysis: state.lastAnalysis
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zhixing-check-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAll() {
    const confirmed = window.confirm("确定删除本插件在当前浏览器中保存的全部目标、草稿、分析和检查点吗？此操作不可撤销。");
    if (!confirmed) return;
    await storageClear();
    state = { goal: "", success: "", draft: "", lastAnalysis: null, checkpoints: [] };
    els.goal.value = "";
    els.success.value = "";
    els.input.value = "";
    els.resultSection.classList.add("hidden");
    updateCharCount();
    renderHistory();
    setStatus("本地数据已全部删除。", "success");
  }

  function loadDemoIfRequested() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("demo")) return false;
    els.goal.value = "把AI认知监督工具做成可安装的浏览器插件";
    els.success.value = "形成可安装、可测试、能生成纠偏指令的本地MVP";
    els.input.value = "用户：先不要继续扩展，我们先把插件第一版真正做出来。\n\nAI：这个产品可以发展为一个宏大的多模型认知操作系统。首先我们可以建立十二个模块，然后继续补充完整知识库。因为多元模型非常重要，所以应该先设计整体架构。换句话说，我们需要继续讨论更多模型。\n\n用户：不是这个意思。你一直在解释，却没有生成任何可以安装的文件。先停下来，直接给结论和当前唯一要做的动作。\n\nAI：我理解你的反馈。本质上，这仍然说明我们需要一个更完整的系统框架，因此可以再从三个层次继续展开。";
    updateCharCount();
    runAnalysis();
    return true;
  }

  async function init() {
    const stored = await storageGet();
    if (stored) state = { ...state, ...stored, checkpoints: Array.isArray(stored.checkpoints) ? stored.checkpoints : [] };
    els.goal.value = state.goal || "";
    els.success.value = state.success || "";
    els.input.value = state.draft || "";
    updateCharCount();
    renderHistory();
    if (state.lastAnalysis) renderAnalysis(state.lastAnalysis);
    loadDemoIfRequested();
  }

  els.goal.addEventListener("input", scheduleSave);
  els.success.addEventListener("input", scheduleSave);
  els.input.addEventListener("input", () => { updateCharCount(); scheduleSave(); });
  document.getElementById("readSelectionBtn").addEventListener("click", readSelection);
  document.getElementById("analyzeBtn").addEventListener("click", runAnalysis);
  document.getElementById("clearBtn").addEventListener("click", () => {
    els.input.value = "";
    state.draft = "";
    updateCharCount();
    scheduleSave();
    setStatus("输入已清空，已保存的检查点不受影响。");
  });
  document.getElementById("saveCheckpointBtn").addEventListener("click", saveCheckpoint);
  document.getElementById("copyPromptBtn").addEventListener("click", copyPrompt);
  document.getElementById("exportBtn").addEventListener("click", downloadJson);
  document.getElementById("deleteAllBtn").addEventListener("click", deleteAll);

  init();
})();
