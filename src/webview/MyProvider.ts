import * as vscode from "vscode"
import { WebviewMessage } from "../shared/WebviewMessage"
import { getNonce } from "./getNonce"
import { getUri } from "./getUri"
import { LOCAL_PORT } from "../shared/constant"


class MyProvider implements vscode.WebviewViewProvider {
	public static readonly sideBarId = "fast-merge.SidebarProvider"
	private view?: vscode.WebviewView | vscode.WebviewPanel

	constructor(readonly context: vscode.ExtensionContext) {
	}

	// 当webview视图被创建时调用
	async resolveWebviewView(webviewView: vscode.WebviewView | vscode.WebviewPanel) {
		this.view = webviewView

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		}

		webviewView.webview.html =
			this.context.extensionMode === vscode.ExtensionMode.Development
				? await this.getHMRHtmlContent(webviewView.webview)
				: this.getHtmlContent(webviewView.webview)

		this.setWebviewMessageListener(webviewView.webview)


		// 监听webviewView的销毁
		webviewView.onDidDispose(
			async () => {
			},
			null,
			[],
		)
	}

	// 生产环境调用
	private getHtmlContent(webview: vscode.Webview): string {
		const stylesUri = getUri(webview, this.context.extensionUri, ["webview-ui", "build", "assets", "index.css"])
		const scriptUri = getUri(webview, this.context.extensionUri, ["webview-ui", "build", "assets", "index.js"])

		const nonce = getNonce()

		return /*html*/ `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
            <meta name="theme-color" content="#000000">
            <link rel="stylesheet" type="text/css" href="${stylesUri}">
						<meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src *; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https: data:; frame-src *;  script-src 'nonce-${nonce}' 'unsafe-eval';">
            <title>助手</title>
            <style nonce="${nonce}">
            </style>
          </head>
          <body>
            <noscript>You need to enable JavaScript to run this app.</noscript>
            <div id="root-container">
              <div id="root"></div>
              
            <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
            
            <script nonce="${nonce}">
              // 在全局范围内只调用一次acquireVsCodeApi
              window._vscodeApi = acquireVsCodeApi();
              
              // 通过覆盖acquireVsCodeApi函数来避免重复获取API
              window.acquireVsCodeApi = function() {
                return window._vscodeApi;
              };
            </script>
          </body>
        </html>
      `
	}


	// 开发环境调用
	private async getHMRHtmlContent(webview: vscode.Webview): Promise<string> {
		const localServerUrl = `localhost:${LOCAL_PORT}`

		const nonce = getNonce()
		const stylesUri = getUri(webview, this.context.extensionUri, ["webview-ui", "build", "assets", "index.css"])


		const scriptEntrypoint = "src/main.tsx"
		const scriptUri = `http://${localServerUrl}/${scriptEntrypoint}`

		const reactRefresh = /*html*/ `
			<script nonce="${nonce}" type="module">
				import RefreshRuntime from "http://${localServerUrl}/@react-refresh"
				RefreshRuntime.injectIntoGlobalHook(window)
				window.$RefreshReg$ = () => {}
				window.$RefreshSig$ = () => (type) => type
				window.__vite_plugin_react_preamble_installed__ = true
			</script>
		`

		const csp = [
			"default-src 'none'",
			`font-src ${webview.cspSource}`,
			`style-src ${webview.cspSource} 'unsafe-inline' https://* http://${localServerUrl} http://0.0.0.0:${LOCAL_PORT}`,
			`img-src ${webview.cspSource} https: data:`,
			`script-src 'unsafe-eval' https://* http://${localServerUrl} http://0.0.0.0:${LOCAL_PORT} 'nonce-${nonce}'`,
			`connect-src *`,
			`frame-src *`,
		]

		return /*html*/ `
			<!DOCTYPE html>
			<html lang="en">
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
					<meta http-equiv="Content-Security-Policy" content="${csp.join("; ")}">
					<link rel="stylesheet" type="text/css" href="${stylesUri}">
					<title>助手</title>
					<style nonce="${nonce}">
					</style>
				</head>
				<body>
					<div id="root-container">
						<div id="root"></div>
					
					${reactRefresh}
					<script type="module" src="${scriptUri}"></script>
					
					<script nonce="${nonce}">
					  // 在全局范围内只调用一次acquireVsCodeApi
					  window._vscodeApi = acquireVsCodeApi();
					  
					  // 通过覆盖acquireVsCodeApi函数来避免重复获取API
					  window.acquireVsCodeApi = function() {
							return window._vscodeApi;
					  };
					</script>
				</body>
			</html>
		`
	}

	// 向webview层发送消息
	postMessageToWebview(message: string) {
		this.view?.webview.postMessage(message)
	}

	// 监听来自webview的消息
	private setWebviewMessageListener(webview: vscode.Webview) {
		// 监听来自webview的消息
		webview.onDidReceiveMessage(
			async (message: WebviewMessage) => {
				switch (message.type) {
					case "notify":
						vscode.window.showInformationMessage('扩展层收到消息7')
						this.postMessageToWebview('向webview层发送消息')
						break
				}
			}
		)
	}
}

export default MyProvider