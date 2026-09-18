import React, { useState, useMemo } from 'react';
import {
  DatabaseState,
  Subject,
  ClassEntity,
  SyllabusUnit,
  SyllabusScope
} from '../../types';
import {
  BookOpen,
  GraduationCap,
  Calendar,
  Clock,
  Sliders,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ExternalLink,
  Layers,
  ArrowRight,
  TrendingUp,
  BookmarkCheck,
  X
} from 'lucide-react';
import {
  getScopedUnits,
  getScheduledSessionsForSubjectClass,
  formatUnitDisplay
} from '../../utils/pacingEngine';
import { ClassIcon } from '../ClassIcon';

interface SyllabusPanelProps {
  db: DatabaseState;
  onUpdateDb: (updater: (prev: DatabaseState) => DatabaseState) => void;
  isAdmin?: boolean;
  onOpenAdminLogin?: () => void;
  onNavigateToJournal?: (subjectId?: string, classId?: string, date?: string) => void;
}

interface PackageItem {
  key: string;
  subject: Subject;
  classObj: ClassEntity;
  subjectUnits: SyllabusUnit[];
  scopedUnits: SyllabusUnit[];
  totalPages: number;
  totalMeetings: number;
  existingScope: SyllabusScope | undefined;
  startUnitId: string;
  endUnitId: string;
  laju: number | null;
  hasCustomScope: boolean;
}

export const SyllabusPanel: React.FC<SyllabusPanelProps> = ({
  db,
  onUpdateDb,
  isAdmin = true,
  onOpenAdminLogin,
  onNavigateToJournal
}) => {
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterSchedule, setFilterSchedule] = useState<'all' | 'scheduled' | 'unscheduled'>('all');
  const [filterScope, setFilterScope] = useState<'all' | 'custom' | 'default'>('all');

  // Fast maps
  const unitsBySubject = useMemo(() => {
    const map = new Map<string, SyllabusUnit[]>();
    const allUnits = db.syllabusUnits || [];
    for (const unit of allUnits) {
      const list = map.get(unit.subject_id) || [];
      list.push(unit);
      map.set(unit.subject_id, list);
    }
    // Sort each by order
    for (const [sId, list] of map.entries()) {
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    return map;
  }, [db.syllabusUnits]);

  const scopesMap = useMemo(() => {
    const map = new Map<string, SyllabusScope>();
    for (const sc of db.syllabusScopes || []) {
      map.set(`${sc.subject_id}_${sc.class_section_id}`, sc);
    }
    return map;
  }, [db.syllabusScopes]);

  // Compute all packages: across all subjects and classes
  const allPackages = useMemo<PackageItem[]>(() => {
    const packages: PackageItem[] = [];

    for (const subj of db.subjects) {
      const sUnits = unitsBySubject.get(subj.id) || [];

      for (const cls of db.classes) {
        const key = `${subj.id}_${cls.id}`;
        const existingScope = scopesMap.get(key);
        const scopedUnits = getScopedUnits(db, subj.id, cls.id);
        const scheduledSessions = getScheduledSessionsForSubjectClass(db, subj.id, cls.id);
        const totalMeetings = scheduledSessions.length;

        const startUnitId =
          existingScope?.start_unit_id ||
          (scopedUnits[0]?.id ?? sUnits[0]?.id ?? '');
        const endUnitId =
          existingScope?.end_unit_id ||
          (scopedUnits[scopedUnits.length - 1]?.id ?? sUnits[sUnits.length - 1]?.id ?? '');

        // Calculate total pages across scoped syllabus units
        const totalPages = scopedUnits.reduce((acc, u) => {
          const pStart = typeof u.page_start === 'number' ? u.page_start : parseInt(String(u.page_start), 10);
          const pEnd = typeof u.page_end === 'number' ? u.page_end : parseInt(String(u.page_end), 10);
          if (!isNaN(pStart) && !isNaN(pEnd) && pEnd >= pStart) {
            return acc + (pEnd - pStart + 1);
          }
          return acc + 1;
        }, 0);

        const laju =
          totalMeetings > 0 && totalPages > 0
            ? totalPages / totalMeetings
            : null;

        packages.push({
          key,
          subject: subj,
          classObj: cls,
          subjectUnits: sUnits,
          scopedUnits,
          totalPages,
          totalMeetings,
          existingScope,
          startUnitId,
          endUnitId,
          laju,
          hasCustomScope: Boolean(existingScope)
        });
      }
    }

    return packages;
  }, [db, unitsBySubject, scopesMap]);

  // Filter packages
  const filteredPackages = useMemo(() => {
    return allPackages.filter((pkg) => {
      if (filterClass !== 'all' && pkg.classObj.id !== filterClass) return false;
      if (filterSubject !== 'all' && pkg.subject.id !== filterSubject) return false;
      if (filterSchedule === 'scheduled' && pkg.totalMeetings === 0) return false;
      if (filterSchedule === 'unscheduled' && pkg.totalMeetings > 0) return false;
      if (filterScope === 'custom' && !pkg.hasCustomScope) return false;
      if (filterScope === 'default' && pkg.hasCustomScope) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const subjName = pkg.subject.name.toLowerCase();
        const subjCode = pkg.subject.code.toLowerCase();
        const clsName = pkg.classObj.name.toLowerCase();
        return subjName.includes(q) || subjCode.includes(q) || clsName.includes(q);
      }

      return true;
    });
  }, [allPackages, filterClass, filterSubject, filterSchedule, filterScope, search]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = allPackages.length;
    const scheduled = allPackages.filter((p) => p.totalMeetings > 0).length;
    const withCustomScope = allPackages.filter((p) => p.hasCustomScope).length;
    const scheduledPackages = allPackages.filter((p) => p.totalMeetings > 0 && p.laju !== null);
    const avgLaju =
      scheduledPackages.length > 0
        ? scheduledPackages.reduce((sum, p) => sum + (p.laju ?? 0), 0) / scheduledPackages.length
        : 0;

    return { total, scheduled, withCustomScope, avgLaju };
  }, [allPackages]);

  // Update scope handler
  const handleScopeChange = (
    subjectId: string,
    classId: string,
    newStartId: string,
    newEndId: string
  ) => {
    if (!isAdmin) {
      if (onOpenAdminLogin) onOpenAdminLogin();
      return;
    }

    const sUnits = unitsBySubject.get(subjectId) || [];
    if (sUnits.length === 0) return;

    // Validate ordering: if start is after end, swap or align
    const startIdx = sUnits.findIndex((u) => u.id === newStartId);
    const endIdx = sUnits.findIndex((u) => u.id === newEndId);

    let effectiveStartId = newStartId;
    let effectiveEndId = newEndId;

    if (startIdx !== -1 && endIdx !== -1 && startIdx > endIdx) {
      effectiveEndId = newStartId;
    }

    // Check if new bounds match entire subject syllabus
    const isFullSyllabus =
      effectiveStartId === sUnits[0]?.id &&
      effectiveEndId === sUnits[sUnits.length - 1]?.id;

    onUpdateDb((prev) => {
      const scopes = prev.syllabusScopes ? [...prev.syllabusScopes] : [];
      const idx = scopes.findIndex(
        (s) => s.subject_id === subjectId && s.class_section_id === classId
      );

      if (isFullSyllabus) {
        // Remove override if it covers full syllabus
        if (idx !== -1) {
          scopes.splice(idx, 1);
        }
      } else {
        const updatedScope: SyllabusScope = {
          id: idx !== -1 ? scopes[idx].id : `scope-${subjectId}-${classId}`,
          subject_id: subjectId,
          class_section_id: classId,
          start_unit_id: effectiveStartId,
          end_unit_id: effectiveEndId
        };

        if (idx !== -1) {
          scopes[idx] = updatedScope;
        } else {
          scopes.push(updatedScope);
        }
      }

      return {
        ...prev,
        syllabusScopes: scopes
      };
    });
  };

  const handleResetToFull = (subjectId: string, classId: string) => {
    if (!isAdmin) {
      if (onOpenAdminLogin) onOpenAdminLogin();
      return;
    }

    onUpdateDb((prev) => {
      const scopes = prev.syllabusScopes
        ? prev.syllabusScopes.filter(
            (s) => !(s.subject_id === subjectId && s.class_section_id === classId)
          )
        : [];
      return {
        ...prev,
        syllabusScopes: scopes
      };
    });
  };

  const hasActiveFilter =
    search.trim() !== '' ||
    filterClass !== 'all' ||
    filterSubject !== 'all' ||
    filterSchedule !== 'all' ||
    filterScope !== 'all';

  const resetFilters = () => {
    setSearch('');
    setFilterClass('all');
    setFilterSubject('all');
    setFilterSchedule('all');
    setFilterScope('all');
  };

  return (
    <div className="space-y-3">
      {/* Header & Inline Stats Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                Distribusi Silabus &amp; Pacing
              </h3>
              <p className="text-[11px] text-slate-500">
                Atur cakupan bab per kelas dan pantau target laju materi.
              </p>
            </div>
          </div>

          {/* Compact Inline Pill Stats */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200/80 rounded-lg">
              <span className="text-slate-500 font-medium">Paket:</span>
              <span className="font-bold text-slate-800">{stats.total}</span>
              <span className="text-[10px] text-slate-400">({stats.scheduled} KBM)</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50/70 border border-amber-200/70 rounded-lg text-amber-900">
              <span className="text-amber-700 font-medium">Kustom:</span>
              <span className="font-bold">{stats.withCustomScope}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50/70 border border-emerald-200/70 rounded-lg text-emerald-900">
              <span className="text-emerald-700 font-medium">Rata-rata:</span>
              <span className="font-bold">{stats.avgLaju.toFixed(1)}</span>
              <span className="text-[10px] text-emerald-600">hal/sesi</span>
            </div>
          </div>
        </div>
      

      {/* Streamlined Filter Toolbar */}
      
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari mapel, kode, atau kelas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg w-full focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-colors placeholder:text-slate-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Hapus pencarian"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter Selects */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Filter Kelas */}
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Semua Kelas ({db.classes.length})</option>
              {db.classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>

            {/* Filter Mapel */}
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Semua Mapel ({db.subjects.length})</option>
              {db.subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name} ({sub.code})
                </option>
              ))}
            </select>

            {/* Filter Jadwal */}
            <select
              value={filterSchedule}
              onChange={(e) => setFilterSchedule(e.target.value as any)}
              className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Semua Jadwal</option>
              <option value="scheduled">Terjadwal ({stats.scheduled})</option>
              <option value="unscheduled">Belum ({stats.total - stats.scheduled})</option>
            </select>

            {/* Filter Scope Override */}
            <select
              value={filterScope}
              onChange={(e) => setFilterScope(e.target.value as any)}
              className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Semua Scope</option>
              <option value="custom">Kustom ({stats.withCustomScope})</option>
              <option value="default">Default ({stats.total - stats.withCustomScope})</option>
            </select>

            {/* Reset Button (only shown if active filter) */}
            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-xs py-1.5 px-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                title="Reset semua filter"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Packages Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3.5 min-w-[180px]">Subject (Mata Pelajaran)</th>
                <th className="px-4 py-3.5 min-w-[140px]">Class (Kelas)</th>
                <th className="px-4 py-3.5 text-center min-w-[120px]">Total Pertemuan</th>
                <th className="px-4 py-3.5 min-w-[150px]">Cakupan Bab</th>
                <th className="px-4 py-3.5 min-w-[150px]">Laju</th>
                <th className="px-4 py-3.5 min-w-[210px] bg-indigo-50/40 text-indigo-900 border-l border-indigo-100">
                  Bab Awal (Editor)
                </th>
                <th className="px-4 py-3.5 min-w-[210px] bg-indigo-50/40 text-indigo-900 border-l border-indigo-100">
                  Bab Akhir (Editor)
                </th>
                <th className="px-3 py-3.5 text-right min-w-[80px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPackages.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300 opacity-60" />
                    <p className="font-semibold text-slate-600">Tidak ada paket kurikulum yang cocok dengan filter</p>
                    <p className="text-[11px] text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau opsi filter di atas.</p>
                  </td>
                </tr>
              ) : (
                filteredPackages.map((pkg) => {
                  const hasUnits = pkg.subjectUnits.length > 0;
                  const firstUnit = pkg.scopedUnits[0];
                  const lastUnit = pkg.scopedUnits[pkg.scopedUnits.length - 1];

                  // Pacing Badge
                  let lajuBadge = null;
                  if (pkg.totalMeetings === 0) {
                    lajuBadge = (
                      <span className="text-[11px] text-slate-400 font-medium italic">
                        — (0 pertemuan)
                      </span>
                    );
                  } else if (pkg.laju !== null) {
                    let badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
                    let desc = 'standar';

                    if (pkg.laju <= 2.0) {
                      badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      desc = 'santai';
                    } else if (pkg.laju > 2.0 && pkg.laju <= 4.0) {
                      badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
                      desc = 'standar';
                    } else if (pkg.laju > 4.0 && pkg.laju <= 7.0) {
                      badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
                      desc = 'intensif';
                    } else {
                      badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                      desc = 'sangat cepat';
                    }

                    lajuBadge = (
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${badgeColor}`}>
                            <TrendingUp className="w-3 h-3 shrink-0" />
                            <span>{pkg.laju.toFixed(1)} hal/sesi</span>
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {desc} ({pkg.totalPages} hal / {pkg.totalMeetings} sesi)
                        </span>
                      </div>
                    );
                  }

                  return (
                    <tr
                      key={pkg.key}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* 1. Subject */}
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-start gap-2.5">
                          <div
                            className="w-3 h-3 rounded-full mt-1 shrink-0 shadow-2xs border border-white"
                            style={{ backgroundColor: pkg.subject.color || '#6366f1' }}
                            title={`Color: ${pkg.subject.color}`}
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors block">
                              {pkg.subject.name}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                {pkg.subject.code}
                              </span>
                              {pkg.subject.department && (
                                <span className="text-[10px] text-slate-400">
                                  {pkg.subject.department}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Class */}
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-lg bg-slate-100 text-slate-700 shrink-0">
                            <ClassIcon icon={pkg.classObj.icon} className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 block">
                              {pkg.classObj.name}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Tingkat {pkg.classObj.grade || '—'} {pkg.classObj.section ? `(${pkg.classObj.section})` : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 3. Total Pertemuan */}
                      <td className="px-4 py-3 align-top text-center">
                        {pkg.totalMeetings > 0 ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200/80">
                              <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                              <span>{pkg.totalMeetings}</span>
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5">pertemuan</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>0 Sesi</span>
                          </span>
                        )}
                      </td>

                      {/* 4. Cakupan Bab */}
                      <td className="px-4 py-3 align-top">
                        {!hasUnits ? (
                          <span className="text-[11px] text-slate-400 italic">
                            0 Bab (Materi belum diisi)
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-xs">
                                {pkg.scopedUnits.length} Bab
                              </span>
                              {pkg.hasCustomScope ? (
                                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                  Kustom
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-slate-400">
                                  (Penuh: {pkg.subjectUnits.length})
                                </span>
                              )}
                            </div>
                            {firstUnit && lastUnit && (
                              <p className="text-[10px] text-slate-500 truncate max-w-[190px]" title={`Bab ${firstUnit.no ?? 1} s/d ${lastUnit.eno ?? lastUnit.no ?? 'akhir'}`}>
                                Bab {firstUnit.no ?? 1} – {lastUnit.eno ?? lastUnit.no ?? 'akhir'}
                                {firstUnit.page_start && lastUnit.page_end ? ` (Hal ${firstUnit.page_start}–${lastUnit.page_end})` : ''}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 5. Laju */}
                      <td className="px-4 py-3 align-top">
                        {lajuBadge}
                      </td>

                      {/* 6. Bab Awal (The actual editor field) */}
                      <td className="px-4 py-3 align-top bg-indigo-50/20 border-l border-indigo-100/70">
                        {!hasUnits ? (
                          <span className="text-[11px] text-slate-400 italic">Master kosong</span>
                        ) : (
                          <div className="space-y-1">
                            <select
                              value={pkg.startUnitId}
                              disabled={!isAdmin}
                              onChange={(e) => {
                                handleScopeChange(
                                  pkg.subject.id,
                                  pkg.classObj.id,
                                  e.target.value,
                                  pkg.endUnitId
                                );
                              }}
                              className="w-full text-xs font-medium py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed shadow-2xs"
                              title="Pilih Bab Awal untuk paket ini"
                            >
                              {pkg.subjectUnits.map((u, idx) => (
                                <option key={u.id} value={u.id}>
                                  {u.order || idx + 1}. {formatUnitDisplay(u)}
                                </option>
                              ))}
                            </select>
                            {firstUnit && (
                              <span className="text-[10px] text-slate-400 block truncate" title={firstUnit.title}>
                                Mulai: {firstUnit.title}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 7. Bab Akhir (The actual editor field) */}
                      <td className="px-4 py-3 align-top bg-indigo-50/20 border-l border-indigo-100/70">
                        {!hasUnits ? (
                          <span className="text-[11px] text-slate-400 italic">Master kosong</span>
                        ) : (
                          <div className="space-y-1">
                            <select
                              value={pkg.endUnitId}
                              disabled={!isAdmin}
                              onChange={(e) => {
                                handleScopeChange(
                                  pkg.subject.id,
                                  pkg.classObj.id,
                                  pkg.startUnitId,
                                  e.target.value
                                );
                              }}
                              className="w-full text-xs font-medium py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed shadow-2xs"
                              title="Pilih Bab Akhir untuk paket ini"
                            >
                              {pkg.subjectUnits.map((u, idx) => (
                                <option key={u.id} value={u.id}>
                                  {u.order || idx + 1}. {formatUnitDisplay(u)}
                                </option>
                              ))}
                            </select>
                            {lastUnit && (
                              <span className="text-[10px] text-slate-400 block truncate" title={lastUnit.title}>
                                Hingga: {lastUnit.title}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 8. Actions */}
                      <td className="px-3 py-3 align-top text-right">
                        <div className="flex items-center justify-end gap-1">
                          {pkg.hasCustomScope && (
                            <button
                              type="button"
                              onClick={() => handleResetToFull(pkg.subject.id, pkg.classObj.id)}
                              className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              title="Kembalikan ke Cakupan Penuh (Default)"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {onNavigateToJournal && (
                            <button
                              type="button"
                              onClick={() => onNavigateToJournal(pkg.subject.id, pkg.classObj.id)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="Buka Jurnal & Kalender Pacing Paket Ini"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">Menampilkan {filteredPackages.length}</span> dari {allPackages.length} paket kurikulum
          </div>
          <p className="text-[11px] text-slate-400">
            Perubahan pada <span className="font-semibold text-slate-600">Bab Awal</span> dan <span className="font-semibold text-slate-600">Bab Akhir</span> langsung tersimpan dan otomatis memperbarui proyeksi materi pada Jurnal &amp; Jadwal.
          </p>
        </div>
      </div>
    </div>
  );
};
