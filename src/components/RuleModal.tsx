import React, { useState, useMemo } from 'react';
import {
  DatabaseState,
  ScheduleRule,
  DayOfWeek
} from '../types';
import {
  X,
  Plus,
  Trash2,
  AlertCircle,
  Save,
  Clock,
  Repeat,
  Layers,
  GraduationCap,
  Users,
  DoorOpen,
  Calendar,
  Sparkles
} from 'lucide-react';
import { getNormalizedDateRangesForRule, formatDateRangesSummary } from '../utils/dateNormalizer';

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

  // Normalized date range preview for selected presets
  const normalizedDateRanges = useMemo(() => {
    const dummyRule: ScheduleRule = {
      id: 'temp',
      subjectId: '',
      classId: '',
      teacherId: '',
      roomId: '',
      sessionId: '',
      periodIds,
      repeatDetail: 'Weekly',
      active: true
    };
    return getNormalizedDateRangesForRule(dummyRule, db.periods);
  }, [periodIds, db.periods]);

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
      }
    } else {
      const nextPids = [...periodIds, pId];
      const periodOrder = new Map<string, number>(db.periods.map((p, idx) => [p.id, p.periodNumber ?? idx]));
      nextPids.sort((a, b) => (periodOrder.get(a) ?? 999) - (periodOrder.get(b) ?? 999));
      setPeriodIds(nextPids);
    }
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
      exceptions: [],
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

            {/* Column 2 (Right): Dedicated Column for Period Presets with Vertical List Style, Checkboxes & Date Preview */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span>Preset Periode ({periodIds.length}/{db.periods.length} dipilih)</span>
                </label>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setPeriodIds(db.periods.map((p) => p.id))}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                  >
                    Semua
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

              {/* Vertical Stacked List Style with Checkboxes */}
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

              {/* Live Normalized Date Range Feedback */}
              <div className="mt-2 p-2 bg-indigo-50/70 border border-indigo-200/80 rounded-lg text-xs">
                <div className="flex items-center gap-1 text-indigo-900 font-bold text-[11px] mb-0.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Rentang Tanggal Efektif (Ternormalisasi):</span>
                </div>
                <p className="text-[11px] text-indigo-950 font-semibold">
                  {formatDateRangesSummary(normalizedDateRanges)}
                </p>
                {periodIds.length > 1 && (
                  <p className="text-[10px] text-indigo-700 mt-0.5">
                    *Tumpukan tanggal dari {periodIds.length} preset digabungkan secara otomatis tanpa duplikasi sesi.
                  </p>
                )}
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
