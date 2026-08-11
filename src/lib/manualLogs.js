import { isDateKeyInRange, shiftDateKey } from "@/lib/dateKeys";
import {
  formatTimeInTZ,
  makeZonedDateTime,
  MANUAL_LOG_TIME_ZONE,
  normalizeTimeString,
  toDateKeyInTZ,
} from "@/lib/manualLogDateTime";

export const MANUAL_LOG_CATEGORIES = ["LEARNING", "RESEARCH", "OTHER"];

export function normalizeManualCategories(value) {
  if (!Array.isArray(value)) {
    return null;
  }
  const normalized = value
    .map((entry) => entry?.toString?.().trim().toUpperCase())
    .filter(Boolean);
  const unique = Array.from(new Set(normalized));
  if (unique.length === 0) {
    return null;
  }
  const allValid = unique.every((category) =>
    MANUAL_LOG_CATEGORIES.includes(category)
  );
  if (!allValid) {
    return null;
  }
  return unique;
}

function normalizeManualDate(value, timeZone = MANUAL_LOG_TIME_ZONE) {
  return toDateKeyInTZ(value, timeZone);
}

export function getManualTodayDateKey(baseDate = new Date(), timeZone = MANUAL_LOG_TIME_ZONE) {
  return toDateKeyInTZ(baseDate, timeZone);
}

export function getManualLogDateBounds(
  baseDate = new Date(),
  timeZone = MANUAL_LOG_TIME_ZONE
) {
  const max = toDateKeyInTZ(baseDate, timeZone);
  if (!max) {
    return { min: null, max: null };
  }
  const min = shiftDateKey(max, -2);
  return { min, max };
}

export function isManualLogDateAllowed(
  date,
  baseDate = new Date(),
  timeZone = MANUAL_LOG_TIME_ZONE
) {
  const normalized = normalizeManualDate(date, timeZone);
  if (!normalized) {
    return false;
  }
  const { min, max } = getManualLogDateBounds(baseDate, timeZone);
  return isDateKeyInRange(normalized, min, max);
}

export function isManualLogInFuture(
  { date, startTime, endTime },
  baseDate = new Date(),
  timeZone = MANUAL_LOG_TIME_ZONE
) {
  const normalized = normalizeManualDate(date, timeZone);
  if (!normalized) {
    return false;
  }
  const today = toDateKeyInTZ(baseDate, timeZone);
  if (!today) {
    return false;
  }
  if (normalized > today) {
    return true;
  }
  if (normalized < today) {
    return false;
  }
  const now = baseDate instanceof Date ? baseDate : new Date(baseDate);

  const normalizedStartTime = normalizeTimeString(startTime);
  const startHour = normalizedStartTime ? Number(normalizedStartTime.split(":")[0]) : null;
  const startAtDateKey = (startHour !== null && startHour < 11) ? shiftDateKey(normalized, 1) : normalized;

  const startAt = normalizedStartTime
    ? makeZonedDateTime({ dateKey: startAtDateKey, timeStr: normalizedStartTime, tz: timeZone })
    : null;

  const normalizedEndTime = normalizeTimeString(endTime);
  const endHour = normalizedEndTime ? Number(normalizedEndTime.split(":")[0]) : null;
  const endAtDateKey = (endHour !== null && endHour < 11) ? shiftDateKey(normalized, 1) : normalized;

  const endAt = normalizedEndTime
    ? makeZonedDateTime({ dateKey: endAtDateKey, timeStr: normalizedEndTime, tz: timeZone })
    : null;

  if (startAt && endAt && endAt <= startAt) {
    endAt.setDate(endAt.getDate() + 1);
  }

  if (startAt && startAt.getTime() > now.getTime()) {
    return true;
  }
  if (endAt && endAt.getTime() > now.getTime()) {
    return true;
  }
  return false;
}

export function buildManualLogDate(dateValue, timeZone = MANUAL_LOG_TIME_ZONE) {
  const normalized = normalizeManualDate(dateValue, timeZone);
  if (!normalized) {
    return null;
  }
  return makeZonedDateTime({ dateKey: normalized, timeStr: "00:00", tz: timeZone });
}

export function buildManualLogTimes({ date, startTime, endTime, timeZone = MANUAL_LOG_TIME_ZONE }) {
  const normalized = normalizeManualDate(date, timeZone);
  if (!normalized) {
    return { error: "Date must be valid." };
  }
  const normalizedStartTime = normalizeTimeString(startTime);
  if (!normalizedStartTime) {
    return { error: "Start time is required." };
  }

  // If start hour is after midnight (less than 11 AM), shift the base dateKey by +1 day
  const startHour = Number(normalizedStartTime.split(":")[0]);
  const startAtDateKey = startHour < 11 ? shiftDateKey(normalized, 1) : normalized;

  const startAt = makeZonedDateTime({
    dateKey: startAtDateKey,
    timeStr: normalizedStartTime,
    tz: timeZone,
  });
  if (!startAt) {
    return { error: "Start time is required." };
  }
  if (!endTime) {
    return {
      startAt,
      endAt: null,
      durationSeconds: 0,
      normalizedStartTime,
      normalizedEndTime: null,
    };
  }
  const normalizedEndTime = normalizeTimeString(endTime);

  // If end hour is after midnight (less than 11 AM), shift the base dateKey by +1 day
  const endHour = Number(normalizedEndTime.split(":")[0]);
  const endAtDateKey = endHour < 11 ? shiftDateKey(normalized, 1) : normalized;

  const endAt = makeZonedDateTime({
    dateKey: endAtDateKey,
    timeStr: normalizedEndTime,
    tz: timeZone,
  });
  if (!endAt) {
    return { error: "End time must be valid." };
  }
  if (endAt <= startAt) {
    endAt.setDate(endAt.getDate() + 1);
  }
  if (endAt <= startAt) {
    return { error: "End time must be after start time." };
  }
  const durationSeconds = Math.max(
    0,
    Math.floor((endAt.getTime() - startAt.getTime()) / 1000)
  );
  return { startAt, endAt, durationSeconds, normalizedStartTime, normalizedEndTime };
}

export function formatManualLogTime(value, timeZone = MANUAL_LOG_TIME_ZONE) {
  return formatTimeInTZ(value, timeZone);
}
