use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

use reqwest::StatusCode;
use serde_json::json;

/// Build a deterministic device ID from hostname + OS.
/// The result is a hex string that stays the same across app restarts on the same machine.
fn build_device_id() -> String {
    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown-host".to_string());
    let os = std::env::consts::OS;

    let mut hasher = DefaultHasher::new();
    hostname.hash(&mut hasher);
    os.hash(&mut hasher);
    let hash = hasher.finish();
    format!("{:016x}", hash)
}

/// Tauri 命令：向前端暴露稳定的设备标识。
#[tauri::command]
fn get_device_id() -> String {
    build_device_id()
}

/// 记录日志前脱敏访问令牌，避免泄露。
fn redact_token_for_logs(token: &str) -> String {
    if token.is_empty() {
        return "<empty>".to_string();
    }
    if token.len() <= 8 {
        return "<redacted>".to_string();
    }
    format!("{}…{}", &token[..4], &token[token.len() - 4..])
}

/// Tauri 命令：从 Gitee gist 拉取指定文件内容。
/// 若 gist 中不存在该文件则返回 `Ok(None)`。
#[tauri::command]
async fn gitee_get_gist_file(
    gist_id: String,
    file_name: String,
    access_token: String,
) -> Result<Option<String>, String> {
    if gist_id.trim().is_empty() {
        return Err("gist_id is required".to_string());
    }
    if file_name.trim().is_empty() {
        return Err("file_name is required".to_string());
    }
    if access_token.trim().is_empty() {
        return Err("access_token is required".to_string());
    }

    // 复用客户端实例用于本次请求链路。
    let client = reqwest::Client::new();
    let url = format!(
        "https://gitee.com/api/v5/gists/{}?access_token={}",
        gist_id.trim(),
        access_token.trim()
    );
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!(
            "Gitee GET gist failed: status={} token={} body={}",
            status.as_u16(),
            redact_token_for_logs(&access_token),
            body
        ));
    }

    // Gitee gist 响应包含以文件名为 key 的 "files" 映射。
    let v: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let content = v
        .get("files")
        .and_then(|f| f.get(&file_name))
        .and_then(|f| f.get("content"))
        .and_then(|c| c.as_str())
        .map(|s| s.to_string());

    Ok(content)
}

/// Tauri 命令：使用 PATCH 更新/创建 Gitee gist 文件，失败时回退 PUT。
#[tauri::command]
async fn gitee_update_gist_file(
    gist_id: String,
    file_name: String,
    access_token: String,
    content: String,
) -> Result<(), String> {
    if gist_id.trim().is_empty() {
        return Err("gist_id is required".to_string());
    }
    if file_name.trim().is_empty() {
        return Err("file_name is required".to_string());
    }
    if access_token.trim().is_empty() {
        return Err("access_token is required".to_string());
    }

    // 复用客户端用于 PATCH/PUT 回退逻辑。
    let client = reqwest::Client::new();
    let url = format!(
        "https://gitee.com/api/v5/gists/{}?access_token={}",
        gist_id.trim(),
        access_token.trim()
    );
    // Gitee gist API 所需的请求体格式。
    let body = json!({
        "files": {
            file_name.trim(): {
                "content": content
            }
        }
    });

    let resp = client
        .patch(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().is_success() {
        return Ok(());
    }

    // 部分服务器不支持 gist 的 PATCH；为兼容性改用 PUT 重试。
    if resp.status() == StatusCode::METHOD_NOT_ALLOWED {
        let resp = client
            .put(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if resp.status().is_success() {
            return Ok(());
        }
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!(
            "Gitee PUT gist failed: status={} token={} body={}",
            status.as_u16(),
            redact_token_for_logs(&access_token),
            body
        ));
    }

    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();
    Err(format!(
        "Gitee PATCH gist failed: status={} token={} body={}",
        status.as_u16(),
        redact_token_for_logs(&access_token),
        body
    ))
}

/// Tauri 应用入口。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_geolocation::init())
        .invoke_handler(tauri::generate_handler![
            get_device_id,
            gitee_get_gist_file,
            gitee_update_gist_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
