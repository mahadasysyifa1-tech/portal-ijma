import React, { useState, useMemo, useEffect } from 'react';
import {
  DatabaseState,
  ScheduleRule,
  Period,
  Subject,
  Teacher,
  ClassEntity,
  Room,
  Session
} from '../../types';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  BookOpen,
  Users,
  DoorOpen,
  Calendar,
  CalendarDays,
  Download,
  Filter,
  RefreshCw,
  X
} from 'lucide-react';
import { exportRulesToCsv, downloadCsvFile } from '../../utils/csvHelper';
import { detectConflicts } from '../../utils/scheduleEngine';
import { KaldikEventsDatabaseTab } from './KaldikEventsDatabaseTab';

interface RulesDatabaseTabProps {
  db: DatabaseState;
  onUpdateDb?: React.Dispatch<React.SetStateAction<DatabaseState>> | ((updater: (prev: DatabaseState) => DatabaseState) => void);
  onEditRule?: (rule: ScheduleRule) => void;
  onAddRule?: () => void;
  onToggleRuleActive?: (ruleId: string) => void;
  onDeleteRule?: (ruleId: string) => void;
  isAdmin?: boolean;
  onOpenAdminLogin?: () => void;
  initialSubView?: 'rules' | 'kaldik';
}

export const RulesDatabaseTab: React.FC<RulesDatabaseTabProps> = ({
  db,
  onUpdateDb,
  onEditRule,
  onAddRule,
  onToggleRuleActive,
  onDeleteRule,
  isAdmin = true,
  onOpenAdminLogin,
  initialSubView = 'rules'
}) => {
  // Sub-view mode: 'rules' (Aturan Jadwal KBM) vs 'kaldik' (Kaldik Events Database)
  const [activeSubView, setActiveSubView] = useState<'rules' | 'kaldik'>(
    initialSubView === 'kaldik' ? 'kaldik' : 'rules'
  );

  useEffect(() => {
    if (initialSubView) {
      setActiveSubView(initialSubView === 'kaldik' ? 'kaldik' : 'rules');
    }
  }, [initialSubView]);

  // State for filters in Rules view
  const [search, setSearch] = useState('');
  const [filterDay, setFilterDay] = useState<string>('all');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterTeacher, setFilterTeacher] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'exceptions' | 'integrity_issue'>('all');

  // In-UI Confirmation state for deleting a rule (No window.confirm!)
  const [ruleToDelete, setRuleToDelete] = useState<ScheduleRule | null>(null);

  // Helper maps for fast relational lookups
  const subjectMap = useMemo(() => new Map<string, Subject>(db.subjects.map((s) => [s.id, s])), [db.subjects]);
  const teacherMap = useMemo(() => new Map<string, Teacher>(db.teachers.map((t) => [t.id, t])), [db.teachers]);
  const classMap = useMemo(() => new Map<string, ClassEntity>(db.classes.map((c) => [c.id, c])), [db.classes]);
  const roomMap = useMemo(() => new Map<string, Room>(db.rooms.map((r) => [r.id, r])), [db.rooms]);
  const sessionMap = useMemo(() => new Map<string, Session>(db.sessions.map((s) => [s.id, s])), [db.sessions]);
  const periodMap = useMemo(() => new Map<string, Period>(db.periods.map((p) => [p.id, p])), [db.periods]);
  const sortedPeriods = useMemo(
    () => [...db.periods].sort((a, b) => (a.periodNumber ?? 0) - (b.periodNumber ?? 0)),
    [db.periods]
  );

  // Authoritative Conflict Detection & Data Integrity Diagnostics
  const conflicts = useMemo(() => detectConflicts(db), [db]);

  const integrityAnalysis = useMemo(() => {
    // 1. Conflict rule IDs from authoritative scheduleEngine
    const conflictingRuleIds = new Set<string>();
    conflicts.forEach((c) => {
      c.involvedRuleIds.forEach((id) => conflictingRuleIds.add(id));
    });

    // 2. Scan db.periods for overlapping date ranges
    const periodOverlaps: {
      period1: Period;
      period2: Period;
      overlapStart: string;
      overlapEnd: string;
    }[] = [];

    for (let i = 0; i < db.periods.length; i++) {
      for (let j = i + 1; j < db.periods.length; j++) {
        const p1 = db.periods[i];
        const p2 = db.periods[j];
        if (p1.startDate && p1.endDate && p2.startDate && p2.endDate) {
          if (p1.startDate <= p2.endDate && p2.startDate <= p1.endDate) {
            const overlapStart = p1.startDate > p2.startDate ? p1.startDate : p2.startDate;
            const overlapEnd = p1.endDate < p2.endDate ? p1.endDate : p2.endDate;
            periodOverlaps.push({
              period1: p1,
              period2: p2,
              overlapStart,
              overlapEnd
            });
          }
        }
      }
    }

    // 3. Scan db.rules for missing or orphaned entity references
    const orphanedRules: { rule: ScheduleRule; reason: string }[] = [];
    const orphanedRuleIds = new Set<string>();
    for (const r of db.rules) {
      const missing: string[] = [];
      if (!subjectMap.has(r.subjectId)) missing.push(`Mapel (${r.subjectId})`);
      if (!teacherMap.has(r.teacherId)) missing.push(`Guru (${r.teacherId})`);
      if (!classMap.has(r.classId)) missing.push(`Kelas (${r.classId})`);
      if (!sessionMap.has(r.sessionId)) missing.push(`Sesi (${r.sessionId})`);
      if (r.periodIds && r.periodIds.some((pid) => !periodMap.has(pid))) {
        const invalidPids = r.periodIds.filter((pid) => !periodMap.has(pid));
        missing.push(`Fase (${invalidPids.join(', ')})`);
      }
      if (missing.length > 0) {
        conflictingRuleIds.add(r.id);
        orphanedRuleIds.add(r.id);
        orphanedRules.push({
          rule: r,
          reason: `Referensi tidak ditemukan: ${missing.join(', ')}`
        });
      }
    }

    const totalIssues = conflicts.length + periodOverlaps.length + orphanedRules.length;

    return {
      conflicts,
      periodOverlaps,
      orphanedRules,
      conflictingRuleIds,
      orphanedRuleIds,
      totalIssues
    };
  }, [db, conflicts, subjectMap, teacherMap, classMap, sessionMap, periodMap]);

  // Filtered rules
  const filteredRules = useMemo(() => {
    return db.rules.filter((rule) => {
      // Status filter
      if (filterStatus === 'active' && !rule.active) return false;
      if (filterStatus === 'inactive' && rule.active) return false;
      if (filterStatus === 'exceptions' && (!rule.exceptions || rule.exceptions.length === 0)) return false;
      if (filterStatus === 'integrity_issue') {
        const hasIssue = integrityAnalysis.conflictingRuleIds.has(rule.id) || integrityAnalysis.orphanedRuleIds.has(rule.id);
        if (!hasIssue) return false;
      }

      // Day filter
      if (filterDay !== 'all') {
        const ruleDays = rule.daysOfWeek || (rule.dayOfWeek ? [rule.dayOfWeek] : []);
        if (!ruleDays.includes(filterDay as any)) return false;
      }

      // Class filter
      if (filterClass !== 'all' && rule.classId !== filterClass) return false;

      // Teacher filter
      if (filterTeacher !== 'all' && rule.teacherId !== filterTeacher) return false;

      // Subject filter
      if (filterSubject !== 'all' && rule.subjectId !== filterSubject) return false;

      // Period filter
      if (filterPeriod !== 'all') {
        if (!rule.periodIds || !rule.periodIds.includes(filterPeriod)) return false;
      }

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const subj = subjectMap.get(rule.subjectId)?.name?.toLowerCase() || '';
        const subjCode = subjectMap.get(rule.subjectId)?.code?.toLowerCase() || '';
        const tch = teacherMap.get(rule.teacherId)?.name?.toLowerCase() || '';
        const cls = classMap.get(rule.classId)?.name?.toLowerCase() || '';
        const rm = roomMap.get(rule.roomId)?.name?.toLowerCase() || '';
        const ses = sessionMap.get(rule.sessionId)?.name?.toLowerCase() || '';
        const id = rule.id.toLowerCase();
        const notes = (rule.notes || '').toLowerCase();

        return (
          id.includes(q) ||
          subj.includes(q) ||
          subjCode.includes(q) ||
          tch.includes(q) ||
          cls.includes(q) ||
          rm.includes(q) ||
          ses.includes(q) ||
          notes.includes(q)
        );
      }

      return true;
    });
  }, [
    db.rules,
    filterStatus,
    filterDay,
    filterClass,
    filterTeacher,
    filterSubject,
    filterPeriod,
    search,
    subjectMap,
    teacherMap,
    classMap,
    roomMap,
    sessionMap,
    integrityAnalysis.conflictingRuleIds,
    integrityAnalysis.orphanedRuleIds
  ]);

  // Statistics
  const stats = useMemo(() => {
    const total = db.rules.length;
    const active = db.rules.filter((r) => r.active).length;
    const inactive = total - active;
    const withExceptions = db.rules.filter((r) => r.exceptions && r.exceptions.length > 0).length;
    return { total, active, inactive, withExceptions };
  }, [db.rules]);

  const daysList = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayNameIdMap: Record<string, string> = {
    Monday: 'Senin',
    Tuesday: 'Selasa',
    Wednesday: 'Rabu',
    Thursday: 'Kamis',
    Friday: 'Jumat',
    Saturday: 'Sabtu',
    Sunday: 'Ahad'
  };

  return (
    <div className="space-y-4">
      {/* Top Segmented Switcher */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            id="subview-btn-rules"
            onClick={() => setActiveSubView('rules')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeSubView === 'rules'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/70'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Aturan Jadwal KBM</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              activeSubView === 'rules' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {db.rules.length}
            </span>
          </button>

          <button
            type="button"
            id="subview-btn-kaldik"
            onClick={() => setActiveSubView('kaldik')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeSubView === 'kaldik'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/70'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Event Kaldik</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              activeSubView === 'kaldik' ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {(db.kaldikEvents || []).length}
            </span>
          </button>
        </div>
      </div>

      {/* VIEW 1: KALDIK EVENTS DATABASE */}
      {activeSubView === 'kaldik' && (
        <KaldikEventsDatabaseTab
          db={db}
          onUpdateDb={onUpdateDb}
          isAdmin={isAdmin}
          onOpenAdminLogin={onOpenAdminLogin}
        />
      )}

      {/* VIEW 2: RULES TABLE VIEW */}
      {activeSubView === 'rules' && (
        <div className="space-y-4">
          {/* Header & Inline Stats Summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200/70 text-indigo-700 flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 leading-tight">
                    Manajemen Aturan Jadwal KBM
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Pemetaan jadwal reguler, alokasi guru, kelas, ruang, dan keterikatan fase/periode.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Inline stats pills */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200/80 rounded-lg">
                  <span className="text-slate-500 font-medium">Total:</span>
                  <span className="font-bold text-slate-800">{stats.total}</span>
                  <span className="text-[10px] text-slate-400">aturan</span>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50/70 border border-emerald-200/70 rounded-lg text-emerald-900">
                  <span className="text-emerald-700 font-medium">Aktif:</span>
                  <span className="font-bold">{stats.active}</span>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200/70 rounded-lg text-slate-700">
                  <span className="text-slate-500 font-medium">Non-Aktif:</span>
                  <span className="font-bold">{stats.inactive}</span>
                </div>

                {stats.withExceptions > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50/70 border border-amber-200/70 rounded-lg text-amber-900">
                    <span className="text-amber-700 font-medium">Khusus:</span>
                    <span className="font-bold">{stats.withExceptions}</span>
                  </div>
                )}

                {/* CSV Download Button */}
                <button
                  type="button"
                  onClick={() => {
                    const csv = exportRulesToCsv(db);
                    downloadCsvFile(`rules_${new Date().toISOString().slice(0, 10)}.csv`, csv);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                  title="Unduh daftar aturan jadwal dalam format CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>

                {/* Add Rule Button */}
                {onAddRule && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!isAdmin && onOpenAdminLogin) {
                        onOpenAdminLogin();
                        return;
                      }
                      onAddRule();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-2xs transition-colors cursor-pointer ml-auto sm:ml-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Aturan</span>
                  </button>
                )}
              </div>
            </div>

            {/* Streamlined Filter Toolbar */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {/* Search bar */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari ID aturan, mapel, guru, kelas, sesi, atau ruangan..."
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
                {/* Status Filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">Semua Status</option>
                  <option value="active">Aktif Saja</option>
                  <option value="inactive">Non-Aktif</option>
                  <option value="exceptions">Pengecualian</option>
                  <option value="integrity_issue">⚠️ Isu Integritas</option>
                </select>

                {/* Hari Filter */}
                <select
                  value={filterDay}
                  onChange={(e) => setFilterDay(e.target.value)}
                  className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">Semua Hari</option>
                  {daysList.map((d) => (
                    <option key={d} value={d}>
                      {dayNameIdMap[d] || d}
                    </option>
                  ))}
                </select>

                {/* Kelas Filter */}
                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer max-w-[130px] truncate"
                >
                  <option value="all">Semua Kelas</option>
                  {db.classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>

                {/* Guru Filter */}
                <select
                  value={filterTeacher}
                  onChange={(e) => setFilterTeacher(e.target.value)}
                  className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer max-w-[140px] truncate"
                >
                  <option value="all">Semua Guru</option>
                  {db.teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>

                {/* Mapel Filter */}
                <select
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                  className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer max-w-[140px] truncate"
                >
                  <option value="all">Semua Mapel</option>
                  {db.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                {/* Periode Filter */}
                <select
                  value={filterPeriod}
                  onChange={(e) => setFilterPeriod(e.target.value)}
                  className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer max-w-[140px] truncate"
                >
                  <option value="all">Semua Fase</option>
                  {sortedPeriods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                {/* Reset Button */}
                {(filterDay !== 'all' ||
                  filterClass !== 'all' ||
                  filterTeacher !== 'all' ||
                  filterSubject !== 'all' ||
                  filterPeriod !== 'all' ||
                  filterStatus !== 'all' ||
                  search) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setFilterDay('all');
                      setFilterClass('all');
                      setFilterTeacher('all');
                      setFilterSubject('all');
                      setFilterPeriod('all');
                      setFilterStatus('all');
                    }}
                    className="inline-flex items-center gap-1 text-xs py-1.5 px-2.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                    title="Reset filter"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Rules Data Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs">
              <div className="font-bold text-slate-700 flex items-center gap-2">
                <span>Daftar Aturan Jadwal Terjadwal</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px]">
                  {filteredRules.length} dari {db.rules.length} aturan
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2.5 w-10 text-center">Status</th>
                    <th className="px-3 py-2.5">Hari &amp; Sesi</th>
                    <th className="px-3 py-2.5">Mata Pelajaran &amp; Guru</th>
                    <th className="px-3 py-2.5">Kelas &amp; Ruangan</th>
                    <th className="px-3 py-2.5">Fase Terkait</th>
                    <th className="px-3 py-2.5 text-center">Integritas</th>
                    <th className="px-3 py-2.5 text-right w-20">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRules.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                        <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600 text-sm">Tidak ada aturan jadwal yang cocok</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {search ||
                          filterDay !== 'all' ||
                          filterClass !== 'all' ||
                          filterTeacher !== 'all' ||
                          filterSubject !== 'all' ||
                          filterPeriod !== 'all' ||
                          filterStatus !== 'all'
                            ? 'Coba atur ulang filter pencarian Anda di atas.'
                            : 'Belum ada aturan jadwal yang dibuat.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredRules.map((rule) => {
                      const subj = subjectMap.get(rule.subjectId);
                      const tch = teacherMap.get(rule.teacherId);
                      const cls = classMap.get(rule.classId);
                      const room = roomMap.get(rule.roomId);
                      const ses = sessionMap.get(rule.sessionId);

                      const days = rule.daysOfWeek || (rule.dayOfWeek ? [rule.dayOfWeek] : []);
                      const hasConflict = integrityAnalysis.conflictingRuleIds.has(rule.id);
                      const hasOrphan = integrityAnalysis.orphanedRuleIds.has(rule.id);
                      const hasExceptions = rule.exceptions && rule.exceptions.length > 0;

                      return (
                        <tr
                          key={rule.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            !rule.active ? 'opacity-60 bg-slate-50/40' : ''
                          } ${hasConflict || hasOrphan ? 'bg-amber-50/20' : ''}`}
                        >
                          {/* Active Checkbox */}
                          <td className="px-3 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={rule.active}
                              onChange={() => onToggleRuleActive && onToggleRuleActive(rule.id)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                              title={rule.active ? 'Aturan Aktif (klik untuk nonaktifkan)' : 'Aturan Non-Aktif (klik untuk aktifkan)'}
                            />
                          </td>

                          {/* Hari & Sesi */}
                          <td className="px-3 py-2.5">
                            <div className="font-bold text-slate-800">
                              {days.map((d) => dayNameIdMap[d] || d).join(', ')}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>
                                {ses?.name || rule.sessionId} ({ses?.startTime} - {ses?.endTime})
                              </span>
                            </div>
                          </td>

                          {/* Mapel & Guru */}
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {subj && (
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: subj.color || '#4f46e5' }}
                                />
                              )}
                              <span className="font-bold text-slate-900">
                                {subj?.name || rule.subjectId}
                              </span>
                              {subj?.code && (
                                <span className="font-mono text-[10px] text-slate-400">
                                  ({subj.code})
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5">
                              <Users className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{tch?.name || rule.teacherId}</span>
                              {tch?.panggilan && (
                                <span className="text-[10px] text-slate-400">
                                  ({tch.panggilan})
                                </span>
                              )}
                            </div>
                            {rule.notes && (
                              <div className="text-[10px] text-slate-400 italic mt-0.5 line-clamp-1">
                                "{rule.notes}"
                              </div>
                            )}
                          </td>

                          {/* Kelas & Ruang */}
                          <td className="px-3 py-2.5">
                            <div className="font-bold text-slate-900">
                              {cls?.name || rule.classId}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <DoorOpen className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{room?.name || rule.roomId}</span>
                            </div>
                          </td>

                          {/* Periode */}
                          <td className="px-3 py-2.5">
                            {rule.periodIds && rule.periodIds.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {[...rule.periodIds]
                                  .sort((a, b) => {
                                    const pa = periodMap.get(a)?.periodNumber ?? 999;
                                    const pb = periodMap.get(b)?.periodNumber ?? 999;
                                    return pa - pb;
                                  })
                                  .map((pid) => {
                                    const p = periodMap.get(pid);
                                    return (
                                      <span
                                        key={pid}
                                        className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-medium"
                                        title={p ? `${p.name} (${p.startDate} s.d. ${p.endDate})` : pid}
                                      >
                                        {p?.name || pid}
                                      </span>
                                    );
                                  })}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Semua Fase</span>
                            )}
                            {hasExceptions && (
                              <div className="mt-1 text-[10px] text-amber-700 font-semibold">
                                ★ {rule.exceptions.length} Pengecualian
                              </div>
                            )}
                          </td>

                          {/* Integritas */}
                          <td className="px-3 py-2.5 text-center">
                            {hasConflict || hasOrphan ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300"
                                title="Aturan ini mengalami bentrok jadwal atau referensi tidak sinkron"
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-700" />
                                <span>Konflik</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-emerald-700">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>OK</span>
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {onEditRule && (
                                <button
                                  type="button"
                                  onClick={() => onEditRule(rule)}
                                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                  title="Edit Aturan Jadwal"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {onDeleteRule && (
                                <button
                                  type="button"
                                  onClick={() => setRuleToDelete(rule)}
                                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Hapus Aturan Jadwal"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
          </div>
        </div>
      )}

      {/* In-UI Confirmation Modal for Delete Rule (No window.confirm!) */}
      {ruleToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              Hapus Aturan Jadwal?
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Anda akan menghapus aturan jadwal untuk mata pelajaran{' '}
              <span className="font-semibold text-slate-800">
                {subjectMap.get(ruleToDelete.subjectId)?.name || ruleToDelete.subjectId}
              </span>{' '}
              ({classMap.get(ruleToDelete.classId)?.name || ruleToDelete.classId} •{' '}
              {teacherMap.get(ruleToDelete.teacherId)?.name || ruleToDelete.teacherId}).
              Jadwal ini tidak akan lagi dialokasikan pada kalender kelas.
            </p>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setRuleToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteRule) {
                    onDeleteRule(ruleToDelete.id);
                  }
                  setRuleToDelete(null);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                Ya, Hapus Aturan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
