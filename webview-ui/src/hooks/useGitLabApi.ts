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
      const message = event.data as any;
      if (message.type === 'response') {
        const { requestType, success, data, error } = message.message;
        
        setResponses(prev => new Map(prev.set(requestType, { success, data, error })));
        setLoading(prev => new Map(prev.set(requestType, false)));
      } else if (message.type === 'gitlab:conflictStatusUpdate') {
        // 处理冲突状态更新消息
        const { projectId, mergeRequestIid, mergeRequest } = message;
        
        // 更新对应的MR状态
        setResponses(prev => {
          const newMap = new Map(prev);
          const mergeRequestKey = 'gitlab:createMergeRequest';
          const cherryPickKey = 'gitlab:createCherryPickMR';
          
          // 更新普通MR
          const mergeRequestData = newMap.get(mergeRequestKey);
          if (mergeRequestData?.success && mergeRequestData.data?.merge_request?.iid === mergeRequestIid) {
            const updatedData = {
              ...mergeRequestData,
              data: {
                ...mergeRequestData.data,
                merge_request: {
                  ...mergeRequestData.data.merge_request,
                  ...mergeRequest,
                  conflictCheckStatus: 'completed'
                }
              }
            };
            newMap.set(mergeRequestKey, updatedData);
          }
          
          // 更新Cherry Pick MR
          const cherryPickData = newMap.get(cherryPickKey);
          if (cherryPickData?.success && Array.isArray(cherryPickData.data)) {
            const updatedCherryPickData = cherryPickData.data.map((result: any) => {
              if (result.merge_request?.iid === mergeRequestIid) {
                return {
                  ...result,
                  merge_request: {
                    ...result.merge_request,
                    ...mergeRequest,
                    conflictCheckStatus: 'completed'
                  }
                };
              }
              return result;
            });
            
            newMap.set(cherryPickKey, {
              ...cherryPickData,
              data: updatedCherryPickData
            });
          }
          
          return newMap;
        });
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

  // 获取git工程信息
  const getProjects = useCallback((search?: string, page?: number, perPage?: number) => {
    sendRequest('gitlab:getProjects', { search, page, perPage });
  }, [sendRequest]);

  // 获取分支信息
  const getBranches = useCallback((projectId: number, search?: string) => {
    sendRequest('gitlab:getBranches', { projectId, search });
  }, [sendRequest]);

  // 获取commit信息
  const getCommits = useCallback((projectId: number, branch: string, search?: string, page?: number, perPage?: number) => {
    sendRequest('gitlab:getCommits', { projectId, branch, search, page, perPage });
  }, [sendRequest]);

  // 创建merge request
  const createMergeRequest = useCallback((projectId: number, options: MergeRequestOptions) => {
    sendRequest('gitlab:createMergeRequest', { projectId, options });
  }, [sendRequest]);

  // 创建一个cherry pick merge request
  const createCherryPickMR = useCallback((projectId: number, options: CherryPickOptions) => {
    sendRequest('gitlab:createCherryPickMR', { projectId, options });
  }, [sendRequest]);

  // 关闭合并请求
  const closeMergeRequest = useCallback((projectId: number, mergeRequestIid: number) => {
    sendRequest('gitlab:closeMergeRequest', { projectId, mergeRequestIid });
  }, [sendRequest]);

  // 获取当前工作区仓库信息
  const getCurrentRepo = useCallback(() => {
    sendRequest('gitlab:getCurrentRepo');
  }, [sendRequest]);

  // 设置gitlab配置
  const setConfiguration = useCallback((config: GitLabConfiguration) => {
    sendRequest('gitlab:setConfiguration', config);
  }, [sendRequest]);

  const clearState = useCallback(() => {
    setResponses(new Map());
    setLoading(new Map());
  }, []);

  return {
    // API 状态获取
    getApiState,
    
    // API 方法
    getProjects,
    getBranches,
    getCommits,
    createMergeRequest,
    createCherryPickMR,
    closeMergeRequest,
    getCurrentRepo,
    setConfiguration,
    clearState,
    // 便捷的状态获取器
    projectsState: getApiState<GitLabProject[]>('gitlab:getProjects'),
    branchesState: getApiState<GitLabBranch[]>('gitlab:getBranches'),
    commitsState: getApiState<GitLabCommit[]>('gitlab:getCommits'),
    mergeRequestState: getApiState<MergeResult>('gitlab:createMergeRequest'),
    cherryPickState: getApiState<CherryPickResult[]>('gitlab:createCherryPickMR'),
    closeMergeRequestState: getApiState<any>('gitlab:closeMergeRequest'),
    currentRepoState: getApiState<GitRepository>('gitlab:getCurrentRepo'),
    configurationState: getApiState<any>('gitlab:setConfiguration'),
  };
};
