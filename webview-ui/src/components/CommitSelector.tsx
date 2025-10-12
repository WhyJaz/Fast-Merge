import React, { useEffect, useState, useMemo } from 'react';
import { Select, Spin, Empty, Typography, Tag, Tooltip } from 'antd';
import { BranchesOutlined, UserOutlined, CalendarOutlined } from '@ant-design/icons';
import { GitLabCommit } from '../types/gitlab';
import { useGitLabApi } from '../hooks/useGitLabApi';

const { Option } = Select;
const { Text } = Typography;

interface CommitSelectorProps {
  projectId?: number;
  branch?: string;
  value?: string | string[];
  onChange?: (commit: string | string[] | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  maxTagCount?: number;
}

export const CommitSelector: React.FC<CommitSelectorProps> = ({
  projectId,
  branch,
  value,
  onChange,
  placeholder = "选择提交",
  disabled = false,
  maxTagCount = 2
}) => {
  const { getCommits, commitsState } = useGitLabApi();
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [allCommits, setAllCommits] = useState<GitLabCommit[]>([]);

  // 当项目ID或分支变化时获取提交
  useEffect(() => {
    if (projectId && branch) {
      setPage(1);
      setAllCommits([]);
      getCommits(projectId, branch, '', 1, 20);
    }
  }, [projectId, branch, getCommits]);

  // 处理提交数据更新
  useEffect(() => {
    if (commitsState.data && !commitsState.loading) {
      if (page === 1) {
        setAllCommits(commitsState.data);
      } else {
        setAllCommits(prev => [...prev, ...(commitsState.data || [])]);
      }
    }
  }, [commitsState.data, commitsState.loading, page]);

  // 搜索处理
  const handleSearch = (value: string) => {
    setSearchText(value);
    setPage(1);
    setAllCommits([]);
    if (projectId && branch) {
      getCommits(projectId, branch, value, 1, 20);
    }
  };

  // 加载更多
  const handleLoadMore = () => {
    if (projectId && branch) {
      const nextPage = page + 1;
      setPage(nextPage);
      getCommits(projectId, branch, searchText, nextPage, 20);
    }
  };

  // 选择提交
  const handleSelect = (commitId: string | string[]) => {
    onChange?.(commitId);
  };

  // 过滤提交
  const filteredCommits = useMemo(() => {
    if (!allCommits || allCommits.length === 0) return [];
    if (!searchText) return allCommits;
    return allCommits.filter(commit => 
      commit.title.toLowerCase().includes(searchText.toLowerCase()) ||
      commit.message.toLowerCase().includes(searchText.toLowerCase()) ||
      commit.id.toLowerCase().includes(searchText.toLowerCase()) ||
      commit.short_id.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [allCommits, searchText]);

  const renderCommitOption = (commit: GitLabCommit) => (
    <Option key={commit.id} value={commit.id}>
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ 
              fontWeight: 500,
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap',
              marginBottom: 2
            }}>
              {/* <Tag color="green" style={{ margin: 0, fontSize: '11px' }}>
                {commit.short_id}
              </Tag> */}
              {commit.title}
            </div>
          </div>
        </div>
      </div>
    </Option>
  );

  const dropdownRender = (menu: React.ReactElement) => (
    <div>
      {menu}
      {filteredCommits.length > 0 && !commitsState.loading && (
        <div style={{ padding: 8, borderTop: '1px solid #f0f0f0' }}>
          <a 
            onClick={handleLoadMore}
            style={{ 
              display: 'block', 
              textAlign: 'center',
              color: '#1890ff',
              cursor: 'pointer'
            }}
          >
            加载更多提交...
          </a>
        </div>
      )}
    </div>
  );

  return (
    <Select
      mode={"multiple"}
      showSearch
      value={value}
      placeholder={placeholder}
      disabled={disabled || !projectId || !branch}
      loading={commitsState.loading}
      onSearch={handleSearch}
      onChange={handleSelect}
      filterOption={false}
      style={{ width: '100%' }}
      maxTagCount={maxTagCount}
      dropdownRender={dropdownRender}
      notFoundContent={
        commitsState.loading ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Spin size="small" />
            <div style={{ marginTop: 8 }}>加载提交中...</div>
          </div>
        ) : !projectId ? (
          <Empty 
            image={Empty.PRESENTED_IMAGE_SIMPLE} 
            description="请先选择项目" 
            style={{ padding: 20 }}
          />
        ) : !branch ? (
          <Empty 
            image={Empty.PRESENTED_IMAGE_SIMPLE} 
            description="请先选择分支" 
            style={{ padding: 20 }}
          />
        ) : (
          <Empty 
            image={Empty.PRESENTED_IMAGE_SIMPLE} 
            description="未找到提交" 
            style={{ padding: 20 }}
          />
        )
      }
    >
      {filteredCommits.map(renderCommitOption)}
    </Select>
  );
};
