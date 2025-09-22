// GitLab API 相关类型定义

export interface GitLabProject {
  id: number;
  name: string;
  name_with_namespace: string;
  path: string;
  path_with_namespace: string;
  description?: string;
  web_url: string;
  ssh_url_to_repo: string;
  http_url_to_repo: string;
  default_branch: string;
  namespace: {
    id: number;
    name: string;
    path: string;
    kind: string;
    full_path: string;
  };
  // 添加扩展属性用于前端使用
  needInit?: boolean;
  gitlabProjectPath?: string;
}

export interface GitLabBranch {
  name: string;
  merged: boolean;
  protected: boolean;
  default: boolean;
  developers_can_push: boolean;
  developers_can_merge: boolean;
  can_push: boolean;
  web_url: string;
  commit: {
    id: string;
    short_id: string;
    title: string;
    author_name: string;
    author_email: string;
    authored_date: string;
    committer_name: string;
    committer_email: string;
    committed_date: string;
    created_at: string;
    message: string;
    web_url: string;
  };
}

export interface GitLabCommit {
  id: string;
  short_id: string;
  title: string;
  message: string;
  author_name: string;
  author_email: string;
  authored_date: string;
  committer_name: string;
  committer_email: string;
  committed_date: string;
  created_at: string;
  web_url: string;
  parent_ids: string[];
  stats?: {
    additions: number;
    deletions: number;
    total: number;
  };
}

export interface GitLabMergeRequest {
  id: number;
  iid: number;
  title: string;
  description: string;
  state: 'opened' | 'closed' | 'merged';
  merge_status: 'can_be_merged' | 'cannot_be_merged' | 'checking';
  detailed_merge_status?: 'mergeable' | 'conflict' | 'unchecked' | 'checking' | 'cannot_be_merged' | 'cannot_be_merged_recheck';
  has_conflicts?: boolean;
  source_branch: string;
  target_branch: string;
  author: {
    id: number;
    name: string;
    username: string;
    email: string;
    avatar_url: string;
  };
  web_url: string;
  created_at: string;
  updated_at: string;
  merged_at?: string;
  closed_at?: string;
  merge_commit_sha?: string;
  // 添加冲突校验状态
  conflictCheckStatus?: 'checking' | 'completed' | 'failed';
}

export interface GitLabUser {
  id: number;
  name: string;
  username: string;
  email: string;
  avatar_url: string;
  state: string;
  web_url: string;
}

export interface GitLabConfiguration {
  baseUrl: string;
  token: string;
  projectId?: number;
}

export interface MergeRequestOptions {
  title: string;
  description?: string;
  source_branch: string;
  target_branch: string;
  remove_source_branch?: boolean;
  squash?: boolean;
  assignee_id?: number;
  reviewer_ids?: number[];
  labels?: string[];
}

export interface CherryPickOptions {
  commits: string[];
  target_branches: string[];
  title_prefix?: string;
  title?: string; // 添加完整标题字段
  description?: string;
  commit_details?: GitLabCommit[]; // 添加commit详细信息
}

export interface MergeResult {
  success: boolean;
  merge_request?: GitLabMergeRequest;
  error?: string;
  message?: string;
}

export interface CherryPickResult {
  target_branch: string;
  success: boolean;
  merge_request?: GitLabMergeRequest;
  temp_branch_name?: string; // 添加临时分支名称字段
  error?: string;
  message?: string;
}

export interface GitLabApiResponse<T> {
  data: T;
  headers: Record<string, string>;
  status: number;
}

export interface GitLabUser {
  id: number;
  name: string;
  username: string;
  email: string;
  avatar_url: string;
  state: string;
  web_url: string;
}

export interface GitRepository {
  workspaceFolder: string;
  remoteUrl: string;
  currentBranch: string;
  isGitRepository: boolean;
  gitlabProjectPath?: string;
  gitlabBaseUrl?: string;
}

export interface ResponseMessage {
  type: 'response';
  message: {
    requestType: string;
    success: boolean;
    data?: any;
    error?: string;
  };
}

export interface GitLabApiError {
  message: string;
  error_description?: string;
  error?: string;
  status?: number;
}
