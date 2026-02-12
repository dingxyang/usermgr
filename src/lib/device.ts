import { getCurrentPosition } from "@tauri-apps/plugin-geolocation";
import type { Gps, TerminalInfo } from "./types";
import { getAmapPosition } from "./amap";

const PRIMARY_TIMEOUT_MS = 5000;

export async function getCurrentGps(timeoutMs: number): Promise<Gps> {
  try {
    // 优先走系统定位，5 秒超时后切高德定位
    const position = await getCurrentPosition({
      enableHighAccuracy: true,
      timeout: Math.min(timeoutMs, PRIMARY_TIMEOUT_MS),
      maximumAge: 0,
    });

    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
  } catch (error) {
    console.error("Failed to get GPS from Tauri plugin:", error);
    try {
      const position = await getAmapPosition(timeoutMs);
      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
    } catch (amapError) {
      console.error("Amap geolocation error:", amapError);
      return null;
    }
  }
}

export function getPlatformLabel(): string {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("android")) return "Android";
  if (ua.includes("iphone") || ua.includes("ipad")) return "iOS";
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("mac os")) return "macOS";
  if (ua.includes("linux")) return "Linux";
  return "Unknown";
}

export function getDeviceModelLabel(): string {
  const ua = navigator.userAgent;
  return ua.length > 120 ? `${ua.slice(0, 117)}...` : ua;
}

export async function buildTerminalInfo(input: {
  terminalId: string;
  appId: string;
  status: TerminalInfo["status"];
  gps: Gps;
}): Promise<TerminalInfo> {
  const cores = typeof navigator.hardwareConcurrency === "number" ? `${navigator.hardwareConcurrency} cores` : "unknown";
  const memory =
    typeof (navigator as Navigator & { deviceMemory?: number }).deviceMemory === "number"
      ? `${(navigator as Navigator & { deviceMemory?: number }).deviceMemory} GB`
      : "unknown";

  return {
    terminal_id: input.terminalId,
    terminal_name: input.terminalId,
    app_id: input.appId,
    platform: getPlatformLabel(),
    device_model: getDeviceModelLabel(),
    cpu: cores,
    memory,
    gps: input.gps,
    status: input.status,
    last_update: new Date().toISOString(),
  };
}

