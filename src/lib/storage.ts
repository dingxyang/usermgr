import type { Settings, TerminalStore } from "./types";

const SETTINGS_KEY = "usermgr.settings.v1";
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
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...defaultSettings,
      ...parsed,
      refreshSeconds: clampNumber(parsed.refreshSeconds, 2, 3600, defaultSettings.refreshSeconds),
      onlineTimeoutMinutes: clampNumber(
        parsed.onlineTimeoutMinutes,
        1,
        60 * 24,
        defaultSettings.onlineTimeoutMinutes,
      ),
    };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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

