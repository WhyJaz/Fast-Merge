# Fast Merge - GitLab 合并助手

Fast Merge 是一个 VSCode 插件，旨在简化 GitLab 项目的合并请求创建流程，支持分支合并和 Cherry Pick 操作。

## 功能特性

### ✨ 主要功能

- **🔧 GitLab 集成**: 通过 GitLab API 获取项目、分支、提交信息
- **🎯 项目选择**: 支持搜索和选择 GitLab 项目，默认识别当前工作区项目
- **🌿 分支合并**: 创建基于分支间的合并请求
- **🍒 Cherry Pick**: 支持将指定提交应用到多个目标分支
- **🔍 智能搜索**: 提交搜索支持提交消息和提交ID双向检索
- **📊 状态反馈**: 实时显示合并进度和结果
- **🎨 美观界面**: 基于 Ant Design 的现代化用户界面

### 🚀 核心优势

- **零跨域问题**: 所有API请求从扩展层发出，避免webview跨域限制
- **可扩展架构**: 模块化设计，便于功能扩展和维护
- **VSCode 主题适配**: 完美融入 VSCode 的亮色/暗色主题

## 安装和配置

### 1. 安装插件

1. 在 VSCode 中打开扩展面板 (Ctrl+Shift+X)
2. 搜索 "Fast Merge"
3. 点击安装

### 2. 配置 GitLab 连接

首次使用时，插件会引导您进行配置：

1. **打开配置文件**: 点击"打开配置文件"按钮，插件会在 VSCode 中打开配置文件
2. **编辑配置**: 在 JSON 配置文件中填写以下信息：
   ```json
   {
     "gitlab": {
       "baseUrl": "https://gitlab.com",
       "token": "glpat-xxxxxxxxxxxxxxxxxxxx",
       "projectId": null
     },
     "merge": {
       "removeSourceBranch": false,
       "squash": false
     },
     "ui": {
       "theme": "auto",
       "language": "zh-CN"
     }
   }
   ```
3. **保存配置**: 保存配置文件，插件会自动检测更改并重新加载配置

#### 获取 Personal Access Token

1. 前往 GitLab → Settings → Access Tokens
2. 创建新的 Personal Access Token
3. 确保勾选 `api` 权限
4. 复制生成的 token 到配置文件中

## 使用指南

### 📋 基本操作流程

1. **打开插件**: 点击侧边栏的 Fast Merge 图标
2. **选择项目**: 搜索并选择目标 GitLab 项目
3. **选择合并类型**:
   - **分支合并**: 将一个分支合并到另一个分支
   - **Cherry Pick**: 将特定提交应用到多个分支
4. **配置参数**: 根据选择的合并类型配置相应参数
5. **执行合并**: 点击创建合并请求
6. **查看结果**: 在结果页面查看创建的合并请求

### 🌿 分支合并操作

1. 选择源分支（默认为当前分支）
2. 选择目标分支
3. 系统会自动生成合并请求标题和描述
4. 创建合并请求并跳转到 GitLab 查看

### 🍒 Cherry Pick 操作

1. 选择源分支（提交来源分支）
2. 搜索并选择要 Cherry Pick 的提交（支持多选）
3. 选择目标分支（支持多个目标分支）
4. 系统会为每个目标分支创建单独的合并请求

### 🔍 搜索功能

- **项目搜索**: 按项目名称或命名空间搜索
- **分支搜索**: 按分支名称搜索，支持实时过滤
- **提交搜索**: 支持按提交消息和提交ID搜索

## 配置选项

插件使用独立的 JSON 配置文件，配置文件会自动在您的 VSCode 全局存储目录中创建。

### 配置文件结构

```json
{
  "gitlab": {
    "baseUrl": "https://gitlab.com",           // GitLab 服务器地址
    "token": "glpat-xxxxxxxxxxxxxxxxxxxx",     // Personal Access Token
    "projectId": null                          // 默认项目ID（可选）
  },
  "merge": {
    "removeSourceBranch": false,               // 合并后是否删除源分支
    "squash": false                            // 是否启用 Squash 合并
  },
  "ui": {
    "theme": "auto",                           // 主题：auto/light/dark
    "language": "zh-CN"                        // 语言：zh-CN/en-US
  }
}
```

### 配置说明

- **gitlab.baseUrl**: GitLab 服务器地址（必填）
- **gitlab.token**: Personal Access Token（必填，需要 api 权限）
- **gitlab.projectId**: 默认项目ID（可选）
- **merge.removeSourceBranch**: 合并后是否删除源分支
- **merge.squash**: 是否启用 Squash 合并
- **ui.theme**: 界面主题，支持自动跟随 VSCode 主题
- **ui.language**: 界面语言

### 配置管理

- **实时更新**: 修改配置文件后自动生效，无需重启插件
- **配置验证**: 插件会自动验证配置的有效性
- **安全存储**: 配置文件存储在 VSCode 安全目录中

## 开发说明

### 技术栈

- **扩展层**: TypeScript + VSCode Extension API
- **UI层**: React + TypeScript + Ant Design
- **构建工具**: Vite + ESBuild
- **API**: GitLab REST API v4

### 项目结构

```
Fast-Merge/
├── src/                    # 扩展层代码
│   ├── api/               # GitLab API服务
│   ├── utils/             # 工具类（Git操作等）
│   ├── webview/           # Webview提供者
│   └── shared/            # 共享类型定义
├── webview-ui/            # UI层代码
│   ├── src/
│   │   ├── components/    # React组件
│   │   ├── hooks/         # 自定义Hooks
│   │   └── types/         # 类型定义
└── assets/                # 静态资源
```

### 开发环境

```bash
# 安装依赖
yarn install

# 开发模式
yarn watch

# 构建生产版本
yarn package
```

## 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发规范

- 使用 TypeScript 进行类型安全开发
- 遵循 ESLint 代码规范
- 组件采用函数式编程和 Hooks
- 保持代码模块化和可测试性

## 许可证

本项目采用 Apache-2.0 许可证。详见 [LICENSE](LICENSE) 文件。

## 更新日志

### v1.0.0
- ✨ 初始版本发布
- 🔧 GitLab API 集成
- 🌿 分支合并功能
- 🍒 Cherry Pick 功能
- 🎨 Ant Design UI 界面
- 📊 合并状态反馈

## 支持

如果您遇到问题或有功能建议，请：

1. 查看 [FAQ](#常见问题)
2. 提交 [Issue](../../issues)
3. 联系开发者

---

**Happy Merging! 🚀**