#!/usr/bin/env python3
import json
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
EXT = ROOT / "extension"
DIST = ROOT / "dist"
manifest = json.loads((EXT / "manifest.json").read_text(encoding="utf-8"))
version = manifest.get("version_name", manifest["version"])
output = DIST / f"zhixing-ai-supervisor-v{version}.zip"
DIST.mkdir(exist_ok=True)

for stale_package in DIST.glob("zhixing-ai-supervisor-v*.zip"):
    stale_package.unlink()

with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(EXT.rglob("*")):
        if path.is_file():
            archive.write(path, path.relative_to(EXT))

packages = sorted(path.name for path in DIST.glob("zhixing-ai-supervisor-v*.zip"))
if packages != [output.name]:
    raise RuntimeError(f"构建输出身份不唯一: {packages}")

print(output)
