import { ArrowRight, ChevronLeft, ChevronRight, Eraser, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { createEmptyDayPlan, HOUR_LABELS } from '../data/defaults';
import {
  DayPlan,
  ExamSettings,
  HourRow,
  MinutesStep,
  SubjectConfig,
} from '../types/planner';
import {
  addDays,
  computeDayTotals,
  computeHourUsingMinutes,
  computePlanNumbers,
  computeWeekUsingMinutes,
  formatMinutes,
  formatReadableDate,
  toLocalDateString,
} from '../utils/time';

interface DailyPlanSheetProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  days: Record<string, DayPlan>;
  subjects: SubjectConfig[];
  examSettings: ExamSettings;
  onUpdateHour: (date: string, hour: number, updater: (row: HourRow) => HourRow) => void;
  onClearDay: (date: string) => void;
  onUpdateReflection: (date: string, reflection: string) => void;
  onOpenTrackerTab: () => void;
}

const CLASS_CYCLE: MinutesStep[] = [0, 60, 30, 45, 15];

function cycleMinute(current: MinutesStep, order: MinutesStep[]): MinutesStep {
  const idx = order.indexOf(current);
  return order[(idx + 1) % order.length];
}

export function DailyPlanSheet({
  selectedDate,
  onSelectDate,
  days,
  subjects,
  examSettings,
  onUpdateHour,
  onClearDay,
  onUpdateReflection,
  onOpenTrackerTab,
}: DailyPlanSheetProps) {
  const currentHour = new Date().getHours();
  const [period, setPeriod] = useState<'AM' | 'PM'>(() => (currentHour < 12 ? 'AM' : 'PM'));
  const [activeBrushId, setActiveBrushId] = useState<string>(subjects[0]?.id ?? 'general');
  const [eraserMode, setEraserMode] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const today = toLocalDateString(new Date());
  const isToday = selectedDate === today;

  const dayPlan = days[selectedDate] ?? createEmptyDayPlan(selectedDate);
  const yesterdayStr = addDays(selectedDate, -1);
  const todayTotals = computeDayTotals(dayPlan);
  const yesterdayTotals = computeDayTotals(days[yesterdayStr]);
  const weekSoFarMinutes = computeWeekUsingMinutes(days, selectedDate);
  const { weekNo, dayPlanNo, daysLeftForAL } = computePlanNumbers(
    selectedDate,
    examSettings.planStartDate,
    examSettings.examDate,
  );

  const amUsingMinutes = dayPlan.hours
    .filter((r) => r.hour < 12)
    .reduce((sum, r) => sum + computeHourUsingMinutes(r), 0);
  const pmUsingMinutes = dayPlan.hours
    .filter((r) => r.hour >= 12)
    .reduce((sum, r) => sum + computeHourUsingMinutes(r), 0);

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  const handleBlockClick = (row: HourRow, blockIdx: 0 | 1 | 2 | 3) => {
    onUpdateHour(selectedDate, row.hour, (prev) => {
      const nextBlocks = [...prev.blocks] as [
        string | null,
        string | null,
        string | null,
        string | null,
      ];
      if (eraserMode) {
        nextBlocks[blockIdx] = null;
      } else if (nextBlocks[blockIdx] === activeBrushId) {
        nextBlocks[blockIdx] = null;
      } else {
        nextBlocks[blockIdx] = activeBrushId;
      }
      return { ...prev, blocks: nextBlocks };
    });
  };

  const handleToggleClass = (row: HourRow) => {
    onUpdateHour(selectedDate, row.hour, (prev) => ({
      ...prev,
      classMinutes: cycleMinute(prev.classMinutes, CLASS_CYCLE),
    }));
  };

  const visibleHours = HOUR_LABELS.filter((h) => h.period === period);

  return (
    <div className="space-y-5">
      {/* Toolbar: Date Navigator + AM/PM Switch + Subject Brush */}
      <div className="theme-card p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Date Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectDate(addDays(selectedDate, -1))}
              className="p-2 border theme-control hover:opacity-80"
              style={{
                backgroundColor: 'var(--bg-subtle)',
                borderColor: 'var(--border-subtle)',
              }}
              aria-label="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && onSelectDate(e.target.value)}
              className="px-3 py-1.5 text-sm font-mono-tabular border theme-control"
              style={{
                backgroundColor: 'var(--bg-subtle)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            />

            <button
              type="button"
              onClick={() => onSelectDate(addDays(selectedDate, 1))}
              className="p-2 border theme-control hover:opacity-80"
              style={{
                backgroundColor: 'var(--bg-subtle)',
                borderColor: 'var(--border-subtle)',
              }}
              aria-label="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {selectedDate !== today && (
              <button
                type="button"
                onClick={() => onSelectDate(today)}
                className="px-3 py-1.5 text-xs font-semibold border theme-control whitespace-nowrap"
                style={{
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--accent)',
                }}
              >
                Today
              </button>
            )}

            <span
              className="text-xs ml-1 hidden sm:inline"
              style={{ color: 'var(--text-secondary)' }}
            >
              {formatReadableDate(selectedDate)}
            </span>
          </div>

          {/* AM / PM Switch Tabs */}
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
            <div
              className="inline-flex p-1 border theme-control"
              style={{
                backgroundColor: 'var(--bg-subtle)',
                borderColor: 'var(--border-subtle)',
              }}
              role="tablist"
              aria-label="AM or PM study hours"
            >
              <button
                type="button"
                role="tab"
                aria-selected={period === 'AM'}
                onClick={() => setPeriod('AM')}
                className="px-3.5 py-1.5 text-xs font-semibold theme-control transition-colors whitespace-nowrap"
                style={{
                  backgroundColor: period === 'AM' ? 'var(--bg-surface)' : 'transparent',
                  color: period === 'AM' ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                AM · {formatMinutes(amUsingMinutes)}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={period === 'PM'}
                onClick={() => setPeriod('PM')}
                className="px-3.5 py-1.5 text-xs font-semibold theme-control transition-colors whitespace-nowrap"
                style={{
                  backgroundColor: period === 'PM' ? 'var(--bg-surface)' : 'transparent',
                  color: period === 'PM' ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                PM · {formatMinutes(pmUsingMinutes)}
              </button>
            </div>

            {!confirmClear ? (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="px-2.5 py-2 text-xs font-medium theme-control border flex items-center gap-1 whitespace-nowrap"
                style={{
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear Day</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onClearDay(selectedDate);
                    setConfirmClear(false);
                  }}
                  className="px-2.5 py-2 text-xs font-semibold theme-control whitespace-nowrap"
                  style={{ backgroundColor: 'var(--color-wasting)', color: '#ffffff' }}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-2 py-2 text-xs theme-control border whitespace-nowrap"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Subject Brush Selector */}
        <div
          className="pt-3 border-t flex flex-wrap items-center gap-2"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <span
            className="text-xs font-medium mr-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            15m Brush:
          </span>
          {subjects.map((subj) => {
            const active = !eraserMode && activeBrushId === subj.id;
            return (
              <button
                key={subj.id}
                type="button"
                onClick={() => {
                  setEraserMode(false);
                  setActiveBrushId(subj.id);
                }}
                className="px-2.5 py-1.5 text-xs font-medium theme-control border flex items-center gap-1.5 transition-colors whitespace-nowrap"
                style={{
                  backgroundColor: active ? subj.color : 'var(--bg-subtle)',
                  borderColor: active ? subj.color : 'var(--border-subtle)',
                  color: active ? '#ffffff' : 'var(--text-primary)',
                }}
              >
                <span
                  className="w-2 h-2 rounded-xs shrink-0"
                  style={{ backgroundColor: active ? '#ffffff' : subj.color }}
                />
                <span>{subj.name}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setEraserMode((v) => !v)}
            className="px-2.5 py-1.5 text-xs font-medium theme-control border flex items-center gap-1.5 whitespace-nowrap"
            style={{
              backgroundColor: eraserMode ? 'var(--color-wasting)' : 'var(--bg-subtle)',
              borderColor: eraserMode ? 'var(--color-wasting)' : 'var(--border-subtle)',
              color: eraserMode ? '#ffffff' : 'var(--text-secondary)',
            }}
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Eraser</span>
          </button>
        </div>
      </div>

      {/* Mobile Zero-Slide Hour Cards (< md) */}
      <div className="md:hidden theme-card divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
        {visibleHours.map(({ hour, label }) => {
          const row = dayPlan.hours[hour];
          const hourUsing = computeHourUsingMinutes(row);
          const isCurrentHour = isToday && hour === currentHour;

          return (
            <div
              key={hour}
              className="p-3.5 space-y-2.5"
              style={{
                borderColor: 'var(--border-subtle)',
                backgroundColor: isCurrentHour ? 'var(--accent-soft)' : 'transparent',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono-tabular text-sm font-semibold"
                    style={{ color: isCurrentHour ? 'var(--accent)' : 'var(--text-primary)' }}
                  >
                    {label} {period}
                  </span>
                  {hourUsing > 0 && (
                    <span
                      className="font-mono-tabular text-xs font-semibold"
                      style={{ color: 'var(--color-using)' }}
                    >
                      {hourUsing}m
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleClass(row)}
                  className="px-3 py-1.5 text-xs font-mono-tabular font-medium border theme-control whitespace-nowrap"
                  style={{
                    backgroundColor:
                      row.classMinutes > 0 ? 'var(--color-class)' : 'var(--bg-subtle)',
                    borderColor:
                      row.classMinutes > 0 ? 'var(--color-class)' : 'var(--border-subtle)',
                    color: row.classMinutes > 0 ? '#ffffff' : 'var(--text-secondary)',
                  }}
                >
                  {row.classMinutes > 0 ? `Class ${row.classMinutes}m` : '+ Class'}
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {([0, 1, 2, 3] as const).map((idx) => {
                  const assignedId = row.blocks[idx];
                  const subj = assignedId ? subjectMap.get(assignedId) : undefined;
                  const fillColor = subj ? subj.color : 'var(--color-using)';

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleBlockClick(row, idx)}
                      className="h-11 theme-control text-xs font-mono-tabular font-semibold border transition-transform active:scale-95 flex items-center justify-center"
                      style={{
                        backgroundColor: assignedId ? fillColor : 'var(--bg-subtle)',
                        borderColor: assignedId ? fillColor : 'var(--border-subtle)',
                        color: assignedId ? '#ffffff' : 'var(--text-secondary)',
                      }}
                    >
                      {assignedId ? subj?.shortCode ?? '15m' : '15m'}
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                value={row.note}
                onChange={(e) =>
                  onUpdateHour(selectedDate, hour, (prev) => ({
                    ...prev,
                    note: e.target.value,
                  }))
                }
                placeholder="Topic or task note..."
                className="w-full h-9 px-2.5 text-xs border theme-control bg-transparent focus:outline-none focus:ring-1"
                style={{
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          );
        })}

        <div
          className="p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold"
          style={{ backgroundColor: 'var(--bg-subtle)' }}
        >
          <span className="font-mono-tabular">
            TODAY USING: {formatMinutes(todayTotals.usingMinutes)}
          </span>
          <button
            type="button"
            onClick={onOpenTrackerTab}
            className="inline-flex items-center gap-1 font-semibold hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            <span>Waste · Sleep · Online</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Desktop Aligned Ledger Table (>= md) */}
      <div className="hidden md:block theme-card overflow-hidden">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr
              className="border-b text-xs font-semibold"
              style={{
                backgroundColor: 'var(--bg-subtle)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <th
                rowSpan={2}
                className="px-3 py-2.5 w-28 border-r align-middle"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                TIME ({period})
              </th>
              <th
                colSpan={5}
                className="px-3 py-2 text-center border-r border-b"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                USING TIME
              </th>
              <th rowSpan={2} className="px-3 py-2.5 align-middle">
                WORK / TOPIC NOTE
              </th>
            </tr>
            <tr
              className="border-b text-[11px] font-medium"
              style={{
                backgroundColor: 'var(--bg-subtle)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <th
                className="px-1 py-1.5 text-center w-16 border-r"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                15 min
              </th>
              <th
                className="px-1 py-1.5 text-center w-16 border-r"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                15 min
              </th>
              <th
                className="px-1 py-1.5 text-center w-16 border-r"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                15 min
              </th>
              <th
                className="px-1 py-1.5 text-center w-16 border-r"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                15 min
              </th>
              <th
                className="px-2 py-1.5 text-center w-24 border-r"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                Class / school
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleHours.map(({ hour, label }) => {
              const row = dayPlan.hours[hour];
              const hourUsing = computeHourUsingMinutes(row);
              const isCurrentHour = isToday && hour === currentHour;

              return (
                <tr
                  key={hour}
                  className="border-b transition-colors"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    backgroundColor: isCurrentHour ? 'var(--accent-soft)' : 'transparent',
                  }}
                >
                  <td
                    className="px-3 py-1.5 font-mono-tabular text-xs font-semibold whitespace-nowrap border-r"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      color: isCurrentHour ? 'var(--accent)' : 'var(--text-primary)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{label}</span>
                      {hourUsing > 0 && (
                        <span
                          className="text-[11px]"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {hourUsing}m
                        </span>
                      )}
                    </div>
                  </td>

                  {([0, 1, 2, 3] as const).map((idx) => {
                    const assignedId = row.blocks[idx];
                    const subj = assignedId ? subjectMap.get(assignedId) : undefined;
                    const fillColor = subj ? subj.color : 'var(--color-using)';

                    return (
                      <td
                        key={idx}
                        className="p-1 border-r text-center"
                        style={{ borderColor: 'var(--border-subtle)' }}
                      >
                        <button
                          type="button"
                          onClick={() => handleBlockClick(row, idx)}
                          title={
                            assignedId
                              ? `${subj?.name ?? 'Study'} (15 min) — click to clear or replace`
                              : `Mark 15 min block (${subjectMap.get(activeBrushId)?.name ?? 'Study'})`
                          }
                          className="w-full h-9 theme-control text-[11px] font-mono-tabular font-semibold transition-transform active:scale-95 flex items-center justify-center border"
                          style={{
                            backgroundColor: assignedId ? fillColor : 'var(--bg-subtle)',
                            borderColor: assignedId ? fillColor : 'var(--border-subtle)',
                            color: assignedId ? '#ffffff' : 'var(--text-secondary)',
                          }}
                        >
                          {assignedId ? subj?.shortCode ?? '15m' : ''}
                        </button>
                      </td>
                    );
                  })}

                  <td
                    className="p-1 border-r text-center"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleClass(row)}
                      title="Click to cycle Class / School minutes (0 / 60 / 30 / 45 / 15)"
                      className="w-full h-9 theme-control text-xs font-mono-tabular font-medium transition-colors border"
                      style={{
                        backgroundColor:
                          row.classMinutes > 0 ? 'var(--color-class)' : 'var(--bg-subtle)',
                        borderColor:
                          row.classMinutes > 0 ? 'var(--color-class)' : 'var(--border-subtle)',
                        color: row.classMinutes > 0 ? '#ffffff' : 'var(--text-secondary)',
                      }}
                    >
                      {row.classMinutes > 0 ? `${row.classMinutes}m` : '—'}
                    </button>
                  </td>

                  <td className="p-1">
                    <input
                      type="text"
                      value={row.note}
                      onChange={(e) =>
                        onUpdateHour(selectedDate, hour, (prev) => ({
                          ...prev,
                          note: e.target.value,
                        }))
                      }
                      placeholder="Topic or task..."
                      className="w-full h-9 px-2.5 text-xs bg-transparent theme-control focus:outline-none focus:ring-1"
                      style={{
                        color: 'var(--text-primary)',
                      }}
                    />
                  </td>
                </tr>
              );
            })}

            <tr
              className="border-t-2 font-semibold text-xs"
              style={{
                backgroundColor: 'var(--bg-subtle)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <td
                className="px-3 py-3 border-r"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                TOTAL
              </td>
              <td
                colSpan={5}
                className="px-3 py-3 border-r font-mono-tabular"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                TODAY USING: {formatMinutes(todayTotals.usingMinutes)}
                <span
                  className="ml-2 font-normal"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  (Self: {formatMinutes(todayTotals.selfStudyMinutes)} · Class:{' '}
                  {formatMinutes(todayTotals.classMinutes)})
                </span>
              </td>
              <td className="px-3 py-3">
                <button
                  type="button"
                  onClick={onOpenTrackerTab}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline whitespace-nowrap"
                  style={{ color: 'var(--accent)' }}
                >
                  <span>
                    Waste {formatMinutes(todayTotals.wastingMinutes)} · Sleep{' '}
                    {formatMinutes(todayTotals.sleepMinutes)} · Online{' '}
                    {formatMinutes(todayTotals.onlineMinutes)}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Bottom Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="theme-card p-5 space-y-2.5 text-sm">
          <div
            className="flex items-center justify-between py-1 border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
              WEEK NO
            </span>
            <span className="font-mono-tabular font-semibold">
              Week {String(weekNo).padStart(2, '0')}
            </span>
          </div>
          <div
            className="flex items-center justify-between py-1 border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
              DAY PLAN NO
            </span>
            <span className="font-mono-tabular font-semibold">Day {dayPlanNo}</span>
          </div>
          <div
            className="flex items-center justify-between py-1 border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
              DATE
            </span>
            <span className="font-mono-tabular font-semibold">{selectedDate}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
              DAYS I HAVE FOR A/L
            </span>
            <span className="font-mono-tabular font-bold" style={{ color: 'var(--accent)' }}>
              {daysLeftForAL} days
            </span>
          </div>
        </div>

        <div className="theme-card p-5 space-y-2.5 text-sm">
          <div
            className="flex items-center justify-between py-1 border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
              YESTERDAY TOTAL
            </span>
            <span className="font-mono-tabular font-semibold">
              {formatMinutes(yesterdayTotals.usingMinutes)}
            </span>
          </div>
          <div
            className="flex items-center justify-between py-1 border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
              TODAY TOTAL
            </span>
            <span className="font-mono-tabular font-bold" style={{ color: 'var(--color-using)' }}>
              {formatMinutes(todayTotals.usingMinutes)}
            </span>
          </div>
          <div
            className="flex items-center justify-between py-1 border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
              TOTAL HOURS OF THE WEEK SO FAR
            </span>
            <span className="font-mono-tabular font-bold">
              {formatMinutes(weekSoFarMinutes)}
            </span>
          </div>
          <div className="pt-1">
            <label
              htmlFor="daily-reflection"
              className="block text-xs font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Daily Reflection / Priority Target
            </label>
            <input
              id="daily-reflection"
              type="text"
              value={dayPlan.reflection ?? ''}
              onChange={(e) => onUpdateReflection(selectedDate, e.target.value)}
              placeholder="Write today's core target or quick review..."
              className="w-full px-3 py-1.5 text-xs border theme-control bg-transparent focus:outline-none focus:ring-1"
              style={{
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
