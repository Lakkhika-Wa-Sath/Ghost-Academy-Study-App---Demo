export type TabId = 'daily' | 'tracker' | 'calendar' | 'timer' | 'analytics' | 'themes';

export type MinutesStep = 0 | 15 | 30 | 45 | 60;

export interface HourRow {
  /** 0 = 12-1 AM, 12 = 12-1 PM, 23 = 11-12 PM */
  hour: number;
  /** Four 15-minute self-study slots. Null = empty, string = Subject ID */
  blocks: [string | null, string | null, string | null, string | null];
  /** Class / school time in minutes (0, 15, 30, 45, 60) */
  classMinutes: MinutesStep;
  /** Wasting time in minutes (0, 15, 30, 45, 60) */
  wastingMinutes: MinutesStep;
  /** Sleep time in minutes (0, 15, 30, 45, 60) */
  sleepMinutes: MinutesStep;
  /** Online time in minutes (0, 15, 30, 45, 60) */
  onlineMinutes: MinutesStep;
  /** Optional short study note for the hour */
  note: string;
}

export interface DayPlan {
  date: string; // YYYY-MM-DD
  hours: HourRow[];
  reflection?: string;
}

export type DeadlineCategory = 'Exam / Mock' | 'Past Paper' | 'Syllabus Unit' | 'Assignment';
export type DeadlinePriority = 'High' | 'Medium' | 'Low';

export interface Deadline {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  subjectId: string;
  category: DeadlineCategory;
  priority: DeadlinePriority;
  completed: boolean;
  notes?: string;
}

export type SessionCategory = 'self-study' | 'class' | 'online';

export interface StudySession {
  id: string;
  date: string; // YYYY-MM-DD
  endedAt: number;
  durationSeconds: number;
  mode: 'stopwatch' | 'timer';
  category: SessionCategory;
  subjectId: string;
  label: string;
  loggedToSheet: boolean;
}

export interface SubjectConfig {
  id: string;
  name: string;
  shortCode: string;
  color: string;
}

export type FontPairing = 'outfit-jakarta' | 'jakarta-ibm' | 'dm-space';
export type RadiusStyle = 'sharp' | 'balanced' | 'soft';

export interface ThemeConfig {
  id: string;
  name: string;
  isDark: boolean;
  isBuiltIn?: boolean;
  colors: {
    canvas: string;
    surface: string;
    subtle: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    accent: string;
    accentFg: string;
    usingBlock: string;
    classBlock: string;
    wastingBlock: string;
    sleepBlock: string;
    onlineBlock: string;
  };
  fontPairing: FontPairing;
  radiusStyle: RadiusStyle;
}

export interface ExamSettings {
  studentName: string;
  streamLabel: string;
  examDate: string; // YYYY-MM-DD
  planStartDate: string; // YYYY-MM-DD
  dailyTargetMinutes: number;
  soundEnabled: boolean;
}

export interface ActiveTimerState {
  mode: 'stopwatch' | 'timer';
  status: 'idle' | 'running' | 'paused';
  startedAt: number | null; // epoch ms when current run segment started
  accumulatedMs: number;
  targetMinutes: number; // used for countdown timer
  subjectId: string;
  category: SessionCategory;
  label: string;
  laps: number[]; // elapsed ms at each lap
}

export interface PlannerState {
  days: Record<string, DayPlan>;
  deadlines: Deadline[];
  sessions: StudySession[];
  subjects: SubjectConfig[];
  themes: ThemeConfig[];
  activeThemeId: string;
  examSettings: ExamSettings;
  timer: ActiveTimerState;
}
