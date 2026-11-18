import { ChevronLeft, ChevronRight, Moon } from 'lucide-react';
import { useState } from 'react';
import { createEmptyDayPlan, HOUR_LABELS } from '../data/defaults';
import { DayPlan, HourRow, MinutesStep } from '../types/planner';
import {
  addDays,
  computeDayTotals,
  formatMinutes,
  formatReadableDate,
  toLocalDateString,
} from '../utils/time';

interface WasteSleepOnlineViewProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  days: Record<string, DayPlan>;
  onUpdateHour: (date: string, hour: number, updater: (row: HourRow) => HourRow) => void;
}

const MINUTE_OPTIONS: MinutesStep[] = [0, 15, 30, 45, 60];

export function WasteSleepOnlineView({
  selectedDate,
  onSelectDate,
  days,
  onUpdateHour,
}: WasteSleepOnlineViewProps) {
  const today = toLocalDateString(new Date());
  const currentHour = new Date().getHours();
  const [period, setPeriod] = useState<'AM' | 'PM'>(() => (currentHour < 12 ? 'AM' : 'PM'));

  const dayPlan = days[selectedDate] ?? createEmptyDayPlan(selectedDate);
  const totals = computeDayTotals(dayPlan);
  const isToday = selectedDate === today;

  const amTotals = dayPlan.hours
    .filter((h) => h.hour < 12)
    .reduce(
      (acc, r) => ({
        wasting: acc.wasting + r.wastingMinutes,
        sleep: acc.sleep + r.sleepMinutes,
        online: acc.online + r.onlineMinutes,
      }),
      { wasting: 0, sleep: 0, online: 0 },
    );

  const pmTotals = dayPlan.hours
    .filter((h) => h.hour >= 12)
    .reduce(
      (acc, r) => ({
        wasting: acc.wasting + r.wastingMinutes,
        sleep: acc.sleep + r.sleepMinutes,
        online: acc.online + r.onlineMinutes,
      }),
      { wasting: 0, sleep: 0, online: 0 },
    );

  const handleSetMinutes = (
    hour: number,
    field: 'wastingMinutes' | 'sleepMinutes' | 'onlineMinutes',
    val: MinutesStep,
  ) => {
    onUpdateHour(selectedDate, hour, (prev) => ({
      ...prev,
      [field]: val,
    }));
  };

  const handleQuickSleepBlock = (hoursToFill: number[]) => {
    const allFilled = hoursToFill.every((h) => dayPlan.hours[h].sleepMinutes === 60);
    hoursToFill.forEach((h) => {
      onUpdateHour(selectedDate, h, (prev) => ({
        ...prev,
        sleepMinutes: allFilled ? 0 : 60,
      }));
    });
  };

  const visibleHours = HOUR_LABELS.filter((h) => h.period === period);

  return (
    <div className="space-y-5">
      {/* Top Toolbar: Date Switcher + AM/PM Switch + Sleep Helper */}
      <div className="theme-card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3">
          {/* AM / PM Switch Tab */}
          <div
            className="inline-flex p-1 border theme-control"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              borderColor: 'var(--border-subtle)',
            }}
            role="tablist"
            aria-label="AM or PM hours"
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
              AM (12–12) · {formatMinutes(amTotals.wasting + amTotals.sleep + amTotals.online)}
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
              PM (12–12) · {formatMinutes(pmTotals.wasting + pmTotals.sleep + pmTotals.online)}
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleQuickSleepBlock([0, 1, 2, 3, 4, 5])}
            className="px-3 py-2 text-xs font-medium border theme-control flex items-center gap-1.5 whitespace-nowrap"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <Moon className="w-3.5 h-3.5" style={{ color: 'var(--color-sleep)' }} />
            <span>Toggle 12–6 AM Sleep</span>
          </button>
        </div>
      </div>

      {/* Daily Totals Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="theme-card p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Total Wasting Time
            </div>
            <div
              className="font-mono-tabular text-xl font-bold mt-0.5"
              style={{ color: 'var(--color-wasting)' }}
            >
              {formatMinutes(totals.wastingMinutes)}
            </div>
          </div>
          <div className="font-mono-tabular text-xs text-right" style={{ color: 'var(--text-secondary)' }}>
            <div>AM: {formatMinutes(amTotals.wasting)}</div>
            <div>PM: {formatMinutes(pmTotals.wasting)}</div>
          </div>
        </div>

        <div className="theme-card p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Total Sleep
            </div>
            <div
              className="font-mono-tabular text-xl font-bold mt-0.5"
              style={{ color: 'var(--color-sleep)' }}
            >
              {formatMinutes(totals.sleepMinutes)}
            </div>
          </div>
          <div className="font-mono-tabular text-xs text-right" style={{ color: 'var(--text-secondary)' }}>
            <div>AM: {formatMinutes(amTotals.sleep)}</div>
            <div>PM: {formatMinutes(pmTotals.sleep)}</div>
          </div>
        </div>

        <div className="theme-card p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Total Online
            </div>
            <div
              className="font-mono-tabular text-xl font-bold mt-0.5"
              style={{ color: 'var(--color-online)' }}
            >
              {formatMinutes(totals.onlineMinutes)}
            </div>
          </div>
          <div className="font-mono-tabular text-xs text-right" style={{ color: 'var(--text-secondary)' }}>
            <div>AM: {formatMinutes(amTotals.online)}</div>
            <div>PM: {formatMinutes(pmTotals.online)}</div>
          </div>
        </div>
      </div>

      {/* 12-Hour Interactive Minute Selector List (Mobile-friendly cards + Desktop grid) */}
      <div className="theme-card divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
        <div
          className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 text-xs font-semibold"
          style={{
            backgroundColor: 'var(--bg-subtle)',
            color: 'var(--text-secondary)',
          }}
        >
          <div className="col-span-2">TIME ({period})</div>
          <div className="col-span-3">WASTING TIME</div>
          <div className="col-span-3">SLEEP</div>
          <div className="col-span-4">ONLINE</div>
        </div>

        {visibleHours.map(({ hour, label }) => {
          const row = dayPlan.hours[hour];
          const isCurrentHour = isToday && hour === currentHour;

          const renderPicker = (
            field: 'wastingMinutes' | 'sleepMinutes' | 'onlineMinutes',
            activeColor: string,
            heading: string,
          ) => {
            const val = row[field];
            return (
              <div className="space-y-1">
                <div
                  className="md:hidden text-[11px] font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {heading}
                </div>
                <div
                  className="inline-grid grid-cols-5 w-full border theme-control overflow-hidden"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  {MINUTE_OPTIONS.map((opt) => {
                    const active = val === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleSetMinutes(hour, field, opt)}
                        className="h-10 text-xs font-mono-tabular font-semibold transition-colors border-r last:border-r-0"
                        style={{
                          borderColor: 'var(--border-subtle)',
                          backgroundColor: active
                            ? opt === 0
                              ? 'var(--bg-subtle)'
                              : activeColor
                            : 'transparent',
                          color:
                            active && opt > 0
                              ? '#ffffff'
                              : active
                                ? 'var(--text-primary)'
                                : 'var(--text-secondary)',
                        }}
                      >
                        {opt === 0 ? '—' : `${opt}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          };

          return (
            <div
              key={hour}
              className="p-4 md:py-2.5 md:px-4 grid grid-cols-1 md:grid-cols-12 gap-3 md:items-center"
              style={{
                borderColor: 'var(--border-subtle)',
                backgroundColor: isCurrentHour ? 'var(--accent-soft)' : 'transparent',
              }}
            >
              <div
                className="md:col-span-2 font-mono-tabular text-sm md:text-xs font-semibold flex items-center justify-between"
                style={{ color: isCurrentHour ? 'var(--accent)' : 'var(--text-primary)' }}
              >
                <span>
                  {label} {period}
                </span>
                {row.note && (
                  <span
                    className="md:hidden text-xs font-normal truncate max-w-[180px]"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {row.note}
                  </span>
                )}
              </div>

              <div className="md:col-span-3">
                {renderPicker('wastingMinutes', 'var(--color-wasting)', 'Wasting Time (min)')}
              </div>

              <div className="md:col-span-3">
                {renderPicker('sleepMinutes', 'var(--color-sleep)', 'Sleep (min)')}
              </div>

              <div className="md:col-span-4">
                {renderPicker('onlineMinutes', 'var(--color-online)', 'Online (min)')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
