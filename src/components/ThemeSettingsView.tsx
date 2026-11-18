import { Download, Plus, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import {
  ExamSettings,
  FontPairing,
  PlannerState,
  RadiusStyle,
  SubjectConfig,
  ThemeConfig,
} from '../types/planner';

interface ThemeSettingsViewProps {
  themes: ThemeConfig[];
  activeTheme: ThemeConfig;
  examSettings: ExamSettings;
  subjects: SubjectConfig[];
  fullState: PlannerState;
  onSelectTheme: (id: string) => void;
  onSaveCustomTheme: (theme: ThemeConfig) => void;
  onDeleteCustomTheme: (id: string) => void;
  onUpdateExamSettings: (patch: Partial<ExamSettings>) => void;
  onAddSubject: (subj: Omit<SubjectConfig, 'id'>) => void;
  onDeleteSubject: (id: string) => void;
  onImportState: (next: PlannerState) => void;
  onResetAll: () => void;
  onClearLogs: () => void;
}

export function ThemeSettingsView({
  themes,
  activeTheme,
  examSettings,
  subjects,
  fullState,
  onSelectTheme,
  onSaveCustomTheme,
  onDeleteCustomTheme,
  onUpdateExamSettings,
  onAddSubject,
  onDeleteSubject,
  onImportState,
  onResetAll,
  onClearLogs,
}: ThemeSettingsViewProps) {
  const [draftName, setDraftName] = useState(`${activeTheme.name} Custom`);
  const [draftIsDark, setDraftIsDark] = useState(activeTheme.isDark);
  const [draftColors, setDraftColors] = useState({ ...activeTheme.colors });
  const [draftFont, setDraftFont] = useState<FontPairing>(activeTheme.fontPairing);
  const [draftRadius, setDraftRadius] = useState<RadiusStyle>(activeTheme.radiusStyle);

  const [newSubjName, setNewSubjName] = useState('');
  const [newSubjCode, setNewSubjCode] = useState('');
  const [newSubjColor, setNewSubjColor] = useState('#0f766e');

  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'reset' | 'clear' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadThemeIntoBuilder = (t: ThemeConfig) => {
    onSelectTheme(t.id);
    setDraftName(t.isBuiltIn ? `${t.name} Custom` : t.name);
    setDraftIsDark(t.isDark);
    setDraftColors({ ...t.colors });
    setDraftFont(t.fontPairing);
    setDraftRadius(t.radiusStyle);
  };

  const handleSaveTheme = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftName.trim()) return;
    const customTheme: ThemeConfig = {
      id: `custom-${Date.now().toString(36)}`,
      name: draftName.trim(),
      isDark: draftIsDark,
      isBuiltIn: false,
      colors: { ...draftColors },
      fontPairing: draftFont,
      radiusStyle: draftRadius,
    };
    onSaveCustomTheme(customTheme);
    setFeedback(`Theme "${customTheme.name}" saved and activated.`);
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleAddSubjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjName.trim()) return;
    onAddSubject({
      name: newSubjName.trim(),
      shortCode: (newSubjCode.trim() || newSubjName.trim().slice(0, 4)).toUpperCase(),
      color: newSubjColor,
    });
    setNewSubjName('');
    setNewSubjCode('');
  };

  const handleExportBackup = () => {
    const blob = new Blob([JSON.stringify(fullState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ghost-plan-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as PlannerState;
        if (parsed && parsed.days && parsed.examSettings) {
          onImportState(parsed);
          setFeedback('Backup imported successfully.');
        } else {
          setFeedback('Invalid backup file format.');
        }
      } catch {
        setFeedback('Could not read JSON backup file.');
      }
      setTimeout(() => setFeedback(null), 3500);
    };
    reader.readAsText(file);
  };

  const colorFields: { key: keyof ThemeConfig['colors']; label: string }[] = [
    { key: 'canvas', label: 'Canvas Background' },
    { key: 'surface', label: 'Card Surface' },
    { key: 'subtle', label: 'Subtle Row / Header' },
    { key: 'border', label: 'Border Hairline' },
    { key: 'textPrimary', label: 'Primary Text' },
    { key: 'textSecondary', label: 'Secondary Text' },
    { key: 'accent', label: 'Primary Accent' },
    { key: 'accentFg', label: 'Accent Button Text' },
    { key: 'usingBlock', label: 'Using Time Color' },
    { key: 'classBlock', label: 'Class / School Color' },
    { key: 'wastingBlock', label: 'Wasting Time Color' },
    { key: 'sleepBlock', label: 'Sleep Color' },
    { key: 'onlineBlock', label: 'Online Color' },
  ];

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className="px-4 py-2.5 border theme-control text-xs font-semibold"
          style={{
            backgroundColor: 'var(--accent-soft)',
            borderColor: 'var(--accent)',
            color: 'var(--accent)',
          }}
        >
          {feedback}
        </div>
      )}

      {/* Theme Presets Gallery */}
      <div className="theme-card p-5 space-y-4">
        <div>
          <h2 className="font-display text-base font-semibold">Theme Library</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Switch instantly between built-in themes or load one into the custom theme builder
            below.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {themes.map((t) => {
            const isActive = t.id === activeTheme.id;
            return (
              <div
                key={t.id}
                className="p-3.5 border theme-control flex items-center justify-between gap-3"
                style={{
                  backgroundColor: t.colors.surface,
                  borderColor: isActive ? t.colors.accent : 'var(--border-subtle)',
                  color: t.colors.textPrimary,
                }}
              >
                <button
                  type="button"
                  onClick={() => loadThemeIntoBuilder(t)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="text-sm font-semibold truncate">{t.name}</div>
                  <div className="flex items-center gap-1.5 mt-2">
                    {[
                      t.colors.canvas,
                      t.colors.accent,
                      t.colors.usingBlock,
                      t.colors.wastingBlock,
                      t.colors.sleepBlock,
                    ].map((hex, i) => (
                      <span
                        key={i}
                        className="w-4 h-4 rounded-xs border"
                        style={{ backgroundColor: hex, borderColor: 'rgba(128,128,128,0.25)' }}
                      />
                    ))}
                    <span className="text-[11px] ml-1" style={{ color: t.colors.textSecondary }}>
                      {t.isDark ? 'Dark' : 'Light'}
                    </span>
                  </div>
                </button>
                {!t.isBuiltIn && (
                  <button
                    type="button"
                    onClick={() => onDeleteCustomTheme(t.id)}
                    className="p-1.5 theme-control hover:opacity-80"
                    style={{ color: t.colors.textSecondary }}
                    aria-label={`Delete ${t.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Theme Builder */}
      <form onSubmit={handleSaveTheme} className="theme-card p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold">Custom Theme Builder</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Customize every canvas color, ledger column color, font pairing, and corner style.
            </p>
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold theme-control whitespace-nowrap"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            Save & Apply Custom Theme
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Theme Name
            </label>
            <input
              type="text"
              required
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="w-full px-3 py-2 text-sm border theme-control bg-transparent"
              style={{ borderColor: 'var(--border-subtle)' }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Brightness Mode
            </label>
            <select
              value={draftIsDark ? 'dark' : 'light'}
              onChange={(e) => setDraftIsDark(e.target.value === 'dark')}
              className="w-full px-3 py-2 text-sm border theme-control"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="light">Light Mode</option>
              <option value="dark">Dark Mode</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Typography Pairing
            </label>
            <select
              value={draftFont}
              onChange={(e) => setDraftFont(e.target.value as FontPairing)}
              className="w-full px-3 py-2 text-sm border theme-control"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="outfit-jakarta">Outfit + Plus Jakarta + JetBrains Mono</option>
              <option value="jakarta-ibm">Plus Jakarta + IBM Plex Mono</option>
              <option value="dm-space">DM Sans + Space Mono</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Corner Style
            </label>
            <select
              value={draftRadius}
              onChange={(e) => setDraftRadius(e.target.value as RadiusStyle)}
              className="w-full px-3 py-2 text-sm border theme-control"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="sharp">Sharp Ledger (4px)</option>
              <option value="balanced">Balanced (10px)</option>
              <option value="soft">Soft Rounded (16px)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
          {colorFields.map(({ key, label }) => (
            <div
              key={key}
              className="p-2.5 border theme-control flex items-center justify-between gap-2"
              style={{
                borderColor: 'var(--border-subtle)',
                backgroundColor: 'var(--bg-subtle)',
              }}
            >
              <div className="min-w-0">
                <div className="text-xs font-medium truncate">{label}</div>
                <div
                  className="font-mono-tabular text-[11px]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {draftColors[key]}
                </div>
              </div>
              <input
                type="color"
                value={draftColors[key]}
                onChange={(e) =>
                  setDraftColors((prev) => ({
                    ...prev,
                    [key]: e.target.value,
                  }))
                }
                className="w-8 h-8 cursor-pointer border-0 bg-transparent p-0 shrink-0"
                aria-label={label}
              />
            </div>
          ))}
        </div>
      </form>

      {/* A/L Exam Settings & Subjects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="theme-card p-5 space-y-4">
          <h2 className="font-display text-base font-semibold">A/L Exam & Countdown Setup</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Stream / Plan Subtitle
              </label>
              <input
                type="text"
                value={examSettings.streamLabel}
                onChange={(e) => onUpdateExamSettings({ streamLabel: e.target.value })}
                className="w-full px-3 py-2 text-sm border theme-control bg-transparent"
                style={{ borderColor: 'var(--border-subtle)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Daily Study Goal (Hours)
              </label>
              <input
                type="number"
                min={1}
                max={18}
                step={0.5}
                value={examSettings.dailyTargetMinutes / 60}
                onChange={(e) =>
                  onUpdateExamSettings({
                    dailyTargetMinutes: Math.max(60, Math.round(Number(e.target.value) * 60)),
                  })
                }
                className="w-full px-3 py-2 text-sm font-mono-tabular border theme-control bg-transparent"
                style={{ borderColor: 'var(--border-subtle)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Plan Start Date (Day 1)
              </label>
              <input
                type="date"
                value={examSettings.planStartDate}
                onChange={(e) => onUpdateExamSettings({ planStartDate: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono-tabular border theme-control bg-transparent"
                style={{ borderColor: 'var(--border-subtle)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                A/L Exam Target Date
              </label>
              <input
                type="date"
                value={examSettings.examDate}
                onChange={(e) => onUpdateExamSettings({ examDate: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono-tabular border theme-control bg-transparent"
                style={{ borderColor: 'var(--border-subtle)' }}
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-xs pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={examSettings.soundEnabled}
              onChange={(e) => onUpdateExamSettings({ soundEnabled: e.target.checked })}
              className="w-4 h-4"
            />
            <span>Play chime sound when Focus Timer completes</span>
          </label>
        </div>

        {/* Subjects Manager */}
        <div className="theme-card p-5 space-y-4">
          <h2 className="font-display text-base font-semibold">A/L Subjects</h2>
          <div className="space-y-2">
            {subjects.map((subj) => (
              <div
                key={subj.id}
                className="px-3 py-2 border theme-control flex items-center justify-between gap-2 text-sm"
                style={{
                  borderColor: 'var(--border-subtle)',
                  backgroundColor: 'var(--bg-subtle)',
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-3 h-3 rounded-xs shrink-0"
                    style={{ backgroundColor: subj.color }}
                  />
                  <span className="font-medium truncate">{subj.name}</span>
                  <span
                    className="font-mono-tabular text-xs"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {subj.shortCode}
                  </span>
                </div>
                {subjects.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDeleteSubject(subj.id)}
                    className="p-1 theme-control hover:opacity-80"
                    style={{ color: 'var(--text-secondary)' }}
                    aria-label={`Remove ${subj.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleAddSubjectSubmit} className="flex flex-wrap items-center gap-2 pt-1">
            <input
              type="text"
              value={newSubjName}
              onChange={(e) => setNewSubjName(e.target.value)}
              placeholder="New subject (e.g., Biology)"
              className="flex-1 min-w-[140px] px-3 py-1.5 text-xs border theme-control bg-transparent"
              style={{ borderColor: 'var(--border-subtle)' }}
            />
            <input
              type="text"
              maxLength={5}
              value={newSubjCode}
              onChange={(e) => setNewSubjCode(e.target.value)}
              placeholder="Code"
              className="w-20 px-2.5 py-1.5 text-xs font-mono-tabular border theme-control bg-transparent"
              style={{ borderColor: 'var(--border-subtle)' }}
            />
            <input
              type="color"
              value={newSubjColor}
              onChange={(e) => setNewSubjColor(e.target.value)}
              className="w-8 h-8 cursor-pointer border-0 bg-transparent p-0"
              aria-label="Subject color"
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-semibold theme-control flex items-center gap-1 whitespace-nowrap"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>
        </div>
      </div>

      {/* Data Backup & Reset */}
      <div className="theme-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-semibold">Backup & Data Control</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Export your 9-month logs, deadlines, and custom themes as JSON anytime.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportBackup}
            className="px-3 py-2 text-xs font-medium border theme-control flex items-center gap-1.5 whitespace-nowrap"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 text-xs font-medium border theme-control flex items-center gap-1.5 whitespace-nowrap"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import JSON</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleImportFile}
            className="hidden"
          />

          {confirmAction === null ? (
            <>
              <button
                type="button"
                onClick={() => setConfirmAction('clear')}
                className="px-3 py-2 text-xs font-medium border theme-control whitespace-nowrap"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
              >
                Clear Sample Logs
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction('reset')}
                className="px-3 py-2 text-xs font-medium border theme-control whitespace-nowrap"
                style={{ borderColor: 'var(--color-wasting)', color: 'var(--color-wasting)' }}
              >
                Reset All
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (confirmAction === 'clear') {
                    onClearLogs();
                    setFeedback('Cleared all logged hours and sessions.');
                  } else {
                    onResetAll();
                    setFeedback('Restored default sample data.');
                  }
                  setConfirmAction(null);
                  setTimeout(() => setFeedback(null), 3500);
                }}
                className="px-3 py-2 text-xs font-semibold theme-control whitespace-nowrap"
                style={{ backgroundColor: 'var(--color-wasting)', color: '#ffffff' }}
              >
                Confirm {confirmAction === 'clear' ? 'Clear Logs' : 'Full Reset'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-3 py-2 text-xs border theme-control whitespace-nowrap"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
