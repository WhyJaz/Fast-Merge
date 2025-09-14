import React, { useState } from 'react';
import { Typography, Space, Button, Tag, Table, message, Popconfirm } from 'antd';
import { 
  CheckCircleOutlined, 
  ExclamationCircleOutlined, 
  LinkOutlined,
  BranchesOutlined,
  NodeIndexOutlined,
  CopyOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { MergeResult, CherryPickResult } from '../types/gitlab';
import { useGitLabApi } from '../hooks/useGitLabApi';

const { Text, Link } = Typography;

interface MergeStatusProps {
  mergeResult?: MergeResult;
  cherryPickResults?: CherryPickResult[];
  loading?: boolean;
  projectId?: number;
}

export const MergeStatus: React.FC<MergeStatusProps> = ({
  mergeResult,
  cherryPickResults,
  loading = false,
  projectId
}) => {
  const { closeMergeRequest, closeMergeRequestState } = useGitLabApi();
  const [closingMrId, setClosingMrId] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState<string | null>(null);

  // 复制MR链接到剪贴板
  const copyMRLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      message.success('MR链接已复制到剪贴板');
    } catch (err) {
      message.error('复制失败，请手动复制');
    }
  };

  // 确认关闭MR
  const confirmCloseMr = async (projectId: number, mergeRequestIid: number) => {
    const mrKey = `${projectId}-${mergeRequestIid}`;
    setClosingMrId(mrKey);
    setConfirmVisible(null);
    
    try {
      await closeMergeRequest(projectId, mergeRequestIid);
    } catch (error) {
      message.error('关闭MR请求发送失败');
    }
  };

  // 取消关闭MR
  const cancelCloseMr = () => {
    setConfirmVisible(null);
  };

  // 显示确认弹窗
  const showConfirm = (mrKey: string) => {
    setConfirmVisible(mrKey);
  };

  // 监听关闭MR状态
  React.useEffect(() => {
    if (!closeMergeRequestState.loading && closingMrId) {
      if (closeMergeRequestState.data) {
        message.success('MR已成功关闭');
        // 更新UI状态
        setClosingMrId(null);
      } else if (closeMergeRequestState.error) {
        message.error(`关闭MR失败: ${closeMergeRequestState.error}`);
        setClosingMrId(null);
      }
    }
  }, [closeMergeRequestState, closingMrId]);
  if (loading) {
    return (
      <div style={{ marginTop: 16, textAlign: 'center', padding: 20 }}>
        <BranchesOutlined 
          style={{ fontSize: 32, color: '#1890ff', marginBottom: 8 }} 
          spin 
        />
        <div style={{ fontSize: '16px', fontWeight: 600, margin: '8px 0' }}>合并进行中...</div>
        <Text type="secondary">
          正在创建合并请求，请稍候
        </Text>
      </div>
    );
  }

  if (!mergeResult && (!cherryPickResults || cherryPickResults.length === 0)) {
    return null;
  }

  // 准备表格数据
  const getTableData = () => {
    const data: any[] = [];
    
    // 处理普通合并请求结果
    if (mergeResult) {
      const hasConflicts = (mergeResult.merge_request as any)?.has_conflicts === true || 
                        mergeResult.merge_request?.merge_status === 'cannot_be_merged';
      
      data.push({
        key: 'merge-result',
        type: 'Branch Merge',
        sourceBranch: mergeResult.merge_request?.source_branch || '-',
        targetBranch: mergeResult.merge_request?.target_branch || '-',
        title: mergeResult.merge_request?.title || '-',
        status: mergeResult.success ? '成功' : '失败',
        conflictStatus: hasConflicts ? '有冲突' : '无冲突',
        mrId: mergeResult.merge_request?.iid,
        mrUrl: mergeResult.merge_request?.web_url,
        projectId: projectId,
        message: mergeResult.message || mergeResult.error
      });
    }
    
    // 处理Cherry Pick结果
    if (cherryPickResults && cherryPickResults.length > 0) {
      cherryPickResults.forEach((result, index) => {
        const hasConflicts = (result.merge_request as any)?.has_conflicts === true || 
                          result.merge_request?.merge_status === 'cannot_be_merged';
        
        data.push({
          key: `cherry-pick-${index}`,
          type: 'Cherry Pick',
          sourceBranch: '-',
          targetBranch: result.target_branch,
          title: result.merge_request?.title || '-',
          status: result.success ? '成功' : '失败',
          conflictStatus: hasConflicts ? '有冲突' : '无冲突',
          mrId: result.merge_request?.iid,
          mrUrl: result.merge_request?.web_url,
          projectId: projectId,
          message: result.message || result.error
        });
      });
    }
    
    return data;
  };

  // 表格列定义
  const columns = [
    {
      title: '目标分支',
      dataIndex: 'targetBranch',
      key: 'targetBranch',
      render: (branch: string, record: any) => (
        <Space>
          <Tag 
            color={record.status === '成功' ? 'green' : 'red'}
          >
            {branch}
          </Tag>
          {record.status === '失败' && (
            <Tag color="error">
              失败
            </Tag>
          )}
        </Space>
      )
    },
    {
      title: '冲突状态',
      dataIndex: 'conflictStatus',
      key: 'conflictStatus',
      render: (status: string, record: any) => {
        if (!record.mrUrl) return <span style={{ color: '#999' }}>-</span>;
        
        if (status === '有冲突') {
          return <Tag color="error">有冲突</Tag>;
        } else {
          return <Tag color="success">无冲突</Tag>;
        }
      }
    },
    {
      title: 'MR链接',
      dataIndex: 'mrUrl',
      key: 'mrUrl',
      render: (url: string, record: any) => url ? (
        <Space>
          <Link href={url + '/diffs'} target="_blank">
            <LinkOutlined /> #{record.mrId}
          </Link>
          <Button 
            type="text" 
            size="small" 
            icon={<CopyOutlined />}
            onClick={() => copyMRLink(url)}
            title="复制MR链接"
          />
        </Space>
      ) : (
        <span style={{ color: '#999' }}>创建失败</span>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: any) => record.mrUrl && record.status === '成功' ? (
        <Popconfirm
          title="确认关闭合并请求"
          description="确定要关闭这个合并请求吗？此操作不可撤销。"
          onConfirm={() => confirmCloseMr(record.projectId || 0, record.mrId)}
          onCancel={cancelCloseMr}
          okText="确认关闭"
          cancelText="取消"
          okButtonProps={{ danger: true }}
          open={confirmVisible === `${record.projectId || 0}-${record.mrId}`}
        >
          <Button 
            type="link" 
            size="small" 
            icon={<CloseOutlined />}
            onClick={() => showConfirm(`${record.projectId || 0}-${record.mrId}`)}
            loading={closingMrId === `${record.projectId || 0}-${record.mrId}`}
            danger
          >
            关闭
          </Button>
        </Popconfirm>
      ) : null
    }
  ];

  const tableData = getTableData();
  const successCount = tableData.filter(item => item.status === '成功').length;
  const failureCount = tableData.length - successCount;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Text strong>合并请求结果</Text>
          <Tag color={successCount > 0 ? 'success' : 'default'}>
            成功: {successCount}
          </Tag>
          <Tag color={failureCount > 0 ? 'error' : 'default'}>
            失败: {failureCount}
          </Tag>
        </Space>
        <Button 
          icon={<CopyOutlined />}
          onClick={async () => {
            const urls = tableData
              .filter(item => item.mrUrl && item.status === '成功')
              .map(item => item.mrUrl)
              .join('\n');
            if (urls) {
              try {
                await navigator.clipboard.writeText(urls);
                message.success('所有成功的MR链接已复制');
              } catch (err) {
                message.error('复制失败，请手动复制');
              }
            }
          }}
          disabled={successCount === 0}
        >
          复制所有链接
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={tableData}
        pagination={false}
        size="middle"
        showHeader={true}
      />
    </div>
  );
};
