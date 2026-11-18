use crate::models::{
    ActiveTimerState, DayPlan, Deadline, ExamSettings, HourRow, PlannerState, StudySession,
    SubjectConfig, ThemeColors, ThemeConfig,
};
use rusqlite::{params, Connection, OptionalExtension, Result};
use std::collections::{BTreeMap, HashMap};
use std::path::Path;

pub fn init_database(db_path: &Path) -> Result<Connection> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS day_hours (
            date TEXT NOT NULL,
            hour INTEGER NOT NULL,
            block0 TEXT,
            block1 TEXT,
            block2 TEXT,
            block3 TEXT,
            class_minutes INTEGER NOT NULL DEFAULT 0,
            wasting_minutes INTEGER NOT NULL DEFAULT 0,
            sleep_minutes INTEGER NOT NULL DEFAULT 0,
            online_minutes INTEGER NOT NULL DEFAULT 0,
            note TEXT NOT NULL DEFAULT '',
            PRIMARY KEY (date, hour)
        );

        CREATE TABLE IF NOT EXISTS day_reflections (
            date TEXT PRIMARY KEY,
            reflection TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS deadlines (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            date TEXT NOT NULL,
            subject_id TEXT NOT NULL,
            category TEXT NOT NULL,
            priority TEXT NOT NULL,
            completed INTEGER NOT NULL DEFAULT 0,
            notes TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_deadlines_date ON deadlines(date);

        CREATE TABLE IF NOT EXISTS study_sessions (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            ended_at INTEGER NOT NULL,
            duration_seconds INTEGER NOT NULL,
            mode TEXT NOT NULL,
            category TEXT NOT NULL,
            subject_id TEXT NOT NULL,
            label TEXT NOT NULL,
            logged_to_sheet INTEGER NOT NULL DEFAULT 1
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_ended ON study_sessions(ended_at DESC);

        CREATE TABLE IF NOT EXISTS subjects (
            id TEXT PRIMARY KEY,
            sort_order INTEGER NOT NULL DEFAULT 0,
            name TEXT NOT NULL,
            short_code TEXT NOT NULL,
            color TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS themes (
            id TEXT PRIMARY KEY,
            sort_order INTEGER NOT NULL DEFAULT 0,
            name TEXT NOT NULL,
            is_dark INTEGER NOT NULL DEFAULT 0,
            is_built_in INTEGER NOT NULL DEFAULT 0,
            colors_json TEXT NOT NULL,
            font_pairing TEXT NOT NULL,
            radius_style TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS exam_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            student_name TEXT NOT NULL,
            stream_label TEXT NOT NULL,
            exam_date TEXT NOT NULL,
            plan_start_date TEXT NOT NULL,
            daily_target_minutes INTEGER NOT NULL,
            sound_enabled INTEGER NOT NULL DEFAULT 1,
            active_theme_id TEXT NOT NULL,
            pear_enabled INTEGER NOT NULL DEFAULT 0,
            pear_base_url TEXT NOT NULL DEFAULT 'http://127.0.0.1:26538',
            pear_token TEXT NOT NULL DEFAULT '',
            pear_auto_pause_on_finish INTEGER NOT NULL DEFAULT 1,
            pear_auto_resume_on_start INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS active_timer (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            mode TEXT NOT NULL,
            status TEXT NOT NULL,
            started_at INTEGER,
            accumulated_ms INTEGER NOT NULL DEFAULT 0,
            target_minutes INTEGER NOT NULL DEFAULT 50,
            subject_id TEXT NOT NULL,
            category TEXT NOT NULL,
            label TEXT NOT NULL,
            laps_json TEXT NOT NULL DEFAULT '[]'
        );
        ",
    )?;

    // Idempotent schema migrations for existing SQLite databases
    for migration_sql in [
        "ALTER TABLE exam_settings ADD COLUMN pear_enabled INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE exam_settings ADD COLUMN pear_base_url TEXT NOT NULL DEFAULT 'http://127.0.0.1:26538'",
        "ALTER TABLE exam_settings ADD COLUMN pear_token TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE exam_settings ADD COLUMN pear_auto_pause_on_finish INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE exam_settings ADD COLUMN pear_auto_resume_on_start INTEGER NOT NULL DEFAULT 0",
    ] {
        let _ = conn.execute(migration_sql, []);
    }

    Ok(conn)
}

fn default_empty_hours() -> Vec<HourRow> {
    (0..24)
        .map(|h| HourRow {
            hour: h,
            blocks: [None, None, None, None],
            class_minutes: 0,
            wasting_minutes: 0,
            sleep_minutes: 0,
            online_minutes: 0,
            note: String::new(),
        })
        .collect()
}

pub fn load_full_state(conn: &Connection) -> Result<Option<PlannerState>> {
    let initialized: Option<String> = conn
        .query_row(
            "SELECT value FROM app_meta WHERE key = 'initialized'",
            [],
            |row| row.get(0),
        )
        .optional()?;

    if initialized.is_none() {
        return Ok(None);
    }

    // Load exam_settings + active_theme_id
    let (exam_settings, active_theme_id): (ExamSettings, String) = conn.query_row(
        "SELECT student_name, stream_label, exam_date, plan_start_date, daily_target_minutes, sound_enabled, active_theme_id, pear_enabled, pear_base_url, pear_token, pear_auto_pause_on_finish, pear_auto_resume_on_start FROM exam_settings WHERE id = 1",
        [],
        |row| {
            Ok((
                ExamSettings {
                    student_name: row.get(0)?,
                    stream_label: row.get(1)?,
                    exam_date: row.get(2)?,
                    plan_start_date: row.get(3)?,
                    daily_target_minutes: row.get(4)?,
                    sound_enabled: row.get::<_, i64>(5)? != 0,
                    pear_enabled: row.get::<_, i64>(7)? != 0,
                    pear_base_url: row.get(8)?,
                    pear_token: row.get(9)?,
                    pear_auto_pause_on_finish: row.get::<_, i64>(10)? != 0,
                    pear_auto_resume_on_start: row.get::<_, i64>(11)? != 0,
                },
                row.get(6)?,
            ))
        },
    )?;

    // Load active_timer
    let timer: ActiveTimerState = conn.query_row(
        "SELECT mode, status, started_at, accumulated_ms, target_minutes, subject_id, category, label, laps_json FROM active_timer WHERE id = 1",
        [],
        |row| {
            let laps_raw: String = row.get(8)?;
            let laps: Vec<i64> = serde_json::from_str(&laps_raw).unwrap_or_default();
            Ok(ActiveTimerState {
                mode: row.get(0)?,
                status: row.get(1)?,
                started_at: row.get(2)?,
                accumulated_ms: row.get(3)?,
                target_minutes: row.get(4)?,
                subject_id: row.get(5)?,
                category: row.get(6)?,
                label: row.get(7)?,
                laps,
            })
        },
    )?;

    // Load subjects
    let mut subj_stmt = conn.prepare(
        "SELECT id, name, short_code, color FROM subjects ORDER BY sort_order ASC",
    )?;
    let subjects = subj_stmt
        .query_map([], |row| {
            Ok(SubjectConfig {
                id: row.get(0)?,
                name: row.get(1)?,
                short_code: row.get(2)?,
                color: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;

    // Load themes
    let mut theme_stmt = conn.prepare(
        "SELECT id, name, is_dark, is_built_in, colors_json, font_pairing, radius_style FROM themes ORDER BY sort_order ASC",
    )?;
    let themes = theme_stmt
        .query_map([], |row| {
            let colors_raw: String = row.get(4)?;
            let colors: ThemeColors = serde_json::from_str(&colors_raw).map_err(|e| {
                rusqlite::Error::FromSqlConversionFailure(4, rusqlite::types::Type::Text, Box::new(e))
            })?;
            let is_built_in_int: i64 = row.get(3)?;
            Ok(ThemeConfig {
                id: row.get(0)?,
                name: row.get(1)?,
                is_dark: row.get::<_, i64>(2)? != 0,
                is_built_in: Some(is_built_in_int != 0),
                colors,
                font_pairing: row.get(5)?,
                radius_style: row.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;

    // Load deadlines
    let mut dl_stmt = conn.prepare(
        "SELECT id, title, date, subject_id, category, priority, completed, notes FROM deadlines ORDER BY date ASC",
    )?;
    let deadlines = dl_stmt
        .query_map([], |row| {
            Ok(Deadline {
                id: row.get(0)?,
                title: row.get(1)?,
                date: row.get(2)?,
                subject_id: row.get(3)?,
                category: row.get(4)?,
                priority: row.get(5)?,
                completed: row.get::<_, i64>(6)? != 0,
                notes: row.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;

    // Load study sessions
    let mut sess_stmt = conn.prepare(
        "SELECT id, date, ended_at, duration_seconds, mode, category, subject_id, label, logged_to_sheet FROM study_sessions ORDER BY ended_at DESC",
    )?;
    let sessions = sess_stmt
        .query_map([], |row| {
            Ok(StudySession {
                id: row.get(0)?,
                date: row.get(1)?,
                ended_at: row.get(2)?,
                duration_seconds: row.get(3)?,
                mode: row.get(4)?,
                category: row.get(5)?,
                subject_id: row.get(6)?,
                label: row.get(7)?,
                logged_to_sheet: row.get::<_, i64>(8)? != 0,
            })
        })?
        .collect::<Result<Vec<_>>>()?;

    // Load day_hours & day_reflections
    let mut days_map: BTreeMap<String, DayPlan> = BTreeMap::new();

    let mut refl_stmt = conn.prepare("SELECT date, reflection FROM day_reflections")?;
    let refl_rows = refl_stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    for item in refl_rows {
        let (date, reflection) = item?;
        days_map.insert(
            date.clone(),
            DayPlan {
                date,
                hours: default_empty_hours(),
                reflection: Some(reflection),
            },
        );
    }

    let mut hour_stmt = conn.prepare(
        "SELECT date, hour, block0, block1, block2, block3, class_minutes, wasting_minutes, sleep_minutes, online_minutes, note FROM day_hours",
    )?;
    let hour_rows = hour_stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            HourRow {
                hour: row.get::<_, u8>(1)?,
                blocks: [row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?],
                class_minutes: row.get(6)?,
                wasting_minutes: row.get(7)?,
                sleep_minutes: row.get(8)?,
                online_minutes: row.get(9)?,
                note: row.get(10)?,
            },
        ))
    })?;

    for item in hour_rows {
        let (date, hr) = item?;
        let idx = hr.hour as usize;
        if idx < 24 {
            let entry = days_map.entry(date.clone()).or_insert_with(|| DayPlan {
                date,
                hours: default_empty_hours(),
                reflection: None,
            });
            entry.hours[idx] = hr;
        }
    }

    let days: HashMap<String, DayPlan> = days_map.into_iter().collect();

    Ok(Some(PlannerState {
        days,
        deadlines,
        sessions,
        subjects,
        themes,
        active_theme_id,
        exam_settings,
        timer,
    }))
}

pub fn replace_full_state(conn: &mut Connection, state: &PlannerState) -> Result<()> {
    let tx = conn.transaction()?;

    tx.execute_batch(
        "
        DELETE FROM day_hours;
        DELETE FROM day_reflections;
        DELETE FROM deadlines;
        DELETE FROM study_sessions;
        DELETE FROM subjects;
        DELETE FROM themes;
        DELETE FROM exam_settings;
        DELETE FROM active_timer;
        ",
    )?;

    tx.execute(
        "INSERT INTO exam_settings (id, student_name, stream_label, exam_date, plan_start_date, daily_target_minutes, sound_enabled, active_theme_id, pear_enabled, pear_base_url, pear_token, pear_auto_pause_on_finish, pear_auto_resume_on_start)
         VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            state.exam_settings.student_name,
            state.exam_settings.stream_label,
            state.exam_settings.exam_date,
            state.exam_settings.plan_start_date,
            state.exam_settings.daily_target_minutes,
            if state.exam_settings.sound_enabled { 1 } else { 0 },
            state.active_theme_id,
            if state.exam_settings.pear_enabled { 1 } else { 0 },
            state.exam_settings.pear_base_url,
            state.exam_settings.pear_token,
            if state.exam_settings.pear_auto_pause_on_finish { 1 } else { 0 },
            if state.exam_settings.pear_auto_resume_on_start { 1 } else { 0 },
        ],
    )?;

    let laps_json = serde_json::to_string(&state.timer.laps).unwrap_or_else(|_| "[]".to_string());
    tx.execute(
        "INSERT INTO active_timer (id, mode, status, started_at, accumulated_ms, target_minutes, subject_id, category, label, laps_json)
         VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            state.timer.mode,
            state.timer.status,
            state.timer.started_at,
            state.timer.accumulated_ms,
            state.timer.target_minutes,
            state.timer.subject_id,
            state.timer.category,
            state.timer.label,
            laps_json,
        ],
    )?;

    for (idx, subj) in state.subjects.iter().enumerate() {
        tx.execute(
            "INSERT INTO subjects (id, sort_order, name, short_code, color) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![subj.id, idx as i64, subj.name, subj.short_code, subj.color],
        )?;
    }

    for (idx, theme) in state.themes.iter().enumerate() {
        let colors_json = serde_json::to_string(&theme.colors).unwrap_or_default();
        tx.execute(
            "INSERT INTO themes (id, sort_order, name, is_dark, is_built_in, colors_json, font_pairing, radius_style)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                theme.id,
                idx as i64,
                theme.name,
                if theme.is_dark { 1 } else { 0 },
                if theme.is_built_in.unwrap_or(false) { 1 } else { 0 },
                colors_json,
                theme.font_pairing,
                theme.radius_style,
            ],
        )?;
    }

    for dl in &state.deadlines {
        tx.execute(
            "INSERT INTO deadlines (id, title, date, subject_id, category, priority, completed, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                dl.id,
                dl.title,
                dl.date,
                dl.subject_id,
                dl.category,
                dl.priority,
                if dl.completed { 1 } else { 0 },
                dl.notes,
            ],
        )?;
    }

    for sess in &state.sessions {
        tx.execute(
            "INSERT INTO study_sessions (id, date, ended_at, duration_seconds, mode, category, subject_id, label, logged_to_sheet)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                sess.id,
                sess.date,
                sess.ended_at,
                sess.duration_seconds,
                sess.mode,
                sess.category,
                sess.subject_id,
                sess.label,
                if sess.logged_to_sheet { 1 } else { 0 },
            ],
        )?;
    }

    for (date, plan) in &state.days {
        if let Some(ref refl) = plan.reflection {
            if !refl.is_empty() {
                tx.execute(
                    "INSERT INTO day_reflections (date, reflection) VALUES (?1, ?2)",
                    params![date, refl],
                )?;
            }
        }
        for row in &plan.hours {
            let has_data = row.blocks.iter().any(|b| b.is_some())
                || row.class_minutes > 0
                || row.wasting_minutes > 0
                || row.sleep_minutes > 0
                || row.online_minutes > 0
                || !row.note.is_empty();
            if has_data {
                tx.execute(
                    "INSERT INTO day_hours (date, hour, block0, block1, block2, block3, class_minutes, wasting_minutes, sleep_minutes, online_minutes, note)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                    params![
                        date,
                        row.hour,
                        row.blocks[0],
                        row.blocks[1],
                        row.blocks[2],
                        row.blocks[3],
                        row.class_minutes,
                        row.wasting_minutes,
                        row.sleep_minutes,
                        row.online_minutes,
                        row.note,
                    ],
                )?;
            }
        }
    }

    tx.execute(
        "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('initialized', '1')",
        [],
    )?;

    tx.commit()?;
    Ok(())
}

pub fn upsert_day_hour(conn: &Connection, date: &str, row: &HourRow) -> Result<()> {
    conn.execute(
        "INSERT INTO day_hours (date, hour, block0, block1, block2, block3, class_minutes, wasting_minutes, sleep_minutes, online_minutes, note)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT(date, hour) DO UPDATE SET
            block0 = excluded.block0,
            block1 = excluded.block1,
            block2 = excluded.block2,
            block3 = excluded.block3,
            class_minutes = excluded.class_minutes,
            wasting_minutes = excluded.wasting_minutes,
            sleep_minutes = excluded.sleep_minutes,
            online_minutes = excluded.online_minutes,
            note = excluded.note",
        params![
            date,
            row.hour,
            row.blocks[0],
            row.blocks[1],
            row.blocks[2],
            row.blocks[3],
            row.class_minutes,
            row.wasting_minutes,
            row.sleep_minutes,
            row.online_minutes,
            row.note,
        ],
    )?;
    Ok(())
}

pub fn clear_day(conn: &mut Connection, date: &str) -> Result<()> {
    let tx = conn.transaction()?;
    tx.execute("DELETE FROM day_hours WHERE date = ?1", params![date])?;
    tx.execute("DELETE FROM day_reflections WHERE date = ?1", params![date])?;
    tx.commit()?;
    Ok(())
}

pub fn upsert_reflection(conn: &Connection, date: &str, reflection: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO day_reflections (date, reflection) VALUES (?1, ?2)
         ON CONFLICT(date) DO UPDATE SET reflection = excluded.reflection",
        params![date, reflection],
    )?;
    Ok(())
}

pub fn upsert_deadline(conn: &Connection, dl: &Deadline) -> Result<()> {
    conn.execute(
        "INSERT INTO deadlines (id, title, date, subject_id, category, priority, completed, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            date = excluded.date,
            subject_id = excluded.subject_id,
            category = excluded.category,
            priority = excluded.priority,
            completed = excluded.completed,
            notes = excluded.notes",
        params![
            dl.id,
            dl.title,
            dl.date,
            dl.subject_id,
            dl.category,
            dl.priority,
            if dl.completed { 1 } else { 0 },
            dl.notes,
        ],
    )?;
    Ok(())
}

pub fn delete_deadline(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM deadlines WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn insert_session(conn: &Connection, sess: &StudySession) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO study_sessions (id, date, ended_at, duration_seconds, mode, category, subject_id, label, logged_to_sheet)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            sess.id,
            sess.date,
            sess.ended_at,
            sess.duration_seconds,
            sess.mode,
            sess.category,
            sess.subject_id,
            sess.label,
            if sess.logged_to_sheet { 1 } else { 0 },
        ],
    )?;
    Ok(())
}

pub fn delete_session(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM study_sessions WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn set_active_theme(conn: &Connection, theme_id: &str) -> Result<()> {
    conn.execute(
        "UPDATE exam_settings SET active_theme_id = ?1 WHERE id = 1",
        params![theme_id],
    )?;
    Ok(())
}

pub fn upsert_theme(conn: &Connection, theme: &ThemeConfig) -> Result<()> {
    let colors_json = serde_json::to_string(&theme.colors).unwrap_or_default();
    conn.execute(
        "INSERT INTO themes (id, sort_order, name, is_dark, is_built_in, colors_json, font_pairing, radius_style)
         VALUES (?1, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM themes), ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            is_dark = excluded.is_dark,
            colors_json = excluded.colors_json,
            font_pairing = excluded.font_pairing,
            radius_style = excluded.radius_style",
        params![
            theme.id,
            theme.name,
            if theme.is_dark { 1 } else { 0 },
            if theme.is_built_in.unwrap_or(false) { 1 } else { 0 },
            colors_json,
            theme.font_pairing,
            theme.radius_style,
        ],
    )?;
    Ok(())
}

pub fn delete_theme(conn: &Connection, id: &str) -> Result<()> {
    conn.execute(
        "DELETE FROM themes WHERE id = ?1 AND is_built_in = 0",
        params![id],
    )?;
    Ok(())
}

pub fn save_exam_settings(conn: &Connection, settings: &ExamSettings) -> Result<()> {
    conn.execute(
        "UPDATE exam_settings SET
            student_name = ?1,
            stream_label = ?2,
            exam_date = ?3,
            plan_start_date = ?4,
            daily_target_minutes = ?5,
            sound_enabled = ?6,
            pear_enabled = ?7,
            pear_base_url = ?8,
            pear_token = ?9,
            pear_auto_pause_on_finish = ?10,
            pear_auto_resume_on_start = ?11
         WHERE id = 1",
        params![
            settings.student_name,
            settings.stream_label,
            settings.exam_date,
            settings.plan_start_date,
            settings.daily_target_minutes,
            if settings.sound_enabled { 1 } else { 0 },
            if settings.pear_enabled { 1 } else { 0 },
            settings.pear_base_url,
            settings.pear_token,
            if settings.pear_auto_pause_on_finish { 1 } else { 0 },
            if settings.pear_auto_resume_on_start { 1 } else { 0 },
        ],
    )?;
    Ok(())
}

pub fn upsert_subject(conn: &Connection, subj: &SubjectConfig) -> Result<()> {
    conn.execute(
        "INSERT INTO subjects (id, sort_order, name, short_code, color)
         VALUES (?1, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM subjects), ?2, ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            short_code = excluded.short_code,
            color = excluded.color",
        params![subj.id, subj.name, subj.short_code, subj.color],
    )?;
    Ok(())
}

pub fn delete_subject(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM subjects WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn save_timer_state(conn: &Connection, timer: &ActiveTimerState) -> Result<()> {
    let laps_json = serde_json::to_string(&timer.laps).unwrap_or_else(|_| "[]".to_string());
    conn.execute(
        "UPDATE active_timer SET
            mode = ?1,
            status = ?2,
            started_at = ?3,
            accumulated_ms = ?4,
            target_minutes = ?5,
            subject_id = ?6,
            category = ?7,
            label = ?8,
            laps_json = ?9
         WHERE id = 1",
        params![
            timer.mode,
            timer.status,
            timer.started_at,
            timer.accumulated_ms,
            timer.target_minutes,
            timer.subject_id,
            timer.category,
            timer.label,
            laps_json,
        ],
    )?;
    Ok(())
}

pub fn get_subject_name(conn: &Connection, subject_id: &str) -> String {
    conn.query_row(
        "SELECT name FROM subjects WHERE id = ?1",
        params![subject_id],
        |row| row.get::<_, String>(0),
    )
    .unwrap_or_else(|_| "Study".to_string())
}

pub fn get_due_today_deadlines(conn: &Connection, today_str: &str) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT title FROM deadlines WHERE date = ?1 AND completed = 0",
    )?;
    let titles = stmt
        .query_map(params![today_str], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>>>()?;
    Ok(titles)
}
