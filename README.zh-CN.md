# JSON Tree Lens

[English](https://github.com/Tim-00xx/json-tree-lens/blob/main/README.md) | **简体中文**

原生跟随 VS Code 配色主题的树形 JSON 阅读器，采用清晰无冒号的呼吸间距排版，不覆盖 VS Code 默认 JSON 文本编辑器，支持标题栏按钮与快捷键一键切换。

## 功能特性

- **原生跟随 VS Code 主题配色**：
  - 自动适配当前 VS Code 的浅色、深色与高对比度主题（无需手动切换）
  - 清晰的键名、字符串、数字/布尔/null 语法高亮，无衬线字体 (`13.5px`，行高 `1.65`)
  - 隐藏键名后默认冒号 `:`，保留 `8px` 呼吸间距
  - 清晰统计标签：`[] N items` / `[] 1 item`、`{} N keys` / `{} 1 key`
- **快捷交互与切换**：
  - 支持默认快捷键 `Ctrl+Alt+J`（macOS 为 `Cmd+Alt+J`）在**源码编辑器**与**树形视图**之间来回切换
  - 默认展开前 2 层，大数组自动折叠避免卡顿
  - 顶部极简固定工具栏：搜索定位与高亮、全部展开、全部折叠、切换回源码
  - 点击叶子键名（或 Alt+点击任意键名）复制 JSON Path（如 `cases[0].accept[0]`）；右键菜单支持复制 JSON Path、节点值与键名
  - 实时监听文档修改并同步刷新；JSON 语法出错时在顶部展示精确行号、列号与错误原因提示，不白屏

## 使用方法

1. 在 VS Code 中打开任意 `.json` 文件。
2. 按 **`Ctrl+Alt+J`**（macOS：**`Cmd+Alt+J`**），或点击编辑器右上角标题栏的 `$(list-tree)` 图标切换到树形视图。
3. 再次按 **`Ctrl+Alt+J`**（macOS：**`Cmd+Alt+J`**），或点击顶部工具栏 / 标题栏的 **切换回源码** 按钮，即可切回默认源码编辑器。
4. 如需自定义快捷键，可在 VS Code 键盘快捷方式中搜索 `JSON Tree Lens`。
