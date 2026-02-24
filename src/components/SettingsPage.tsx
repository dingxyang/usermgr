import { useState } from "react";
import type { UserSettings } from "../lib/storage";
import { loadUserSettings, saveUserSettings, loadSettings, defaultSettings } from "../lib/storage";
import type { Settings } from "../lib/types";
import { testGiteeConfig } from "../lib/gitee";
import { testAmapConfig } from "../lib/amap";
import "./SettingsPage.css";

interface SettingsPageProps {
  onBack: (newSettings?: Settings) => void;
}

type TestStatus = "idle" | "loading" | "success" | "error";

export default function SettingsPage({ onBack }: SettingsPageProps) {
  const [draft, setDraft] = useState<UserSettings>(() => loadUserSettings());
  const [giteeTest, setGiteeTest] = useState<{ status: TestStatus; msg?: string }>({ status: "idle" });
  const [amapTest, setAmapTest] = useState<{ status: TestStatus; msg?: string }>({ status: "idle" });

  function handleSave() {
    saveUserSettings(draft);
    onBack(loadSettings());
  }

  // 解析当前生效的 Gitee 配置（用户同时填了 token + gist id 才用用户的，否则用系统的）
  function resolveGiteeConfig() {
    const env = import.meta.env;
    const useUser = !!(draft.giteeAccessToken && draft.giteeGistId);
    return {
      accessToken: ((useUser ? draft.giteeAccessToken : "") || env.VITE_GITEE_ACCESS_TOKEN || "").trim(),
      gistId: ((useUser ? draft.giteeGistId : "") || env.VITE_GITEE_GIST_ID || "").trim(),
      fileName: (env.VITE_GIST_FILE_NAME ?? defaultSettings.gistFileName).trim(),
    };
  }

  // 解析当前生效的高德配置（用户同时填了 key + 安全码才用用户的，否则用系统的）
  function resolveAmapConfig() {
    const env = import.meta.env;
    const useUser = !!(draft.amapKey && draft.amapSecurityCode);
    return {
      key: ((useUser ? draft.amapKey : "") || env.VITE_AMAP_KEY || "").trim(),
      securityCode: ((useUser ? draft.amapSecurityCode : "") || env.VITE_AMAP_SECURITY_CODE || "").trim(),
    };
  }

  async function handleTestGitee() {
    const cfg = resolveGiteeConfig();
    if (!cfg.accessToken || !cfg.gistId) {
      setGiteeTest({ status: "error", msg: "Token 和 Gist ID 需同时配置" });
      return;
    }
    setGiteeTest({ status: "loading" });
    try {
      await testGiteeConfig(cfg);
      setGiteeTest({ status: "success", msg: "连接成功" });
    } catch (e) {
      setGiteeTest({ status: "error", msg: e instanceof Error ? e.message : "测试失败" });
    }
  }

  async function handleTestAmap() {
    const cfg = resolveAmapConfig();
    if (!cfg.key || !cfg.securityCode) {
      setAmapTest({ status: "error", msg: "Key 和安全码需同时配置" });
      return;
    }
    setAmapTest({ status: "loading" });
    try {
      await testAmapConfig(cfg);
      setAmapTest({ status: "success", msg: "连接成功" });
    } catch (e) {
      setAmapTest({ status: "error", msg: e instanceof Error ? e.message : "测试失败" });
    }
  }

  return (
    <div className="settingsPage">
      <div className="settingsHeader">
        <div className="backBtn" onClick={() => onBack()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/>
            <path d="M12 19l-7-7 7-7"/>
          </svg>
          返回
        </div>
      </div>

      <div className="settingsBody">
        {/* Gitee 配置 */}
        <div className="sectionTitle">
          Gitee 配置
          {(draft.giteeAccessToken || draft.giteeGistId) && (
            <span className="clearBtn" onClick={() => { setDraft((d) => ({ ...d, giteeAccessToken: "", giteeGistId: "" })); setGiteeTest({ status: "idle" }); }} title="清空 Gitee 配置">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
            </span>
          )}
        </div>
        <div className="field">
          <div className="label">Gitee Access Token</div>
          <input
            type="password"
            placeholder="留空则使用系统内置值"
            value={draft.giteeAccessToken ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, giteeAccessToken: e.target.value }))}
          />
        </div>
        <div className="field">
          <div className="label">Gitee Gist ID</div>
          <input
            placeholder="留空则使用系统内置值"
            value={draft.giteeGistId ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, giteeGistId: e.target.value }))}
          />
        </div>
        <div className="field">
          <div className="hint">需同时填写 Token 和 Gist ID 才会使用自定义配置</div>
          <div className="testRow">
            <button className="testBtn giteeTestBtn" onClick={handleTestGitee} disabled={giteeTest.status === "loading"}>
              {giteeTest.status === "loading" ? "测试中…" : "测试 Gitee 连接"}
            </button>
            {giteeTest.status === "success" && <span className="testOk">{giteeTest.msg}</span>}
            {giteeTest.status === "error" && <span className="testErr">{giteeTest.msg}</span>}
          </div>
        </div>

        <div className="sectionDivider" />

        {/* 高德地图配置 */}
        <div className="sectionTitle">
          高德地图配置
          {(draft.amapKey || draft.amapSecurityCode) && (
            <span className="clearBtn" onClick={() => { setDraft((d) => ({ ...d, amapKey: "", amapSecurityCode: "" })); setAmapTest({ status: "idle" }); }} title="清空高德地图配置">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
            </span>
          )}
        </div>
        <div className="field">
          <div className="label">高德地图 Key</div>
          <input
            placeholder="留空则使用系统内置值"
            value={draft.amapKey ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, amapKey: e.target.value }))}
          />
        </div>
        <div className="field">
          <div className="label">高德地图安全码</div>
          <input
            placeholder="留空则使用系统内置值"
            value={draft.amapSecurityCode ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, amapSecurityCode: e.target.value }))}
          />
        </div>
        <div className="field">
          <div className="hint">需同时填写 Key 和安全码才会使用自定义配置</div>
          <div className="testRow">
            <button className="testBtn amapTestBtn" onClick={handleTestAmap} disabled={amapTest.status === "loading"}>
              {amapTest.status === "loading" ? "测试中…" : "测试高德地图连接"}
            </button>
            {amapTest.status === "success" && <span className="testOk">{amapTest.msg}</span>}
            {amapTest.status === "error" && <span className="testErr">{amapTest.msg}</span>}
          </div>
        </div>

        <div className="row" style={{ marginTop: 14 }}>
          <button onClick={handleSave} style={{ backgroundColor: "#007bff", color: "#fff" }}>保存</button>
          <button onClick={() => onBack()}>取消</button>
        </div>
      </div>
    </div>
  );
}
