import { GitLabProject, GitLabBranch, GitLabCommit, MergeRequestOptions, CherryPickOptions, MergeResult, CherryPickResult, GitLabConfiguration } from './gitlab-types';

export interface WebviewMessage {
	type: string
	message?: any
}

// GitLab 相关消息类型
export interface GitLabMessage extends WebviewMessage {
	type: 'gitlab:getProjects' | 'gitlab:getBranches' | 'gitlab:getCommits' | 'gitlab:createMergeRequest' | 'gitlab:createCherryPickMR' | 'gitlab:getCurrentRepo' | 'gitlab:setConfiguration'
}

// 配置相关消息类型
export interface ConfigMessage extends WebviewMessage {
	type: 'config:open' | 'config:reload' | 'config:check' | 'config:getInfo'
}

// 获取项目列表
export interface GetProjectsMessage extends GitLabMessage {
	type: 'gitlab:getProjects'
	message: {
		search?: string
		page?: number
		perPage?: number
	}
}

// 获取分支列表
export interface GetBranchesMessage extends GitLabMessage {
	type: 'gitlab:getBranches'
	message: {
		projectId: number
		search?: string
	}
}

// 获取提交列表
export interface GetCommitsMessage extends GitLabMessage {
	type: 'gitlab:getCommits'
	message: {
		projectId: number
		branch: string
		search?: string
		page?: number
		perPage?: number
	}
}

// 创建合并请求
export interface CreateMergeRequestMessage extends GitLabMessage {
	type: 'gitlab:createMergeRequest'
	message: {
		projectId: number
		options: MergeRequestOptions
	}
}

// 创建Cherry Pick合并请求
export interface CreateCherryPickMRMessage extends GitLabMessage {
	type: 'gitlab:createCherryPickMR'
	message: {
		projectId: number
		options: CherryPickOptions
	}
}

// 获取当前仓库信息
export interface GetCurrentRepoMessage extends GitLabMessage {
	type: 'gitlab:getCurrentRepo'
}

// 设置GitLab配置
export interface SetConfigurationMessage extends GitLabMessage {
	type: 'gitlab:setConfiguration'
	message: GitLabConfiguration
}

// 响应消息类型
export interface ResponseMessage extends WebviewMessage {
	type: 'response'
	message: {
		requestType: string
		success: boolean
		data?: any
		error?: string
	}
}

export type AllWebviewMessages = 
	| WebviewMessage 
	| GetProjectsMessage 
	| GetBranchesMessage 
	| GetCommitsMessage 
	| CreateMergeRequestMessage 
	| CreateCherryPickMRMessage 
	| GetCurrentRepoMessage
	| SetConfigurationMessage
	| ConfigMessage
	| ResponseMessage;
