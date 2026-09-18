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
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ChevronUp
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
  initialSubView?: 'rules' | 'kaldik' | 'integrity';
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
  // Sub-view mode: 'rules' (Aturan Jadwal KBM) vs 'kaldik' (Kaldik Events Database) vs 'integrity' (Diagnostik)
  const [activeSubView, setActiveSubView] = useState<'rules' | 'kaldik' | 'integrity'>(initialSubView);

  useEffect(() => {
    if (initialSubView) {
      setActiveSubView(initialSubView);
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
  const [showIntegrityPanel, setShowIntegrityPanel] = useState(false);
  const [showPeriodsOverview, setShowPeriodsOverview] = useState(false);

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
      {/* Top Segmented Switcher: Rules vs Kaldik vs Integrity */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            id="subview-btn-rules"
            onClick={() => setActiveSubView('rules')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeSubView === 'rules'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/70'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Aturan Jadwal KBM ({db.rules.length})</span>
          </button>

          <button
            type="button"
            id="subview-btn-kaldik"
            onClick={() => setActiveSubView('kaldik')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeSubView === 'kaldik'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/70'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5 text-amber-500" />
            <span>Database Event Kaldik ({(db.kaldikEvents || []).length})</span>
          </button>

          <button
            type="button"
            id="subview-btn-integrity"
            onClick={() => setActiveSubView('integrity')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeSubView === 'integrity'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/70'
            }`}
          >
            {integrityAnalysis.totalIssues > 0 ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span>Diagnostik Integritas</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                integrityAnalysis.totalIssues > 0
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}
            >
              {integrityAnalysis.totalIssues > 0 ? `${integrityAnalysis.totalIssues} Isu` : 'OK'}
            </span>
          </button>
        </div>

        {activeSubView === 'rules' && onAddRule && (
          <button
            type="button"
            id="btn-add-rule-from-database"
            onClick={() => {
              if (!isAdmin && onOpenAdminLogin) {
                onOpenAdminLogin();
                return;
              }
              onAddRule();
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer shadow-2xs ml-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Aturan Jadwal</span>
          </button>
        )}
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

      {/* VIEW 2: INTEGRITY DIAGNOSTICS VIEW */}
      {activeSubView === 'integrity' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg ${integrityAnalysis.totalIssues > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {integrityAnalysis.totalIssues > 0 ? <AlertTriangle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Laporan Integritas &amp; Konflik Jadwal
                </h3>
                <p className="text-xs text-slate-500">
                  Pemindaian menyeluruh terhadap konflik slot (guru, kelas, ruang), tumpang tindih tanggal fase/periode, dan referensi entitas.
                </p>
              </div>
            </div>

            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
              integrityAnalysis.totalIssues > 0
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
            }`}>
              {integrityAnalysis.totalIssues > 0 ? `${integrityAnalysis.totalIssues} Masalah Ditemukan` : 'Integritas 100% Valid'}
            </span>
          </div>

          {integrityAnalysis.totalIssues === 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center text-emerald-900 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <div className="font-bold text-sm">Semua Aturan Jadwal &amp; Kalender Berjalan Selaras!</div>
              <p className="text-xs text-emerald-700 max-w-md mx-auto">
                Tidak ada guru atau kelas yang terjadwal ganda pada waktu bersamaan, tidak ada periode beririsan tanggal, dan seluruh referensi entitas lengkap.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Conflicts */}
              {integrityAnalysis.conflicts.length > 0 && (
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Konflik Jadwal Nyata ({integrityAnalysis.conflicts.length} Kasus):</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {integrityAnalysis.conflicts.map((conflict, idx) => (
                      <div
                        key={conflict.id || idx}
                        className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-200 shadow-2xs text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between font-bold text-slate-900">
                          <span className="text-amber-950 font-bold">{conflict.title}</span>
                          <span className="text-[10px] font-mono text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-bold">
                            {dayNameIdMap[conflict.day] || conflict.day}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-700 leading-relaxed">
                          {conflict.description}
                        </p>
                        <div className="space-y-1.5 pt-1.5 border-t border-amber-200/60">
                          <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                            Aturan Jadwal Terkait:
                          </div>
                          {conflict.involvedRuleIds.map((rid) => {
                            const r = db.rules.find((rule) => rule.id === rid);
                            if (!r) return null;
                            const subj = subjectMap.get(r.subjectId);
                            const tch = teacherMap.get(r.teacherId);
                            const cls = classMap.get(r.classId);
                            return (
                              <div
                                key={r.id}
                                className="flex items-center justify-between text-[11px] bg-white p-2 rounded-lg border border-amber-200"
                              >
                                <span className="font-medium text-slate-800">
                                  <code className="font-mono font-bold text-indigo-700 mr-1.5">{r.id}</code>
                                  {subj?.name || r.subjectId} ({cls?.name || r.classId} • {tch?.name || r.teacherId})
                                </span>
                                {onEditRule && (
                                  <button
                                    type="button"
                                    onClick={() => onEditRule(r)}
                                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer ml-2 shrink-0"
                                  >
                                    Edit Aturan
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Period overlaps */}
              {integrityAnalysis.periodOverlaps.length > 0 && (
                <div className="space-y-2.5 pt-3 border-t border-slate-100">
                  <div className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-purple-600" />
                    <span>Fase / Periode Beririsan ({integrityAnalysis.periodOverlaps.length} Kasus):</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {integrityAnalysis.periodOverlaps.map((overlap, idx) => (
                      <div
                        key={idx}
                        className="bg-purple-50/50 p-3.5 rounded-xl border border-purple-200 shadow-2xs text-xs space-y-1"
                      >
                        <div className="font-bold text-slate-900">
                          {overlap.period1.name} &amp; {overlap.period2.name}
                        </div>
                        <div className="text-[11px] font-mono text-purple-800">
                          Rentang tanggal bertabrakan: {overlap.overlapStart} s.d. {overlap.overlapEnd}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Orphaned rules */}
              {integrityAnalysis.orphanedRules.length > 0 && (
                <div className="space-y-2.5 pt-3 border-t border-slate-100">
                  <div className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Referensi Entitas Tidak Lengkap ({integrityAnalysis.orphanedRules.length} Aturan):</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {integrityAnalysis.orphanedRules.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-rose-50/50 p-3.5 rounded-xl border border-rose-200 shadow-2xs text-xs space-y-1"
                      >
                        <div className="font-bold text-slate-900 flex items-center justify-between">
                          <code className="text-rose-700 font-mono">{item.rule.id}</code>
                          {onEditRule && (
                            <button
                              type="button"
                              onClick={() => onEditRule(item.rule)}
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                            >
                              Perbaiki Aturan
                            </button>
                          )}
                        </div>
                        <div className="text-[11px] text-rose-800 font-medium">
                          {item.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: RULES TABLE VIEW */}
      {activeSubView === 'rules' && (
        <div className="space-y-4">
          {/* Top Banner: Metrics & Quick Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200/70 text-indigo-700">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      Manajemen Aturan Jadwal (Rules &amp; Periods)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800">
                      {stats.total} Aturan
                    </span>
                    {integrityAnalysis.totalIssues > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{integrityAnalysis.totalIssues} Isu Integritas</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Integritas OK</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Jelajahi seluruh aturan pemetaan jadwal, keterikatan periode kalender, dan diagnosa integritas jadwal.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={() => setShowIntegrityPanel(!showIntegrityPanel)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                    showIntegrityPanel
                      ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                      : integrityAnalysis.totalIssues > 0
                      ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {integrityAnalysis.totalIssues > 0 ? (
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span>Integritas ({integrityAnalysis.totalIssues})</span>
                  {showIntegrityPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                <button
                  type="button"
                  onClick={() => setShowPeriodsOverview(!showPeriodsOverview)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                    showPeriodsOverview
                      ? 'bg-purple-100 text-purple-900 border-purple-300 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-purple-600" />
                  <span>Jelajah Fase ({db.periods.length})</span>
                  {showPeriodsOverview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const csv = exportRulesToCsv(db);
                    downloadCsvFile(`rules_${new Date().toISOString().slice(0, 10)}.csv`, csv);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
                  title="Unduh daftar aturan jadwal dalam format CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Rules CSV</span>
                </button>
              </div>
            </div>

            {/* Quick Counters: Simple list */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span>Total:</span>
                <strong className="text-slate-800 font-semibold">{stats.total} aturan</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Aktif:</span>
                <strong className="text-emerald-700 font-semibold">{stats.active}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span>Non-Aktif:</span>
                <strong className="text-slate-700 font-semibold">{stats.inactive}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Pengecualian / Khusus:</span>
                <strong className="text-amber-700 font-semibold">{stats.withExceptions}</strong>
              </span>
            </div>
          </div>

          {/* Collapsible Panel 1: Data Integrity & Diagnostic Inspector */}
          {showIntegrityPanel && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-700" />
                  <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                    Diagnostik Integritas &amp; Konflik Data Jadwal
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setFilterStatus('integrity_issue')}
                  className="text-xs font-semibold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                >
                  Filter Tabel Aturan Bermasalah
                </button>
              </div>

              {integrityAnalysis.totalIssues === 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Semua aturan jadwal dan periode dalam keadaan valid! Tidak ditemukan konflik jadwal ganda atau periode beririsan.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Conflicts list */}
                  {integrityAnalysis.conflicts.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                        <span>Konflik Jadwal Nyata ({integrityAnalysis.conflicts.length} kasus):</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {integrityAnalysis.conflicts.map((conflict, idx) => (
                          <div
                            key={conflict.id || idx}
                            className="bg-white p-3 rounded-lg border border-amber-200 shadow-2xs text-xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between font-bold text-slate-800">
                              <span className="text-amber-900">{conflict.title}</span>
                              <span className="text-[11px] font-mono text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-bold">
                                {dayNameIdMap[conflict.day] || conflict.day}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              {conflict.description}
                            </p>
                            <div className="space-y-1 pl-1 pt-1 border-t border-slate-100">
                              <span className="text-[10px] text-slate-400 font-bold uppercase">Aturan yang Terlibat:</span>
                              {conflict.involvedRuleIds.map((rid) => {
                                const r = db.rules.find((rule) => rule.id === rid);
                                if (!r) return null;
                                const subj = subjectMap.get(r.subjectId);
                                const tch = teacherMap.get(r.teacherId);
                                const cls = classMap.get(r.classId);
                                return (
                                  <div
                                    key={r.id}
                                    className="flex items-center justify-between text-[11px] bg-slate-50 p-1.5 rounded border border-slate-200"
                                  >
                                    <span className="font-medium text-slate-800">
                                      <code className="font-mono font-bold text-indigo-700 mr-1">{r.id}</code>
                                      {subj?.name || r.subjectId} ({cls?.name || r.classId} • {tch?.name || r.teacherId})
                                    </span>
                                    {onEditRule && (
                                      <button
                                        type="button"
                                        onClick={() => onEditRule(r)}
                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                                      >
                                        Edit
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Period overlaps */}
                  {integrityAnalysis.periodOverlaps.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-amber-200/70">
                      <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-purple-700" />
                        <span>Periode Kalender Beririsan ({integrityAnalysis.periodOverlaps.length} irisan):</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {integrityAnalysis.periodOverlaps.map((overlap, idx) => (
                          <div
                            key={idx}
                            className="bg-white p-3 rounded-lg border border-purple-200 shadow-2xs text-xs space-y-1"
                          >
                            <div className="font-bold text-slate-900">
                              {overlap.period1.name} &amp; {overlap.period2.name}
                            </div>
                            <div className="text-[11px] font-mono text-purple-800">
                              Irisan rentang tanggal: {overlap.overlapStart} s.d. {overlap.overlapEnd}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Collapsible Panel 2: Periods Overview & Cross-Reference */}
          {showPeriodsOverview && (
            <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-700" />
                  <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wide">
                    Daftar Periode / Fase Akademik &amp; Keterkaitan Aturan
                  </h4>
                </div>
                <span className="text-[11px] text-purple-800">
                  Total: {db.periods.length} fase
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {sortedPeriods.map((p) => {
                  const ruleCount = db.rules.filter((r) => r.periodIds?.includes(p.id)).length;
                  const isSelected = filterPeriod === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setFilterPeriod(isSelected ? 'all' : p.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-purple-600 text-white border-purple-700 shadow-sm'
                          : 'bg-white hover:bg-purple-50/50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-mono uppercase font-bold ${isSelected ? 'text-purple-200' : 'text-slate-400'}`}>
                          {p.id}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isSelected ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {ruleCount} Aturan
                        </span>
                      </div>
                      <div className={`font-bold text-xs mt-1 truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                        {p.name}
                      </div>
                      <div className={`text-[11px] font-mono mt-1 ${isSelected ? 'text-purple-100' : 'text-slate-500'}`}>
                        {p.startDate} ~ {p.endDate}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filters Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              {/* Search Input */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari ID aturan, mapel, guru, kelas, sesi, atau ruangan..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Reset Filters */}
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
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>

            {/* Dropdowns Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1 border-t border-slate-100 text-xs">
              {/* Status Filter */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="w-full text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">Semua Status</option>
                  <option value="active">Aktif Saja</option>
                  <option value="inactive">Non-Aktif Saja</option>
                  <option value="exceptions">Ada Pengecualian</option>
                  <option value="integrity_issue">⚠️ Ada Isu Integritas</option>
                </select>
              </div>

              {/* Hari Filter */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Hari</label>
                <select
                  value={filterDay}
                  onChange={(e) => setFilterDay(e.target.value)}
                  className="w-full text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">Semua Hari</option>
                  {daysList.map((d) => (
                    <option key={d} value={d}>
                      {dayNameIdMap[d] || d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Program / Kelas Filter */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Program / Kelas</label>
                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="w-full text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">Semua Program</option>
                  {db.classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Guru Filter */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Guru</label>
                <select
                  value={filterTeacher}
                  onChange={(e) => setFilterTeacher(e.target.value)}
                  className="w-full text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">Semua Guru</option>
                  {db.teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mapel Filter */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Mata Pelajaran</label>
                <select
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                  className="w-full text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">Semua Mapel</option>
                  {db.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Periode / Fase Filter */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Fase / Periode</label>
                <select
                  value={filterPeriod}
                  onChange={(e) => setFilterPeriod(e.target.value)}
                  className="w-full text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">Semua Fase</option>
                  {sortedPeriods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
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
