import React, { useEffect, useState, useMemo } from 'react';
import { Select, Spin, Empty, Typography } from 'antd';
import { GitlabOutlined } from '@ant-design/icons';
import { GitLabProject } from '../types/gitlab';
import { useGitLabApi } from '../hooks/useGitLabApi';

const { Option } = Select;
const { Text } = Typography;

interface ProjectSelectorProps {
  value?: GitLabProject;
  onChange?: (project: GitLabProject | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  value,
  onChange,
  placeholder = "选择 GitLab 项目",
  disabled = false
}) => {
  const { getProjects, projectsState } = useGitLabApi();
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [allProjects, setAllProjects] = useState<GitLabProject[]>([]);

  // 初始加载项目
  useEffect(() => {
    getProjects('', 1, 50);
  }, [getProjects]);

  // 处理项目数据更新
  useEffect(() => {
    if (projectsState.data && !projectsState.loading) {
      if (page === 1) {
        setAllProjects(projectsState.data);
      } else {
        setAllProjects(prev => [...prev, ...(projectsState.data || [])]);
      }
    }
  }, [projectsState.data, projectsState.loading, page]);

  // 搜索处理
  const handleSearch = (value: string) => {
    setSearchText(value);
    setPage(1);
    setAllProjects([]);
    getProjects(value, 1, 50);
  };

  // 加载更多
  const handleLoadMore = () => {
    setPage(prev => prev + 1);
    getProjects(searchText, page + 1, 50);
  };

  // 选择项目
  const handleSelect = (projectId: string) => {
    const selectedProject = allProjects.find(p => p.id.toString() === projectId);
    onChange?.(selectedProject);
  };

  // 过滤选项
  const filteredProjects = useMemo(() => {
    if (!searchText) return allProjects;
    return allProjects.filter(project => 
      project.name_with_namespace.toLowerCase().includes(searchText.toLowerCase()) ||
      project.name.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [allProjects, searchText]);

  const dropdownRender = (menu: React.ReactElement) => (
    <div>
      {menu}
      {filteredProjects.length > 0 && !projectsState.loading && (
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
            加载更多...
          </a>
        </div>
      )}
    </div>
  );

  return (
    <Select
      showSearch
      value={value?.id?.toString()}
      placeholder={placeholder}
      disabled={disabled}
      loading={projectsState.loading}
      onSearch={handleSearch}
      onSelect={handleSelect}
      filterOption={false}
      style={{ width: '100%' }}
      dropdownRender={dropdownRender}
      notFoundContent={
        projectsState.loading ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Spin size="small" />
            <div style={{ marginTop: 8 }}>加载中...</div>
          </div>
        ) : (
          <Empty 
            image={Empty.PRESENTED_IMAGE_SIMPLE} 
            description="未找到项目" 
            style={{ padding: 20 }}
          />
        )
      }
    >
      {filteredProjects.map(project => (
        <Option key={project.id} value={project.id.toString()}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <GitlabOutlined style={{ marginRight: 8, color: '#FC6D26' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ 
                fontWeight: 500, 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap' 
              }}>
                {project.name}
              </div>
              {/* <Text 
                type="secondary" 
                style={{ 
                  fontSize: '12px',
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                  display: 'block'
                }}
              >
                {project.namespace.full_path}
              </Text> */}
            </div>
          </div>
        </Option>
      ))}
    </Select>
  );
};
