import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import {
  ActiveTimerState,
  Deadline,
  ExamSettings,
  HourRow,
  PearSongInfo,
  PlannerState,
  StudySession,
  SubjectConfig,
  ThemeConfig,
} from '../types/planner';

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function isMiniWindowMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('window') === 'mini';
}

export async function loadPlannerStateFromDb(): Promise<PlannerState | null> {
  if (!isTauriRuntime()) return null;
  return invoke<PlannerState | null>('load_planner_state');
}

export async function importPlannerStateToDb(planner: PlannerState): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('import_planner_state', { planner });
}

export async function saveDayHourToDb(date: string, row: HourRow): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('save_day_hour', { date, row });
}

export async function clearDayPlanInDb(date: string): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('clear_day_plan', { date });
}

export async function saveDayReflectionToDb(date: string, reflection: string): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('save_day_reflection', { date, reflection });
}

export async function saveDeadlineToDb(deadline: Deadline): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('save_deadline', { deadline });
}

export async function removeDeadlineFromDb(id: string): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('remove_deadline', { id });
}

export async function logStudySessionToDb(
  session: StudySession,
  updatedHours: [string, HourRow][],
): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('log_study_session', { session, updatedHours });
}

export async function removeStudySessionFromDb(id: string): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('remove_study_session', { id });
}

export async function setActiveThemeIdInDb(themeId: string): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('set_active_theme_id', { themeId });
}

export async function saveCustomThemeToDb(theme: ThemeConfig): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('save_custom_theme', { theme });
}

export async function removeCustomThemeFromDb(
  themeId: string,
  fallbackThemeId: string,
): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('remove_custom_theme', { themeId, fallbackThemeId });
}

export async function saveExamSettingsToDb(settings: ExamSettings): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('save_exam_settings', { settings });
}

export async function saveSubjectToDb(subject: SubjectConfig): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('save_subject', { subject });
}

export async function removeSubjectFromDb(id: string): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('remove_subject', { id });
}

export async function saveTimerStateToDb(timer: ActiveTimerState): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('save_timer_state', { timer });
}

export async function focusMainWindow(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('focus_main_window');
}

export async function toggleMiniTimerWindow(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>('toggle_mini_timer');
}

export async function closeCurrentWindow(): Promise<void> {
  if (!isTauriRuntime()) return;
  await getCurrentWindow().close();
}

export async function sendDesktopNotification(title: string, body: string): Promise<void> {
  if (isTauriRuntime()) {
    try {
      let granted = await isPermissionGranted();
      if (!granted) {
        const perm = await requestPermission();
        granted = perm === 'granted';
      }
      if (granted) {
        sendNotification({ title, body });
      }
    } catch {
      // Ignore notification permission errors
    }
    return;
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

export async function subscribePlannerDesktopEvents(handlers: {
  onStateUpdated: () => void;
  onTimerCompleted: (targetMinutes: number) => void;
}): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => {};
  }

  const unlisteners: UnlistenFn[] = [];
  const u1 = await listen('planner-state-updated', () => {
    handlers.onStateUpdated();
  });
  unlisteners.push(u1);

  const u2 = await listen<number>('timer-completed', (event) => {
    handlers.onTimerCompleted(event.payload);
  });
  unlisteners.push(u2);

  return () => {
    unlisteners.forEach((fn) => fn());
  };
}

function normalizePearBase(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  return trimmed || 'http://127.0.0.1:26538';
}

export async function pearGetSong(baseUrl: string, token?: string): Promise<PearSongInfo> {
  if (isTauriRuntime()) {
    return invoke<PearSongInfo>('pear_get_song', { baseUrl, token: token || null });
  }
  const res = await fetch(`${normalizePearBase(baseUrl)}/api/v1/song`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as PearSongInfo;
}

export async function pearControl(
  baseUrl: string,
  action: 'toggle-play' | 'play' | 'pause' | 'next' | 'previous',
  token?: string,
): Promise<void> {
  if (isTauriRuntime()) {
    await invoke('pear_control', { baseUrl, token: token || null, action });
    return;
  }
  const res = await fetch(`${normalizePearBase(baseUrl)}/api/v1/${action}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function pearSetVolume(
  baseUrl: string,
  volume: number,
  token?: string,
): Promise<void> {
  const clamped = Math.max(0, Math.min(100, Math.round(volume)));
  if (isTauriRuntime()) {
    await invoke('pear_set_volume', { baseUrl, token: token || null, volume: clamped });
    return;
  }
  const res = await fetch(`${normalizePearBase(baseUrl)}/api/v1/volume`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ volume: clamped }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function pearRequestAuth(baseUrl: string): Promise<string> {
  if (isTauriRuntime()) {
    return invoke<string>('pear_request_auth', { baseUrl });
  }
  const res = await fetch(`${normalizePearBase(baseUrl)}/auth/ghost-plan`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { accessToken?: string };
  if (!data.accessToken) throw new Error('Missing accessToken');
  return data.accessToken;
}

