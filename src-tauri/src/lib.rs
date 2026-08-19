// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::{Deserialize, Serialize};

const BACKEND_CONFIG_PATH: &str = "/etc/navigator/backend.json";
const DEFAULT_BACKEND_URL: &str = "http://localhost:8001";

#[derive(Serialize, Deserialize)]
struct BackendConfig {
    backend_url: String,
    trust_ssl: bool,
}

#[tauri::command]
fn get_backend_config() -> BackendConfig {
    std::fs::read_to_string(BACKEND_CONFIG_PATH)
        .ok()
        .and_then(|s| serde_json::from_str::<BackendConfig>(&s).ok())
        .filter(|c| !c.backend_url.trim().is_empty())
        .unwrap_or_else(|| BackendConfig {
            backend_url: DEFAULT_BACKEND_URL.to_string(),
            trust_ssl: true,
        })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![get_backend_config])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
