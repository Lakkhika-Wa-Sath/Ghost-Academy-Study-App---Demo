import { Check, Copy, Download, Github, MonitorDown, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PlannerState } from '../types/planner';

interface WindowsInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isInIframe: boolean;
  onInstallPWA: () => Promise<boolean>;
  fullState: PlannerState;
}

export function WindowsInstallModal({
  isOpen,
  onClose,
  isInstallable,
  isInstalled,
  isIOS,
  isInIframe,
  onInstallPWA,
  fullState,
}: WindowsInstallModalProps) {
  const [activePath, setActivePath] = useState<'browser' | 'github'>('browser');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [installFeedback, setInstallFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const handleTriggerInstall = async () => {
    const accepted = await onInstallPWA();
    if (accepted) {
      setInstallFeedback('Ghost Plan is being installed to your Windows Start Menu and Taskbar.');
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      // Ignore clipboard permission denials
    }
  };

  const handleExportBackup = () => {
    const blob = new Blob([JSON.stringify(fullState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ghost-plan-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setInstallFeedback('Study backup JSON downloaded — import it inside your native .exe anytime.');
    setTimeout(() => setInstallFeedback(null), 4000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55"
      role="dialog"
      aria-modal="true"
      aria-labelledby="windows-install-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-xl border theme-control shadow-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 border-b flex items-center justify-between gap-3"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="min-w-0">
            <h2
              id="windows-install-modal-title"
              className="font-display text-base font-bold truncate"
            >
              Install Ghost Plan on Windows
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Pin as a standalone desktop app immediately or compile the native Rust .exe on GitHub.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 theme-control hover:opacity-80 shrink-0"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Close installation guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Segmented Path Switcher */}
        <div className="px-5 pt-4">
          <div
            className="grid grid-cols-2 p-1 border theme-control gap-1"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              borderColor: 'var(--border-subtle)',
            }}
            role="tablist"
            aria-label="Windows Installation Methods"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activePath === 'browser'}
              onClick={() => setActivePath('browser')}
              className="px-3 py-2 text-xs font-semibold theme-control transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
              style={{
                backgroundColor: activePath === 'browser' ? 'var(--bg-surface)' : 'transparent',
                color: activePath === 'browser' ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              <MonitorDown className="w-3.5 h-3.5 shrink-0" />
              <span>Instant Windows App</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activePath === 'github'}
              onClick={() => setActivePath('github')}
              className="px-3 py-2 text-xs font-semibold theme-control transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
              style={{
                backgroundColor: activePath === 'github' ? 'var(--bg-surface)' : 'transparent',
                color: activePath === 'github' ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              <Github className="w-3.5 h-3.5 shrink-0" />
              <span>Native .exe via GitHub</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs leading-relaxed">
          {installFeedback && (
            <div
              className="px-3.5 py-2.5 border theme-control font-medium"
              style={{
                backgroundColor: 'var(--accent-soft)',
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
              }}
            >
              {installFeedback}
            </div>
          )}

          {activePath === 'browser' ? (
            <div className="space-y-4">
              <div
                className="p-4 border theme-control space-y-2"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="font-semibold text-sm">
                  {isInstalled
                    ? 'Already running as an installed app'
                    : 'Zero-Setup Start Menu & Taskbar App'}
                </div>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Installs in 2 clicks using Microsoft Edge or Google Chrome with offline caching,
                  its own Windows taskbar icon, and full local storage.
                </p>

                {isInstallable && !isInstalled && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        void handleTriggerInstall();
                      }}
                      className="px-4 py-2 text-xs font-semibold theme-control inline-flex items-center gap-2 whitespace-nowrap"
                      style={{
                        backgroundColor: 'var(--accent)',
                        color: 'var(--accent-fg)',
                      }}
                    >
                      <MonitorDown className="w-4 h-4" />
                      <span>Install Ghost Plan Now</span>
                    </button>
                  </div>
                )}
              </div>

              {!isInstallable && !isInstalled && (
                <div className="space-y-2.5">
                  <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {isIOS ? 'iPhone / iPad Steps:' : 'How to install from Edge or Chrome:'}
                  </div>
                  {isIOS ? (
                    <ol
                      className="list-decimal pl-4 space-y-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <li>Open Ghost Plan in Safari outside the preview frame.</li>
                      <li>Tap the Share button in the bottom or top toolbar.</li>
                      <li>Scroll down and tap Add to Home Screen.</li>
                    </ol>
                  ) : (
                    <ol
                      className="list-decimal pl-4 space-y-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {isInIframe && (
                        <li>
                          Open the standalone Shared App URL in its own Microsoft Edge or Chrome
                          browser tab (browser install prompts are disabled inside embedded iframes).
                        </li>
                      )}
                      <li>
                        In <strong>Microsoft Edge</strong>: click the <strong>···</strong> menu
                        → <strong>Apps</strong> → <strong>Install this site as an app</strong>.
                      </li>
                      <li>
                        In <strong>Google Chrome</strong>: click the <strong>Install</strong> icon
                        on the right of the address bar (or <strong>⋮ → Cast, save, and share → Install page as app</strong>).
                      </li>
                      <li>
                        Pin Ghost Plan to your <strong>Windows Taskbar</strong> or{' '}
                        <strong>Start Menu</strong> so it opens in its own dedicated window.
                      </li>
                    </ol>
                  )}

                  {currentUrl && (
                    <div
                      className="mt-2 p-2.5 border theme-control flex items-center justify-between gap-2"
                      style={{
                        backgroundColor: 'var(--bg-subtle)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      <span
                        className="font-mono-tabular text-[11px] truncate"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {currentUrl}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          void handleCopyUrl();
                        }}
                        className="px-2.5 py-1 border theme-control inline-flex items-center gap-1 whitespace-nowrap shrink-0 font-medium"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-subtle)',
                        }}
                      >
                        {copiedUrl ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy URL</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div
                className="p-4 border theme-control space-y-1.5"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="font-semibold text-sm">
                  Build Native Rust + SQLite .exe on GitHub (No Local Tools Needed)
                </div>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Unlocks local SQLite file storage, Windows System Tray timer controls, native
                  toast alerts, always-on-top Mini Timer, and CORS-free Pear Desktop control.
                </p>
              </div>

              <ol
                className="list-decimal pl-4 space-y-2"
                style={{ color: 'var(--text-secondary)' }}
              >
                <li>
                  <strong>Export Project</strong>: Download the Ghost Plan workspace ZIP from AI
                  Studio and unzip it on your computer.
                </li>
                <li>
                  <strong>Upload to GitHub</strong>: Create a new repository on GitHub and push (or
                  upload) the unzipped files, keeping the{' '}
                  <code className="font-mono-tabular">.github/workflows</code> and{' '}
                  <code className="font-mono-tabular">src-tauri</code> folders intact.
                </li>
                <li>
                  <strong>Run Cloud Build</strong>: Open your GitHub repository →{' '}
                  <strong>Actions</strong> tab → select{' '}
                  <strong>Build Windows Executable</strong> → click <strong>Run workflow</strong>.
                </li>
                <li>
                  <strong>Install .exe</strong>: After ~5 minutes, download the{' '}
                  <strong>Ghost-Plan-Windows-Installer</strong> artifact zip and double-click{' '}
                  <code className="font-mono-tabular">Ghost Plan_1.0.0_x64-setup.exe</code>.
                </li>
              </ol>

              <div
                className="pt-3 border-t flex flex-wrap items-center justify-between gap-3"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>
                  Moving from browser to .exe? Export your study logs first:
                </span>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="px-3 py-1.5 border theme-control inline-flex items-center gap-1.5 font-semibold whitespace-nowrap shrink-0"
                  style={{
                    borderColor: 'var(--accent)',
                    color: 'var(--accent)',
                  }}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Backup (.json)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 border-t flex justify-end"
          style={{
            backgroundColor: 'var(--bg-subtle)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium border theme-control whitespace-nowrap"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
