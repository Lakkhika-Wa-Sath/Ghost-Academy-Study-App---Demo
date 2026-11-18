import { CheckCircle2, Maximize2, Pause, Play, RotateCcw, X } from 'lucide-react';
import { ActiveTimerState, SessionCategory, SubjectConfig } from '../types/planner';
import { formatClockMs } from '../utils/time';

interface MiniTimerWindowProps {
  isNativeWindow: boolean;
  timer: ActiveTimerState;
  elapsedMs: number;
  subjects: SubjectConfig[];
  onTogglePlayPause: () => void;
  onReset: () => void;
  onFinishAndLog: (params: {
    durationSeconds: number;
    mode: 'stopwatch' | 'timer';
    category: SessionCategory;
    subjectId: string;
    label: string;
    applyToSheet: boolean;
  }) => void;
  onFocusMain: () => void;
  onCloseMini: () => void;
}

export function MiniTimerWindow({
  isNativeWindow,
  timer,
  elapsedMs,
  subjects,
  onTogglePlayPause,
  onReset,
  onFinishAndLog,
  onFocusMain,
  onCloseMini,
}: MiniTimerWindowProps) {
  const subject = subjects.find((s) => s.id === timer.subjectId);
  const targetMs = timer.targetMinutes * 60_000;
  const remainingMs = Math.max(0, targetMs - elapsedMs);
  const displayMs = timer.mode === 'timer' ? remainingMs : elapsedMs;
  const progressPct =
    timer.mode === 'timer' && targetMs > 0
      ? Math.min(100, Math.round((elapsedMs / targetMs) * 100))
      : 0;
  const canLog = elapsedMs >= 10_000;

  const handleLog = () => {
    const durationSeconds = Math.floor(elapsedMs / 1000);
    if (durationSeconds < 10) return;
    onFinishAndLog({
      durationSeconds,
      mode: timer.mode,
      category: timer.category,
      subjectId: timer.subjectId,
      label: timer.label || 'Focus Session',
      applyToSheet: true,
    });
    onReset();
  };

  return (
    <div
      className={
        isNativeWindow
          ? 'h-screen w-screen flex flex-col justify-between p-3 select-none overflow-hidden border'
          : 'fixed bottom-20 lg:bottom-5 right-4 z-50 w-[300px] flex flex-col justify-between p-3 select-none border shadow-xl theme-control'
      }
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Drag Strip & Window Actions */}
      <div
        className="flex items-center justify-between gap-2 pb-1.5 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
        {...(isNativeWindow ? { 'data-tauri-drag-region': true } : {})}
      >
        <div
          className="flex items-center gap-1.5 min-w-0 text-xs font-medium"
          {...(isNativeWindow ? { 'data-tauri-drag-region': true } : {})}
        >
          {subject && (
            <span
              className="w-2 h-2 rounded-xs shrink-0"
              style={{ backgroundColor: subject.color }}
            />
          )}
          <span className="truncate font-semibold">{subject?.name ?? 'Study'}</span>
          <span style={{ color: 'var(--text-secondary)' }} aria-hidden="true">
            ·
          </span>
          <span className="shrink-0 capitalize" style={{ color: 'var(--text-secondary)' }}>
            {timer.mode}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isNativeWindow && (
            <button
              type="button"
              onClick={onFocusMain}
              className="p-1 theme-control hover:opacity-80"
              style={{ color: 'var(--text-secondary)' }}
              title="Open main window"
              aria-label="Open main window"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onCloseMini}
            className="p-1 theme-control hover:opacity-80"
            style={{ color: 'var(--text-secondary)' }}
            title="Close mini timer"
            aria-label="Close mini timer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Clock + Controls Row */}
      <div className="flex items-center justify-between gap-3 py-2">
        <div className="min-w-0">
          <div className="font-mono-tabular text-2xl font-bold tracking-tight leading-none">
            {formatClockMs(displayMs)}
          </div>
          {timer.label && (
            <div
              className="text-[11px] truncate mt-1 max-w-[155px]"
              style={{ color: 'var(--text-secondary)' }}
            >
              {timer.label}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onTogglePlayPause}
            className="p-2 theme-control whitespace-nowrap shrink-0"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
            title={timer.status === 'running' ? 'Pause' : 'Start / Resume'}
            aria-label={timer.status === 'running' ? 'Pause' : 'Start or Resume'}
          >
            {timer.status === 'running' ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            disabled={!canLog}
            onClick={handleLog}
            className="p-2 border theme-control whitespace-nowrap shrink-0 disabled:opacity-35"
            style={{
              borderColor: 'var(--color-using)',
              color: 'var(--color-using)',
            }}
            title="Finish & Log to Today's Plan"
            aria-label="Finish and log session"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onReset}
            className="p-2 border theme-control whitespace-nowrap shrink-0"
            style={{
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
            title="Reset"
            aria-label="Reset timer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Thin Progress / Status Footer */}
      {timer.mode === 'timer' ? (
        <div
          className="h-1 w-full overflow-hidden rounded-full"
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
      ) : (
        <div
          className="text-[10px] font-mono-tabular flex justify-between"
          style={{ color: 'var(--text-secondary)' }}
        >
          <span>{timer.status === 'running' ? 'Counting up' : timer.status}</span>
          <span>{Math.floor(elapsedMs / 900_000)} × 15m blocks</span>
        </div>
      )}
    </div>
  );
}
