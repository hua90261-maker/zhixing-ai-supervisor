#!/usr/bin/env python3
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
EXT = ROOT / "extension"
manifest_path = EXT / "manifest.json"
errors = []

try:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
except Exception as exc:
    print(f"ERROR: manifest.json 无法解析: {exc}")
    sys.exit(1)

required = [
    "manifest.json", "background.js", "sidepanel.html", "sidepanel.css",
    "sidepanel.js", "analyzer.js", "privacy.html",
    "icons/icon16.png", "icons/icon32.png", "icons/icon48.png", "icons/icon128.png"
]
for item in required:
    if not (EXT / item).is_file():
        errors.append(f"缺少文件: extension/{item}")

if manifest.get("manifest_version") != 3:
    errors.append("manifest_version 必须为 3")

if manifest.get("version") != "0.1.1":
    errors.append("TASK-002 候选包的 manifest version 必须为 0.1.1")

if manifest.get("version_name") != "0.2.0-rc.1":
    errors.append("TASK-002 候选包的 manifest version_name 必须为 0.2.0-rc.1")

allowed_permissions = {"activeTab", "scripting", "sidePanel", "storage"}
permissions = set(manifest.get("permissions", []))
if permissions != allowed_permissions:
    errors.append(f"权限必须严格为 {sorted(allowed_permissions)}，当前为 {sorted(permissions)}")

if manifest.get("host_permissions"):
    errors.append("第一版不允许声明 host_permissions")

for path in EXT.rglob("*"):
    if path.is_file() and path.suffix.lower() in {".js", ".html", ".css", ".json"}:
        text = path.read_text(encoding="utf-8")
        if re.search(r"https?://", text) and path.name not in {"privacy.html"}:
            errors.append(f"发现潜在网络地址，请人工检查: {path.relative_to(ROOT)}")
        if "eval(" in text or "new Function(" in text:
            errors.append(f"不允许动态代码执行: {path.relative_to(ROOT)}")

sidepanel_html = (EXT / "sidepanel.html").read_text(encoding="utf-8")
sidepanel_js = (EXT / "sidepanel.js").read_text(encoding="utf-8")
html_ids = set(re.findall(r'\bid="([^"]+)"', sidepanel_html))
js_ids = set(re.findall(r'getElementById\("([^"]+)"\)', sidepanel_js))
missing_ids = sorted(js_ids - html_ids)
if missing_ids:
    errors.append(f"sidepanel.js 引用了不存在的页面元素: {', '.join(missing_ids)}")

quick_labels = ["1. 结论", "2. 直接证据", "3. 辅助信号", "4. 判断边界", "5. 下一项唯一动作"]
for label in quick_labels:
    if label not in sidepanel_html:
        errors.append(f"快速检查结果缺少固定段落: {label}")

if sidepanel_html.find('id="conversationInput"') > sidepanel_html.find('id="goalInput"'):
    errors.append("快速检查输入必须位于深入检查目标之前")

acceptance_test = ROOT / "tests" / "run_task001_acceptance.js"
if not acceptance_test.is_file():
    errors.append("缺少 TASK-001 自动验收脚本")
else:
    completed = subprocess.run(
        ["node", str(acceptance_test)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False
    )
    if completed.returncode:
        errors.append("TASK-001 自动验收失败:\n" + completed.stdout + completed.stderr)
    elif completed.stdout:
        print(completed.stdout.strip())

if errors:
    print("VALIDATION FAILED")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("VALIDATION PASSED")
print(f"- version: {manifest['version']}")
print(f"- version_name: {manifest['version_name']}")
print(f"- permissions: {', '.join(sorted(permissions))}")
print("- host_permissions: none")
print("- remote network code: not detected")
