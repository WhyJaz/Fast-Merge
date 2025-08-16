import React from 'react';
import { Card, Alert, Typography, Space, Button, List, Tag, Divider } from 'antd';
import { 
  CheckCircleOutlined, 
  ExclamationCircleOutlined, 
  LinkOutlined,
  BranchesOutlined,
  NodeIndexOutlined 
} from '@ant-design/icons';
import { MergeResult, CherryPickResult } from '../types/gitlab';

const { Title, Text, Link } = Typography;

interface MergeStatusProps {
  mergeResult?: MergeResult;
  cherryPickResults?: CherryPickResult[];
  loading?: boolean;
  onReset?: () => void;
}

export const MergeStatus: React.FC<MergeStatusProps> = ({
  mergeResult,
  cherryPickResults,
  loading = false,
  onReset
}) => {
  if (loading) {
    return (
      <Card style={{ marginTop: 16 }}>
        <div style={{ textAlign: 'center', padding: 20 }}>
          <BranchesOutlined 
            style={{ fontSize: 32, color: '#1890ff', marginBottom: 8 }} 
            spin 
          />
          <Title level={4} style={{ margin: 0 }}>合并进行中...</Title>
          <Text type="secondary">
            正在创建合并请求，请稍候
          </Text>
        </div>
      </Card>
    );
  }

  if (!mergeResult && (!cherryPickResults || cherryPickResults.length === 0)) {
    return null;
  }

  // 渲染单个合并结果
  const renderMergeResult = (result: MergeResult) => (
    <Alert
      message={result.success ? '合并请求创建成功' : '合并请求创建失败'}
      description={
        <div>
          <Text>{result.message}</Text>
          {result.merge_request && (
            <div style={{ marginTop: 8 }}>
              <Space direction="vertical" size="small">
                <div>
                  <Text strong>标题: </Text>
                  <Text>{result.merge_request.title}</Text>
                </div>
                <div>
                  <Text strong>源分支: </Text>
                  <Tag icon={<BranchesOutlined />} color="blue">
                    {result.merge_request.source_branch}
                  </Tag>
                  <Text> → </Text>
                  <Tag icon={<BranchesOutlined />} color="green">
                    {result.merge_request.target_branch}
                  </Tag>
                </div>
                <div>
                  <Link 
                    href={result.merge_request.web_url} 
                    target="_blank"
                  >
                    <LinkOutlined style={{ marginRight: 4 }} />
                    查看合并请求 #{result.merge_request.iid}
                  </Link>
                </div>
              </Space>
            </div>
          )}
        </div>
      }
      type={result.success ? 'success' : 'error'}
      icon={result.success ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
      style={{ marginTop: 16 }}
    />
  );

  // 渲染Cherry Pick结果列表
  const renderCherryPickResults = (results: CherryPickResult[]) => {
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return (
      <Card 
        title={
          <Space>
            <NodeIndexOutlined />
            Cherry Pick 结果
            <Tag color={successCount > 0 ? 'success' : 'default'}>
              成功: {successCount}
            </Tag>
            <Tag color={failureCount > 0 ? 'error' : 'default'}>
              失败: {failureCount}
            </Tag>
          </Space>
        }
        style={{ marginTop: 16 }}
      >
        <List
          dataSource={results}
          renderItem={(result, index) => (
            <List.Item key={index}>
              <div style={{ width: '100%' }}>
                <Alert
                  message={
                    <Space>
                      <Text strong>目标分支: {result.target_branch}</Text>
                      <Tag 
                        color={result.success ? 'success' : 'error'}
                        icon={result.success ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
                      >
                        {result.success ? '成功' : '失败'}
                      </Tag>
                    </Space>
                  }
                  description={
                    <div>
                      <Text>{result.message}</Text>
                      {result.merge_request && (
                        <div style={{ marginTop: 8 }}>
                          <Link 
                            href={result.merge_request.web_url} 
                            target="_blank"
                          >
                            <LinkOutlined style={{ marginRight: 4 }} />
                            查看合并请求 #{result.merge_request.iid}
                          </Link>
                        </div>
                      )}
                    </div>
                  }
                  type={result.success ? 'success' : 'error'}
                  style={{ border: 'none', padding: 0 }}
                />
              </div>
            </List.Item>
          )}
        />
      </Card>
    );
  };

  return (
    <div>
      {mergeResult && renderMergeResult(mergeResult)}
      
      {cherryPickResults && cherryPickResults.length > 0 && renderCherryPickResults(cherryPickResults)}
      
      {(mergeResult || (cherryPickResults && cherryPickResults.length > 0)) && onReset && (
        <>
          <Divider />
          <div style={{ textAlign: 'center' }}>
            <Button onClick={onReset}>
              创建新的合并请求
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
