import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GitLabConfiguration } from '../shared/gitlab-types';

export interface FastMergeConfig {
  gitlab: GitLabConfiguration;
  merge: {
    removeSourceBranch: boolean;
    squash: boolean;
  };
  ui: {
    theme: 'auto' | 'light' | 'dark';
    language: 'zh-CN' | 'en-US';
  };
}

export const DEFAULT_CONFIG: FastMergeConfig = {
  gitlab: {
    baseUrl: 'https://gitlab.com',
    token: '',
    projectId: undefined
  },
  merge: {
    removeSourceBranch: false,
    squash: false
  },
  ui: {
    theme: 'auto',
    language: 'zh-CN'
  }
};

export class ConfigManager {
  private configPath: string;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.configPath = path.join(context.globalStorageUri.fsPath, 'fast-merge-config.json');
  }

  /**
   * 获取配置文件路径
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * 确保配置目录存在
   */
  private async ensureConfigDirectory(): Promise<void> {
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      await fs.promises.mkdir(configDir, { recursive: true });
    }
  }

  /**
   * 读取配置文件
   */
  async loadConfig(): Promise<FastMergeConfig> {
    try {
      await this.ensureConfigDirectory();
      
      if (!fs.existsSync(this.configPath)) {
        // 如果配置文件不存在，创建默认配置
        await this.saveConfig(DEFAULT_CONFIG);
        return DEFAULT_CONFIG;
      }

      const configContent = await fs.promises.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(configContent) as FastMergeConfig;
      
      // 合并默认配置，确保所有字段都存在
      return this.mergeWithDefaults(config);
    } catch (error) {
      console.error('读取配置文件失败:', error);
      vscode.window.showErrorMessage(`读取配置文件失败: ${error}`);
      return DEFAULT_CONFIG;
    }
  }

  /**
   * 保存配置文件
   */
  async saveConfig(config: FastMergeConfig): Promise<void> {
    try {
      await this.ensureConfigDirectory();
      const configContent = JSON.stringify(config, null, 2);
      await fs.promises.writeFile(this.configPath, configContent, 'utf-8');
    } catch (error) {
      console.error('保存配置文件失败:', error);
      vscode.window.showErrorMessage(`保存配置文件失败: ${error}`);
      throw error;
    }
  }

  /**
   * 打开配置文件进行编辑
   */
  async openConfigFile(): Promise<void> {
    try {
      await this.ensureConfigDirectory();
      
      // 如果配置文件不存在，先创建默认配置
      if (!fs.existsSync(this.configPath)) {
        await this.saveConfig(DEFAULT_CONFIG);
      }

      // 在VSCode中打开配置文件
      const configUri = vscode.Uri.file(this.configPath);
      const document = await vscode.workspace.openTextDocument(configUri);
      await vscode.window.showTextDocument(document, {
        preview: false,
        viewColumn: vscode.ViewColumn.One
      });

      // 显示配置说明
      vscode.window.showInformationMessage(
        '请在配置文件中填写您的 GitLab 信息，保存后插件会自动重新加载配置。',
        '查看配置说明'
      ).then(selection => {
        if (selection === '查看配置说明') {
          this.showConfigHelp();
        }
      });

    } catch (error) {
      console.error('打开配置文件失败:', error);
      vscode.window.showErrorMessage(`打开配置文件失败: ${error}`);
    }
  }

  /**
   * 显示配置帮助信息
   */
  private showConfigHelp(): void {
    const helpMessage = `
# Fast Merge 配置说明

## GitLab 配置
- baseUrl: GitLab 服务器地址（如 https://gitlab.com）
- token: Personal Access Token（需要 api 权限）
- projectId: 默认项目ID（可选）

## 合并配置
- removeSourceBranch: 合并后是否删除源分支
- squash: 是否启用 Squash 合并

## UI 配置
- theme: 主题（auto/light/dark）
- language: 语言（zh-CN/en-US）

## 获取 Access Token
1. 前往 GitLab → Settings → Access Tokens
2. 创建新的 Personal Access Token
3. 确保勾选 'api' 权限
4. 复制生成的 token 到配置文件中
    `;

    vscode.window.showInformationMessage(helpMessage);
  }

  /**
   * 合并默认配置
   */
  private mergeWithDefaults(config: Partial<FastMergeConfig>): FastMergeConfig {
    return {
      gitlab: {
        ...DEFAULT_CONFIG.gitlab,
        ...config.gitlab
      },
      merge: {
        ...DEFAULT_CONFIG.merge,
        ...config.merge
      },
      ui: {
        ...DEFAULT_CONFIG.ui,
        ...config.ui
      }
    };
  }

  /**
   * 监听配置文件变化
   */
  watchConfigFile(onConfigChange: (config: FastMergeConfig) => void): vscode.Disposable {
    const watcher = vscode.workspace.createFileSystemWatcher(this.configPath);
    
    const handleChange = async () => {
      try {
        const newConfig = await this.loadConfig();
        onConfigChange(newConfig);
        vscode.window.showInformationMessage('Fast Merge 配置已重新加载');
      } catch (error) {
        console.error('重新加载配置失败:', error);
      }
    };

    watcher.onDidChange(handleChange);
    watcher.onDidCreate(handleChange);

    return watcher;
  }

  /**
   * 验证配置是否有效
   */
  validateConfig(config: FastMergeConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.gitlab.baseUrl) {
      errors.push('GitLab 服务器地址不能为空');
    } else if (!config.gitlab.baseUrl.match(/^https?:\/\/.+/)) {
      errors.push('GitLab 服务器地址格式无效');
    }

    if (!config.gitlab.token) {
      errors.push('GitLab 访问令牌不能为空');
    } else if (config.gitlab.token.length < 20) {
      errors.push('GitLab 访问令牌长度不能少于20个字符');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 检查配置是否完整
   */
  async isConfigured(): Promise<boolean> {
    const config = await this.loadConfig();
    const validation = this.validateConfig(config);
    return validation.valid;
  }
}
