import { FastMergeConfig } from '../utils/config-manager';
import { HttpClient } from './http-client';
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
  GitLabUser
} from '../shared/gitlab-types';

export class GitLabService {
  private httpClient: HttpClient;
  private config: FastMergeConfig | null = null;

  constructor(initialConfig?: FastMergeConfig) {
    this.httpClient = new HttpClient(initialConfig);
    this.config = initialConfig || null;
  }

  /**
   * 更新配置
   */
  updateConfig(config: FastMergeConfig): void {
    this.config = config;
    this.httpClient.updateConfig(config);
  }

  /**
   * 设置GitLab配置（为了向后兼容）
   */
  async setConfiguration(gitlabConfig: GitLabConfiguration): Promise<void> {
    if (!this.config) {
      // 如果没有完整配置，创建一个默认配置
      const defaultConfig: FastMergeConfig = {
        gitlab: gitlabConfig,
        merge: {
          removeSourceBranch: false,
          squash: false
        }
      };
      this.updateConfig(defaultConfig);
    } else {
      // 更新现有配置的GitLab部分
      this.config.gitlab = gitlabConfig;
      this.httpClient.updateConfig(this.config);
    }
  }

  /**
   * 获取项目列表
   */
  async getProjects(search?: string, page: number = 1, perPage: number = 20): Promise<GitLabProject[]> {
    const params: Record<string, string | number> = {
      page: page.toString(),
      per_page: perPage.toString(),
      membership: 'true',
      simple: 'true'
    };

    if (search) {
      params.search = search;
    }

    const response = await this.httpClient.get<GitLabProject[]>('/projects', params);
    return response.data;
  }

  /**
   * 根据项目路径获取项目
   */
  async getProjectByPath(projectPath: string): Promise<GitLabProject | null> {
    try {
      const encodedPath = encodeURIComponent(projectPath);
      const response = await this.httpClient.get<GitLabProject>(`/projects/${encodedPath}`);
      return response.data;
    } catch (error) {
      console.error('获取项目失败:', error);
      return null;
    }
  }

  /**
   * 获取项目分支列表
   */
  async getBranches(projectId: number, search?: string): Promise<GitLabBranch[]> {
    const params: Record<string, string | number> = {
      per_page: '100'
    };

    if (search) {
      params.search = search;
    }

    const response = await this.httpClient.get<GitLabBranch[]>(
      `/projects/${projectId}/repository/branches`,
      params
    );
    return response.data;
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
    const params: Record<string, string | number> = {
      ref_name: branch,
      page: page.toString(),
      per_page: perPage.toString()
    };

    if (search) {
      params.search = search;
    }

    const response = await this.httpClient.get<GitLabCommit[]>(
      `/projects/${projectId}/repository/commits`,
      params
    );
    return response.data;
  }

  /**
   * 创建合并请求
   */
  async createMergeRequest(projectId: number, options: MergeRequestOptions): Promise<MergeResult> {
    try {
      const response = await this.httpClient.post<GitLabMergeRequest>(
        `/projects/${projectId}/merge_requests`,
        options
      );
      
      return {
        success: true,
        merge_request: response.data,
        message: `合并请求已创建: ${response.data.title}`
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
  async getCurrentUser(): Promise<GitLabUser> {
    const response = await this.httpClient.get<GitLabUser>('/user');
    return response.data;
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
        const response = await this.httpClient.get<GitLabCommit>(
          `/projects/${projectId}/repository/commits/${keyword}`
        );
        // 检查是否已存在，避免重复
        const exists = commits.some(c => c.id === response.data.id);
        if (!exists) {
          commits = [response.data, ...commits];
        }
      } catch (error) {
        // 如果精确搜索失败，忽略错误，只返回消息搜索结果
      }
    }

    return commits;
  }

  /**
   * 获取合并请求列表
   */
  async getMergeRequests(
    projectId: number,
    state: 'opened' | 'closed' | 'merged' | 'all' = 'opened',
    page: number = 1,
    perPage: number = 20
  ): Promise<GitLabMergeRequest[]> {
    const params: Record<string, string | number> = {
      state,
      page: page.toString(),
      per_page: perPage.toString()
    };

    const response = await this.httpClient.get<GitLabMergeRequest[]>(
      `/projects/${projectId}/merge_requests`,
      params
    );
    return response.data;
  }

  /**
   * 获取单个合并请求详情
   */
  async getMergeRequest(projectId: number, mergeRequestIid: number): Promise<GitLabMergeRequest> {
    const response = await this.httpClient.get<GitLabMergeRequest>(
      `/projects/${projectId}/merge_requests/${mergeRequestIid}`
    );
    return response.data;
  }

  /**
   * 接受合并请求
   */
  async acceptMergeRequest(
    projectId: number,
    mergeRequestIid: number,
    options?: {
      merge_commit_message?: string;
      squash_commit_message?: string;
      should_remove_source_branch?: boolean;
      squash?: boolean;
    }
  ): Promise<GitLabMergeRequest> {
    const response = await this.httpClient.put<GitLabMergeRequest>(
      `/projects/${projectId}/merge_requests/${mergeRequestIid}/merge`,
      options
    );
    return response.data;
  }

  /**
   * 关闭合并请求
   */
  async closeMergeRequest(projectId: number, mergeRequestIid: number): Promise<GitLabMergeRequest> {
    const response = await this.httpClient.put<GitLabMergeRequest>(
      `/projects/${projectId}/merge_requests/${mergeRequestIid}`,
      { state_event: 'close' }
    );
    return response.data;
  }
}
