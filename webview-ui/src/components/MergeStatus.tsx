import React from 'react';

// 声明 vscode 全局对象以便与 VS Code Webview 通信
declare const vscode: {
  postMessage: (message: { type: string; payload: any }) => void;
};

import { Typography, Space, Button, Tag, Table, message } from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LinkOutlined,
  BranchesOutlined,
  NodeIndexOutlined,
  CopyOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { MergeResult, CherryPickResult } from '../types/gitlab';

const { Text, Link } = Typography;

interface MergeStatusProps {
  mergeResult?: MergeResult;
  cherryPickResults?: CherryPickResult[];
  loading?: boolean;
  onMergeRequestClosed?: (mrIid: number) => void; // 新增属性
  closedMRs?: Set<number>; // 添加closedMRs属性
}

export const MergeStatus: React.FC<MergeStatusProps> = ({
  mergeResult,
  cherryPickResults,
  loading = false,
  onMergeRequestClosed,
  closedMRs = new Set() // 默认值
}) => {
  // 复制MR链接到剪贴板
  const copyMRLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      message.success('MR链接已复制到剪贴板');
    } catch (err) {
      message.error('复制失败，请手动复制');
    }
  };
  
  const closeMR = async (projectId: number, mrIid: number) => {
    if (!window.confirm('确定要关闭这个合并请求吗？')) {
      return;
    }
    
    try {
      // 调用GitLab API关闭MR
      await vscode.postMessage({
        type: 'gitlab:closeMergeRequest',
        payload: { projectId, mrIid }
      });
      
      // 显示成功提示
      message.success('合并请求已成功关闭');
      
      // 通知父组件更新状态
      if (onMergeRequestClosed) {
        onMergeRequestClosed(mrIid);
      }
    } catch (error) {
      message.error('关闭合并请求失败');
      console.error('关闭MR失败:', error);
    }
  };
  
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

  // 在getTableData方法中添加空值检查
  const getTableData = () => {
    const data: any[] = [];
    
    // 处理普通合并请求结果
    if (mergeResult && mergeResult.merge_request) {
      const hasConflicts = (mergeResult.merge_request as any)?.has_conflicts === true ||
                        mergeResult.merge_request?.merge_status === 'cannot_be_merged';
      
      // 检查是否已关闭
      const mrIid = mergeResult.merge_request.iid;
      const isClosed = mergeResult.merge_request.state === 'closed' || (mrIid !== undefined && closedMRs.has(mrIid));
      
      data.push({
        key: 'merge-result',
        type: 'Branch Merge',
        sourceBranch: mergeResult.merge_request.source_branch || '-',
        targetBranch: mergeResult.merge_request.target_branch || '-',
        title: mergeResult.merge_request.title || '-',
        status: isClosed ? '已关闭' : (mergeResult.success ? '成功' : '失败'),
        conflictStatus: hasConflicts ? '有冲突' : '无冲突',
        mrId: mergeResult.merge_request.iid,
        mrUrl: mergeResult.merge_request.web_url,
        message: mergeResult.message || mergeResult.error,
        projectId: mergeResult.merge_request.project_id,
        isClosed: isClosed
      });
    }
    
    // 处理Cherry Pick结果
    if (cherryPickResults && cherryPickResults.length > 0) {
      cherryPickResults.forEach((result, index) => {
        if (!result.merge_request) return;
        
        const hasConflicts = (result.merge_request as any)?.has_conflicts === true ||
                          result.merge_request?.merge_status === 'cannot_be_merged';
        
        // 检查是否已关闭
        const mrIid = result.merge_request.iid;
        const isClosed = result.merge_request.state === 'closed' || (mrIid !== undefined && closedMRs.has(mrIid));
        
        data.push({
          key: `cherry-pick-${index}`,
          type: 'Cherry Pick',
          sourceBranch: '-',
          targetBranch: result.target_branch,
          title: result.merge_request.title || '-',
          status: isClosed ? '已关闭' : (result.success ? '成功' : '失败'),
          conflictStatus: hasConflicts ? '有冲突' : '无冲突',
          mrId: result.merge_request.iid,
          mrUrl: result.merge_request.web_url,
          message: result.message || result.error,
          projectId: result.merge_request.project_id,
          isClosed: isClosed
        });
      });
    }
    
    return data;
  };
  
  const columns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
    },
    {
      title: '源分支',
      dataIndex: 'sourceBranch',
      key: 'sourceBranch',
      width: 120,
    },
    {
      title: '目标分支',
      dataIndex: 'targetBranch',
      key: 'targetBranch',
      width: 120,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: any) => (
        <Link href={record.mrUrl} target="_blank">
          {text}
        </Link>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (text: string, record: any) => {
        if (text === '成功') {
          return <Tag icon={<CheckCircleOutlined />} color="success">
            成功
          </Tag>;
        } else if (text === '失败') {
          return <Tag icon={<ExclamationCircleOutlined />} color="error">
            失败
          </Tag>;
        } else if (text === '已关闭') {
          return <Tag icon={<ExclamationCircleOutlined />} color="default">
            已关闭
          </Tag>;
        }
        return text;
      },
    },
    {
      title: '冲突',
      dataIndex: 'conflictStatus',
      key: 'conflictStatus',
      width: 120,
      render: (text: string) => {
        if (text === '有冲突') {
          return <Tag icon={<ExclamationCircleOutlined />} color="error">
            有冲突
          </Tag>;
        }
        return <Tag icon={<CheckCircleOutlined />} color="success">
          无冲突
        </Tag>;
      },
    },
    {
      title: '操作',
      dataIndex: 'operation',
      key: 'operation',
      width: 120,
      render: (text: string, record: any) => (
        <Space>
          <Button
            type="link"
            icon={<LinkOutlined />}
            onClick={() => copyMRLink(record.mrUrl)}
          >
            复制链接
          </Button>
          {!record.isClosed && (
            <Button
              type="link"
              icon={<DeleteOutlined />}
              onClick={() => closeMR(record.projectId, record.mrId)}
            >
              关闭
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={getTableData()}
      pagination={false}
      rowKey="key"
      size="small"
    />
  );
};
