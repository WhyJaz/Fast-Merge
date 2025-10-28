import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GitLabConfiguration } from '../shared/gitlab-types';

export interface FastMergeConfig {
  gitlab: GitLabConfiguration;
}

export const DEFAULT_CONFIG: FastMergeConfig = {
  gitlab: {
    baseUrl: 'https://gitlab.xxxx.com',
    token: '',
    projectId: undefined,
    showHash: false
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
      const config = JSON.parse(configContent) as Partial<FastMergeConfig>;

      // 合并默认配置，确保所有字段都存在，并在缺失字段时回写
      const merged = this.mergeWithDefaults(config);
      if (JSON.stringify(merged) !== JSON.stringify(config)) {
        await this.saveConfig(merged);
      }
      return merged;
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

    } catch (error) {
      console.error('打开配置文件失败:', error);
      vscode.window.showErrorMessage(`打开配置文件失败: ${error}`);
    }
  }

  /**
   * 合并默认配置
   */
  private mergeWithDefaults(config: Partial<FastMergeConfig>): FastMergeConfig {
    return {
      gitlab: {
        ...DEFAULT_CONFIG.gitlab,
        ...config.gitlab
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
