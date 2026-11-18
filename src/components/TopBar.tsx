import { Pause, Play } from 'lucide-react';
import { TabId } from '../types/planner';

interface TopBarProps {
  activeTab: TabId;
  selectedDate: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  timerStatus: 'idle' | 'running' | 'paused';
  timerClock: string;
  onToggleTimerQuick: () => void;
  onGoToTimer: () => void;
}

const TAB_TITLES: Record<TabId, { section: string; subtitle: string }> = {
  daily: { section: 'Daily Time Plan', subtitle: 'AM / PM Study Ledger' },
  tracker: { section: 'Waste, Sleep & Online', subtitle: 'Rest & Distraction Log' },
  calendar: { section: 'Calendar & Deadlines', subtitle: 'Monthly Schedule & Milestones' },
  timer: { section: 'Timer & Stopwatch', subtitle: 'Live Session Monitor' },
  analytics: { section: 'Progress & Analytics', subtitle: '9-Month Trajectory' },
  themes: { section: 'Themes & Exam Setup', subtitle: 'Appearance & A/L Settings' },
};

export function TopBar({
  activeTab,
  selectedDate,
  primaryActionLabel,
  onPrimaryAction,
  timerStatus,
  timerClock,
  onToggleTimerQuick,
  onGoToTimer,
}: TopBarProps) {
  const meta = TAB_TITLES[activeTab];

  return (
    <header
      className="lg:sticky lg:top-0 z-30 border-b px-4 sm:px-6 py-3 flex items-center justify-between gap-4"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Zone 1: Breadcrumb title */}
      <div className="min-w-0 flex items-center gap-2 text-sm">
        <span className="font-display font-semibold truncate">{meta.section}</span>
        <span
          className="hidden sm:inline"
          style={{ color: 'var(--text-secondary)' }}
          aria-hidden="true"
        >
          /
        </span>
        <span
          className="hidden sm:inline truncate"
          style={{ color: 'var(--text-secondary)' }}
        >
          {activeTab === 'daily' || activeTab === 'tracker' ? selectedDate : meta.subtitle}
        </span>
      </div>

      {/* Zone 2 & 3: Optional active timer quick readout + 1 Primary Action */}
      <div className="flex items-center gap-3 shrink-0">
        {timerStatus !== 'idle' && activeTab !== 'timer' && (
          <div
            className="flex items-center gap-2 px-2.5 py-1.5 border theme-control"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={onGoToTimer}
              className="font-mono-tabular text-xs font-semibold hover:underline whitespace-nowrap"
              title="Open Timer & Stopwatch"
            >
              {timerClock}
            </button>
            <button
              type="button"
              onClick={onToggleTimerQuick}
              className="p-1 theme-control hover:opacity-80"
              aria-label={timerStatus === 'running' ? 'Pause timer' : 'Resume timer'}
            >
              {timerStatus === 'running' ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onPrimaryAction}
          className="px-4 py-2 text-xs font-semibold theme-control transition-opacity hover:opacity-90 whitespace-nowrap shrink-0"
          style={{
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-fg)',
          }}
        >
          {primaryActionLabel}
        </button>
      </div>
    </header>
  );
}
