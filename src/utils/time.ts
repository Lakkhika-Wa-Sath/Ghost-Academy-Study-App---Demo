import { DayPlan, HourRow } from '../types/planner';

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function addDays(dateStr: string, delta: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + delta);
  return toLocalDateString(d);
}

export function diffDays(fromStr: string, toStr: string): number {
  const a = parseLocalDate(fromStr);
  const b = parseLocalDate(toStr);
  const msPerDay = 86_400_000;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

export function formatReadableDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatShortDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatMinutes(totalMinutes: number): string {
  const rounded = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h 00m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function formatDecimalHours(totalMinutes: number): string {
  return `${(totalMinutes / 60).toFixed(1)}h`;
}

export function formatClockMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export interface DayTotals {
  selfStudyMinutes: number;
  classMinutes: number;
  usingMinutes: number;
  wastingMinutes: number;
  sleepMinutes: number;
  onlineMinutes: number;
  bySubject: Record<string, number>;
}

export function computeHourUsingMinutes(row: HourRow): number {
  const activeBlocks = row.blocks.filter(Boolean).length;
  const selfMin = activeBlocks * 15;
  return Math.min(60, selfMin + row.classMinutes);
}

export function computeDayTotals(plan?: DayPlan): DayTotals {
  if (!plan) {
    return {
      selfStudyMinutes: 0,
      classMinutes: 0,
      usingMinutes: 0,
      wastingMinutes: 0,
      sleepMinutes: 0,
      onlineMinutes: 0,
      bySubject: {},
    };
  }

  let selfStudyMinutes = 0;
  let classMinutes = 0;
  let usingMinutes = 0;
  let wastingMinutes = 0;
  let sleepMinutes = 0;
  let onlineMinutes = 0;
  const bySubject: Record<string, number> = {};

  for (const row of plan.hours) {
    let rowSelf = 0;
    for (const block of row.blocks) {
      if (block) {
        rowSelf += 15;
        bySubject[block] = (bySubject[block] || 0) + 15;
      }
    }
    selfStudyMinutes += rowSelf;
    classMinutes += row.classMinutes;
    usingMinutes += Math.min(60, rowSelf + row.classMinutes);
    wastingMinutes += row.wastingMinutes;
    sleepMinutes += row.sleepMinutes;
    onlineMinutes += row.onlineMinutes;
  }

  return {
    selfStudyMinutes,
    classMinutes,
    usingMinutes,
    wastingMinutes,
    sleepMinutes,
    onlineMinutes,
    bySubject,
  };
}

/** Returns Monday..Sunday date strings for the week containing dateStr */
export function getWeekDates(dateStr: string): string[] {
  const d = parseLocalDate(dateStr);
  const dayOfWeek = d.getDay(); // 0=Sun .. 6=Sat
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  return Array.from({ length: 7 }, (_, i) => {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    return toLocalDateString(cur);
  });
}

export function computeWeekUsingMinutes(
  days: Record<string, DayPlan>,
  selectedDate: string,
): number {
  const weekDates = getWeekDates(selectedDate);
  let total = 0;
  for (const dt of weekDates) {
    if (dt <= selectedDate) {
      total += computeDayTotals(days[dt]).usingMinutes;
    }
  }
  return total;
}

export function computePlanNumbers(
  selectedDate: string,
  planStartDate: string,
  examDate: string,
): {
  weekNo: number;
  dayPlanNo: number;
  daysLeftForAL: number;
} {
  const dayDiff = diffDays(planStartDate, selectedDate);
  const dayPlanNo = dayDiff >= 0 ? dayDiff + 1 : 1;
  const weekNo = Math.ceil(dayPlanNo / 7);
  const daysLeftForAL = Math.max(0, diffDays(selectedDate, examDate));
  return { weekNo, dayPlanNo, daysLeftForAL };
}
