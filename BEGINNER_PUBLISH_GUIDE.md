# 从本机测试到 GitHub 与 Chrome 插件中心：纯新手步骤

这份手册按 Windows 新手编写。第一版已经打包好，不需要先安装编程工具即可测试和上传商店。

## 第一部分：先在自己的 Chrome 中安装测试

1. 解压完整项目包。
2. 打开 Chrome。
3. 在地址栏输入：

   ```text
   chrome://extensions
   ```

4. 打开页面右上角的“开发者模式”。
5. 点击左上角“加载已解压的扩展程序”。
6. 选择项目中的 `extension` 文件夹，不要选择 ZIP。
7. 安装成功后，把“知行”固定到浏览器工具栏。
8. 打开任意普通网页，拖动鼠标选择一段至少20字的文字。
9. 点击“知行”图标，侧栏会打开。
10. 点击“读取选中文字”，再填写目标和完成标准，点击“分析偏航”。

### 验收

必须确认：

- 侧栏能够正常打开；
- 只读取选中的文字；
- 刷新页面后目标和草稿仍在；
- “复制纠偏指令”可用；
- “导出本次记录”能下载 JSON；
- “删除全部数据”后内容确实消失；
- Chrome 扩展详情中没有“读取和更改所有网站上的数据”的永久权限。

## 第二部分：上架 GitHub

### 最简单方法：网页直接上传

1. 登录 GitHub。
2. 点击右上角 `+`，选择 `New repository`。
3. Repository name 填：

   ```text
   zhixing-ai-supervisor
   ```

4. Visibility 选择 `Public`。
5. 不要勾选自动创建 README，因为项目中已经有 README。
6. 点击 `Create repository`。
7. 在新仓库页面选择 `uploading an existing file`。
8. 把完整项目文件夹中的所有文件和文件夹拖入上传区域。
9. Commit message 填：

   ```text
   feat: initial local-first Chrome extension MVP
   ```

10. 点击 `Commit changes`。

> GitHub 网页一次上传大量嵌套文件有时不方便。若失败，改用 GitHub Desktop。

### 推荐方法：GitHub Desktop

1. 安装 GitHub Desktop 并登录。
2. 菜单选择 `File > Add local repository`。
3. 选中完整项目文件夹。
4. 若提示这不是 Git 仓库，选择创建仓库。
5. 左下角填写提交说明并点击 `Commit to main`。
6. 点击顶部 `Publish repository`。
7. 取消 `Keep this code private`，然后发布。

## 第三部分：开启 GitHub Pages 托管隐私政策

1. 打开 GitHub 仓库。
2. 点击 `Settings`。
3. 左侧点击 `Pages`。
4. Build and deployment 选择 `Deploy from a branch`。
5. Branch 选择 `main`，目录选择 `/docs`。
6. 点击 `Save`。
7. 等待 GitHub 显示站点地址。
8. 隐私政策通常是：

   ```text
   https://你的GitHub用户名.github.io/zhixing-ai-supervisor/privacy.html
   ```

9. 打开这个地址，确认可以访问。

发布前需要在以下文件中把 `YOUR_NAME` 和联系邮箱换成真实信息：

- `docs/index.html`
- `PRIVACY.md`
- `extension/privacy.html`
- `docs/privacy.html`

## 第四部分：注册 Chrome Web Store 开发者

1. 使用一个长期可用、经常检查的 Google 邮箱。
2. 进入 Chrome Web Store Developer Dashboard。
3. 接受开发者协议。
4. 支付页面显示的一次性注册费用。
5. 完成开发者资料和需要的身份/付款资料验证。

## 第五部分：上传插件

1. 在 Developer Dashboard 点击 `Add new item`。
2. 上传：

   ```text
   dist/zhixing-ai-supervisor-v0.1.0.zip
   ```

3. 不要把完整项目 ZIP 上传商店；商店只上传 `dist` 中的插件 ZIP。
4. 如果后台提示 manifest 错误，不要重新压缩文件夹。先确认 ZIP 打开后第一层直接看到 `manifest.json`。

## 第六部分：填写商店资料

### Store listing

从 `store/listing-zh-CN.md` 复制：

- 名称
- 简短说明
- 详细说明
- 类别

上传：

- `store/screenshots/screenshot-1-1280x800.png`
- `store/screenshots/screenshot-2-1280x800.png`
- `store/promo/small-promo-440x280.png`

### Privacy practices

单一用途、权限解释、数据披露的可复制内容都在：

```text
STORE_SUBMISSION.md
```

重点：

- 远程代码选择 No；
- 如实披露会处理用户主动选择的网页文字；
- 明确说明只在本地处理，不传给开发者；
- 隐私政策填 GitHub Pages 地址；
- 不要声称“完全不处理用户数据”，因为插件确实在本地处理用户选中的文字。

### Test instructions

复制 `store/REVIEWER_NOTES.txt` 中的测试步骤。

## 第七部分：提交审核

1. 再检查名称、截图、隐私政策和权限解释。
2. 点击 `Submit for Review`。
3. 首次建议选择延迟发布：审核通过后先由自己检查商店页面，再手动发布。
4. 查看开发者邮箱和 Dashboard 状态。
5. 如被拒绝，先阅读具体违规项，只修复对应问题，不要随意增加权限。

## 我无法替你完成的外部动作

我可以生成和修改代码、上架包、文案与步骤，但不能替你登录 GitHub/Google 账号、支付注册费、完成身份验证或点击最终提交。这些动作必须由账号所有者亲自完成。
