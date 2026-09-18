import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Sparkles,
  Layers,
  GraduationCap,
  BookOpen,
  CalendarDays,
  Clock,
  CheckCircle2,
  HelpCircle,
  FileSpreadsheet,
  AlertTriangle
} from 'lucide-react';
import { DatabaseState, KaldikEvent, DayOfWeek, ResolvedSlot, Period } from '../../types';
import { computeResolvedSlots } from '../../utils/scheduleEngine';
import { KaldikEventModal } from './KaldikEventModal';
import { KaldikDaySummaryModal } from './KaldikDaySummaryModal';

interface KaldikViewProps {
  db: DatabaseState;
  onUpdateDb: React.Dispatch<React.SetStateAction<DatabaseState>>;
  isAdmin?: boolean;
  onOpenAdminLogin?: () => void;
}

const INDONESIAN_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const WEEKDAY_COLUMNS: { name: string; day: DayOfWeek; isWeekend?: boolean }[] = [
  { name: 'Senin', day: 'Monday' },
  { name: 'Selasa', day: 'Tuesday' },
  { name: 'Rabu', day: 'Wednesday' },
  { name: 'Kamis', day: 'Thursday' },
  { name: 'Jumat', day: 'Friday' },
  { name: 'Sabtu', day: 'Saturday', isWeekend: true },
  { name: 'Ahad', day: 'Sunday', isWeekend: true }
];

const DAY_NAME_MAP: Record<number, DayOfWeek> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday'
};

export const KaldikView: React.FC<KaldikViewProps> = ({
  db,
  onUpdateDb,
  isAdmin = true,
  onOpenAdminLogin
}) => {
  // Calendar View State: Year and Month (0-11)
  // Default to September 2026 to match initial sample data, or current date if in range
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(8); // 8 is September (0-indexed)

  // Filters
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState<string>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');

  // Modals state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<KaldikEvent | null>(null);
  const [eventModalDefaultDate, setEventModalDefaultDate] = useState<string | undefined>(undefined);

  const [selectedDaySummaryDate, setSelectedDaySummaryDate] = useState<string | null>(null);

  // Compute resolved slots for class timetable rules
  const allResolvedSlots = useMemo(() => {
    return computeResolvedSlots(db.rules);
  }, [db.rules]);

  // All events list from database
  const events = useMemo(() => {
    return db.kaldikEvents || [];
  }, [db.kaldikEvents]);

  // Navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  // Check which periods intersect with this month
  const monthStartStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthEndStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInCurrentMonth).padStart(2, '0')}`;

  const periodsInMonth = useMemo(() => {
    return db.periods.filter((p) => {
      return p.startDate <= monthEndStr && p.endDate >= monthStartStr;
    });
  }, [db.periods, monthStartStr, monthEndStr]);

  // Generate calendar grid days for this month (starting on Monday)
  const calendarDays = useMemo(() => {
    const days: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      dayOfWeek: DayOfWeek;
      activePeriods: Period[];
      events: KaldikEvent[];
      classSlots: ResolvedSlot[];
    }[] = [];

    const todayStr = new Date().toISOString().slice(0, 10);

    // First day of current month
    const firstDay = new Date(currentYear, currentMonth, 1);
    // Sunday is 0, Monday is 1 ... we want Monday to be index 0
    let startDayOfWeek = firstDay.getDay(); // 0 (Sun) to 6 (Sat)
    let leadDays = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    // Previous month filler days
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = leadDays - 1; i >= 0; i--) {
      const pDay = prevMonthLastDay - i;
      const pMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const pYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${pYear}-${String(pMonth + 1).padStart(2, '0')}-${String(pDay).padStart(2, '0')}`;
      const dObj = new Date(dateStr + 'T00:00:00');
      const dayOfWeek = DAY_NAME_MAP[dObj.getDay()];

      days.push({
        dateStr,
        dayNumber: pDay,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        dayOfWeek,
        activePeriods: [],
        events: [],
        classSlots: []
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dObj = new Date(dateStr + 'T00:00:00');
      const dayOfWeek = DAY_NAME_MAP[dObj.getDay()];

      // Filter active academic periods for this date
      const activePeriods = db.periods.filter(
        (p) => dateStr >= p.startDate && dateStr <= p.endDate
      );

      // Filter events occurring on this date
      const dayEvents = events.filter((evt) => {
        // If event type filter is active
        if (eventTypeFilter === 'kbm' && !evt.isKbm) return false;
        if (eventTypeFilter === 'holiday' && evt.type !== 'holiday') return false;
        if (eventTypeFilter === 'exam' && evt.type !== 'exam') return false;
        if (eventTypeFilter === 'activity' && evt.type !== 'activity') return false;

        // Check period filter
        if (selectedPeriodFilter !== 'all' && evt.periodId && evt.periodId !== selectedPeriodFilter) {
          return false;
        }

        // Recurring event check
        if (evt.isRecurring) {
          if (evt.daysOfWeek && evt.daysOfWeek.includes(dayOfWeek)) {
            let start = evt.startDate;
            let end = evt.endDate;
            if (evt.isKbm) {
              const livePeriod = evt.periodId ? db.periods.find((p) => p.id === evt.periodId) : undefined;
              if (livePeriod) {
                start = livePeriod.startDate;
                end = livePeriod.endDate;
              }
            }
            if (start && dateStr < start) return false;
            if (end && dateStr > end) return false;
            return true;
          }
          return false;
        }

        // Standard range check: For KBM events, look up active date range live from db.periods
        let start = evt.startDate;
        let end = evt.endDate || evt.startDate;

        if (evt.isKbm) {
          const livePeriod = evt.periodId ? db.periods.find((p) => p.id === evt.periodId) : undefined;
          if (livePeriod) {
            start = livePeriod.startDate;
            end = livePeriod.endDate;
          }
        }

        return dateStr >= start && dateStr <= end;
      });

      // Filter class slots scheduled on this weekday and period:
      // Sessions can strictly ONLY occur on dates that fall within an active academic period!
      // If a date has no active period (or falls outside the selected period filter),
      // classSlots MUST be empty ([]) according to the scheduling rules.
      let classSlots: ResolvedSlot[] = [];

      const applicablePeriods = selectedPeriodFilter !== 'all'
        ? activePeriods.filter((p) => p.id === selectedPeriodFilter)
        : activePeriods;

      if (applicablePeriods.length > 0) {
        const activePids = applicablePeriods.map((p) => p.id);
        classSlots = allResolvedSlots.filter(
          (slot) => slot.day === dayOfWeek && activePids.includes(slot.periodId)
        );

        // Hardening (Fix 4): RuleId dedup step to defend against future period overlaps
        // so that the same rule isn't counted twice for one calendar date
        const seenRuleIds = new Set<string>();
        classSlots = classSlots.filter((slot) => {
          if (!slot.ruleId) return true;
          if (seenRuleIds.has(slot.ruleId)) return false;
          seenRuleIds.add(slot.ruleId);
          return true;
        });
      }

      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        dayOfWeek,
        activePeriods,
        events: dayEvents,
        classSlots
      });
    }

    // Trailing days to fill 5 or 6 rows (multiple of 7)
    const totalCurrentCount = days.length;
    const targetCount = totalCurrentCount <= 35 ? 35 : 42;
    const nextDaysNeeded = targetCount - totalCurrentCount;
    for (let n = 1; n <= nextDaysNeeded; n++) {
      const nMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${nYear}-${String(nMonth + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
      const dObj = new Date(dateStr + 'T00:00:00');
      const dayOfWeek = DAY_NAME_MAP[dObj.getDay()];

      days.push({
        dateStr,
        dayNumber: n,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        dayOfWeek,
        activePeriods: [],
        events: [],
        classSlots: []
      });
    }

    return days;
  }, [
    currentYear,
    currentMonth,
    daysInCurrentMonth,
    db.periods,
    events,
    allResolvedSlots,
    selectedPeriodFilter,
    eventTypeFilter
  ]);

  // Handle Event Saving
  const handleSaveEvent = (savedEvent: KaldikEvent) => {
    onUpdateDb((prev) => {
      const currentList = prev.kaldikEvents || [];
      const existsIndex = currentList.findIndex((e) => e.id === savedEvent.id);
      let nextEvents: KaldikEvent[];
      if (existsIndex >= 0) {
        nextEvents = currentList.map((e) => (e.id === savedEvent.id ? savedEvent : e));
      } else {
        nextEvents = [savedEvent, ...currentList];
      }
      return {
        ...prev,
        kaldikEvents: nextEvents
      };
    });
  };

  // Handle Event Deleting
  const handleDeleteEvent = (id: string) => {
    onUpdateDb((prev) => ({
      ...prev,
      kaldikEvents: (prev.kaldikEvents || []).filter((e) => e.id !== id)
    }));
  };

  // Calculate monthly stats
  const monthlyStats = useMemo(() => {
    let kbmDaysCount = 0;
    let holidayCount = 0;
    let examCount = 0;
    let totalSessions = 0;

    for (const d of calendarDays) {
      if (!d.isCurrentMonth) continue;
      if (d.activePeriods.length > 0 || d.events.some((e) => e.isKbm)) {
        kbmDaysCount++;
      }
      if (d.events.some((e) => e.type === 'holiday')) {
        holidayCount++;
      }
      if (d.events.some((e) => e.type === 'exam')) {
        examCount++;
      }
      totalSessions += d.classSlots.length;
    }

    return {
      kbmDaysCount,
      holidayCount,
      examCount,
      totalSessions
    };
  }, [calendarDays]);

  // Selected Day data for summary modal
  const selectedDayData = useMemo(() => {
    if (!selectedDaySummaryDate) return null;
    const found = calendarDays.find((d) => d.dateStr === selectedDaySummaryDate);
    if (!found) return null;
    return found;
  }, [selectedDaySummaryDate, calendarDays]);

  return (
    <div className="space-y-4">
      {/* Top Header & Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left Title & Status */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Kalender Pendidikan (Kaldik)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  IJMA 2026/2027
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Ringkasan bulanan kegiatan akademik, masa KBM resmi, libur ma’had, dan asesmen evaluasi.
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Period Filter Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
              <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedPeriodFilter}
                onChange={(e) => setSelectedPeriodFilter(e.target.value)}
                className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer text-xs"
              >
                <option value="all">Semua Periode</option>
                {db.periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Event Type Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer text-xs"
              >
                <option value="all">Semua Kategori</option>
                <option value="kbm">Hanya KBM</option>
                <option value="holiday">Hanya Libur</option>
                <option value="exam">Hanya Ujian</option>
                <option value="activity">Hanya Agenda</option>
              </select>
            </div>

            {/* Primary Action Button: "Event Baru" */}
            <button
              type="button"
              id="kaldik-add-event-btn"
              onClick={() => {
                setEditingEvent(null);
                setEventModalDefaultDate(
                  `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
                );
                setIsEventModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Event Baru</span>
            </button>
          </div>
        </div>

        {/* Navigation & Month Selector Bar */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
              title="Bulan Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              <select
                value={currentMonth}
                onChange={(e) => setCurrentMonth(Number(e.target.value))}
                className="text-sm font-black text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {INDONESIAN_MONTHS.map((mName, idx) => (
                  <option key={mName} value={idx}>
                    {mName}
                  </option>
                ))}
              </select>

              <select
                value={currentYear}
                onChange={(e) => setCurrentYear(Number(e.target.value))}
                className="text-sm font-black text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {[2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
              title="Bulan Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleToday}
              className="px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer"
            >
              Hari Ini
            </button>
          </div>

          {/* Monthly KPI Stats Strip */}
          <div className="flex items-center gap-3 text-xs overflow-x-auto pb-1 sm:pb-0">
            <div className="flex items-center gap-1.5 text-amber-900 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-lg">
              <GraduationCap className="w-3.5 h-3.5 text-amber-600" />
              <span className="font-bold">{monthlyStats.kbmDaysCount}</span>
              <span className="text-[11px] text-amber-800">Hari KBM</span>
            </div>

            <div className="flex items-center gap-1.5 text-rose-900 bg-rose-50 border border-rose-200/80 px-2.5 py-1 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span className="font-bold">{monthlyStats.holidayCount}</span>
              <span className="text-[11px] text-rose-800">Hari Libur</span>
            </div>

            <div className="flex items-center gap-1.5 text-indigo-900 bg-indigo-50 border border-indigo-200/80 px-2.5 py-1 rounded-lg">
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span className="font-bold">{monthlyStats.totalSessions}</span>
              <span className="text-[11px] text-indigo-800">Sesi Pelajaran</span>
            </div>
          </div>
        </div>

        {/* Active Periods Banner in this Month */}
        {periodsInMonth.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span>Periode Berjalan:</span>
            </span>
            {periodsInMonth.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200"
              >
                <span>{p.name}</span>
                <span className="text-[10px] text-amber-700 font-mono">
                  ({p.startDate} s.d. {p.endDate})
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Main Month Calendar Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Days of Week Column Headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center text-xs font-bold text-slate-700">
          {WEEKDAY_COLUMNS.map((col) => (
            <div
              key={col.name}
              className={`py-2.5 border-r border-slate-200/70 last:border-r-0 ${
                col.isWeekend ? 'bg-slate-100/60 text-rose-600' : ''
              }`}
            >
              <span>{col.name}</span>
            </div>
          ))}
        </div>

        {/* Calendar Day Cells */}
        <div className="grid grid-cols-7 divide-y divide-slate-200/70 auto-rows-fr">
          {calendarDays.map((d, index) => {
            const isWeekend = d.dayOfWeek === 'Saturday' || d.dayOfWeek === 'Sunday';
            const isKbmActive = d.activePeriods.length > 0 || d.events.some((e) => e.isKbm);
            const holidayEvent = d.events.find((e) => e.type === 'holiday');

            return (
              <div
                key={`${d.dateStr}-${index}`}
                onClick={() => {
                  if (d.isCurrentMonth) {
                    setSelectedDaySummaryDate(d.dateStr);
                  }
                }}
                className={`min-h-[120px] p-2 border-r border-slate-200/70 last:border-r-0 relative group transition-colors flex flex-col justify-between ${
                  !d.isCurrentMonth
                    ? 'bg-slate-50/40 text-slate-300 pointer-events-none'
                    : isWeekend
                    ? 'bg-slate-50/30 hover:bg-amber-50/40 cursor-pointer'
                    : 'bg-white hover:bg-indigo-50/30 cursor-pointer'
                } ${d.isToday ? 'ring-2 ring-inset ring-amber-500 bg-amber-50/20' : ''}`}
              >
                {/* Cell Header: Day number & Quick Add */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs font-bold leading-none ${
                          d.isToday
                            ? 'w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-2xs font-black'
                            : !d.isCurrentMonth
                            ? 'text-slate-300'
                            : isWeekend
                            ? 'text-rose-600'
                            : 'text-slate-800'
                        }`}
                      >
                        {d.dayNumber}
                      </span>

                      {d.isToday && (
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                          Hari Ini
                        </span>
                      )}
                    </div>

                    {/* Quick add event button on cell hover */}
                    {d.isCurrentMonth && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingEvent(null);
                          setEventModalDefaultDate(d.dateStr);
                          setIsEventModalOpen(true);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-all cursor-pointer"
                        title="Tambah Event pada Tanggal Ini"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* KBM Period Indicator Pill */}
                  {d.isCurrentMonth && isKbmActive && !holidayEvent && (
                    <div className="mb-1">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100/90 text-amber-900 border border-amber-300/80 w-full truncate">
                        <GraduationCap className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                        <span className="truncate">
                          {d.activePeriods[0]?.name ? `KBM: ${d.activePeriods[0].name}` : 'KBM Aktif'}
                        </span>
                      </span>
                    </div>
                  )}

                  {/* Event Badges */}
                  <div className="space-y-1">
                    {d.events.slice(0, 3).map((evt) => {
                      const isKbmMissingPeriod = Boolean(
                        evt.isKbm && (!evt.periodId || !db.periods.some((p) => p.id === evt.periodId))
                      );

                      return (
                        <div
                          key={evt.id}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold truncate flex items-center gap-1 shadow-2xs ${
                            isKbmMissingPeriod
                              ? 'border border-dashed border-amber-500 bg-amber-50 text-amber-900'
                              : ''
                          }`}
                          style={{
                            backgroundColor: isKbmMissingPeriod ? undefined : `${evt.color || '#6366F1'}15`,
                            color: isKbmMissingPeriod ? undefined : (evt.color || '#6366F1'),
                            borderLeft: isKbmMissingPeriod ? undefined : `3px solid ${evt.color || '#6366F1'}`
                          }}
                          title={
                            isKbmMissingPeriod
                              ? `${evt.title} (Peringatan: Periode tidak ditemukan atau telah dihapus)`
                              : evt.title
                          }
                        >
                          {isKbmMissingPeriod && (
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                          )}
                          <span className="truncate">{evt.title}</span>
                        </div>
                      );
                    })}

                    {d.events.length > 3 && (
                      <span className="text-[9px] font-bold text-slate-500 block px-1">
                        +{d.events.length - 3} agenda lainnya
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Day Cell Summary: Timetable Lessons Count */}
                {d.isCurrentMonth && (
                  <div className="pt-1.5 mt-1 border-t border-slate-100/80 flex items-center justify-between text-[10px] text-slate-500">
                    {holidayEvent ? (
                      <span className="text-rose-600 font-semibold truncate">Libur</span>
                    ) : d.classSlots.length > 0 ? (
                      <span className="font-medium text-slate-600 flex items-center gap-1 truncate">
                        <BookOpen className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{d.classSlots.length} Sesi KBM</span>
                      </span>
                    ) : (
                      <span className="text-slate-300">Tidak ada sesi</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Event Add/Edit Modal */}
      <KaldikEventModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        initialEvent={editingEvent}
        defaultDate={eventModalDefaultDate}
        periods={db.periods}
      />

      {/* Day Details / Summary Modal */}
      {selectedDayData && (
        <KaldikDaySummaryModal
          isOpen={Boolean(selectedDaySummaryDate)}
          dateStr={selectedDayData.dateStr}
          events={selectedDayData.events}
          slots={selectedDayData.classSlots}
          db={db}
          onClose={() => setSelectedDaySummaryDate(null)}
          onAddEvent={(dateStr) => {
            setEditingEvent(null);
            setEventModalDefaultDate(dateStr);
            setIsEventModalOpen(true);
          }}
          onEditEvent={(evt) => {
            setEditingEvent(evt);
            setIsEventModalOpen(true);
          }}
          onDeleteEvent={(id) => {
            handleDeleteEvent(id);
          }}
        />
      )}
    </div>
  );
};
