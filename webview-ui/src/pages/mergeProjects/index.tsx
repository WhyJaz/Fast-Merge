import { getName, ProjectSelector } from '@/components/ProjectSelector';
import { useGitLabApi } from '@/hooks/useGitLabApi';
import { GitLabProject } from '@/types/gitlab';
import { EyeInvisibleOutlined } from '@ant-design/icons';
import { Button, message, Space, Table, Tag, Typography } from 'antd';
import React, { useEffect, useState } from 'react';
import MergeList from './MergeList';
import { generateRandomAlphaNumStr } from '@/utils/tool';


const MergeProjects: React.FC<any> = ({ setMrCount }: any) => {
    const [refreshKey, setRefreshKey] = useState<string>(generateRandomAlphaNumStr());

    // 表格列定义
    const columns: any = [
        {
            title: '',
            width: 10,
            align: "center",
            dataIndex: 'action',
            key: 'action',
            ellipsis: true,
            render: (text: string, record: any) => {
                return (
                    <span title='取消订阅' style={{ cursor: "pointer" }} onClick={() => {
                        const selectedProjects = subscribeProjects.filter(p => p.id.toString() !== record.id.toString());
                        localStorage.setItem("subscribeProjects", JSON.stringify(selectedProjects))
                        setSubscribeProjects(selectedProjects);
                    }}><EyeInvisibleOutlined /></span>
                )
            }
        },
        {
            title: '工程名',
            width: 120,
            align: "left",
            dataIndex: 'projectName',
            key: 'projectName',
            ellipsis: true,
            render: (text: string, record: any) => {
                return <span style={{ fontSize: 12 }}
                >{getName(record)}</span>
            }
        },
        {
            title: 'MR列表',
            align: "left",
            dataIndex: 'projectName',
            key: 'projectName',
            ellipsis: true,
            render: (text: string, record: any) => {
                return <MergeList refreshKey={refreshKey} projectId={record.id} />
            }
        },
    ];


    const localSubscribeProjects = JSON.parse(localStorage.getItem("subscribeProjects") || '[]');
    const [subscribeProjects, setSubscribeProjects] = useState<GitLabProject[]>(localSubscribeProjects);
    const [selectProjects, setSelectProjects] = useState<GitLabProject[]>([]);

    const [pollingId, setPollingId] = useState<any>(null); // 存储定时器ID

    // 启动轮询的函数
    const startPolling = () => {
        // 避免重复启动轮询
        if (pollingId) clearInterval(pollingId);
        const id = setInterval(() => {
            const newKey = generateRandomAlphaNumStr();
            setRefreshKey(newKey);
            // 每5分钟轮询一次查询是否有待合并的mr
        }, 1000 * 60 * 5);
        setPollingId(id);
    };

    // 终止轮询的函数
    const stopPolling = () => {
        clearInterval(pollingId);
        setPollingId(null);
    };

    // 组件卸载时终止轮询（关键：避免内存泄漏）
    useEffect(() => {
        return () => {
            if (pollingId) clearInterval(pollingId);
        };
    }, [pollingId]);


    // 每次订阅列表变化的时候，重新轮询
    useEffect(() => {
        if (subscribeProjects.length) {
            stopPolling();
            startPolling();
        }
    }, [subscribeProjects.length])



    // TODO   统计数量对应工程的待合并mr数量
    // TODO   统计数量对应工程的待合并mr数量
    // TODO   统计数量对应工程的待合并mr数量
    // TODO   统计数量对应工程的待合并mr数量
    // TODO   统计数量对应工程的待合并mr数量
    useEffect(() => {
        if (subscribeProjects.length) {
            if (setMrCount) {
                setMrCount(10)
            }
        }
    }, [subscribeProjects.length])


    return (
        <div>
            <div style={{ display: 'flex' }}>
                <div style={{ flex: '1 1 0', minWidth: 0, marginRight: 8 }}>
                    <ProjectSelector
                        multiple
                        value={selectProjects}
                        onChange={(v: any) => {
                            setSelectProjects(v)
                        }}
                        placeholder="可输入搜索，选择订阅的 GitLab 项目"
                    />
                </div>
                <Button
                    type="primary"
                    disabled={!selectProjects.length}
                    onClick={() => {
                        if (selectProjects.length > 20) {
                            message.error("最多支持订阅20个工程");
                            return;
                        }
                        // TODO  去重
                        if (selectProjects.length) {
                            localStorage.setItem("subscribeProjects", JSON.stringify(selectProjects))
                            setSubscribeProjects(selectProjects);
                            setSelectProjects([]);

                        }
                    }}>订阅</Button>
            </div>
            <Table
                style={{ marginTop: 16 }}
                rowKey={'timestamp'}
                scroll={{ x: true }}
                columns={columns}
                dataSource={subscribeProjects}
                pagination={false}
                size="small"
                showHeader={true}
            />
        </div >
    );
};

export default MergeProjects;