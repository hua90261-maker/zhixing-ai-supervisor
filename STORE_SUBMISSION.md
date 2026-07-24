# Chrome Web Store 上架清单

## 1. 上架前必须替换

- 项目维护者名称
- 支持邮箱
- GitHub 仓库地址
- GitHub Pages 隐私政策地址
- 商店支持网址

## 2. 注册开发者

使用专门的发布邮箱注册 Chrome Web Store 开发者账号，接受协议并支付一次性注册费用。完成账号资料与必要验证。

## 3. 上传包

上传：

```text
dist/zhixing-ai-supervisor-v0.1.0.zip
```

ZIP 根目录必须直接包含 `manifest.json`。

## 4. Single purpose / 单一用途

> 在用户设备本地检查用户主动提供的AI对话文本中的目标偏移、反馈遗漏、证据不足与重复表达，并生成由用户自行决定是否使用的纠偏指令。

## 5. 权限解释

### activeTab

仅在用户主动点击扩展后，为读取当前标签页中由用户明确选中的文字提供临时访问；不会持续访问网页，也不会读取未选中的内容。

### scripting

仅向当前临时授权的标签页注入一个最小函数，用于调用 `window.getSelection().toString()` 读取用户当前选择的文字。

### sidePanel

用于在Chrome侧边栏展示扩展的监督界面，使用户无需离开当前AI网页。

### storage

用于在用户设备本地保存用户主动填写的目标、完成标准、草稿、分析结果与检查点。数据不发送到开发者服务器。

## 6. 远程代码

选择：**No, I am not using remote code.**

扩展不加载CDN脚本、远程JavaScript、WebAssembly或动态执行的服务器代码。

## 7. 数据披露建议

如开发者后台要求披露“网站内容”，应如实选择，因为扩展在用户主动操作后处理用户选中的网页文本。同时说明：

- 只读取用户明确选中的文字；
- 数据仅在设备本地处理和保存；
- 不向开发者或第三方传输；
- 不用于广告、画像或销售。

后台字段会随Chrome Web Store调整，必须按照实际行为如实填写，不能因为“不上传”就隐瞒本地处理。

## 8. 隐私政策地址

开启GitHub Pages后，使用：

```text
https://YOUR_NAME.github.io/zhixing-ai-supervisor/privacy.html
```

## 9. 商店文案

见 `store/listing-zh-CN.md`。

## 10. 图片

- 128×128 插件图标：`extension/icons/icon128.png`
- 440×280 小型宣传图：`store/promo/small-promo-440x280.png`
- 1280×800 截图：`store/screenshots/screenshot-1-1280x800.png`

## 11. 测试说明

1. 安装扩展。
2. 打开任意普通网页或AI对话网页。
3. 选择一段至少20字的文字。
4. 点击工具栏中的扩展图标打开侧栏。
5. 点击“读取选中文字”。
6. 输入目标与完成标准。
7. 点击“分析偏航”。
8. 可复制纠偏指令、保存检查点、导出记录或删除全部本地数据。

无需测试账号或凭证。

## 12. 发布策略

首次提交建议使用 deferred publishing：审核通过后先手动检查商店页面，再由开发者主动发布。
