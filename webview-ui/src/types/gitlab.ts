// 重新导出共享的GitLab类型定义
export type {
  GitLabProject,
  GitLabBranch,
  GitLabCommit,
  GitLabMergeRequest,
  GitLabUser,
  GitRepository,
  MergeRequestOptions,
  CherryPickOptions,
  MergeResult,
  CherryPickResult,
  GitLabConfiguration,
  ResponseMessage,
  GitLabApiError
} from '../../../src/shared/gitlab-types';

interface GitLabMergeRequest {
  iid: number;
  project_id: number; // 添加project_id属性
  title: string;
  state: string;
  merge_status: string;
  has_conflicts: boolean;
  source_branch: string;
  target_branch: string;
  web_url: string;
}
