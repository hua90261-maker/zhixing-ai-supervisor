# 知行 · AI认知监督台

> 工作名。一个本地优先的 Chrome 侧边栏扩展，用于监督 AI 对话中的方向、证据、反馈、重复与停止条件。

## 当前版本

`v0.1.0` 是一个可安装、可测试的本地 MVP。它不会连接开发者服务器，也不会自动读取整页或发送消息。

### 已实现

- Chrome Manifest V3 侧边栏
- 用户主动读取当前选中的网页文字
- 本地保存目标、完成标准、草稿与检查点
- 规则型偏航分析：
  - 未先给结论
  - 纠错反馈未被优先处理
  - 解释明显多于执行与验证
  - 确定性措辞多于证据
  - 高相似内容重复
  - 事实与假设边界不清
- 生成可复制的纠偏指令
- JSON 导出与一键删除全部本地数据
- 完整隐私说明、商店文案和上架素材

## 本地安装测试

1. 下载或克隆本仓库。
2. 打开 Chrome，在地址栏输入 `chrome://extensions`。
3. 打开右上角“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择本仓库中的 `extension` 文件夹。
6. 在任意网页选择一段文字，点击工具栏中的“知行”图标打开侧栏。
7. 点击“读取选中文字”，填写当前目标和完成标准，然后点击“分析偏航”。

> Chrome Side Panel API 需要 Chrome 114 或更高版本。

## 项目结构

```text
extension/          可直接加载与打包的插件源码
  manifest.json
  background.js
  sidepanel.*
  analyzer.js
  privacy.html
  icons/
docs/               GitHub Pages 首页与隐私政策
store/              Chrome Web Store 文案、截图与宣传图
scripts/            校验与打包脚本
.github/workflows/  GitHub Actions 自动校验与生成 ZIP
```

## 校验与打包

```bash
python scripts/validate.py
python scripts/package_extension.py
```

生成的商店上传包位于：

```text
dist/zhixing-ai-supervisor-v0.1.0.zip
```

ZIP 根目录直接包含 `manifest.json`，可上传 Chrome Web Store。

## 安全设计

- 无 `host_permissions`
- 不申请读取所有网站
- `activeTab` 只在用户主动调用时临时授权
- 只读取用户明确选中的文字
- 无远程代码
- 无网络请求
- 无账号与云端存储
- 无自动发送、点击或执行能力
- 用户可以查看、导出与删除本地数据

详见 [PRIVACY.md](PRIVACY.md) 与 [SECURITY.md](SECURITY.md)。

## GitHub 发布

新手建议使用 GitHub Desktop：

1. 在 GitHub 创建空仓库，例如 `zhixing-ai-supervisor`。
2. 在 GitHub Desktop 中选择 **Add existing repository**，选中本项目文件夹。
3. 点击 **Publish repository**。
4. 在仓库设置中开启 GitHub Pages，来源选择 `main` 分支的 `/docs` 文件夹。
5. 获得公开隐私政策地址后，填入 Chrome Web Store 开发者后台。

命令行方式：

```bash
git init
git add .
git commit -m "feat: initial local-first Chrome extension MVP"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/zhixing-ai-supervisor.git
git push -u origin main
```

## Chrome Web Store 上架

详见 [STORE_SUBMISSION.md](STORE_SUBMISSION.md)。

## 路线边界

第一版只验证：它是否能帮助深度 AI 用户更早发现偏航，并用更低成本重新固定目标、证据和下一步。

第一版不做：云端 AI 审查、多模型自动调度、整页持续监控、自动发送、自动执行、自我修改规则。

## 许可证

MIT
