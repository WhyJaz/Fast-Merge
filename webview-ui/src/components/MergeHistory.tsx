import React, { useState } from 'react';
import { Typography, Space, Button, Tag, Table, message, Popconfirm, Tooltip } from 'antd';
const { Link } = Typography;

import {
  LinkOutlined,
} from '@ant-design/icons';
import { padZero } from '@/pages/MergePage';

/**
 * 时间戳转换为 YYYY/MM/DD HH:MM:SS 格式
 * @param {number} timestamp - 时间戳（毫秒级，若为秒级需先×1000）
 * @returns {string} 格式化后的时间字符串
 */
function timestampToFormat(timestamp: any) {
  // 1. 用时间戳创建Date对象（确保是毫秒级）
  const date = new Date(Number(timestamp));

  // 2. 提取年、月、日、时、分、秒
  const year = date.getFullYear();
  const month = padZero(date.getMonth() + 1); // 月份0-11 → 1-12，补零
  const day = padZero(date.getDate());
  const hours = padZero(date.getHours()); // 24小时制
  const minutes = padZero(date.getMinutes());
  const seconds = padZero(date.getSeconds());

  // 3. 拼接格式
  return `${month}/${day} ${hours}:${minutes}:${seconds}`;
  // return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}



interface MergeHistoryProps {
}

export const MergeHistory: React.FC<MergeHistoryProps> = ({
}) => {

  // 表格列定义
  const columns: any = [
    {
      title: '工程名',
      width: 150,
      align: "center",
      dataIndex: 'projectName',
      key: 'projectName',
      ellipsis: true,
      render: (text: string, record: any) => {
        return text
      }
    },
    {
      title: '操作时间',
      width: 120,
      align: "center",
      dataIndex: 'timestamp',
      key: 'timestamp',
      ellipsis: true,
      render: (text: string, record: any) => {
        return timestampToFormat(text)
      }
    },
    {
      title: '目标分支',
      // width: '50%',
      dataIndex: 'targetBranch',
      key: 'targetBranch',
      ellipsis: true,
      render: (branch: string, record: any) => {
        const { data = [] } = record;
        const resData = Array.isArray(data) ? data : [data]
        return (
          <Space wrap>
            {resData.map((item: any) => {
              const { target_branch, success, merge_request } = item;
              const { web_url, target_branch: merge_target_branch } = merge_request || {};
              const last_target_branch = target_branch || merge_target_branch
              return (
                <Space>
                  <Tag
                    key={last_target_branch}
                    color={success ? 'green' : 'red'}
                  >
                    {/* 分支截取一下，避免显示太长 */}
                    <span
                      {...last_target_branch.length > 40 ? { title: last_target_branch } : {}}
                    >{last_target_branch.slice(0, 40)}</span>
                    {web_url && <Link style={{ marginLeft: 8 }} href={web_url + '/diffs'} target="_blank">
                      <LinkOutlined />
                    </Link>}
                  </Tag>
                </Space>
              )
            })
            }
          </Space >
        )
      }
    },
  ];

  const submittingHistory = JSON.parse(localStorage.getItem("submittingHistory") || '[]');

  return (
    <div>
      <Table
        rowKey={'timestamp'}
        scroll={{ x: true }}
        columns={columns}
        dataSource={submittingHistory}
        pagination={false}
        size="small"
        showHeader={true}
      />
    </div>
  );
};
