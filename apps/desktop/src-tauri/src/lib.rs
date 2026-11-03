mod project_repository;

use project_repository::{create_project, list_recent_projects, open_project};

#[tauri::command]
fn healthcheck() -> &'static str {
    "ok"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            healthcheck,
            create_project,
            list_recent_projects,
            open_project
        ])
        .run(tauri::generate_context!())
        .expect("error while running Creator OS");
}
