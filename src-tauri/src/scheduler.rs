use std::fs;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Datelike, Duration, TimeZone, Utc};
use serde::{Deserialize, Serialize};

const SCHEDULES_FILE: &str = "schedules.json";

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ScheduleCadence {
    Once { at: String },
    Daily { hour: u8, minute: u8 },
    Weekly { weekday: u8, hour: u8, minute: u8 },
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleInput {
    pub name: String,
    pub prompt: String,
    pub thread_id: Option<String>,
    pub cadence: ScheduleCadence,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleRun {
    pub at: String,
    pub success: bool,
    pub message: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleRecord {
    pub id: String,
    pub name: String,
    pub prompt: String,
    pub thread_id: Option<String>,
    pub cadence: ScheduleCadence,
    pub next_run_at: String,
    pub enabled: bool,
    pub last_run: Option<ScheduleRun>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
pub struct ScheduleFile {
    pub schedules: Vec<ScheduleRecord>,
}

pub fn file_path(home: &Path) -> PathBuf {
    home.join(SCHEDULES_FILE)
}

pub fn load(home: &Path) -> Result<ScheduleFile, String> {
    let path = file_path(home);
    if !path.exists() {
        return Ok(ScheduleFile::default());
    }
    let content = fs::read_to_string(&path)
        .map_err(|error| format!("failed to read schedules: {error}"))?;
    serde_json::from_str(&content).map_err(|error| format!("failed to decode schedules: {error}"))
}

pub fn save(home: &Path, schedules: &ScheduleFile) -> Result<(), String> {
    fs::create_dir_all(home)
        .map_err(|error| format!("failed to create schedule home: {error}"))?;
    let path = file_path(home);
    let temporary = path.with_extension("json.tmp");
    let content = serde_json::to_string_pretty(schedules)
        .map_err(|error| format!("failed to encode schedules: {error}"))?;
    fs::write(&temporary, format!("{content}\n"))
        .map_err(|error| format!("failed to write schedules: {error}"))?;
    fs::rename(&temporary, &path)
        .map_err(|error| format!("failed to replace schedules: {error}"))
}

pub fn validate_input(input: &ScheduleInput, now: DateTime<Utc>) -> Result<(), String> {
    if input.name.trim().is_empty() || input.name.chars().count() > 120 {
        return Err("schedule name must be 1-120 characters".to_string());
    }
    if input.prompt.trim().is_empty() {
        return Err("schedule prompt must not be empty".to_string());
    }
    match &input.cadence {
        ScheduleCadence::Once { at } => parse_timestamp(at)
            .filter(|value| *value > now)
            .map(|_| ())
            .ok_or_else(|| "one-shot schedule must be in the future".to_string()),
        ScheduleCadence::Daily { hour, minute }
        | ScheduleCadence::Weekly { hour, minute, .. } => {
            if *hour >= 24 || *minute >= 60 {
                return Err("schedule time is outside the 24-hour clock".to_string());
            }
            if let ScheduleCadence::Weekly { weekday, .. } = input.cadence {
                if weekday > 6 {
                    return Err("weekly schedule weekday must be 0-6".to_string());
                }
            }
            Ok(())
        }
    }
}

pub fn next_run_after(cadence: &ScheduleCadence, now: DateTime<Utc>) -> Option<DateTime<Utc>> {
    match cadence {
        ScheduleCadence::Once { at } => parse_timestamp(at).filter(|value| *value > now),
        ScheduleCadence::Daily { hour, minute } => next_at_time(now, *hour, *minute, 0),
        ScheduleCadence::Weekly {
            weekday,
            hour,
            minute,
        } => {
            let current = now.weekday().num_days_from_sunday() as i64;
            let target = i64::from(*weekday);
            let mut days = (target - current + 7) % 7;
            let candidate = now
                .date_naive()
                .and_hms_opt(u32::from(*hour), u32::from(*minute), 0)?;
            let candidate = Utc.from_utc_datetime(&candidate);
            if days == 0 && candidate <= now {
                days = 7;
            }
            Some(candidate + Duration::days(days))
        }
    }
}

pub fn new_record(
    id: String,
    input: ScheduleInput,
    now: DateTime<Utc>,
) -> Result<ScheduleRecord, String> {
    validate_input(&input, now)?;
    let next = next_run_after(&input.cadence, now)
        .ok_or_else(|| "schedule has no future run".to_string())?;
    Ok(ScheduleRecord {
        id,
        name: input.name,
        prompt: input.prompt,
        thread_id: input.thread_id,
        cadence: input.cadence,
        next_run_at: next.to_rfc3339(),
        enabled: true,
        last_run: None,
    })
}

pub fn next_after_run(cadence: &ScheduleCadence, now: DateTime<Utc>) -> Option<DateTime<Utc>> {
    match cadence {
        ScheduleCadence::Once { .. } => None,
        _ => next_run_after(cadence, now),
    }
}

fn parse_timestamp(value: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|value| value.with_timezone(&Utc))
}

fn next_at_time(
    now: DateTime<Utc>,
    hour: u8,
    minute: u8,
    second: u32,
) -> Option<DateTime<Utc>> {
    let candidate = now
        .date_naive()
        .and_hms_opt(u32::from(hour), u32::from(minute), second)?;
    let candidate = Utc.from_utc_datetime(&candidate);
    Some(if candidate > now {
        candidate
    } else {
        candidate + Duration::days(1)
    })
}

#[cfg(test)]
mod tests {
    use super::{
        load, new_record, next_after_run, next_run_after, save, ScheduleCadence, ScheduleFile,
        ScheduleInput,
    };
    use chrono::{DateTime, Duration, Utc};
    use std::fs;
    use std::path::PathBuf;

    fn now() -> DateTime<Utc> {
        "2026-10-21T10:15:00Z".parse().unwrap()
    }

    #[test]
    fn calculates_daily_weekly_and_one_shot_runs() {
        let daily = ScheduleCadence::Daily { hour: 11, minute: 0 };
        assert_eq!(
            next_run_after(&daily, now()).unwrap().to_rfc3339(),
            "2026-10-21T11:00:00+00:00"
        );
        let weekly = ScheduleCadence::Weekly {
            weekday: 3,
            hour: 9,
            minute: 0,
        };
        assert_eq!(
            next_run_after(&weekly, now()).unwrap().to_rfc3339(),
            "2026-10-28T09:00:00+00:00"
        );
        let once = ScheduleCadence::Once {
            at: "2026-10-22T10:15:00Z".to_string(),
        };
        assert_eq!(next_after_run(&once, now()), None);
        assert_eq!(next_run_after(&once, now()).unwrap(), now() + Duration::days(1));
    }

    #[test]
    fn persists_schedule_records_with_restart_safe_round_trip() {
        let home = PathBuf::from(format!(
            "{}/ruxex-scheduler-test-{}",
            std::env::temp_dir().display(),
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&home);
        let input = ScheduleInput {
            name: "Nightly checks".to_string(),
            prompt: "run the checks".to_string(),
            thread_id: Some("thread-1".to_string()),
            cadence: ScheduleCadence::Daily { hour: 2, minute: 30 },
        };
        let record = new_record("schedule-1".to_string(), input, now()).unwrap();
        save(
            &home,
            &ScheduleFile {
                schedules: vec![record.clone()],
            },
        )
        .unwrap();
        assert_eq!(load(&home).unwrap().schedules, vec![record]);
        let _ = fs::remove_dir_all(home);
    }
}
