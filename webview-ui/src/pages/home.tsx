import MergeHistory from '@/pages/history/MergeHistory';
import {
  HistoryOutlined,
  LinkOutlined,
  MergeOutlined,
  SettingOutlined,
  DeploymentUnitOutlined
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Space,
  Tabs,
  Tag,
  Typography
} from 'antd';
import React from 'react';
import { useConfig } from '../hooks/useConfig';
import { vscode, } from '../utils/vscode';
import DevopsPage from './devops';
import MergePage from './merge';
const { Text } = Typography;


const Home: React.FC = () => {
  const { configInfo } = useConfig();
  const tabs = [
    {
      key: 'item-1',
      icon: <MergeOutlined />,
      tab: '代码合并',
      component: <MergePage />,
      closable: false,
    },
    {
      key: 'item-2',
      icon: <DeploymentUnitOutlined />,
      tab: 'devops部署',
      component: <DevopsPage />,
      closable: false,
    },
    {
      key: 'item-3',
      icon: <HistoryOutlined />,
      tab: '历史记录',
      component: <MergeHistory />,
      closable: false,
    }
  ]

  return (
    <div style={{ padding: '0 8px' }}>
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
        {tabs.map((tab) => (
          <Tabs.TabPane key={tab.key} closable={tab.closable} style={{ padding: 8 }} icon={tab.icon} tab={tab.tab}>
            {tab.component}
          </Tabs.TabPane>
        ))}
      </Tabs>

    </div>
  );
};

export default Home;
