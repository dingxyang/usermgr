import { invoke } from "@tauri-apps/api/core";
import type { TerminalStore } from "./types";
import { sanitizeStore } from "./storage";

// Gitee gist 访问配置
export type GiteeConfig = {
  accessToken: string;
  gistId: string;
  fileName: string;
};

// 返回空的终端存储结构
export function emptyStore(): TerminalStore {
  return { terminals: {} };
}

// 从 Gitee gist 拉取终端信息（自动兜底为空）
export async function fetchStore(cfg: GiteeConfig): Promise<TerminalStore> {
  const content = await getGistFileContent(cfg);
  if (!content) return emptyStore();
  try {
    const parsed = JSON.parse(content) as TerminalStore;
    if (!parsed || typeof parsed !== "object" || typeof parsed.terminals !== "object") return emptyStore();
    return sanitizeStore(parsed);
  } catch {
    return emptyStore();
  }
}

// 将终端信息保存到 Gitee gist
export async function saveStore(cfg: GiteeConfig, store: TerminalStore): Promise<void> {
  const content = JSON.stringify(store, null, 2);
  await updateGistFileContent(cfg, content);
}

// 拉取 gist 指定文件内容（在 Tauri 端走后端接口）
async function getGistFileContent(cfg: GiteeConfig): Promise<string | null> {
  assertCfg(cfg);

  if (isTauri()) {
    const content = (await invoke("gitee_get_gist_file", {
      gist_id: cfg.gistId,
      file_name: cfg.fileName,
      access_token: cfg.accessToken,
    })) as string | null;
    return content ?? null;
  }

  const url = `https://gitee.com/api/v5/gists/${encodeURIComponent(cfg.gistId)}?access_token=${encodeURIComponent(
    cfg.accessToken,
  )}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Gitee GET failed (${resp.status})`);
  const v = (await resp.json()) as { files?: Record<string, { content?: string }> };
  return v.files?.[cfg.fileName]?.content ?? null;
}

// 更新 gist 文件内容（PATCH 失败回退 PUT）
async function updateGistFileContent(cfg: GiteeConfig, content: string): Promise<void> {
  assertCfg(cfg);

  if (isTauri()) {
    await invoke("gitee_update_gist_file", {
      gist_id: cfg.gistId,
      file_name: cfg.fileName,
      access_token: cfg.accessToken,
      content,
    });
    return;
  }

  const url = `https://gitee.com/api/v5/gists/${encodeURIComponent(cfg.gistId)}?access_token=${encodeURIComponent(
    cfg.accessToken,
  )}`;
  const body = {
    files: {
      [cfg.fileName]: { content },
    },
  };

  let resp = await fetch(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (resp.status === 405) {
    resp = await fetch(url, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  if (!resp.ok) throw new Error(`Gitee update failed (${resp.status})`);
}

// 判断是否在 Tauri 环境
function isTauri(): boolean {
  return typeof window !== "undefined" && Boolean(window.__TAURI__);
}

// 测试 Gitee 配置是否可用（读取 gist 验证连通性）
export async function testGiteeConfig(cfg: Pick<GiteeConfig, "accessToken" | "gistId">): Promise<void> {
  if (!cfg.accessToken.trim()) throw new Error("缺少 Access Token");
  if (!cfg.gistId.trim()) throw new Error("缺少 Gist ID");

  if (isTauri()) {
    await invoke("gitee_get_gist_file", {
      gist_id: cfg.gistId.trim(),
      file_name: "app.json",
      access_token: cfg.accessToken.trim(),
    });
    return;
  }

  const url = `https://gitee.com/api/v5/gists/${encodeURIComponent(cfg.gistId.trim())}?access_token=${encodeURIComponent(cfg.accessToken.trim())}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Gitee 请求失败 (${resp.status})`);
}

// 校验 Gitee 配置完整性
function assertCfg(cfg: GiteeConfig) {
  if (!cfg.gistId.trim()) throw new Error("Missing Gitee Gist ID");
  if (!cfg.fileName.trim()) throw new Error("Missing Gist file name");
  if (!cfg.accessToken.trim()) throw new Error("Missing Gitee access token");
}
