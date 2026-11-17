import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { JSONTree } from 'react-json-tree';
import type {
  GetItemString,
  KeyPath,
  LabelRenderer,
  ShouldExpandNodeInitially,
  ValueRenderer,
} from 'react-json-tree';
import type { Base16Theme, StylingConfig } from 'react-base16-styling';

type ExpandMode = 'default' | 'all' | 'none';

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState<T = unknown>(): T | undefined;
  setState<T = unknown>(state: T): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

interface ExtensionUpdateMessage {
  type: 'update';
  text: string;
  fileName?: string;
  isDirty?: boolean;
}

interface JsonSyntaxErrorInfo {
  message: string;
  line: number;
  column: number;
  snippet: string;
}

interface ContextMenuState {
  x: number;
  y: number;
  jsonPath: string;
  keyName: string;
  nodeValue: unknown;
}

const vscodeApi: VsCodeApi | null = (() => {
  try {
    if (typeof acquireVsCodeApi === 'function') {
      return acquireVsCodeApi();
    }
  } catch {
    // Fallback when rendered outside VS Code webview
  }
  return null;
})();

const VSCODE_ADAPTIVE_BASE16: Base16Theme = {
  scheme: 'VS Code Adaptive',
  author: 'JSON Tree Lens',
  base00: '#1e1e1e',
  base01: '#252526',
  base02: '#333333',
  base03: '#858585',
  base04: '#858585',
  base05: '#d4d4d4',
  base06: '#e0e0e0',
  base07: '#ffffff',
  base08: '#b5cea8',
  base09: '#b5cea8',
  base0A: '#b5cea8',
  base0B: '#ce9178',
  base0C: '#b5cea8',
  base0D: '#9cdcfe',
  base0E: '#b5cea8',
  base0F: '#cccccc',
};

const JSON_TREE_THEME: StylingConfig = {
  extend: VSCODE_ADAPTIVE_BASE16,
  tree: {
      backgroundColor: 'transparent',
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      padding: 0,
      listStyle: 'none',
      MozUserSelect: 'none',
      WebkitUserSelect: 'none',
    },
    value: (styling, _nodeType, keyPath) => ({
      style: {
        ...styling.style,
        paddingTop: '1px',
        paddingBottom: '1px',
        paddingRight: 0,
        marginLeft: (keyPath as unknown[]).length > 1 ? '0.875em' : 0,
        paddingLeft: '18px',
        textIndent: 0,
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
        userSelect: 'text',
        WebkitUserSelect: 'text',
      },
    }),
    label: {
      display: 'inline-block',
      margin: 0,
      padding: 0,
      color: 'var(--jlab-key-color)',
    },
    valueLabel: {
      margin: 0,
      padding: 0,
    },
    valueText: (styling, nodeType) => {
      let color = 'var(--jlab-fg)';
      if (nodeType === 'String' || nodeType === 'Date') {
        color = 'var(--jlab-string-color)';
      } else if (
        nodeType === 'Number' ||
        nodeType === 'Boolean' ||
        nodeType === 'Null' ||
        nodeType === 'Undefined'
      ) {
        color = 'var(--jlab-primitive-color)';
      }
      return {
        style: {
          ...styling.style,
          color,
        },
      };
    },
    nestedNode: (styling, keyPath, _nodeType, _expanded, expandable) => ({
      style: {
        ...styling.style,
        position: 'relative',
        paddingTop: '1px',
        paddingBottom: '1px',
        marginLeft: (keyPath as unknown[]).length > 1 ? '0.875em' : 0,
        paddingLeft: !expandable ? '18px' : 0,
      },
    }),
    nestedNodeLabel: (styling, _keyPath, _nodeType, _expanded, expandable) => ({
      style: {
        ...styling.style,
        margin: 0,
        padding: 0,
        cursor: expandable ? 'pointer' : 'default',
      },
    }),
    nestedNodeItemString: (styling) => ({
      style: {
        ...styling.style,
        paddingLeft: 0,
        cursor: 'pointer',
        color: 'var(--jlab-item-string-color)',
        fontStyle: 'italic',
      },
    }),
    arrowContainer: (styling, arrowStyle) => ({
      style: {
        ...styling.style,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '14px',
        paddingRight: '4px',
        paddingLeft: arrowStyle === 'double' ? '12px' : 0,
        cursor: 'pointer',
        verticalAlign: 'middle',
      },
    }),
    arrow: (styling, _nodeType, expanded) => ({
      style: {
        ...styling.style,
        marginLeft: 0,
        fontFamily: '"Segoe UI Symbol", Arial, sans-serif',
        fontSize: '10px',
        lineHeight: 1,
        transition: 'transform 120ms ease',
        transform: expanded ? 'rotateZ(90deg)' : 'rotateZ(0deg)',
        transformOrigin: '45% 50%',
      },
    }),
    arrowSign: {
      color: 'var(--jlab-arrow-color)',
    },
    itemRange: (styling, expanded) => ({
      style: {
        ...styling.style,
        paddingTop: expanded ? 0 : '2px',
        cursor: 'pointer',
        color: 'var(--jlab-item-string-color)',
        fontStyle: 'italic',
      },
    }),
};

function formatJsonPath(keyPath: KeyPath): string {
  const ordered = [...keyPath].reverse();
  if (ordered[0] === 'root') {
    ordered.shift();
  }
  if (ordered.length === 0) {
    return 'root';
  }

  let result = '';
  for (const segment of ordered) {
    if (typeof segment === 'number') {
      result += `[${segment}]`;
    } else if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment)) {
      result += result === '' ? segment : `.${segment}`;
    } else {
      result += `[${JSON.stringify(segment)}]`;
    }
  }
  return result;
}

function getValueAtKeyPath(rootData: unknown, keyPath: KeyPath): unknown {
  const ordered = [...keyPath].reverse();
  if (ordered[0] === 'root') {
    ordered.shift();
  }
  let current: unknown = rootData;
  for (const segment of ordered) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (Array.isArray(current) && typeof segment === 'number') {
      current = current[segment];
    } else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[String(segment)];
    } else {
      return undefined;
    }
  }
  return current;
}

function serializeKeyPath(keyPath: KeyPath): string {
  return keyPath.map((seg) => `${typeof seg}:${String(seg)}`).join('|');
}

function parseJsonWithDiagnostics(text: string): {
  ok: boolean;
  data?: unknown;
  empty?: boolean;
  error?: JsonSyntaxErrorInfo;
} {
  if (text.trim() === '') {
    return { ok: true, empty: true };
  }

  try {
    const data = JSON.parse(text);
    return { ok: true, data };
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    const lines = text.split(/\r?\n/);
    let line = 1;
    let column = 1;

    const lineColMatch = rawMessage.match(/line\s+(\d+)\s+column\s+(\d+)/i);
    const posMatch = rawMessage.match(/position\s+(\d+)/i);

    if (lineColMatch) {
      line = Math.max(1, Number.parseInt(lineColMatch[1], 10));
      column = Math.max(1, Number.parseInt(lineColMatch[2], 10));
    } else if (posMatch) {
      const offset = Math.min(
        text.length,
        Math.max(0, Number.parseInt(posMatch[1], 10))
      );
      const before = text.slice(0, offset);
      const splitBefore = before.split(/\r?\n/);
      line = splitBefore.length;
      column = splitBefore[splitBefore.length - 1].length + 1;
    } else if (/unexpected end of json/i.test(rawMessage)) {
      line = Math.max(1, lines.length);
      column = Math.max(1, (lines[line - 1] ?? '').length + 1);
    }

    const clampedLine = Math.min(lines.length, Math.max(1, line));
    const startLine = Math.max(1, clampedLine - 1);
    const endLine = Math.min(lines.length, clampedLine + 1);
    const snippetLines: string[] = [];

    for (let i = startLine; i <= endLine; i++) {
      const lineNumStr = String(i).padStart(4, ' ');
      const prefix = i === clampedLine ? '>' : ' ';
      const content = lines[i - 1] ?? '';
      snippetLines.push(`${prefix} ${lineNumStr} | ${content}`);
      if (i === clampedLine) {
        const caretPad = ' '.repeat(Math.max(0, column - 1));
        snippetLines.push(`       | ${caretPad}^`);
      }
    }

    return {
      ok: false,
      error: {
        message: rawMessage,
        line: clampedLine,
        column,
        snippet: snippetLines.join('\n'),
      },
    };
  }
}

interface SearchIndex {
  matchCount: number;
  expandPaths: Set<string>;
}

function buildSearchIndex(data: unknown, rawQuery: string): SearchIndex {
  const query = rawQuery.trim().toLowerCase();
  const expandPaths = new Set<string>();
  if (!query || data === undefined) {
    return { matchCount: 0, expandPaths };
  }

  let matchCount = 0;
  const MAX_VISITED_NODES = 30000;
  let visited = 0;

  function visit(node: unknown, keyPath: KeyPath): boolean {
    if (visited > MAX_VISITED_NODES) {
      return false;
    }
    visited += 1;

    const currentKey = keyPath[0];
    const keyMatched =
      keyPath.length > 1 &&
      String(currentKey).toLowerCase().includes(query);

    let selfMatched = keyMatched;
    let childMatched = false;

    if (node !== null && typeof node === 'object') {
      if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) {
          if (visit(node[i], [i, ...keyPath])) {
            childMatched = true;
          }
        }
      } else {
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
          if (visit(v, [k, ...keyPath])) {
            childMatched = true;
          }
        }
      }
      if (keyMatched) {
        matchCount += 1;
      }
      if (childMatched) {
        expandPaths.add(serializeKeyPath(keyPath));
      }
      return selfMatched || childMatched;
    }

    const valueText =
      typeof node === 'string'
        ? `"${node}"`
        : node === null
          ? 'null'
          : String(node);
    if (valueText.toLowerCase().includes(query)) {
      selfMatched = true;
    }

    if (selfMatched) {
      matchCount += 1;
    }
    return selfMatched;
  }

  visit(data, ['root']);
  return { matchCount, expandPaths };
}

function renderHighlightedText(text: string, query: string): React.ReactNode {
  const trimmed = query.trim();
  if (!trimmed) {
    return text;
  }
  const lowerText = text.toLowerCase();
  const lowerQuery = trimmed.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let idx = lowerText.indexOf(lowerQuery, cursor);

  if (idx === -1) {
    return text;
  }

  while (idx !== -1) {
    if (idx > cursor) {
      parts.push(text.slice(cursor, idx));
    }
    parts.push(
      <mark key={`${idx}-${cursor}`} className="jlab-highlight">
        {text.slice(idx, idx + trimmed.length)}
      </mark>
    );
    cursor = idx + trimmed.length;
    idx = lowerText.indexOf(lowerQuery, cursor);
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }
  return parts;
}

function getValueClassName(value: unknown): string {
  if (typeof value === 'string') {
    return 'jlab-value jlab-value-string';
  }
  if (typeof value === 'number') {
    return 'jlab-value jlab-value-number';
  }
  if (typeof value === 'boolean') {
    return 'jlab-value jlab-value-boolean';
  }
  if (value === null) {
    return 'jlab-value jlab-value-null';
  }
  return 'jlab-value jlab-value-other';
}

export function App(): React.ReactElement {
  const [expandMode, setExpandMode] = useState<ExpandMode>('default');
  const [expandRevision, setExpandRevision] = useState<number>(0);

  const [fileName, setFileName] = useState<string>('JSON Preview');
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [jsonData, setJsonData] = useState<unknown>(undefined);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);
  const [isEmptyFile, setIsEmptyFile] = useState<boolean>(false);
  const [syntaxError, setSyntaxError] = useState<JsonSyntaxErrorInfo | null>(
    null
  );

  const [searchInput, setSearchInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 2400);
  }, []);

  const copyText = useCallback(
    (text: string, label?: string) => {
      if (vscodeApi) {
        vscodeApi.postMessage({ type: 'copy', text, label });
      } else if (navigator.clipboard) {
        void navigator.clipboard.writeText(text);
      }
      const preview = text.replace(/\s+/g, ' ').trim();
      const shortPreview =
        preview.length > 44 ? `${preview.slice(0, 43)}…` : preview;
      showToast(
        label ? `已复制 ${label}: ${shortPreview}` : `已复制: ${shortPreview}`
      );
    },
    [showToast]
  );

  // 搜索防抖
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput);
    }, 160);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // 监听来自 Extension Host 的文档更新
  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionUpdateMessage>) => {
      const msg = event.data;
      if (!msg || msg.type !== 'update') {
        return;
      }

      if (msg.fileName) {
        setFileName(msg.fileName);
      }
      setIsDirty(Boolean(msg.isDirty));
      setHasLoaded(true);

      const parsed = parseJsonWithDiagnostics(msg.text);
      if (parsed.ok) {
        if (parsed.empty) {
          setIsEmptyFile(true);
          setJsonData(undefined);
          setSyntaxError(null);
        } else {
          setIsEmptyFile(false);
          setJsonData(parsed.data);
          setSyntaxError(null);
        }
      } else {
        setIsEmptyFile(false);
        setSyntaxError(parsed.error ?? null);
      }
    };

    window.addEventListener('message', handleMessage);
    vscodeApi?.postMessage({ type: 'ready' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // 关闭右键菜单
  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    const closeMenu = () => setContextMenu(null);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
    };
    window.addEventListener('click', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [contextMenu]);

  const searchIndex = useMemo(
    () => buildSearchIndex(jsonData, searchQuery),
    [jsonData, searchQuery]
  );

  const handleExpandAll = useCallback(() => {
    setExpandMode('all');
    setExpandRevision((prev) => prev + 1);
  }, []);

  const handleCollapseAll = useCallback(() => {
    setExpandMode('none');
    setExpandRevision((prev) => prev + 1);
  }, []);

  const handleOpenSource = useCallback(() => {
    vscodeApi?.postMessage({ type: 'openSource' });
  }, []);

  // 支持在 Webview 内直接按 Ctrl+Alt+J / Cmd+Alt+J 切换回源码编辑器
  useEffect(() => {
    const onShortcutKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        handleOpenSource();
      }
    };
    window.addEventListener('keydown', onShortcutKeyDown);
    return () => {
      window.removeEventListener('keydown', onShortcutKeyDown);
    };
  }, [handleOpenSource]);

  const shouldExpandNodeInitially: ShouldExpandNodeInitially = useCallback(
    (keyPath, data, level) => {
      if (searchQuery.trim() !== '') {
        return searchIndex.expandPaths.has(serializeKeyPath(keyPath));
      }
      if (expandMode === 'none') {
        return false;
      }
      if (expandMode === 'all') {
        return true;
      }
      // 默认展开前 2 层（level < 2），大数组默认折叠避免首屏卡顿
      if (Array.isArray(data)) {
        if (level > 0 && data.length > 30) {
          return false;
        }
        if (level === 0 && data.length > 100) {
          return false;
        }
      }
      return level < 2;
    },
    [expandMode, searchQuery, searchIndex]
  );

  const getItemString: GetItemString = useCallback((nodeType, data) => {
    if (nodeType === 'Array' && Array.isArray(data)) {
      const count = data.length;
      return (
        <span className="jlab-item-string">
          {count === 1 ? '[] 1 item' : `[] ${count} items`}
        </span>
      );
    }
    if (nodeType === 'Object' && data && typeof data === 'object') {
      const count = Object.keys(data as Record<string, unknown>).length;
      return (
        <span className="jlab-item-string">
          {count === 1 ? '{} 1 key' : `{} ${count} keys`}
        </span>
      );
    }
    return <span className="jlab-item-string">{nodeType}</span>;
  }, []);

  const openNodeContextMenu = useCallback(
    (e: React.MouseEvent, keyPath: KeyPath) => {
      e.preventDefault();
      e.stopPropagation();

      const jsonPath = formatJsonPath(keyPath);
      const keyName = String(keyPath[0] ?? 'root');
      const nodeValue = getValueAtKeyPath(jsonData, keyPath);

      const menuWidth = 240;
      const menuHeight = 165;
      const x = Math.min(e.clientX, Math.max(8, window.innerWidth - menuWidth));
      const y = Math.min(e.clientY, Math.max(8, window.innerHeight - menuHeight));

      setContextMenu({
        x,
        y,
        jsonPath,
        keyName,
        nodeValue,
      });
    },
    [jsonData]
  );

  const labelRenderer: LabelRenderer = useCallback(
    (keyPath, _nodeType, _expanded, expandable) => {
      const rawKey = String(keyPath[0] ?? '');
      const jsonPath = formatJsonPath(keyPath);

      return (
        <span
          className={`jlab-key${expandable ? '' : ' is-leaf'}`}
          title={
            expandable
              ? `路径: ${jsonPath}（Alt+点击或右键复制路径/值）`
              : `路径: ${jsonPath}（点击复制路径，右键更多选项）`
          }
          onClick={(e) => {
            if (!expandable || e.altKey || e.ctrlKey || e.metaKey) {
              e.stopPropagation();
              copyText(jsonPath, 'JSON Path');
            }
          }}
          onContextMenu={(e) => openNodeContextMenu(e, keyPath)}
        >
          {renderHighlightedText(rawKey, searchQuery)}
        </span>
      );
    },
    [copyText, openNodeContextMenu, searchQuery]
  );

  const valueRenderer: ValueRenderer = useCallback(
    (valueAsString, value, ...keyPath) => {
      const displayStr = String(valueAsString);
      return (
        <span
          className={getValueClassName(value)}
          title={`路径: ${formatJsonPath(keyPath)}（右键复制路径或值）`}
          onContextMenu={(e) => openNodeContextMenu(e, keyPath)}
        >
          {renderHighlightedText(displayStr, searchQuery)}
        </span>
      );
    },
    [openNodeContextMenu, searchQuery]
  );

  const treeRenderKey = `${expandMode}-${expandRevision}-${
    searchQuery.trim() ? `search:${searchQuery.trim()}` : 'normal'
  }`;

  return (
    <div className="jtl-root">
      <header className="jtl-toolbar">
        <div className="jtl-toolbar-left">
          <span className="jtl-file-badge" title={fileName}>
            {isDirty && <span className="jtl-dirty-dot" title="未保存的修改" />}
            <span>{fileName}</span>
          </span>

          <div className="jtl-search-wrap">
            <input
              type="text"
              className="jtl-search-input"
              placeholder="搜索键名或值…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <span className="jtl-search-meta">
                <span>{searchIndex.matchCount} 处</span>
                <button
                  type="button"
                  className="jtl-search-clear"
                  title="清空搜索"
                  onClick={() => {
                    setSearchInput('');
                    setSearchQuery('');
                  }}
                >
                  ×
                </button>
              </span>
            )}
          </div>
        </div>

        <div className="jtl-toolbar-actions">
          <button
            type="button"
            className={`jtl-btn${expandMode === 'all' ? ' is-active' : ''}`}
            onClick={handleExpandAll}
            title="展开所有节点"
          >
            全部展开
          </button>
          <button
            type="button"
            className={`jtl-btn${expandMode === 'none' ? ' is-active' : ''}`}
            onClick={handleCollapseAll}
            title="折叠所有节点"
          >
            全部折叠
          </button>

          <span className="jtl-btn-divider" />

          <button
            type="button"
            className="jtl-btn"
            onClick={handleOpenSource}
            title="切换回 VS Code 默认文本源码编辑器 (Ctrl+Alt+J / Cmd+Alt+J)"
          >
            切换回源码 (Ctrl+Alt+J)
          </button>
        </div>
      </header>

      {syntaxError && (
        <section className="jtl-error-banner" role="alert">
          <div className="jtl-error-header">
            <span className="jtl-error-title">
              JSON 语法错误（第 {syntaxError.line} 行，第 {syntaxError.column} 列）
            </span>
            <button
              type="button"
              className="jtl-btn"
              onClick={handleOpenSource}
            >
              前往源码修复
            </button>
          </div>
          <div className="jtl-error-detail">{syntaxError.message}</div>
          <pre className="jtl-error-snippet">{syntaxError.snippet}</pre>
        </section>
      )}

      {!hasLoaded ? (
        <div className="jtl-empty-state">正在加载 JSON 数据…</div>
      ) : isEmptyFile ? (
        <div className="jtl-empty-state">
          当前 JSON 文件为空，可在源码视图中编辑后实时预览。
        </div>
      ) : jsonData !== undefined ? (
        <main className="jtl-json-tree-container">
          <JSONTree
            key={treeRenderKey}
            data={jsonData}
            theme={JSON_TREE_THEME}
            invertTheme={false}
            hideRoot={false}
            collectionLimit={50}
            getItemString={getItemString}
            labelRenderer={labelRenderer}
            valueRenderer={valueRenderer}
            shouldExpandNodeInitially={shouldExpandNodeInitially}
          />
        </main>
      ) : null}

      {contextMenu && (
        <div
          className="jtl-context-menu"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="jtl-context-header" title={contextMenu.jsonPath}>
            {contextMenu.jsonPath}
          </div>
          <button
            type="button"
            className="jtl-context-item"
            onClick={() => {
              copyText(contextMenu.jsonPath, 'JSON Path');
              setContextMenu(null);
            }}
          >
            <span>复制 JSON Path</span>
            <span className="jtl-context-preview">
              {contextMenu.jsonPath}
            </span>
          </button>
          <button
            type="button"
            className="jtl-context-item"
            onClick={() => {
              const formattedValue =
                contextMenu.nodeValue === undefined
                  ? 'undefined'
                  : JSON.stringify(contextMenu.nodeValue, null, 2);
              copyText(formattedValue, '节点值 (JSON)');
              setContextMenu(null);
            }}
          >
            <span>复制节点值 (JSON)</span>
            <span className="jtl-context-preview">
              {typeof contextMenu.nodeValue === 'object' &&
              contextMenu.nodeValue !== null
                ? Array.isArray(contextMenu.nodeValue)
                  ? `[${contextMenu.nodeValue.length}]`
                  : `{${Object.keys(contextMenu.nodeValue).length}}`
                : String(contextMenu.nodeValue)}
            </span>
          </button>
          {typeof contextMenu.nodeValue === 'string' && (
            <button
              type="button"
              className="jtl-context-item"
              onClick={() => {
                copyText(String(contextMenu.nodeValue), '纯文本值');
                setContextMenu(null);
              }}
            >
              <span>复制纯文本（无引号）</span>
              <span className="jtl-context-preview">
                {contextMenu.nodeValue}
              </span>
            </button>
          )}
          <button
            type="button"
            className="jtl-context-item"
            onClick={() => {
              copyText(contextMenu.keyName, '键名');
              setContextMenu(null);
            }}
          >
            <span>复制键名</span>
            <span className="jtl-context-preview">{contextMenu.keyName}</span>
          </button>
        </div>
      )}

      {toastMessage && <div className="jtl-toast">{toastMessage}</div>}
    </div>
  );
}
