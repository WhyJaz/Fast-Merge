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
  private conflictCheckTimers: Map<string, NodeJS.Timeout> = new Map();
  private conflictCheckCallbacks: Map<string, (result: GitLabMergeRequest) => void> = new Map();

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
        gitlab: gitlabConfig
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
      per_page: '300' // 增加获取的分支数量，确保包含更多保护分支
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
      
      // 立即返回结果，不等待冲突校验
      console.log('DEBUG: MR创建成功，立即返回:', {
        iid: response.data.iid,
        title: response.data.title,
        merge_status: response.data.merge_status,
        detailed_merge_status: response.data.detailed_merge_status
      });
      
      return {
        success: true,
        merge_request: response.data,
        message: `合并请求已创建: ${response.data.title}（正在后台校验冲突状态）`
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
   * 创建新分支
   */
  async createBranch(projectId: number, branchName: string, ref: string): Promise<GitLabBranch> {
    const response = await this.httpClient.post<GitLabBranch>(
      `/projects/${projectId}/repository/branches`,
      { 
        branch: branchName,
        ref: ref
      }
    );
    return response.data;
  }

  /**
   * 删除分支
   */
  async deleteBranch(projectId: number, branchName: string): Promise<void> {
    await this.httpClient.delete(
      `/projects/${projectId}/repository/branches/${encodeURIComponent(branchName)}`
    );
  }



  /**
   * 检查合并请求的冲突状态
   */
  async checkMergeRequestConflicts(projectId: number, mergeRequestIid: number): Promise<GitLabMergeRequest> {
    const response = await this.httpClient.get<GitLabMergeRequest>(
      `/projects/${projectId}/merge_requests/${mergeRequestIid}`,
      { with_merge_status_recheck: 'true' }
    );
    return response.data;
  }

  /**
   * 轮询等待合并状态准备就绪（不再是checking状态）
   * @deprecated 此方法已废弃，请使用 startAsyncConflictCheck 进行异步冲突校验
   */
  async waitForMergeStatusReady(projectId: number, mergeRequestIid: number): Promise<GitLabMergeRequest> {
    const maxAttempts = 30; // 最多尝试30次，避免无限循环
    const intervalMs = 1000; // 每秒检查一次
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const mr = await this.checkMergeRequestConflicts(projectId, mergeRequestIid);
      
      // 如果detailed_merge_status存在且不是checking，说明状态已经确定，返回结果
      // 否则回退到使用merge_status进行检查
      const mergeStatus = mr.detailed_merge_status || mr.merge_status;
      if (mergeStatus !== 'checking' && mergeStatus !== 'unchecked') {
        console.log(`DEBUG: 合并状态已确定，尝试次数: ${attempt}, 状态: ${mergeStatus}`);
        return mr;
      }
      
      // 如果不是最后一次尝试，等待1秒后继续
      if (attempt < maxAttempts) {
        console.log(`DEBUG: 合并状态仍在检查中，第${attempt}次尝试，继续等待...`);
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
    
    // 如果达到最大尝试次数仍然是checking状态，返回最后一次的结果
    console.warn(`DEBUG: 达到最大尝试次数(${maxAttempts})，合并状态仍为checking`);
    return await this.checkMergeRequestConflicts(projectId, mergeRequestIid);
  }

  /**
   * 启动异步冲突校验
   */
  startAsyncConflictCheck(
    projectId: number, 
    mergeRequestIid: number, 
    onStatusUpdate: (result: GitLabMergeRequest) => void
  ): void {
    const key = `${projectId}-${mergeRequestIid}`;
    
    // 如果已经在校验中，先停止之前的校验
    this.stopAsyncConflictCheck(projectId, mergeRequestIid);
    
    console.log(`DEBUG: 启动异步冲突校验: ${key}`);
    
    // 保存回调函数
    this.conflictCheckCallbacks.set(key, onStatusUpdate);
    
    // 立即执行一次检查
    this.performConflictCheck(projectId, mergeRequestIid, 1);
  }

  /**
   * 停止异步冲突校验
   */
  stopAsyncConflictCheck(projectId: number, mergeRequestIid: number): void {
    const key = `${projectId}-${mergeRequestIid}`;
    
    const timer = this.conflictCheckTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.conflictCheckTimers.delete(key);
      console.log(`DEBUG: 停止异步冲突校验: ${key}`);
    }
    
    this.conflictCheckCallbacks.delete(key);
  }

  /**
   * 执行冲突检查
   */
  private async performConflictCheck(projectId: number, mergeRequestIid: number, attempt: number): Promise<void> {
    const key = `${projectId}-${mergeRequestIid}`;
    const maxAttempts = 30; // 最多尝试30次
    const intervalMs = 1000; // 每秒检查一次
    
    try {
      const mr = await this.checkMergeRequestConflicts(projectId, mergeRequestIid);
      
      // 如果detailed_merge_status存在且不是checking，说明状态已经确定
      const mergeStatus = mr.detailed_merge_status || mr.merge_status;
      if (mergeStatus !== 'checking' && mergeStatus !== 'unchecked') {
        console.log(`DEBUG: 异步冲突校验完成，尝试次数: ${attempt}`, {
          merge_status: mr.merge_status,
          detailed_merge_status: mr.detailed_merge_status,
          has_conflicts: mr.has_conflicts,
          iid: mr.iid,
          title: mr.title
        });
        
        // 调用回调函数通知状态更新
        const callback = this.conflictCheckCallbacks.get(key);
        if (callback) {
          callback(mr);
        }
        
        // 清理资源
        this.conflictCheckTimers.delete(key);
        this.conflictCheckCallbacks.delete(key);
        return;
      }
      
      // 如果还没达到最大尝试次数，继续检查
      if (attempt < maxAttempts) {
        console.log(`DEBUG: 异步冲突校验中，第${attempt}次尝试，继续等待...`);
        const timer = setTimeout(() => {
          this.performConflictCheck(projectId, mergeRequestIid, attempt + 1);
        }, intervalMs);
        this.conflictCheckTimers.set(key, timer);
      } else {
        // 达到最大尝试次数，返回最后一次结果
        console.warn(`DEBUG: 异步冲突校验达到最大尝试次数(${maxAttempts})，合并状态仍为checking`);
        const callback = this.conflictCheckCallbacks.get(key);
        if (callback) {
          callback(mr);
        }
        
        // 清理资源
        this.conflictCheckTimers.delete(key);
        this.conflictCheckCallbacks.delete(key);
      }
    } catch (error) {
      console.error(`DEBUG: 异步冲突校验失败: ${key}`, error);
      
      // 清理资源
      this.conflictCheckTimers.delete(key);
      this.conflictCheckCallbacks.delete(key);
    }
  }

  /**
   * 创建Cherry Pick合并请求
   */
  async createCherryPickMergeRequests(projectId: number, options: CherryPickOptions): Promise<CherryPickResult[]> {
    // 创建处理单个目标分支的异步函数
    const processBranch = async (targetBranch: string): Promise<CherryPickResult> => {
      const tempBranchName = `cherry-pick-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${targetBranch}`;
      
      try {
        // 基于目标分支创建临时分支
        await this.createBranch(projectId, tempBranchName, targetBranch);

        // 按时间顺序排序commits（如果有commit_details的话）
        let sortedCommits = options.commits;
        if (options.commit_details && options.commit_details.length > 0) {
          // 按committed_date排序，确保按时间顺序cherry-pick
          const commitMap = new Map(options.commit_details.map(commit => [commit.id, commit]));
          sortedCommits = options.commits
            .map(id => ({ id, commit: commitMap.get(id) }))
            .filter(item => item.commit) // 过滤掉找不到详情的commit
            .sort((a, b) => new Date(a.commit!.committed_date).getTime() - new Date(b.commit!.committed_date).getTime())
            .map(item => item.id);
        }

        // 按顺序执行cherry-pick操作（不是并发）
        for (const commitId of sortedCommits) {
          try {
            // 使用GitLab API的cherry-pick功能
            await this.httpClient.post(
              `/projects/${projectId}/repository/commits/${commitId}/cherry_pick`,
              { branch: tempBranchName }
            );
          } catch (cherryPickError: any) {
            // 如果cherry-pick失败，清理临时分支并返回错误
            await this.deleteBranch(projectId, tempBranchName);
            throw new Error(`Cherry-pick commit ${commitId} 失败: ${cherryPickError.message}`);
          }
        }

        // 创建合并请求
        let title = '';
        if (options.title) {
          // 优先使用用户提供的完整标题
          title = options.title;
        } else if (options.commit_details && options.commit_details.length > 0) {
          title = `${options.title_prefix || 'Cherry-pick'}: ${options.commit_details[0].title}`;
        } else {
          title = `${options.title_prefix || 'Cherry-pick'}: ${options.commits.join(', ')} to ${targetBranch}`;
        }
        
        const mergeRequestOptions: MergeRequestOptions = {
          title,
          description: options.description || `Cherry-pick commits: ${options.commits.join(', ')}`,
          source_branch: tempBranchName,
          target_branch: targetBranch,
          remove_source_branch: true  // 合并后自动删除临时分支
        };

        const result = await this.createMergeRequest(projectId, mergeRequestOptions);
        
        if (result.success && result.merge_request) {
          return {
            target_branch: targetBranch,
            success: true,
            merge_request: result.merge_request,
            temp_branch_name: tempBranchName, // 保存临时分支名称
            message: `成功创建 Cherry-pick 合并请求到分支 ${targetBranch}`
          };
        } else {
          return {
            target_branch: targetBranch,
            success: false,
            temp_branch_name: tempBranchName, // 即使失败也保存临时分支名称，用于清理
            error: result.error,
            message: result.message || `创建 Cherry-pick 合并请求失败`
          };
        }
      } catch (error: any) {
        // 如果操作失败，尝试清理可能创建的临时分支
        try {
          await this.deleteBranch(projectId, tempBranchName);
        } catch (deleteError) {
          // 忽略删除分支的错误
        }

        return {
          target_branch: targetBranch,
          success: false,
          temp_branch_name: tempBranchName, // 保存临时分支名称用于清理
          error: error.message || 'Cherry-pick 操作失败',
          message: `${error.message || '未知错误'}`
        };
      }
    };

    // 并发处理所有目标分支
    const promises = options.target_branches.map(targetBranch => processBranch(targetBranch));
    
    // 等待所有操作完成
    const results = await Promise.all(promises);
    
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
