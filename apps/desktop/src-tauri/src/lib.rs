mod media_repository;
mod preview_server;
mod project_repository;
mod timeline_commands;

use media_repository::{import_media, list_project_media};
use preview_server::{get_media_preview_url, start_preview_server};
use project_repository::{create_project, list_recent_projects, open_project};
use tauri::Manager;
use timeline_commands::{edit_timeline, get_timeline, TimelineWriteGuard};

#[tauri::command]
fn healthcheck() -> &'static str {
    "ok"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(TimelineWriteGuard::default())
        .setup(|app| {
            let state = start_preview_server(app.handle())
                .map_err(|error| std::io::Error::other(error.message))?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            healthcheck,
            create_project,
            list_recent_projects,
            open_project,
            import_media,
            list_project_media,
            get_timeline,
            edit_timeline,
            get_media_preview_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running Creator OS");
}
