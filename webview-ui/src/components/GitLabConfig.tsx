import {
  ExclamationCircleOutlined,
  FileTextOutlined,
  QuestionCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { Alert, Button, Card, Steps, Typography } from 'antd';
import React from 'react';
import { vscode } from '../utils/vscode';

const { Title, Text, Paragraph } = Typography;

interface GitLabConfigProps {
  configError?: string;
}

export const GitLabConfig: React.FC<GitLabConfigProps> = ({ 
  configError 
}) => {

  const handleOpenConfig = async () => {
    vscode.postMessage({ type: 'config:open' });
  };

  const handleReloadConfig = () => {
    vscode.postMessage({ type: 'config:reload' });
  };


  return (
    <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title level={3} style={{ margin: 0, marginBottom: 8 }}>
          欢迎使用 Fast Merge
        </Title>
        <Text type="secondary" style={{ fontSize: '16px' }}>
          GitLab 合并助手 - 让合并请求创建变得简单高效
        </Text>
      </div>

      {configError && (
        <Alert
          message="配置检查失败"
          description={
            <div>
              <div>{configError}</div>
              {configError.includes('超时') && (
                <div style={{ fontSize: '12px', opacity: 0.8 }}>
                  可能原因：扩展未完全加载或配置文件权限问题
                </div>
              )}
            </div>
          }
          type="error"
          style={{ marginBottom: 24 }}
          icon={<ExclamationCircleOutlined />}
          action={
            <Button size="small" onClick={handleReloadConfig} icon={<ReloadOutlined />}>
              重新检查
            </Button>
          }
        />
      )}

      <Card title="配置步骤" style={{ marginBottom: 24 }}>
        <Steps 
          direction="vertical" 
          size="small"
          current={3}
          items={[
            {
              title: <div> 1. 点击下方按钮打开配置文件，编辑完成后请保存文件 <Button 
              type="primary" 
              size="middle"
              onClick={handleOpenConfig}
              icon={<FileTextOutlined />}
              style={{ minWidth: 160 }}
            >
             打开配置文件
            </Button></div>,
            },
            {
              title: '2. 在配置文件中填写您的 GitLab 服务器地址和访问令牌',
            },
            {
              title: <div>3. 保存配置文件后，请点击<Button size="small" onClick={handleReloadConfig} icon={<ReloadOutlined />}>
              重新检查
            </Button>按钮刷新页面</div>,
            }
          ]}
        />
      </Card>
      <div style={{ height: 24 }}></div>

      <Card title="配置说明" style={{ marginBottom: 24 }}>
        <Paragraph>
          <Text strong>GitLab 服务器地址：</Text>
          <br />
          • GitLab：<Text code>https://gitlab.seeyon.com</Text>
          <br />
        </Paragraph>
        
        <Paragraph>
          <Text strong>Access Token 配置说明：</Text>
          <br />
          1. 前往 GitLab Settings → Preferences → Access Tokens
          <br />
          2. 创建新的 Personal Access Token，填好 Name 和 Expires at
          <br />
          3. 确保勾选 Scopes下的各项 <Text code>api</Text> 权限
          <br />
          4. 复制生成的 token 到配置文件中
        </Paragraph>

        <Alert
          message="配置文件示例"
          description={
            <pre style={{ 
              background: '#f6f8fa', 
              padding: 12, 
              borderRadius: 4, 
              fontSize: '12px',
              overflow: 'auto'
            }}>
  {`{
    "gitlab": {
      "baseUrl": "https://gitlab.seeyon.com",
      "token": "xxxxxxxxxxxxxxxxxxxx"
    }
  }`}
            </pre>
          }
          type="info"
          icon={<QuestionCircleOutlined />}
          style={{ marginTop: 16 }}
        />
      </Card>
    </div>
  );
};
