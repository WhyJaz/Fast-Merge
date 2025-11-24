import { getName, ProjectSelector } from '@/components/ProjectSelector';
import { useGitLabApi } from '@/hooks/useGitLabApi';
import { GitLabProject } from '@/types/gitlab';
import { EyeInvisibleOutlined, LinkOutlined } from '@ant-design/icons';
import { Button, Space, Table, Tag, Typography } from 'antd';
import Link from 'antd/es/typography/Link';
import React, { useEffect, useMemo, useState } from 'react';


const MergeList: React.FC<any> = ({ projectId, refreshKey }: { projectId: number, refreshKey: string }) => {

    const { getMergeRequests, mergeRequestListState } = useGitLabApi();

    const [allMergeRequests, setAllMergeRequests] = useState<any[]>([]);
    // 当项目ID变化时获取mr列表数据
    useEffect(() => {
        if (projectId) {
            setAllMergeRequests([
                {
                    id: 2141,
                    author: "廖军利",
                    target_branch: "hotfix/5.3-hotfix_20250730",
                    title: "V8-224609【中海】：批处理数据，失败弹窗穿透查看数据后，再次选中数据进行批量操作，直接弹出上一次的处理弹窗",
                    web_url: "https://gitlab.seeyon.com/a9/code/frontend/apps/ctp-affair/-/merge_requests/2141"
                },
                {
                    id: 2142,
                    author: "廖军利",
                    target_branch: "release/5.10-release_20251205",
                    title: "V8-224609【中海】：批处理数据，失败弹窗穿透查看数据后，再次选中数据进行批量操作，直接弹出上一次的处理弹窗",
                    web_url: "https://gitlab.seeyon.com/a9/code/frontend/apps/ctp-affair/-/merge_requests/2142"
                },
                {
                    id: 2143,
                    author: "廖军利",
                    target_branch: "release/5.10-release_20251205",
                    title: "V8-224777 再次选中数据进行批量操作，直接弹出上一次的处理弹窗",
                    web_url: "https://gitlab.seeyon.com/a9/code/frontend/apps/ctp-affair/-/merge_requests/2142"
                }
            ]);
            getMergeRequests(projectId, 'merged');
        }
    }, [refreshKey, projectId, getMergeRequests]);


    // 根据mr标题分组
    const groupMRByTitle = useMemo(() => {
        const groups: any = {}; // 存储分组：{ 标题: [元素数组] }
        const titleOrder: any[] = []; // 记录标题出现的顺序，保证分组顺序与原列表一致
        allMergeRequests.forEach((item) => {
            const { title } = item;
            // 如果标题未在分组中，初始化数组并记录顺序
            if (!groups[title]) {
                groups[title] = [];
                titleOrder.push(title);
            }
            // 将当前元素加入对应标题的分组
            groups[title].push(item);
        });
        const res = titleOrder.map((title) => ({
            title,
            items: groups[title]
        }));
        return res;
    }, [allMergeRequests])

    // 等待接口数据
    useEffect(() => {
        if (mergeRequestListState.data && !mergeRequestListState.loading) {
            setAllMergeRequests(mergeRequestListState.data);
        }
    }, [mergeRequestListState.data, mergeRequestListState.loading]);



    const projectName = 'project_' + projectId + '_';

    return (
        <div className='mrList' style={{ position: "relative" }}>
            {
                allMergeRequests.length ? <>
                    {allMergeRequests.length > 1 && <Button
                        className='mrListAction'
                        onClick={() => {
                            allMergeRequests
                                .map(item => {
                                    const { id, target_branch, } = item;
                                    // 使用a标记触发跳转，避免弹出提示打开外部网站
                                    const domId = projectName + target_branch + `${id}_linkhandler`
                                    const dom = document.getElementById(domId);
                                    dom && dom.click();
                                });
                        }} type="primary" size="small">Code Review</Button>}
                    {/* 按照标题是否相同进行分组，仅显示一个标题 */}
                    {groupMRByTitle.map((item: any, index: number) => {
                        const { items, title } = item;
                        return (
                            <div style={{ padding: '3px 0', marginTop: index ? 5 : 0 }}>
                                <p style={{ fontSize: 12 }}>{title}</p>
                                <p style={{ fontSize: 10, paddingTop: 3 }}>
                                    {items.map((record: any) => {
                                        const { id, author, target_branch, title, web_url } = record;
                                        const linkID = projectName + target_branch + `${id}_linkhandler`
                                        return (
                                            <Tag color={'green'} title={`#${id} ${author}`}>
                                                {target_branch}
                                                <Link style={{ marginLeft: 8, fontSize: 12 }} id={linkID} title={author} href={web_url + '/diffs'} target="_blank">
                                                    #{id}
                                                </Link>
                                            </Tag>
                                        )
                                    })}
                                </p>


                            </div>
                        )
                    })}</> : '-'
            }
            {/*  */}
        </div >
    );
};

export default MergeList;