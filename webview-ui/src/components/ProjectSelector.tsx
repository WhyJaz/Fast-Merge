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
  const [allProjects, setAllProjects] = useState<GitLabProject[]>([]);

  // 初始加载项目 - 加载更多数据避免分页
  useEffect(() => {
    getProjects('', 1, 100);
  }, [getProjects]);

  useEffect(() => {
    if ((value as any)?.needInit && allProjects.length) {
      const findProject = allProjects?.find(project => project.path_with_namespace === (value as any).gitlabProjectPath) || {};
      onChange?.({...findProject, needInit: false} as any);
    } 
  }, [value, allProjects]);

  // 处理项目数据更新
  useEffect(() => {
    if (projectsState.data && !projectsState.loading) {
      setAllProjects(projectsState.data);
    }
  }, [projectsState.data, projectsState.loading]);

  // 搜索处理 - 调用接口进行服务端搜索
  const handleSearch = (value: string) => {
    setSearchText(value);
    // 调用接口进行搜索，支持GitLab服务端搜索
    if (value.trim()) {
      getProjects(value, 1, 100);
    } else {
      // 如果搜索为空，重新加载全部项目
      getProjects('', 1, 100);
    }
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
    </div>
  );

  const getName = (data: any) => {
    if (data.name_with_namespace.includes('front')) {
      return '前端-' +  data.name
    } else if (data.name_with_namespace.includes('back')) {
      return '后端-' +  data.name
    }
    return data.name
  }

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
                {getName(project)}
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
