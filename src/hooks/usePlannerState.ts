import { useCallback, useEffect, useState } from 'react';
import { BUILTIN_THEMES, createEmptyDayPlan, createSeedState } from '../data/defaults';
import {
  ActiveTimerState,
  DayPlan,
  Deadline,
  ExamSettings,
  HourRow,
  MinutesStep,
  PlannerState,
  SessionCategory,
  StudySession,
  SubjectConfig,
  ThemeConfig,
} from '../types/planner';
import { applyThemeToDocument } from '../utils/theme';
import { toLocalDateString } from '../utils/time';

const STORAGE_KEY = 'ghost-plan-al-state-v1';

function loadInitialState(): PlannerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedState();
    const parsed = JSON.parse(raw) as Partial<PlannerState>;
    const seed = createSeedState();

    // Ensure built-in themes are always present & merged cleanly with custom themes
    const customThemes = (parsed.themes || []).filter((t) => !t.isBuiltIn);
    const mergedThemes = [...BUILTIN_THEMES, ...customThemes];
    const activeThemeExists = mergedThemes.some((t) => t.id === parsed.activeThemeId);

    return {
      days: parsed.days && typeof parsed.days === 'object' ? parsed.days : seed.days,
      deadlines: Array.isArray(parsed.deadlines) ? parsed.deadlines : seed.deadlines,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : seed.sessions,
      subjects: Array.isArray(parsed.subjects) && parsed.subjects.length > 0 ? parsed.subjects : seed.subjects,
      themes: mergedThemes,
      activeThemeId: activeThemeExists && parsed.activeThemeId ? parsed.activeThemeId : seed.activeThemeId,
      examSettings: parsed.examSettings ? { ...seed.examSettings, ...parsed.examSettings } : seed.examSettings,
      timer: parsed.timer ? { ...seed.timer, ...parsed.timer } : seed.timer,
    };
  } catch {
    return createSeedState();
  }
}

export function usePlannerState() {
  const [state, setState] = useState<PlannerState>(() => loadInitialState());

  const activeTheme =
    state.themes.find((t) => t.id === state.activeThemeId) ?? state.themes[0] ?? BUILTIN_THEMES[0];

  useEffect(() => {
    applyThemeToDocument(activeTheme);
  }, [activeTheme]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  const updateDayHour = useCallback(
    (date: string, hour: number, updater: (row: HourRow) => HourRow) => {
      setState((prev) => {
        const existing = prev.days[date] ?? createEmptyDayPlan(date);
        const nextHours = existing.hours.map((row) => (row.hour === hour ? updater(row) : row));
        return {
          ...prev,
          days: {
            ...prev.days,
            [date]: {
              ...existing,
              hours: nextHours,
            },
          },
        };
      });
    },
    [],
  );

  const clearDayPlan = useCallback((date: string) => {
    setState((prev) => ({
      ...prev,
      days: {
        ...prev.days,
        [date]: createEmptyDayPlan(date),
      },
    }));
  }, []);

  const updateDayReflection = useCallback((date: string, reflection: string) => {
    setState((prev) => {
      const existing = prev.days[date] ?? createEmptyDayPlan(date);
      return {
        ...prev,
        days: {
          ...prev.days,
          [date]: { ...existing, reflection },
        },
      };
    });
  }, []);

  const addDeadline = useCallback((deadline: Omit<Deadline, 'id'>) => {
    const newItem: Deadline = {
      ...deadline,
      id: `dl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    setState((prev) => ({
      ...prev,
      deadlines: [...prev.deadlines, newItem],
    }));
  }, []);

  const updateDeadline = useCallback((id: string, patch: Partial<Deadline>) => {
    setState((prev) => ({
      ...prev,
      deadlines: prev.deadlines.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  }, []);

  const deleteDeadline = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      deadlines: prev.deadlines.filter((d) => d.id !== id),
    }));
  }, []);

  const updateTimer = useCallback((updater: (t: ActiveTimerState) => ActiveTimerState) => {
    setState((prev) => ({
      ...prev,
      timer: updater(prev.timer),
    }));
  }, []);

  const logSessionToSheet = useCallback(
    (params: {
      durationSeconds: number;
      mode: 'stopwatch' | 'timer';
      category: SessionCategory;
      subjectId: string;
      label: string;
      applyToSheet: boolean;
    }) => {
      const today = toLocalDateString(new Date());
      const now = new Date();
      const currentHour = now.getHours();

      const session: StudySession = {
        id: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: today,
        endedAt: Date.now(),
        durationSeconds: params.durationSeconds,
        mode: params.mode,
        category: params.category,
        subjectId: params.subjectId,
        label: params.label || 'Focus Session',
        loggedToSheet: params.applyToSheet,
      };

      setState((prev) => {
        let nextDays = prev.days;

        if (params.applyToSheet && params.durationSeconds >= 60) {
          const existingDay: DayPlan = prev.days[today] ?? createEmptyDayPlan(today);
          const hoursCopy = existingDay.hours.map((r) => ({
            ...r,
            blocks: [...r.blocks] as [string | null, string | null, string | null, string | null],
          }));

          // Convert seconds into 15-minute blocks (minimum 1 block if >= 5 minutes, else rounded to nearest 15m)
          const totalBlocks = Math.max(1, Math.round(params.durationSeconds / 900));
          let remaining = totalBlocks;

          // Distribute backward from currentHour, or forward if near midnight
          const hourOrder: number[] = [];
          for (let h = currentHour; h >= 0; h--) hourOrder.push(h);
          for (let h = currentHour + 1; h < 24; h++) hourOrder.push(h);

          if (params.category === 'self-study') {
            for (const h of hourOrder) {
              if (remaining <= 0) break;
              const row = hoursCopy[h];
              let changed = false;
              for (let b = 0; b < 4 && remaining > 0; b++) {
                if (!row.blocks[b]) {
                  row.blocks[b] = params.subjectId;
                  remaining--;
                  changed = true;
                }
              }
              if (changed && !row.note && params.label) {
                row.note = params.label;
              }
            }
          } else if (params.category === 'class') {
            for (const h of hourOrder) {
              if (remaining <= 0) break;
              const row = hoursCopy[h];
              const availableSteps = Math.floor((60 - row.classMinutes) / 15);
              if (availableSteps > 0) {
                const take = Math.min(availableSteps, remaining);
                row.classMinutes = Math.min(60, row.classMinutes + take * 15) as MinutesStep;
                remaining -= take;
                if (!row.note && params.label) {
                  row.note = params.label;
                }
              }
            }
          } else if (params.category === 'online') {
            for (const h of hourOrder) {
              if (remaining <= 0) break;
              const row = hoursCopy[h];
              const availableSteps = Math.floor((60 - row.onlineMinutes) / 15);
              if (availableSteps > 0) {
                const take = Math.min(availableSteps, remaining);
                row.onlineMinutes = Math.min(60, row.onlineMinutes + take * 15) as MinutesStep;
                remaining -= take;
                if (!row.note && params.label) {
                  row.note = params.label;
                }
              }
            }
          }

          nextDays = {
            ...prev.days,
            [today]: {
              ...existingDay,
              hours: hoursCopy,
            },
          };
        }

        return {
          ...prev,
          days: nextDays,
          sessions: [session, ...prev.sessions],
        };
      });
    },
    [],
  );

  const deleteSession = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      sessions: prev.sessions.filter((s) => s.id !== id),
    }));
  }, []);

  const setActiveTheme = useCallback((themeId: string) => {
    setState((prev) => ({ ...prev, activeThemeId: themeId }));
  }, []);

  const saveCustomTheme = useCallback((theme: ThemeConfig) => {
    setState((prev) => {
      const exists = prev.themes.some((t) => t.id === theme.id);
      const nextThemes = exists
        ? prev.themes.map((t) => (t.id === theme.id ? theme : t))
        : [...prev.themes, theme];
      return {
        ...prev,
        themes: nextThemes,
        activeThemeId: theme.id,
      };
    });
  }, []);

  const deleteCustomTheme = useCallback((themeId: string) => {
    setState((prev) => {
      const target = prev.themes.find((t) => t.id === themeId);
      if (!target || target.isBuiltIn) return prev;
      const nextThemes = prev.themes.filter((t) => t.id !== themeId);
      const nextActive = prev.activeThemeId === themeId ? BUILTIN_THEMES[0].id : prev.activeThemeId;
      return {
        ...prev,
        themes: nextThemes,
        activeThemeId: nextActive,
      };
    });
  }, []);

  const updateExamSettings = useCallback((patch: Partial<ExamSettings>) => {
    setState((prev) => ({
      ...prev,
      examSettings: { ...prev.examSettings, ...patch },
    }));
  }, []);

  const addSubject = useCallback((subject: Omit<SubjectConfig, 'id'>) => {
    const newSubj: SubjectConfig = {
      ...subject,
      id: `subj-${Date.now().toString(36)}`,
    };
    setState((prev) => ({
      ...prev,
      subjects: [...prev.subjects, newSubj],
    }));
  }, []);

  const updateSubject = useCallback((id: string, patch: Partial<SubjectConfig>) => {
    setState((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }, []);

  const deleteSubject = useCallback((id: string) => {
    setState((prev) => {
      if (prev.subjects.length <= 1) return prev;
      return {
        ...prev,
        subjects: prev.subjects.filter((s) => s.id !== id),
      };
    });
  }, []);

  const importState = useCallback((next: PlannerState) => {
    const customThemes = (next.themes || []).filter((t) => !t.isBuiltIn);
    const mergedThemes = [...BUILTIN_THEMES, ...customThemes];
    setState({
      ...next,
      themes: mergedThemes,
    });
  }, []);

  const resetAllData = useCallback(() => {
    const fresh = createSeedState();
    setState(fresh);
  }, []);

  const clearSampleStudyLogs = useCallback(() => {
    setState((prev) => ({
      ...prev,
      days: {},
      sessions: [],
    }));
  }, []);

  return {
    state,
    activeTheme,
    updateDayHour,
    clearDayPlan,
    updateDayReflection,
    addDeadline,
    updateDeadline,
    deleteDeadline,
    updateTimer,
    logSessionToSheet,
    deleteSession,
    setActiveTheme,
    saveCustomTheme,
    deleteCustomTheme,
    updateExamSettings,
    addSubject,
    updateSubject,
    deleteSubject,
    importState,
    resetAllData,
    clearSampleStudyLogs,
  };
}
