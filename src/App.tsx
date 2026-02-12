import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import MapView from "./components/MapView";
import { buildTerminalInfo, getCurrentGps } from "./lib/device";
import { emptyStore, fetchStore, saveStore } from "./lib/gitee";
import { defaultSettings, loadCachedStore, loadOrCreateTerminalId, loadSettings, saveCachedStore } from "./lib/storage";
import type { Gps, TerminalInfo, TerminalStatus, TerminalStore } from "./lib/types";

function App() {
  const terminalId = useMemo(() => loadOrCreateTerminalId(), []);
  const settings = useMemo(() => loadSettings(), []);

  const [store, setStore] = useState<TerminalStore>(() => loadCachedStore() ?? emptyStore());
  const [storeError, setStoreError] = useState<string | null>(null);
  const [storeLoading, setStoreLoading] = useState(false);

  const [localStatus, setLocalStatus] = useState<TerminalStatus>("offline");
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const refreshInFlight = useRef(false);
  const heartbeatInFlight = useRef(false);

  const giteeCfg = useMemo(
    () => ({
      accessToken: (settings.giteeAccessToken || "").trim(),
      gistId: (settings.giteeGistId || "").trim(),
      fileName: (settings.gistFileName || "").trim() || defaultSettings.gistFileName,
    }),
    [settings.giteeAccessToken, settings.giteeGistId, settings.gistFileName],
  );

  const now = Date.now();
  const computedTerminals = useMemo(() => {
    const timeoutMs = settings.onlineTimeoutMinutes * 60_000;
    const list = Object.values(store.terminals ?? {});
    return list.map((t) => ({
      info: t,
      computedOnline: isComputedOnline(t, timeoutMs, now),
    }));
  }, [store, settings.onlineTimeoutMinutes, now]);

  const onlineTerminals = useMemo(
    () => computedTerminals.filter((t) => t.computedOnline).map((t) => t.info),
    [computedTerminals],
  );

  async function pullStore() {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setStoreLoading(true);
    setStoreError(null);
    try {
      const s = await fetchStore(giteeCfg);
      setStore(s);
      saveCachedStore(s);
      console.log("Pulled store:", s);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to fetch store";
      setStoreError(msg);
    } finally {
      setStoreLoading(false);
      refreshInFlight.current = false;
    }
  }

  async function withMergedStore(update: (s: TerminalStore) => TerminalStore) {
    setStoreError(null);
    try {
      const latest = await fetchStore(giteeCfg);
      const next = update(latest);
      await saveStore(giteeCfg, next);
      setStore(next);
      saveCachedStore(next);
      setSyncNote(`Synced at ${new Date().toLocaleTimeString()}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      setStoreError(msg);
      setSyncNote(null);
    }
  }

  async function join() {
    const gps = await getCurrentGps(8000);
    const info = await buildTerminalInfo({
      terminalId,
      appId: settings.appId,
      status: "online",
      gps,
    });
    await withMergedStore((s) => ({
      terminals: {
        ...(s.terminals ?? {}),
        [terminalId]: info,
      },
    }));
    setLocalStatus("online");
  }

  async function heartbeat() {
    if (heartbeatInFlight.current) return;
    heartbeatInFlight.current = true;
    try {
      const gps = await getCurrentGps(8000);
      const iso = new Date().toISOString();
      await withMergedStore((s) => {
        const existing = s.terminals?.[terminalId];
        const next: TerminalInfo = existing
          ? { ...existing, gps, status: "online", last_update: iso }
          : {
              terminal_id: terminalId,
              terminal_name: terminalId,
              app_id: settings.appId,
              platform: "Unknown",
              device_model: "Unknown",
              cpu: "unknown",
              memory: "unknown",
              gps,
              status: "online",
              last_update: iso,
            };

        return { terminals: { ...(s.terminals ?? {}), [terminalId]: next } };
      });
      setLocalStatus("online");
    } finally {
      heartbeatInFlight.current = false;
    }
  }

  async function exit() {
    const iso = new Date().toISOString();
    await withMergedStore((s) => {
      const existing = s.terminals?.[terminalId];
      if (!existing) return s;
      return {
        terminals: {
          ...(s.terminals ?? {}),
          [terminalId]: { ...existing, status: "offline", last_update: iso },
        },
      };
    });
    setLocalStatus("offline");
  }

  useEffect(() => {
    void pullStore();
    const t = window.setInterval(() => void pullStore(), settings.refreshSeconds * 1000);
    return () => window.clearInterval(t);
  }, [settings.refreshSeconds, giteeCfg.gistId, giteeCfg.fileName, giteeCfg.accessToken]);

  useEffect(() => {
    if (localStatus !== "online") return;
    const t = window.setInterval(() => void heartbeat(), 30000);
    return () => window.clearInterval(t);
  }, [localStatus, giteeCfg.gistId, giteeCfg.fileName, giteeCfg.accessToken, settings.appId, terminalId]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brandTitle">多终端在线管理</div>
          {/* <div className="brandMeta">
            终端：<span className="mono">{terminalId}</span>
          </div> */}
        </div>
      </header>

      <main className="content">
        {(storeError || syncNote) && (
          <div className="banner">
            {storeError ? <span className="error">{storeError}</span> : <span className="muted">{syncNote}</span>}
          </div>
        )}

        <section className="grid">
            <div className="card">
              <div className="row">
                <button onClick={() => void join()} disabled={storeLoading || !settings.giteeAccessToken || !settings.giteeGistId}>
                  加入（Join）
                </button>
                <button onClick={() => void exit()} disabled={storeLoading || localStatus !== "online"}>
                  退出（Exit）
                </button>
              </div>
              <div className="kv">
                <div className="k">当前状态</div>
                <div className="v">
                  <span className={localStatus === "online" ? "pill ok" : "pill"}>{localStatus}</span>
                </div>
              </div>
            </div>

            {computedTerminals.length > 0 && (
              <>
                <div className="card span2">
                  <div className="row spread">
                    <h2>在线终端</h2>
                    <div className="row">
                      <button onClick={() => void pullStore()} disabled={storeLoading}>
                        {storeLoading ? "刷新中…" : "手动刷新"}
                      </button>
                    </div>
                  </div>

                  {/* 桌面端表格视图 */}
                  <div className="tableWrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>平台</th>
                          <th>型号</th>
                          <th>CPU</th>
                          <th>内存</th>
                          <th>GPS</th>
                          <th>最近更新</th>
                          <th>状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {computedTerminals
                          .slice()
                          .sort((a, b) => Number(b.computedOnline) - Number(a.computedOnline))
                          .map(({ info, computedOnline }) => (
                            <tr key={info.terminal_id}>
                              <td>{info.platform}</td>
                              <td className="muted">{info.device_model}</td>
                              <td className="muted">{info.cpu}</td>
                              <td className="muted">{info.memory}</td>
                              <td className="muted">{formatGps(info.gps)}</td>
                              <td className="muted">{safeLocalTime(info.last_update)}</td>
                              <td>
                                <span className={computedOnline ? "pill ok" : "pill"}>{computedOnline ? "online" : "offline"}</span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 移动端卡片视图 */}
                  <div className="mobileCards">
                    {computedTerminals
                      .slice()
                      .sort((a, b) => Number(b.computedOnline) - Number(a.computedOnline))
                      .map(({ info, computedOnline }) => (
                        <div key={info.terminal_id} className={computedOnline ? "terminalCard" : "terminalCard offline"}>
                          <div className="terminalHeader">
                            <div className="terminalPlatform">{info.platform}</div>
                            <span className={computedOnline ? "pill ok" : "pill"}>{computedOnline ? "online" : "offline"}</span>
                          </div>
                          <div className="terminalInfo">
                            <div className="terminalInfoLabel">型号:</div>
                            <div className="terminalInfoValue">{info.device_model}</div>
                            <div className="terminalInfoLabel">CPU:</div>
                            <div className="terminalInfoValue">{info.cpu}</div>
                            <div className="terminalInfoLabel">内存:</div>
                            <div className="terminalInfoValue">{info.memory}</div>
                            {info.gps && (
                              <>
                                <div className="terminalInfoLabel">GPS:</div>
                                <div className="terminalInfoValue">{formatGps(info.gps)}</div>
                              </>
                            )}
                            <div className="terminalInfoLabel">更新:</div>
                            <div className="terminalInfoValue">{safeLocalTime(info.last_update)}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="card span2">
                  <div className="row spread">
                    <h2>地图分布</h2>
                    <div className="muted">仅显示在线且有 GPS 的终端</div>
                  </div>
                  <MapView 
                    terminals={onlineTerminals.filter((t) => t.gps)} 
                    amapKey={settings.amapKey}
                    amapSecurityCode={settings.amapSecurityCode}
                  />
                </div>
              </>
            )}
          </section>

      </main>
    </div>
  );
}

export default App;

function safeLocalTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function isComputedOnline(t: TerminalInfo, timeoutMs: number, nowMs: number): boolean {
  if (t.status !== "online") return false;
  const ts = Date.parse(t.last_update);
  if (Number.isNaN(ts)) return false;
  return nowMs - ts <= timeoutMs;
}

function formatGps(gps: Gps): string {
  if (!gps) return "-";
  return `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}`;
}
