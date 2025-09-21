import React, { useEffect, useState, useMemo } from 'react';
import { Select, Spin, Empty, Tag, Typography } from 'antd';
import { BranchesOutlined, SafetyOutlined, CrownOutlined } from '@ant-design/icons';
import { GitLabBranch } from '../types/gitlab';
import { useGitLabApi } from '../hooks/useGitLabApi';

const { Option } = Select;
const { Text } = Typography;

interface BranchSelectorProps {
  projectId?: number;
  value?: string | string[];
  onChange?: (branch: string | string[] | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  multiple?: boolean;
}

export const BranchSelector: React.FC<BranchSelectorProps> = ({
  projectId,
  value,
  onChange,
  placeholder = "选择分支",
  disabled = false,
  multiple = false
}) => {
  const { getBranches, branchesState } = useGitLabApi();
  const [searchText, setSearchText] = useState('');

  // 当项目ID变化时获取分支
  useEffect(() => {
    if (projectId) {
      getBranches(projectId);
    }
  }, [projectId, getBranches]);

  // 搜索处理
  const handleSearch = (value: string) => {
    setSearchText(value);
    if (projectId) {
      getBranches(projectId, value);
    }
  };

  // 选择分支
  const handleSelect = (branchName: string | string[]) => {
    if (multiple) {
      onChange?.(branchName);
    } else {
      onChange?.(Array.isArray(branchName) ? branchName[0] : branchName);
    }
  };

  // 过滤分支
  const filteredBranches = useMemo(() => {
    if (!branchesState.data) return [];
    if (!searchText) return branchesState.data;
    
    return branchesState.data.filter(branch => 
      branch.name.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [branchesState.data, searchText]);

  // 版本号比较函数
  const compareVersions = (versionA: string, versionB: string): number => {
    const partsA = versionA.split('.').map(part => parseInt(part, 10) || 0);
    const partsB = versionB.split('.').map(part => parseInt(part, 10) || 0);
    
    const maxLength = Math.max(partsA.length, partsB.length);
    
    for (let i = 0; i < maxLength; i++) {
      const partA = partsA[i] || 0;
      const partB = partsB[i] || 0;
      
      if (partA > partB) return -1; // 降序排列，大版本在前
      if (partA < partB) return 1;
    }
    
    return 0;
  };

  // 提取hotfix版本号
  const extractHotfixVersion = (branchName: string): string | null => {
    const hotfixMatch = branchName.match(/^hotfix\/([^-]+)/);
    return hotfixMatch ? hotfixMatch[1] : null;
  };

  // 按重要性排序分支
  const sortedBranches = useMemo(() => {
    const branches = [...filteredBranches];
    return branches.sort((a, b) => {
      // 默认分支优先
      if (a.default && !b.default) return -1;
      if (!a.default && b.default) return 1;
      
      // 保护分支且以test或hotfix开头的排在最前面
      const aIsProtectedTestHotfix = a.protected && (a.name.startsWith('test') || a.name.startsWith('hotfix'));
      const bIsProtectedTestHotfix = b.protected && (b.name.startsWith('test') || b.name.startsWith('hotfix'));
      
      if (aIsProtectedTestHotfix && !bIsProtectedTestHotfix) return -1;
      if (!aIsProtectedTestHotfix && bIsProtectedTestHotfix) return 1;
      
      // 如果都是hotfix分支，按版本号排序
      if (aIsProtectedTestHotfix && bIsProtectedTestHotfix && 
          a.name.startsWith('hotfix') && b.name.startsWith('hotfix')) {
        const versionA = extractHotfixVersion(a.name);
        const versionB = extractHotfixVersion(b.name);
        
        if (versionA && versionB) {
          return compareVersions(versionA, versionB);
        }
      }
      
      // 其他保护分支其次
      if (a.protected && !b.protected) return -1;
      if (!a.protected && b.protected) return 1;
      
      // 字母顺序
      return a.name.localeCompare(b.name);
    });
  }, [filteredBranches]);

  const renderBranchOption = (branch: GitLabBranch) => (
    <Option key={branch.name} value={branch.name}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <BranchesOutlined style={{ marginRight: 8, color: '#52c41a' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ 
              fontWeight: branch.default ? 600 : 400,
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              {branch.protected && (
                <SafetyOutlined style={{ color: 'orange', fontSize: '12px' }} />
              )}
              {branch.name}
            </div>
          </div>
        </div>
      </div>
    </Option>
  );

  return (
    <Select
      showSearch
      mode={multiple ? "multiple" : undefined}
      value={value}
      placeholder={placeholder}
      disabled={disabled || !projectId}
      loading={branchesState.loading}
      onSearch={handleSearch}
      onChange={handleSelect}
      filterOption={false}
      style={{ width: '100%' }}
      notFoundContent={
        branchesState.loading ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Spin size="small" />
            <div style={{ marginTop: 8 }}>加载分支中...</div>
          </div>
        ) : !projectId ? (
          <Empty 
            image={Empty.PRESENTED_IMAGE_SIMPLE} 
            description="请先选择项目" 
            style={{ padding: 20 }}
          />
        ) : (
          <Empty 
            image={Empty.PRESENTED_IMAGE_SIMPLE} 
            description="未找到分支" 
            style={{ padding: 20 }}
          />
        )
      }
    >
      {sortedBranches.map(renderBranchOption)}
    </Select>
  );
};
