import type { Settings, TerminalStore } from "./types";

const TERMINAL_ID_KEY = "usermgr.terminalId.v1";
const STORE_CACHE_KEY = "usermgr.storeCache.v1";

export const defaultSettings: Settings = {
  giteeAccessToken: "",
  giteeGistId: "",
  gistFileName: "terminals.json",
  appId: "usermgr",
  refreshSeconds: 10,
  onlineTimeoutMinutes: 2,
  amapKey: "",
  amapSecurityCode: "",
};

export function loadSettings(): Settings {
  const env = import.meta.env;
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
  return {
    giteeAccessToken: env.VITE_GITEE_ACCESS_TOKEN ?? defaultSettings.giteeAccessToken,
    giteeGistId: env.VITE_GITEE_GIST_ID ?? defaultSettings.giteeGistId,
    gistFileName: env.VITE_GIST_FILE_NAME ?? defaultSettings.gistFileName,
    appId: env.VITE_APP_ID ?? defaultSettings.appId,
    refreshSeconds,
    onlineTimeoutMinutes,
    amapKey: env.VITE_AMAP_KEY ?? defaultSettings.amapKey,
    amapSecurityCode: env.VITE_AMAP_SECURITY_CODE ?? defaultSettings.amapSecurityCode,
  };
}

export function loadOrCreateTerminalId(): string {
  const existing = localStorage.getItem(TERMINAL_ID_KEY);
  if (existing) return existing;
  const id = crypto?.randomUUID?.() ?? `t_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  localStorage.setItem(TERMINAL_ID_KEY, id);
  return id;
}

export function loadCachedStore(): TerminalStore | null {
  try {
    const raw = localStorage.getItem(STORE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TerminalStore;
  } catch {
    return null;
  }
}

export function saveCachedStore(store: TerminalStore) {
  localStorage.setItem(STORE_CACHE_KEY, JSON.stringify(store));
}

function clampNumber(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

