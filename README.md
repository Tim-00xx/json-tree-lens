# JSON Tree Lens

**English** | [简体中文](https://github.com/Tim-00xx/json-tree-lens/blob/main/README.zh-CN.md)

A tree viewer for JSON that inherits your VS Code color theme natively. It uses a clean, colon-free layout with breathing room between keys and values, never replaces VS Code's built-in JSON text editor, and lets you switch between tree and source with one click.

## Features

- **Native VS Code theming**
  - Follows your current light, dark, or high-contrast theme automatically — no manual toggle
  - Clear syntax coloring for keys, strings, and numbers/booleans/null; sans-serif font at `13.5px` with `1.65` line height
  - The default colon `:` after each key is hidden, leaving an `8px` breathing gap instead
  - Readable collection badges: `[] N items` / `[] 1 item`, `{} N keys` / `{} 1 key`
- **Fast interaction and switching**
  - Press `Ctrl+Alt+J` (`Cmd+Alt+J` on macOS) to toggle between the **source editor** and the **tree view**
  - Opens with the first 2 levels expanded; large arrays collapse automatically to keep the first paint fast
  - Minimal fixed toolbar: search with highlighting, **Expand All**, **Collapse All**, and **Back to Source**
  - Click a leaf key (or `Alt`-click any key) to copy its JSON Path (e.g. `cases[0].accept[0]`); the context menu copies the JSON Path, the node value, or the key name
  - Watches the document and refreshes live; on invalid JSON it shows the exact line, column, and error reason at the top instead of a blank screen

## Usage

1. Open any `.json` file in VS Code.
2. Press **`Ctrl+Alt+J`** (macOS: **`Cmd+Alt+J`**), or click the `$(list-tree)` icon in the editor title bar, to switch to the tree view.
3. Press **`Ctrl+Alt+J`** again, or click **Back to Source** in the toolbar / title bar, to return to the default text editor.
4. To change the shortcut, open VS Code Keyboard Shortcuts and search for `JSON Tree Lens`.

## Localization

- English (this page)
- [简体中文 / Chinese (Simplified)](https://github.com/Tim-00xx/json-tree-lens/blob/main/README.zh-CN.md)
