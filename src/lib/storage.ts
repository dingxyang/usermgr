import { invoke } from "@tauri-apps/api/core";
import type { Settings, TerminalStore } from "./types";

// 本地存储 key（版本化便于后续迁移）
const TERMINAL_ID_KEY = "usermgr.terminalId.v1";
const STORE_CACHE_KEY = "usermgr.storeCache.v1";
const USER_SETTINGS_KEY = "usermgr.userSettings.v1";

// 用户可自定义的设置字段
export type UserSettings = {
  giteeAccessToken?: string;
  giteeGistId?: string;
  amapKey?: string;
  amapSecurityCode?: string;
};

// 默认设置项（可被环境变量覆盖）
export const defaultSettings: Settings = {
  giteeAccessToken: "",
  giteeGistId: "",
  gistFileName: "app.json",
  refreshSeconds: 10,
  onlineTimeoutMinutes: 60,
  amapKey: "",
  amapSecurityCode: "",
};

// 从环境变量加载设置，用户配置优先于系统内置值
export function loadSettings(): Settings {
  const env = import.meta.env;
  const user = loadUserSettings();
  const refreshSeconds = clampNumber(
    env.VITE_REFRESH_SECONDS ? Number(env.VITE_REFRESH_SECONDS) : NaN,
    2,
    3600,
    defaultSettings.refreshSeconds,
  );
  const onlineTimeoutMinutes = clampNumber(
    env.VITE_ONLINE_TIMEOUT_MINUTES ? Number(env.VITE_ONLINE_TIMEOUT_MINUTES) : NaN,
    1,
    60 * 24,
    defaultSettings.onlineTimeoutMinutes,
  );
  // Gitee: 只有同时配置了 token 和 gist id 才使用用户配置
  const useUserGitee = !!(user.giteeAccessToken && user.giteeGistId);
  // 高德: 只有同时配置了 key 和安全码才使用用户配置
  const useUserAmap = !!(user.amapKey && user.amapSecurityCode);

  return {
    giteeAccessToken: (useUserGitee ? user.giteeAccessToken : "") || env.VITE_GITEE_ACCESS_TOKEN || defaultSettings.giteeAccessToken,
    giteeGistId: (useUserGitee ? user.giteeGistId : "") || env.VITE_GITEE_GIST_ID || defaultSettings.giteeGistId,
    gistFileName: env.VITE_GIST_FILE_NAME ?? defaultSettings.gistFileName,
    refreshSeconds,
    onlineTimeoutMinutes,
    amapKey: (useUserAmap ? user.amapKey : "") || env.VITE_AMAP_KEY || defaultSettings.amapKey,
    amapSecurityCode: (useUserAmap ? user.amapSecurityCode : "") || env.VITE_AMAP_SECURITY_CODE || defaultSettings.amapSecurityCode,
  };
}

// 读取用户自定义设置
export function loadUserSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(USER_SETTINGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as UserSettings;
  } catch {
    return {};
  }
}

// 保存用户自定义设置
export function saveUserSettings(us: UserSettings) {
  localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(us));
}

// 判断是否在 Tauri 环境
function isTauri(): boolean {
  return typeof window !== "undefined" && Boolean(window.__TAURI__);
}

// 获取或生成终端 ID（Tauri 优先，浏览器退回 localStorage）
export async function loadOrCreateTerminalId(): Promise<string> {
  if (isTauri()) {
    try {
      const id = (await invoke("get_device_id")) as string;
      if (id) return id;
    } catch (e) {
      console.error("Failed to get device id from backend:", e);
    }
  }
  // 浏览器环境兜底：使用 localStorage
  const existing = localStorage.getItem(TERMINAL_ID_KEY);
  if (existing) return existing;
  const id = crypto?.randomUUID?.() ?? `t_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  localStorage.setItem(TERMINAL_ID_KEY, id);
  return id;
}

/** 删除终端存储中的废弃字段（terminal_name, app_id）。 */
export function sanitizeStore(store: TerminalStore): TerminalStore {
  const terminals: TerminalStore["terminals"] = {};
  for (const [key, t] of Object.entries(store.terminals ?? {})) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { terminal_name, app_id, ...clean } = t as any;
    terminals[key] = clean;
  }
  return { terminals };
}

// 读取本地缓存的终端数据
export function loadCachedStore(): TerminalStore | null {
  try {
    const raw = localStorage.getItem(STORE_CACHE_KEY);
    if (!raw) return null;
    return sanitizeStore(JSON.parse(raw) as TerminalStore);
  } catch {
    return null;
  }
}

// 保存终端数据到本地缓存
export function saveCachedStore(store: TerminalStore) {
  localStorage.setItem(STORE_CACHE_KEY, JSON.stringify(store));
}

// 将数值约束在范围内，非法值返回默认值
function clampNumber(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}
