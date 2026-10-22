use std::fs;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Datelike, Duration, Local, LocalResult, NaiveDate, TimeZone, Utc};
use chrono_tz::Tz;
use serde::{Deserialize, Serialize};

const SCHEDULES_FILE: &str = "schedules.json";

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ScheduleCadence {
    Once {
        at: String,
    },
    Daily {
        hour: u8,
        minute: u8,
        #[serde(default)]
        time_zone: Option<String>,
    },
    Weekly {
        weekday: u8,
        hour: u8,
        minute: u8,
        #[serde(default)]
        time_zone: Option<String>,
    },
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleInput {
    pub name: String,
    pub prompt: String,
    pub thread_id: Option<String>,
    pub cadence: ScheduleCadence,
    #[serde(default = "enabled_by_default")]
    pub enabled: bool,
}

fn enabled_by_default() -> bool {
    true
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
    let content =
        fs::read_to_string(&path).map_err(|error| format!("failed to read schedules: {error}"))?;
    serde_json::from_str(&content).map_err(|error| format!("failed to decode schedules: {error}"))
}

pub fn save(home: &Path, schedules: &ScheduleFile) -> Result<(), String> {
    fs::create_dir_all(home).map_err(|error| format!("failed to create schedule home: {error}"))?;
    let path = file_path(home);
    let temporary = path.with_extension("json.tmp");
    let content = serde_json::to_string_pretty(schedules)
        .map_err(|error| format!("failed to encode schedules: {error}"))?;
    fs::write(&temporary, format!("{content}\n"))
        .map_err(|error| format!("failed to write schedules: {error}"))?;
    fs::rename(&temporary, &path).map_err(|error| format!("failed to replace schedules: {error}"))
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
        ScheduleCadence::Daily { hour, minute, .. }
        | ScheduleCadence::Weekly { hour, minute, .. } => {
            if *hour >= 24 || *minute >= 60 {
                return Err("schedule time is outside the 24-hour clock".to_string());
            }
            if let ScheduleCadence::Weekly { weekday, .. } = input.cadence {
                if weekday > 6 {
                    return Err("weekly schedule weekday must be 0-6".to_string());
                }
            }
            if let Some(time_zone) = recurring_time_zone(&input.cadence) {
                time_zone
                    .parse::<Tz>()
                    .map_err(|_| format!("unknown schedule timezone: {time_zone}"))?;
            }
            Ok(())
        }
    }
}

pub fn next_run_after(cadence: &ScheduleCadence, now: DateTime<Utc>) -> Option<DateTime<Utc>> {
    match cadence {
        ScheduleCadence::Once { at } => parse_timestamp(at).filter(|value| *value > now),
        ScheduleCadence::Daily { time_zone, .. } | ScheduleCadence::Weekly { time_zone, .. } => {
            match time_zone {
                Some(name) => next_recurring_in_zone(cadence, now, &name.parse::<Tz>().ok()?),
                None => next_recurring_in_zone(cadence, now, &Local),
            }
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
        enabled: input.enabled,
        last_run: None,
    })
}

pub fn updated_record(
    previous: &ScheduleRecord,
    input: ScheduleInput,
    now: DateTime<Utc>,
) -> Result<ScheduleRecord, String> {
    validate_input(&input, now)?;
    let next = next_run_after(&input.cadence, now)
        .ok_or_else(|| "schedule has no future run".to_string())?;
    Ok(ScheduleRecord {
        id: previous.id.clone(),
        name: input.name,
        prompt: input.prompt,
        thread_id: input.thread_id,
        cadence: input.cadence,
        next_run_at: next.to_rfc3339(),
        enabled: input.enabled,
        last_run: previous.last_run.clone(),
    })
}

pub fn apply_run_result(
    current: &ScheduleRecord,
    started_at: DateTime<Utc>,
    result: Result<Option<String>, String>,
) -> ScheduleRecord {
    let mut updated = current.clone();
    updated.last_run = Some(ScheduleRun {
        at: started_at.to_rfc3339(),
        success: result.is_ok(),
        message: result
            .as_ref()
            .map(|_| "dispatched".to_string())
            .unwrap_or_else(|error| error.clone()),
    });
    if updated.thread_id.is_none() {
        if let Ok(Some(thread_id)) = result {
            updated.thread_id = Some(thread_id);
        }
    }
    if let Some(next) = next_after_run(&updated.cadence, started_at) {
        updated.next_run_at = next.to_rfc3339();
    } else {
        updated.enabled = false;
    }
    updated
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

fn recurring_time_zone(cadence: &ScheduleCadence) -> Option<&str> {
    match cadence {
        ScheduleCadence::Daily { time_zone, .. } | ScheduleCadence::Weekly { time_zone, .. } => {
            time_zone.as_deref()
        }
        ScheduleCadence::Once { .. } => None,
    }
}

fn next_recurring_in_zone<Z>(
    cadence: &ScheduleCadence,
    now: DateTime<Utc>,
    time_zone: &Z,
) -> Option<DateTime<Utc>>
where
    Z: TimeZone,
{
    let local_now = now.with_timezone(time_zone);
    let (mut date, hour, minute) = match cadence {
        ScheduleCadence::Daily { hour, minute, .. } => (local_now.date_naive(), *hour, *minute),
        ScheduleCadence::Weekly {
            weekday,
            hour,
            minute,
            ..
        } => {
            let current = i64::from(local_now.weekday().num_days_from_sunday());
            let target = i64::from(*weekday);
            (
                local_now.date_naive() + Duration::days((target - current + 7) % 7),
                *hour,
                *minute,
            )
        }
        ScheduleCadence::Once { .. } => return None,
    };

    let step_days = if matches!(cadence, ScheduleCadence::Weekly { .. }) {
        7
    } else {
        1
    };
    let mut candidate = resolve_local_time(time_zone, date, hour, minute)?;
    if candidate <= now {
        date += Duration::days(step_days);
        candidate = resolve_local_time(time_zone, date, hour, minute)?;
    }
    Some(candidate)
}

fn resolve_local_time<Z>(
    time_zone: &Z,
    date: NaiveDate,
    hour: u8,
    minute: u8,
) -> Option<DateTime<Utc>>
where
    Z: TimeZone,
{
    let requested = date.and_hms_opt(u32::from(hour), u32::from(minute), 0)?;
    for offset in 0..=180 {
        let candidate = requested + Duration::minutes(offset);
        match time_zone.from_local_datetime(&candidate) {
            LocalResult::Single(value) => return Some(value.with_timezone(&Utc)),
            LocalResult::Ambiguous(first, second) => {
                return Some(std::cmp::min(
                    first.with_timezone(&Utc),
                    second.with_timezone(&Utc),
                ));
            }
            LocalResult::None => {}
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::{
        ScheduleCadence, ScheduleFile, ScheduleInput, ScheduleRun, apply_run_result, load,
        new_record, next_after_run, next_run_after, save, updated_record,
    };
    use chrono::{DateTime, Duration, Utc};
    use std::fs;
    use std::path::PathBuf;

    fn now() -> DateTime<Utc> {
        "2026-10-21T10:15:00Z".parse().unwrap()
    }

    #[test]
    fn calculates_daily_weekly_and_one_shot_runs() {
        let daily = ScheduleCadence::Daily {
            hour: 11,
            minute: 0,
            time_zone: Some("UTC".to_string()),
        };
        assert_eq!(
            next_run_after(&daily, now()).unwrap().to_rfc3339(),
            "2026-10-21T11:00:00+00:00"
        );
        let weekly = ScheduleCadence::Weekly {
            weekday: 3,
            hour: 9,
            minute: 0,
            time_zone: Some("UTC".to_string()),
        };
        assert_eq!(
            next_run_after(&weekly, now()).unwrap().to_rfc3339(),
            "2026-10-28T09:00:00+00:00"
        );
        let once = ScheduleCadence::Once {
            at: "2026-10-22T10:15:00Z".to_string(),
        };
        assert_eq!(next_after_run(&once, now()), None);
        assert_eq!(
            next_run_after(&once, now()).unwrap(),
            now() + Duration::days(1)
        );
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
            cadence: ScheduleCadence::Daily {
                hour: 2,
                minute: 30,
                time_zone: Some("UTC".to_string()),
            },
            enabled: true,
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

    #[test]
    fn calculates_recurring_runs_in_declared_timezone() {
        let cadence = ScheduleCadence::Daily {
            hour: 9,
            minute: 0,
            time_zone: Some("Asia/Tokyo".to_string()),
        };
        let now = "2026-10-21T23:30:00Z".parse().unwrap();

        assert_eq!(
            next_run_after(&cadence, now).unwrap().to_rfc3339(),
            "2026-10-22T00:00:00+00:00",
        );
    }

    #[test]
    fn handles_ambiguous_and_missing_daylight_saving_times() {
        let missing = ScheduleCadence::Daily {
            hour: 2,
            minute: 30,
            time_zone: Some("America/New_York".to_string()),
        };
        let before_spring_forward = "2026-03-08T06:00:00Z".parse().unwrap();
        assert_eq!(
            next_run_after(&missing, before_spring_forward)
                .unwrap()
                .to_rfc3339(),
            "2026-03-08T07:00:00+00:00",
        );

        let ambiguous = ScheduleCadence::Daily {
            hour: 1,
            minute: 30,
            time_zone: Some("America/New_York".to_string()),
        };
        let before_fall_back = "2026-11-01T04:00:00Z".parse().unwrap();
        assert_eq!(
            next_run_after(&ambiguous, before_fall_back)
                .unwrap()
                .to_rfc3339(),
            "2026-11-01T05:30:00+00:00",
        );
    }

    #[test]
    fn loads_legacy_recurring_records_without_timezone() {
        let input: ScheduleInput = serde_json::from_value(serde_json::json!({
            "name": "Legacy",
            "prompt": "run it",
            "threadId": null,
            "cadence": { "kind": "daily", "hour": 9, "minute": 15 }
        }))
        .unwrap();

        assert!(input.enabled);
        assert!(matches!(
            input.cadence,
            ScheduleCadence::Daily {
                hour: 9,
                minute: 15,
                time_zone: None,
            }
        ));
    }

    #[test]
    fn creates_and_updates_enabled_state_atomically() {
        let created = new_record(
            "schedule-1".to_string(),
            ScheduleInput {
                name: "Original".to_string(),
                prompt: "first prompt".to_string(),
                thread_id: None,
                cadence: ScheduleCadence::Daily {
                    hour: 9,
                    minute: 0,
                    time_zone: Some("UTC".to_string()),
                },
                enabled: false,
            },
            now(),
        )
        .unwrap();
        assert!(!created.enabled);

        let previous = super::ScheduleRecord {
            last_run: Some(ScheduleRun {
                at: "2026-10-20T10:15:00+00:00".to_string(),
                success: true,
                message: "dispatched".to_string(),
            }),
            ..created
        };
        let updated = updated_record(
            &previous,
            ScheduleInput {
                name: "Updated".to_string(),
                prompt: "second prompt".to_string(),
                thread_id: None,
                cadence: ScheduleCadence::Weekly {
                    weekday: 4,
                    hour: 10,
                    minute: 30,
                    time_zone: Some("Asia/Tokyo".to_string()),
                },
                enabled: true,
            },
            now(),
        )
        .unwrap();

        assert!(updated.enabled);
        assert_eq!(updated.name, "Updated");
        assert_eq!(updated.last_run, previous.last_run);
    }

    #[test]
    fn merges_run_results_without_reverting_configuration() {
        let current = new_record(
            "schedule-1".to_string(),
            ScheduleInput {
                name: "Edited while running".to_string(),
                prompt: "new prompt".to_string(),
                thread_id: None,
                cadence: ScheduleCadence::Daily {
                    hour: 12,
                    minute: 0,
                    time_zone: Some("UTC".to_string()),
                },
                enabled: true,
            },
            now(),
        )
        .unwrap();

        let merged = apply_run_result(&current, now(), Ok(Some("thread-created".to_string())));

        assert_eq!(merged.name, "Edited while running");
        assert_eq!(merged.prompt, "new prompt");
        assert_eq!(merged.thread_id.as_deref(), Some("thread-created"));
        assert_eq!(merged.last_run.as_ref().unwrap().at, now().to_rfc3339());
        assert!(merged.last_run.as_ref().unwrap().success);
        assert!(merged.enabled);
    }
}
