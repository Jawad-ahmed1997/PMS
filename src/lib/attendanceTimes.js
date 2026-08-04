import { SHIFT_DAY_START_HOUR } from "@/lib/dutyHours";

function formatDateInput(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

export function parseTimeString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return null;
  }
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const seconds = match[3] ? Number.parseInt(match[3], 10) : 0;
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    Number.isNaN(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }
  return { hours, minutes, seconds, milliseconds: 0 };
}

function extractTimeParts(value) {
  if (!value) {
    return null;
  }
  const parsedTime = parseTimeString(value);
  if (parsedTime) {
    return parsedTime;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return {
    hours: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds(),
    milliseconds: date.getMilliseconds(),
  };
}

export function getTimeZoneParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const lookup = parts.reduce((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});
  if (!lookup.year || !lookup.month || !lookup.day) {
    return null;
  }
  return lookup;
}

function formatDateParts(parts) {
  if (!parts?.year || !parts?.month || !parts?.day) {
    return null;
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function parseDateInput(value, timeZone = DEFAULT_TIME_ZONE) {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
      };
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const parts = getTimeZoneParts(date, timeZone);
  if (!parts) {
    return null;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

function getTimeZoneOffset(date, timeZone) {
  const parts = getTimeZoneParts(date, timeZone);
  if (!parts) {
    return 0;
  }
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - date.getTime();
}

export function combineDateAndTime(dateValue, timeValue, timeZone = DEFAULT_TIME_ZONE) {
  const dateString = formatDateInput(dateValue);
  const timeParts = extractTimeParts(timeValue);
  if (!dateString || !timeParts) {
    return null;
  }
  const timeString = `${timeParts.hours.toString().padStart(2, "0")}:${timeParts.minutes.toString().padStart(2, "0")}:${timeParts.seconds.toString().padStart(2, "0")}`;
  return zonedTimeToUtc({ date: dateString, time: timeString, timeZone });
}

export function combineShiftDateAndTime(dateValue, timeValue, timeZone = DEFAULT_TIME_ZONE) {
  const dateString = formatDateInput(dateValue);
  const timeParts = extractTimeParts(timeValue);
  if (!dateString || !timeParts) {
    return null;
  }
  let hours = timeParts.hours;
  let dayOffset = 0;
  if (hours < SHIFT_DAY_START_HOUR) {
    dayOffset = 1;
  }
  const timeString = `${hours.toString().padStart(2, "0")}:${timeParts.minutes.toString().padStart(2, "0")}:${timeParts.seconds.toString().padStart(2, "0")}`;
  const base = zonedTimeToUtc({ date: dateString, time: timeString, timeZone });
  if (base && dayOffset > 0) {
    base.setDate(base.getDate() + dayOffset);
  }
  return base;
}

export function normalizeAttendanceTimes({ shiftDate, inTime, outTime, timeZone = DEFAULT_TIME_ZONE }) {
  const inAt = inTime ? combineDateAndTime(shiftDate, inTime, timeZone) : null;
  let outAt = outTime ? combineDateAndTime(shiftDate, outTime, timeZone) : null;
  if (inAt && outAt && outAt <= inAt) {
    outAt = new Date(outAt);
    outAt.setDate(outAt.getDate() + 1);
  }
  return { inAt, outAt };
}

export function normalizeWfhInterval({ shiftDate, startTime, endTime, timeZone = DEFAULT_TIME_ZONE }) {
  const startAt = startTime ? combineDateAndTime(shiftDate, startTime, timeZone) : null;
  let endAt = endTime ? combineDateAndTime(shiftDate, endTime, timeZone) : null;
  if (startAt && endAt && endAt <= startAt) {
    endAt = new Date(endAt);
    endAt.setDate(endAt.getDate() + 1);
  }
  return { startAt, endAt };
}

export const DEFAULT_TIME_ZONE = "Asia/Karachi";

export function formatDateInTimeZone(value, timeZone = DEFAULT_TIME_ZONE) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  try {
    const formatter = new Intl.DateTimeFormat("fr-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(date);
  } catch (e) {
    console.error("formatDateInTimeZone error:", e);
    return formatDateParts(getTimeZoneParts(date, timeZone));
  }
}

export function formatTimeInTimeZone(value, timeZone = DEFAULT_TIME_ZONE) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const formatted = formatter.format(date);
    const match = formatted.match(/(\d{2}):(\d{2})/);
    if (match) {
      let hour = match[1];
      if (hour === "24") hour = "00";
      return `${hour}:${match[2]}`;
    }
  } catch (e) {
    console.error("formatTimeInTimeZone error:", e);
  }
  const parts = getTimeZoneParts(date, timeZone);
  if (!parts) {
    return null;
  }
  return `${parts.hour}:${parts.minute}`;
}

export function formatDateTimeInTimeZone(value, timeZone = DEFAULT_TIME_ZONE) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  try {
    const dStr = formatDateInTimeZone(date, timeZone);
    const tStr = formatTimeInTimeZone(date, timeZone);
    if (dStr && tStr) {
      const seconds = String(date.getSeconds()).padStart(2, "0");
      return `${dStr} ${tStr}:${seconds}`;
    }
  } catch (e) {
    console.error("formatDateTimeInTimeZone error:", e);
  }
  const parts = getTimeZoneParts(date, timeZone);
  if (!parts) {
    return null;
  }
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function zonedTimeToUtc({ date, time, timeZone = DEFAULT_TIME_ZONE }) {
  const dateParts = parseDateInput(date, timeZone);
  const timeParts = parseTimeString(time);
  if (!dateParts || !timeParts) {
    return null;
  }
  const utcDate = new Date(
    Date.UTC(
      dateParts.year,
      dateParts.month - 1,
      dateParts.day,
      timeParts.hours,
      timeParts.minutes,
      timeParts.seconds,
      timeParts.milliseconds
    )
  );
  const offset = getTimeZoneOffset(utcDate, timeZone);
  return new Date(utcDate.getTime() - offset);
}

export function getTimeZoneNow(timeZone = DEFAULT_TIME_ZONE) {
  const now = new Date();
  const parts = getTimeZoneParts(now, timeZone);
  if (!parts) {
    return now;
  }
  return new Date(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
  );
}
