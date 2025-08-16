import { FastMergeConfig } from '../utils/config-manager';
import { GitLabApiError } from '../shared/gitlab-types';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, string | number>;
  timeout?: number;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

/**
 * 基于fetch的HTTP客户端，统一处理所有HTTP请求
 * 自动集成fast-merge-config.json配置
 */
export class HttpClient {
  private config: FastMergeConfig | null = null;
  private defaultTimeout = 30000; // 30秒超时

  constructor(config?: FastMergeConfig) {
    this.config = config || null;
  }

  /**
   * 更新配置
   */
  updateConfig(config: FastMergeConfig): void {
    this.config = config;
  }

  /**
   * 检查配置是否有效
   */
  private ensureConfig(): void {
    if (!this.config || !this.config.gitlab.baseUrl || !this.config.gitlab.token) {
      throw new Error('GitLab 配置无效，请先设置 GitLab 服务器地址和访问令牌');
    }
  }

  /**
   * 构建完整的URL
   */
  private buildUrl(endpoint: string, params?: Record<string, string | number>): string {
    this.ensureConfig();
    
    const baseUrl = this.config!.gitlab.baseUrl.replace(/\/$/, '');
    const fullUrl = `${baseUrl}/api/v4${endpoint}`;
    
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
      return `${fullUrl}?${searchParams.toString()}`;
    }
    
    return fullUrl;
  }

  /**
   * 构建请求头
   */
  private buildHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    this.ensureConfig();
    
    return {
      'Authorization': `Bearer ${this.config!.gitlab.token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'VSCode-FastMerge-Extension',
      ...customHeaders
    };
  }

  /**
   * 实现超时控制的fetch
   */
  private async fetchWithTimeout(
    url: string, 
    options: RequestInit, 
    timeout: number = this.defaultTimeout
  ): Promise<Response> {
    // 在Node.js环境中使用动态导入node-fetch
    const fetch = (await import('node-fetch')).default;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      } as any);
      clearTimeout(timeoutId);
      return response as any;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`请求超时 (${timeout}ms)`);
      }
      throw error;
    }
  }

  /**
   * 处理响应
   */
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    let data: any;
    const contentType = response.headers.get('content-type');
    
    try {
      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } else {
        data = await response.text();
      }
    } catch (error) {
      throw new Error(`解析响应失败: ${error}`);
    }

    if (!response.ok) {
      const error: GitLabApiError = {
        message: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status
      };

      // 尝试从响应中提取详细错误信息
      if (typeof data === 'object' && data) {
        error.message = data.message || data.error_description || error.message;
        error.error = data.error;
      }

      throw error;
    }

    return {
      data,
      status: response.status,
      headers
    };
  }

  /**
   * 执行HTTP请求
   */
  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      headers: customHeaders = {},
      body,
      params,
      timeout = this.defaultTimeout
    } = options;

    try {
      const url = this.buildUrl(endpoint, params);
      const headers = this.buildHeaders(customHeaders);

      const requestOptions: RequestInit = {
        method,
        headers
      };

      // 添加请求体
      if (body && method !== 'GET') {
        if (typeof body === 'object') {
          requestOptions.body = JSON.stringify(body);
        } else {
          requestOptions.body = body;
        }
      }

      const response = await this.fetchWithTimeout(url, requestOptions, timeout);
      return await this.handleResponse<T>(response);
    } catch (error: any) {
      if (error.status) {
        // 已经是GitLabApiError，直接抛出
        throw error;
      }
      
      // 网络错误或其他错误
      throw new Error(`请求失败: ${error.message}`);
    }
  }

  /**
   * 便捷方法：GET请求
   */
  async get<T>(endpoint: string, params?: Record<string, string | number>, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET', params, headers });
  }

  /**
   * 便捷方法：POST请求
   */
  async post<T>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'POST', body, headers });
  }

  /**
   * 便捷方法：PUT请求
   */
  async put<T>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PUT', body, headers });
  }

  /**
   * 便捷方法：DELETE请求
   */
  async delete<T>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE', headers });
  }

  /**
   * 便捷方法：PATCH请求
   */
  async patch<T>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PATCH', body, headers });
  }
}

// 导出单例实例
export const httpClient = new HttpClient();