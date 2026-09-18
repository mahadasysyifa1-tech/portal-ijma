import React, { useState, useMemo } from 'react';
import {
  DatabaseState,
  Subject,
  ClassEntity,
  Room,
  Teacher,
  Session,
  Period,
  SyllabusUnit
} from '../types';
import {
  Database,
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  GraduationCap,
  DoorOpen,
  Users,
  Clock,
  Sliders,
  Layers,
  Download,
  Upload,
  Search,
  Check,
  X,
  FileSpreadsheet,
  FileText,
  ChevronUp,
  ChevronDown,
  Book,
  ExternalLink,
  ShoppingCart,
  ShoppingBag,
  Link2,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Mail,
  Video
} from 'lucide-react';
import { ClassIcon, ClassIconPicker } from './ClassIcon';
import {
  exportRulesToCsv,
  exportEvtlogToCsv,
  exportTeachersToCsv,
  exportClassesToCsv,
  exportSubjectsToCsv,
  exportRoomsToCsv,
  exportSessionsToCsv,
  exportPeriodsToCsv,
  downloadCsvFile
} from '../utils/csvHelper';
import { exportSyllabusToCsv } from '../utils/syllabusImporter';
import { SyllabusImporterModal } from './syllabus/SyllabusImporterModal';
import { MateriDatabaseTab } from './database/MateriDatabaseTab';
import { detectConflicts } from '../utils/scheduleEngine';
import { ScheduleRule } from '../types';

interface EntityManagerProps {
  db: DatabaseState;
  onUpdateDb: (updater: (prev: DatabaseState) => DatabaseState) => void;
  onExportJson: () => void;
  onImportJson: (jsonString: string) => void;
  onEditRule?: (rule: ScheduleRule) => void;
  onAddRule?: () => void;
  onToggleRuleActive?: (ruleId: string) => void;
  onDeleteRule?: (ruleId: string) => void;
  onNavigateToExportImport?: () => void;
  onNavigateToRuleManager?: () => void;
  isAdmin?: boolean;
  onOpenAdminLogin?: () => void;
}

export const EntityManager: React.FC<EntityManagerProps> = ({
  db,
  onUpdateDb,
  onExportJson,
  onImportJson,
  onEditRule,
  onAddRule,
  onToggleRuleActive,
  onDeleteRule,
  onNavigateToExportImport,
  onNavigateToRuleManager,
  isAdmin = true,
  onOpenAdminLogin
}) => {
  const [subTab, setSubTab] = useState<
    'subjects' | 'classes' | 'rooms' | 'teachers' | 'sessions' | 'periods' | 'materi'
  >('subjects');
  const [search, setSearch] = useState('');
  const [editingItem, setEditingItem] = useState<{ type: string; data: any } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSyllabusImporterOpen, setIsSyllabusImporterOpen] = useState(false);

  const handleImportSyllabusUnits = (newUnits: SyllabusUnit[], mode: 'replace' | 'append') => {
    onUpdateDb((prev) => {
      if (mode === 'replace') {
        return {
          ...prev,
          syllabusUnits: newUnits
        };
      } else {
        const existing = prev.syllabusUnits || [];
        const map = new Map(existing.map((u) => [u.id, u]));
        newUnits.forEach((u) => map.set(u.id, u));
        return {
          ...prev,
          syllabusUnits: Array.from(map.values())
        };
      }
    });
  };

  // Helper maps for relations
  const subjectMap = new Map<string, Subject>(db.subjects.map((s) => [s.id, s]));
  const teacherMap = new Map<string, Teacher>(db.teachers.map((t) => [t.id, t]));
  const roomMap = new Map<string, Room>(db.rooms.map((r) => [r.id, r]));
  const sessionMap = new Map<string, Session>(db.sessions.map((s) => [s.id, s]));

  // Authoritative Data Integrity Diagnostics via scheduleEngine
  const conflicts = useMemo(() => detectConflicts(db), [db]);
  const integrityReport = useMemo(() => {
    // Overlapping period date ranges
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

    const totalIssues = conflicts.length + periodOverlaps.length;

    return {
      conflicts,
      periodOverlaps,
      totalIssues
    };
  }, [db.periods, conflicts]);

  // Generic delete handler
  const handleDelete = (type: string, id: string) => {
    // Check if used in rules
    const isUsedInRules = db.rules.some((r) => {
      if (type === 'subjects') return r.subjectId === id;
      if (type === 'classes') return r.classId === id;
      if (type === 'teachers') return r.teacherId === id;
      if (type === 'rooms') return r.roomId === id;
      if (type === 'sessions') return r.sessionId === id;
      if (type === 'periods') return r.periodIds.includes(id);
      return false;
    });

    if (isUsedInRules) {
      const confirmDelete = window.confirm(
        'Warning: This entity is currently referenced by one or more schedule rules. Deleting it may alter those rules. Proceed?'
      );
      if (!confirmDelete) return;
    }

    onUpdateDb((prev) => {
      const next = { ...prev };
      if (type === 'subjects') next.subjects = prev.subjects.filter((s) => s.id !== id);
      if (type === 'classes') next.classes = prev.classes.filter((c) => c.id !== id);
      if (type === 'rooms') next.rooms = prev.rooms.filter((r) => r.id !== id);
      if (type === 'teachers') next.teachers = prev.teachers.filter((t) => t.id !== id);
      if (type === 'sessions') {
        const remaining = prev.sessions.filter((s) => s.id !== id);
        // Auto-compute order sequentially so there are no gaps
        next.sessions = remaining
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((s, idx) => ({ ...s, order: idx + 1, sort_order: idx + 1 }));
      }
      if (type === 'periods') {
        const remaining = prev.periods.filter((p) => p.id !== id);
        next.periods = remaining
          .slice()
          .sort((a, b) => a.periodNumber - b.periodNumber)
          .map((p, idx) => ({ ...p, periodNumber: idx + 1, period_number: idx + 1 }));
      }
      return next;
    });
  };

  const handleSaveItem = (type: string, rawItemData: any) => {
    let itemData = { ...rawItemData };

    if (type === 'subjects') {
      const pdf = itemData.pdfLink || itemData.links?.pdf || undefined;
      const shopping = itemData.shoppingLink || itemData.links?.shopping || undefined;
      const shopping2 = itemData.shoppingLink2 || itemData.links?.shopping2 || undefined;
      const site = itemData.siteLink || itemData.links?.site || undefined;

      itemData = {
        ...itemData,
        default_teacher_id: itemData.defaultTeacherId || null,
        default_room_id: itemData.defaultRoomId || null,
        book: itemData.book ? String(itemData.book).trim() : undefined,
        pdfLink: pdf,
        shoppingLink: shopping,
        shoppingLink2: shopping2,
        siteLink: site,
        links: {
          pdf,
          shopping,
          shopping2,
          site,
          ...(itemData.links || {})
        }
      };
    }

    if (type === 'classes') {
      itemData = {
        ...itemData,
        icon: itemData.icon || 'GraduationCap',
        color: itemData.color || '#E0E7FF',
        onlineClassLink: itemData.onlineClassLink ? String(itemData.onlineClassLink).trim() : undefined,
        online_class_link: itemData.onlineClassLink ? String(itemData.onlineClassLink).trim() : undefined,
        default_room_id: itemData.defaultRoomId || null
      };
    }

    onUpdateDb((prev) => {
      const next = { ...prev };
      const listKey = type as keyof DatabaseState;
      let list = [...(prev[listKey] as any[])];

      const existingIndex = list.findIndex((x) => x.id === itemData.id);
      if (existingIndex >= 0) {
        list[existingIndex] = itemData;
      } else {
        list.push(itemData);
      }

      if (type === 'sessions') {
        // Auto-compute order: sort by specified order and re-index sequentially 1..N
        list = list
          .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
          .map((s, idx) => ({
            ...s,
            order: idx + 1,
            sort_order: idx + 1
          }));
      }

      if (type === 'periods') {
        // Auto-compute order: sort by periodNumber and re-index sequentially 1..N
        list = list
          .sort((a, b) => (Number(a.periodNumber) || 0) - (Number(b.periodNumber) || 0))
          .map((p, idx) => ({
            ...p,
            periodNumber: idx + 1,
            period_number: idx + 1
          }));
      }

      (next as any)[listKey] = list;
      return next;
    });

    setEditingItem(null);
    setIsCreating(false);
  };

  const handleMoveSession = (sessionId: string, direction: 'up' | 'down' = 'down') => {
    onUpdateDb((prev) => {
      const sorted = prev.sessions.slice().sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((s) => s.id === sessionId);
      if (index === -1) return prev;

      if (direction === 'down') {
        const [item] = sorted.splice(index, 1);
        const targetIndex = index === sorted.length ? 0 : index + 1;
        sorted.splice(targetIndex, 0, item);
      } else {
        const [item] = sorted.splice(index, 1);
        const targetIndex = index === 0 ? sorted.length : index - 1;
        sorted.splice(targetIndex, 0, item);
      }

      // Auto-compute order
      const nextSessions = sorted.map((s, idx) => ({
        ...s,
        order: idx + 1,
        sort_order: idx + 1
      }));

      return {
        ...prev,
        sessions: nextSessions
      };
    });
  };

  const handleMovePeriod = (periodId: string, direction: 'up' | 'down' = 'down') => {
    onUpdateDb((prev) => {
      const sorted = prev.periods.slice().sort((a, b) => a.periodNumber - b.periodNumber);
      const index = sorted.findIndex((p) => p.id === periodId);
      if (index === -1) return prev;

      if (direction === 'down') {
        const [item] = sorted.splice(index, 1);
        const targetIndex = index === sorted.length ? 0 : index + 1;
        sorted.splice(targetIndex, 0, item);
      } else {
        const [item] = sorted.splice(index, 1);
        const targetIndex = index === 0 ? sorted.length : index - 1;
        sorted.splice(targetIndex, 0, item);
      }

      // Auto-compute order
      const nextPeriods = sorted.map((p, idx) => ({
        ...p,
        periodNumber: idx + 1,
        period_number: idx + 1
      }));

      return {
        ...prev,
        periods: nextPeriods
      };
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      try {
        onImportJson(content);
        alert('Database imported successfully!');
      } catch (err) {
        alert('Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            <span>Database Tables & Entity Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Full Read/Write access: configure subjects, classes, rooms, teachers, sorted sessions, and periods.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onNavigateToRuleManager && (
            <button
              type="button"
              onClick={onNavigateToRuleManager}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors cursor-pointer"
              title="Buka Rule Manager Studio untuk mengatur aturan KBM, kaldik & silabus"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Buka Rule Manager</span>
              <ArrowRight className="w-3 h-3 text-indigo-400" />
            </button>
          )}
          {subTab !== 'materi' && (
            <button
              id="entity-add-btn"
              onClick={() => {
                setIsCreating(true);
                setEditingItem(null);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New {subTab.slice(0, -1)}</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-2xs flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1">

          <button
            onClick={() => {
              setSubTab('subjects');
              setIsCreating(false);
              setEditingItem(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              subTab === 'subjects'
                ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/80 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Book className="w-4 h-4" />
            <span>Mapel ({db.subjects.length})</span>
          </button>

          <button
            onClick={() => {
              setSubTab('classes');
              setIsCreating(false);
              setEditingItem(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              subTab === 'classes'
                ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/80 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Program ({db.classes.length})</span>
          </button>

          <button
            onClick={() => {
              setSubTab('rooms');
              setIsCreating(false);
              setEditingItem(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              subTab === 'rooms'
                ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/80 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <DoorOpen className="w-4 h-4" />
            <span>Ruang ({db.rooms.length})</span>
          </button>

          <button
            onClick={() => {
              setSubTab('teachers');
              setIsCreating(false);
              setEditingItem(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              subTab === 'teachers'
                ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/80 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Guru ({db.teachers.length})</span>
          </button>

          <button
            onClick={() => {
              setSubTab('sessions');
              setIsCreating(false);
              setEditingItem(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              subTab === 'sessions'
                ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/80 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Sesi ({db.sessions.length})</span>
          </button>

          <button
            onClick={() => {
              setSubTab('periods');
              setIsCreating(false);
              setEditingItem(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              subTab === 'periods'
                ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/80 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Fase ({db.periods.length})</span>
          </button>
          <button
            id="subtab-btn-materi"
            onClick={() => {
              setSubTab('materi');
              setIsCreating(false);
              setEditingItem(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'materi'
                ? 'bg-amber-50 text-amber-700 font-bold border border-amber-200/80 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Materi ({(db.syllabusUnits || []).length})</span>
          </button>          
        </div>

        {/* Search for Standard Tables */}
        {subTab !== 'materi' && (
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Filter ${subTab}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        )}
      </div>

      {/* Editor Modal for Entity */}
      {(isCreating || editingItem) && (
        <EntityFormModal
          type={editingItem?.type || subTab}
          initialData={editingItem?.data}
          db={db}
          onClose={() => {
            setIsCreating(false);
            setEditingItem(null);
          }}
          onSave={(itemData) => handleSaveItem(editingItem?.type || subTab, itemData)}
        />
      )}

      {/* Materi Silabus Database Tab */}
      {subTab === 'materi' && (
        <MateriDatabaseTab
          db={db}
          onUpdateDb={onUpdateDb}
        />
      )}

      {/* Standard Entities Data Table */}
      {subTab !== 'materi' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            {subTab === 'subjects' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                <tr>
                  <th className="px-4 py-3">Mata Pelajaran</th>
                  <th className="px-4 py-3">Kode</th>
                  <th className="px-4 py-3">Buku</th>
                  <th className="px-4 py-3">Tautan</th>
                  <th className="px-4 py-3">Departemen</th>
                  <th className="px-4 py-3">Guru Pengampu (Bawaan)</th>
                  <th className="px-4 py-3">Ruangan (Bawaan)</th>
                  <th className="px-4 py-3 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db.subjects
                  .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()))
                  .map((sub) => {
                    const defaultTeacher = sub.defaultTeacherId ? teacherMap.get(sub.defaultTeacherId) : null;
                    const defaultRoom = sub.defaultRoomId ? roomMap.get(sub.defaultRoomId) : null;
                    const hasPdf = Boolean(sub.pdfLink || sub.links?.pdf);
                    const hasShop1 = Boolean(sub.shoppingLink || sub.links?.shopping);
                    const hasShop2 = Boolean(sub.shoppingLink2 || sub.links?.shopping2);
                    const hasSite = Boolean(sub.siteLink || sub.links?.site);
                    const hasAnyLink = hasPdf || hasShop1 || hasShop2 || hasSite;

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-semibold text-slate-900 flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: sub.color }} />
                          <span>{sub.name}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600">{sub.code}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {sub.book ? (
                            <span className="inline-flex items-center gap-1 font-medium bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md">
                              <Book className="w-3 h-3 text-amber-700 shrink-0" />
                              <span className="truncate max-w-[140px]">{sub.book}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {hasAnyLink ? (
                            <div className="flex items-center gap-1">
                              {hasPdf && (
                                <a
                                  href={sub.pdfLink || sub.links?.pdf}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Buka Buku PDF"
                                  className="p-1 rounded bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                                >
                                  <FileText className="w-3 h-3" />
                                </a>
                              )}
                              {hasShop1 && (
                                <a
                                  href={sub.shoppingLink || sub.links?.shopping}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Link Pembelian 1"
                                  className="p-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                >
                                  <ShoppingCart className="w-3 h-3" />
                                </a>
                              )}
                              {hasShop2 && (
                                <a
                                  href={sub.shoppingLink2 || sub.links?.shopping2}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Link Pembelian 2"
                                  className="p-1 rounded bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100"
                                >
                                  <ShoppingBag className="w-3 h-3" />
                                </a>
                              )}
                              {hasSite && (
                                <a
                                  href={sub.siteLink || sub.links?.site}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Website / Referensi"
                                  className="p-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{sub.department}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {defaultTeacher ? (defaultTeacher.panggilan || defaultTeacher.name) : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {defaultRoom ? defaultRoom.name : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setEditingItem({ type: 'subjects', data: sub })}
                              className="p-1 text-slate-500 hover:text-indigo-600 rounded cursor-pointer"
                              title="Edit Mata Pelajaran"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete('subjects', sub.id)}
                              className="p-1 text-slate-500 hover:text-rose-600 rounded cursor-pointer"
                              title="Hapus Mata Pelajaran"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}

          {subTab === 'classes' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                <tr>
                  <th className="px-4 py-3">Rombel / Kelas</th>
                  <th className="px-4 py-3">Tautan Online</th>
                  <th className="px-4 py-3">Ruangan Bawaan</th>
                  <th className="px-4 py-3">Tingkat</th>
                  <th className="px-4 py-3">Divisi</th>
                  <th className="px-4 py-3">Peserta</th>
                  <th className="px-4 py-3 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db.classes
                  .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
                  .map((cls) => {
                    const defaultRoom = cls.defaultRoomId ? roomMap.get(cls.defaultRoomId) : null;
                    const classColor = cls.color || '#E0E7FF';
                    return (
                      <tr key={cls.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="p-1.5 rounded-lg border shadow-2xs shrink-0 flex items-center justify-center text-slate-800 transition-transform"
                              style={{
                                backgroundColor: classColor,
                                borderColor: 'rgba(0, 0, 0, 0.12)'
                              }}
                              title={`Warna Rombel: ${classColor}`}
                            >
                              <ClassIcon name={cls.icon} className="w-4 h-4" />
                            </span>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 leading-tight truncate">
                                {cls.name}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span
                                  className="w-2.5 h-2.5 rounded-full inline-block border border-black/15 shrink-0"
                                  style={{ backgroundColor: classColor }}
                                  title={`Kode Warna: ${classColor}`}
                                />
                                <span className="text-[10px] font-mono text-slate-500 font-medium">
                                  {classColor}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {cls.onlineClassLink ? (
                            <a
                              href={cls.onlineClassLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Buka Kelas Online: ${cls.onlineClassLink}`}
                              className="inline-flex items-center justify-center p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800 transition-colors shadow-2xs cursor-pointer"
                            >
                              <Video className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <span className="text-slate-300 font-mono text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {defaultRoom ? (
                            <span className="font-semibold text-slate-800">{defaultRoom.name}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">Tingkat {cls.grade}</td>
                        <td className="px-4 py-3 text-slate-600">{cls.section}</td>
                        <td className="px-4 py-3 text-slate-600">{cls.studentCount} peserta</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setEditingItem({ type: 'classes', data: cls })}
                              className="p-1 text-slate-500 hover:text-indigo-600 rounded cursor-pointer"
                              title="Edit Kelas"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete('classes', cls.id)}
                              className="p-1 text-slate-500 hover:text-rose-600 rounded cursor-pointer"
                              title="Hapus Kelas"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}

          {subTab === 'rooms' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                <tr>
                  <th className="px-4 py-3">Ruang</th>
                  <th className="px-4 py-3">Gedung</th>
                  <th className="px-4 py-3">Tipe</th>
                  <th className="px-4 py-3">Kapasitas</th>
                  <th className="px-4 py-3 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db.rooms
                  .filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
                  .map((rm) => (
                    <tr key={rm.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-semibold text-slate-900">{rm.name}</td>
                      <td className="px-4 py-3 text-slate-600">{rm.building}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                          {rm.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{rm.capacity} seats</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditingItem({ type: 'rooms', data: rm })}
                            className="p-1 text-slate-500 hover:text-indigo-600 rounded"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete('rooms', rm.id)}
                            className="p-1 text-slate-500 hover:text-rose-600 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {subTab === 'teachers' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                <tr>
                  <th className="px-4 py-3">Nama Lengkap</th>
                  <th className="px-4 py-3">Panggilan</th>
                  <th className="px-4 py-3">Warna</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Departemen</th>
                  <th className="px-4 py-3">Beban Maksimal</th>
                  <th className="px-4 py-3 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db.teachers
                  .filter((t) =>
                    t.name.toLowerCase().includes(search.toLowerCase()) ||
                    (t.panggilan && t.panggilan.toLowerCase().includes(search.toLowerCase()))
                  )
                  .map((tch) => (
                    <tr key={tch.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-semibold text-slate-900">{tch.name}</td>
                      <td className="px-4 py-3">
                        {tch.panggilan ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            {tch.panggilan}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs shrink-0"
                            style={{ backgroundColor: tch.color || '#0284C7' }}
                          />
                          <span className="font-mono text-xs text-slate-600 font-medium">{tch.color || '#0284C7'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {tch.email ? (
                          <a
                            href={`mailto:${tch.email}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Kirim email ke ${tch.email}`}
                            className="inline-flex p-1 rounded bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-colors"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{tch.department}</td>
                      <td className="px-4 py-3 text-slate-600">{tch.maxPeriodsPerWeek} periode/pekan</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditingItem({ type: 'teachers', data: tch })}
                            className="p-1 text-slate-500 hover:text-indigo-600 rounded"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete('teachers', tch.id)}
                            className="p-1 text-slate-500 hover:text-rose-600 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {/* Sorted Sessions Table with Auto-Computed Order */}
          {subTab === 'sessions' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                <tr>
                  <th className="px-4 py-3">Urutan (Auto-Compute)</th>
                  <th className="px-4 py-3">Nama Sesi</th>
                  <th className="px-4 py-3">Rentang Waktu</th>
                  <th className="px-4 py-3 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(() => {
                  const sorted = db.sessions
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

                  return sorted.map((ses, idx) => (
                    <tr key={ses.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center font-bold text-indigo-700 shadow-2xs text-xs">
                            {ses.order}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleMoveSession(ses.id, 'down')}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 rounded cursor-pointer transition-colors"
                            title={idx === sorted.length - 1 ? "Pindah ke Posisi Teratas" : "Geser Urutan ke Bawah"}
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{ses.name}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {ses.startTime} - {ses.endTime}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditingItem({ type: 'sessions', data: ses })}
                            className="p-1 text-slate-500 hover:text-indigo-600 rounded cursor-pointer"
                            title="Edit Sesi"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete('sessions', ses.id)}
                            className="p-1 text-slate-500 hover:text-rose-600 rounded cursor-pointer"
                            title="Hapus Sesi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          )}

          {subTab === 'periods' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                <tr>
                  <th className="px-4 py-3">Urutan (Auto-Compute)</th>
                  <th className="px-4 py-3">Fase / Periode</th>
                  <th className="px-4 py-3">Rentang Tanggal</th>
                  <th className="px-4 py-3">Deskripsi</th>
                  <th className="px-4 py-3 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(() => {
                  const sorted = db.periods
                    .slice()
                    .sort((a, b) => a.periodNumber - b.periodNumber)
                    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

                  return sorted.map((prd, idx) => (
                    <tr key={prd.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center font-bold text-indigo-700 shadow-2xs text-xs">
                            {prd.periodNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleMovePeriod(prd.id, 'down')}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 rounded cursor-pointer transition-colors"
                            title={idx === sorted.length - 1 ? "Pindah ke Posisi Teratas" : "Geser Urutan ke Bawah"}
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{prd.name}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {prd.startDate} s.d {prd.endDate}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {prd.description || 'Periode KBM'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditingItem({ type: 'periods', data: prd })}
                            className="p-1 text-slate-500 hover:text-indigo-600 rounded cursor-pointer"
                            title="Edit Periode"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete('periods', prd.id)}
                            className="p-1 text-slate-500 hover:text-rose-600 rounded cursor-pointer"
                            title="Hapus Periode"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          )}

          {/* Read-Only Data Integrity Panel (Fix 3) */}
          {subTab === 'integrity' && (
            <div className="p-5 space-y-6">
              {/* Header diagnostic overview */}
              <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                integrityReport.totalIssues > 0
                  ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                  : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg shrink-0 ${
                    integrityReport.totalIssues > 0
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {integrityReport.totalIssues > 0 ? (
                      <ShieldAlert className="w-5 h-5" />
                    ) : (
                      <ShieldCheck className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <span>Data Integrity Diagnostics (Read-Only)</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        integrityReport.totalIssues > 0
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-emerald-200 text-emerald-900'
                      }`}>
                        {integrityReport.totalIssues === 0
                          ? 'Semua Data Valid'
                          : `${integrityReport.totalIssues} Potensi Masalah`}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                      Panel ini memindai aturan jadwal (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[11px]">db.rules</code>) untuk mendeteksi double-booking (kelas + hari + sesi identik) dan periode akademik (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[11px]">db.periods</code>) untuk mendeteksi tumpang tindih rentang tanggal. Panel ini bersifat diagnostik informatif untuk membantu pembersihan data secara mandiri dan tidak memblokir penyimpanan.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Status Pemeriksaan</span>
                    <span className={`text-xs font-bold ${
                      integrityReport.totalIssues > 0 ? 'text-amber-800' : 'text-emerald-700'
                    }`}>
                      {integrityReport.totalIssues === 0 ? '100% Konsisten' : 'Perlu Ditinjau'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 1: Double-Booking in Rules */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-indigo-600" />
                      <span>1. Double-Booking Aturan Jadwal (Kelas + Hari + Sesi Ganda)</span>
                    </h4>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      integrityReport.doubleBookings.length > 0
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {integrityReport.doubleBookings.length} Konflik
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Sumber: <code className="font-mono">db.rules</code>
                  </span>
                </div>

                {integrityReport.doubleBookings.length === 0 ? (
                  <div className="p-4 bg-emerald-50/50 border border-dashed border-emerald-200 rounded-xl flex items-center gap-3 text-xs text-emerald-800">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Tidak ditemukan aturan jadwal yang tumpang tindih (setiap kelas hanya memiliki maksimal satu aturan per hari dan sesi).</span>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {integrityReport.doubleBookings
                      .filter((item) =>
                        search === '' ||
                        item.className.toLowerCase().includes(search.toLowerCase()) ||
                        item.day.toLowerCase().includes(search.toLowerCase()) ||
                        item.sessionName.toLowerCase().includes(search.toLowerCase()) ||
                        item.rules.some((r) => r.id.toLowerCase().includes(search.toLowerCase()))
                      )
                      .map((item, idx) => (
                        <div
                          key={item.key || idx}
                          className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/30 space-y-2 shadow-2xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-100 pb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs text-slate-900">
                                Kelas: {item.className}
                              </span>
                              <span className="text-slate-400 text-xs">•</span>
                              <span className="text-xs font-semibold text-slate-700">
                                Hari: {item.day}
                              </span>
                              <span className="text-slate-400 text-xs">•</span>
                              <span className="text-xs font-semibold text-slate-700">
                                Sesi: {item.sessionName}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                              {item.rules.length} Aturan Terdaftar
                            </span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-[11px]">
                              <thead>
                                <tr className="text-slate-500 font-bold border-b border-rose-100">
                                  <th className="pb-1">Rule ID</th>
                                  <th className="pb-1">Pelajaran (Subject)</th>
                                  <th className="pb-1">Guru (Teacher)</th>
                                  <th className="pb-1">Ruangan</th>
                                  <th className="pb-1">Periode</th>
                                  <th className="pb-1">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-rose-100/60">
                                {item.rules.map((r) => {
                                  const subj = subjectMap.get(r.subjectId);
                                  const tch = teacherMap.get(r.teacherId);
                                  const rm = roomMap.get(r.roomId);
                                  return (
                                    <tr key={r.id} className="text-slate-700">
                                      <td className="py-1.5 font-mono text-[10px] text-rose-700 font-semibold">{r.id}</td>
                                      <td className="py-1.5 font-medium text-slate-900">{subj?.name || r.subjectId}</td>
                                      <td className="py-1.5 text-slate-600">{tch?.name || r.teacherId}</td>
                                      <td className="py-1.5 text-slate-600">{rm?.name || r.roomId}</td>
                                      <td className="py-1.5 text-slate-500 text-[10px]">{r.periodIds?.join(', ') || 'Semua'}</td>
                                      <td className="py-1.5">
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                          r.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                          {r.active ? 'Aktif' : 'Non-aktif'}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          <p className="text-[10px] text-slate-500 pt-1 italic">
                            Tip perbaikan: Buka tab Unified Studio atau Rules Manager untuk menonaktifkan atau memindahkan salah satu aturan ID di atas.
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Section 2: Overlapping Date Ranges in Periods */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>2. Tumpang Tindih Rentang Tanggal Periode Akademik (Date Overlaps)</span>
                    </h4>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      integrityReport.periodOverlaps.length > 0
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {integrityReport.periodOverlaps.length} Tumpang Tindih
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Sumber: <code className="font-mono">db.periods</code>
                  </span>
                </div>

                {integrityReport.periodOverlaps.length === 0 ? (
                  <div className="p-4 bg-emerald-50/50 border border-dashed border-emerald-200 rounded-xl flex items-center gap-3 text-xs text-emerald-800">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Tidak ada periode akademik yang saling tumpang tindih rentang tanggal (setiap tanggal kalender merujuk pada rentang periode yang bersih).</span>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {integrityReport.periodOverlaps
                      .filter((pair) =>
                        search === '' ||
                        pair.period1.name.toLowerCase().includes(search.toLowerCase()) ||
                        pair.period2.name.toLowerCase().includes(search.toLowerCase()) ||
                        pair.period1.id.toLowerCase().includes(search.toLowerCase()) ||
                        pair.period2.id.toLowerCase().includes(search.toLowerCase())
                      )
                      .map((pair, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/30 space-y-2 shadow-2xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 pb-2">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600" />
                              <span className="font-bold text-xs text-slate-900">
                                Irisan Tanggal: <span className="font-mono text-amber-900">{pair.overlapStart}</span> s.d. <span className="font-mono text-amber-900">{pair.overlapEnd}</span>
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                              2 Periode Beririsan
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div className="p-2.5 rounded-lg bg-white border border-amber-200/80">
                              <span className="text-[10px] font-bold text-slate-400 block uppercase">Periode A</span>
                              <div className="font-semibold text-slate-900 mt-0.5">{pair.period1.name}</div>
                              <div className="text-[10px] font-mono text-slate-500 mt-0.5">ID: {pair.period1.id}</div>
                              <div className="text-xs font-mono text-indigo-700 font-semibold mt-1">
                                {pair.period1.startDate} s.d. {pair.period1.endDate}
                              </div>
                            </div>

                            <div className="p-2.5 rounded-lg bg-white border border-amber-200/80">
                              <span className="text-[10px] font-bold text-slate-400 block uppercase">Periode B</span>
                              <div className="font-semibold text-slate-900 mt-0.5">{pair.period2.name}</div>
                              <div className="text-[10px] font-mono text-slate-500 mt-0.5">ID: {pair.period2.id}</div>
                              <div className="text-xs font-mono text-indigo-700 font-semibold mt-1">
                                {pair.period2.startDate} s.d. {pair.period2.endDate}
                              </div>
                            </div>
                          </div>

                          <p className="text-[10px] text-slate-500 pt-1 italic">
                            Tip perbaikan: Buka sub-tab Periods di atas untuk mengedit tanggal mulai/selesai dari salah satu periode tersebut agar tanggal tidak beririsan.
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      )}
      
    </div>
  );
};

// Modal for adding / editing any entity
const EntityFormModal: React.FC<{
  type: string;
  initialData?: any;
  db: DatabaseState;
  onClose: () => void;
  onSave: (data: any) => void;
}> = ({ type, initialData, db, onClose, onSave }) => {
  const [formData, setFormData] = useState<any>(() => {
    if (initialData) {
      return {
        ...initialData,
        defaultTeacherId: initialData.defaultTeacherId || initialData.default_teacher_id || '',
        defaultRoomId: initialData.defaultRoomId || initialData.default_room_id || '',
        book: initialData.book || '',
        pdfLink: initialData.pdfLink || initialData.links?.pdf || '',
        shoppingLink: initialData.shoppingLink || initialData.links?.shopping || '',
        shoppingLink2: initialData.shoppingLink2 || initialData.links?.shopping2 || '',
        siteLink: initialData.siteLink || initialData.links?.site || '',
        icon: initialData.icon || 'GraduationCap',
        color: initialData.color || (type === 'classes' ? '#E0E7FF' : '#3B82F6'),
        onlineClassLink: initialData.onlineClassLink || initialData.online_class_link || ''
      };
    }
    const id = `${type.slice(0, 3)}-${Date.now()}`;
    switch (type) {
      case 'subjects':
        return {
          id,
          name: '',
          code: '',
          color: '#3B82F6',
          department: 'General',
          defaultTeacherId: '',
          defaultRoomId: '',
          book: '',
          pdfLink: '',
          shoppingLink: '',
          shoppingLink2: '',
          siteLink: ''
        };
      case 'classes':
        return {
          id,
          name: '',
          grade: 10,
          section: 'A',
          studentCount: 30,
          icon: 'GraduationCap',
          color: '#E0E7FF',
          onlineClassLink: '',
          defaultRoomId: ''
        };
      case 'rooms':
        return { id, name: '', building: 'Academic Hall', capacity: 35, type: 'Standard' };
      case 'teachers':
        return { id, name: '', panggilan: '', email: '', department: 'General', maxPeriodsPerWeek: 18, color: '#0284C7' };
      case 'sessions':
        return { id, name: '', order: db.sessions.length + 1, startTime: '08:00', endTime: '10:00' };
      case 'periods':
        return { id, name: '', periodNumber: db.periods.length + 1, startDate: '2026-09-01', endDate: '2026-09-30', description: 'Academic Term' };
      default:
        return { id };
    }
  });

  const handleChange = (field: string, val: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <h3 className="text-sm font-bold text-slate-900 capitalize flex items-center gap-2">
            <span>{initialData ? 'Edit' : 'Add New'} {type.slice(0, -1)}</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
          {type === 'subjects' && (
            <>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Mata Pelajaran</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g. Nahwu Jurumiyyah, Fiqih Syafi'i, Matematika"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kode Mapel</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Warna Label</label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => handleChange('color', e.target.value)}
                    className="w-full h-9 p-1 bg-slate-50 border border-slate-300 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Departemen</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => handleChange('department', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              {/* Default Teacher & Room */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/80">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Guru Pengampu (Bawaan)
                  </label>
                  <select
                    value={formData.defaultTeacherId || ''}
                    onChange={(e) => handleChange('defaultTeacherId', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  >
                    <option value="">-- Pilih Guru Pengampu (Opsional) --</option>
                    {db.teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.panggilan ? `(${t.panggilan})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Ruangan Bawaan (Default Room)
                  </label>
                  <select
                    value={formData.defaultRoomId || ''}
                    onChange={(e) => handleChange('defaultRoomId', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  >
                    <option value="">-- Pilih Ruangan (Opsional) --</option>
                    {db.rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.building})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Book / Kitab */}
              <div className="pt-2 border-t border-slate-200/80">
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Book className="w-3.5 h-3.5 text-amber-600" />
                  <span>Buku Teks / Kitab Rujukan</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Matn Al-Ajurrumiyyah / Fathul Qorib / Fisika Dasar"
                  value={formData.book || ''}
                  onChange={(e) => handleChange('book', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-medium"
                />
              </div>

              {/* Links section */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Tautan Materi &amp; Pembelian (Links)</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">Opsional</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5 flex items-center gap-1">
                    <FileText className="w-3 h-3 text-rose-600" />
                    <span>Tautan PDF (Buku Digital / Google Drive / Dropbox)</span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/kitab.pdf"
                    value={formData.pdfLink || ''}
                    onChange={(e) => handleChange('pdfLink', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-[11px]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5 flex items-center gap-1">
                      <ShoppingCart className="w-3 h-3 text-emerald-600" />
                      <span>Link Pembelian 1 (Toko Online)</span>
                    </label>
                    <input
                      type="url"
                      placeholder="https://tokopedia.com/..."
                      value={formData.shoppingLink || ''}
                      onChange={(e) => handleChange('shoppingLink', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5 flex items-center gap-1">
                      <ShoppingBag className="w-3 h-3 text-teal-600" />
                      <span>Link Pembelian 2 (Alternatif)</span>
                    </label>
                    <input
                      type="url"
                      placeholder="https://shopee.co.id/..."
                      value={formData.shoppingLink2 || ''}
                      onChange={(e) => handleChange('shoppingLink2', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5 flex items-center gap-1">
                    <ExternalLink className="w-3 h-3 text-indigo-600" />
                    <span>Website Resmi / Portal Referensi</span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://perpustakaan.or.id/..."
                    value={formData.siteLink || ''}
                    onChange={(e) => handleChange('siteLink', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-[11px]"
                  />
                </div>
              </div>
            </>
          )}

          {type === 'classes' && (
            <>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Class Name (Nama Rombel / Kelas)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kelas 10-A, 11 IPA 1"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tingkat (Grade)</label>
                  <input
                    type="number"
                    value={formData.grade}
                    onChange={(e) => handleChange('grade', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rombel (Section)</label>
                  <input
                    type="text"
                    value={formData.section}
                    onChange={(e) => handleChange('section', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jumlah Peserta</label>
                  <input
                    type="number"
                    value={formData.studentCount}
                    onChange={(e) => handleChange('studentCount', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Ruangan Bawaan (Default Room)
                </label>
                <select
                  value={formData.defaultRoomId || ''}
                  onChange={(e) => handleChange('defaultRoomId', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                >
                  <option value="">-- Tanpa Ruangan Khusus / Fleksibel --</option>
                  {db.rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.building}) - Kapasitas {r.capacity}
                    </option>
                  ))}
                </select>
              </div>

              {/* Online Class Link */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tautan Kelas Online (Virtual Meeting)</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Opsional (Google Meet / Zoom)</span>
                </label>
                <div className="relative">
                  <input
                    type="url"
                    placeholder="https://meet.google.com/abc-defg-hij atau https://zoom.us/j/..."
                    value={formData.onlineClassLink || ''}
                    onChange={(e) => handleChange('onlineClassLink', e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white font-mono text-xs"
                  />
                  <Video className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Class Color Picker (Weak / Pastel Palette) */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span
                      className="w-3 h-3 rounded-full border border-black/15 shrink-0"
                      style={{ backgroundColor: formData.color || '#E0E7FF' }}
                    />
                    <span>Warna Tema Kelas (Palet Lembut / Pastel)</span>
                  </label>
                  <span className="text-[10px] text-slate-500">
                    Beda dari mapel (warna lembut)
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.color || '#E0E7FF'}
                    onChange={(e) => handleChange('color', e.target.value)}
                    className="w-10 h-10 p-0.5 rounded-lg border border-slate-300 bg-white cursor-pointer shrink-0"
                    title="Pilih warna khusus"
                  />
                  <input
                    type="text"
                    value={formData.color || '#E0E7FF'}
                    onChange={(e) => handleChange('color', e.target.value)}
                    placeholder="#E0E7FF"
                    className="w-28 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs font-semibold uppercase text-slate-800"
                  />
                  <div className="text-[11px] text-slate-500 flex-1 truncate">
                    Digunakan untuk kartu kelas &amp; indikator rombel.
                  </div>
                </div>

                {/* Preset Soft / Weak Palette Chips */}
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    Pilihan Palet Pastel / Lembut:
                  </span>
                  <div className="grid grid-cols-6 gap-1.5">
                    {[
                      { name: 'Indigo', hex: '#E0E7FF' },
                      { name: 'Amber', hex: '#FEF3C7' },
                      { name: 'Emerald', hex: '#DCFCE7' },
                      { name: 'Pink', hex: '#FCE7F3' },
                      { name: 'Teal', hex: '#CCFBF1' },
                      { name: 'Violet', hex: '#F3E8FF' },
                      { name: 'Orange', hex: '#FFEDD5' },
                      { name: 'Cyan', hex: '#CFFAFE' },
                      { name: 'Rose', hex: '#FEE2E2' },
                      { name: 'Slate', hex: '#E2E8F0' },
                      { name: 'Sky', hex: '#E0F2FE' },
                      { name: 'Lime', hex: '#ECFCCB' }
                    ].map((item) => (
                      <button
                        key={item.hex}
                        type="button"
                        onClick={() => handleChange('color', item.hex)}
                        className={`h-7 rounded-lg border text-[10px] font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          (formData.color || '').toLowerCase() === item.hex.toLowerCase()
                            ? 'ring-2 ring-indigo-600 border-indigo-600 font-bold shadow-2xs'
                            : 'border-slate-200 hover:border-slate-400'
                        }`}
                        style={{ backgroundColor: item.hex }}
                        title={`${item.name} (${item.hex})`}
                      >
                        <span className="text-slate-700 truncate px-1">{item.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Class Icon Picker */}
              <div className="pt-2 border-t border-slate-200">
                <ClassIconPicker
                  value={formData.icon || 'GraduationCap'}
                  selected={formData.icon || 'GraduationCap'}
                  onChange={(newIcon) => handleChange('icon', newIcon)}
                  onSelect={(newIcon) => handleChange('icon', newIcon)}
                />
              </div>
            </>
          )}

          {type === 'rooms' && (
            <>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Room Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Science Lab 2"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Building</label>
                  <input
                    type="text"
                    value={formData.building}
                    onChange={(e) => handleChange('building', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Capacity</label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => handleChange('capacity', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Room Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                >
                  <option value="Standard">Standard Classroom</option>
                  <option value="Science Lab">Science Lab</option>
                  <option value="Computer Lab">Computer Lab</option>
                  <option value="Gymnasium">Gymnasium</option>
                  <option value="Auditorium">Auditorium</option>
                </select>
              </div>
            </>
          )}

          {type === 'teachers' && (
            <>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap Pengajar</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Muhammad Najmuddin Syafiiq"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Panggilan (Nama Pendek / Sapaan)</span>
                  <span className="text-[10px] text-amber-600 font-normal">Digunakan pada sel jadwal agar hemat ruang</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ust. Syafiiq / Ust. Ammar"
                  value={formData.panggilan || ''}
                  onChange={(e) => handleChange('panggilan', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => handleChange('department', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Max Periods/Wk</label>
                  <input
                    type="number"
                    value={formData.maxPeriodsPerWeek}
                    onChange={(e) => handleChange('maxPeriodsPerWeek', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Warna Guru (Border Chip Matriks Sesi)</span>
                  <span className="text-[10px] text-slate-500 font-normal">Identifikasi pengampu di matriks</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.color || '#0284C7'}
                    onChange={(e) => handleChange('color', e.target.value)}
                    className="w-10 h-10 p-0.5 rounded-lg border border-slate-300 cursor-pointer bg-white"
                  />
                  <input
                    type="text"
                    value={formData.color || '#0284C7'}
                    onChange={(e) => handleChange('color', e.target.value)}
                    className="w-32 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs uppercase"
                    placeholder="#0284C7"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {['#0284C7', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6', '#EF4444', '#6366F1'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => handleChange('color', c)}
                        className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 ${
                          (formData.color || '#0284C7').toLowerCase() === c.toLowerCase()
                            ? 'border-slate-800 scale-110 ring-2 ring-indigo-400'
                            : 'border-white/50'
                        }`}
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {type === 'sessions' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Session Name (Nama Sesi)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sesi 1 (Pagi) / Sesi 2 / Ashar"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Urutan Sesi
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={formData.order}
                    onChange={(e) => handleChange('order', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jam Mulai</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => handleChange('startTime', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jam Selesai</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => handleChange('endTime', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </>
          )}

          {type === 'periods' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Nama Fase / Periode</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Periode 1 (Siklus 1)"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nomor Urut</label>
                  <input
                    type="number"
                    required
                    value={formData.periodNumber}
                    onChange={(e) => handleChange('periodNumber', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => handleChange('startDate', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Selesai</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => handleChange('endDate', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Deskripsi / Catatan Semester</label>
                <input
                  type="text"
                  placeholder="e.g. Fall Term - Phase 1"
                  value={formData.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>
            </>
          )}

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              Save Entity
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
