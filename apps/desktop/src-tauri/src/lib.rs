mod media_repository;
mod project_repository;

use media_repository::{import_media, list_project_media};
use project_repository::{create_project, list_recent_projects, open_project};

#[tauri::command]
fn healthcheck() -> &'static str {
    "ok"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            healthcheck,
            create_project,
            list_recent_projects,
            open_project,
            import_media,
            list_project_media
        ])
        .run(tauri::generate_context!())
        .expect("error while running Creator OS");
}
