import AMapLoader from "@amap/amap-jsapi-loader";

// 从环境变量读取高德配置
const AMAP_KEY = import.meta.env.VITE_AMAP_KEY as string | undefined;
const AMAP_SECURITY_CODE = import.meta.env.VITE_AMAP_SECURITY_CODE as string | undefined;

// 避免重复加载 SDK
let amapSdkLoadingPromise: Promise<any> | null = null;

declare global {
  interface Window {
    _AMapSecurityConfig?: {
      securityJsCode?: string;
    };
    AMap?: any;
  }
}

// 基于高德 JS API 获取当前位置（统一返回与 Geolocation 类似的结构）
export function getAmapPosition(timeoutMs: number): Promise<{
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    altitude: null;
    altitudeAccuracy: null;
  };
}> {
  return new Promise(async (resolve, reject) => {
    try {
      const AMap = await loadAmapSdk();
      const geolocation = new AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: Math.max(timeoutMs, 10000),
        convert: true,
        needAddress: false,
      });

      geolocation.getCurrentPosition((status: string, result: any) => {
        if (status !== "complete" || !result || !result.position) {
          const errMsg = (result as { message?: string } | undefined)?.message || "高德定位返回异常";
          reject(new Error(errMsg));
          return;
        }
        // 兼容 position 是对象或带 getLng/getLat 方法的情况
        const lng =
          typeof result.position.lng === "number" ? result.position.lng : result.position.getLng?.();
        const lat =
          typeof result.position.lat === "number" ? result.position.lat : result.position.getLat?.();
        if (typeof lat !== "number" || typeof lng !== "number") {
          reject(new Error("高德定位坐标解析失败"));
          return;
        }

        resolve({
          coords: {
            latitude: lat,
            longitude: lng,
            accuracy: typeof result.accuracy === "number" ? result.accuracy : null,
            altitude: null,
            altitudeAccuracy: null,
          },
        });
      });
    } catch (e) {
      reject(e);
    }
  });
}

// 测试高德地图配置是否可用（通过 JS API 加载 SDK 验证）
export async function testAmapConfig(cfg: { key: string; securityCode: string }): Promise<void> {
  if (!cfg.key.trim()) throw new Error("缺少高德地图 Key");
  if (!cfg.securityCode.trim()) throw new Error("缺少高德地图安全码");

  window._AMapSecurityConfig = { securityJsCode: cfg.securityCode.trim() };

  await AMapLoader.load({
    key: cfg.key.trim(),
    version: "2.0",
    plugins: [],
  });
}

// 加载高德 JS SDK（单例）
function loadAmapSdk() {
  if (window.AMap) return Promise.resolve(window.AMap);
  if (amapSdkLoadingPromise) return amapSdkLoadingPromise;
  if (!AMAP_KEY) {
    return Promise.reject(new Error("未配置 VITE_AMAP_KEY"));
  }
  if (!AMAP_SECURITY_CODE) {
    return Promise.reject(new Error("未配置 VITE_AMAP_SECURITY_CODE"));
  }

  window._AMapSecurityConfig = {
    securityJsCode: AMAP_SECURITY_CODE,
  };

  amapSdkLoadingPromise = AMapLoader.load({
    key: AMAP_KEY,
    version: "2.0",
    plugins: ["AMap.Geolocation"],
  });

  return amapSdkLoadingPromise;
}
