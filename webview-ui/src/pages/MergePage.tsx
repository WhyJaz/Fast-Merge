import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Radio, 
  Space, 
  Typography, 
  Divider,
  Alert,
  Spin,
  Button,
  Tag,
  Row,
  Col,
  Form
} from 'antd';
import { 
  BranchesOutlined, 
  NodeIndexOutlined,
  MergeOutlined,
  LinkOutlined
} from '@ant-design/icons';
import { ProjectSelector } from '../components/ProjectSelector';
import { BranchSelector } from '../components/BranchSelector';
import { CommitSelector } from '../components/CommitSelector';
import { MergeStatus } from '../components/MergeStatus';
import { useGitLabApi } from '../hooks/useGitLabApi';
import { useConfig } from '../hooks/useConfig';
import { GitLabProject, MergeRequestOptions, CherryPickOptions } from '../types/gitlab';

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
    commitsState
  } = useGitLabApi();
  
  const { configInfo } = useConfig();

  // 状态管理
  const [selectedProject, setSelectedProject] = useState<GitLabProject>();
  const [mergeType, setMergeType] = useState<MergeType>('branch');
  const [sourceBranch, setSourceBranch] = useState<string>();
  const [targetBranch, setTargetBranch] = useState<string>();
  const [selectedCommits, setSelectedCommits] = useState<string[]>([]);
  const [targetBranches, setTargetBranches] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // 初始化，获取当前仓库信息
  useEffect(() => {
    getCurrentRepo();
  }, [getCurrentRepo]);

  // 处理当前仓库信息
  useEffect(() => {
    if (currentRepoState.data && !currentRepoState.loading) {
      const repoInfo = currentRepoState.data;
      if (repoInfo.isGitRepository && repoInfo.currentBranch) {
        setSourceBranch(repoInfo.currentBranch);
      }
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
      // 项目变化时重置分支和提交选择
      setTargetBranch(undefined);
      setSelectedCommits([]);
      setTargetBranches([]);
    }
  }, [selectedProject]);

  // 当源分支变化且为cherry-pick模式时，自动获取最新提交
  useEffect(() => {
    if (selectedProject && sourceBranch && mergeType === 'cherry-pick') {
      // 自动获取该分支的最新提交并选中第一个
      getCommits(selectedProject.id, sourceBranch, '', 1, 1);
    }
  }, [selectedProject, sourceBranch, mergeType, getCommits]);

  // 监听提交数据，自动选择最新的提交（仅在cherry-pick模式且当前没有选择时）
  useEffect(() => {
    if (
      mergeType === 'cherry-pick' && 
      commitsState.data && 
      commitsState.data.length > 0 && 
      selectedCommits.length === 0
    ) {
      // 自动选择最近的提交
      setSelectedCommits([commitsState.data[0].id]);
    }
  }, [commitsState.data, mergeType, selectedCommits.length]);

  const handleSubmit = async () => {
    if (!selectedProject) return;

    setIsSubmitting(true);

    if (mergeType === 'branch') {
      const options: MergeRequestOptions = {
        title: `Merge ${sourceBranch} into ${targetBranch}`,
        description: `自动创建的合并请求：将 ${sourceBranch} 分支合并到 ${targetBranch} 分支`,
        source_branch: sourceBranch!,
        target_branch: targetBranch!,
        remove_source_branch: false,
        squash: false
      };
      
      createMergeRequest(selectedProject.id, options);
    } else {
      const options: CherryPickOptions = {
        commits: selectedCommits,
        target_branches: targetBranches,
        title_prefix: 'Cherry-pick',
        description: `Cherry-pick 提交 ${selectedCommits.join(', ')} 到目标分支`
      };
      
      createCherryPickMR(selectedProject.id, options);
    }
  };

  const handleReset = () => {
    setSelectedCommits([]);
    setTargetBranches([]);
    setIsSubmitting(false);
    setShowResults(false);
  };

  const canSubmit = () => {
    if (!selectedProject) return false;
    
    if (mergeType === 'branch') {
      return sourceBranch && targetBranch && sourceBranch !== targetBranch;
    } else {
      return selectedCommits.length > 0 && targetBranches.length > 0;
    }
  };

  return (
    <div style={{ padding: 16 }}>
      {/* GitLab 连接状态 */}
      {configInfo.baseUrl && (
        <Alert
          message={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <LinkOutlined />
                <Text strong>GitLab: {configInfo.baseUrl}</Text>
                <Tag color={configInfo.isConnected ? 'success' : 'error'}>
                  {configInfo.isConnected ? '已连接' : '连接失败'}
                </Tag>
              </Space>
              {!configInfo.isConnected && (
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  请检查配置文件中的服务器地址和访问令牌
                </Text>
              )}
            </div>
          }
          type={configInfo.isConnected ? 'success' : 'warning'}
          style={{ marginBottom: 16 }}
          showIcon={false}
        />
      )}

      {/* 当前工作区信息 */}
      {currentRepoState.loading ? (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Spin />
            <div style={{ marginTop: 8 }}>获取工作区信息中...</div>
          </div>
        </Card>
      ) : currentRepoState.data?.isGitRepository ? (
        <Alert
          message={
            <Space direction="vertical" size="small">
              <span style={{fontSize: '16px', color: '#888'}}>工作区信息</span>
              {currentRepoState.data.gitlabProjectPath && (
                <div><Text strong>当前项目:</Text> {currentRepoState.data.gitlabProjectPath}</div>
              )}
              <div><Text strong>当前分支:</Text> {currentRepoState.data.currentBranch}</div>
            </Space>
          }
          type="info"
          style={{ marginBottom: 16 }}
        />
      ) : (
        <Alert 
          message="当前目录不是Git仓库" 
          type="warning" 
          style={{ marginBottom: 16 }} 
        />
      )}

      {/* 主要配置区域 */}
      <Card title="合并请求配置" style={{ marginBottom: 16 }}>
        <Form layout="vertical">
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label="GitLab 项目" required>
                <ProjectSelector
                  value={selectedProject}
                  onChange={setSelectedProject}
                  placeholder="搜索并选择 GitLab 项目"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label="合并类型" required>
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
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item 
                  label="源分支" 
                  required
                >
                  <BranchSelector
                    projectId={selectedProject?.id}
                    value={sourceBranch}
                    onChange={setSourceBranch}
                    placeholder="选择源分支"
                    defaultBranch={currentRepoState.data?.currentBranch}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item 
                  label="目标分支" 
                  required
                >
                  <BranchSelector
                    projectId={selectedProject?.id}
                    value={targetBranch}
                    onChange={setTargetBranch}
                    placeholder="选择目标分支"
                  />
                </Form.Item>
              </Col>
            </Row>
          ) : (
            <>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item 
                    label="源分支" 
                    required
                  >
                    <BranchSelector
                      projectId={selectedProject?.id}
                      value={sourceBranch}
                      onChange={setSourceBranch}
                      placeholder="选择源分支"
                      defaultBranch={currentRepoState.data?.currentBranch}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item 
                    label="选择提交" 
                    required
                  >
                    <CommitSelector
                      projectId={selectedProject?.id}
                      branch={sourceBranch}
                      value={selectedCommits}
                      onChange={(commits) => setSelectedCommits(Array.isArray(commits) ? commits : [commits || ''])}
                      placeholder="选择要cherry-pick的提交"
                      multiple={true}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item 
                    label="目标分支 (支持多选)" 
                    required
                  >
                    <BranchSelector
                      projectId={selectedProject?.id}
                      value={targetBranches.join(',')}
                      onChange={(branches) => {
                        // 这里需要处理多选逻辑，暂时简化处理
                        setTargetBranches(branches ? [branches] : []);
                      }}
                      placeholder="选择目标分支"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

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
        <Card title="合并结果">
          <MergeStatus
            mergeResult={mergeRequestState.data || undefined}
            cherryPickResults={cherryPickState.data || undefined}
            loading={isSubmitting}
            onReset={handleReset}
          />
        </Card>
      )}
    </div>
  );
};
