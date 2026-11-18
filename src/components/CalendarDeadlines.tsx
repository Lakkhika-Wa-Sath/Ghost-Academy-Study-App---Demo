import {
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  DayPlan,
  Deadline,
  DeadlineCategory,
  DeadlinePriority,
  ExamSettings,
  SubjectConfig,
} from '../types/planner';
import {
  computeDayTotals,
  diffDays,
  formatDecimalHours,
  formatMinutes,
  formatReadableDate,
  toLocalDateString,
} from '../utils/time';

interface CalendarDeadlinesProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onOpenDayPlan: (date: string) => void;
  days: Record<string, DayPlan>;
  deadlines: Deadline[];
  subjects: SubjectConfig[];
  examSettings: ExamSettings;
  onAddDeadline: (d: Omit<Deadline, 'id'>) => void;
  onUpdateDeadline: (id: string, patch: Partial<Deadline>) => void;
  onDeleteDeadline: (id: string) => void;
  showAddFormExternal?: boolean;
  onCloseAddFormExternal?: () => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CATEGORIES: DeadlineCategory[] = ['Exam / Mock', 'Past Paper', 'Syllabus Unit', 'Assignment'];
const PRIORITIES: DeadlinePriority[] = ['High', 'Medium', 'Low'];

export function CalendarDeadlines({
  selectedDate,
  onSelectDate,
  onOpenDayPlan,
  days,
  deadlines,
  subjects,
  examSettings,
  onAddDeadline,
  onUpdateDeadline,
  onDeleteDeadline,
  showAddFormExternal,
  onCloseAddFormExternal,
}: CalendarDeadlinesProps) {
  const today = toLocalDateString(new Date());
  const initialDate = new Date(selectedDate + 'T12:00:00');
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth()); // 0..11

  const [filterStatus, setFilterStatus] = useState<'upcoming' | 'completed' | 'all'>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [dlDate, setDlDate] = useState(selectedDate);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? 'general');
  const [category, setCategory] = useState<DeadlineCategory>('Past Paper');
  const [priority, setPriority] = useState<DeadlinePriority>('High');
  const [notes, setNotes] = useState('');

  const showForm = isAdding || Boolean(showAddFormExternal);
  const closeForm = () => {
    setIsAdding(false);
    onCloseAddFormExternal?.();
  };

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  const calendarCells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1, 12, 0, 0);
    const lastOfMonth = new Date(viewYear, viewMonth + 1, 0, 12, 0, 0);
    const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Mon=0..Sun=6
    const totalDays = lastOfMonth.getDate();

    const cells: { dateStr: string; dayNum: number; inMonth: boolean }[] = [];

    // Leading days from previous month
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth, -i, 12, 0, 0);
      cells.push({ dateStr: toLocalDateString(d), dayNum: d.getDate(), inMonth: false });
    }
    // Current month days
    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(viewYear, viewMonth, day, 12, 0, 0);
      cells.push({ dateStr: toLocalDateString(d), dayNum: day, inMonth: true });
    }
    // Trailing days to complete 6 rows or full week
    while (cells.length % 7 !== 0) {
      const idx = cells.length - (startWeekday + totalDays) + 1;
      const d = new Date(viewYear, viewMonth + 1, idx, 12, 0, 0);
      cells.push({ dateStr: toLocalDateString(d), dayNum: d.getDate(), inMonth: false });
    }

    return cells;
  }, [viewYear, viewMonth]);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleCreateDeadline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAddDeadline({
      title: title.trim(),
      date: dlDate || selectedDate,
      subjectId,
      category,
      priority,
      completed: false,
      notes: notes.trim() || undefined,
    });
    setTitle('');
    setNotes('');
    closeForm();
  };

  const deadlinesByDate = useMemo(() => {
    const map = new Map<string, Deadline[]>();
    for (const d of deadlines) {
      const list = map.get(d.date) ?? [];
      list.push(d);
      map.set(d.date, list);
    }
    return map;
  }, [deadlines]);

  const selectedDayTotals = computeDayTotals(days[selectedDate]);
  const selectedDayDeadlines = deadlinesByDate.get(selectedDate) ?? [];

  const filteredDeadlines = useMemo(() => {
    return deadlines
      .filter((d) => {
        if (filterStatus === 'upcoming' && d.completed) return false;
        if (filterStatus === 'completed' && !d.completed) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const subjName = subjectMap.get(d.subjectId)?.name.toLowerCase() ?? '';
          return (
            d.title.toLowerCase().includes(q) ||
            d.category.toLowerCase().includes(q) ||
            subjName.includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [deadlines, filterStatus, searchQuery, subjectMap]);

  const renderUrgencyLabel = (d: Deadline) => {
    if (d.completed) return { text: 'Completed', color: 'var(--color-using)' };
    const delta = diffDays(today, d.date);
    if (delta < 0) return { text: `Overdue ${Math.abs(delta)}d`, color: 'var(--color-wasting)' };
    if (delta === 0) return { text: 'Due today', color: 'var(--color-online)' };
    if (delta <= 3) return { text: `Due in ${delta}d`, color: 'var(--color-online)' };
    return { text: `${delta}d left`, color: 'var(--text-secondary)' };
  };

  return (
    <div className="space-y-6">
      {/* Add Deadline Inline Panel */}
      {showForm && (
        <form onSubmit={handleCreateDeadline} className="theme-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Add Deadline or Exam Milestone</h2>
            <button
              type="button"
              onClick={closeForm}
              className="text-xs px-2.5 py-1 border theme-control"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., 2020 Physics Structured Paper Timed Run"
                className="w-full px-3 py-2 text-sm border theme-control bg-transparent focus:outline-none focus:ring-1"
                style={{ borderColor: 'var(--border-subtle)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Target Date
              </label>
              <input
                type="date"
                required
                value={dlDate}
                onChange={(e) => setDlDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-tabular border theme-control bg-transparent"
                style={{ borderColor: 'var(--border-subtle)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Subject
              </label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full px-3 py-2 text-sm border theme-control"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DeadlineCategory)}
                className="w-full px-3 py-2 text-sm border theme-control"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as DeadlinePriority)}
                className="w-full px-3 py-2 text-sm border theme-control"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Syllabus chapters, marking scheme focus..."
                className="w-full px-3 py-2 text-sm border theme-control bg-transparent focus:outline-none focus:ring-1"
                style={{ borderColor: 'var(--border-subtle)' }}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold theme-control"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              Save Deadline
            </button>
          </div>
        </form>
      )}

      {/* Main Split: Calendar Grid + Selected Day Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Monthly Calendar */}
        <div className="xl:col-span-2 theme-card overflow-hidden">
          <div
            className="px-5 py-3.5 border-b flex items-center justify-between gap-4"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <h2 className="font-display text-base font-semibold">{monthLabel}</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setViewYear(now.getFullYear());
                  setViewMonth(now.getMonth());
                  onSelectDate(today);
                }}
                className="px-2.5 py-1 text-xs font-medium border theme-control whitespace-nowrap"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                Today
              </button>
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 border theme-control"
                style={{ borderColor: 'var(--border-subtle)' }}
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 border theme-control"
                style={{ borderColor: 'var(--border-subtle)' }}
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-xs font-semibold"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calendarCells.map(({ dateStr, dayNum, inMonth }) => {
              const totals = computeDayTotals(days[dateStr]);
              const dayDls = deadlinesByDate.get(dateStr) ?? [];
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === today;
              const isExamDay = dateStr === examSettings.examDate;
              const metTarget = totals.usingMinutes >= examSettings.dailyTargetMinutes;

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => {
                    onSelectDate(dateStr);
                    setDlDate(dateStr);
                  }}
                  className="min-h-[88px] sm:min-h-[100px] p-2 border-r border-b text-left flex flex-col justify-between transition-colors hover:opacity-95"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    backgroundColor: isSelected
                      ? 'var(--accent-soft)'
                      : inMonth
                        ? 'var(--bg-surface)'
                        : 'var(--bg-subtle)',
                    opacity: inMonth ? 1 : 0.55,
                  }}
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span
                      className="font-mono-tabular text-xs font-semibold"
                      style={{
                        color: isToday ? 'var(--accent)' : 'var(--text-primary)',
                        textDecoration: isToday ? 'underline' : 'none',
                      }}
                    >
                      {dayNum}
                    </span>
                    {totals.usingMinutes > 0 && (
                      <span
                        className="font-mono-tabular text-[11px] font-semibold"
                        style={{
                          color: metTarget ? 'var(--color-using)' : 'var(--text-secondary)',
                        }}
                      >
                        {formatDecimalHours(totals.usingMinutes)}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 w-full overflow-hidden">
                    {isExamDay && (
                      <div
                        className="text-[10px] font-bold truncate"
                        style={{ color: 'var(--color-wasting)' }}
                      >
                        A/L Exam Day
                      </div>
                    )}
                    {dayDls.slice(0, 2).map((dl) => (
                      <div
                        key={dl.id}
                        className="text-[10px] font-medium truncate"
                        style={{
                          color: dl.completed ? 'var(--text-secondary)' : 'var(--accent)',
                          textDecoration: dl.completed ? 'line-through' : 'none',
                        }}
                      >
                        {dl.title}
                      </div>
                    ))}
                    {dayDls.length > 2 && (
                      <div
                        className="text-[10px]"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        +{dayDls.length - 2} more
                      </div>
                    )}
                    {totals.wastingMinutes > 0 && (
                      <div
                        className="font-mono-tabular text-[10px]"
                        style={{ color: 'var(--color-wasting)' }}
                      >
                        -{formatMinutes(totals.wastingMinutes)}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Inspector */}
        <div className="theme-card p-5 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                Selected Day
              </div>
              <h3 className="font-display text-lg font-semibold mt-0.5">
                {formatReadableDate(selectedDate)}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onOpenDayPlan(selectedDate)}
              className="px-3 py-1.5 text-xs font-semibold theme-control flex items-center gap-1.5 whitespace-nowrap shrink-0"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              <span>Open Day Sheet</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          <div
            className="grid grid-cols-2 gap-3 py-3 border-y text-xs"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div>
              <div style={{ color: 'var(--text-secondary)' }}>Using Time</div>
              <div
                className="font-mono-tabular text-base font-bold mt-0.5"
                style={{ color: 'var(--color-using)' }}
              >
                {formatMinutes(selectedDayTotals.usingMinutes)}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)' }}>Wasting Time</div>
              <div
                className="font-mono-tabular text-base font-bold mt-0.5"
                style={{ color: 'var(--color-wasting)' }}
              >
                {formatMinutes(selectedDayTotals.wastingMinutes)}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)' }}>Sleep Logged</div>
              <div className="font-mono-tabular text-sm font-semibold mt-0.5">
                {formatMinutes(selectedDayTotals.sleepMinutes)}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)' }}>Online Logged</div>
              <div className="font-mono-tabular text-sm font-semibold mt-0.5">
                {formatMinutes(selectedDayTotals.onlineMinutes)}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold">Deadlines on {selectedDate}</span>
              <button
                type="button"
                onClick={() => {
                  setDlDate(selectedDate);
                  setIsAdding(true);
                }}
                className="text-xs font-medium flex items-center gap-1 hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Here</span>
              </button>
            </div>
            {selectedDayDeadlines.length === 0 ? (
              <p className="text-xs py-2" style={{ color: 'var(--text-secondary)' }}>
                No deadlines scheduled on this date.
              </p>
            ) : (
              <ul className="space-y-2">
                {selectedDayDeadlines.map((dl) => {
                  const subj = subjectMap.get(dl.subjectId);
                  return (
                    <li
                      key={dl.id}
                      className="p-2.5 border theme-control flex items-start justify-between gap-2 text-xs"
                      style={{
                        borderColor: 'var(--border-subtle)',
                        backgroundColor: 'var(--bg-subtle)',
                      }}
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={() => onUpdateDeadline(dl.id, { completed: !dl.completed })}
                          className="mt-0.5 w-4 h-4 border theme-control flex items-center justify-center shrink-0"
                          style={{
                            borderColor: dl.completed ? 'var(--color-using)' : 'var(--border-strong)',
                            backgroundColor: dl.completed ? 'var(--color-using)' : 'transparent',
                            color: '#ffffff',
                          }}
                          aria-label="Toggle deadline completion"
                        >
                          {dl.completed && <Check className="w-3 h-3" />}
                        </button>
                        <div className="min-w-0">
                          <div
                            className="font-medium"
                            style={{
                              textDecoration: dl.completed ? 'line-through' : 'none',
                              color: dl.completed ? 'var(--text-secondary)' : 'var(--text-primary)',
                            }}
                          >
                            {dl.title}
                          </div>
                          <div className="mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                            {subj?.name ?? 'General'} · {dl.category} · {dl.priority}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Deadlines & Exam Milestones Table */}
      <div className="theme-card overflow-hidden">
        <div
          className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div>
            <h2 className="font-display text-base font-semibold">All Deadlines & Milestones</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Track past papers, mock exams, and syllabus checkpoints across your 9-month prep.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-secondary)' }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search deadlines..."
                className="pl-8 pr-3 py-1.5 text-xs border theme-control bg-transparent focus:outline-none focus:ring-1"
                style={{ borderColor: 'var(--border-subtle)' }}
              />
            </div>
            <div
              className="flex items-center p-0.5 border theme-control"
              style={{
                backgroundColor: 'var(--bg-subtle)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              {(['upcoming', 'completed', 'all'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilterStatus(status)}
                  className="px-2.5 py-1 text-xs font-medium theme-control capitalize whitespace-nowrap"
                  style={{
                    backgroundColor: filterStatus === status ? 'var(--bg-surface)' : 'transparent',
                    color:
                      filterStatus === status ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredDeadlines.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <div className="text-sm font-medium">No matching deadlines</div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Add past paper packs, syllabus unit deadlines, or mock exam dates to stay on track.
            </p>
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="mt-2 px-3 py-1.5 text-xs font-semibold theme-control"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              Add First Deadline
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Stacked Deadlines (< md) */}
            <div className="md:hidden divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {filteredDeadlines.map((dl) => {
                const subj = subjectMap.get(dl.subjectId);
                const urgency = renderUrgencyLabel(dl);
                return (
                  <div
                    key={dl.id}
                    className="p-4 flex items-start justify-between gap-3"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => onUpdateDeadline(dl.id, { completed: !dl.completed })}
                        className="mt-0.5 w-5 h-5 border theme-control flex items-center justify-center shrink-0"
                        style={{
                          borderColor: dl.completed ? 'var(--color-using)' : 'var(--border-strong)',
                          backgroundColor: dl.completed ? 'var(--color-using)' : 'transparent',
                          color: '#ffffff',
                        }}
                        aria-label={`Mark ${dl.title} complete`}
                      >
                        {dl.completed && <Check className="w-3.5 h-3.5" />}
                      </button>
                      <div className="min-w-0 space-y-1">
                        <div
                          className="text-sm font-medium"
                          style={{
                            textDecoration: dl.completed ? 'line-through' : 'none',
                            color: dl.completed ? 'var(--text-secondary)' : 'var(--text-primary)',
                          }}
                        >
                          {dl.title}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <span>{subj?.name ?? 'General'}</span>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span>{dl.category}</span>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span className="font-mono-tabular">{dl.date}</span>
                        </div>
                        <div className="text-xs font-semibold" style={{ color: urgency.color }}>
                          {urgency.text}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteDeadline(dl.id)}
                      className="p-1.5 theme-control hover:opacity-80 shrink-0"
                      style={{ color: 'var(--text-secondary)' }}
                      aria-label={`Delete ${dl.title}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (>= md) */}
            <div className="hidden md:block">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    className="border-b text-xs font-semibold"
                    style={{
                      backgroundColor: 'var(--bg-subtle)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <th className="px-4 py-2.5 w-10">Done</th>
                    <th className="px-4 py-2.5">Deadline</th>
                    <th className="px-4 py-2.5">Subject & Type</th>
                    <th className="px-4 py-2.5">Due Date</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeadlines.map((dl) => {
                    const subj = subjectMap.get(dl.subjectId);
                    const urgency = renderUrgencyLabel(dl);
                    return (
                      <tr
                        key={dl.id}
                        className="border-b text-sm"
                        style={{ borderColor: 'var(--border-subtle)' }}
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => onUpdateDeadline(dl.id, { completed: !dl.completed })}
                            className="w-5 h-5 border theme-control flex items-center justify-center"
                            style={{
                              borderColor: dl.completed ? 'var(--color-using)' : 'var(--border-strong)',
                              backgroundColor: dl.completed ? 'var(--color-using)' : 'transparent',
                              color: '#ffffff',
                            }}
                            aria-label={`Mark ${dl.title} complete`}
                          >
                            {dl.completed && <Check className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div
                            className="font-medium"
                            style={{
                              textDecoration: dl.completed ? 'line-through' : 'none',
                              color: dl.completed ? 'var(--text-secondary)' : 'var(--text-primary)',
                            }}
                          >
                            {dl.title}
                          </div>
                          {dl.notes && (
                            <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                              {dl.notes}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <span>{subj?.name ?? 'General'}</span>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span>{dl.category}</span>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span>{dl.priority}</span>
                        </td>
                        <td className="px-4 py-3 font-mono-tabular text-xs">{dl.date}</td>
                        <td
                          className="px-4 py-3 text-xs font-semibold whitespace-nowrap"
                          style={{ color: urgency.color }}
                        >
                          {urgency.text}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => onDeleteDeadline(dl.id)}
                            className="p-1.5 theme-control hover:opacity-80"
                            style={{ color: 'var(--text-secondary)' }}
                            aria-label={`Delete ${dl.title}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
