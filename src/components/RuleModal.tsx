import React, { useState, useEffect } from 'react';
import {
  DatabaseState,
  ScheduleRule,
  RuleException,
  DayOfWeek
} from '../types';
import {
  X,
  Zap,
  Plus,
  Trash2,
  AlertCircle,
  Save,
  Clock,
  Repeat,
  Layers,
  GraduationCap,
  Users,
  DoorOpen
} from 'lucide-react';

interface RuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rule: ScheduleRule) => void;
  onDelete?: (ruleId: string) => void;
  db: DatabaseState;
  editingRule?: ScheduleRule | null;
  prefill?: {
    day?: DayOfWeek;
    periodId?: string;
    sessionId?: string;
    classId?: string;
    subjectId?: string;
  };
}

export const RuleModal: React.FC<RuleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  db,
  editingRule,
  prefill
}) => {
  if (!isOpen) return null;

  const [subjectId, setSubjectId] = useState(
    editingRule?.subjectId || prefill?.subjectId || (db.subjects[0]?.id || '')
  );
  const [classId, setClassId] = useState(
    editingRule?.classId || prefill?.classId || (db.classes[0]?.id || '')
  );
  const [teacherId, setTeacherId] = useState(
    editingRule?.teacherId || (db.teachers[0]?.id || '')
  );
  const [roomId, setRoomId] = useState(
    editingRule?.roomId || (db.rooms[0]?.id || '')
  );
  const [sessionId, setSessionId] = useState(
    editingRule?.sessionId || prefill?.sessionId || (db.sessions[0]?.id || '')
  );
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(() => {
    if (editingRule?.daysOfWeek && editingRule.daysOfWeek.length > 0) {
      return editingRule.daysOfWeek;
    }
    if (editingRule?.dayOfWeek) {
      return [editingRule.dayOfWeek];
    }
    if (prefill?.day) {
      return [prefill.day];
    }
    return ['Monday'];
  });
  const [periodIds, setPeriodIds] = useState<string[]>(
    editingRule?.periodIds || (prefill?.periodId ? [prefill.periodId] : ['prd-1'])
  );
  const [repeatDetail, setRepeatDetail] = useState<'Weekly' | 'Bi-Weekly' | 'Custom'>(
    editingRule?.repeatDetail || 'Weekly'
  );
  const [active, setActive] = useState(editingRule ? editingRule.active : true);
  const [notes, setNotes] = useState(editingRule?.notes || '');
  const [exceptions, setExceptions] = useState<RuleException[]>(
    editingRule?.exceptions ? [...editingRule.exceptions] : []
  );
  const [showExceptions, setShowExceptions] = useState(false);

  // Auto-fill default teacher/room if new rule and subject changes
  const handleSubjectChange = (newSubjectId: string) => {
    setSubjectId(newSubjectId);
    if (!editingRule) {
      const subject = db.subjects.find((s) => s.id === newSubjectId);
      if (subject?.defaultTeacherId) setTeacherId(subject.defaultTeacherId);
      if (subject?.defaultRoomId) setRoomId(subject.defaultRoomId);
    }
  };

  const togglePeriod = (pId: string) => {
    if (periodIds.includes(pId)) {
      if (periodIds.length > 1) {
        setPeriodIds(periodIds.filter((id) => id !== pId));
        // Remove exceptions for this period if any
        setExceptions(exceptions.filter((e) => e.periodId !== pId));
      }
    } else {
      const nextPids = [...periodIds, pId];
      const periodOrder = new Map<string, number>(db.periods.map((p, idx) => [p.id, p.periodNumber ?? idx]));
      nextPids.sort((a, b) => (periodOrder.get(a) ?? 999) - (periodOrder.get(b) ?? 999));
      setPeriodIds(nextPids);
    }
  };

  const addException = () => {
    const availablePeriod = periodIds[0] || db.periods[0]?.id || 'prd-1';
    const otherSession = db.sessions.find((s) => s.id !== sessionId) || db.sessions[0];

    const newException: RuleException = {
      id: `exc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ruleId: editingRule?.id || 'temp-rule-id',
      periodId: availablePeriod,
      overrideSessionId: otherSession?.id || sessionId,
      overrideRoomId: '',
      overrideTeacherId: '',
      note: 'Period relocated to alternate session'
    };

    setExceptions([...exceptions, newException]);
  };

  const updateException = (idx: number, updates: Partial<RuleException>) => {
    const next = [...exceptions];
    next[idx] = { ...next[idx], ...updates };
    setExceptions(next);
  };

  const removeException = (idx: number) => {
    setExceptions(exceptions.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!subjectId || !classId || !teacherId || !roomId || !sessionId || periodIds.length === 0) {
      return;
    }

    const periodOrder = new Map<string, number>(db.periods.map((p, idx) => [p.id, p.periodNumber ?? idx]));
    const sortedPeriodIds = [...periodIds].sort((a, b) => (periodOrder.get(a) ?? 999) - (periodOrder.get(b) ?? 999));

    const ruleToSave: ScheduleRule = {
      id: editingRule?.id || `rule-${Date.now()}`,
      subjectId,
      classId,
      teacherId,
      roomId,
      sessionId,
      dayOfWeek: selectedDays[0] || 'Monday',
      daysOfWeek: selectedDays,
      periodIds: sortedPeriodIds,
      repeatDetail,
      active,
      exceptions,
      notes: notes.trim() || undefined,
      createdAt: editingRule?.createdAt || new Date().toISOString()
    };

    onSave(ruleToSave);
  };

  const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const toggleDay = (day: DayOfWeek) => {
    if (selectedDays.includes(day)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== day));
      }
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const selectDayPreset = (preset: 'all' | 'mtw' | 'mwf' | 'tt') => {
    if (preset === 'all') {
      setSelectedDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    } else if (preset === 'mtw') {
      setSelectedDays(['Monday', 'Tuesday', 'Wednesday']);
    } else if (preset === 'mwf') {
      setSelectedDays(['Monday', 'Wednesday', 'Friday']);
    } else if (preset === 'tt') {
      setSelectedDays(['Tuesday', 'Thursday']);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden transition-all my-8">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <span>{editingRule ? 'Edit Schedule Rule & Exceptions' : 'Create New Schedule Rule'}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure subject timetable allocation with period-level exceptions & repeating cadence.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Subject & Class Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                <span>Subject</span>
              </label>
              <select
                id="modal-subject-select"
                value={subjectId}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                required
              >
                {db.subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} ({sub.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                <span>Class / Student Cohort</span>
              </label>
              <select
                id="modal-class-select"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                required
              >
                {db.classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} (Grade {cls.grade} • {cls.studentCount} students)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Teacher & Room Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Assigned Teacher</span>
              </label>
              <select
                id="modal-teacher-select"
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                required
              >
                {db.teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.panggilan ? ` (${t.panggilan})` : ''} ({t.department})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <DoorOpen className="w-3.5 h-3.5 text-slate-400" />
                <span>Classroom / Lab</span>
              </label>
              <select
                id="modal-room-select"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                required
              >
                {db.rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.type} • Cap: {r.capacity})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Timing, Cadence & Dedicated Periods Column in 2-Column Layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            {/* Column 1 (Left): Session, Repeat, and Days */}
            <div className="space-y-3">
              {/* Primary Session */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Session (Time Slot)</span>
                </label>
                <select
                  id="modal-session-select"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                >
                  {db.sessions
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.startTime} - {s.endTime})
                      </option>
                    ))}
                </select>
              </div>

              {/* Repeating Cadence */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Repeat className="w-3.5 h-3.5 text-slate-400" />
                  <span>Cadence / Repeat</span>
                </label>
                <select
                  id="modal-repeat-select"
                  value={repeatDetail}
                  onChange={(e) => setRepeatDetail(e.target.value as any)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                >
                  <option value="Weekly">Weekly (Every Week)</option>
                  <option value="Bi-Weekly">Bi-Weekly (Alternate)</option>
                  <option value="Custom">Custom / Block Scheduling</option>
                </select>
              </div>

              {/* Days Selection with 4 Presets (M-F, MTW, MWF, TT) - Only when Weekly */}
              {repeatDetail === 'Weekly' && (
                <div className="pt-0.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-slate-600">
                      Days ({selectedDays.length})
                    </span>
                    <div className="flex items-center gap-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => selectDayPreset('all')}
                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 font-medium transition-colors cursor-pointer"
                        title="Monday to Friday"
                      >
                        M-F
                      </button>
                      <button
                        type="button"
                        onClick={() => selectDayPreset('mtw')}
                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 font-medium transition-colors cursor-pointer"
                        title="Monday, Tuesday, Wednesday"
                      >
                        MTW
                      </button>
                      <button
                        type="button"
                        onClick={() => selectDayPreset('mwf')}
                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 font-medium transition-colors cursor-pointer"
                        title="Monday, Wednesday, Friday"
                      >
                        MWF
                      </button>
                      <button
                        type="button"
                        onClick={() => selectDayPreset('tt')}
                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 font-medium transition-colors cursor-pointer"
                        title="Tuesday, Thursday"
                      >
                        TT
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {days.map((d) => {
                      const isSelected = selectedDays.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleDay(d)}
                          title={d}
                          className={`py-1 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {d.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Column 2 (Right): Dedicated Column for Periods with Vertical List Style and Checkboxes */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span>Periods ({periodIds.length}/{db.periods.length} selected)</span>
                </label>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setPeriodIds(db.periods.map((p) => p.id))}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                  >
                    All
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={() => setPeriodIds([db.periods[0]?.id].filter(Boolean))}
                    className="text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Vertical Stacked List Style with Checkboxes (No bulky cards) */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-lg divide-y divide-slate-200/60 overflow-hidden shadow-2xs">
                {db.periods
                  .slice()
                  .sort((a, b) => a.periodNumber - b.periodNumber)
                  .map((p) => {
                    const isSelected = periodIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center gap-2.5 px-2.5 py-1.5 cursor-pointer transition-colors text-xs select-none ${
                          isSelected
                            ? 'bg-indigo-50/90 text-indigo-950 font-medium'
                            : 'hover:bg-white text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => togglePeriod(p.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer shrink-0"
                        />
                        <span className="font-semibold text-slate-800">{p.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal ml-auto shrink-0">
                          {p.startDate} - {p.endDate}
                        </span>
                      </label>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Notes & Active Status */}
          <div className="space-y-2.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Rule Notes / Comments
              </label>
              <input
                id="modal-notes-input"
                type="text"
                placeholder="Optional notes regarding syllabus, co-teaching, or room constraints..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="modal-active-checkbox"
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
              />
              <label htmlFor="modal-active-checkbox" className="text-xs font-medium text-slate-700 cursor-pointer">
                Rule is Active in Timetable
              </label>
            </div>
          </div>

          {/* RULE EXCEPTIONS SECTION - Shifted Below Notes with Small Checkbox Toggle */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label
                htmlFor="modal-toggle-exceptions-checkbox"
                className="flex items-center gap-2 text-xs font-medium text-slate-700 hover:text-slate-900 cursor-pointer select-none"
              >
                <input
                  id="modal-toggle-exceptions-checkbox"
                  type="checkbox"
                  checked={showExceptions}
                  onChange={(e) => setShowExceptions(e.target.checked)}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Rule Exceptions (Special Period Overrides)</span>
                </span>
                {exceptions.length > 0 && (
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full border border-amber-200">
                    {exceptions.length} aktif
                  </span>
                )}
              </label>

              {showExceptions && (
                <button
                  type="button"
                  id="modal-add-exception-btn"
                  onClick={addException}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-white border border-amber-300 text-amber-900 rounded-md hover:bg-amber-100 shadow-2xs transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Exception</span>
                </button>
              )}
            </div>

            {showExceptions && (
              <div className="mt-2.5 p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3">
                <p className="text-[11px] text-amber-800/90">
                  Override Session, Room, or Teacher for specific periods (e.g. Science in Session 1, except Period 3 which is in Session 3).
                </p>

                {exceptions.length === 0 ? (
                  <p className="text-xs text-amber-700/70 italic py-1">
                    No exceptions added. The primary session ({db.sessions.find((s) => s.id === sessionId)?.name || 'Session'}) and room apply to all selected periods.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {exceptions.map((exc, idx) => (
                      <div
                        key={exc.id}
                        className="p-3 bg-white rounded-lg border border-amber-200/90 shadow-2xs space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-900">
                            Exception #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeException(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              When Period is:
                            </label>
                            <select
                              value={exc.periodId}
                              onChange={(e) => updateException(idx, { periodId: e.target.value })}
                              className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1.5 font-medium"
                            >
                              {periodIds.map((pid) => (
                                <option key={pid} value={pid}>
                                  {db.periods.find((p) => p.id === pid)?.name || pid}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-indigo-700 mb-1">
                              Override Session:
                            </label>
                            <select
                              value={exc.overrideSessionId || ''}
                              onChange={(e) =>
                                updateException(idx, {
                                  overrideSessionId: e.target.value || undefined
                                })
                              }
                              className="w-full text-xs bg-indigo-50/50 border border-indigo-200 rounded px-2 py-1.5 font-medium text-indigo-900"
                            >
                              <option value="">(Keep Base Session)</option>
                              {db.sessions
                                .slice()
                                .sort((a, b) => a.order - b.order)
                                .map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Override Room (Optional):
                            </label>
                            <select
                              value={exc.overrideRoomId || ''}
                              onChange={(e) =>
                                updateException(idx, {
                                  overrideRoomId: e.target.value || undefined
                                })
                              }
                              className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1.5 font-medium"
                            >
                              <option value="">(Keep Base Room)</option>
                              {db.rooms.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <input
                            type="text"
                            placeholder="Reason / Note (e.g. Afternoon computer-assisted lab)"
                            value={exc.note || ''}
                            onChange={(e) => updateException(idx, { note: e.target.value })}
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-700 placeholder:text-slate-400"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-2.5">
            <div>
              {editingRule && onDelete && (
                <button
                  type="button"
                  id="modal-delete-rule-btn"
                  onClick={() => onDelete(editingRule.id)}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                  title="Hapus aturan jadwal ini dari sistem"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Hapus Aturan</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="modal-save-rule-btn"
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{editingRule ? 'Update Rule' : 'Save Rule'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
