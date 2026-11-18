import { CheckCircle2, Flag, Pause, Play, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  ActiveTimerState,
  SessionCategory,
  StudySession,
  SubjectConfig,
} from '../types/planner';
import { formatClockMs, formatMinutes } from '../utils/time';

interface FocusTimerProps {
  timer: ActiveTimerState;
  elapsedMs: number;
  subjects: SubjectConfig[];
  sessions: StudySession[];
  onUpdateTimer: (updater: (t: ActiveTimerState) => ActiveTimerState) => void;
  onLogSession: (params: {
    durationSeconds: number;
    mode: 'stopwatch' | 'timer';
    category: SessionCategory;
    subjectId: string;
    label: string;
    applyToSheet: boolean;
  }) => void;
  onDeleteSession: (id: string) => void;
}

const TIMER_PRESETS = [
  { label: '15m Block', minutes: 15 },
  { label: '25m Pomodoro', minutes: 25 },
  { label: '50m Deep Work', minutes: 50 },
  { label: '90m Past Paper', minutes: 90 },
  { label: '180m Full Paper', minutes: 180 },
];

export function FocusTimer({
  timer,
  elapsedMs,
  subjects,
  sessions,
  onUpdateTimer,
  onLogSession,
  onDeleteSession,
}: FocusTimerProps) {
  const [applyToSheet, setApplyToSheet] = useState(true);
  const [customMinutes, setCustomMinutes] = useState(String(timer.targetMinutes));
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  const targetMs = timer.targetMinutes * 60_000;
  const remainingMs = Math.max(0, targetMs - elapsedMs);
  const displayMs = timer.mode === 'timer' ? remainingMs : elapsedMs;
  const progressPct =
    timer.mode === 'timer' && targetMs > 0
      ? Math.min(100, Math.round((elapsedMs / targetMs) * 100))
      : 0;

  const handleStartPause = () => {
    if (timer.status === 'running') {
      const now = Date.now();
      const delta = timer.startedAt ? now - timer.startedAt : 0;
      onUpdateTimer((prev) => ({
        ...prev,
        status: 'paused',
        startedAt: null,
        accumulatedMs: prev.accumulatedMs + delta,
      }));
    } else {
      onUpdateTimer((prev) => ({
        ...prev,
        status: 'running',
        startedAt: Date.now(),
      }));
    }
  };

  const handleReset = () => {
    onUpdateTimer((prev) => ({
      ...prev,
      status: 'idle',
      startedAt: null,
      accumulatedMs: 0,
      laps: [],
    }));
  };

  const handleLap = () => {
    if (timer.status === 'idle') return;
    onUpdateTimer((prev) => ({
      ...prev,
      laps: [elapsedMs, ...prev.laps],
    }));
  };

  const handleFinishAndLog = () => {
    const durationSeconds = Math.floor(elapsedMs / 1000);
    if (durationSeconds < 10) return;

    onLogSession({
      durationSeconds,
      mode: timer.mode,
      category: timer.category,
      subjectId: timer.subjectId,
      label: timer.label || 'Focus Session',
      applyToSheet,
    });

    const blocksAdded = Math.max(1, Math.round(durationSeconds / 900));
    setSavedNotice(
      applyToSheet
        ? `Logged ${formatMinutes(Math.round(durationSeconds / 60))} (${blocksAdded} × 15m block${blocksAdded > 1 ? 's' : ''}) to Today's Plan.`
        : `Saved ${formatMinutes(Math.round(durationSeconds / 60))} session to history.`,
    );
    setTimeout(() => setSavedNotice(null), 4000);

    handleReset();
  };

  const handleSwitchMode = (mode: 'stopwatch' | 'timer') => {
    if (timer.status === 'running') return;
    onUpdateTimer((prev) => ({
      ...prev,
      mode,
      status: 'idle',
      startedAt: null,
      accumulatedMs: 0,
      laps: [],
    }));
  };

  const handleSetMinutes = (mins: number) => {
    const clamped = Math.max(1, Math.min(360, mins));
    setCustomMinutes(String(clamped));
    onUpdateTimer((prev) => ({
      ...prev,
      targetMinutes: clamped,
      status: 'idle',
      startedAt: null,
      accumulatedMs: 0,
    }));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main Timer & Stopwatch Console */}
        <div className="lg:col-span-2 theme-card p-6 space-y-6">
          {/* Mode Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div
              className="inline-flex p-1 border theme-control"
              style={{
                backgroundColor: 'var(--bg-subtle)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <button
                type="button"
                disabled={timer.status === 'running'}
                onClick={() => handleSwitchMode('timer')}
                className="px-4 py-1.5 text-xs font-semibold theme-control transition-colors whitespace-nowrap disabled:opacity-60"
                style={{
                  backgroundColor: timer.mode === 'timer' ? 'var(--bg-surface)' : 'transparent',
                  color: timer.mode === 'timer' ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                Focus Timer
              </button>
              <button
                type="button"
                disabled={timer.status === 'running'}
                onClick={() => handleSwitchMode('stopwatch')}
                className="px-4 py-1.5 text-xs font-semibold theme-control transition-colors whitespace-nowrap disabled:opacity-60"
                style={{
                  backgroundColor: timer.mode === 'stopwatch' ? 'var(--bg-surface)' : 'transparent',
                  color:
                    timer.mode === 'stopwatch' ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                Stopwatch
              </button>
            </div>

            <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {timer.status === 'running'
                ? 'Session running'
                : timer.status === 'paused'
                  ? 'Paused'
                  : 'Ready to track'}
            </div>
          </div>

          {/* Giant Tabular Readout */}
          <div
            className="py-8 px-6 border theme-control text-center space-y-4"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div className="font-mono-tabular text-5xl sm:text-6xl font-bold tracking-tight">
              {formatClockMs(displayMs)}
            </div>

            {timer.mode === 'timer' ? (
              <div className="max-w-md mx-auto space-y-1.5">
                <div
                  className="h-2 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: 'var(--border-subtle)' }}
                >
                  <div
                    className="h-full transition-all duration-200"
                    style={{
                      width: `${progressPct}%`,
                      backgroundColor: 'var(--accent)',
                    }}
                  />
                </div>
                <div
                  className="flex justify-between font-mono-tabular text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span>Elapsed: {formatClockMs(elapsedMs)}</span>
                  <span>Target: {timer.targetMinutes} min</span>
                </div>
              </div>
            ) : (
              <div className="font-mono-tabular text-xs" style={{ color: 'var(--text-secondary)' }}>
                Counting up · {Math.floor(elapsedMs / 900_000)} × 15m PDF blocks completed
              </div>
            )}
          </div>

          {/* Timer Presets */}
          {timer.mode === 'timer' && (
            <div className="flex flex-wrap items-center gap-2">
              {TIMER_PRESETS.map((preset) => {
                const active = timer.targetMinutes === preset.minutes;
                return (
                  <button
                    key={preset.minutes}
                    type="button"
                    disabled={timer.status === 'running'}
                    onClick={() => handleSetMinutes(preset.minutes)}
                    className="px-3 py-1.5 text-xs font-medium border theme-control whitespace-nowrap disabled:opacity-50"
                    style={{
                      backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                      borderColor: active ? 'var(--accent)' : 'var(--border-subtle)',
                      color: active ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
              <div className="flex items-center gap-1.5 ml-auto">
                <input
                  type="number"
                  min={1}
                  max={360}
                  disabled={timer.status === 'running'}
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  onBlur={() => handleSetMinutes(Number(customMinutes) || 25)}
                  className="w-16 px-2 py-1 text-xs font-mono-tabular border theme-control bg-transparent"
                  style={{ borderColor: 'var(--border-subtle)' }}
                  aria-label="Custom minutes"
                />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  min
                </span>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleStartPause}
              className="px-5 py-2.5 text-sm font-semibold theme-control flex items-center gap-2 whitespace-nowrap"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              {timer.status === 'running' ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>{timer.status === 'paused' ? 'Resume' : 'Start'}</span>
                </>
              )}
            </button>

            {timer.mode === 'stopwatch' && (
              <button
                type="button"
                disabled={timer.status === 'idle'}
                onClick={handleLap}
                className="px-4 py-2.5 text-sm font-medium border theme-control flex items-center gap-2 whitespace-nowrap disabled:opacity-40"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <Flag className="w-4 h-4" />
                <span>Lap Split</span>
              </button>
            )}

            <button
              type="button"
              disabled={elapsedMs < 10_000}
              onClick={handleFinishAndLog}
              className="px-4 py-2.5 text-sm font-semibold border theme-control flex items-center gap-2 whitespace-nowrap disabled:opacity-40"
              style={{
                borderColor: 'var(--color-using)',
                color: 'var(--color-using)',
              }}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Finish & Log</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-2.5 text-sm font-medium border theme-control flex items-center gap-1.5 whitespace-nowrap ml-auto"
              style={{
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>
          </div>

          {savedNotice && (
            <div
              className="px-3.5 py-2.5 border theme-control text-xs font-medium"
              style={{
                borderColor: 'var(--color-using)',
                backgroundColor: 'var(--bg-subtle)',
                color: 'var(--color-using)',
              }}
            >
              {savedNotice}
            </div>
          )}

          {/* Stopwatch Laps */}
          {timer.mode === 'stopwatch' && timer.laps.length > 0 && (
            <div className="pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="text-xs font-semibold mb-2">Lap Splits</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {timer.laps.map((lapMs, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-1.5 border theme-control flex items-center justify-between text-xs font-mono-tabular"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      backgroundColor: 'var(--bg-subtle)',
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Lap {timer.laps.length - idx}
                    </span>
                    <span className="font-semibold">{formatClockMs(lapMs)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Session Configuration Panel */}
        <div className="theme-card p-5 space-y-4">
          <h3 className="font-display text-base font-semibold">Session Assignment</h3>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            When you click Finish & Log, your worked minutes convert directly into 15-minute blocks
            on Today&apos;s Time Plan.
          </p>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Subject
            </label>
            <select
              value={timer.subjectId}
              onChange={(e) => onUpdateTimer((prev) => ({ ...prev, subjectId: e.target.value }))}
              className="w-full px-3 py-2 text-sm border theme-control"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Ledger Column
            </label>
            <select
              value={timer.category}
              onChange={(e) =>
                onUpdateTimer((prev) => ({
                  ...prev,
                  category: e.target.value as SessionCategory,
                }))
              }
              className="w-full px-3 py-2 text-sm border theme-control"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="self-study">Using Time (15m Self-Study Blocks)</option>
              <option value="class">Class / School Time</option>
              <option value="online">Online Column</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Session Topic / Task Label
            </label>
            <input
              type="text"
              value={timer.label}
              onChange={(e) => onUpdateTimer((prev) => ({ ...prev, label: e.target.value }))}
              placeholder="e.g., 2019 Rotational Motion Paper"
              className="w-full px-3 py-2 text-sm border theme-control bg-transparent focus:outline-none focus:ring-1"
              style={{ borderColor: 'var(--border-subtle)' }}
            />
          </div>

          <label className="flex items-center gap-2.5 text-xs pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={applyToSheet}
              onChange={(e) => setApplyToSheet(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Auto-fill 15m blocks in Today&apos;s Daily Plan</span>
          </label>
        </div>
      </div>

      {/* Recent Study Sessions Log */}
      <div className="theme-card overflow-hidden">
        <div
          className="px-5 py-3.5 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <h3 className="font-display text-base font-semibold">Recorded Work Sessions</h3>
          <span className="font-mono-tabular text-xs" style={{ color: 'var(--text-secondary)' }}>
            {sessions.length} total
          </span>
        </div>

        {sessions.length === 0 ? (
          <div className="p-8 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
            No timed sessions recorded yet. Start the timer or stopwatch above to track your first
            work block.
          </div>
        ) : (
          <>
            {/* Mobile Stacked Sessions (< md) */}
            <div className="md:hidden divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {sessions.slice(0, 20).map((s) => {
                const subj = subjectMap.get(s.subjectId);
                return (
                  <div
                    key={s.id}
                    className="p-4 flex items-center justify-between gap-3"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-sm font-medium truncate">{s.label}</div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <span>{subj?.name ?? 'General'}</span>
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        <span className="capitalize">{s.mode}</span>
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        <span className="font-mono-tabular">{s.date}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono-tabular text-xs font-semibold">
                        {formatMinutes(Math.round(s.durationSeconds / 60))}
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteSession(s.id)}
                        className="p-1.5 theme-control hover:opacity-80"
                        style={{ color: 'var(--text-secondary)' }}
                        aria-label="Delete session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (>= md) */}
            <div className="hidden md:block">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    className="border-b text-xs font-semibold"
                    style={{
                      backgroundColor: 'var(--bg-subtle)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <th className="px-4 py-2.5">Task / Label</th>
                    <th className="px-4 py-2.5">Subject & Mode</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5 text-right">Duration</th>
                    <th className="px-4 py-2.5 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.slice(0, 20).map((s) => {
                    const subj = subjectMap.get(s.subjectId);
                    return (
                      <tr
                        key={s.id}
                        className="border-b text-sm"
                        style={{ borderColor: 'var(--border-subtle)' }}
                      >
                        <td className="px-4 py-2.5 font-medium">{s.label}</td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <span>{subj?.name ?? 'General'}</span>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span className="capitalize">{s.mode}</span>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span>{s.loggedToSheet ? 'Synced to sheet' : 'History only'}</span>
                        </td>
                        <td className="px-4 py-2.5 font-mono-tabular text-xs">{s.date}</td>
                        <td className="px-4 py-2.5 text-right font-mono-tabular text-xs font-semibold">
                          {formatMinutes(Math.round(s.durationSeconds / 60))}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => onDeleteSession(s.id)}
                            className="p-1 theme-control hover:opacity-80"
                            style={{ color: 'var(--text-secondary)' }}
                            aria-label="Delete session"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
