use reqwest::StatusCode;
use serde_json::json;

fn redact_token_for_logs(token: &str) -> String {
    if token.is_empty() {
        return "<empty>".to_string();
    }
    if token.len() <= 8 {
        return "<redacted>".to_string();
    }
    format!("{}…{}", &token[..4], &token[token.len() - 4..])
}

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

    let v: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let content = v
        .get("files")
        .and_then(|f| f.get(&file_name))
        .and_then(|f| f.get("content"))
        .and_then(|c| c.as_str())
        .map(|s| s.to_string());

    Ok(content)
}

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

    let client = reqwest::Client::new();
    let url = format!(
        "https://gitee.com/api/v5/gists/{}?access_token={}",
        gist_id.trim(),
        access_token.trim()
    );
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_geolocation::init())
        .invoke_handler(tauri::generate_handler![
            gitee_get_gist_file,
            gitee_update_gist_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
