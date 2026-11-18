import { useMemo } from 'react';
import { DayPlan, Deadline, ExamSettings, SubjectConfig } from '../types/planner';
import {
  addDays,
  computeDayTotals,
  diffDays,
  formatDecimalHours,
  formatMinutes,
  formatShortDate,
  toLocalDateString,
} from '../utils/time';

interface AnalyticsViewProps {
  days: Record<string, DayPlan>;
  deadlines: Deadline[];
  subjects: SubjectConfig[];
  examSettings: ExamSettings;
}

export function AnalyticsView({
  days,
  deadlines,
  subjects,
  examSettings,
}: AnalyticsViewProps) {
  const today = toLocalDateString(new Date());

  const last14Days = useMemo(() => {
    return Array.from({ length: 14 }, (_, idx) => {
      const dateStr = addDays(today, idx - 13);
      const totals = computeDayTotals(days[dateStr]);
      return {
        dateStr,
        label: formatShortDate(dateStr),
        usingMinutes: totals.usingMinutes,
        wastingMinutes: totals.wastingMinutes,
        sleepMinutes: totals.sleepMinutes,
        onlineMinutes: totals.onlineMinutes,
        bySubject: totals.bySubject,
      };
    });
  }, [days, today]);

  const summary = useMemo(() => {
    let totalUsing14 = 0;
    let totalWaste14 = 0;
    let activeDays = 0;
    let targetHits = 0;
    const subjectTotals: Record<string, number> = {};

    for (const d of last14Days) {
      totalUsing14 += d.usingMinutes;
      totalWaste14 += d.wastingMinutes;
      if (d.usingMinutes > 0) activeDays++;
      if (d.usingMinutes >= examSettings.dailyTargetMinutes) targetHits++;
      for (const [subjId, mins] of Object.entries(d.bySubject)) {
        subjectTotals[subjId] = (subjectTotals[subjId] || 0) + mins;
      }
    }

    const avgDaily = activeDays > 0 ? Math.round(totalUsing14 / activeDays) : 0;
    const efficiency =
      totalUsing14 + totalWaste14 > 0
        ? Math.round((totalUsing14 / (totalUsing14 + totalWaste14)) * 100)
        : 100;

    return {
      totalUsing14,
      totalWaste14,
      avgDaily,
      targetHits,
      efficiency,
      subjectTotals,
    };
  }, [last14Days, examSettings.dailyTargetMinutes]);

  const totalJourneyDays = Math.max(1, diffDays(examSettings.planStartDate, examSettings.examDate));
  const elapsedJourneyDays = Math.max(
    0,
    Math.min(totalJourneyDays, diffDays(examSettings.planStartDate, today)),
  );
  const daysLeft = Math.max(0, diffDays(today, examSettings.examDate));
  const journeyPct = Math.round((elapsedJourneyDays / totalJourneyDays) * 100);

  const maxChartMinutes = Math.max(
    examSettings.dailyTargetMinutes + 60,
    ...last14Days.map((d) => Math.max(d.usingMinutes, d.wastingMinutes)),
    360,
  );

  const totalSubjectMinutes = Object.values(summary.subjectTotals).reduce((a, b) => a + b, 0);
  const completedDeadlines = deadlines.filter((d) => d.completed).length;

  return (
    <div className="space-y-6">
      {/* Top KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="theme-card p-5">
          <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            14-Day Total Using Time
          </div>
          <div
            className="font-mono-tabular text-2xl font-bold mt-1.5"
            style={{ color: 'var(--color-using)' }}
          >
            {formatMinutes(summary.totalUsing14)}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Avg {formatMinutes(summary.avgDaily)} per active day
          </div>
        </div>

        <div className="theme-card p-5">
          <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Focus Efficiency Ratio
          </div>
          <div className="font-mono-tabular text-2xl font-bold mt-1.5">{summary.efficiency}%</div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Wasted: {formatMinutes(summary.totalWaste14)} over 14d
          </div>
        </div>

        <div className="theme-card p-5">
          <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Daily Target Hits (14d)
          </div>
          <div className="font-mono-tabular text-2xl font-bold mt-1.5">
            {summary.targetHits} / 14 days
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Goal: {formatMinutes(examSettings.dailyTargetMinutes)} / day
          </div>
        </div>

        <div className="theme-card p-5">
          <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Deadlines Completed
          </div>
          <div className="font-mono-tabular text-2xl font-bold mt-1.5">
            {completedDeadlines} / {deadlines.length}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            {daysLeft} days left to A/L exam
          </div>
        </div>
      </div>

      {/* 9-Month Journey Bar */}
      <div className="theme-card p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold">9-Month A/L Preparation Horizon</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {examSettings.planStartDate} to {examSettings.examDate}
            </p>
          </div>
          <div className="font-mono-tabular text-sm font-bold" style={{ color: 'var(--accent)' }}>
            Day {elapsedJourneyDays + 1} of {totalJourneyDays} ({journeyPct}%)
          </div>
        </div>
        <div
          className="h-3 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: 'var(--bg-subtle)' }}
        >
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${journeyPct}%`,
              backgroundColor: 'var(--accent)',
            }}
          />
        </div>
      </div>

      {/* 14-Day Using vs Wasting Bar Chart + Subject Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 theme-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-semibold">
                Last 14 Days: Using vs Wasting Time
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                Dashed line marks your daily {formatDecimalHours(examSettings.dailyTargetMinutes)} target
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-xs"
                  style={{ backgroundColor: 'var(--color-using)' }}
                />
                <span>Using Time</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-xs"
                  style={{ backgroundColor: 'var(--color-wasting)' }}
                />
                <span>Wasting Time</span>
              </span>
            </div>
          </div>

          {/* Responsive SVG Chart */}
          <div className="relative pt-4">
            <div className="h-60 flex items-end gap-1.5 sm:gap-2.5 relative border-b pb-1" style={{ borderColor: 'var(--border-subtle)' }}>
              {/* Target Line */}
              <div
                className="absolute left-0 right-0 border-t border-dashed pointer-events-none"
                style={{
                  bottom: `${Math.min(100, (examSettings.dailyTargetMinutes / maxChartMinutes) * 100)}%`,
                  borderColor: 'var(--accent)',
                }}
              />

              {last14Days.map((day) => {
                const usingPct = (day.usingMinutes / maxChartMinutes) * 100;
                const wastePct = (day.wastingMinutes / maxChartMinutes) * 100;
                return (
                  <div
                    key={day.dateStr}
                    className="flex-1 h-full flex flex-col justify-end items-center group relative"
                    title={`${day.dateStr}: Using ${formatMinutes(day.usingMinutes)} · Wasting ${formatMinutes(day.wastingMinutes)}`}
                  >
                    <div className="w-full h-full flex items-end justify-center gap-0.5 px-0.5">
                      <div
                        className="w-1/2 max-w-[16px] rounded-t-xs transition-all"
                        style={{
                          height: `${Math.max(day.usingMinutes > 0 ? 3 : 0, usingPct)}%`,
                          backgroundColor: 'var(--color-using)',
                        }}
                      />
                      <div
                        className="w-1/2 max-w-[16px] rounded-t-xs transition-all"
                        style={{
                          height: `${Math.max(day.wastingMinutes > 0 ? 3 : 0, wastePct)}%`,
                          backgroundColor: 'var(--color-wasting)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-1.5 sm:gap-2.5 mt-2">
              {last14Days.map((day, idx) => (
                <div
                  key={day.dateStr}
                  className="flex-1 text-center font-mono-tabular text-[10px] truncate"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {idx % 2 === 0 || idx === 13 ? day.label : ''}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Subject Breakdown */}
        <div className="theme-card p-5 space-y-4">
          <div>
            <h3 className="font-display text-base font-semibold">Subject Allocation (14d)</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Self-study 15-minute blocks logged per subject
            </p>
          </div>

          {totalSubjectMinutes === 0 ? (
            <p className="text-xs py-6 text-center" style={{ color: 'var(--text-secondary)' }}>
              Log 15-minute blocks on the Daily Time Plan to view subject balance.
            </p>
          ) : (
            <div className="space-y-3.5">
              {subjects.map((subj) => {
                const mins = summary.subjectTotals[subj.id] || 0;
                const pct = Math.round((mins / totalSubjectMinutes) * 100);
                return (
                  <div key={subj.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{subj.name}</span>
                      <span className="font-mono-tabular" style={{ color: 'var(--text-secondary)' }}>
                        {formatMinutes(mins)} ({pct}%)
                      </span>
                    </div>
                    <div
                      className="h-2 w-full overflow-hidden rounded-full"
                      style={{ backgroundColor: 'var(--bg-subtle)' }}
                    >
                      <div
                        className="h-full"
                        style={{ width: `${pct}%`, backgroundColor: subj.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
