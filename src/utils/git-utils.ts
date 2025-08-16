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

export interface GitCommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
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
   * 获取最近的提交信息
   */
  async getRecentCommits(count: number = 20): Promise<GitCommitInfo[]> {
    try {
      const cmd = `git log --pretty=format:"%H|%h|%s|%an|%ad" --date=iso -${count}`;
      const { stdout } = await execAsync(cmd, { cwd: this.workspaceFolder });
      
      if (!stdout.trim()) {
        return [];
      }

      return stdout.trim().split('\n').map(line => {
        const [hash, shortHash, message, author, date] = line.split('|');
        return {
          hash: hash.trim(),
          shortHash: shortHash.trim(),
          message: message.trim(),
          author: author.trim(),
          date: date.trim()
        };
      });
    } catch (error) {
      console.error('获取提交历史失败:', error);
      return [];
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

  /**
   * 获取所有本地分支
   */
  async getLocalBranches(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('git branch --format="%(refname:short)"', { cwd: this.workspaceFolder });
      return stdout.trim().split('\n').filter(branch => branch.length > 0);
    } catch (error) {
      console.error('获取本地分支失败:', error);
      return [];
    }
  }

  /**
   * 获取所有远程分支
   */
  async getRemoteBranches(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('git branch -r --format="%(refname:short)"', { cwd: this.workspaceFolder });
      return stdout.trim().split('\n')
        .filter(branch => branch.length > 0 && !branch.includes('HEAD'))
        .map(branch => branch.replace('origin/', ''));
    } catch (error) {
      console.error('获取远程分支失败:', error);
      return [];
    }
  }

  /**
   * 根据关键词搜索提交
   */
  async searchCommits(keyword: string, count: number = 50): Promise<GitCommitInfo[]> {
    try {
      // 同时搜索提交消息和提交哈希
      const msgCmd = `git log --pretty=format:"%H|%h|%s|%an|%ad" --date=iso --grep="${keyword}" -${count}`;
      const hashCmd = `git log --pretty=format:"%H|%h|%s|%an|%ad" --date=iso --grep="${keyword}" -${count}`;
      
      let commits: GitCommitInfo[] = [];
      
      // 搜索提交消息
      try {
        const { stdout: msgStdout } = await execAsync(msgCmd, { cwd: this.workspaceFolder });
        if (msgStdout.trim()) {
          const msgCommits = msgStdout.trim().split('\n').map(line => {
            const [hash, shortHash, message, author, date] = line.split('|');
            return {
              hash: hash.trim(),
              shortHash: shortHash.trim(),
              message: message.trim(),
              author: author.trim(),
              date: date.trim()
            };
          });
          commits.push(...msgCommits);
        }
      } catch (e) {
        // 忽略搜索错误，继续下一种搜索
      }

      // 如果关键词看起来像哈希，也搜索哈希
      if (/^[a-f0-9]+$/i.test(keyword)) {
        try {
          const hashSearchCmd = `git log --pretty=format:"%H|%h|%s|%an|%ad" --date=iso --all --grep="${keyword}" -${count}`;
          const { stdout: hashStdout } = await execAsync(hashSearchCmd, { cwd: this.workspaceFolder });
          if (hashStdout.trim()) {
            const hashCommits = hashStdout.trim().split('\n').map(line => {
              const [hash, shortHash, message, author, date] = line.split('|');
              return {
                hash: hash.trim(),
                shortHash: shortHash.trim(),
                message: message.trim(),
                author: author.trim(),
                date: date.trim()
              };
            });
            commits.push(...hashCommits);
          }
        } catch (e) {
          // 忽略搜索错误
        }
      }

      // 去重，以hash为标准
      const uniqueCommits = commits.filter((commit, index, self) => 
        index === self.findIndex(c => c.hash === commit.hash)
      );

      return uniqueCommits;
    } catch (error) {
      console.error('搜索提交失败:', error);
      return [];
    }
  }
}
