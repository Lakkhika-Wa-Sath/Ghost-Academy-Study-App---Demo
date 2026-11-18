/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WifiOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnalyticsView } from './components/AnalyticsView';
import { CalendarDeadlines } from './components/CalendarDeadlines';
import { DailyPlanSheet } from './components/DailyPlanSheet';
import { FocusTimer } from './components/FocusTimer';
import { MiniTimerWindow } from './components/MiniTimerWindow';
import { Sidebar } from './components/Sidebar';
import { ThemeSettingsView } from './components/ThemeSettingsView';
import { TopBar } from './components/TopBar';
import { WasteSleepOnlineView } from './components/WasteSleepOnlineView';
import { WindowsInstallModal } from './components/WindowsInstallModal';
import { usePlannerState } from './hooks/usePlannerState';
import { useOnlineStatus, usePWAInstall } from './hooks/usePWAInstall';
import { TabId } from './types/planner';
import {
  closeCurrentWindow,
  focusMainWindow,
  isMiniWindowMode,
  isTauriRuntime,
  pearControl,
  sendDesktopNotification,
  toggleMiniTimerWindow,
} from './utils/desktop';
import { playChime } from './utils/sound';
import { computeDayTotals, formatClockMs, toLocalDateString } from './utils/time';

export default function App() {
  const miniWindowMode = isMiniWindowMode();
  const [timerFinishedBanner, setTimerFinishedBanner] = useState(false);
  const soundEnabledRef = useRef(true);
  const chimePlayedRef = useRef(false);

  const handleExternalTimerCompleted = useCallback(() => {
    if (!chimePlayedRef.current) {
      chimePlayedRef.current = true;
      if (soundEnabledRef.current) {
        playChime();
      }
    }
    setTimerFinishedBanner(true);
  }, []);

  const {
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
    deleteSubject,
    importState,
    resetAllData,
    clearSampleStudyLogs,
  } = usePlannerState(handleExternalTimerCompleted);

  soundEnabledRef.current = state.examSettings.soundEnabled;

  const [activeTab, setActiveTab] = useState<TabId>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(() => toLocalDateString(new Date()));
  const [openDeadlineForm, setOpenDeadlineForm] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [browserMiniOpen, setBrowserMiniOpen] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);

  const { isInstallable, isInstalled, isNativeDesktop, isIOS, isInIframe, install } =
    usePWAInstall();
  const isOnline = useOnlineStatus();

  // Live timer clock tick
  useEffect(() => {
    if (state.timer.status !== 'running') return;
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);
    return () => window.clearInterval(id);
  }, [state.timer.status]);

  const elapsedMs =
    state.timer.status === 'running' && state.timer.startedAt
      ? state.timer.accumulatedMs + Math.max(0, nowMs - state.timer.startedAt)
      : state.timer.accumulatedMs;

  const targetMs = state.timer.targetMinutes * 60_000;

  // Handle countdown completion (in Tauri, Rust monitor triggers OS notification & timer-completed event)
  useEffect(() => {
    if (
      state.timer.mode === 'timer' &&
      state.timer.status === 'running' &&
      elapsedMs >= targetMs &&
      targetMs > 0
    ) {
      if (!chimePlayedRef.current) {
        chimePlayedRef.current = true;
        if (state.examSettings.soundEnabled) {
          playChime();
        }
        setTimerFinishedBanner(true);
        if (!isTauriRuntime()) {
          const subjName =
            state.subjects.find((s) => s.id === state.timer.subjectId)?.name ?? 'Study';
          void sendDesktopNotification(
            'Focus Session Complete',
            `${subjName} (${state.timer.targetMinutes} min) finished.`,
          );
          if (state.examSettings.pearEnabled && state.examSettings.pearAutoPauseOnFinish) {
            const pearUrl = state.examSettings.pearBaseUrl || 'http://127.0.0.1:26538';
            const pearToken = state.examSettings.pearToken || undefined;
            void pearControl(pearUrl, 'pause', pearToken).catch(() => {});
          }
          updateTimer((prev) => ({
            ...prev,
            status: 'paused',
            startedAt: null,
            accumulatedMs: targetMs,
          }));
        }
      }
    } else if (elapsedMs < targetMs) {
      chimePlayedRef.current = false;
    }
  }, [
    elapsedMs,
    targetMs,
    state.timer.mode,
    state.timer.status,
    state.timer.subjectId,
    state.timer.targetMinutes,
    state.subjects,
    state.examSettings.soundEnabled,
    state.examSettings.pearEnabled,
    state.examSettings.pearBaseUrl,
    state.examSettings.pearToken,
    state.examSettings.pearAutoPauseOnFinish,
    updateTimer,
  ]);

  const handleToggleTimerQuick = useCallback(() => {
    const pearUrl = state.examSettings.pearBaseUrl || 'http://127.0.0.1:26538';
    const pearToken = state.examSettings.pearToken || undefined;

    if (state.timer.status === 'running') {
      const delta = state.timer.startedAt ? Date.now() - state.timer.startedAt : 0;
      updateTimer((prev) => ({
        ...prev,
        status: 'paused',
        startedAt: null,
        accumulatedMs: prev.accumulatedMs + delta,
      }));
      if (state.examSettings.pearEnabled && state.examSettings.pearAutoPauseOnFinish) {
        void pearControl(pearUrl, 'pause', pearToken).catch(() => {});
      }
    } else {
      updateTimer((prev) => ({
        ...prev,
        status: 'running',
        startedAt: Date.now(),
      }));
      if (state.examSettings.pearEnabled && state.examSettings.pearAutoResumeOnStart) {
        void pearControl(pearUrl, 'play', pearToken).catch(() => {});
      }
    }
  }, [
    state.timer.status,
    state.timer.startedAt,
    state.examSettings.pearEnabled,
    state.examSettings.pearBaseUrl,
    state.examSettings.pearToken,
    state.examSettings.pearAutoPauseOnFinish,
    state.examSettings.pearAutoResumeOnStart,
    updateTimer,
  ]);

  const handleResetTimerQuick = useCallback(() => {
    updateTimer((prev) => ({
      ...prev,
      status: 'idle',
      startedAt: null,
      accumulatedMs: 0,
      laps: [],
    }));
  }, [updateTimer]);

  const handleToggleMiniTimer = useCallback(async () => {
    if (isTauriRuntime()) {
      await toggleMiniTimerWindow();
    } else {
      setBrowserMiniOpen((prev) => !prev);
    }
  }, []);

  if (miniWindowMode) {
    return (
      <MiniTimerWindow
        isNativeWindow={true}
        timer={state.timer}
        elapsedMs={elapsedMs}
        subjects={state.subjects}
        onTogglePlayPause={handleToggleTimerQuick}
        onReset={handleResetTimerQuick}
        onFinishAndLog={(params) => {
          logSessionToSheet(params);
        }}
        onFocusMain={() => {
          void focusMainWindow();
        }}
        onCloseMini={() => {
          void closeCurrentWindow();
        }}
      />
    );
  }

  const today = toLocalDateString(new Date());
  const todayTotals = computeDayTotals(state.days[today]);
  const upcomingDeadlinesCount = state.deadlines.filter((d) => !d.completed).length;

  const displayClockMs =
    state.timer.mode === 'timer' ? Math.max(0, targetMs - elapsedMs) : elapsedMs;
  const timerClockText = formatClockMs(displayClockMs);

  const getPrimaryAction = () => {
    if (activeTab === 'daily') {
      return {
        label: 'Open Focus Timer',
        action: () => setActiveTab('timer'),
      };
    }
    if (activeTab === 'calendar') {
      return {
        label: 'Add Deadline',
        action: () => setOpenDeadlineForm(true),
      };
    }
    return {
      label: "Today's Time Plan",
      action: () => {
        setSelectedDate(today);
        setActiveTab('daily');
      },
    };
  };

  const primaryAction = getPrimaryAction();

  return (
    <div
      className="min-h-screen flex"
      style={{
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
      }}
    >
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        examSettings={state.examSettings}
        onUpdateExamSettings={updateExamSettings}
        todayUsingMinutes={todayTotals.usingMinutes}
        upcomingDeadlinesCount={upcomingDeadlinesCount}
        timerRunning={state.timer.status === 'running'}
        timerDisplay={timerClockText}
        showInstallApp={!isInstalled && !isNativeDesktop}
        onOpenInstallModal={() => setInstallModalOpen(true)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeTab={activeTab}
          selectedDate={selectedDate}
          primaryActionLabel={primaryAction.label}
          onPrimaryAction={primaryAction.action}
          timerStatus={state.timer.status}
          timerClock={timerClockText}
          onToggleTimerQuick={handleToggleTimerQuick}
          onGoToTimer={() => setActiveTab('timer')}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-5 pb-20 lg:py-6 max-w-[1400px] w-full mx-auto">
          {timerFinishedBanner && (
            <div
              className="mb-5 px-4 py-3 border theme-control flex flex-wrap items-center justify-between gap-3 text-xs"
              style={{
                backgroundColor: 'var(--accent-soft)',
                borderColor: 'var(--accent)',
              }}
            >
              <span className="font-semibold">
                Focus session completed ({state.timer.targetMinutes} min). Ready to log to Today&apos;s
                Plan.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    logSessionToSheet({
                      durationSeconds: state.timer.targetMinutes * 60,
                      mode: state.timer.mode,
                      category: state.timer.category,
                      subjectId: state.timer.subjectId,
                      label: state.timer.label || 'Focus Session',
                      applyToSheet: true,
                    });
                    handleResetTimerQuick();
                    setTimerFinishedBanner(false);
                  }}
                  className="px-3 py-1.5 font-semibold theme-control"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                >
                  Log to Today&apos;s Plan
                </button>
                <button
                  type="button"
                  onClick={() => setTimerFinishedBanner(false)}
                  className="px-2.5 py-1.5 border theme-control"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {activeTab === 'daily' && (
            <DailyPlanSheet
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              days={state.days}
              subjects={state.subjects}
              examSettings={state.examSettings}
              onUpdateExamSettings={updateExamSettings}
              onUpdateHour={updateDayHour}
              onClearDay={clearDayPlan}
              onUpdateReflection={updateDayReflection}
              onOpenTrackerTab={() => setActiveTab('tracker')}
            />
          )}

          {activeTab === 'tracker' && (
            <WasteSleepOnlineView
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              days={state.days}
              onUpdateHour={updateDayHour}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarDeadlines
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onOpenDayPlan={(date) => {
                setSelectedDate(date);
                setActiveTab('daily');
              }}
              days={state.days}
              deadlines={state.deadlines}
              subjects={state.subjects}
              examSettings={state.examSettings}
              onAddDeadline={addDeadline}
              onUpdateDeadline={updateDeadline}
              onDeleteDeadline={deleteDeadline}
              showAddFormExternal={openDeadlineForm}
              onCloseAddFormExternal={() => setOpenDeadlineForm(false)}
            />
          )}

          {activeTab === 'timer' && (
            <FocusTimer
              timer={state.timer}
              elapsedMs={elapsedMs}
              subjects={state.subjects}
              sessions={state.sessions}
              examSettings={state.examSettings}
              onUpdateExamSettings={updateExamSettings}
              miniTimerOpen={!isTauriRuntime() ? browserMiniOpen : undefined}
              onToggleMiniTimer={() => {
                void handleToggleMiniTimer();
              }}
              onUpdateTimer={updateTimer}
              onLogSession={(params) => {
                setTimerFinishedBanner(false);
                logSessionToSheet(params);
              }}
              onDeleteSession={deleteSession}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView
              days={state.days}
              deadlines={state.deadlines}
              subjects={state.subjects}
              examSettings={state.examSettings}
            />
          )}

          {activeTab === 'themes' && (
            <ThemeSettingsView
              themes={state.themes}
              activeTheme={activeTheme}
              examSettings={state.examSettings}
              subjects={state.subjects}
              fullState={state}
              isNativeDesktop={isNativeDesktop}
              onOpenInstallModal={() => setInstallModalOpen(true)}
              onSelectTheme={setActiveTheme}
              onSaveCustomTheme={saveCustomTheme}
              onDeleteCustomTheme={deleteCustomTheme}
              onUpdateExamSettings={updateExamSettings}
              onAddSubject={addSubject}
              onDeleteSubject={deleteSubject}
              onImportState={importState}
              onResetAll={resetAllData}
              onClearLogs={clearSampleStudyLogs}
            />
          )}
        </main>
      </div>

      {!isOnline && !isNativeDesktop && (
        <div
          className="fixed bottom-16 lg:bottom-4 left-4 z-40 px-3 py-1.5 border theme-control flex items-center gap-2 text-xs font-medium shadow-md"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--color-online)',
            color: 'var(--color-online)',
          }}
        >
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>Offline Mode — Cached data is active</span>
        </div>
      )}

      {!isTauriRuntime() && browserMiniOpen && (
        <MiniTimerWindow
          isNativeWindow={false}
          timer={state.timer}
          elapsedMs={elapsedMs}
          subjects={state.subjects}
          onTogglePlayPause={handleToggleTimerQuick}
          onReset={handleResetTimerQuick}
          onFinishAndLog={(params) => {
            setTimerFinishedBanner(false);
            logSessionToSheet(params);
          }}
          onFocusMain={() => setActiveTab('timer')}
          onCloseMini={() => setBrowserMiniOpen(false)}
        />
      )}

      <WindowsInstallModal
        isOpen={installModalOpen}
        onClose={() => setInstallModalOpen(false)}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        isIOS={isIOS}
        isInIframe={isInIframe}
        onInstallPWA={install}
        fullState={state}
      />
    </div>
  );
}
