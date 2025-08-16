import { useState, useEffect } from 'react';
import { vscode } from '../utils/vscode';

interface ConfigInfo {
  baseUrl?: string;
  isConnected?: boolean;
  loading: boolean;
}

export const useConfig = () => {
  const [configInfo, setConfigInfo] = useState<ConfigInfo>({ loading: true });

  useEffect(() => {
    // 请求配置信息
    vscode.postMessage({ type: 'config:getInfo' });

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'config:info') {
        setConfigInfo({
          baseUrl: message.baseUrl,
          isConnected: message.isConnected,
          loading: false
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const refreshConfig = () => {
    setConfigInfo(prev => ({ ...prev, loading: true }));
    vscode.postMessage({ type: 'config:getInfo' });
  };

  return {
    configInfo,
    refreshConfig
  };
};
