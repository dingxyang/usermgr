import { useEffect, useMemo, useRef, useState } from "react";
import AMapLoader from "@amap/amap-jsapi-loader";
import type { TerminalInfo } from "../lib/types";
import markerIconUrl from "../assets/map-marker.svg";

type Props = {
  terminals: TerminalInfo[];
  amapKey?: string;
  amapSecurityCode?: string;
};

declare global {
  interface Window {
    _AMapSecurityConfig?: {
      securityJsCode?: string;
    };
    AMap?: any;
  }
}

export default function MapView({ terminals, amapKey, amapSecurityCode }: Props) {
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const points = useMemo(
    () =>
      terminals
        .filter((t) => t.gps)
        .map((t) => ({
          t,
          lng: t.gps!.lng,
          lat: t.gps!.lat,
        })),
    [terminals],
  );

  // 初始化地图
  useEffect(() => {
    if (!amapKey) {
      setMapError("请在设置中配置高德地图 API Key");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function initMap() {
      try {
        // 设置安全密钥（如果提供）
        if (amapSecurityCode) {
          window._AMapSecurityConfig = {
            securityJsCode: amapSecurityCode,
          };
        }

        // 加载高德地图 JS API
        const AMap = await AMapLoader.load({
          key: amapKey as string,
          version: "2.0",
          plugins: ["AMap.Scale", "AMap.ToolBar"],
        });

        if (cancelled) return;

        if (!containerRef.current) return;

        // 创建地图实例
        mapRef.current = new AMap.Map(containerRef.current, {
          viewMode: "3D",
          zoom: 11,
          center: [118.767413, 32.041544], // 默认中心点（南京）
          mapStyle: "amap://styles/normal",
        });

        // 添加比例尺和工具条
        mapRef.current.addControl(new AMap.Scale());
        mapRef.current.addControl(new AMap.ToolBar());

        setIsLoading(false);
        setMapError(null);
      } catch (error) {
        if (!cancelled) {
          console.error("地图加载失败:", error);
          setMapError(error instanceof Error ? error.message : "地图加载失败，请检查 API Key 和网络连接");
          setIsLoading(false);
        }
      }
    }

    void initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, [amapKey, amapSecurityCode]);

  // 更新标记点
  useEffect(() => {
    if (!mapRef.current || !window.AMap) return;

    // 清除旧标记
    markersRef.current.forEach((marker) => {
      marker.setMap(null);
    });
    markersRef.current = [];

    if (points.length === 0) {
      return;
    }

    // 创建新标记
    const AMap = window.AMap;
    const markerIcon = new AMap.Icon({
      image: markerIconUrl,
      size: new AMap.Size(32, 42),
      imageSize: new AMap.Size(32, 42),
    });
    const markers = points.map((p) => {
      const marker = new AMap.Marker({
        position: [p.lng, p.lat],
        title: p.t.terminal_name,
        icon: markerIcon,
        offset: new AMap.Pixel(-16, -42),
        map: mapRef.current,
      });

      // 创建信息窗口内容
      const infoContent = `
        <div style="padding: 12px; min-width: 240px; font-family: inherit;">
          <div style="font-weight: 600; font-size: 15px; margin-bottom: 10px; color: #0b1220; border-bottom: 1px solid rgba(20, 30, 50, 0.1); padding-bottom: 8px;">
            ${escapeHtml(p.t.terminal_name)}
          </div>
          <div style="font-size: 13px; line-height: 1.8; color: rgba(11, 18, 32, 0.85);">
            <div><b>平台：</b>${escapeHtml(p.t.platform)}</div>
            <div><b>型号：</b>${escapeHtml(p.t.device_model)}</div>
            <div><b>CPU：</b>${escapeHtml(p.t.cpu)}</div>
            <div><b>内存：</b>${escapeHtml(p.t.memory)}</div>
            <div><b>位置：</b>${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}</div>
            <div><b>更新：</b>${escapeHtml(new Date(p.t.last_update).toLocaleString())}</div>
          </div>
        </div>
      `;

      const infoWindow = new AMap.InfoWindow({
        content: infoContent,
        offset: new AMap.Pixel(0, -30),
      });

      marker.on("click", () => {
        infoWindow.open(mapRef.current, marker.getPosition());
      });

      return marker;
    });

    markersRef.current = markers;

    // 自动调整视野
    if (points.length === 1) {
      mapRef.current.setZoomAndCenter(14, [points[0].lng, points[0].lat]);
    } else {
      mapRef.current.setFitView(markers, false, [50, 50, 50, 50]);
    }
  }, [points]);

  if (!amapKey) {
    return (
      <div
        style={{
          padding: "20px",
          textAlign: "center",
          color: "#b42318",
          background: "rgba(180, 35, 24, 0.05)",
          borderRadius: "14px",
          border: "1px solid rgba(180, 35, 24, 0.2)",
        }}
      >
        <div style={{ marginBottom: "8px", fontWeight: 500 }}>未配置地图密钥</div>
        <div style={{ fontSize: "13px", opacity: 0.85 }}>请在设置中配置高德地图 API Key</div>
        <div
          style={{
            marginTop: "12px",
            fontSize: "12px",
            opacity: 0.75,
            lineHeight: 1.5,
          }}
        >
          请访问{" "}
          <a
            href="https://console.amap.com/dev/key/app"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#2f6aff", textDecoration: "underline" }}
          >
            高德开放平台
          </a>{" "}
          申请 Web 端（JS API）密钥
        </div>
      </div>
    );
  }

  if (mapError) {
    return (
      <div
        style={{
          padding: "20px",
          textAlign: "center",
          color: "#b42318",
          background: "rgba(180, 35, 24, 0.05)",
          borderRadius: "14px",
          border: "1px solid rgba(180, 35, 24, 0.2)",
        }}
      >
        <div style={{ marginBottom: "8px", fontWeight: 500 }}>地图加载失败</div>
        <div style={{ fontSize: "13px", opacity: 0.85 }}>{mapError}</div>
      </div>
    );
  }

  if (points.length === 0 && !isLoading) {
    return (
      <div
        style={{
          padding: "40px 20px",
          textAlign: "center",
          color: "rgba(11, 18, 32, 0.45)",
          background: "rgba(15, 23, 42, 0.02)",
          borderRadius: "14px",
          border: "1px solid rgba(20, 30, 50, 0.08)",
        }}
      >
        <div style={{ fontSize: "14px", marginBottom: "6px" }}>暂无终端位置数据</div>
        <div style={{ fontSize: "12px" }}>当终端上线并获取到 GPS 位置后，将在此处显示</div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {isLoading && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255, 255, 255, 0.95)",
            borderRadius: "14px",
            zIndex: 10,
          }}
        >
          <div style={{ fontSize: "13px", color: "rgba(11, 18, 32, 0.65)" }}>加载地图中...</div>
        </div>
      )}
      <div ref={containerRef} className="map" />
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
