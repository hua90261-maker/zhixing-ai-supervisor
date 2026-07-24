#!/usr/bin/env python3
import json
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
EXT = ROOT / "extension"
DIST = ROOT / "dist"
manifest = json.loads((EXT / "manifest.json").read_text(encoding="utf-8"))
version = manifest["version"]
output = DIST / f"zhixing-ai-supervisor-v{version}.zip"
DIST.mkdir(exist_ok=True)

with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(EXT.rglob("*")):
        if path.is_file():
            archive.write(path, path.relative_to(EXT))

print(output)
