use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Datelike, Duration, Local, LocalResult, NaiveDate, TimeZone, Utc};
use chrono_tz::Tz;
use serde::{Deserialize, Deserializer, Serialize};
use tokio::sync::Mutex;

mod app_server;
pub use app_server::{
    AppServerDispatcher, ScheduleDispatcher, build_thread_request, build_turn_request,
};

#[derive(Default)]
pub struct SchedulerState {
    in_flight: Mutex<HashSet<String>>,
}

const SCHEDULES_FILE: &str = "schedules.json";
const CURRENT_SCHEMA_VERSION: u8 = 1;

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ScheduleCadence {
    Once {
        at: String,
    },
    Daily {
        hour: u8,
        minute: u8,
        #[serde(default)]
        #[serde(rename = "timeZone")]
        time_zone: Option<String>,
    },
    Weekly {
        weekdays: Vec<u8>,
        hour: u8,
        minute: u8,
        #[serde(default)]
        #[serde(rename = "timeZone")]
        time_zone: Option<String>,
    },
}

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum RawScheduleCadence {
    Once {
        at: String,
    },
    Daily {
        hour: u8,
        minute: u8,
        #[serde(default)]
        #[serde(rename = "timeZone")]
        time_zone: Option<String>,
    },
    Weekly {
        #[serde(default)]
        weekdays: Option<Vec<u8>>,
        #[serde(default)]
        weekday: Option<u8>,
        hour: u8,
        minute: u8,
        #[serde(default)]
        #[serde(rename = "timeZone")]
        time_zone: Option<String>,
    },
}

impl<'de> Deserialize<'de> for ScheduleCadence {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        match RawScheduleCadence::deserialize(deserializer)? {
            RawScheduleCadence::Once { at } => Ok(Self::Once { at }),
            RawScheduleCadence::Daily {
                hour,
                minute,
                time_zone,
            } => Ok(Self::Daily {
                hour,
                minute,
                time_zone,
            }),
            RawScheduleCadence::Weekly {
                weekdays,
                weekday,
                hour,
                minute,
                time_zone,
            } => Ok(Self::Weekly {
                weekdays: weekdays
                    .or_else(|| weekday.map(|day| vec![day]))
                    .unwrap_or_default(),
                hour,
                minute,
                time_zone,
            }),
        }
    }
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

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleFile {
    #[serde(default)]
    pub schema_version: u8,
    pub schedules: Vec<ScheduleRecord>,
}

impl Default for ScheduleFile {
    fn default() -> Self {
        Self {
            schema_version: CURRENT_SCHEMA_VERSION,
            schedules: Vec::new(),
        }
    }
}

pub fn file_path(home: &Path) -> PathBuf {
    home.join(SCHEDULES_FILE)
}

impl SchedulerState {
    pub async fn list(&self, home: &Path) -> Result<Vec<ScheduleRecord>, String> {
        let _guard = self.in_flight.lock().await;
        Ok(load(home)?.schedules)
    }

    pub async fn create(
        &self,
        home: &Path,
        input: ScheduleInput,
    ) -> Result<ScheduleRecord, String> {
        let _guard = self.in_flight.lock().await;
        let mut file = load(home)?;
        let id = format!(
            "schedule-{}-{}",
            Utc::now().timestamp_millis(),
            std::process::id()
        );
        let record = new_record(id, input, Utc::now())?;
        file.schedules.push(record.clone());
        save(home, &file)?;
        Ok(record)
    }

    pub async fn update(
        &self,
        home: &Path,
        id: &str,
        input: ScheduleInput,
    ) -> Result<ScheduleRecord, String> {
        let _guard = self.in_flight.lock().await;
        let mut file = load(home)?;
        let index = file
            .schedules
            .iter()
            .position(|schedule| schedule.id == id)
            .ok_or_else(|| "schedule not found".to_string())?;
        let record = updated_record(&file.schedules[index], input, Utc::now())?;
        file.schedules[index] = record.clone();
        save(home, &file)?;
        Ok(record)
    }

    pub async fn set_enabled(
        &self,
        home: &Path,
        id: &str,
        enabled: bool,
    ) -> Result<ScheduleRecord, String> {
        let _guard = self.in_flight.lock().await;
        let mut file = load(home)?;
        let index = file
            .schedules
            .iter()
            .position(|schedule| schedule.id == id)
            .ok_or_else(|| "schedule not found".to_string())?;
        file.schedules[index].enabled = enabled;
        let record = file.schedules[index].clone();
        save(home, &file)?;
        Ok(record)
    }

    pub async fn delete(&self, home: &Path, id: &str) -> Result<(), String> {
        let _guard = self.in_flight.lock().await;
        let mut file = load(home)?;
        let before = file.schedules.len();
        file.schedules.retain(|schedule| schedule.id != id);
        if file.schedules.len() == before {
            return Err("schedule not found".to_string());
        }
        save(home, &file)
    }

    pub async fn run_now<D: ScheduleDispatcher>(
        &self,
        home: &Path,
        id: &str,
        dispatcher: Option<&D>,
    ) -> Result<ScheduleRecord, String> {
        match self
            .run_schedule_with(home, id, RunMode::Manual, dispatcher)
            .await?
        {
            RunScheduleOutcome::Completed(record) => Ok(*record),
            RunScheduleOutcome::Missing => {
                Err("schedule not found or was deleted during dispatch".to_string())
            }
            RunScheduleOutcome::Skipped => Err("schedule is already running".to_string()),
        }
    }

    pub async fn run_due<D: ScheduleDispatcher>(
        &self,
        home: &Path,
        dispatcher: Option<&D>,
    ) -> Result<(), String> {
        let now = Utc::now();
        let due_ids = {
            let _guard = self.in_flight.lock().await;
            load(home)?
                .schedules
                .into_iter()
                .filter(|schedule| is_due(schedule, now))
                .map(|schedule| schedule.id)
                .collect::<Vec<_>>()
        };

        for id in due_ids {
            self.run_schedule_with(home, &id, RunMode::Due(now), dispatcher)
                .await?;
        }
        Ok(())
    }

    async fn run_schedule_with<D: ScheduleDispatcher>(
        &self,
        home: &Path,
        id: &str,
        mode: RunMode,
        dispatcher: Option<&D>,
    ) -> Result<RunScheduleOutcome, String> {
        let snapshot = {
            let mut guard = self.in_flight.lock().await;
            let Some(snapshot) = load(home)?
                .schedules
                .into_iter()
                .find(|schedule| schedule.id == id)
            else {
                return Ok(RunScheduleOutcome::Missing);
            };
            if let RunMode::Due(now) = mode
                && !is_due(&snapshot, now)
            {
                return Ok(RunScheduleOutcome::Skipped);
            }
            if !guard.insert(id.to_string()) {
                return Ok(RunScheduleOutcome::Skipped);
            }
            snapshot
        };
        let started_at = Utc::now();
        let result = match dispatcher {
            Some(dispatcher) => dispatcher.dispatch(snapshot).await,
            None => Err("app server unavailable".to_string()),
        };

        let mut guard = self.in_flight.lock().await;
        let finalization = (|| {
            let mut file = load(home)?;
            let Some(index) = file.schedules.iter().position(|schedule| schedule.id == id) else {
                return Ok(RunScheduleOutcome::Missing);
            };
            let record = apply_run_result(&file.schedules[index], started_at, result);
            file.schedules[index] = record.clone();
            save(home, &file)?;
            Ok(RunScheduleOutcome::Completed(Box::new(record)))
        })();
        guard.remove(id);
        finalization
    }
}

enum RunMode {
    Manual,
    Due(DateTime<Utc>),
}

enum RunScheduleOutcome {
    Completed(Box<ScheduleRecord>),
    Missing,
    Skipped,
}

fn is_due(schedule: &ScheduleRecord, now: DateTime<Utc>) -> bool {
    schedule.enabled
        && DateTime::parse_from_rfc3339(&schedule.next_run_at)
            .map(|next| next.with_timezone(&Utc) <= now)
            .unwrap_or(false)
}

pub fn load(home: &Path) -> Result<ScheduleFile, String> {
    load_at(home, Utc::now())
}

fn load_at(home: &Path, now: DateTime<Utc>) -> Result<ScheduleFile, String> {
    let path = file_path(home);
    if !path.exists() {
        return Ok(ScheduleFile::default());
    }
    let content =
        fs::read_to_string(&path).map_err(|error| format!("failed to read schedules: {error}"))?;
    let mut file: ScheduleFile = serde_json::from_str(&content)
        .map_err(|error| format!("failed to decode schedules: {error}"))?;
    if file.schema_version < CURRENT_SCHEMA_VERSION {
        for schedule in &mut file.schedules {
            if matches!(
                schedule.cadence,
                ScheduleCadence::Daily {
                    time_zone: None,
                    ..
                } | ScheduleCadence::Weekly {
                    time_zone: None,
                    ..
                }
            ) && !parse_timestamp(&schedule.next_run_at).is_some_and(|next| next <= now)
            {
                schedule.next_run_at = next_run_after(&schedule.cadence, now)
                    .ok_or_else(|| {
                        format!("failed to migrate next run for schedule {}", schedule.id)
                    })?
                    .to_rfc3339();
            }
        }
        file.schema_version = CURRENT_SCHEMA_VERSION;
        save(home, &file)?;
    }
    Ok(file)
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
        ScheduleCadence::Daily { hour, minute, .. } => {
            validate_time(*hour, *minute)?;
            validate_time_zone(&input.cadence)
        }
        ScheduleCadence::Weekly {
            weekdays,
            hour,
            minute,
            ..
        } => {
            if weekdays.is_empty() || weekdays.iter().any(|weekday| *weekday > 6) {
                return Err("weekly schedule weekdays must contain values from 0-6".to_string());
            }
            validate_time(*hour, *minute)?;
            validate_time_zone(&input.cadence)
        }
    }
}

fn validate_time(hour: u8, minute: u8) -> Result<(), String> {
    if hour >= 24 || minute >= 60 {
        return Err("schedule time is outside the 24-hour clock".to_string());
    }
    Ok(())
}

fn validate_time_zone(cadence: &ScheduleCadence) -> Result<(), String> {
    if let Some(time_zone) = recurring_time_zone(cadence) {
        time_zone
            .parse::<Tz>()
            .map_err(|_| format!("unknown schedule timezone: {time_zone}"))?;
    }
    Ok(())
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
    mut input: ScheduleInput,
    now: DateTime<Utc>,
) -> Result<ScheduleRecord, String> {
    normalize_input(&mut input);
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
    mut input: ScheduleInput,
    now: DateTime<Utc>,
) -> Result<ScheduleRecord, String> {
    normalize_input(&mut input);
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

fn normalize_input(input: &mut ScheduleInput) {
    if let ScheduleCadence::Weekly { weekdays, .. } = &mut input.cadence {
        weekdays.sort_unstable();
        weekdays.dedup();
    }
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
    let (hour, minute) = match cadence {
        ScheduleCadence::Daily { hour, minute, .. }
        | ScheduleCadence::Weekly { hour, minute, .. } => (*hour, *minute),
        ScheduleCadence::Once { .. } => return None,
    };
    let mut date = local_now.date_naive();
    for _ in 0..=7 {
        let selected = match cadence {
            ScheduleCadence::Daily { .. } => true,
            ScheduleCadence::Weekly { weekdays, .. } => {
                weekdays.contains(&date.weekday().num_days_from_sunday().try_into().ok()?)
            }
            ScheduleCadence::Once { .. } => false,
        };
        if selected {
            let candidate = resolve_local_time(time_zone, date, hour, minute)?;
            if candidate > now {
                return Some(candidate);
            }
        }
        date += Duration::days(1);
    }
    None
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
        ScheduleCadence, ScheduleFile, ScheduleInput, apply_run_result, load, new_record,
        next_run_after, save,
    };
    use chrono::{DateTime, Utc};
    use std::fs;
    use std::path::PathBuf;

    fn now() -> DateTime<Utc> {
        "2026-10-19T16:00:00Z".parse().unwrap()
    }

    fn input(cadence: ScheduleCadence) -> ScheduleInput {
        ScheduleInput {
            name: "Checks".to_string(),
            prompt: "run checks".to_string(),
            thread_id: None,
            cadence,
            enabled: true,
        }
    }

    #[test]
    fn normalizes_weekdays_and_rejects_empty_or_out_of_range_sets() {
        let record = new_record(
            "schedule-1".to_string(),
            input(ScheduleCadence::Weekly {
                weekdays: vec![4, 2, 4],
                hour: 15,
                minute: 0,
                time_zone: Some("UTC".to_string()),
            }),
            now(),
        )
        .unwrap();

        assert_eq!(
            record.cadence,
            ScheduleCadence::Weekly {
                weekdays: vec![2, 4],
                hour: 15,
                minute: 0,
                time_zone: Some("UTC".to_string()),
            }
        );

        for weekdays in [vec![], vec![7]] {
            assert!(
                new_record(
                    "schedule-invalid".to_string(),
                    input(ScheduleCadence::Weekly {
                        weekdays,
                        hour: 15,
                        minute: 0,
                        time_zone: Some("UTC".to_string()),
                    }),
                    now(),
                )
                .is_err()
            );
        }
    }

    #[test]
    fn deserializes_legacy_scalar_weekday() {
        let file: ScheduleFile = serde_json::from_value(serde_json::json!({
            "schemaVersion": 1,
            "schedules": [{
                "id": "legacy",
                "name": "Legacy",
                "prompt": "run it",
                "threadId": null,
                "cadence": {
                    "kind": "weekly",
                    "weekday": 4,
                    "hour": 15,
                    "minute": 0,
                    "timeZone": "UTC"
                },
                "nextRunAt": "2026-10-22T15:00:00Z",
                "enabled": true,
                "lastRun": null
            }]
        }))
        .unwrap();

        assert_eq!(
            file.schedules[0].cadence,
            ScheduleCadence::Weekly {
                weekdays: vec![4],
                hour: 15,
                minute: 0,
                time_zone: Some("UTC".to_string()),
            }
        );
    }

    #[test]
    fn selects_earliest_selected_weekday() {
        let cadence = ScheduleCadence::Weekly {
            weekdays: vec![2, 4],
            hour: 15,
            minute: 0,
            time_zone: Some("UTC".to_string()),
        };

        assert_eq!(
            next_run_after(&cadence, now()).unwrap().to_rfc3339(),
            "2026-10-20T15:00:00+00:00"
        );
    }

    #[test]
    fn persists_schedule_file_round_trip() {
        let home = temp_home("round-trip");
        let record = new_record(
            "schedule-1".to_string(),
            input(ScheduleCadence::Daily {
                hour: 9,
                minute: 0,
                time_zone: Some("UTC".to_string()),
            }),
            now(),
        )
        .unwrap();
        save(
            &home,
            &ScheduleFile {
                schedules: vec![record.clone()],
                ..ScheduleFile::default()
            },
        )
        .unwrap();

        assert_eq!(load(&home).unwrap().schedules, vec![record]);
        let _ = fs::remove_dir_all(home);
    }

    #[test]
    fn updates_run_result_and_disables_one_shot() {
        let once = new_record(
            "schedule-once".to_string(),
            input(ScheduleCadence::Once {
                at: "2026-10-20T15:00:00Z".to_string(),
            }),
            now(),
        )
        .unwrap();
        let updated = apply_run_result(&once, now(), Ok(Some("thread-1".to_string())));

        assert!(!updated.enabled);
        assert_eq!(updated.thread_id.as_deref(), Some("thread-1"));
        assert!(updated.last_run.unwrap().success);
    }

    fn temp_home(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!("ruxex-scheduler-{label}-{}", std::process::id()))
    }
}
