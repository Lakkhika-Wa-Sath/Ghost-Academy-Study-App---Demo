import {
  BarChart3,
  CalendarDays,
  Clock,
  Moon,
  Palette,
  TableProperties,
} from 'lucide-react';
import { ExamSettings, TabId } from '../types/planner';
import { diffDays, formatMinutes, toLocalDateString } from '../utils/time';

interface SidebarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  examSettings: ExamSettings;
  todayUsingMinutes: number;
  upcomingDeadlinesCount: number;
  timerRunning: boolean;
  timerDisplay: string;
}

const NAV_ITEMS: { id: TabId; label: string; shortLabel: string; icon: typeof TableProperties }[] = [
  { id: 'daily', label: 'Daily Time Plan', shortLabel: 'Plan', icon: TableProperties },
  { id: 'tracker', label: 'Waste, Sleep & Online', shortLabel: 'Rest', icon: Moon },
  { id: 'calendar', label: 'Calendar & Deadlines', shortLabel: 'Calendar', icon: CalendarDays },
  { id: 'timer', label: 'Timer & Stopwatch', shortLabel: 'Timer', icon: Clock },
  { id: 'analytics', label: 'Progress & Analytics', shortLabel: 'Stats', icon: BarChart3 },
  { id: 'themes', label: 'Themes & Exam Setup', shortLabel: 'Themes', icon: Palette },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  examSettings,
  todayUsingMinutes,
  upcomingDeadlinesCount,
  timerRunning,
  timerDisplay,
}: SidebarProps) {
  const today = toLocalDateString(new Date());
  const daysLeft = Math.max(0, diffDays(today, examSettings.examDate));
  const targetPct = Math.min(
    100,
    Math.round((todayUsingMinutes / Math.max(60, examSettings.dailyTargetMinutes)) * 100),
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex w-64 shrink-0 h-screen sticky top-0 flex-col justify-between border-r"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div>
          <div
            className="px-5 py-4 border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div className="font-display text-base font-bold tracking-tight truncate">
              Ghost Plan
            </div>
            <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
              {examSettings.streamLabel}
            </div>
          </div>

          {/* Countdown Block */}
          <div
            className="mx-4 mt-4 p-3.5 border theme-control"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Days Left for A/L
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="font-mono-tabular text-2xl font-bold tracking-tight">
                {daysLeft}
              </span>
              <span className="font-mono-tabular text-xs" style={{ color: 'var(--text-secondary)' }}>
                ~{Math.max(1, Math.round(daysLeft / 30))} mo
              </span>
            </div>
            <div
              className="mt-3 pt-2.5 border-t flex items-center justify-between text-xs"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>Today Focus</span>
              <span className="font-mono-tabular font-semibold">
                {formatMinutes(todayUsingMinutes)} ({targetPct}%)
              </span>
            </div>
            <div
              className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: 'var(--border-subtle)' }}
            >
              <div
                className="h-full transition-all duration-200"
                style={{
                  width: `${targetPct}%`,
                  backgroundColor: 'var(--accent)',
                }}
              />
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="mt-4 px-3 space-y-1" aria-label="Main Navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium theme-control transition-colors whitespace-nowrap"
                  style={{
                    backgroundColor: isActive ? 'var(--accent-soft)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.id === 'calendar' && upcomingDeadlinesCount > 0 && (
                    <span
                      className="font-mono-tabular text-xs"
                      style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}
                    >
                      {upcomingDeadlinesCount}
                    </span>
                  )}
                  {item.id === 'timer' && timerRunning && (
                    <span
                      className="font-mono-tabular text-xs font-semibold"
                      style={{ color: 'var(--accent)' }}
                    >
                      {timerDisplay}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Heritage Quote Footer */}
        <div className="p-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="text-xs font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>
            _GHOST ACADEMY _
          </div>
          <div className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            කට්ට කන්නන් දිනන්න
          </div>
          <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            Endure the work, win the exam.
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar (Replaces slide-out drawer) */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-14 border-t grid grid-cols-6"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
        aria-label="Mobile Navigation"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors whitespace-nowrap"
              style={{
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--accent-soft)' : 'transparent',
              }}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
