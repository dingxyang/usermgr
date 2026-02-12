export type TerminalStatus = "online" | "offline";

export type Gps = { lat: number; lng: number } | null;

export type TerminalInfo = {
  terminal_id: string;
  terminal_name: string;
  app_id: string;
  platform: string;
  device_model: string;
  cpu: string;
  memory: string;
  gps: Gps;
  status: TerminalStatus;
  last_update: string;
};

export type TerminalStore = {
  terminals: Record<string, TerminalInfo>;
};

export type Settings = {
  giteeAccessToken: string;
  giteeGistId: string;
  gistFileName: string;
  appId: string;
  refreshSeconds: number;
  onlineTimeoutMinutes: number;
  amapKey: string;
  amapSecurityCode: string;
};

