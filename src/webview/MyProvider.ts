import * as vscode from "vscode"
import { WebviewMessage, AllWebviewMessages, ResponseMessage } from "../shared/WebviewMessage"
import { getNonce } from "./getNonce"
import { getUri } from "./getUri"
import { LOCAL_PORT } from "../shared/constant"
import { GitLabService } from "../api/gitlab-service"
import { GitUtils } from "../utils/git-utils"
import { ConfigManager } from "../utils/config-manager"


class MyProvider implements vscode.WebviewViewProvider {
	public static readonly sideBarId = "fast-merge.SidebarProvider"
	private view?: vscode.WebviewView | vscode.WebviewPanel
	private gitLabService: GitLabService
	private gitUtils: GitUtils
	private configManager: ConfigManager
	private configWatcher?: vscode.Disposable

	constructor(readonly context: vscode.ExtensionContext) {
		this.configManager = new ConfigManager(context)
		this.gitLabService = new GitLabService() // 将在initializeConfig中设置配置
		this.gitUtils = new GitUtils()
		this.initializeConfig()
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

		// 延迟发送配置状态，确保webview已经准备好
		setTimeout(() => {
			this.sendConfigStatus()
		}, 100)

		// 监听webviewView的销毁
		webviewView.onDidDispose(
			async () => {
				this.configWatcher?.dispose()
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
			async (message: AllWebviewMessages) => {
				await this.handleMessage(message)
			}
		)
	}

	// 处理来自webview的消息
	private async handleMessage(message: AllWebviewMessages): Promise<void> {
		try {
			switch (message.type) {
				case "notify":
					vscode.window.showInformationMessage('扩展层收到消息')
					this.postMessageToWebview('向webview层发送消息')
					break

				case "gitlab:getProjects":
					await this.handleGetProjects(message.message)
					break

				case "gitlab:getBranches":
					await this.handleGetBranches(message.message)
					break

				case "gitlab:getCommits":
					await this.handleGetCommits(message.message)
					break

				case "gitlab:createMergeRequest":
					await this.handleCreateMergeRequest(message.message)
					break

				case "gitlab:createCherryPickMR":
					await this.handleCreateCherryPickMR(message.message)
					break

				case "gitlab:closeMergeRequest":
					await this.handleCloseMergeRequest(message.message)
					break

				case "gitlab:getCurrentRepo":
					await this.handleGetCurrentRepo()
					break

				case "gitlab:setConfiguration":
					await this.handleSetConfiguration(message.message)
					break

				case "config:open":
					await this.handleOpenConfig()
					break

				case "config:reload":
					await this.handleReloadConfig()
					break

				case "config:check":
					await this.sendConfigStatus()
					break

				case "config:getInfo":
					await this.sendConfigInfo()
					break

				default:
					console.warn('未知消息类型:', message.type)
			}
		} catch (error: any) {
			console.error('处理消息失败:', error)
			this.sendResponse({ requestType: message.type, success: false, data: null, error: error.message })
		}
	}

	// 发送响应消息
	private sendResponse({ requestType, success, data, error, options }: { requestType: string, success: boolean, data?: any, error?: string, options?: Record<string, any> }): void {
		const response: ResponseMessage = {
			type: 'response',
			message: {
				requestType,
				success,
				data,
				error,
				options
			}
		}
		this.view?.webview.postMessage(response)
	}

	// 处理获取项目列表
	private async handleGetProjects(params: { search?: string; page?: number; perPage?: number }): Promise<void> {
		try {
			const projects = await this.gitLabService.getProjects(params.search, params.page, params.perPage)
			this.sendResponse({ requestType: 'gitlab:getProjects', success: true, data: projects })

		} catch (error: any) {
			this.sendResponse({ requestType: 'gitlab:getProjects', success: false, data: null, error: error.message })

		}
	}

	// 处理获取分支列表
	private async handleGetBranches(params: { projectId: number; search?: string }): Promise<void> {
		try {
			const branches = await this.gitLabService.getBranches(params.projectId, params.search)
			this.sendResponse({ requestType: 'gitlab:getBranches', success: true, data: branches })

		} catch (error: any) {
			this.sendResponse({ requestType: 'gitlab:getBranches', success: false, data: null, error: error.message })

		}
	}

	// 处理获取提交列表
	private async handleGetCommits(params: { projectId: number; branch: string; search?: string; page?: number; perPage?: number }): Promise<void> {
		try {
			const commits = params.search
				? await this.gitLabService.searchCommits(params.projectId, params.branch, params.search, params.page, params.perPage)
				: await this.gitLabService.getCommits(params.projectId, params.branch, params.search, params.page, params.perPage)
			this.sendResponse({ requestType: 'gitlab:getCommits', success: true, data: commits })

		} catch (error: any) {
			this.sendResponse({ requestType: 'gitlab:getCommits', success: false, data: null, error: error.message })

		}
	}

	// 处理创建合并请求
	private async handleCreateMergeRequest(params: { projectId: number; options: any }): Promise<void> {
		try {
			const result = await this.gitLabService.createMergeRequest(params.projectId, params.options)
			this.sendResponse({ requestType: 'gitlab:createMergeRequest', success: result.success, data: result, error: result.error, options: params.options })


			// 如果MR创建成功，启动异步冲突校验
			if (result.success && result.merge_request) {
				this.startAsyncConflictCheck(params.projectId, result.merge_request.iid)
			}
		} catch (error: any) {
			this.sendResponse({ requestType: 'gitlab:createMergeRequest', success: false, data: null, error: error.message })
		}
	}

	// 启动异步冲突校验
	private startAsyncConflictCheck(projectId: number, mergeRequestIid: number): void {
		this.gitLabService.startAsyncConflictCheck(
			projectId,
			mergeRequestIid,
			(updatedMR) => {
				// 向前端发送冲突状态更新消息
				this.view?.webview.postMessage({
					type: 'gitlab:conflictStatusUpdate',
					projectId,
					mergeRequestIid,
					mergeRequest: updatedMR
				});
			}
		);
	}

	// 处理创建Cherry Pick合并请求
	private async handleCreateCherryPickMR(params: { projectId: number; options: any }): Promise<void> {
		try {
			const results = await this.gitLabService.createCherryPickMergeRequests(params.projectId, params.options)
			this.sendResponse({ requestType: 'gitlab:createCherryPickMR', success: true, data: results, options: params.options })



			// 为每个成功的Cherry Pick MR启动异步冲突校验
			if (results && Array.isArray(results)) {
				results.forEach(result => {
					if (result.success && result.merge_request) {
						this.startAsyncConflictCheck(params.projectId, result.merge_request.iid)
					}
				});
			}
		} catch (error: any) {
			this.sendResponse({ requestType: 'gitlab:createCherryPickMR', success: false, data: null, error: error.message })

		}
	}

	// 处理关闭合并请求
	private async handleCloseMergeRequest(params: { projectId: number; mergeRequestIid: number; tempBranchName?: string }): Promise<void> {
		try {
			const result = await this.gitLabService.closeMergeRequest(params.projectId, params.mergeRequestIid)

			// 如果提供了临时分支名称，尝试删除临时分支
			if (params.tempBranchName) {
				try {
					await this.gitLabService.deleteBranch(params.projectId, params.tempBranchName)
					console.log(`成功删除临时分支: ${params.tempBranchName}`)
				} catch (deleteError: any) {
					console.warn(`删除临时分支失败: ${params.tempBranchName}`, deleteError.message)
					// 不抛出错误，因为关闭MR已经成功，删除分支失败不应该影响整体操作
				}
			}

			this.sendResponse({ requestType: 'gitlab:closeMergeRequest', success: true, data: result })

		} catch (error: any) {
			this.sendResponse({ requestType: 'gitlab:closeMergeRequest', success: false, data: null, error: error.message })

		}
	}

	// 处理获取当前仓库信息
	private async handleGetCurrentRepo(): Promise<void> {
		try {
			const repoInfo = await this.gitUtils.getRepositoryInfo()

			// 如果有GitLab项目路径，尝试获取项目详情
			if (repoInfo.gitlabProjectPath) {
				try {
					const project = await this.gitLabService.getProjectByPath(repoInfo.gitlabProjectPath)
					if (project) {
						repoInfo.gitlabProjectPath = project.path_with_namespace
						// 可以添加更多项目信息
					}
				} catch (error) {
					// 忽略获取项目详情的错误
					console.warn('获取GitLab项目详情失败:', error)
				}
			}

			this.sendResponse({ requestType: 'gitlab:getCurrentRepo', success: true, data: repoInfo })

		} catch (error: any) {
			this.sendResponse({ requestType: 'gitlab:getCurrentRepo', success: false, data: null, error: error.message })

		}
	}

	// 处理设置配置
	private async handleSetConfiguration(gitlabConfig: any): Promise<void> {
		try {
			// 加载当前完整配置
			const currentConfig = await this.configManager.loadConfig()
			// 更新GitLab部分
			currentConfig.gitlab = gitlabConfig
			// 保存配置到文件
			await this.configManager.saveConfig(currentConfig)
			// 更新服务配置
			this.gitLabService.updateConfig(currentConfig)

			const testResult = await this.gitLabService.testConnection()
			this.sendResponse({ requestType: 'gitlab:setConfiguration', success: testResult.success, data: testResult, error: testResult.success ? undefined : testResult.message })
		} catch (error: any) {
			this.sendResponse({ requestType: 'gitlab:setConfiguration', success: false, data: null, error: error.message })

		}
	}

	// 初始化配置
	private async initializeConfig(): Promise<void> {
		try {
			const config = await this.configManager.loadConfig()

			// 更新GitLab服务配置，使用完整的配置对象
			this.gitLabService.updateConfig(config)

			// 设置配置文件监听
			this.configWatcher = this.configManager.watchConfigFile(async (newConfig) => {
				// 更新GitLab服务配置
				this.gitLabService.updateConfig(newConfig)

				// 通知webview配置已更新
				this.sendConfigStatus()
			})
		} catch (error) {
			console.error('初始化配置失败:', error)
		}
	}

	// 处理打开配置文件
	private async handleOpenConfig(): Promise<void> {
		try {
			await this.configManager.openConfigFile()
		} catch (error: any) {
			console.error('打开配置文件失败:', error)
			vscode.window.showErrorMessage(`打开配置文件失败: ${error.message}`)
		}
	}

	// 处理重新加载配置
	private async handleReloadConfig(): Promise<void> {
		try {
			const config = await this.configManager.loadConfig()

			// 更新GitLab服务配置
			this.gitLabService.updateConfig(config)

			// 发送配置状态
			this.sendConfigStatus()
		} catch (error: any) {
			console.error('重新加载配置失败:', error)
			this.sendConfigStatus()
		}
	}

	// 发送配置状态到webview
	private async sendConfigStatus(): Promise<void> {
		try {
			console.log('开始检查配置状态...')
			const isConfigured = await this.configManager.isConfigured()
			let configError = ''

			if (!isConfigured) {
				const config = await this.configManager.loadConfig()
				const validation = this.configManager.validateConfig(config)
				configError = validation.errors.join('; ')
				console.log('配置验证失败:', validation.errors)
			} else {
				console.log('配置检查通过')
			}

			const statusMessage = {
				type: 'config:status',
				configured: isConfigured,
				error: configError
			}

			console.log('发送配置状态到webview:', statusMessage)
			this.view?.webview.postMessage(statusMessage)
		} catch (error: any) {
			console.error('发送配置状态失败:', error)
			const errorMessage = {
				type: 'config:status',
				configured: false,
				error: error.message || '检查配置时发生错误'
			}
			console.log('发送错误状态到webview:', errorMessage)
			this.view?.webview.postMessage(errorMessage)
		}
	}

	// 发送配置信息到webview
	private async sendConfigInfo(): Promise<void> {
		try {
			const config = await this.configManager.loadConfig()
			const isConfigured = await this.configManager.isConfigured()

			// 测试连接状态
			let isConnected = false
			if (isConfigured) {
				try {
					const testResult = await this.gitLabService.testConnection()
					isConnected = testResult.success
				} catch (error) {
					isConnected = false
				}
			}

			this.view?.webview.postMessage({
				type: 'config:info',
				// baseUrl: config.gitlab.baseUrl,
				// 配置里面的都拿过来
				...config.gitlab,
				isConnected,
				isConfigured
			})
		} catch (error: any) {
			console.error('发送配置信息失败:', error)
			this.view?.webview.postMessage({
				type: 'config:info',
				baseUrl: '',
				isConnected: false,
				isConfigured: false
			})
		}
	}
}

export default MyProvider