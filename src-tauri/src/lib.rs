mod db;
mod models;

use chrono::Local;
use models::{
    ActiveTimerState, Deadline, ExamSettings, HourRow, PlannerState, StudySession, SubjectConfig,
    ThemeConfig,
};
use rusqlite::Connection;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_notification::NotificationExt;

struct DbState {
    conn: Mutex<Connection>,
}

fn now_epoch_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn format_hms(ms: i64) -> String {
    let total_sec = (ms.max(0)) / 1000;
    let h = total_sec / 3600;
    let m = (total_sec % 3600) / 60;
    let s = total_sec % 60;
    format!("{:02}:{:02}:{:02}", h, m, s)
}

fn emit_sync(app: &AppHandle) {
    let _ = app.emit("planner-state-updated", ());
}

#[tauri::command]
fn load_planner_state(state: State<'_, DbState>) -> Result<Option<PlannerState>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::load_full_state(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn import_planner_state(
    app: AppHandle,
    state: State<'_, DbState>,
    planner: PlannerState,
) -> Result<(), String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::replace_full_state(&mut conn, &planner).map_err(|e| e.to_string())?;
    drop(conn);
    emit_sync(&app);
    Ok(())
}

#[tauri::command]
fn save_day_hour(
    app: AppHandle,
    state: State<'_, DbState>,
    date: String,
    row: HourRow,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::upsert_day_hour(&conn, &date, &row).map_err(|e| e.to_string())?;
    drop(conn);
    emit_sync(&app);
    Ok(())
}

#[tauri::command]
fn clear_day_plan(app: AppHandle, state: State<'_, DbState>, date: String) -> Result<(), String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::clear_day(&mut conn, &date).map_err(|e| e.to_string())?;
    drop(conn);
    emit_sync(&app);
    Ok(())
}

#[tauri::command]
fn save_day_reflection(
    app: AppHandle,
    state: State<'_, DbState>,
    date: String,
    reflection: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::upsert_reflection(&conn, &date, &reflection).map_err(|e| e.to_string())?;
    drop(conn);
    emit_sync(&app);
    Ok(())
}

#[tauri::command]
fn save_deadline(
    app: AppHandle,
    state: State<'_, DbState>,
    deadline: Deadline,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::upsert_deadline(&conn, &deadline).map_err(|e| e.to_string())?;
    drop(conn);
    emit_sync(&app);
    Ok(())
}

#[tauri::command]
fn remove_deadline(app: AppHandle, state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::delete_deadline(&conn, &id).map_err(|e| e.to_string())?;
    drop(conn);
    emit_sync(&app);
    Ok(())
}

#[tauri::command]
fn log_study_session(
    app: AppHandle,
    state: State<'_, DbState>,
    session: StudySession,
    updated_hours: Vec<(String, HourRow)>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::insert_session(&conn, &session).map_err(|e| e.to_string())?;
    for (date, row) in updated_hours {
        db::upsert_day_hour(&conn, &date, &row).map_err(|e| e.to_string())?;
    }
    drop(conn);
    emit_sync(&app);
    Ok(())
}

#[tauri::command]
fn remove_study_session(
    app: AppHandle,
    state: State<'_, DbState>,
    id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::delete_session(&conn, &id).map_err(|e| e.to_string())?;
    drop(conn);
    emit_sync(&app);
    Ok(())
}

#[tauri::command]
fn set_active_theme_id(
    app: AppHandle,
    state: State<'_, DbState>,
    theme_id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::set_active_theme(&conn, &theme_id).map_err(|e| e.to_string())?;
    drop(conn);
    emit_sync(&app);
    Ok(())
}

#[tauri::command]
fn save_custom_theme(
    app: AppHandle,
    state: State<'_, DbState>,
    theme: ThemeConfig,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::upsert_theme(&conn, &theme).map_err(|e| e.to_string())?;
    db::set_active_theme(&conn, &theme.id).map_err(|e| e.to_string())?;
    drop(conn);
    emit_sync(&app);
    Ok(())
}

#[tauri::command]
fn remove_custom_theme(
    app: AppHandle,
    state: State<'_, DbState>,
    theme_id: String,
    fallback_theme_id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::delete_theme(&conn, &theme_id).map_err(|e| e.to_string())?;
    db::set_active_theme(&conn, &fallback_theme_id).map_err(|e| e.to_string())?;
    drop(conn);
    emit_sync(&app);
    Ok(())
}

#[tauri::command]
fn save_exam_settings(
    app: AppHandle,
    state: State<'_, DbState>,
    settings: ExamSettings,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::save_exam_settings(&conn, &settings).map_err(|e| e.to_string())?;
    drop(conn);
    emit_sync(&app);
    Ok(())
}

#[tauri::command]
fn save_subject(
    app: AppHandle,
    state: State<'_, DbState>,
    subject: SubjectConfig,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::upsert_subject(&conn, &subject).map_err(|e| e.to_string())?;
    drop(conn);
    emit_sync(&app);
    Ok(())
}

#[tauri::command]
fn remove_subject(app: AppHandle, state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::delete_subject(&conn, &id).map_err(|e| e.to_string())?;
    drop(conn);
    emit_sync(&app);
    Ok(())
}

#[tauri::command]
fn save_timer_state(
    app: AppHandle,
    state: State<'_, DbState>,
    timer: ActiveTimerState,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::save_timer_state(&conn, &timer).map_err(|e| e.to_string())?;
    drop(conn);
    emit_sync(&app);
    Ok(())
}

#[tauri::command]
fn focus_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
    Ok(())
}

#[tauri::command]
fn toggle_mini_timer(app: AppHandle) -> Result<bool, String> {
    if let Some(mini) = app.get_webview_window("mini-timer") {
        let _ = mini.close();
        return Ok(false);
    }

    WebviewWindowBuilder::new(&app, "mini-timer", WebviewUrl::App("index.html?window=mini".into()))
        .title("Ghost Plan — Mini Timer")
        .inner_size(310.0, 140.0)
        .min_inner_size(260.0, 120.0)
        .resizable(true)
        .always_on_top(true)
        .decorations(false)
        .skip_taskbar(false)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(true)
}

fn pear_agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_millis(1200))
        .timeout_read(Duration::from_millis(1500))
        .timeout_write(Duration::from_millis(1500))
        .build()
}

fn normalize_pear_base(base_url: &str) -> String {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        "http://127.0.0.1:26538".to_string()
    } else {
        trimmed.to_string()
    }
}

fn send_pear_post(base_url: &str, token: Option<&str>, path: &str) -> Result<(), String> {
    let url = format!("{}{}", normalize_pear_base(base_url), path);
    let mut req = pear_agent().post(&url);
    if let Some(tok) = token {
        let t = tok.trim();
        if !t.is_empty() {
            req = req.set("Authorization", &format!("Bearer {}", t));
        }
    }
    req.call().map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
fn pear_get_song(base_url: String, token: Option<String>) -> Result<serde_json::Value, String> {
    let url = format!("{}/api/v1/song", normalize_pear_base(&base_url));
    let mut req = pear_agent().get(&url);
    if let Some(ref tok) = token {
        let t = tok.trim();
        if !t.is_empty() {
            req = req.set("Authorization", &format!("Bearer {}", t));
        }
    }
    let resp = req.call().map_err(|e| e.to_string())?;
    let body: serde_json::Value = resp.into_json().map_err(|e| e.to_string())?;
    Ok(body)
}

#[tauri::command]
fn pear_control(base_url: String, token: Option<String>, action: String) -> Result<(), String> {
    let path = match action.as_str() {
        "toggle-play" => "/api/v1/toggle-play",
        "play" => "/api/v1/play",
        "pause" => "/api/v1/pause",
        "next" => "/api/v1/next",
        "previous" => "/api/v1/previous",
        _ => return Err(format!("Unsupported Pear Desktop action: {}", action)),
    };
    send_pear_post(&base_url, token.as_deref(), path)
}

#[tauri::command]
fn pear_set_volume(base_url: String, token: Option<String>, volume: u8) -> Result<(), String> {
    let url = format!("{}/api/v1/volume", normalize_pear_base(&base_url));
    let mut req = pear_agent().post(&url);
    if let Some(ref tok) = token {
        let t = tok.trim();
        if !t.is_empty() {
            req = req.set("Authorization", &format!("Bearer {}", t));
        }
    }
    req.send_json(ureq::json!({ "volume": volume.min(100) }))
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn pear_request_auth(base_url: String) -> Result<String, String> {
    let url = format!("{}/auth/ghost-plan", normalize_pear_base(&base_url));
    let resp = pear_agent()
        .post(&url)
        .call()
        .map_err(|e| e.to_string())?;
    let body: serde_json::Value = resp.into_json().map_err(|e| e.to_string())?;
    body.get("accessToken")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Pear Desktop did not return an accessToken".to_string())
}

fn toggle_timer_from_tray(app: &AppHandle) {
    let db_state = app.state::<DbState>();
    let mut updated_timer: Option<ActiveTimerState> = None;

    if let Ok(conn) = db_state.conn.lock() {
        if let Ok(Some(planner)) = db::load_full_state(&conn) {
            let mut timer = planner.timer;
            let now = now_epoch_ms();
            if timer.status == "running" {
                let delta = timer.started_at.map(|s| (now - s).max(0)).unwrap_or(0);
                timer.accumulated_ms += delta;
                timer.started_at = None;
                timer.status = "paused".to_string();
            } else {
                timer.started_at = Some(now);
                timer.status = "running".to_string();
            }
            if db::save_timer_state(&conn, &timer).is_ok() {
                updated_timer = Some(timer);
            }
        }
    }

    if updated_timer.is_some() {
        emit_sync(app);
    }
}

fn spawn_tray_and_timer_monitor(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(1));

        let mut tooltip_text = "Ghost Plan — Ready".to_string();
        let mut completed_subject: Option<(String, i64)> = None;
        let mut pear_pause_target: Option<(String, String)> = None;

        {
            let db_state = app.state::<DbState>();
            if let Ok(conn) = db_state.conn.lock() {
                if let Ok(Some(planner)) = db::load_full_state(&conn) {
                    let mut timer = planner.timer;
                    let subj_name = db::get_subject_name(&conn, &timer.subject_id);
                    if timer.status == "running" {
                        let now = now_epoch_ms();
                        let elapsed = timer.accumulated_ms
                            + timer.started_at.map(|s| (now - s).max(0)).unwrap_or(0);
                        if timer.mode == "timer" {
                            let target_ms = timer.target_minutes * 60_000;
                            let remaining = (target_ms - elapsed).max(0);
                            tooltip_text =
                                format!("Ghost Plan · {} — {} left", subj_name, format_hms(remaining));

                            if remaining == 0 && target_ms > 0 {
                                let target_mins = timer.target_minutes;
                                timer.status = "paused".to_string();
                                timer.started_at = None;
                                timer.accumulated_ms = target_ms;
                                let _ = db::save_timer_state(&conn, &timer);
                                completed_subject = Some((subj_name, target_mins));
                                if planner.exam_settings.pear_enabled
                                    && planner.exam_settings.pear_auto_pause_on_finish
                                {
                                    pear_pause_target = Some((
                                        planner.exam_settings.pear_base_url.clone(),
                                        planner.exam_settings.pear_token.clone(),
                                    ));
                                }
                            }
                        } else {
                            tooltip_text =
                                format!("Ghost Plan · {} — {}", subj_name, format_hms(elapsed));
                        }
                    } else if timer.status == "paused" {
                        tooltip_text = format!("Ghost Plan · {} (Paused)", subj_name);
                    }
                }
            };
        }

        if let Some(tray) = app.tray_by_id("main-tray") {
            let _ = tray.set_tooltip(Some(&tooltip_text));
        }

        if let Some((base_url, token)) = pear_pause_target {
            let _ = send_pear_post(&base_url, Some(&token), "/api/v1/pause");
        }

        if let Some((subj_name, mins)) = completed_subject {
            emit_sync(&app);
            let _ = app.emit("timer-completed", mins);
            let _ = app
                .notification()
                .builder()
                .title("Focus Session Complete")
                .body(format!(
                    "{} ({} min) finished. Open Ghost Plan to log it to your sheet.",
                    subj_name, mins
                ))
                .show();
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_data_dir)?;
            let db_path = app_data_dir.join("ghost_plan.db");
            let conn = db::init_database(&db_path)?;

            // Startup due-today deadline toast check
            let today_str = Local::now().format("%Y-%m-%d").to_string();
            if let Ok(due_titles) = db::get_due_today_deadlines(&conn, &today_str) {
                if !due_titles.is_empty() {
                    let body = if due_titles.len() == 1 {
                        format!("Due today: {}", due_titles[0])
                    } else {
                        format!(
                            "{} deadlines due today (first: {})",
                            due_titles.len(),
                            due_titles[0]
                        )
                    };
                    let _ = app
                        .notification()
                        .builder()
                        .title("Ghost Plan — Today's Deadlines")
                        .body(body)
                        .show();
                }
            }

            app.manage(DbState {
                conn: Mutex::new(conn),
            });

            // System Tray setup
            let show_item =
                MenuItem::with_id(app, "show", "Show Main Window", true, None::<&str>)?;
            let mini_item =
                MenuItem::with_id(app, "mini", "Toggle Mini Timer", true, None::<&str>)?;
            let toggle_timer_item = MenuItem::with_id(
                app,
                "toggle-timer",
                "Pause / Resume Timer",
                true,
                None::<&str>,
            )?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Ghost Plan", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &mini_item, &toggle_timer_item, &quit_item])?;

            let mut tray_builder = TrayIconBuilder::with_id("main-tray")
                .menu(&menu)
                .tooltip("Ghost Plan — Ready")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        let _ = focus_main_window(app.clone());
                    }
                    "mini" => {
                        let _ = toggle_mini_timer(app.clone());
                    }
                    "toggle-timer" => {
                        toggle_timer_from_tray(app);
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let _ = focus_main_window(tray.app_handle().clone());
                    }
                });

            if let Some(icon) = app.default_window_icon().cloned() {
                tray_builder = tray_builder.icon(icon);
            }
            tray_builder.build(app)?;

            spawn_tray_and_timer_monitor(app.handle().clone());

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    // Minimize to tray instead of killing active timer
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            load_planner_state,
            import_planner_state,
            save_day_hour,
            clear_day_plan,
            save_day_reflection,
            save_deadline,
            remove_deadline,
            log_study_session,
            remove_study_session,
            set_active_theme_id,
            save_custom_theme,
            remove_custom_theme,
            save_exam_settings,
            save_subject,
            remove_subject,
            save_timer_state,
            focus_main_window,
            toggle_mini_timer,
            pear_get_song,
            pear_control,
            pear_set_volume,
            pear_request_auth,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Ghost Plan");
}
