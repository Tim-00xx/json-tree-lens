# Changelog

All notable changes to **JSON Tree Lens** will be documented in this file.

## [1.0.1] - 2026-11-21

### Added
- Automatic English / Simplified Chinese UI localization in the tree view and status bar based on VS Code's display language (`vscode.env.language`).
- Platform-aware shortcut display (`Cmd+Alt+J` on macOS, `Ctrl+Alt+J` on Windows/Linux) in the toolbar.
- Visual demo GIF, Dark/Light theme comparison screenshots, and error diagnostics preview in the README.

### Changed
- Excluded `.vsix` build artifacts from Git tracking and kept large media assets out of packaged `.vsix` bundles.

## [1.0.0] - 2026-11-17

### Added
- Native VS Code theme-following JSON tree viewer (`CustomTextEditorProvider`) with colon-free layout and `8px` breathing room.
- One-click & keyboard shortcut (`Ctrl+Alt+J` / `Cmd+Alt+J`) switching between Source Editor and Tree View, plus Explorer context menu support.
- Real-time search with highlighting and auto-expansion of matching branches.
- Click leaf keys (or `Alt`-click any key) to copy JSON Path; right-click context menu to copy JSON Path, JSON value, plain text (unquoted), or key name.
- Live document sync with inline line/column syntax error diagnostics banner.
