import {
  ActiveTimerState,
  DayPlan,
  Deadline,
  ExamSettings,
  HourRow,
  PlannerState,
  StudySession,
  SubjectConfig,
  ThemeConfig,
} from '../types/planner';
import { addDays, toLocalDateString } from '../utils/time';

export const HOUR_LABELS: { hour: number; period: 'AM' | 'PM'; label: string }[] = Array.from(
  { length: 24 },
  (_, hour) => {
    const period: 'AM' | 'PM' = hour < 12 ? 'AM' : 'PM';
    const start12 = hour % 12 === 0 ? 12 : hour % 12;
    const end12 = (hour + 1) % 12 === 0 ? 12 : (hour + 1) % 12;
    return {
      hour,
      period,
      label: `${start12} - ${end12}`,
    };
  },
);

export const DEFAULT_SUBJECTS: SubjectConfig[] = [
  { id: 'maths', name: 'Combined Maths', shortCode: 'MATH', color: '#0284c7' },
  { id: 'physics', name: 'Physics', shortCode: 'PHYS', color: '#16a34a' },
  { id: 'chemistry', name: 'Chemistry', shortCode: 'CHEM', color: '#d97706' },
  { id: 'past-papers', name: 'Past Papers', shortCode: 'PP', color: '#7c3aed' },
  { id: 'general', name: 'General Revision', shortCode: 'REV', color: '#0f766e' },
];

export const BUILTIN_THEMES: ThemeConfig[] = [
  {
    id: 'paper-ledger',
    name: 'Paper Ledger',
    isDark: false,
    isBuiltIn: true,
    colors: {
      canvas: '#f8fafc',
      surface: '#ffffff',
      subtle: '#f1f5f9',
      border: '#e2e8f0',
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      accent: '#0f766e',
      accentFg: '#ffffff',
      usingBlock: '#16a34a',
      classBlock: '#0284c7',
      wastingBlock: '#dc2626',
      sleepBlock: '#6366f1',
      onlineBlock: '#d97706',
    },
    fontPairing: 'outfit-jakarta',
    radiusStyle: 'balanced',
  },
  {
    id: 'ghost-slate',
    name: 'Ghost Slate',
    isDark: true,
    isBuiltIn: true,
    colors: {
      canvas: '#0b1120',
      surface: '#111827',
      subtle: '#1e293b',
      border: '#273449',
      textPrimary: '#f1f5f9',
      textSecondary: '#94a3b8',
      accent: '#38bdf8',
      accentFg: '#082f49',
      usingBlock: '#22c55e',
      classBlock: '#38bdf8',
      wastingBlock: '#ef4444',
      sleepBlock: '#818cf8',
      onlineBlock: '#f59e0b',
    },
    fontPairing: 'jakarta-ibm',
    radiusStyle: 'sharp',
  },
  {
    id: 'obsidian-focus',
    name: 'Obsidian Gold',
    isDark: true,
    isBuiltIn: true,
    colors: {
      canvas: '#09090b',
      surface: '#141417',
      subtle: '#1e1e24',
      border: '#27272a',
      textPrimary: '#fafafa',
      textSecondary: '#a1a1aa',
      accent: '#eab308',
      accentFg: '#18181b',
      usingBlock: '#10b981',
      classBlock: '#3b82f6',
      wastingBlock: '#f43f5e',
      sleepBlock: '#8b5cf6',
      onlineBlock: '#f97316',
    },
    fontPairing: 'dm-space',
    radiusStyle: 'balanced',
  },
  {
    id: 'sage-study',
    name: 'Sage Desk',
    isDark: false,
    isBuiltIn: true,
    colors: {
      canvas: '#f4f6f4',
      surface: '#ffffff',
      subtle: '#eaeFEA',
      border: '#d6dfd7',
      textPrimary: '#14241a',
      textSecondary: '#475c4e',
      accent: '#15803d',
      accentFg: '#ffffff',
      usingBlock: '#16a34a',
      classBlock: '#0d9488',
      wastingBlock: '#dc2626',
      sleepBlock: '#4f46e5',
      onlineBlock: '#ca8a04',
    },
    fontPairing: 'outfit-jakarta',
    radiusStyle: 'soft',
  },
  {
    id: 'nordic-ink',
    name: 'Nordic Ink',
    isDark: false,
    isBuiltIn: true,
    colors: {
      canvas: '#f1f5f9',
      surface: '#ffffff',
      subtle: '#e2e8f0',
      border: '#cbd5e1',
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      accent: '#1d4ed8',
      accentFg: '#ffffff',
      usingBlock: '#059669',
      classBlock: '#2563eb',
      wastingBlock: '#e11d48',
      sleepBlock: '#6366f1',
      onlineBlock: '#d97706',
    },
    fontPairing: 'jakarta-ibm',
    radiusStyle: 'sharp',
  },
];

export function createEmptyHours(): HourRow[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    blocks: [null, null, null, null],
    classMinutes: 0,
    wastingMinutes: 0,
    sleepMinutes: 0,
    onlineMinutes: 0,
    note: '',
  }));
}

export function createEmptyDayPlan(date: string): DayPlan {
  return {
    date,
    hours: createEmptyHours(),
    reflection: '',
  };
}

export function createSeedState(): PlannerState {
  const today = toLocalDateString(new Date());
  const yesterday = addDays(today, -1);
  const twoDaysAgo = addDays(today, -2);
  const examDate = addDays(today, 270); // ~9 months from today
  const planStartDate = addDays(today, -10);

  const buildSampleDay = (
    date: string,
    studyHours: { hour: number; count: 1 | 2 | 3 | 4; subjectId: string; note: string }[],
    classHours: { hour: number; note: string }[],
    sleepHours: number[],
    wasteHours: { hour: number; min: 15 | 30 | 45 }[],
    onlineHours: { hour: number; min: 15 | 30 }[],
  ): DayPlan => {
    const hours = createEmptyHours();
    for (const s of studyHours) {
      const row = hours[s.hour];
      for (let i = 0; i < s.count; i++) {
        row.blocks[i] = s.subjectId;
      }
      row.note = s.note;
    }
    for (const c of classHours) {
      hours[c.hour].classMinutes = 60;
      hours[c.hour].note = c.note;
    }
    for (const sh of sleepHours) {
      hours[sh].sleepMinutes = 60;
    }
    for (const w of wasteHours) {
      hours[w.hour].wastingMinutes = w.min;
    }
    for (const o of onlineHours) {
      hours[o.hour].onlineMinutes = o.min;
    }
    return { date, hours };
  };

  const days: Record<string, DayPlan> = {
    [twoDaysAgo]: buildSampleDay(
      twoDaysAgo,
      [
        { hour: 5, count: 4, subjectId: 'maths', note: 'Differentiation Past Papers' },
        { hour: 6, count: 3, subjectId: 'maths', note: 'Integration Practice' },
        { hour: 16, count: 4, subjectId: 'physics', note: 'Mechanics — Rigid Bodies' },
        { hour: 19, count: 4, subjectId: 'chemistry', note: 'Chemical Equilibrium' },
        { hour: 20, count: 3, subjectId: 'past-papers', note: '2021 Physics MCQ' },
      ],
      [
        { hour: 8, note: 'Combined Maths Theory' },
        { hour: 9, note: 'Combined Maths Theory' },
        { hour: 11, note: 'Physics Revision Class' },
      ],
      [0, 1, 2, 3, 4, 23],
      [
        { hour: 14, min: 30 },
        { hour: 21, min: 15 },
      ],
      [{ hour: 21, min: 15 }],
    ),
    [yesterday]: buildSampleDay(
      yesterday,
      [
        { hour: 5, count: 4, subjectId: 'physics', note: 'Oscillations & Waves' },
        { hour: 6, count: 4, subjectId: 'physics', note: 'Wave Optics Derivations' },
        { hour: 15, count: 3, subjectId: 'chemistry', note: 'Organic Mechanisms' },
        { hour: 17, count: 4, subjectId: 'maths', note: 'Vectors & Kinematics' },
        { hour: 19, count: 4, subjectId: 'past-papers', note: '2022 Chemistry Essay' },
        { hour: 20, count: 4, subjectId: 'past-papers', note: 'Timed MCQ Drill' },
      ],
      [
        { hour: 8, note: 'Chemistry Paper Class' },
        { hour: 9, note: 'Chemistry Paper Class' },
        { hour: 10, note: 'School Lab Session' },
      ],
      [0, 1, 2, 3, 4, 23],
      [{ hour: 13, min: 30 }],
      [{ hour: 21, min: 30 }],
    ),
    [today]: buildSampleDay(
      today,
      [
        { hour: 5, count: 4, subjectId: 'maths', note: 'Differential Equations' },
        { hour: 6, count: 4, subjectId: 'chemistry', note: 'Electrochemistry Notes' },
        { hour: 16, count: 3, subjectId: 'physics', note: 'Electrostatics Problems' },
      ],
      [
        { hour: 8, note: 'School / Tuition Morning' },
        { hour: 9, note: 'School / Tuition Morning' },
      ],
      [0, 1, 2, 3, 4],
      [{ hour: 13, min: 15 }],
      [{ hour: 12, min: 15 }],
    ),
  };

  const deadlines: Deadline[] = [
    {
      id: 'dl-1',
      title: 'Physics Mechanics & Waves 10-Year Past Paper Pack',
      date: addDays(today, 4),
      subjectId: 'physics',
      category: 'Past Paper',
      priority: 'High',
      completed: false,
      notes: 'Complete 2016–2025 structured essays under timed exam conditions.',
    },
    {
      id: 'dl-2',
      title: 'Organic Chemistry Reaction Map Revision',
      date: addDays(today, 9),
      subjectId: 'chemistry',
      category: 'Syllabus Unit',
      priority: 'High',
      completed: false,
      notes: 'Finish full conversion chart and reagent flash summary.',
    },
    {
      id: 'dl-3',
      title: 'Combined Maths Pure Paper I Full Mock',
      date: addDays(today, 14),
      subjectId: 'maths',
      category: 'Exam / Mock',
      priority: 'Medium',
      completed: false,
      notes: '3-hour strict timed simulation with marking scheme review.',
    },
    {
      id: 'dl-4',
      title: 'Phase 1 Syllabus Lock-In (Month 1 Checkpoint)',
      date: addDays(today, 22),
      subjectId: 'general',
      category: 'Exam / Mock',
      priority: 'Medium',
      completed: false,
      notes: 'First 30-day audit across all 3 A/L subjects.',
    },
  ];

  const sessions: StudySession[] = [
    {
      id: 'sess-1',
      date: yesterday,
      endedAt: Date.now() - 86400_000,
      durationSeconds: 5400,
      mode: 'timer',
      category: 'self-study',
      subjectId: 'past-papers',
      label: '2022 Chemistry Structured Essay',
      loggedToSheet: true,
    },
    {
      id: 'sess-2',
      date: today,
      endedAt: Date.now() - 3600_000,
      durationSeconds: 3600,
      mode: 'stopwatch',
      category: 'self-study',
      subjectId: 'maths',
      label: 'Differential Equations Drill',
      loggedToSheet: true,
    },
  ];

  const examSettings: ExamSettings = {
    studentName: 'A/L Candidate',
    streamLabel: 'Physical Science (9-Month Plan)',
    examDate,
    planStartDate,
    dailyTargetMinutes: 540, // 9 hours
    soundEnabled: true,
    pearEnabled: false,
    pearBaseUrl: 'http://127.0.0.1:26538',
    pearToken: '',
    pearAutoPauseOnFinish: true,
    pearAutoResumeOnStart: false,
  };

  const timer: ActiveTimerState = {
    mode: 'timer',
    status: 'idle',
    startedAt: null,
    accumulatedMs: 0,
    targetMinutes: 50,
    subjectId: 'physics',
    category: 'self-study',
    label: 'Deep Work Block',
    laps: [],
  };

  return {
    days,
    deadlines,
    sessions,
    subjects: DEFAULT_SUBJECTS,
    themes: BUILTIN_THEMES,
    activeThemeId: 'paper-ledger',
    examSettings,
    timer,
  };
}
