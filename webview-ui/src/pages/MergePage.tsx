import {
  BranchesOutlined,
  LinkOutlined,
  MergeOutlined,
  NodeIndexOutlined,
  SettingOutlined,
  ReloadOutlined,
  HistoryOutlined
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
  Tabs,
  Tag,
  Typography,
  message
} from 'antd';
import React, { useEffect, useState, useMemo } from 'react';
import { BranchSelector } from '../components/BranchSelector';
import { CommitSelector } from '../components/CommitSelector';
import { MergeStatus } from '../components/MergeStatus';
import { getName, ProjectSelector } from '../components/ProjectSelector';
import { useConfig } from '../hooks/useConfig';
import { useGitLabApi } from '../hooks/useGitLabApi';
import { CherryPickOptions, GitLabCommit, GitLabProject, MergeRequestOptions } from '../types/gitlab';
import { vscode, } from '../utils/vscode';
import { validateMr } from '../utils/tool';
import { MergeHistory } from '@/components/MergeHistory';

const { Text, Title } = Typography;

type MergeType = 'branch' | 'cherry-pick';
const globalState = {
}

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
  const [mergeType, setMergeType] = useState<MergeType>('cherry-pick');
  const [sourceBranch, setSourceBranch] = useState<string>();
  // 分支合并模式的目标分支
  const [targetBranch, setTargetBranch] = useState<string>('test');
  const [selectedCommits, setSelectedCommits] = useState<string[]>([]);
  const [selectedCommitDetails, setSelectedCommitDetails] = useState<GitLabCommit[]>([]); // 存储完整的commit信息
  // cherry-pick合并模式的目标分支
  const [targetBranches, setTargetBranches] = useState<string[]>(['test']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [mergeTitle, setMergeTitle] = useState<string>(''); // MR标题状态

  // 初始化，获取当前仓库信息
  useEffect(() => {
    getCurrentRepo();
  }, []);

  const projectName = useMemo(() => {
    return selectedProject?.path_with_namespace
  }, [selectedProject?.path_with_namespace])

  // 从工作区git信息，初始设置源分支和当前项目
  useEffect(() => {
    if (currentRepoState.data && !currentRepoState.loading) {
      const repoInfo = currentRepoState.data || {};
      const { currentBranch } = repoInfo;
      if (!sourceBranch && projectName === repoInfo.gitlabProjectPath) {
        setTimeout(() => {
          setSourceBranch(currentBranch)
        }, 1000)
      }
      !projectName && setSelectedProject({ ...repoInfo, needInit: true } as any)
    }
  }, [currentRepoState.data, currentRepoState.loading, projectName]);

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
      setTargetBranch('test');
      setSelectedCommits([]);
      setSelectedCommitDetails([]);
      setTargetBranches(['test']);
      setMergeTitle('');
    }
  }, [selectedProject]);

  const fetchCommits = () => {
    if (selectedProject?.id && sourceBranch) {
      getCommits(selectedProject?.id, sourceBranch, '', 1, 20);
    }
  }

  // 当源分支变化
  useEffect(() => {
    if (sourceBranch) {
      setSelectedCommits([]);
      setSelectedCommitDetails([]);
      // 自动获取该分支的最新提交并选中第一个
      fetchCommits()
    }
  }, [sourceBranch]);

  // 监听提交数据，自动选择最新的提交（仅在cherry-pick模式且当前没有选择时）
  useEffect(() => {
    if (
      sourceBranch &&
      commitsState.data &&
      commitsState.data.length > 0 &&
      selectedCommits.length === 0
    ) {
      // 自动选择最近的提交
      setSelectedCommits([commitsState.data[0].id]);
      setSelectedCommitDetails([commitsState.data[0]]);
    }
  }, [commitsState.data, sourceBranch, selectedCommits.length]);

  // 自动更新MR标题 - 当源分支或提交选择变化时
  useEffect(() => {
    if (!sourceBranch) return;
    if (commitsState.data && commitsState.data.length > 0) {
      if (mergeType === 'branch') {
        // Branch模式：使用最新commit的标题
        setMergeTitle(commitsState.data[0].title);
      } else if (mergeType === 'cherry-pick') {
        // Cherry-pick模式：根据选择的提交更新标题
        if (selectedCommitDetails.length > 0) {
          // 取时间最近的commit作为标题
          const latestCommit = selectedCommitDetails.reduce((latest, current) =>
            new Date(current.committed_date) > new Date(latest.committed_date) ? current : latest
          );
          setMergeTitle(latestCommit.title);
        } else {
          // 如果没有选择具体提交，使用最新提交
          setMergeTitle(commitsState.data[0].title);
        }
      }
    }
  }, [commitsState.data, mergeType, selectedCommitDetails, sourceBranch]);

  // 当合并类型变化时，清空相关选择
  useEffect(() => {
    // 修复规则3：切换合并类型时清空提交和目标分支选择
    setSelectedCommits([]);
    setSelectedCommitDetails([]);
    setTargetBranches(['test']);
    setTargetBranch('test');
  }, [mergeType]);


  // 自动存储20条记录记录
  useEffect(() => {
    const data = mergeRequestState.data || cherryPickState.data;
    const options = mergeRequestState?.options || cherryPickState?.options || {};
    const { timestamp } = options;
    if (selectedProject?.id && isSubmitting && data) {
      // console.log("options", options)
      const submittingHistory = JSON.parse(localStorage.getItem("submittingHistory") || '[]');
      // console.log("last-submittingHistory", submittingHistory)
      const newSubmittingHistory = submittingHistory;
      const recordItem = { projectName: getName(selectedProject), timestamp, data };
      const recordIndex = submittingHistory.findIndex((item: any) => item.timestamp === timestamp);
      // 有匹配的，更新data即可
      if (recordIndex >= 0 && recordIndex < newSubmittingHistory.length) {
        newSubmittingHistory[recordIndex] = {
          ...newSubmittingHistory[recordIndex],
          data
        };
      } else {
        // 没有匹配的，直接插入数据
        submittingHistory.unshift(recordItem);
      }
      if (newSubmittingHistory.length > 20) {
        newSubmittingHistory.splice(20);
      }
      // console.log("new-submittingHistory", newSubmittingHistory)
      localStorage.setItem("submittingHistory", JSON.stringify(newSubmittingHistory))
    }
  }, [selectedProject?.id && isSubmitting, mergeRequestState.data, cherryPickState.data])

  // 处理commit选择变化
  const handleCommitChange = (commitIds: string | string[] | undefined) => {
    const ids = Array.isArray(commitIds) ? commitIds : (commitIds ? [commitIds] : []);
    setSelectedCommits(ids);
    // 从当前的commits状态中找到对应的完整信息
    if (commitsState.data && ids.length > 0) {
      const details = ids.map(id => commitsState.data!.find(commit => commit.id === id)).filter(Boolean) as GitLabCommit[];
      setSelectedCommitDetails(details);

      // 更新标题 - 取时间最近的commit
      if (details.length > 0) {
        const latestCommit = details.reduce((latest, current) =>
          new Date(current.committed_date) > new Date(latest.committed_date) ? current : latest
        );
        setMergeTitle(latestCommit.title);
      } else {
        setMergeTitle('');
      }
    } else {
      setSelectedCommitDetails([]);
      setMergeTitle('');
    }
  };

  // 刷新提交列表
  const handleRefreshCommits = () => {
    if (selectedProject && sourceBranch) {
      // 清空当前选择
      setSelectedCommits([]);
      setSelectedCommitDetails([]);
      // 重新获取提交列表
      getCommits(selectedProject.id, sourceBranch, '', 1, 20);
    }
  };

  const handleSubmit = async () => {
    if (!selectedProject) return;
    const timestamp = getNowTimestamp();
    const branchOptions: MergeRequestOptions = {
      timestamp,
      title: mergeTitle || `Merge ${sourceBranch} into ${targetBranch}`,
      description: `自动创建的合并请求：将 ${sourceBranch} 分支合并到 ${targetBranch} 分支`,
      source_branch: sourceBranch!,
      target_branch: targetBranch!,
      remove_source_branch: false,
      squash: false
    };
    const cherryPickOptions: CherryPickOptions = {
      timestamp,
      commits: selectedCommits,
      target_branches: targetBranches,
      title: mergeTitle || 'Cherry-pick',
      description: `Cherry-pick 提交 ${selectedCommits.join(', ')} 到目标分支`,
      commit_details: selectedCommitDetails.length > 0 ? selectedCommitDetails : undefined // 传递完整的commit信息
    };
    let options = null
    let mrFunc = null
    if (mergeType === 'branch') {
      options = branchOptions
      mrFunc = createMergeRequest
    } else {
      options = cherryPickOptions
      mrFunc = createCherryPickMR
    }
    if (!validateMr(options, mergeType)) {
      message.error('目标分支包含hotfix分支，mr标题或者commit应该包含v8-开头的bug号')
      return
    }
    mrFunc(selectedProject.id, options as any);
    // 清除之前的结果，准备显示新的merge request结果
    clearState('gitlab:createMergeRequest');
    clearState('gitlab:createCherryPickMR');
    setShowResults(false);
    setIsSubmitting(true);
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
              <div style={{ position: 'absolute', right: 6, top: 6 }}>
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
      <Tabs>
        <Tabs.TabPane closable={false} style={{ padding: 8 }} icon={<MergeOutlined />} tab="合并请求配置" key="item-1">
          {/* 主要配置区域 */}
          {/* <Card title="合并请求配置" style={{ marginBottom: 16 }}> */}
          <Form
            labelAlign='right'
            layout="horizontal"
            labelCol={{ flex: '100px' }}
            wrapperCol={{ flex: '1 1 0' }}
          >
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item
                  label="GitLab 项目"
                  required
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
                >
                  <Radio.Group
                    value={mergeType}
                    onChange={(e) => setMergeType(e.target.value)}
                  >
                    <Radio value="cherry-pick">
                      <Space>
                        <NodeIndexOutlined />
                        Cherry Pick
                      </Space>
                    </Radio>
                    <Radio value="branch">
                      <Space>
                        <BranchesOutlined />
                        Branch Merge
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
                    >
                      <BranchSelector
                        allowClear={false}
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
                    >
                      <BranchSelector
                        projectId={selectedProject?.id}
                        value={targetBranch}
                        onChange={(branch) => setTargetBranch(Array.isArray(branch) ? branch?.[0] : branch as any)}
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
                    >
                      <BranchSelector
                        allowClear={false}
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
                    >
                      <div style={{ display: 'flex', width: '100%', maxWidth: '100%' }}>
                        <div style={{ flex: '1 1 0', minWidth: 0, marginRight: 8 }}>
                          <CommitSelector
                            projectId={selectedProject?.id}
                            branch={sourceBranch}
                            value={selectedCommits}
                            onChange={handleCommitChange}
                            placeholder="选择要cherry-pick的提交（支持多选）"
                          />
                        </div>
                        <Button
                          icon={<ReloadOutlined />}
                          onClick={handleRefreshCommits}
                          disabled={!selectedProject || !sourceBranch || commitsState.loading}
                          loading={commitsState.loading}
                          title="刷新提交列表"
                          type="text"
                          style={{
                            color: 'var(--vscode-foreground)',
                            border: '1px solid var(--vscode-input-border)',
                            backgroundColor: 'var(--vscode-input-background)',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                            e.currentTarget.style.color = 'var(--vscode-foreground)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--vscode-input-background)';
                            e.currentTarget.style.color = 'var(--vscode-foreground)';
                          }}
                        />
                      </div>
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={24}>
                    <Form.Item
                      label="目标分支"
                      required
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

            <Row gutter={16}>
              <Col span={24}>
                <Form.Item
                  label="MR标题"
                  required
                >
                  <Input
                    value={mergeTitle}
                    onChange={(e) => setMergeTitle(e.target.value)}
                    placeholder="请输入合并请求标题"
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item style={{ marginBottom: 16, textAlign: 'center' }}>
              <Space>
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
                <Button
                  type="default"
                  size="large"
                  icon={<MergeOutlined />}
                  onClick={() => {
                    // 清除之前的结果
                    clearState('gitlab:getCommits');
                    clearState('gitlab:createMergeRequest');
                    clearState('gitlab:createCherryPickMR');


                    setSourceBranch(undefined); // 修复：添加清空源分支选择
                    // 目标分支
                    setSelectedCommits([]);
                    setSelectedCommitDetails([]);
                    setTargetBranches([]);
                    setTargetBranch('');
                    // MR标题
                    setMergeTitle('');



                    setShowResults(false);

                  }}
                  disabled={isSubmitting}
                  style={{ minWidth: 100 }}
                >重置</Button>
              </Space>
            </Form.Item>
          </Form>
          {/* </Card> */}

          {/* 结果展示区域 */}
          {showResults && (
            <MergeStatus
              mergeResult={mergeRequestState.data || undefined}
              cherryPickResults={cherryPickState.data || undefined}
              loading={isSubmitting}
              projectId={selectedProject?.id}
            />
          )}
        </Tabs.TabPane>
        <Tabs.TabPane closable={false} style={{ padding: 8 }} icon={<HistoryOutlined />} tab="历史记录" key="item-2">
          <MergeHistory
          />
        </Tabs.TabPane>
      </Tabs>

    </div>
  );
};

// 补零函数：确保数字为两位数（如 9 → "09"，12 → "12"）
export const padZero = (num: number) => {
  return num < 10 ? '0' + num : num.toString();
}




export const getNowTimestamp = () => {
  // 获取当前日期时间
  const date = new Date();
  const timestamp = date.getTime(); // 毫秒级时间戳
  return timestamp.toString();
}