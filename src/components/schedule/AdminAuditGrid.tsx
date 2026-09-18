import React, { useMemo, useState } from 'react';
import { DatabaseState, DayOfWeek, ScheduleRule } from '../../types';
import { FixedBlockSubGrid } from './FixedBlockSubGrid';
import { computeResolvedSlots } from '../../utils/scheduleEngine';
import { Clock, AlertCircle, Grid3X3, Table, Layers, ChevronRight } from 'lucide-react';

interface AdminAuditGridProps {
  db: DatabaseState;
  selectedPeriodId: string;
  onEntryClick?: (data: any) => void;
  onEditRule?: (rule: ScheduleRule) => void;
}

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DAY_LABELS: Record<DayOfWeek, string> = {
  Monday: 'Senin',
  Tuesday: 'Selasa',
  Wednesday: 'Rabu',
  Thursday: 'Kamis',
  Friday: 'Jumat',
  Saturday: 'Sabtu',
  Sunday: 'Ahad'
};

export const AdminAuditGrid: React.FC<AdminAuditGridProps> = ({
  db,
  selectedPeriodId,
  onEntryClick,
  onEditRule
}) => {
  const [subView, setSubView] = useState<'matrix' | 'table'>('matrix');

  // Sorted sessions
  const sortedSessions = useMemo(() => {
    return [...db.sessions].sort((a, b) => a.order - b.order);
  }, [db.sessions]);

  // Stably sorted classes
  const sortedClasses = useMemo(() => {
    return [...db.classes].sort((a, b) => (a.grade || 0) - (b.grade || 0) || a.name.localeCompare(b.name));
  }, [db.classes]);

  // Lookup maps
  const subjectMap = useMemo(() => new Map(db.subjects.map((s) => [s.id, s])), [db.subjects]);
  const teacherMap = useMemo(() => new Map(db.teachers.map((t) => [t.id, t])), [db.teachers]);
  const roomMap = useMemo(() => new Map(db.rooms.map((r) => [r.id, r])), [db.rooms]);
  const ruleMap = useMemo(() => new Map(db.rules.map((r) => [r.id, r])), [db.rules]);

  // Resolved slots
  const allResolvedSlots = useMemo(() => {
    return computeResolvedSlots(db.rules);
  }, [db.rules]);

  // Filter slots by selected period
  const activeSlots = useMemo(() => {
    if (selectedPeriodId && selectedPeriodId !== 'all') {
      return allResolvedSlots.filter((s) => s.periodId === selectedPeriodId);
    }
    return allResolvedSlots;
  }, [allResolvedSlots, selectedPeriodId]);

  // Pre-index slots by `${day}_${sessionId}_${classId}`
  const slotIndex = useMemo(() => {
    const map = new Map<string, typeof activeSlots[0]>();
    activeSlots.forEach((slot) => {
      const key = `${slot.day}_${slot.sessionId}_${slot.classId}`;
      map.set(key, slot);
    });
    return map;
  }, [activeSlots]);

  // Legend subjects
  const legendSubjects = useMemo(() => {
    return db.subjects.map((s) => ({
      id: s.id,
      label: s.code || s.name,
      color: s.color || '#4F46E5'
    }));
  }, [db.subjects]);

  // Legend teachers (for chip border indicators)
  const legendTeachers = useMemo(() => {
    return db.teachers.map((t) => ({
      id: t.id,
      label: t.panggilan || t.name,
      color: t.color || '#0284C7'
    }));
  }, [db.teachers]);

  return (
    <div className="space-y-4">
      {/* Subview Toggle and Stats */}
      <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setSubView('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                subView === 'matrix'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              <span>Matriks Sesi Waktu</span>
            </button>
            <button
              type="button"
              onClick={() => setSubView('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                subView === 'table'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Tabel Master Per Kelas</span>
            </button>
          </div>

          <span className="text-xs text-slate-500 font-medium hidden sm:inline">
            Menampilkan <strong className="text-slate-800">{sortedClasses.length} kelas</strong> &amp;{' '}
            <strong className="text-slate-800">{sortedSessions.length} sesi waktu</strong>
          </span>
        </div>

        <div className="text-[11px] text-slate-500 font-medium">
          Klik pada chip kelas untuk melihat rincian jadwal
        </div>
      </div>

      {/* Density notice if many classes */}
      {sortedClasses.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center text-xs text-amber-800">
          Belum ada data kelas yang terdaftar. Tambahkan kelas melalui menu Basis Data.
        </div>
      )}

      {/* VIEW 1: Matrix View (Rows = Sessions, Cols = Days) */}
      {subView === 'matrix' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="w-40 px-3 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider border-r border-slate-200 sticky left-0 bg-slate-50 z-10">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Sesi Waktu</span>
                    </div>
                  </th>
                  {DAYS.map((day) => (
                    <th
                      key={day}
                      className="px-3 py-3 text-xs font-bold text-slate-800 text-center border-r border-slate-200 last:border-r-0 min-w-[180px]"
                    >
                      {DAY_LABELS[day] || day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedSessions.map((session, sIdx) => (
                  <tr
                    key={session.id}
                    className={`hover:bg-slate-50/40 transition-colors ${
                      sIdx === sortedSessions.length - 1 ? 'border-b border-slate-200' : ''
                    }`}
                  >
                    {/* Session Header */}
                    <td className="px-3 py-3 bg-slate-50/80 border-r border-slate-200 text-xs sticky left-0 z-10">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{session.name}</span>
                        <span className="text-[10px] text-amber-700 font-mono font-bold">
                          #{session.order}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        {session.startTime} – {session.endTime}
                      </div>
                    </td>

                    {/* Days: Fixed subgrid for all classes in this slot */}
                    {DAYS.map((day) => {
                      return (
                        <td
                          key={day}
                          className="p-1.5 align-middle border-r border-slate-200 last:border-r-0"
                        >
                          <FixedBlockSubGrid
                            count={sortedClasses.length}
                            interactive={true}
                            onBlockClick={(classIndex, block) => {
                              if (block.isFilled && block.slot) {
                                const cls = sortedClasses[classIndex];
                                const sub = block.slot.subjectId ? subjectMap.get(block.slot.subjectId) : undefined;
                                const tch = block.slot.teacherId ? teacherMap.get(block.slot.teacherId) : undefined;
                                const rm = block.slot.roomId ? roomMap.get(block.slot.roomId) : undefined;
                                if (onEntryClick) {
                                  onEntryClick({
                                    slot: block.slot,
                                    subject: sub,
                                    teacher: tch,
                                    room: rm,
                                    classEntity: cls,
                                    day,
                                    sessionName: session.name,
                                    sessionTime: `${session.startTime} - ${session.endTime}`
                                  });
                                } else if (onEditRule && block.ruleId) {
                                  const rule = ruleMap.get(block.ruleId);
                                  if (rule) onEditRule(rule);
                                }
                              }
                            }}
                            getStateFn={(classIndex) => {
                              const cls = sortedClasses[classIndex];
                              const key = `${day}_${session.id}_${cls.id}`;
                              const slot = slotIndex.get(key);

                              if (slot) {
                                const sub = slot.subjectId ? subjectMap.get(slot.subjectId) : undefined;
                                const tch = slot.teacherId ? teacherMap.get(slot.teacherId) : undefined;
                                const rm = slot.roomId ? roomMap.get(slot.roomId) : undefined;

                                return {
                                  id: `${slot.ruleId}_${cls.id}`,
                                  label: cls.name,
                                  isFilled: true,
                                  occupied: true,
                                  color: sub?.color || '#4F46E5',
                                  teacherColor: tch?.color || (tch ? '#0284C7' : undefined),
                                  tooltip: `${cls.name}: ${sub?.name || 'Pelajaran'} (${tch?.panggilan || tch?.name || 'Pengampu'}) - ${rm?.name || 'Ruang'}`,
                                  subjectName: sub?.name,
                                  subjectCode: sub?.code,
                                  teacherName: tch?.panggilan || tch?.name,
                                  roomName: rm?.name,
                                  hasException: slot.hasException,
                                  ruleId: slot.ruleId,
                                  slot
                                };
                              }

                              return {
                                id: `free_${session.id}_${cls.id}`,
                                label: cls.name,
                                isFilled: false,
                                occupied: false,
                                tooltip: `${cls.name}: Kosong (Tidak ada jadwal)`
                              };
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: Table View (Rows = Classes, Cols = Days & Sessions) */}
      {subView === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="w-40 px-3 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider border-r border-slate-200 sticky left-0 bg-slate-50 z-10">
                    Kelas
                  </th>
                  {DAYS.map((day) => (
                    <th
                      key={day}
                      className="px-3 py-3 text-xs font-bold text-slate-800 text-center border-r border-slate-200 last:border-r-0 min-w-[220px]"
                    >
                      {DAY_LABELS[day]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedClasses.map((cls) => (
                  <tr key={cls.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-3 py-3 bg-slate-50/80 border-r border-slate-200 sticky left-0 z-10">
                      <div className="font-bold text-slate-900 text-xs">{cls.name}</div>
                      <div className="text-[10px] text-slate-500 font-medium">Tingkat {cls.grade}</div>
                    </td>
                    {DAYS.map((day) => {
                      // Get all scheduled sessions for this class on this day
                      const daySlots = sortedSessions.map((session) => {
                        const key = `${day}_${session.id}_${cls.id}`;
                        return {
                          session,
                          slot: slotIndex.get(key)
                        };
                      });

                      const hasAny = daySlots.some((ds) => ds.slot);

                      return (
                        <td key={day} className="p-2 border-r border-slate-200 last:border-r-0 align-top">
                          {!hasAny ? (
                            <div className="h-10 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-[11px] text-slate-400">
                              Tidak ada jadwal
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {daySlots.map(({ session, slot }) => {
                                if (!slot) return null;
                                const sub = slot.subjectId ? subjectMap.get(slot.subjectId) : undefined;
                                const tch = slot.teacherId ? teacherMap.get(slot.teacherId) : undefined;
                                const rm = slot.roomId ? roomMap.get(slot.roomId) : undefined;

                                return (
                                  <button
                                    key={session.id}
                                    type="button"
                                    onClick={() => {
                                      if (onEntryClick) {
                                        onEntryClick({
                                          slot,
                                          subject: sub,
                                          teacher: tch,
                                          room: rm,
                                          classEntity: cls,
                                          day,
                                          sessionName: session.name,
                                          sessionTime: `${session.startTime} - ${session.endTime}`
                                        });
                                      } else if (onEditRule && slot.ruleId) {
                                        const rule = ruleMap.get(slot.ruleId);
                                        if (rule) onEditRule(rule);
                                      }
                                    }}
                                    className="w-full text-left p-1.5 rounded-lg border text-white shadow-xs transition-all hover:scale-[1.01] hover:brightness-105"
                                    style={{
                                      backgroundColor: sub?.color || '#4F46E5',
                                      borderColor: sub?.color || '#4F46E5'
                                    }}
                                  >
                                    <div className="flex items-center justify-between text-[10px] font-bold">
                                      <span className="truncate">{session.name} ({session.startTime})</span>
                                      {sub?.code && (
                                        <span className="bg-white/20 px-1 py-0.2 rounded text-[9px]">
                                          {sub.code}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] font-semibold truncate mt-0.5">
                                      {sub?.name || 'Pelajaran'}
                                    </div>
                                    <div className="text-[10px] opacity-90 truncate mt-0.5 flex items-center justify-between">
                                      <span>{tch?.panggilan || tch?.name || 'Guru'}</span>
                                      <span>{rm?.name || 'Ruang'}</span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Persistent Horizontal Legend Strip at the Bottom */}
      <div className="bg-white px-4 py-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Keterangan Matriks Semua Kelas
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600 inline-block" />
              Latar = Pelajaran
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs border-2 border-amber-500 bg-white inline-block" />
              Border = Guru/Pengampu
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs border border-dashed border-slate-400 bg-white inline-block" />
              Putus-putus = Kosong
            </span>
          </div>
        </div>

        {/* Legend Row 1: Subjects */}
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Warna Pelajaran (Latar Belakang Chip)
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Free slot */}
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-white border border-dashed border-slate-300">
              <span className="w-2.5 h-2.5 rounded-xs border border-dashed border-slate-400 bg-white shrink-0" />
              <span className="text-slate-600 text-[11px] font-semibold">Kosong (Tidak Ada Jadwal)</span>
            </div>

            {legendSubjects.map((s) => (
              <div
                key={s.id}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-slate-50 border border-slate-200"
              >
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0 shadow-2xs"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-slate-700 text-[11px] font-medium">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Legend Row 2: Teachers */}
        {legendTeachers.length > 0 && (
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Warna Guru / Pengampu (Garis Tepi / Border Chip)
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {legendTeachers.map((t) => (
                <div
                  key={t.id}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-slate-50 border border-slate-200"
                >
                  <span
                    className="w-3 h-3 rounded-xs border-2 bg-white shrink-0 shadow-2xs"
                    style={{ borderColor: t.color }}
                  />
                  <span className="text-slate-700 text-[11px] font-medium">{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

