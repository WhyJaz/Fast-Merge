import {
  BranchesOutlined,
  LinkOutlined,
  MergeOutlined,
  NodeIndexOutlined,
  SettingOutlined
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Radio,
  Row,
  Space,
  Tag,
  Typography
} from 'antd';
import React, { useEffect, useState } from 'react';
import { BranchSelector } from '../components/BranchSelector';
import { CommitSelector } from '../components/CommitSelector';
import { MergeStatus } from '../components/MergeStatus';
import { ProjectSelector } from '../components/ProjectSelector';
import { useConfig } from '../hooks/useConfig';
import { useGitLabApi } from '../hooks/useGitLabApi';
import { CherryPickOptions, GitLabCommit, GitLabProject, MergeRequestOptions } from '../types/gitlab';
import { vscode } from '../utils/vscode';

const { Text, Title } = Typography;

type MergeType = 'branch' | 'cherry-pick';

export const MergePage: React.FC = () => {
  const { 
    getCurrentRepo, 
    createMergeRequest, 
    createCherryPickMR,
    getCommits,
    currentRepoState,
    mergeRequestState,
    cherryPickState,
    commitsState,
    clearState
  } = useGitLabApi();
  
  const { configInfo } = useConfig();

  // 状态管理
  const [selectedProject, setSelectedProject] = useState<GitLabProject>();
  const [mergeType, setMergeType] = useState<MergeType>('branch');
  const [sourceBranch, setSourceBranch] = useState<string>();
  const [targetBranch, setTargetBranch] = useState<string>();
  const [selectedCommit, setSelectedCommit] = useState<string | undefined>(undefined);
  const [selectedCommitDetail, setSelectedCommitDetail] = useState<GitLabCommit | null>(null); // 存储完整的commit信息
  const [targetBranches, setTargetBranches] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [mergeTitle, setMergeTitle] = useState<string>(''); // MR标题状态

  // 初始化，获取当前仓库信息
  useEffect(() => {
    getCurrentRepo();
  }, [getCurrentRepo]);

  // 处理当前仓库信息 - 移除源分支默认值设置
  useEffect(() => {
    if (currentRepoState.data && !currentRepoState.loading) {
      const repoInfo = currentRepoState.data;
      // 不再自动设置源分支为当前分支，让用户手动选择
    }
  }, [currentRepoState]);

  // 监听合并请求状态
  useEffect(() => {
    if (!mergeRequestState.loading && isSubmitting && mergeRequestState.data) {
      setIsSubmitting(false);
      setShowResults(true);
    }
  }, [mergeRequestState, isSubmitting]);

  // 监听Cherry Pick状态
  useEffect(() => {
    if (!cherryPickState.loading && isSubmitting && cherryPickState.data) {
      setIsSubmitting(false);
      setShowResults(true);
    }
  }, [cherryPickState, isSubmitting]);

  // 当项目选择变化时，重置相关状态
  useEffect(() => {
    if (selectedProject) {
      // 项目变化时重置所有分支和提交选择
      setSourceBranch(undefined); // 修复：添加清空源分支选择
      setTargetBranch(undefined);
      setSelectedCommit(undefined);
      setSelectedCommitDetail(null);
      setTargetBranches([]);
      setMergeTitle('');
    }
  }, [selectedProject]);

  // 当源分支变化
  useEffect(() => {
    if (selectedProject && sourceBranch) {
      // 当源分支变化且为cherry-pick模式时，清空提交选择并自动获取最新提交
      if ( mergeType === 'cherry-pick') {
        // 修复：先清空之前选择的提交
        setSelectedCommit(undefined);
        setSelectedCommitDetail(null);
      }
      // 自动获取该分支的最新提交并选中第一个
      getCommits(selectedProject.id, sourceBranch, '', 1, 1);
    }
  }, [selectedProject, sourceBranch, mergeType, getCommits]);

  // 监听提交数据，自动选择最新的提交（仅在cherry-pick模式且当前没有选择时）
  // 同时设置默认MR标题
  useEffect(() => {
    if (
      mergeType === 'cherry-pick' && 
      commitsState.data && 
      commitsState.data.length > 0 && 
      !selectedCommit
    ) {
      // 自动选择最近的提交
      setSelectedCommit(commitsState.data[0].id);
      setSelectedCommitDetail(commitsState.data[0]);
    }
    
    // 设置默认标题
    if (commitsState.data && commitsState.data.length > 0) {
      if (mergeType === 'branch' && !mergeTitle) {
        // Branch模式默认使用最新commit的标题
        setMergeTitle(commitsState.data[0].title);
      } else if (mergeType === 'cherry-pick' && !mergeTitle) {
        // Cherry-pick模式保留现有逻辑
        const commit = commitsState.data[0];
        setMergeTitle(`Cherry-pick: ${commit.title}`);
      }
    }
  }, [commitsState.data, mergeType, selectedCommit, mergeTitle]);

  // 当合并类型变化时，清空相关选择
  useEffect(() => {
    // 修复规则3：切换合并类型时清空提交和目标分支选择
    setSelectedCommit(undefined);
    setTargetBranches([]);
    setTargetBranch(undefined);
    
    // 重新设置标题
    if (commitsState.data && commitsState.data.length > 0) {
      if (mergeType === 'branch') {
        setMergeTitle(commitsState.data[0].title);
      } else {
        const commit = commitsState.data[0];
        setMergeTitle(`Cherry-pick: ${commit.title}`);
      }
    } else {
      setMergeTitle('');
    }
  }, [mergeType, commitsState.data]);

  // 处理commit选择变化
  const handleCommitChange = (commitId: string | string[] | undefined) => {
    const id = Array.isArray(commitId) ? commitId[0] : commitId;
    setSelectedCommit(id);
    
    // 从当前的commits状态中找到对应的完整信息
    if (commitsState.data && id) {
      const detail = commitsState.data.find(commit => commit.id === id);
      setSelectedCommitDetail(detail || null);
      
      // 更新标题
      if (detail && mergeType === 'cherry-pick') {
        setMergeTitle(`Cherry-pick: ${detail.title}`);
      }
    } else {
      setSelectedCommitDetail(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedProject) return;
    
    // 清除之前的结果，准备显示新的merge request结果
    clearState();
    setShowResults(false);
    setIsSubmitting(true);

    if (mergeType === 'branch') {
      // 获取源分支最新commit用作标题
      const options: MergeRequestOptions = {
        title: mergeTitle || commitsState?.data?.[0]?.title || `Merge ${sourceBranch} into ${targetBranch}`,
        description: `自动创建的合并请求：将 ${sourceBranch} 分支合并到 ${targetBranch} 分支`,
        source_branch: sourceBranch!,
        target_branch: targetBranch!,
        remove_source_branch: false,
        squash: false
      };
      
      createMergeRequest(selectedProject.id, options);
    } else {
      const options: CherryPickOptions = {
        commits: selectedCommit ? [selectedCommit] : [],
        target_branches: targetBranches,
        title_prefix: 'Cherry-pick',
        description: `Cherry-pick 提交 ${selectedCommit} 到目标分支`,
        commit_details: selectedCommitDetail ? [selectedCommitDetail] : undefined // 传递完整的commit信息
      };
      
      createCherryPickMR(selectedProject.id, options);
    }
  };



  const canSubmit = () => {
    if (!selectedProject) return false;
    
    if (mergeType === 'branch') {
      return sourceBranch && targetBranch && sourceBranch !== targetBranch;
    } else {
      return selectedCommit && targetBranches.length > 0;
    }
  };

  return (
    <div style={{ padding: 16 }}>
      {/* GitLab 连接状态 */}
      {configInfo.baseUrl && (
        <Alert
          message={
            <div>
              <Space>
                <LinkOutlined />
                <Text strong>GitLab: {configInfo.baseUrl}</Text>
                <Tag color={configInfo.isConnected ? 'success' : 'error'}>
                  {configInfo.isConnected ? '已连接' : '连接失败'}
                </Tag>
              </Space>
              {!configInfo.isConnected && (
                <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                  请检查配置文件中的服务器地址和访问令牌
                </Text>
              )}
              <div style={{position: 'absolute', right: 6, top: 6}}>
                <Button 
                  icon={<SettingOutlined />}
                  onClick={() => vscode.postMessage({ type: 'config:open' })}
                  title="编辑 GitLab 配置文件"
                  type="default"
                  size="small"
                  
                >
                </Button>
              </div>
            </div>
          }
          type={configInfo.isConnected ? 'success' : 'warning'}
          style={{ marginBottom: 16 }}
          showIcon={false}
        />
      )}

      {/* 主要配置区域 */}
      <Card title="合并请求配置" style={{ marginBottom: 16 }}>
        <Form 
          layout="horizontal"
          labelCol={{ flex: '0 0 auto' }}
          wrapperCol={{ flex: '1 1 auto' }}
        >
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item 
                label="GitLab 项目" 
                required
                labelCol={{ flex: '0 0 auto' }}
                wrapperCol={{ flex: '1 1 auto' }}
              >
                <ProjectSelector
                  value={selectedProject}
                  onChange={setSelectedProject}
                  placeholder="可输入搜索，以选择 GitLab 项目"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item 
                label="合并类型" 
                required
                labelCol={{ flex: '0 0 auto' }}
                wrapperCol={{ flex: '1 1 auto' }}
              >
                <Radio.Group 
                  value={mergeType} 
                  onChange={(e) => setMergeType(e.target.value)}
                >
                  <Radio value="branch">
                    <Space>
                      <BranchesOutlined />
                      Branch Merge
                    </Space>
                  </Radio>
                  <Radio value="cherry-pick">
                    <Space>
                      <NodeIndexOutlined />
                      Cherry Pick
                    </Space>
                  </Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>

          
          {mergeType === 'branch' ? (
            <>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item 
                    label="源分支" 
                    required
                    labelCol={{ flex: '0 0 auto' }}
                    wrapperCol={{ flex: '1 1 auto' }}
                  >
                    <BranchSelector
                      projectId={selectedProject?.id}
                      value={sourceBranch}
                      onChange={(branch) => setSourceBranch(Array.isArray(branch) ? branch[0] : branch)}
                      placeholder="可输入进行搜索，以选择源分支"
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item 
                    label="目标分支" 
                    required
                    labelCol={{ flex: '0 0 auto' }}
                    wrapperCol={{ flex: '1 1 auto' }}
                  >
                    <BranchSelector
                      projectId={selectedProject?.id}
                      value={targetBranch}
                      onChange={(branch) => setTargetBranch(Array.isArray(branch) ? branch[0] : branch)}
                      placeholder="可输入进行搜索，以选择目标分支"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </>
          ) : (
            <>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item 
                    label="源分支" 
                    required
                    labelCol={{ flex: '0 0 auto' }}
                    wrapperCol={{ flex: '1 1 auto' }}
                  >
                    <BranchSelector
                      projectId={selectedProject?.id}
                      value={sourceBranch}
                      onChange={(branch) => setSourceBranch(Array.isArray(branch) ? branch[0] : branch)}
                      placeholder="可输入进行搜索，以选择源分支"
                    />
                  </Form.Item>
                </Col>
              </Row>
              
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item 
                    label="选择提交" 
                    required
                    labelCol={{ flex: '0 0 auto' }}
                    wrapperCol={{ flex: '1 1 auto' }}
                  >
                    <CommitSelector
                      projectId={selectedProject?.id}
                      branch={sourceBranch}
                      value={selectedCommit}
                      onChange={handleCommitChange}
                      placeholder="可输入搜索commit ID或信息，以选择要cherry-pick的提交"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item 
                    label="目标分支" 
                    required
                    labelCol={{ flex: '0 0 auto' }}
                    wrapperCol={{ flex: '1 1 auto' }}
                  >
                    <BranchSelector
                      projectId={selectedProject?.id}
                      value={targetBranches}
                      onChange={(branches) => {
                        if (Array.isArray(branches)) {
                          setTargetBranches(branches);
                        } else if (branches) {
                          setTargetBranches([branches]);
                        } else {
                          setTargetBranches([]);
                        }
                      }}
                      placeholder="可输入进行搜索，以选择目标分支(可多选)"
                      multiple={true}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {/* MR标题输入框 */}
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                label="MR标题"
                required
                labelCol={{ flex: '0 0 auto' }}
                wrapperCol={{ flex: '1 1 auto' }}
              >
                <Input
                  value={mergeTitle}
                  onChange={(e) => setMergeTitle(e.target.value)}
                  placeholder="请输入合并请求标题"
                />
              </Form.Item>
            </Col>
          </Row>


          <Form.Item style={{ marginBottom: 0, textAlign: 'center' }}>
            <Button 
              type="primary" 
              size="large" 
              icon={<MergeOutlined />}
              onClick={handleSubmit}
              disabled={!canSubmit()}
              loading={isSubmitting}
              style={{ minWidth: 200 }}
            >
              {isSubmitting ? '创建合并请求中...' : '创建合并请求'}
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 结果展示区域 */}
      {showResults && (
        <MergeStatus
          mergeResult={mergeRequestState.data || undefined}
          cherryPickResults={cherryPickState.data || undefined}
          loading={isSubmitting}
        />
      )}
    </div>
  );
};
