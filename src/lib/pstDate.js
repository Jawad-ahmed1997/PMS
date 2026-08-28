import {
  APP_DATE_TIME_ZONE,
  getTodayKey,
  shiftDateKey,
  toDateKey,
} from "@/lib/dateKeys";
import { getDutyDate } from "@/lib/dutyHours";

export const PST_TIME_ZONE = APP_DATE_TIME_ZONE;

export function getTodayInPSTDateString(baseDate = new Date()) {
  return getDutyDate(baseDate, PST_TIME_ZONE) ?? getTodayKey(PST_TIME_ZONE, baseDate) ?? "";
}

export function formatDateInPSTDateString(value) {
  return toDateKey(value, PST_TIME_ZONE) ?? "";
}

export function shiftDateStringByDays(dateString, days) {
  return shiftDateKey(dateString, days) ?? "";
}
