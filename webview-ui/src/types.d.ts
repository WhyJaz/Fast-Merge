// 扩展Window接口
interface Window {
  acquireVsCodeApi?: () => any;
  appBus?: AppEventBus; // 修改为 AppEventBus 类型
} 