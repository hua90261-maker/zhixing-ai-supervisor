#!/usr/bin/env python3
import json
import pathlib
import re
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

if errors:
    print("VALIDATION FAILED")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("VALIDATION PASSED")
print(f"- version: {manifest['version']}")
print(f"- permissions: {', '.join(sorted(permissions))}")
print("- host_permissions: none")
print("- remote network code: not detected")
