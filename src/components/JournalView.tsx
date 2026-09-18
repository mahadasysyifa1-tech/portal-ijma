import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  BookOpen,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
  Layers,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  CalendarDays,
  Sparkles,
  SlidersHorizontal,
  Search,
  School,
  BookmarkCheck
} from 'lucide-react';
import {
  DatabaseState,
  SyllabusUnit,
  SyllabusScope,
  ScheduledSessionOccurrence,
  Teacher,
  Room
} from '../types';
import {
  computePacingProjection,
  get_units_for_session,
  formatUnitDisplay,
  getScopedUnits
} from '../utils/pacingEngine';

export type ViewerRole = 'student' | 'teacher' | 'admin';
export type JournalFilterMode = 'all' | 'class' | 'teacher';

interface JournalViewProps {
  db: DatabaseState;
  isAdmin: boolean;
  onUpdateDb: (updater: (prev: DatabaseState) => DatabaseState) => void;
  viewerRole?: ViewerRole;
  setViewerRole?: (role: ViewerRole) => void;
  viewerId?: string;
  setViewerId?: (id: string) => void;
  initialSubjectId?: string;
  initialClassId?: string;
  highlightDate?: string;
  onClearInitialDeepLink?: () => void;
  onOpenAdminLogin: () => void;
  onNavigateToRuleManager?: () => void;
}

export const JournalView: React.FC<JournalViewProps> = ({
  db,
  isAdmin,
  onUpdateDb,
  viewerRole,
  setViewerRole,
  viewerId,
  setViewerId,
  initialSubjectId,
  initialClassId,
  highlightDate,
  onClearInitialDeepLink,
  onOpenAdminLogin,
  onNavigateToRuleManager
}) => {
  // Navigation states
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(initialSubjectId || null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(initialClassId || null);
  const [subjectSearch, setSubjectSearch] = useState('');

  // Local filter for "Pilih Mata Pelajaran" page (defaults to 'all', does not auto-filter)
  const [filterMode, setFilterMode] = useState<JournalFilterMode>('all');
  const [filterClassId, setFilterClassId] = useState<string>(db.classes[0]?.id || '');
  const [filterTeacherId, setFilterTeacherId] = useState<string>(db.teachers[0]?.id || '');

  // 1-time token state for row highlight (e.g. from Home schedule occurrence)
  const [activeHighlightDate, setActiveHighlightDate] = useState<string | null>(highlightDate || null);

  // References for scrolling
  const todayRowRef = useRef<HTMLDivElement | null>(null);

  // Today string YYYY-MM-DD
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // Handle deep link updates from Home tab or Pelajaran tab (strictly 1-time token)
  useEffect(() => {
    if (initialSubjectId) {
      setSelectedSubjectId(initialSubjectId);
      if (initialClassId) {
        setSelectedClassId(initialClassId);
      } else {
        // If not provided, check if only 1 applicable class exists for this subject
        const allRules = (db.rules || []).filter(
          (r) => r.active !== false && r.subjectId === initialSubjectId
        );
        const uniqueClassIds = Array.from(new Set(allRules.map((r) => r.classId)));
        if (uniqueClassIds.length === 1) {
          setSelectedClassId(uniqueClassIds[0]);
        } else {
          setSelectedClassId(null);
        }
      }
      if (highlightDate) {
        setActiveHighlightDate(highlightDate);
      }
      // Consume the 1-time token immediately so it does not persist in App state
      onClearInitialDeepLink?.();
    }
  }, [initialSubjectId, initialClassId, highlightDate, db.rules, onClearInitialDeepLink]);

  // Ensure any token is cleared when unmounting / exiting Journal page
  useEffect(() => {
    return () => {
      onClearInitialDeepLink?.();
    };
  }, [onClearInitialDeepLink]);

  // Auto-scroll to today or highlighted date once journal view renders
  useEffect(() => {
    if (selectedSubjectId && selectedClassId) {
      const timer = setTimeout(() => {
        if (todayRowRef.current) {
          todayRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [selectedSubjectId, selectedClassId, activeHighlightDate]);

  // Filter subjects in "Pilih Mata Pelajaran" page:
  // By default ('all'), shows ALL subjects!
  // Users can manually filter by Kelas or Guru next to the search input.
  const availableSubjects = useMemo(() => {
    const allSubjects = db.subjects || [];
    const allRules = (db.rules || []).filter((r) => r.active !== false);

    if (filterMode === 'class') {
      const targetClassId = filterClassId || db.classes[0]?.id;
      const classRules = allRules.filter((r) => r.classId === targetClassId);
      const subjectIds = new Set(classRules.map((r) => r.subjectId));
      return allSubjects.filter((s) => subjectIds.has(s.id));
    } else if (filterMode === 'teacher') {
      const targetTeacherId = filterTeacherId || db.teachers[0]?.id;
      const teacherRules = allRules.filter((r) => r.teacherId === targetTeacherId);
      const subjectIds = new Set(teacherRules.map((r) => r.subjectId));
      return allSubjects.filter((s) => subjectIds.has(s.id));
    } else {
      // 'all': show all subjects by default!
      return allSubjects;
    }
  }, [db.subjects, db.rules, db.classes, db.teachers, filterMode, filterClassId, filterTeacherId]);

  // Find applicable class-sections for selectedSubjectId
  // Shows ALL classes that have this subject scheduled across the school!
  const applicableClasses = useMemo(() => {
    if (!selectedSubjectId) return [];
    const allRules = (db.rules || []).filter(
      (r) => r.active !== false && r.subjectId === selectedSubjectId
    );
    const classIds = allRules.map((r) => r.classId);
    const uniqueClassIds = Array.from(new Set(classIds));
    const classMap = new Map((db.classes || []).map((c) => [c.id, c]));
    return uniqueClassIds.map((cid) => classMap.get(cid)).filter(Boolean) as typeof db.classes;
  }, [selectedSubjectId, db.rules, db.classes]);

  // When selecting a subject:
  // If only 1 class takes this subject, auto-select it.
  // Otherwise, user goes to "Pilih Kelas" page to see and select from listed classes.
  const handleSelectSubject = (subId: string) => {
    setSelectedSubjectId(subId);
    onClearInitialDeepLink?.();

    const allRules = (db.rules || []).filter(
      (r) => r.active !== false && r.subjectId === subId
    );
    const uniqueClassIds = Array.from(new Set(allRules.map((r) => r.classId)));

    if (uniqueClassIds.length === 1) {
      setSelectedClassId(uniqueClassIds[0]);
    } else {
      setSelectedClassId(null);
    }
  };

  const selectedFilterClass = useMemo(() => {
    return db.classes.find((c) => c.id === filterClassId) || db.classes[0];
  }, [db.classes, filterClassId]);

  const selectedFilterTeacher = useMemo(() => {
    return db.teachers.find((t) => t.id === filterTeacherId) || db.teachers[0];
  }, [db.teachers, filterTeacherId]);

  // Scoped pacing data for the selected (subject, class)
  const pacingData = useMemo(() => {
    if (!selectedSubjectId || !selectedClassId) return null;
    const projection = computePacingProjection(db, selectedSubjectId, selectedClassId);
    const scopedUnits = getScopedUnits(db, selectedSubjectId, selectedClassId);

    // Calculate total pages across scoped syllabus units
    const totalPages = scopedUnits.reduce((acc, u) => {
      const pStart = typeof u.page_start === 'number' ? u.page_start : parseInt(String(u.page_start), 10);
      const pEnd = typeof u.page_end === 'number' ? u.page_end : parseInt(String(u.page_end), 10);
      if (!isNaN(pStart) && !isNaN(pEnd) && pEnd >= pStart) {
        return acc + (pEnd - pStart + 1);
      }
      return acc + 1;
    }, 0);

    const pagesPerSession = projection.length > 0
      ? (totalPages / projection.length).toFixed(1)
      : '0';

    return {
      projection,
      scopedUnits,
      totalPages,
      pagesPerSession
    };
  }, [db, selectedSubjectId, selectedClassId]);

  const currentSubject = db.subjects.find((s) => s.id === selectedSubjectId);
  const currentClass = db.classes.find((c) => c.id === selectedClassId);
  const teacherMap = new Map<string, Teacher>((db.teachers || []).map((t) => [t.id, t]));
  const roomMap = new Map<string, Room>((db.rooms || []).map((r) => [r.id, r]));

  // Scope status
  const existingScope = useMemo(() => {
    if (!selectedSubjectId || !selectedClassId) return null;
    return (db.syllabusScopes || []).find(
      (s) => s.subject_id === selectedSubjectId && s.class_section_id === selectedClassId
    );
  }, [db.syllabusScopes, selectedSubjectId, selectedClassId]);

  return (
    <div className="space-y-6">
      {/* Top Banner: Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-2xl bg-amber-500 text-white shadow-xs shrink-0">
            <BookmarkCheck className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Jurnal Pembelajaran &amp; Silabus
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium truncate">
              Distribusi materi dan pencapaian kurikulum per pertemuan sesi akademik
            </p>
          </div>
        </div>
      </div>

      {/* STEP 1: SUBJECT PICKER (If no subject is selected) */}
      {!selectedSubjectId && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Pilih Mata Pelajaran
              </h3>
              <p className="text-xs text-slate-100">
                {filterMode === 'class'
                  ? `Menampilkan mata pelajaran untuk ${selectedFilterClass?.name || 'kelas terpilih'}`
                  : filterMode === 'teacher'
                  ? `Menampilkan mata pelajaran yang diampu oleh ${selectedFilterTeacher?.panggilan || selectedFilterTeacher?.name || 'guru terpilih'}`
                  : 'Menampilkan seluruh mata pelajaran aktif'}
              </p>
            </div>

            {/* Filter controls & Search */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Manual Filter Selector Div */}
              <div
                id="journal-subject-filter-selector"
                className="flex items-center gap-1.5 text-xs bg-slate-50 p-1 rounded-xl border border-slate-200/90"
              >
                <span className="text-[11px] text-slate-400 font-semibold px-1.5 hidden sm:inline">
                  Filter:
                </span>
                <div className="inline-flex rounded-lg p-0.5 bg-slate-200/60">
                  <button
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                      filterMode === 'all'
                        ? 'bg-white text-amber-800 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMode('class');
                      if (!filterClassId && db.classes.length > 0) {
                        setFilterClassId(db.classes[0].id);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                      filterMode === 'class'
                        ? 'bg-white text-amber-800 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Kelas
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMode('teacher');
                      if (!filterTeacherId && db.teachers.length > 0) {
                        setFilterTeacherId(db.teachers[0].id);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                      filterMode === 'teacher'
                        ? 'bg-white text-amber-800 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Guru
                  </button>
                </div>

                {/* Dropdown if 'class' is active */}
                {filterMode === 'class' && (
                  <select
                    value={filterClassId || db.classes[0]?.id || ''}
                    onChange={(e) => setFilterClassId(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                  >
                    {db.classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}

                {/* Dropdown if 'teacher' is active */}
                {filterMode === 'teacher' && (
                  <select
                    value={filterTeacherId || db.teachers[0]?.id || ''}
                    onChange={(e) => setFilterTeacherId(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                  >
                    {db.teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.panggilan || t.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Search Input */}
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari mata pelajaran..."
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {availableSubjects.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">Tidak Ada Mata Pelajaran</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Belum ada jadwal aktif untuk peran atau sudut pandang yang Anda pilih. Silakan ganti peran atau periksa jadwal master.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {availableSubjects
                .filter(
                  (s) =>
                    s.name.toLowerCase().includes(subjectSearch.toLowerCase()) ||
                    s.code.toLowerCase().includes(subjectSearch.toLowerCase()) ||
                    s.department.toLowerCase().includes(subjectSearch.toLowerCase())
                )
                .map((subject) => {
                  const unitCount = (db.syllabusUnits || []).filter(
                    (u) => u.subject_id === subject.id
                  ).length;
                  const ruleCount = (db.rules || []).filter(
                    (r) => r.active !== false && r.subjectId === subject.id
                  ).length;

                  return (
                    <div
                      key={subject.id}
                      onClick={() => handleSelectSubject(subject.id)}
                      className="group bg-white rounded-2xl border border-slate-200/90 p-4 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between"
                    >
                      <div
                        className="absolute top-0 left-0 right-0 h-1.5"
                        style={{ backgroundColor: subject.color || '#3B82F6' }}
                      />

                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                            {subject.code}
                          </span>
                          <span className="text-lg font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                            {subject.name}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-400">
                            {subject.department}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
                            <Layers className="w-3.5 h-3.5 text-amber-600" />
                            {unitCount} Bab Silabus
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: CLASS-SECTION PICKER (If subject selected but multiple classes available) */}
      {selectedSubjectId && !selectedClassId && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedSubjectId(null);
                setSelectedClassId(null);
                onClearInitialDeepLink?.();
              }}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer"
              title="Kembali ke daftar pelajaran"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Pilih Kelas &amp; Rombel: {currentSubject?.name}
              </h3>
              <p className="text-xs text-slate-100">
                Pelajaran ini dijadwalkan pada lebih dari satu rombel kelas. Pilih kelas yang ingin ditinjau.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {applicableClasses.map((cls) => {
              // Count sessions in term for this class
              const sessions = computePacingProjection(db, selectedSubjectId, cls.id);

              return (
                <div
                  key={cls.id}
                  onClick={() => setSelectedClassId(cls.id)}
                  className="bg-white rounded-2xl border border-slate-200/90 p-4 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700">
                      <School className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{cls.name}</h4>
                      <p className="text-xs text-slate-500">
                        Kelas {cls.grade} • Rombel {cls.section} • {cls.studentCount} Peserta
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-semibold">
                    <span>{sessions.length} Sesi Terjadwal</span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 3: JOURNAL VIEW (Chronological Session by Session) */}
      {selectedSubjectId && selectedClassId && (
        <div className="space-y-4">
          {/* Breadcrumb & Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5 mb-3.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClearInitialDeepLink?.();
                    if (applicableClasses.length > 1) {
                      setSelectedClassId(null);
                    } else {
                      setSelectedSubjectId(null);
                      setSelectedClassId(null);
                    }
                  }}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  title="Kembali"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <span
                    onClick={() => {
                      onClearInitialDeepLink?.();
                      setSelectedSubjectId(null);
                      setSelectedClassId(null);
                    }}
                    className="hover:underline cursor-pointer"
                  >
                    Pelajaran
                  </span>
                  <span>/</span>
                  <span
                    onClick={() => {
                      onClearInitialDeepLink?.();
                      if (applicableClasses.length > 1) {
                        setSelectedClassId(null);
                      } else {
                        setSelectedSubjectId(null);
                        setSelectedClassId(null);
                      }
                    }}
                    className="text-slate-900 font-bold hover:underline cursor-pointer"
                    title={applicableClasses.length > 1 ? 'Kembali ke pilihan kelas' : undefined}
                  >
                    {currentSubject?.name}
                  </span>
                  <span>/</span>
                  <span className="text-amber-700 font-bold">{currentClass?.name}</span>
                </div>
              </div>

              {/* Admin Scope Button */}
              {isAdmin ? (
                onNavigateToRuleManager && (
                  <button
                    type="button"
                    onClick={onNavigateToRuleManager}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors cursor-pointer"
                    title="Buka Rule Manager Studio untuk mengatur batas bab & laju materi"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-700" />
                    <span>
                      {existingScope ? 'Edit Batas di Rule Manager' : 'Atur Batas di Rule Manager'}
                    </span>
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={onOpenAdminLogin}
                  className="text-[11px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
                >
                  Masuk admin untuk mengatur batas materi
                </button>
              )}
            </div>

            {/* Meta details (Clean, low-visibility inline presentation) */}
            <div className="flex flex-wrap items-center justify-between gap-y-1.5 gap-x-3 text-xs text-slate-500 pt-0.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex items-center gap-1">
                  <span className="text-slate-400">Total:</span>
                  <span className="font-semibold text-slate-700">
                    {pacingData?.projection.length || 0} Pertemuan
                  </span>
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1">
                  <span className="text-slate-400">Cakupan:</span>
                  <span className="font-semibold text-amber-700">
                    {pacingData?.scopedUnits.length || 0} Bab
                  </span>
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1">
                  <span className="text-slate-400">Laju:</span>
                  <span className="font-semibold text-emerald-700">
                    ~{pacingData?.pagesPerSession || 0} hal/sesi
                  </span>
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1">
                  <span className="text-slate-400">Scope:</span>
                  <span className="font-semibold text-slate-600">
                    {existingScope ? 'Kustom' : 'Standar'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* CHRONOLOGICAL SESSION ROWS */}
          {(!pacingData || pacingData.projection.length === 0) ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">Tidak Ada Sesi Terjadwal</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Tidak ditemukan jadwal aktif untuk mata pelajaran ini pada kelas {currentClass?.name} dalam rentang periode kalender akademik.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pacingData.projection.map((item, index) => {
                const { session, units } = item;
                const teacher = teacherMap.get(session.teacherId);
                const room = roomMap.get(session.roomId);

                const isPast = session.date < todayStr;
                const isToday = session.date === todayStr;
                const isFuture = session.date > todayStr;
                const isTargetHighlighted = activeHighlightDate === session.date;

                return (
                  <div
                    key={session.id}
                    ref={isToday || isTargetHighlighted ? todayRowRef : undefined}
                    className={`rounded-2xl border transition-all p-4 relative overflow-hidden ${
                      isToday
                        ? 'bg-amber-50 border-amber-300 shadow-md ring-2 ring-amber-400'
                        : isTargetHighlighted
                        ? 'bg-indigo-50 border-indigo-300 shadow-md ring-2 ring-indigo-400'
                        : isPast
                        ? 'bg-slate-50/70 border-slate-200 opacity-90'
                        : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      {/* Left: Session timing, meeting badge, room */}
                      <div className="flex items-start gap-3 min-w-0 md:w-5/12">
                        {/* Number badge */}
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                            isToday
                              ? 'bg-amber-500 text-white shadow-xs'
                              : isPast
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          #{session.meetingIndex}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900">
                              {session.day}, {session.date}
                            </span>
                            {isToday && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white uppercase tracking-wider animate-pulse">
                                HARI INI
                              </span>
                            )}
                            {isPast && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700">
                                Selesai
                              </span>
                            )}
                            {isFuture && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Akan Datang
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              {session.startTime} - {session.endTime} ({session.sessionName})
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              {room?.name || session.roomId}
                            </span>
                            {teacher && (
                              <span className="flex items-center gap-1">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                {teacher.panggilan || teacher.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Units rendered per specification: "{part}/{page_start}: {title}" (list if multiple) */}
                      <div className="md:w-7/12 pt-2 md:pt-0 border-t md:border-t-0 md:border-l border-slate-100 md:pl-4">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                          Materi Target:
                        </span>

                        {units.length === 0 ? (
                          <div className="text-xs text-slate-400 italic">
                            (Pacing / Pembahasan Mandiri &amp; Evaluasi)
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {units.map((unit) => (
                              <div
                                key={unit.id}
                                className={`text-xs px-3 py-2 rounded-xl flex items-start justify-between gap-2 border ${
                                  isToday
                                    ? 'bg-amber-100/60 border-amber-200/80 text-amber-950 font-bold'
                                    : 'bg-slate-50 border-slate-200/70 text-slate-800 font-medium'
                                }`}
                              >
                                <div className="flex items-start gap-2 min-w-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                                  <span className="leading-snug break-words">
                                    {formatUnitDisplay(unit)}
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono text-slate-500 shrink-0 px-1.5 py-0.5 rounded bg-white/70 border border-slate-200">
                                  hal. {unit.page_start}-{unit.page_end}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
