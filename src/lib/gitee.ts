import { invoke } from "@tauri-apps/api/core";
import type { TerminalStore } from "./types";

export type GiteeConfig = {
  accessToken: string;
  gistId: string;
  fileName: string;
};

export function emptyStore(): TerminalStore {
  return { terminals: {} };
}

export async function fetchStore(cfg: GiteeConfig): Promise<TerminalStore> {
  const content = await getGistFileContent(cfg);
  if (!content) return emptyStore();
  try {
    const parsed = JSON.parse(content) as TerminalStore;
    if (!parsed || typeof parsed !== "object" || typeof parsed.terminals !== "object") return emptyStore();
    return parsed;
  } catch {
    return emptyStore();
  }
}

export async function saveStore(cfg: GiteeConfig, store: TerminalStore): Promise<void> {
  const content = JSON.stringify(store, null, 2);
  await updateGistFileContent(cfg, content);
}

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

function isTauri(): boolean {
  return typeof window !== "undefined" && Boolean(window.__TAURI__);
}

function assertCfg(cfg: GiteeConfig) {
  if (!cfg.gistId.trim()) throw new Error("Missing Gitee Gist ID");
  if (!cfg.fileName.trim()) throw new Error("Missing Gist file name");
  if (!cfg.accessToken.trim()) throw new Error("Missing Gitee access token");
}
