// 终端在线状态
export type TerminalStatus = "online" | "offline";

// GPS 坐标（可能为空）
export type Gps = { lat: number; lng: number } | null;

// 单个终端的信息结构
export type TerminalInfo = {
  terminal_id: string; // 终端 ID
  platform: string; // 平台
  device_model: string; // 设备型号
  cpu: string; // CPU
  memory: string; // 内存
  gps: Gps; // GPS 坐标
  status: TerminalStatus; // 在线状态
  last_update: string; // 最后更新时间
};

// 终端信息存储结构
export type TerminalStore = {
  terminals: Record<string, TerminalInfo>;
};

// 应用设置项
export type Settings = {
  giteeAccessToken: string; // Gitee 访问令牌
  giteeGistId: string; // Gitee gist ID
  gistFileName: string; // Gitee gist 文件名
  refreshSeconds: number; // 刷新间隔（秒）
  onlineTimeoutMinutes: number; // 在线超时时间（分钟）
  amapKey: string; // 高德地图 API 密钥
  amapSecurityCode: string; // 高德地图安全码
};
