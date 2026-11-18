import {
  Music2,
  Pause,
  Play,
  RefreshCw,
  Settings2,
  SkipBack,
  SkipForward,
  Volume2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ExamSettings, PearSongInfo } from '../types/planner';
import {
  isTauriRuntime,
  pearControl,
  pearGetSong,
  pearRequestAuth,
  pearSetVolume,
} from '../utils/desktop';

interface PearMusicCardProps {
  examSettings: ExamSettings;
  onUpdateExamSettings: (patch: Partial<ExamSettings>) => void;
}

function formatSec(sec?: number): string {
  if (typeof sec !== 'number' || Number.isNaN(sec) || sec < 0) return '0:00';
  const rounded = Math.floor(sec);
  const m = Math.floor(rounded / 60);
  const s = rounded % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function PearMusicCard({ examSettings, onUpdateExamSettings }: PearMusicCardProps) {
  const enabled = Boolean(examSettings.pearEnabled);
  const baseUrl = examSettings.pearBaseUrl || 'http://127.0.0.1:26538';
  const token = examSettings.pearToken || '';

  const [song, setSong] = useState<PearSongInfo | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(!enabled);
  const [volume, setVolume] = useState(70);
  const [busy, setBusy] = useState(false);

  const refreshSong = useCallback(async () => {
    if (!enabled) return;
    try {
      const info = await pearGetSong(baseUrl, token || undefined);
      setSong(info);
      setStatusError(null);
    } catch {
      setStatusError(
        isTauriRuntime()
          ? 'Could not reach Pear Desktop. Ensure API Server plugin is enabled on port 26538.'
          : 'Pear Desktop unreachable from browser preview (CORS or plugin disabled). Works natively in the Windows desktop app.',
      );
    }
  }, [enabled, baseUrl, token]);

  useEffect(() => {
    if (!enabled) {
      setSong(null);
      setStatusError(null);
      return;
    }
    void refreshSong();
    const id = window.setInterval(() => {
      void refreshSong();
    }, 3000);
    return () => window.clearInterval(id);
  }, [enabled, refreshSong]);

  const handleAction = async (action: 'toggle-play' | 'previous' | 'next') => {
    setBusy(true);
    try {
      await pearControl(baseUrl, action, token || undefined);
      setTimeout(() => {
        void refreshSong();
      }, 250);
    } catch {
      setStatusError('Action failed — check Pear Desktop API Server plugin.');
    } finally {
      setBusy(false);
    }
  };

  const handleRequestToken = async () => {
    setBusy(true);
    setStatusError(null);
    try {
      const newToken = await pearRequestAuth(baseUrl);
      onUpdateExamSettings({ pearToken: newToken, pearEnabled: true });
    } catch {
      setStatusError(
        'Could not obtain token. In Pear Desktop -> Plugins -> API Server, set Authorization to "No authorization" or click "Authorized peers".',
      );
    } finally {
      setBusy(false);
    }
  };

  const progressPct =
    song?.songDuration && song.songDuration > 0 && typeof song.elapsedSeconds === 'number'
      ? Math.min(100, Math.round((song.elapsedSeconds / song.songDuration) * 100))
      : 0;

  return (
    <div className="theme-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 theme-control flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            <Music2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold truncate">
              Pear Desktop (YouTube Music FOSS)
            </h3>
            <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
              {enabled
                ? song
                  ? `${song.title} · ${song.artist}`
                  : 'Connected to local API Server'
                : 'Control focus music & auto-pause when timer completes'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onUpdateExamSettings({ pearEnabled: !enabled })}
            className="px-3 py-1.5 text-xs font-semibold theme-control border whitespace-nowrap"
            style={{
              backgroundColor: enabled ? 'var(--accent)' : 'transparent',
              borderColor: enabled ? 'var(--accent)' : 'var(--border-subtle)',
              color: enabled ? 'var(--accent-fg)' : 'var(--text-primary)',
            }}
          >
            {enabled ? 'Enabled' : 'Enable Link'}
          </button>

          <button
            type="button"
            onClick={() => setShowSetup((v) => !v)}
            className="p-1.5 border theme-control hover:opacity-80"
            style={{
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
            aria-label="Pear Desktop settings"
            title="Pear Desktop settings"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {enabled && (
        <div
          className="p-3.5 border theme-control space-y-3"
          style={{
            backgroundColor: 'var(--bg-subtle)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {song?.imageSrc && (
                <img
                  src={song.imageSrc}
                  alt={song.title}
                  className="w-10 h-10 object-cover theme-control shrink-0 border"
                  style={{ borderColor: 'var(--border-subtle)' }}
                />
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">
                  {song?.title || 'No active track detected'}
                </div>
                <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                  {song?.artist || 'Start playing a study playlist in Pear Desktop'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleAction('previous')}
                className="p-2 border theme-control hover:opacity-80 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
                aria-label="Previous track"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleAction('toggle-play')}
                className="p-2 theme-control hover:opacity-90 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
                aria-label={song?.isPaused === false ? 'Pause music' : 'Play music'}
              >
                {song?.isPaused === false ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleAction('next')}
                className="p-2 border theme-control hover:opacity-80 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
                aria-label="Next track"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  void refreshSong();
                }}
                className="p-2 border theme-control hover:opacity-80"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
                aria-label="Refresh track info"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {song && typeof song.songDuration === 'number' && song.songDuration > 0 && (
            <div className="space-y-1">
              <div
                className="h-1.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: 'var(--border-subtle)' }}
              >
                <div
                  className="h-full transition-all duration-300"
                  style={{ width: `${progressPct}%`, backgroundColor: 'var(--accent)' }}
                />
              </div>
              <div
                className="flex justify-between font-mono-tabular text-[11px]"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span>{formatSec(song.elapsedSeconds)}</span>
                <span>{formatSec(song.songDuration)}</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2.5 pt-0.5">
            <Volume2 className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-secondary)' }} />
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              onMouseUp={() => {
                void pearSetVolume(baseUrl, volume, token || undefined);
              }}
              onTouchEnd={() => {
                void pearSetVolume(baseUrl, volume, token || undefined);
              }}
              className="flex-1 h-1.5 cursor-pointer"
              aria-label="Pear Desktop Volume"
            />
            <span
              className="font-mono-tabular text-[11px] w-8 text-right"
              style={{ color: 'var(--text-secondary)' }}
            >
              {volume}%
            </span>
          </div>

          {statusError && (
            <div className="text-xs" style={{ color: 'var(--color-wasting)' }}>
              {statusError}
            </div>
          )}
        </div>
      )}

      {showSetup && (
        <div
          className="pt-3 border-t space-y-3 text-xs"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div style={{ color: 'var(--text-secondary)' }}>
            In <strong>Pear Desktop</strong>: open <strong>Plugins</strong>, enable{' '}
            <strong>API Server</strong> (default port <code>26538</code>), and set Authorization to{' '}
            <strong>No authorization</strong> (or authorize below).
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                className="block text-[11px] font-medium mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                API Server URL
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => onUpdateExamSettings({ pearBaseUrl: e.target.value })}
                placeholder="http://127.0.0.1:26538"
                className="w-full px-2.5 py-1.5 text-xs font-mono-tabular border theme-control bg-transparent"
                style={{ borderColor: 'var(--border-subtle)' }}
              />
            </div>

            <div>
              <label
                className="block text-[11px] font-medium mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                Access Token (optional)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="password"
                  value={token}
                  onChange={(e) => onUpdateExamSettings({ pearToken: e.target.value })}
                  placeholder="Optional JWT"
                  className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono-tabular border theme-control bg-transparent"
                  style={{ borderColor: 'var(--border-subtle)' }}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleRequestToken}
                  className="px-2.5 py-1.5 text-xs font-medium border theme-control whitespace-nowrap shrink-0"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  Authorize
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={examSettings.pearAutoPauseOnFinish ?? true}
                onChange={(e) =>
                  onUpdateExamSettings({ pearAutoPauseOnFinish: e.target.checked })
                }
                className="w-3.5 h-3.5"
              />
              <span>Pause music when Focus Timer pauses / completes</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={examSettings.pearAutoResumeOnStart ?? false}
                onChange={(e) =>
                  onUpdateExamSettings({ pearAutoResumeOnStart: e.target.checked })
                }
                className="w-3.5 h-3.5"
              />
              <span>Resume music when Focus Timer starts</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
