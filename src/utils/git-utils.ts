import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GitRepository {
  workspaceFolder: string;
  remoteUrl: string;
  currentBranch: string;
  isGitRepository: boolean;
  gitlabProjectPath?: string;
  gitlabBaseUrl?: string;
}



export class GitUtils {
  private workspaceFolder: string;

  constructor(workspaceFolder?: string) {
    this.workspaceFolder = workspaceFolder || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
  }

  /**
   * 检查当前目录是否为Git仓库
   */
  async isGitRepository(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git rev-parse --git-dir', { cwd: this.workspaceFolder });
      return stdout.trim().length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取当前分支名
   */
  async getCurrentBranch(): Promise<string> {
    try {
      const { stdout } = await execAsync('git branch --show-current', { cwd: this.workspaceFolder });
      return stdout.trim();
    } catch (error) {
      console.error('获取当前分支失败:', error);
      return '';
    }
  }

  /**
   * 获取远程仓库URL
   */
  async getRemoteUrl(remoteName: string = 'origin'): Promise<string> {
    try {
      const { stdout } = await execAsync(`git remote get-url ${remoteName}`, { cwd: this.workspaceFolder });
      return stdout.trim();
    } catch (error) {
      console.error('获取远程仓库URL失败:', error);
      return '';
    }
  }

  /**
   * 从远程URL解析GitLab项目信息
   */
  parseGitLabInfo(remoteUrl: string): { baseUrl: string; projectPath: string } | null {
    try {
      // 处理SSH URL格式: git@gitlab.com:group/project.git
      const sshMatch = remoteUrl.match(/git@([^:]+):(.+)\.git$/);
      if (sshMatch) {
        const [, host, projectPath] = sshMatch;
        return {
          baseUrl: `https://${host}`,
          projectPath: projectPath
        };
      }

      // 处理HTTPS URL格式: https://gitlab.com/group/project.git
      const httpsMatch = remoteUrl.match(/https:\/\/([^\/]+)\/(.+)\.git$/);
      if (httpsMatch) {
        const [, host, projectPath] = httpsMatch;
        return {
          baseUrl: `https://${host}`,
          projectPath: projectPath
        };
      }

      return null;
    } catch (error) {
      console.error('解析GitLab信息失败:', error);
      return null;
    }
  }



  /**
   * 获取当前仓库完整信息
   */
  async getRepositoryInfo(): Promise<GitRepository> {
    const isGit = await this.isGitRepository();
    
    if (!isGit) {
      return {
        workspaceFolder: this.workspaceFolder,
        remoteUrl: '',
        currentBranch: '',
        isGitRepository: false
      };
    }

    const currentBranch = await this.getCurrentBranch();
    const remoteUrl = await this.getRemoteUrl();
    const gitlabInfo = this.parseGitLabInfo(remoteUrl);

    return {
      workspaceFolder: this.workspaceFolder,
      remoteUrl,
      currentBranch,
      isGitRepository: true,
      gitlabProjectPath: gitlabInfo?.projectPath,
      gitlabBaseUrl: gitlabInfo?.baseUrl
    };
  }


}
