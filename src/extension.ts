import * as path from 'path';
import * as vscode from 'vscode';

export const VIEW_TYPE = 'jsonTreeLens.preview';
export const OPEN_COMMAND = 'jsonTreeLens.open';
export const OPEN_SOURCE_COMMAND = 'jsonTreeLens.openSource';
export const TOGGLE_COMMAND = 'jsonTreeLens.toggle';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new JsonTreeLensEditorProvider(context);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
      supportsMultipleEditorsPerDocument: false,
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(OPEN_COMMAND, async (uri?: vscode.Uri) => {
      const targetUri = resolveTargetUri(uri);
      if (!targetUri) {
        vscode.window.showWarningMessage('Please open or select a JSON file first.');
        return;
      }
      await vscode.commands.executeCommand('vscode.openWith', targetUri, VIEW_TYPE);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(OPEN_SOURCE_COMMAND, async (uri?: vscode.Uri) => {
      const targetUri = resolveTargetUri(uri);
      if (!targetUri) {
        return;
      }
      await vscode.commands.executeCommand('vscode.openWith', targetUri, 'default');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(TOGGLE_COMMAND, async (uri?: vscode.Uri) => {
      const targetUri = resolveTargetUri(uri);
      if (!targetUri) {
        vscode.window.showWarningMessage('Please open or select a JSON file first.');
        return;
      }
      const activeInput = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
      const isTreeView =
        activeInput instanceof vscode.TabInputCustom &&
        activeInput.viewType === VIEW_TYPE;
      await vscode.commands.executeCommand(
        'vscode.openWith',
        targetUri,
        isTreeView ? 'default' : VIEW_TYPE
      );
    })
  );
}

export function deactivate(): void {
  // No-op
}

function resolveTargetUri(uri?: vscode.Uri): vscode.Uri | undefined {
  if (uri instanceof vscode.Uri) {
    return uri;
  }

  const activeEditorUri = vscode.window.activeTextEditor?.document.uri;
  if (activeEditorUri) {
    return activeEditorUri;
  }

  const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
  const input = activeTab?.input;
  if (input && typeof input === 'object' && 'uri' in input) {
    const tabUri = (input as { uri?: unknown }).uri;
    if (tabUri instanceof vscode.Uri) {
      return tabUri;
    }
  }

  return undefined;
}

type WebviewToExtensionMessage =
  | { type: 'ready' }
  | { type: 'copy'; text: string; label?: string }
  | { type: 'openSource' };

class JsonTreeLensEditorProvider implements vscode.CustomTextEditorProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist')],
    };

    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    const postDocumentUpdate = (): void => {
      void webviewPanel.webview.postMessage({
        type: 'update',
        text: document.getText(),
        fileName: path.basename(document.uri.fsPath || document.fileName),
        isDirty: document.isDirty,
      });
    };

    let debounceTimer: NodeJS.Timeout | undefined;
    const scheduleUpdate = (delayMs: number): void => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        postDocumentUpdate();
      }, delayMs);
    };

    const changeDocDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() === document.uri.toString()) {
        scheduleUpdate(120);
      }
    });

    const saveDocDisposable = vscode.workspace.onDidSaveTextDocument((savedDoc) => {
      if (savedDoc.uri.toString() === document.uri.toString()) {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = undefined;
        }
        postDocumentUpdate();
      }
    });

    const messageDisposable = webviewPanel.webview.onDidReceiveMessage(
      async (message: WebviewToExtensionMessage) => {
        switch (message.type) {
          case 'ready': {
            postDocumentUpdate();
            break;
          }
          case 'copy': {
            await vscode.env.clipboard.writeText(message.text);
            const hint = message.label
              ? `已复制 ${message.label}: ${truncatePreview(message.text, 48)}`
              : `已复制: ${truncatePreview(message.text, 48)}`;
            vscode.window.setStatusBarMessage(hint, 2500);
            break;
          }
          case 'openSource': {
            await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
            break;
          }
        }
      }
    );

    webviewPanel.onDidDispose(() => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      changeDocDisposable.dispose();
      saveDocDisposable.dispose();
      messageDisposable.dispose();
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.css')
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:;"
  />
  <title>JSON Tree Lens</title>
  <link rel="stylesheet" href="${styleUri.toString()}" />
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri.toString()}"></script>
</body>
</html>`;
  }
}

function truncatePreview(text: string, maxLen: number): string {
  const singleLine = text.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= maxLen) {
    return singleLine;
  }
  return `${singleLine.slice(0, maxLen - 1)}…`;
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  for (let i = 0; i < 32; i++) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}
