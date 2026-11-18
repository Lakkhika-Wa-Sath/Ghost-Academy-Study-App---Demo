import { useCallback, useEffect, useRef, useState } from 'react';
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
import {
  clearDayPlanInDb,
  importPlannerStateToDb,
  isTauriRuntime,
  loadPlannerStateFromDb,
  logStudySessionToDb,
  removeCustomThemeFromDb,
  removeDeadlineFromDb,
  removeStudySessionFromDb,
  removeSubjectFromDb,
  saveCustomThemeToDb,
  saveDayHourToDb,
  saveDayReflectionToDb,
  saveDeadlineToDb,
  saveExamSettingsToDb,
  saveSubjectToDb,
  saveTimerStateToDb,
  setActiveThemeIdInDb,
  subscribePlannerDesktopEvents,
} from '../utils/desktop';
import { applyThemeToDocument } from '../utils/theme';
import { toLocalDateString } from '../utils/time';

const STORAGE_KEY = 'ghost-plan-al-state-v1';

function normalizePlannerState(rawState: Partial<PlannerState>): PlannerState {
  const seed = createSeedState();
  const customThemes = (rawState.themes || []).filter((t) => !t.isBuiltIn);
  const mergedThemes = [...BUILTIN_THEMES, ...customThemes];
  const activeThemeExists = mergedThemes.some((t) => t.id === rawState.activeThemeId);

  return {
    days: rawState.days && typeof rawState.days === 'object' ? rawState.days : seed.days,
    deadlines: Array.isArray(rawState.deadlines) ? rawState.deadlines : seed.deadlines,
    sessions: Array.isArray(rawState.sessions) ? rawState.sessions : seed.sessions,
    subjects:
      Array.isArray(rawState.subjects) && rawState.subjects.length > 0
        ? rawState.subjects
        : seed.subjects,
    themes: mergedThemes,
    activeThemeId:
      activeThemeExists && rawState.activeThemeId ? rawState.activeThemeId : seed.activeThemeId,
    examSettings: rawState.examSettings
      ? { ...seed.examSettings, ...rawState.examSettings }
      : seed.examSettings,
    timer: rawState.timer ? { ...seed.timer, ...rawState.timer } : seed.timer,
  };
}

function loadInitialState(): PlannerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedState();
    const parsed = JSON.parse(raw) as Partial<PlannerState>;
    return normalizePlannerState(parsed);
  } catch {
    return createSeedState();
  }
}

export function usePlannerState(onExternalTimerCompleted?: (targetMinutes: number) => void) {
  const [state, setState] = useState<PlannerState>(() => loadInitialState());
  const stateRef = useRef<PlannerState>(state);
  const timerCompletedCbRef = useRef(onExternalTimerCompleted);
  timerCompletedCbRef.current = onExternalTimerCompleted;

  const commitState = useCallback((next: PlannerState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const activeTheme =
    state.themes.find((t) => t.id === state.activeThemeId) ?? state.themes[0] ?? BUILTIN_THEMES[0];

  useEffect(() => {
    applyThemeToDocument(activeTheme);
  }, [activeTheme]);

  useEffect(() => {
    if (isTauriRuntime()) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors in browser preview
    }
  }, [state]);

  // Hydrate from local SQLite database & subscribe to tray / multi-window sync events when running in Tauri
  useEffect(() => {
    if (!isTauriRuntime()) return;
    let active = true;
    let cleanupEvents: (() => void) | undefined;

    (async () => {
      try {
        const dbState = await loadPlannerStateFromDb();
        if (!active) return;

        if (!dbState) {
          await importPlannerStateToDb(stateRef.current);
        } else {
          const normalized = normalizePlannerState(dbState);
          commitState(normalized);
        }
      } catch {
        // Keep current in-memory state if SQLite isn't ready
      }

      cleanupEvents = await subscribePlannerDesktopEvents({
        onStateUpdated: async () => {
          try {
            const latest = await loadPlannerStateFromDb();
            if (!active || !latest) return;
            const normalized = normalizePlannerState(latest);
            if (JSON.stringify(normalized) !== JSON.stringify(stateRef.current)) {
              commitState(normalized);
            }
          } catch {
            // Ignore transient reload errors
          }
        },
        onTimerCompleted: (mins) => {
          if (!active) return;
          timerCompletedCbRef.current?.(mins);
        },
      });
    })();

    return () => {
      active = false;
      cleanupEvents?.();
    };
  }, [commitState]);

  const updateDayHour = useCallback(
    (date: string, hour: number, updater: (row: HourRow) => HourRow) => {
      const prev = stateRef.current;
      const existing = prev.days[date] ?? createEmptyDayPlan(date);
      let updatedRow: HourRow | null = null;
      const nextHours = existing.hours.map((row) => {
        if (row.hour === hour) {
          updatedRow = updater(row);
          return updatedRow;
        }
        return row;
      });

      commitState({
        ...prev,
        days: {
          ...prev.days,
          [date]: {
            ...existing,
            hours: nextHours,
          },
        },
      });

      if (updatedRow) {
        void saveDayHourToDb(date, updatedRow);
      }
    },
    [commitState],
  );

  const clearDayPlan = useCallback(
    (date: string) => {
      const prev = stateRef.current;
      commitState({
        ...prev,
        days: {
          ...prev.days,
          [date]: createEmptyDayPlan(date),
        },
      });
      void clearDayPlanInDb(date);
    },
    [commitState],
  );

  const updateDayReflection = useCallback(
    (date: string, reflection: string) => {
      const prev = stateRef.current;
      const existing = prev.days[date] ?? createEmptyDayPlan(date);
      commitState({
        ...prev,
        days: {
          ...prev.days,
          [date]: { ...existing, reflection },
        },
      });
      void saveDayReflectionToDb(date, reflection);
    },
    [commitState],
  );

  const addDeadline = useCallback(
    (deadline: Omit<Deadline, 'id'>) => {
      const newItem: Deadline = {
        ...deadline,
        id: `dl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      };
      const prev = stateRef.current;
      commitState({
        ...prev,
        deadlines: [...prev.deadlines, newItem],
      });
      void saveDeadlineToDb(newItem);
    },
    [commitState],
  );

  const updateDeadline = useCallback(
    (id: string, patch: Partial<Deadline>) => {
      const prev = stateRef.current;
      let updatedItem: Deadline | null = null;
      const nextDeadlines = prev.deadlines.map((d) => {
        if (d.id === id) {
          updatedItem = { ...d, ...patch };
          return updatedItem;
        }
        return d;
      });
      commitState({
        ...prev,
        deadlines: nextDeadlines,
      });
      if (updatedItem) {
        void saveDeadlineToDb(updatedItem);
      }
    },
    [commitState],
  );

  const deleteDeadline = useCallback(
    (id: string) => {
      const prev = stateRef.current;
      commitState({
        ...prev,
        deadlines: prev.deadlines.filter((d) => d.id !== id),
      });
      void removeDeadlineFromDb(id);
    },
    [commitState],
  );

  const updateTimer = useCallback(
    (updater: (t: ActiveTimerState) => ActiveTimerState) => {
      const prev = stateRef.current;
      const nextTimer = updater(prev.timer);
      commitState({
        ...prev,
        timer: nextTimer,
      });
      void saveTimerStateToDb(nextTimer);
    },
    [commitState],
  );

  const logSessionToSheet = useCallback(
    (params: {
      durationSeconds: number;
      mode: 'stopwatch' | 'timer';
      category: SessionCategory;
      subjectId: string;
      label: string;
      applyToSheet: boolean;
    }) => {
      const prev = stateRef.current;
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

      let nextDays = prev.days;
      const updatedHours: [string, HourRow][] = [];

      if (params.applyToSheet && params.durationSeconds >= 60) {
        const existingDay: DayPlan = prev.days[today] ?? createEmptyDayPlan(today);
        const hoursCopy = existingDay.hours.map((r) => ({
          ...r,
          blocks: [...r.blocks] as [string | null, string | null, string | null, string | null],
        }));

        const totalBlocks = Math.max(1, Math.round(params.durationSeconds / 900));
        let remaining = totalBlocks;

        const hourOrder: number[] = [];
        for (let h = currentHour; h >= 0; h--) hourOrder.push(h);
        for (let h = currentHour + 1; h < 24; h++) hourOrder.push(h);

        const touchedHours = new Set<number>();

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
            if (changed) {
              if (!row.note && params.label) {
                row.note = params.label;
              }
              touchedHours.add(h);
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
              touchedHours.add(h);
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
              touchedHours.add(h);
            }
          }
        }

        touchedHours.forEach((h) => {
          updatedHours.push([today, hoursCopy[h]]);
        });

        nextDays = {
          ...prev.days,
          [today]: {
            ...existingDay,
            hours: hoursCopy,
          },
        };
      }

      commitState({
        ...prev,
        days: nextDays,
        sessions: [session, ...prev.sessions],
      });

      void logStudySessionToDb(session, updatedHours);
    },
    [commitState],
  );

  const deleteSession = useCallback(
    (id: string) => {
      const prev = stateRef.current;
      commitState({
        ...prev,
        sessions: prev.sessions.filter((s) => s.id !== id),
      });
      void removeStudySessionFromDb(id);
    },
    [commitState],
  );

  const setActiveTheme = useCallback(
    (themeId: string) => {
      const prev = stateRef.current;
      commitState({ ...prev, activeThemeId: themeId });
      void setActiveThemeIdInDb(themeId);
    },
    [commitState],
  );

  const saveCustomTheme = useCallback(
    (theme: ThemeConfig) => {
      const prev = stateRef.current;
      const exists = prev.themes.some((t) => t.id === theme.id);
      const nextThemes = exists
        ? prev.themes.map((t) => (t.id === theme.id ? theme : t))
        : [...prev.themes, theme];
      commitState({
        ...prev,
        themes: nextThemes,
        activeThemeId: theme.id,
      });
      void saveCustomThemeToDb(theme);
    },
    [commitState],
  );

  const deleteCustomTheme = useCallback(
    (themeId: string) => {
      const prev = stateRef.current;
      const target = prev.themes.find((t) => t.id === themeId);
      if (!target || target.isBuiltIn) return;
      const nextThemes = prev.themes.filter((t) => t.id !== themeId);
      const nextActive = prev.activeThemeId === themeId ? BUILTIN_THEMES[0].id : prev.activeThemeId;
      commitState({
        ...prev,
        themes: nextThemes,
        activeThemeId: nextActive,
      });
      void removeCustomThemeFromDb(themeId, nextActive);
    },
    [commitState],
  );

  const updateExamSettings = useCallback(
    (patch: Partial<ExamSettings>) => {
      const prev = stateRef.current;
      const nextSettings = { ...prev.examSettings, ...patch };
      commitState({
        ...prev,
        examSettings: nextSettings,
      });
      void saveExamSettingsToDb(nextSettings);
    },
    [commitState],
  );

  const addSubject = useCallback(
    (subject: Omit<SubjectConfig, 'id'>) => {
      const newSubj: SubjectConfig = {
        ...subject,
        id: `subj-${Date.now().toString(36)}`,
      };
      const prev = stateRef.current;
      commitState({
        ...prev,
        subjects: [...prev.subjects, newSubj],
      });
      void saveSubjectToDb(newSubj);
    },
    [commitState],
  );

  const updateSubject = useCallback(
    (id: string, patch: Partial<SubjectConfig>) => {
      const prev = stateRef.current;
      let updatedSubj: SubjectConfig | null = null;
      const nextSubjects = prev.subjects.map((s) => {
        if (s.id === id) {
          updatedSubj = { ...s, ...patch };
          return updatedSubj;
        }
        return s;
      });
      commitState({
        ...prev,
        subjects: nextSubjects,
      });
      if (updatedSubj) {
        void saveSubjectToDb(updatedSubj);
      }
    },
    [commitState],
  );

  const deleteSubject = useCallback(
    (id: string) => {
      const prev = stateRef.current;
      if (prev.subjects.length <= 1) return;
      commitState({
        ...prev,
        subjects: prev.subjects.filter((s) => s.id !== id),
      });
      void removeSubjectFromDb(id);
    },
    [commitState],
  );

  const importState = useCallback(
    (next: PlannerState) => {
      const normalized = normalizePlannerState(next);
      commitState(normalized);
      void importPlannerStateToDb(normalized);
    },
    [commitState],
  );

  const resetAllData = useCallback(() => {
    const fresh = createSeedState();
    commitState(fresh);
    void importPlannerStateToDb(fresh);
  }, [commitState]);

  const clearSampleStudyLogs = useCallback(() => {
    const prev = stateRef.current;
    const nextState: PlannerState = {
      ...prev,
      days: {},
      sessions: [],
    };
    commitState(nextState);
    void importPlannerStateToDb(nextState);
  }, [commitState]);

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
