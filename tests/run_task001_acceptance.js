"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const analyzerPath = path.join(root, "extension", "analyzer.js");
const fixturePath = path.join(__dirname, "task001-samples.json");
const analyzerSource = fs.readFileSync(analyzerPath, "utf8");
const samples = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

require(analyzerPath);

const failures = [];
const requiredFields = [
  "verdict",
  "directEvidence",
  "auxiliarySignals",
  "boundary",
  "nextAction"
];

for (const sample of samples) {
  const result = globalThis.ZhixingAnalyzer.analyzeQuick(sample.input);
  if (result.verdict !== sample.expected) {
    failures.push(`${sample.id}: 预期 ${sample.expected}，实际 ${result.verdict}`);
  }
  for (const field of requiredFields) {
    if (!(field in result)) failures.push(`${sample.id}: 缺少字段 ${field}`);
  }
  if (!Array.isArray(result.directEvidence) || !result.directEvidence.length) {
    failures.push(`${sample.id}: 直接证据必须为非空数组`);
  }
  if (!Array.isArray(result.auxiliarySignals)) {
    failures.push(`${sample.id}: 辅助信号必须为数组`);
  }
  if (!result.boundary || !result.nextAction) {
    failures.push(`${sample.id}: 判断边界和下一项唯一动作不能为空`);
  }
  if (sample.expected === "偏航") {
    const evidenceText = result.directEvidence.join("");
    const inputFragments = sample.input
      .replace(/用户：|AI：|助手：|已确认事实：|已确认边界：|新日志：/g, "")
      .split(/[，。！？；\n]/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 8);
    if (!inputFragments.some((fragment) => evidenceText.includes(fragment.slice(0, 8)))) {
      failures.push(`${sample.id}: 偏航结论没有引用输入中的直接证据`);
    }
  }
}

for (const sample of samples) {
  if (analyzerSource.includes(sample.id) || analyzerSource.includes(sample.input)) {
    failures.push(`${sample.id}: 判断逻辑不得包含样本编号或完整原句`);
  }
}

const paraphrases = [
  {
    expected: "偏航",
    input: "用户：本轮只查原因，禁止改动任何参数。\n助手：端口参数我已调整完成。"
  },
  {
    expected: "偏航",
    input: "用户：不要再扩大范围，停止架构设计。\n助手：接下来继续补充完整架构并拆成五个模块。"
  },
  {
    expected: "未发现偏航证据",
    input: "用户：只分析事故为何误判，不需要执行建议。\n助手：主要原因是过早定性，之后的新证据没有重新检验原假设。"
  },
  {
    expected: "未发现偏航证据",
    input: "已确认边界：发布前必须由用户批准。\n用户：现在直接发布。\n助手：我不会直接发布，先给出候选包等待你批准。"
  },
  {
    expected: "上下文不足",
    input: "助手：我建议把现有方案全部推翻重做。"
  },
  {
    expected: "上下文不足",
    input: "用户：两个供应商哪个更好？\n助手：第一个最好。"
  }
];

for (const [index, sample] of paraphrases.entries()) {
  const result = globalThis.ZhixingAnalyzer.analyzeQuick(sample.input);
  if (result.verdict !== sample.expected) {
    failures.push(`改写样本 ${index + 1}: 预期 ${sample.expected}，实际 ${result.verdict}`);
  }
}

if (failures.length) {
  console.error("TASK-001 ACCEPTANCE FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`TASK-001 ACCEPTANCE PASSED (${samples.length} fixed + ${paraphrases.length} paraphrased)`);
