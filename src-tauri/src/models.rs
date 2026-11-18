use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HourRow {
    pub hour: u8,
    pub blocks: [Option<String>; 4],
    pub class_minutes: u8,
    pub wasting_minutes: u8,
    pub sleep_minutes: u8,
    pub online_minutes: u8,
    pub note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DayPlan {
    pub date: String,
    pub hours: Vec<HourRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reflection: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Deadline {
    pub id: String,
    pub title: String,
    pub date: String,
    pub subject_id: String,
    pub category: String,
    pub priority: String,
    pub completed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudySession {
    pub id: String,
    pub date: String,
    pub ended_at: i64,
    pub duration_seconds: i64,
    pub mode: String,
    pub category: String,
    pub subject_id: String,
    pub label: String,
    pub logged_to_sheet: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubjectConfig {
    pub id: String,
    pub name: String,
    pub short_code: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeColors {
    pub canvas: String,
    pub surface: String,
    pub subtle: String,
    pub border: String,
    pub text_primary: String,
    pub text_secondary: String,
    pub accent: String,
    pub accent_fg: String,
    pub using_block: String,
    pub class_block: String,
    pub wasting_block: String,
    pub sleep_block: String,
    pub online_block: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeConfig {
    pub id: String,
    pub name: String,
    pub is_dark: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_built_in: Option<bool>,
    pub colors: ThemeColors,
    pub font_pairing: String,
    pub radius_style: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExamSettings {
    pub student_name: String,
    pub stream_label: String,
    pub exam_date: String,
    pub plan_start_date: String,
    pub daily_target_minutes: i64,
    pub sound_enabled: bool,
    #[serde(default)]
    pub pear_enabled: bool,
    #[serde(default = "default_pear_url")]
    pub pear_base_url: String,
    #[serde(default)]
    pub pear_token: String,
    #[serde(default = "default_true")]
    pub pear_auto_pause_on_finish: bool,
    #[serde(default)]
    pub pear_auto_resume_on_start: bool,
}

fn default_pear_url() -> String {
    "http://127.0.0.1:26538".to_string()
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveTimerState {
    pub mode: String,
    pub status: String,
    pub started_at: Option<i64>,
    pub accumulated_ms: i64,
    pub target_minutes: i64,
    pub subject_id: String,
    pub category: String,
    pub label: String,
    pub laps: Vec<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlannerState {
    pub days: HashMap<String, DayPlan>,
    pub deadlines: Vec<Deadline>,
    pub sessions: Vec<StudySession>,
    pub subjects: Vec<SubjectConfig>,
    pub themes: Vec<ThemeConfig>,
    pub active_theme_id: String,
    pub exam_settings: ExamSettings,
    pub timer: ActiveTimerState,
}
