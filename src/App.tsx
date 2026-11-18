/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { AnalyticsView } from './components/AnalyticsView';
import { CalendarDeadlines } from './components/CalendarDeadlines';
import { DailyPlanSheet } from './components/DailyPlanSheet';
import { FocusTimer } from './components/FocusTimer';
import { Sidebar } from './components/Sidebar';
import { ThemeSettingsView } from './components/ThemeSettingsView';
import { TopBar } from './components/TopBar';
import { WasteSleepOnlineView } from './components/WasteSleepOnlineView';
import { usePlannerState } from './hooks/usePlannerState';
import { TabId } from './types/planner';
import { playChime } from './utils/sound';
import { computeDayTotals, formatClockMs, toLocalDateString } from './utils/time';

export default function App() {
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
  } = usePlannerState();

  const [activeTab, setActiveTab] = useState<TabId>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(() => toLocalDateString(new Date()));
  const [openDeadlineForm, setOpenDeadlineForm] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [timerFinishedBanner, setTimerFinishedBanner] = useState(false);

  const chimePlayedRef = useRef(false);

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

  // Handle countdown completion
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
        updateTimer((prev) => ({
          ...prev,
          status: 'paused',
          startedAt: null,
          accumulatedMs: targetMs,
        }));
      }
    } else if (elapsedMs < targetMs) {
      chimePlayedRef.current = false;
    }
  }, [
    elapsedMs,
    targetMs,
    state.timer.mode,
    state.timer.status,
    state.examSettings.soundEnabled,
    updateTimer,
  ]);

  const today = toLocalDateString(new Date());
  const todayTotals = computeDayTotals(state.days[today]);
  const upcomingDeadlinesCount = state.deadlines.filter((d) => !d.completed).length;

  const displayClockMs =
    state.timer.mode === 'timer' ? Math.max(0, targetMs - elapsedMs) : elapsedMs;
  const timerClockText = formatClockMs(displayClockMs);

  const handleToggleTimerQuick = () => {
    if (state.timer.status === 'running') {
      const delta = state.timer.startedAt ? Date.now() - state.timer.startedAt : 0;
      updateTimer((prev) => ({
        ...prev,
        status: 'paused',
        startedAt: null,
        accumulatedMs: prev.accumulatedMs + delta,
      }));
    } else {
      updateTimer((prev) => ({
        ...prev,
        status: 'running',
        startedAt: Date.now(),
      }));
    }
  };

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
        todayUsingMinutes={todayTotals.usingMinutes}
        upcomingDeadlinesCount={upcomingDeadlinesCount}
        timerRunning={state.timer.status === 'running'}
        timerDisplay={timerClockText}
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
                    updateTimer((prev) => ({
                      ...prev,
                      status: 'idle',
                      startedAt: null,
                      accumulatedMs: 0,
                    }));
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
    </div>
  );
}
