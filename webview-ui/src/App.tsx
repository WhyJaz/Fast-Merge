import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Typography, Button } from 'antd';
import { MergeOutlined, SettingOutlined } from '@ant-design/icons';
import { GitLabConfig } from './components/GitLabConfig';
import { MergePage } from './pages/MergePage';
import { useEvent } from 'react-use';
import { vscode } from './utils/vscode';

const { Content } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
  const [isConfigured, setIsConfigured] = useState(false);
  const [configError, setConfigError] = useState<string>('');
  const [isCheckingConfig, setIsCheckingConfig] = useState(true);
  const [configCheckTimeout, setConfigCheckTimeout] = useState<NodeJS.Timeout | null>(null);

  // 监听来自扩展层的消息
  const handleMessage = useCallback((event: MessageEvent) => {
    const message = event.data;
    
    switch (message.type) {
      case 'config:status':
        // 清除超时定时器
        if (configCheckTimeout) {
          clearTimeout(configCheckTimeout);
          setConfigCheckTimeout(null);
        }
        setIsConfigured(message.configured);
        setConfigError(message.error || '');
        setIsCheckingConfig(false);
        break;
      
      case 'config:updated':
        setIsConfigured(message.configured);
        setConfigError(message.error || '');
        break;
        
      default:
        // 其他消息类型
        break;
    }
  }, [configCheckTimeout]);

  useEvent('message', handleMessage);

  // 初始化时检查配置状态
  useEffect(() => {
    // 请求检查配置状态
    vscode.postMessage({ type: 'config:check' });
    
    // 设置超时，如果3秒后还没有收到响应，则停止检查状态
    const timeout = setTimeout(() => {
      console.warn('配置检查超时，可能扩展层未正确响应');
      setIsCheckingConfig(false);
      setConfigError('配置检查超时，请尝试重新加载插件');
    }, 3000);
    
    setConfigCheckTimeout(timeout);

    // 清理函数
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, []);


  if (isCheckingConfig) {
    return (
      <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <Content style={{ padding: 16, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <MergeOutlined 
              style={{ 
                fontSize: 48, 
                color: '#722ed1', 
                marginBottom: 16,
                animation: 'pulse 1.5s ease-in-out infinite alternate'
              }} 
            />
            <Title level={4} style={{ marginBottom: 8 }}>初始化 Fast Merge</Title>
            <div style={{ color: '#888' }}>正在检查配置状态...</div>
            <style>
              {`
                @keyframes pulse {
                  from { opacity: 1; }
                  to { opacity: 0.5; }
                }
              `}
            </style>
          </div>
        </Content>
      </Layout>
    );
  }

  console.log(isConfigured, 'isConfigured')
  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Content>
        {!isConfigured ? (
          <GitLabConfig 
            configError={configError}
          />
        ) : (
          <>
            <MergePage />
          </>
        )}
      </Content>
    </Layout>
  );
};

export default App;
