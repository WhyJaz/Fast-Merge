import * as vscode from "vscode"
import MyProvider from "./webview/MyProvider"


// 插件激活时调用
export async function activate(context: vscode.ExtensionContext) {

	// 注册webview视图提供者
	const sidebarProvider = new MyProvider(context)
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(MyProvider.sideBarId, sidebarProvider, {
			webviewOptions: { retainContextWhenHidden: true },
		})
	)
}

// 插件卸载时调用
export function deactivate() {

}