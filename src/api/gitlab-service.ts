import * as vscode from 'vscode';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import {
  GitLabProject,
  GitLabBranch,
  GitLabCommit,
  GitLabMergeRequest,
  GitLabConfiguration,
  MergeRequestOptions,
  CherryPickOptions,
  MergeResult,
  CherryPickResult,
  GitLabApiError
} from '../shared/gitlab-types';

export class GitLabService {
  private config: GitLabConfiguration | null = null;

  constructor() {
    this.loadConfiguration();
  }

  /**
   * 加载GitLab配置
   */
  private async loadConfiguration(): Promise<void> {
    const config = vscode.workspace.getConfiguration('fast-merge');
    const baseUrl = config.get<string>('gitlab.baseUrl') || '';
    const token = config.get<string>('gitlab.token') || '';
    
    if (baseUrl && token) {
      this.config = { baseUrl, token };
    }
  }

  /**
   * 设置GitLab配置
   */
  async setConfiguration(config: GitLabConfiguration): Promise<void> {
    this.config = config;
    
    // 保存到VSCode配置中
    const vsConfig = vscode.workspace.getConfiguration('fast-merge');
    await vsConfig.update('gitlab.baseUrl', config.baseUrl, vscode.ConfigurationTarget.Global);
    await vsConfig.update('gitlab.token', config.token, vscode.ConfigurationTarget.Global);
    if (config.projectId) {
      await vsConfig.update('gitlab.projectId', config.projectId, vscode.ConfigurationTarget.Global);
    }
  }

  /**
   * 检查配置是否有效
   */
  private ensureConfiguration(): void {
    if (!this.config || !this.config.baseUrl || !this.config.token) {
      throw new Error('GitLab 配置无效，请先设置 GitLab 服务器地址和访问令牌');
    }
  }

  /**
   * 发送HTTP请求
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any
  ): Promise<T> {
    this.ensureConfiguration();

    return new Promise((resolve, reject) => {
      const url = new URL(`${this.config!.baseUrl}/api/v4${endpoint}`);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const postData = data ? JSON.stringify(data) : undefined;

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          'Authorization': `Bearer ${this.config!.token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'VSCode-FastMerge-Extension',
          ...(postData && { 'Content-Length': Buffer.byteLength(postData) })
        }
      };

      const req = httpModule.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              const result = responseData ? JSON.parse(responseData) : {};
              resolve(result);
            } else {
              const error: GitLabApiError = {
                message: `HTTP ${res.statusCode}: ${res.statusMessage}`,
                status: res.statusCode
              };
              
              try {
                const errorData = JSON.parse(responseData);
                error.message = errorData.message || errorData.error_description || error.message;
                error.error = errorData.error;
              } catch (e) {
                // 使用默认错误消息
              }
              
              reject(error);
            }
          } catch (e) {
            reject(new Error(`解析响应失败: ${e}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`请求失败: ${error.message}`));
      });

      if (postData) {
        req.write(postData);
      }

      req.end();
    });
  }

  /**
   * 获取项目列表
   */
  async getProjects(search?: string, page: number = 1, perPage: number = 20): Promise<GitLabProject[]> {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
      membership: 'true',
      simple: 'true'
    });

    if (search) {
      params.append('search', search);
    }

    return this.makeRequest<GitLabProject[]>('GET', `/projects?${params}`);
  }

  /**
   * 根据项目路径获取项目
   */
  async getProjectByPath(projectPath: string): Promise<GitLabProject | null> {
    try {
      const encodedPath = encodeURIComponent(projectPath);
      return await this.makeRequest<GitLabProject>('GET', `/projects/${encodedPath}`);
    } catch (error) {
      console.error('获取项目失败:', error);
      return null;
    }
  }

  /**
   * 获取项目分支列表
   */
  async getBranches(projectId: number, search?: string): Promise<GitLabBranch[]> {
    const params = new URLSearchParams({
      per_page: '100'
    });

    if (search) {
      params.append('search', search);
    }

    return this.makeRequest<GitLabBranch[]>('GET', `/projects/${projectId}/repository/branches?${params}`);
  }

  /**
   * 获取项目提交列表
   */
  async getCommits(
    projectId: number,
    branch: string,
    search?: string,
    page: number = 1,
    perPage: number = 20
  ): Promise<GitLabCommit[]> {
    const params = new URLSearchParams({
      ref_name: branch,
      page: page.toString(),
      per_page: perPage.toString()
    });

    if (search) {
      // GitLab API支持按提交消息搜索
      params.append('search', search);
    }

    return this.makeRequest<GitLabCommit[]>('GET', `/projects/${projectId}/repository/commits?${params}`);
  }

  /**
   * 创建合并请求
   */
  async createMergeRequest(projectId: number, options: MergeRequestOptions): Promise<MergeResult> {
    try {
      const mergeRequest = await this.makeRequest<GitLabMergeRequest>('POST', `/projects/${projectId}/merge_requests`, options);
      
      return {
        success: true,
        merge_request: mergeRequest,
        message: `合并请求已创建: ${mergeRequest.title}`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '创建合并请求失败',
        message: `创建合并请求失败: ${error.message || '未知错误'}`
      };
    }
  }

  /**
   * 创建Cherry Pick合并请求
   */
  async createCherryPickMergeRequests(projectId: number, options: CherryPickOptions): Promise<CherryPickResult[]> {
    const results: CherryPickResult[] = [];

    for (const targetBranch of options.target_branches) {
      try {
        // 为每个目标分支创建一个合并请求
        const title = `${options.title_prefix || 'Cherry-pick'}: ${options.commits.join(', ')} to ${targetBranch}`;
        
        const mergeRequestOptions: MergeRequestOptions = {
          title,
          description: options.description || `Cherry-pick commits: ${options.commits.join(', ')}`,
          source_branch: `cherry-pick-${Date.now()}-${targetBranch}`, // 临时分支名
          target_branch: targetBranch
        };

        // 注意：这里简化了实现，实际应该先创建分支并cherry-pick提交
        // 在生产环境中，需要通过Git命令或GitLab API来实际执行cherry-pick操作
        
        const result = await this.createMergeRequest(projectId, mergeRequestOptions);
        
        results.push({
          target_branch: targetBranch,
          success: result.success,
          merge_request: result.merge_request,
          error: result.error,
          message: result.message
        });
      } catch (error: any) {
        results.push({
          target_branch: targetBranch,
          success: false,
          error: error.message || '创建合并请求失败',
          message: `为分支 ${targetBranch} 创建合并请求失败: ${error.message || '未知错误'}`
        });
      }
    }

    return results;
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser() {
    return this.makeRequest('GET', '/user');
  }

  /**
   * 测试API连接
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.getCurrentUser();
      return {
        success: true,
        message: 'GitLab API 连接成功'
      };
    } catch (error: any) {
      return {
        success: false,
        message: `GitLab API 连接失败: ${error.message}`
      };
    }
  }

  /**
   * 搜索提交（支持消息和ID搜索）
   */
  async searchCommits(
    projectId: number,
    branch: string,
    keyword: string,
    page: number = 1,
    perPage: number = 20
  ): Promise<GitLabCommit[]> {
    // 首先尝试按提交消息搜索
    let commits = await this.getCommits(projectId, branch, keyword, page, perPage);

    // 如果关键词看起来像commit ID，也尝试精确搜索
    if (/^[a-f0-9]+$/i.test(keyword) && keyword.length >= 7) {
      try {
        const commit = await this.makeRequest<GitLabCommit>('GET', `/projects/${projectId}/repository/commits/${keyword}`);
        // 检查是否已存在，避免重复
        const exists = commits.some(c => c.id === commit.id);
        if (!exists) {
          commits = [commit, ...commits];
        }
      } catch (error) {
        // 如果精确搜索失败，忽略错误，只返回消息搜索结果
      }
    }

    return commits;
  }
}
