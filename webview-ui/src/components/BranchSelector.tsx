import React, { useEffect, useState, useMemo } from 'react';
import { Select, Spin, Empty, Tag, Typography } from 'antd';
import { BranchesOutlined, LockOutlined, CrownOutlined } from '@ant-design/icons';
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
  defaultBranch?: string;
  multiple?: boolean;
}

export const BranchSelector: React.FC<BranchSelectorProps> = ({
  projectId,
  value,
  onChange,
  placeholder = "选择分支",
  disabled = false,
  defaultBranch,
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

  // 按重要性排序分支
  const sortedBranches = useMemo(() => {
    const branches = [...filteredBranches];
    return branches.sort((a, b) => {
      // 默认分支优先
      if (a.default && !b.default) return -1;
      if (!a.default && b.default) return 1;
      
      // 受保护分支其次
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
              whiteSpace: 'nowrap' 
            }}>
              {branch.name}
            </div>
            <Text 
              type="secondary" 
              style={{ 
                fontSize: '12px',
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                display: 'block'
              }}
            >
              {branch.commit.title}
            </Text>
          </div>
        </div>
        {/* <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
          {branch.default && (
            <Tag icon={<CrownOutlined />} color="gold">
              默认
            </Tag>
          )}
          {branch.protected && (
            <Tag icon={<LockOutlined />} color="red">
              保护
            </Tag>
          )}
        </div> */}
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
