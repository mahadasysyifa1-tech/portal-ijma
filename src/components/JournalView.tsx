import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  BookOpen,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
  Layers,
  Wrench,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  CalendarDays,
  Sparkles,
  SlidersHorizontal,
  Search,
  School,
  BookmarkCheck,
  ArrowRight,
  Scissors,
  RotateCcw,
  Check,
  X,
  AlertCircle,
  Book
} from 'lucide-react';
import {
  DatabaseState,
  SyllabusUnit,
  SyllabusScope,
  SyllabusPacingAdjustment,
  ScheduledSessionOccurrence,
  Teacher,
  Room
} from '../types';
import {
  computePacingProjection,
  get_units_for_session,
  formatUnitDisplay,
  getScopedUnits,
  getUnitsForSubject
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
  onNavigateToBooks?: (bookId?: string) => void;
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
  onNavigateToRuleManager,
  onNavigateToBooks
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
  const currentSessionRef = useRef<HTMLDivElement | null>(null);

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

  const currentSubject = db.subjects.find((s) => s.id === selectedSubjectId);
  const currentClass = db.classes.find((c) => c.id === selectedClassId);
  const teacherMap = new Map<string, Teacher>((db.teachers || []).map((t) => [t.id, t]));
  const roomMap = new Map<string, Room>((db.rooms || []).map((r) => [r.id, r]));
  const bookMap = useMemo(() => new Map<string, any>((db.books || []).map((b) => [b.id, b])), [db.books]);

  // Scope status
  const existingScope = useMemo(() => {
    if (!selectedSubjectId || !selectedClassId) return null;
    return (db.syllabusScopes || []).find((s) => {
      const matchSubj =
        s.subject_id === selectedSubjectId ||
        (currentSubject && (s.subject_id === currentSubject.id || s.subject_id === currentSubject.code));
      const matchClass =
        s.class_section_id === selectedClassId ||
        (s as any).class_code === selectedClassId ||
        (s as any).classId === selectedClassId;
      return matchSubj && matchClass;
    });
  }, [db.syllabusScopes, selectedSubjectId, selectedClassId, currentSubject]);

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

    let pagesPerSession = projection.length > 0
      ? (totalPages / projection.length).toFixed(1)
      : '0';

    // If an adjustment exists, calculate active adjusted pace from the checkpoint onward
    const adj = existingScope?.adjustment;
    if (adj && projection.length > 0) {
      let checkpointIdx = projection.findIndex(
        (p) => p.session.meetingIndex === adj.checkpointSessionIndex
      );
      if (checkpointIdx === -1 && adj.checkpointSessionId) {
        checkpointIdx = projection.findIndex((p) => p.session.id === adj.checkpointSessionId);
      }
      if (checkpointIdx === -1 && adj.checkpointDate) {
        checkpointIdx = projection.findIndex((p) => p.session.date === adj.checkpointDate);
      }
      if (checkpointIdx === -1) {
        checkpointIdx = 0;
      }

      const remainingSessionCount = Math.max(1, projection.length - checkpointIdx);

      // Calculate remaining pages from checkpoint unit & page
      const currUnitIdx = scopedUnits.findIndex((u) => u.id === adj.checkpointUnitId);
      const cutSet = new Set(adj.strategy === 'cut' ? (adj.cutUnitIds || []) : []);

      let remPages = 0;
      if (currUnitIdx !== -1) {
        const currentUnit = scopedUnits[currUnitIdx];
        const uStart = typeof currentUnit.page_start === 'number' ? currentUnit.page_start : parseInt(String(currentUnit.page_start), 10) || 1;
        const uEnd = typeof currentUnit.page_end === 'number' ? currentUnit.page_end : parseInt(String(currentUnit.page_end), 10) || 100;
        if (!isNaN(uEnd) && adj.checkpointPage <= uEnd) {
          if (!cutSet.has(currentUnit.id)) {
            remPages += Math.max(0, uEnd - adj.checkpointPage + 1);
          }
        }
        for (let j = currUnitIdx + 1; j < scopedUnits.length; j++) {
          const u = scopedUnits[j];
          if (!cutSet.has(u.id)) {
            const s = typeof u.page_start === 'number' ? u.page_start : parseInt(String(u.page_start), 10) || 1;
            const e = typeof u.page_end === 'number' ? u.page_end : parseInt(String(u.page_end), 10) || 1;
            remPages += Math.max(1, e - s + 1);
          }
        }
      } else {
        for (const u of scopedUnits) {
          if (!cutSet.has(u.id)) {
            const s = typeof u.page_start === 'number' ? u.page_start : parseInt(String(u.page_start), 10) || 1;
            const e = typeof u.page_end === 'number' ? u.page_end : parseInt(String(u.page_end), 10) || 1;
            remPages += Math.max(1, e - s + 1);
          }
        }
      }

      pagesPerSession = (remPages / remainingSessionCount).toFixed(1);
    }

    return {
      projection,
      scopedUnits,
      totalPages,
      pagesPerSession
    };
  }, [db, selectedSubjectId, selectedClassId, existingScope]);

  // Pacing Calibration state (Admin feature)
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [calibSessionIdx, setCalibSessionIdx] = useState<number>(1);
  const [calibSessionNumber, setCalibSessionNumber] = useState<number>(1);
  const [calibUnitId, setCalibUnitId] = useState<string>('');
  const [calibPage, setCalibPage] = useState<number>(1);
  const [calibStrategy, setCalibStrategy] = useState<'accelerate' | 'cut'>('accelerate');
  const [calibCutUnitIds, setCalibCutUnitIds] = useState<string[]>([]);

  // Helper to determine displayed session number considering teacher adjustments
  const displayNumber = (slotIdx: number) => {
    const adj = existingScope?.adjustment;
    if (!adj?.checkpointSessionNumber || slotIdx < adj.checkpointSessionIndex) return slotIdx;
    return slotIdx - adj.checkpointSessionIndex + adj.checkpointSessionNumber;
  };

  // Identify the active/current session occurrence (today's session, next upcoming, or last session)
  const currentSessionItem = useMemo(() => {
    if (!pacingData || pacingData.projection.length === 0) return null;
    return (
      pacingData.projection.find((p) => p.session.date === todayStr) ||
      pacingData.projection.find((p) => p.session.date > todayStr) ||
      pacingData.projection[pacingData.projection.length - 1]
    );
  }, [pacingData, todayStr]);

  // Open calibration transformed card initialized with existing adjustment or sensible defaults
  const handleOpenCalibration = () => {
    if (!pacingData || pacingData.projection.length === 0) return;
    const targetSession = currentSessionItem || pacingData.projection[0];
    const defaultIdx = targetSession.session.meetingIndex;
    setCalibSessionIdx(defaultIdx);

    if (existingScope?.adjustment && existingScope.adjustment.checkpointSessionIndex === defaultIdx) {
      if (existingScope.adjustment.checkpointSessionNumber !== undefined) {
        setCalibSessionNumber(existingScope.adjustment.checkpointSessionNumber);
      } else {
        setCalibSessionNumber(displayNumber(defaultIdx) || defaultIdx);
      }
      setCalibUnitId(existingScope.adjustment.checkpointUnitId);
      setCalibPage(existingScope.adjustment.checkpointPage);
      setCalibStrategy(existingScope.adjustment.strategy);
      setCalibCutUnitIds(existingScope.adjustment.cutUnitIds || []);
    } else {
      setCalibSessionNumber(displayNumber(defaultIdx) || defaultIdx);
      const firstU =
        targetSession.units.length > 0 ? targetSession.units[0] : pacingData.scopedUnits[0];
      if (firstU) {
        setCalibUnitId(firstU.id);
        const pStart =
          typeof firstU.page_start === 'number'
            ? firstU.page_start
            : parseInt(String(firstU.page_start), 10) || 1;
        setCalibPage(pStart);
      }
      setCalibStrategy('accelerate');
      setCalibCutUnitIds([]);
    }
    setIsCalibrating(true);

    setTimeout(() => {
      currentSessionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  // Selected calib unit and page bounds
  const selectedCalibUnit = useMemo(() => {
    return pacingData?.scopedUnits.find((u) => u.id === calibUnitId);
  }, [pacingData?.scopedUnits, calibUnitId]);

  const unitMinPage = useMemo(() => {
    if (!selectedCalibUnit) return 1;
    return typeof selectedCalibUnit.page_start === 'number'
      ? selectedCalibUnit.page_start
      : parseInt(String(selectedCalibUnit.page_start), 10) || 1;
  }, [selectedCalibUnit]);

  const unitMaxPage = useMemo(() => {
    if (!selectedCalibUnit) return 100;
    return typeof selectedCalibUnit.page_end === 'number'
      ? selectedCalibUnit.page_end
      : parseInt(String(selectedCalibUnit.page_end), 10) || 100;
  }, [selectedCalibUnit]);

  // Subsequent units for cut checklist
  const subsequentUnits = useMemo(() => {
    if (!pacingData?.scopedUnits || !calibUnitId) return [];
    const idx = pacingData.scopedUnits.findIndex((u) => u.id === calibUnitId);
    if (idx === -1) return [];
    return pacingData.scopedUnits.slice(idx + 1);
  }, [pacingData?.scopedUnits, calibUnitId]);

  // Remaining sessions count from checkpoint session
  const remainingSessionCount = useMemo(() => {
    if (!pacingData?.projection) return 1;
    return Math.max(1, pacingData.projection.length - (calibSessionIdx - 1));
  }, [pacingData?.projection, calibSessionIdx]);

  // Remaining pages based on checkpoint page and cut checklist
  const calibRemainingPages = useMemo(() => {
    if (!pacingData?.scopedUnits || !selectedCalibUnit) return 0;
    const idx = pacingData.scopedUnits.findIndex((u) => u.id === calibUnitId);
    if (idx === -1) return 0;

    let pages = 0;
    const uEnd = unitMaxPage;
    if (calibPage <= uEnd) {
      pages += Math.max(0, uEnd - calibPage + 1);
    }

    const cutSet = new Set(calibStrategy === 'cut' ? calibCutUnitIds : []);
    for (let j = idx + 1; j < pacingData.scopedUnits.length; j++) {
      const u = pacingData.scopedUnits[j];
      if (!cutSet.has(u.id)) {
        const s = typeof u.page_start === 'number' ? u.page_start : parseInt(String(u.page_start), 10) || 1;
        const e = typeof u.page_end === 'number' ? u.page_end : parseInt(String(u.page_end), 10) || 1;
        pages += Math.max(1, e - s + 1);
      }
    }
    return pages;
  }, [pacingData?.scopedUnits, selectedCalibUnit, calibUnitId, calibPage, unitMaxPage, calibStrategy, calibCutUnitIds]);

  const calibNewPace = useMemo(() => {
    return remainingSessionCount > 0 ? (calibRemainingPages / remainingSessionCount).toFixed(1) : '0';
  }, [calibRemainingPages, remainingSessionCount]);

  const handleSaveCalibration = () => {
    if (!selectedSubjectId || !selectedClassId) return;

    const checkpointSession = pacingData?.projection.find(
      (p) => p.session.meetingIndex === calibSessionIdx
    );

    const newAdjustment: SyllabusPacingAdjustment = {
      checkpointSessionIndex: calibSessionIdx,
      checkpointSessionNumber: Number(calibSessionNumber),
      checkpointSessionId: checkpointSession?.session.id,
      checkpointDate: checkpointSession?.session.date,
      checkpointUnitId: calibUnitId,
      checkpointPage: Number(calibPage),
      strategy: calibStrategy,
      cutUnitIds: calibStrategy === 'cut' ? calibCutUnitIds : [],
      updatedAt: new Date().toISOString()
    };

    onUpdateDb((prev) => {
      const scopes = prev.syllabusScopes ? [...prev.syllabusScopes] : [];
      const scopeIndex = scopes.findIndex((s) => {
        const matchSubj =
          s.subject_id === selectedSubjectId ||
          (currentSubject && (s.subject_id === currentSubject.id || s.subject_id === currentSubject.code));
        const matchClass =
          s.class_section_id === selectedClassId ||
          (s as any).class_code === selectedClassId ||
          (s as any).classId === selectedClassId;
        return matchSubj && matchClass;
      });

      if (scopeIndex >= 0) {
        scopes[scopeIndex] = {
          ...scopes[scopeIndex],
          adjustment: newAdjustment
        };
      } else {
        scopes.push({
          id: `scope-${selectedSubjectId}-${selectedClassId}`,
          subject_id: currentSubject?.id || selectedSubjectId,
          class_section_id: selectedClassId,
          adjustment: newAdjustment
        });
      }

      return {
        ...prev,
        syllabusScopes: scopes
      };
    });

    setIsCalibrating(false);
  };

  const handleResetCalibration = () => {
    if (!selectedSubjectId || !selectedClassId) return;

    onUpdateDb((prev) => {
      const scopes = prev.syllabusScopes ? [...prev.syllabusScopes] : [];
      const scopeIndex = scopes.findIndex((s) => {
        const matchSubj =
          s.subject_id === selectedSubjectId ||
          (currentSubject && (s.subject_id === currentSubject.id || s.subject_id === currentSubject.code));
        const matchClass =
          s.class_section_id === selectedClassId ||
          (s as any).class_code === selectedClassId ||
          (s as any).classId === selectedClassId;
        return matchSubj && matchClass;
      });

      if (scopeIndex >= 0) {
        const updated = { ...scopes[scopeIndex] };
        delete updated.adjustment;
        scopes[scopeIndex] = updated;
      }

      return {
        ...prev,
        syllabusScopes: scopes
      };
    });

    setIsCalibrating(false);
  };

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
                  const unitCount = getUnitsForSubject(db, subject.id).length;
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
          <div className="sticky top-30 z-20 bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
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

              {/* Action Buttons: Kalibrasi Pacing (Admin only) & Rule Manager Scope */}
              <div className="flex items-center gap-2 flex-wrap">
                {isAdmin ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (isCalibrating) {
                          setIsCalibrating(false);
                        } else {
                          handleOpenCalibration();
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                        existingScope?.adjustment
                          ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                          : isCalibrating
                          ? 'bg-slate-200 text-slate-800 border-slate-300'
                          : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border-amber-200'
                      }`}
                      title="Sesuaikan progres riil dan laju silabus untuk sisa pertemuan"
                    >
                      <Wrench className="w-3.5 h-3.5 text-amber-600" />
                      <span>
                        {existingScope?.adjustment
                          ? `Laju Terkalibrasi (Sesi #${existingScope.adjustment.checkpointSessionIndex})`
                          : 'Kalibrasi Laju'}
                      </span>
                    </button>

                    {onNavigateToRuleManager && (
                      <button
                        type="button"
                        onClick={onNavigateToRuleManager}
                        className="flex items-center rounded-xl gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Buka Rule Manager Studio untuk mengatur batas bab silabus"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                        <span>Ubah Rentang Silabus</span>
                      </button>
                    )}
                  </>
                ) : existingScope?.adjustment ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded-xl">
                    <CheckCircle2 className="w-3 h-3 text-amber-600" />
                    <span>Telah Disesuaikan Guru (Sesi #{existingScope.adjustment.checkpointSessionIndex})</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenAdminLogin}
                    className="text-[11px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
                  >
                    Masuk admin untuk kalibrasi laju
                  </button>
                )}
              </div>
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
                {existingScope?.adjustment && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="inline-flex items-center gap-1 font-bold text-amber-800">
                      <CheckCircle2 className="w-3 h-3 text-amber-600" />
                      Terkalibrasi dari Sesi #{existingScope.adjustment.checkpointSessionIndex}+
                    </span>
                  </>
                )}
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
                const { session, units, isCheckpoint, isAdjusted } = item;
                const teacher = teacherMap.get(session.teacherId);
                const room = roomMap.get(session.roomId);

                const isPast = session.date < todayStr;
                const isToday = session.date === todayStr;
                const isFuture = session.date > todayStr;
                const isTargetHighlighted = activeHighlightDate === session.date;
                const isCurrent = currentSessionItem?.session.id === session.id;

                // When this is the current session and calibration mode is active:
                // The card transforms into an in-place minimal edit form directly!
                if (isCurrent && isCalibrating) {
                  return (
                    <div
                      key={session.id}
                      ref={(el) => {
                        currentSessionRef.current = el;
                        if (isToday || isTargetHighlighted) todayRowRef.current = el;
                      }}
                      className="rounded-2xl border-2 border-amber-400 bg-white p-4 sm:p-5 shadow-md ring-2 ring-amber-200/60 relative space-y-3.5 transition-all"
                    >
                      {/* Header of Form */}
                      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs font-bold text-xs">
                            #{displayNumber(session.meetingIndex)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                                Sesuaikan Sesi ini dengan praktek
                              </h4>
                              <span className="text-[11px] text-slate-500 font-medium">
                                ({session.day}, {session.date})
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsCalibrating(false)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                          title="Tutup penyesuaian"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Three fields: Sesi ke-, Bab & Halaman */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        {/* Field: Sesi ke- */}
                        <div className="w-full sm:w-28 flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-400 shrink-0">Sesi ke-</span>
                          <input
                            type="number"
                            min={1}
                            value={calibSessionNumber}
                            onChange={(e) => setCalibSessionNumber(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>

                        {/* Field 1: Materi Awal (Bab) */}
                        <div className="flex-1 min-w-[200px] flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-400 shrink-0">Bab.</span>
                          <select
                            value={calibUnitId}
                            onChange={(e) => {
                              const uId = e.target.value;
                              setCalibUnitId(uId);
                              const u = pacingData?.scopedUnits.find((unit) => unit.id === uId);
                              if (u) {
                                const pStart =
                                  typeof u.page_start === 'number'
                                    ? u.page_start
                                    : parseInt(String(u.page_start), 10) || 1;
                                setCalibPage(pStart);
                              }
                            }}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                          >
                            {pacingData?.scopedUnits.map((u) => (
                              <option key={u.id} value={u.id}>
                                {formatUnitDisplay(u)} (hal. {u.page_start}–{u.page_end})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Field 2: Halaman Saat Ini */}
                        <div className="w-full sm:w-36 flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-400 shrink-0">Hal.</span>
                          <input
                            type="number"
                            min={unitMinPage}
                            max={unitMaxPage}
                            value={calibPage}
                            onChange={(e) => setCalibPage(parseInt(e.target.value, 10) || unitMinPage)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>

                        {/* Live Pace Preview */}
                        <div className="text-xs font-medium text-slate-600 flex items-center gap-1.5 shrink-0 sm:ml-auto">
                          <span>Laju baru:</span>
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                            ~{calibNewPace} hal/sesi
                          </span>
                        </div>
                      </div>

                      {/* Scissor Toggle & Cut Panel (Seamless integration) */}
                      {calibStrategy !== 'cut' ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center justify-center gap-1.5 p-3 rounded-full">
                            <button
                              type="button"
                              onClick={() => setCalibStrategy('cut')}
                              className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-400 shadow-xl hover:bg-rose-100 text-white hover:text-rose-500 cursor-pointer transition-colors"
                              title="Klik jika ada bab lanjutan yang perlu dipotong / dilewati"
                            >
                              <Scissors className="w-4 h-4" />
                            </button>
                            <span className="text-xs text-slate-500">Potong?</span>
                          </div>
                          <span className="text-xs text-slate-600">Tidak ada materi dipotong. Laju disesuaikan saja.</span>
                        </div>
                      ) : (
                        <div className="bg-rose-50/60 rounded-xl border border-rose-100 p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setCalibStrategy('accelerate')}
                                className="flex items-center justify-center w-8 h-8 rounded-full border border-white bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 cursor-pointer transition-colors"
                                title="Batal potong materi (kembali ke sesuaikan saja)"
                              >
                                <Scissors className="w-3.5 h-3.5 text-white" />
                              </button>
                              <span className="text-xs font-semibold text-slate-700">
                                Pilih bab yang akan dibuang:
                              </span>
                            </div>
                            <span className="text-[11px] font-bold text-rose-700">
                              {calibCutUnitIds.length} dipilih
                            </span>
                          </div>

                          {subsequentUnits.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic">
                              Tidak ada bab lanjutan setelah materi ini untuk dipangkas.
                            </p>
                          ) : (
                            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                              {subsequentUnits.map((u) => {
                                const isCut = calibCutUnitIds.includes(u.id);
                                const pCount =
                                  (typeof u.page_end === 'number' ? u.page_end : parseInt(String(u.page_end), 10)) -
                                  (typeof u.page_start === 'number' ? u.page_start : parseInt(String(u.page_start), 10)) + 1;
                                return (
                                  <label
                                    key={u.id}
                                    className={`flex items-center justify-between gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                                      isCut
                                        ? 'bg-rose-50 border-rose-300 text-rose-900 font-semibold'
                                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <input
                                        type="checkbox"
                                        checked={isCut}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setCalibCutUnitIds([...calibCutUnitIds, u.id]);
                                          } else {
                                            setCalibCutUnitIds(calibCutUnitIds.filter((id) => id !== u.id));
                                          }
                                        }}
                                        className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                                      />
                                      <span className="truncate">{formatUnitDisplay(u)}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 shrink-0">
                                      {pCount > 0 ? `${pCount} hal` : ''}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Bottom Footer Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsCalibrating(false)}
                            className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer transition-colors"
                          >
                            Batal
                          </button>
                          {existingScope?.adjustment && (
                            <button
                              type="button"
                              onClick={handleResetCalibration}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold cursor-pointer transition-colors"
                              title="Hapus penyesuaian dan kembali ke jadwal standar"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reset ke Standar</span>
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={handleSaveCalibration}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Simpan &amp; Terapkan</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={session.id}
                    ref={(el) => {
                      if (isCurrent) currentSessionRef.current = el;
                      if (isToday || isTargetHighlighted) todayRowRef.current = el;
                    }}
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
                    {/* Checkpoint Indicator Banner */}
                    {isCheckpoint && (
                      <div className="mb-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-amber-900">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-md bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div>
                            <span className="font-bold">Titik Awal Kalibrasi Guru:</span>{' '}
                            <span>
                              Mulai hal. {existingScope?.adjustment?.checkpointPage} (
                              {existingScope?.adjustment?.strategy === 'cut'
                                ? `Pangkas ${(existingScope?.adjustment?.cutUnitIds || []).length} Bab`
                                : 'disesuaikan tanpa pemangkasan'}
                              )
                            </span>
                          </div>
                        </div>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              handleOpenCalibration();
                            }}
                            className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                          >
                            Ubah Kalibrasi
                          </button>
                        )}
                      </div>
                    )}

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
                          #{displayNumber(session.meetingIndex)}
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
                            {isAdjusted && !isCheckpoint && (
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300/80 flex items-center gap-1"
                                title="Laju materi pada sesi ini telah disesuaikan dari kalibrasi guru"
                              >
                                <CheckCircle2 className="w-2.5 h-2.5 text-amber-600" />
                                Terkalibrasi
                              </span>
                            )}
                            {isCurrent && isAdmin && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenCalibration();
                                }}
                                className="p-1 rounded-lg text-slate-400 hover:text-amber-700 hover:bg-amber-100/80 transition-colors cursor-pointer shrink-0 ml-1"
                                title="Sesuaikan Laju"
                                aria-label="Sesuaikan Laju"
                              >
                                <Wrench className="w-5 h-5 text-amber-600" />
                              </button>
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
                            (Distribusi / Pembahasan Mandiri &amp; Evaluasi)
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {units.map((unit) => {
                              const bId = unit.bookId || currentSubject?.default_book || currentSubject?.defaultBookId || currentSubject?.primary_book_code;
                              const book = bId
                                ? bookMap.get(bId) ||
                                  Array.from(bookMap.values()).find(
                                    (b: any) => b.id === bId || b.displayCode === bId || b.title === bId
                                  )
                                : null;

                              return (
                                <div
                                  key={unit.id}
                                  className={`text-xs px-3 py-2 rounded-xl flex items-start justify-between gap-2 border ${
                                    isToday
                                      ? 'bg-amber-100/60 border-amber-200/80 text-amber-950 font-bold'
                                      : 'bg-slate-50 border-slate-200/70 text-slate-800 font-medium'
                                  }`}
                                >
                                  {/* Left: (bullet) (book) (material) */}
                                  <div className="flex items-start gap-2 min-w-0 flex-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                                    {book && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onNavigateToBooks?.(book.id);
                                        }}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition-colors cursor-pointer shrink-0"
                                        title={`Kitab: ${book.title}${book.altTitle ? ` (${book.altTitle})` : ''} • Klik untuk melihat info kitab`}
                                      >
                                        <Book className="w-3 h-3 text-indigo-600 shrink-0" />
                                        <span className="truncate max-w-[120px] sm:max-w-[160px]">
                                          {book.altTitle || book.title || book.displayCode}
                                        </span>
                                      </button>
                                    )}
                                    <span className="leading-snug break-words">
                                      {formatUnitDisplay(unit)}
                                    </span>
                                  </div>

                                  {/* Right: page numbers */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    {unit.isPartialStart && (
                                      <ArrowRight
                                        className="w-3 h-3 text-amber-500 shrink-0"
                                        title={`Lanjutan dari sesi sebelumnya (mulai hal. ${unit.page_start} dari total hal. ${unit.raw_page_start}–${unit.raw_page_end})`}
                                      />
                                    )}
                                    <span className="text-[10px] font-mono text-slate-500 shrink-0 px-1.5 py-0.5 rounded bg-white/70 border border-slate-200">
                                      {String(unit.page_start) === String(unit.page_end)
                                        ? `hal. ${unit.page_start}`
                                        : `hal. ${unit.page_start}-${unit.page_end}`}
                                    </span>
                                    {unit.isPartialEnd && (
                                      <ArrowRight
                                        className="w-3 h-3 text-amber-500 shrink-0"
                                        title={`Bersambung ke sesi berikutnya (sampai hal. ${unit.page_end} dari total hal. ${unit.raw_page_start}–${unit.raw_page_end})`}
                                      />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
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
