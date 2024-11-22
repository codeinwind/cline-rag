import * as vscode from "vscode";
import { getNonce } from "./getNonce";
import { getUri } from "./getUri";
import { ExtensionMessage } from "../../shared/ExtensionMessage";
import { getTheme } from "../../integrations/theme/getTheme";

export class WebviewManager {
    private view?: vscode.WebviewView | vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly messageHandler: (webview: vscode.Webview, message: any) => Promise<void>
    ) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView | vscode.WebviewPanel
    ): void | Thenable<void> {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri],
        };
        webviewView.webview.html = this.getHtmlContent(webviewView.webview);

        this.setWebviewMessageListener(webviewView.webview);

        if ("onDidChangeViewState" in webviewView) {
            webviewView.onDidChangeViewState(
                () => {
                    if (this.view?.visible) {
                        this.postMessageToWebview({ type: "action", action: "didBecomeVisible" });
                    }
                },
                null,
                this.disposables
            );
        } else if ("onDidChangeVisibility" in webviewView) {
            webviewView.onDidChangeVisibility(
                () => {
                    if (this.view?.visible) {
                        this.postMessageToWebview({ type: "action", action: "didBecomeVisible" });
                    }
                },
                null,
                this.disposables
            );
        }

        webviewView.onDidDispose(
            () => {
                this.dispose();
            },
            null,
            this.disposables
        );

        vscode.workspace.onDidChangeConfiguration(
            async (e) => {
                if (e && e.affectsConfiguration("workbench.colorTheme")) {
                    await this.postMessageToWebview({ 
                        type: "theme", 
                        text: JSON.stringify(await getTheme()) 
                    });
                }
            },
            null,
            this.disposables
        );
    }

    async postMessageToWebview(message: ExtensionMessage) {
        await this.view?.webview.postMessage(message);
    }

    private getHtmlContent(webview: vscode.Webview): string {
        const stylesUri = getUri(webview, this.context.extensionUri, [
            "webview-ui",
            "build",
            "static",
            "css",
            "main.css",
        ]);
        const scriptUri = getUri(webview, this.context.extensionUri, [
            "webview-ui", 
            "build", 
            "static", 
            "js", 
            "main.js"
        ]);
        const codiconsUri = getUri(webview, this.context.extensionUri, [
            "node_modules",
            "@vscode",
            "codicons",
            "dist",
            "codicon.css",
        ]);

        const nonce = getNonce();

        return /*html*/ `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
            <meta name="theme-color" content="#000000">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:; script-src 'nonce-${nonce}';">
            <link rel="stylesheet" type="text/css" href="${stylesUri}">
            <link href="${codiconsUri}" rel="stylesheet" />
            <title>Cline</title>
          </head>
          <body>
            <noscript>You need to enable JavaScript to run this app.</noscript>
            <div id="root"></div>
            <script nonce="${nonce}" src="${scriptUri}"></script>
          </body>
        </html>
      `;
    }

    private setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            async (message) => {
                await this.messageHandler(webview, message);
            },
            null,
            this.disposables
        );
    }

    dispose() {
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
        if (this.view && "dispose" in this.view) {
            this.view.dispose();
        }
    }

    get visible(): boolean {
        return this.view?.visible ?? false;
    }
}
