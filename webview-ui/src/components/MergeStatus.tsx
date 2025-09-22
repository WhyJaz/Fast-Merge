import React, { useState } from 'react';
import { Typography, Space, Button, Tag, Table, message, Popconfirm, Tooltip } from 'antd';
import { 
  CheckCircleOutlined, 
  ExclamationCircleOutlined, 
  LinkOutlined,
  BranchesOutlined,
  NodeIndexOutlined,
  CopyOutlined,
  CloseOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { MergeResult, CherryPickResult } from '../types/gitlab';
import { useGitLabApi } from '../hooks/useGitLabApi';

// 移除自定义CSS动画，使用Antd内置的LoadingOutlined图标

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
  const [closedMrIds, setClosedMrIds] = useState<Set<string>>(new Set());

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
  const confirmCloseMr = async (projectId: number, mergeRequestIid: number, tempBranchName?: string) => {
    const mrKey = `${projectId}-${mergeRequestIid}`;
    setClosingMrId(mrKey);
    setConfirmVisible(null);
    
    try {
      await closeMergeRequest(projectId, mergeRequestIid, tempBranchName);
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
        // 将MR标记为已关闭
        setClosedMrIds(prev => new Set(prev).add(closingMrId));
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
      const mr = mergeResult.merge_request as any;
      const isConflictCheckCompleted = mr?.conflictCheckStatus === 'completed';
      const hasConflicts = isConflictCheckCompleted ? 
        (mr?.detailed_merge_status === 'conflict' || 
         mr?.merge_status === 'cannot_be_merged' ||
         mr?.detailed_merge_status === 'cannot_be_merged') : 
        null; // 如果还没校验完成，显示为null
      
      // 添加调试日志
      if (isConflictCheckCompleted) {
        console.log('DEBUG: 冲突状态判断', {
          iid: mr?.iid,
          title: mr?.title,
          merge_status: mr?.merge_status,
          detailed_merge_status: mr?.detailed_merge_status,
          has_conflicts: mr?.has_conflicts,
          hasConflicts: hasConflicts
        });
      }
      
      data.push({
        key: 'merge-result',
        type: 'Branch Merge',
        sourceBranch: mr?.source_branch || '-',
        targetBranch: mr?.target_branch || '-',
        title: mr?.title || '-',
        status: mergeResult.success ? '成功' : '失败',
        conflictStatus: isConflictCheckCompleted ? 
          (hasConflicts ? '有冲突' : '无冲突') : 
          '校验中',
        isConflictChecking: !isConflictCheckCompleted,
        mrId: mr?.iid,
        mrUrl: mr?.web_url,
        projectId: projectId,
        tempBranchName: undefined, // 普通合并请求没有临时分支
        message: mergeResult.message || mergeResult.error
      });
    }
    
    // 处理Cherry Pick结果
    if (cherryPickResults && cherryPickResults.length > 0) {
      cherryPickResults.forEach((result, index) => {
        const mr = result.merge_request as any;
        const isConflictCheckCompleted = mr?.conflictCheckStatus === 'completed';
        const hasConflicts = isConflictCheckCompleted ? 
          (mr?.detailed_merge_status === 'conflict' || 
           mr?.merge_status === 'cannot_be_merged' ||
           mr?.detailed_merge_status === 'cannot_be_merged') : 
          null;
        
        data.push({
          key: `cherry-pick-${index}`,
          type: 'Cherry Pick',
          sourceBranch: '-',
          targetBranch: result.target_branch,
          title: mr?.title || '-',
          status: result.success ? '成功' : '失败',
          conflictStatus: isConflictCheckCompleted ? 
            (hasConflicts ? '有冲突' : '无冲突') : 
            '校验中',
          isConflictChecking: !isConflictCheckCompleted,
          mrId: mr?.iid,
          mrUrl: mr?.web_url,
          projectId: projectId,
          tempBranchName: result.temp_branch_name, // 包含临时分支名称
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
            <Tooltip title={record.message || '操作失败'} placement="top">
              <Tag color="error" style={{ cursor: 'help' }}>
                <ExclamationCircleOutlined style={{ marginRight: 4, color: '#ff4d4f' }} />
                <span style={{ color: '#ff4d4f' }}>失败</span>
              </Tag>
            </Tooltip>
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
        
        if (record.isConflictChecking) {
          return (
            <Space>
              <Tag color="processing">
                <LoadingOutlined style={{ marginRight: 4 }} spin />
                校验中
              </Tag>
            </Space>
          );
        } else if (status === '有冲突') {
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
      width: 80,
      render: (_: any, record: any) => {
        const mrKey = `${record.projectId || 0}-${record.mrId}`;
        const isClosed = closedMrIds.has(mrKey);
        const isClosing = closingMrId === mrKey;
        
        if (!record.mrUrl || record.status !== '成功') {
          return null;
        }
        
        if (isClosed) {
          return (
            <Button 
              type="text" 
              size="small" 
              disabled
              style={{ color: '#999' }}
            >
              已关闭
            </Button>
          );
        }
        
        return (
          <Popconfirm
            title="确认关闭合并请求"
            description="确定要关闭这个合并请求吗？此操作不可撤销。"
            onConfirm={() => confirmCloseMr(record.projectId || 0, record.mrId, record.tempBranchName)}
            onCancel={cancelCloseMr}
            okText="确认关闭"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            open={confirmVisible === mrKey}
          >
            <Button 
              type="link" 
              size="small" 
              icon={<CloseOutlined />}
              onClick={() => showConfirm(mrKey)}
              loading={isClosing}
              danger
            >
              关闭
            </Button>
          </Popconfirm>
        );
      }
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
