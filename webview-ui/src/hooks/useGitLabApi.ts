import { useCallback, useEffect, useState } from 'react';
import { vscode } from '../utils/vscode';
import { 
  GitLabProject, 
  GitLabBranch, 
  GitLabCommit, 
  GitRepository, 
  MergeRequestOptions, 
  CherryPickOptions, 
  MergeResult, 
  CherryPickResult,
  GitLabConfiguration,
  ResponseMessage 
} from '../types/gitlab';

interface ApiResponse<T> {
  loading: boolean;
  data: T | null;
  error: string | null;
}

export const useGitLabApi = () => {
  const [responses, setResponses] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as ResponseMessage;
      if (message.type === 'response') {
        const { requestType, success, data, error } = message.message;
        
        setResponses(prev => new Map(prev.set(requestType, { success, data, error })));
        setLoading(prev => new Map(prev.set(requestType, false)));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const sendRequest = useCallback((type: string, message?: any) => {
    // 清除之前的响应数据，防止显示旧结果
    setResponses(prev => {
      const newMap = new Map(prev);
      newMap.delete(type);
      return newMap;
    });
    setLoading(prev => new Map(prev.set(type, true)));
    vscode.postMessage({ type, message });
  }, []);

  const getApiState = useCallback(<T,>(requestType: string): ApiResponse<T> => {
    const response = responses.get(requestType);
    const isLoading = loading.get(requestType) || false;

    return {
      loading: isLoading,
      data: response?.success ? response.data : null,
      error: response?.success === false ? response.error : null
    };
  }, [responses, loading]);

  // API 方法
  const getProjects = useCallback((search?: string, page?: number, perPage?: number) => {
    sendRequest('gitlab:getProjects', { search, page, perPage });
  }, [sendRequest]);

  const getBranches = useCallback((projectId: number, search?: string) => {
    sendRequest('gitlab:getBranches', { projectId, search });
  }, [sendRequest]);

  const getCommits = useCallback((projectId: number, branch: string, search?: string, page?: number, perPage?: number) => {
    sendRequest('gitlab:getCommits', { projectId, branch, search, page, perPage });
  }, [sendRequest]);

  const createMergeRequest = useCallback((projectId: number, options: MergeRequestOptions) => {
    sendRequest('gitlab:createMergeRequest', { projectId, options });
  }, [sendRequest]);

  const createCherryPickMR = useCallback((projectId: number, options: CherryPickOptions) => {
    sendRequest('gitlab:createCherryPickMR', { projectId, options });
  }, [sendRequest]);

  const getCurrentRepo = useCallback(() => {
    sendRequest('gitlab:getCurrentRepo');
  }, [sendRequest]);

  const setConfiguration = useCallback((config: GitLabConfiguration) => {
    sendRequest('gitlab:setConfiguration', config);
  }, [sendRequest]);

  return {
    // API 状态获取
    getApiState,
    
    // API 方法
    getProjects,
    getBranches,
    getCommits,
    createMergeRequest,
    createCherryPickMR,
    getCurrentRepo,
    setConfiguration,

    // 便捷的状态获取器
    projectsState: getApiState<GitLabProject[]>('gitlab:getProjects'),
    branchesState: getApiState<GitLabBranch[]>('gitlab:getBranches'),
    commitsState: getApiState<GitLabCommit[]>('gitlab:getCommits'),
    mergeRequestState: getApiState<MergeResult>('gitlab:createMergeRequest'),
    cherryPickState: getApiState<CherryPickResult[]>('gitlab:createCherryPickMR'),
    currentRepoState: getApiState<GitRepository>('gitlab:getCurrentRepo'),
    configurationState: getApiState<any>('gitlab:setConfiguration'),
  };
};
