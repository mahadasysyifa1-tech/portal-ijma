import React, { useState, useMemo } from 'react';
import {
  DatabaseState,
  SyllabusUnit,
  Subject
} from '../../types';
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  Search,
  Download,
  Upload,
  Filter,
  FileSpreadsheet,
  Check,
  X,
  BookmarkCheck,
  GraduationCap,
  Layers,
  ChevronDown
} from 'lucide-react';
import { exportSyllabusToCsv } from '../../utils/syllabusImporter';
import { downloadCsvFile } from '../../utils/csvHelper';
import { SyllabusImporterModal } from '../syllabus/SyllabusImporterModal';

interface MateriDatabaseTabProps {
  db: DatabaseState;
  onUpdateDb: (updater: (prev: DatabaseState) => DatabaseState) => void;
}

export const MateriDatabaseTab: React.FC<MateriDatabaseTabProps> = ({
  db,
  onUpdateDb
}) => {
  const [search, setSearch] = useState('');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<SyllabusUnit | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state for creating / editing
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formNo, setFormNo] = useState<number>(1);
  const [formEno, setFormEno] = useState<number>(1);
  const [formPart, setFormPart] = useState<string>('1');
  const [formPageStart, setFormPageStart] = useState<string>('');
  const [formPageEnd, setFormPageEnd] = useState<string>('');

  const subjectMap = useMemo(() => new Map<string, Subject>(db.subjects.map((s) => [s.id, s])), [db.subjects]);

  const syllabusUnits = db.syllabusUnits || [];

  // Filter units
  const filteredUnits = useMemo(() => {
    return syllabusUnits.filter((unit) => {
      // Subject filter
      if (filterSubject !== 'all' && unit.subject_id !== filterSubject) {
        return false;
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const subj = subjectMap.get(unit.subject_id)?.name?.toLowerCase() || '';
        const title = (unit.title || '').toLowerCase();
        const bab = `${unit.no}`;
        const pt = `${unit.part}`;
        const hal = `${unit.page_start}-${unit.page_end}`;

        return (
          subj.includes(q) ||
          title.includes(q) ||
          bab.includes(q) ||
          pt.includes(q) ||
          hal.includes(q)
        );
      }

      return true;
    });
  }, [syllabusUnits, filterSubject, search, subjectMap]);

  // Statistics
  const stats = useMemo(() => {
    const total = syllabusUnits.length;
    const subjectsWithSyllabus = new Set(syllabusUnits.map((u) => u.subject_id)).size;
    const totalSubjects = db.subjects.length;
    return {
      total,
      subjectsWithSyllabus,
      totalSubjects
    };
  }, [syllabusUnits, db.subjects]);

  // Open modal to add new unit
  const handleOpenCreate = () => {
    const defaultSubj = db.subjects[0]?.id || '';
    setFormSubjectId(defaultSubj);
    setFormTitle('');
    const maxNo = syllabusUnits.length > 0 ? Math.max(...syllabusUnits.map((u) => u.no || 0)) + 1 : 1;
    setFormNo(maxNo);
    setFormEno(maxNo);
    setFormPart('1');
    setFormPageStart('');
    setFormPageEnd('');
    setIsCreating(true);
    setEditingUnit(null);
  };

  // Open modal to edit unit
  const handleOpenEdit = (unit: SyllabusUnit) => {
    setEditingUnit(unit);
    setFormSubjectId(unit.subject_id);
    setFormTitle(unit.title);
    setFormNo(unit.no);
    setFormEno(unit.eno);
    setFormPart(`${unit.part}`);
    setFormPageStart(`${unit.page_start}`);
    setFormPageEnd(`${unit.page_end}`);
    setIsCreating(false);
  };

  // Save form
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSubjectId || !formTitle.trim()) {
      alert('Mata pelajaran dan pokok bahasan (judul materi) wajib diisi.');
      return;
    }

    if (isCreating) {
      const newUnit: SyllabusUnit = {
        id: `unit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        subject_id: formSubjectId,
        order: syllabusUnits.length + 1,
        title: formTitle.trim(),
        no: Number(formNo) || 1,
        eno: Number(formEno) || Number(formNo) || 1,
        part: formPart || '1',
        page_start: formPageStart.trim() || '1',
        page_end: formPageEnd.trim() || formPageStart.trim() || '1'
      };

      onUpdateDb((prev) => ({
        ...prev,
        syllabusUnits: [...(prev.syllabusUnits || []), newUnit]
      }));
      setIsCreating(false);
    } else if (editingUnit) {
      onUpdateDb((prev) => ({
        ...prev,
        syllabusUnits: (prev.syllabusUnits || []).map((u) =>
          u.id === editingUnit.id
            ? {
                ...u,
                subject_id: formSubjectId,
                title: formTitle.trim(),
                no: Number(formNo) || 1,
                eno: Number(formEno) || Number(formNo) || 1,
                part: formPart || '1',
                page_start: formPageStart.trim() || '1',
                page_end: formPageEnd.trim() || formPageStart.trim() || '1'
              }
            : u
        )
      }));
      setEditingUnit(null);
    }
  };

  // Delete unit
  const handleDeleteUnit = (id: string, title: string) => {
    if (window.confirm(`Hapus materi silabus "${title}"?`)) {
      onUpdateDb((prev) => ({
        ...prev,
        syllabusUnits: (prev.syllabusUnits || []).filter((u) => u.id !== id)
      }));
    }
  };

  // Import handler
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

  return (
    <div className="space-y-4">
      {/* Top Banner: Metrics & Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200/70 text-indigo-700">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Basis Data Materi Silabus Pelajaran
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800">
                  {stats.total} Pokok Bahasan
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola seluruh unit materi silabus, bab, pertemuan target (PT), dan rentang halaman buku pegangan santri/guru.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              id="btn-import-syllabus-from-materi-tab"
              onClick={() => setIsImporterOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Impor CSV</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const csv = exportSyllabusToCsv(syllabusUnits);
                downloadCsvFile(`silabus_materi_${new Date().toISOString().slice(0, 10)}.csv`, csv);
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
              title="Unduh seluruh materi silabus ke format CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor CSV</span>
            </button>

            <button
              type="button"
              id="btn-create-materi-unit"
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Materi</span>
            </button>
          </div>
        </div>

        {/* Quick Counters: Simple list */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>Total:</span>
            <strong className="text-slate-800 font-semibold">{stats.total} materi</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span>Mapel Bersilabus:</span>
            <strong className="text-indigo-700 font-semibold">{stats.subjectsWithSyllabus} / {stats.totalSubjects}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Status:</span>
            <strong className="text-emerald-700 font-semibold">{stats.total > 0 ? 'Tersedia' : 'Kosong (Silakan Impor)'}</strong>
          </span>
        </div>
      </div>

      {/* Simple Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="relative flex-1 w-full min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari materi pokok bahasan, bab, target pertemuan, halaman..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-[180px]"
            >
              <option value="all">Semua Mata Pelajaran</option>
              {db.subjects.map((s) => {
                const count = syllabusUnits.filter((u) => u.subject_id === s.id).length;
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {(search || filterSubject !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFilterSubject('all');
              }}
              className="px-2.5 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Materi Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span className="font-semibold">
            Menampilkan {filteredUnits.length} dari {syllabusUnits.length} unit materi
          </span>
          {filterSubject !== 'all' && (
            <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              Filter: {subjectMap.get(filterSubject)?.name || filterSubject}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
              <tr>
                <th className="px-3 py-2.5 w-12 text-center">No</th>
                <th className="px-3 py-2.5">Mata Pelajaran</th>
                <th className="px-3 py-2.5 w-16 text-center">Bab</th>
                <th className="px-3 py-2.5">Pokok Bahasan / Materi</th>
                <th className="px-3 py-2.5 w-24 text-center">Target Jam (PT)</th>
                <th className="px-3 py-2.5 w-28 text-center">Rentang Halaman</th>
                <th className="px-3 py-2.5 w-24 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredUnits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Tidak ada materi silabus yang cocok.
                  </td>
                </tr>
              ) : (
                filteredUnits.map((unit, index) => {
                  const subject = subjectMap.get(unit.subject_id);
                  return (
                    <tr key={unit.id || index} className="hover:bg-slate-50/80 transition-colors">
                      {/* Urutan */}
                      <td className="px-3 py-2.5 text-center font-mono text-slate-400 text-[11px]">
                        {index + 1}
                      </td>

                      {/* Mapel */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: subject?.color || '#94a3b8' }}
                          />
                          <div>
                            <div className="font-bold text-slate-900">
                              {subject?.name || unit.subject_id}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              {subject?.code || unit.subject_id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Bab / No */}
                      <td className="px-3 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-md font-mono font-bold bg-slate-100 text-slate-700 text-xs">
                          {unit.no === unit.eno || !unit.eno ? unit.no : `${unit.no}-${unit.eno}`}
                        </span>
                      </td>

                      {/* Pokok Bahasan */}
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-slate-900 text-xs">{unit.title}</div>
                        <div className="text-[10px] text-slate-400 font-mono">ID: {unit.id}</div>
                      </td>

                      {/* Pertemuan / Jam Target */}
                      <td className="px-3 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {unit.part} JP
                        </span>
                      </td>

                      {/* Halaman */}
                      <td className="px-3 py-2.5 text-center font-mono text-slate-600 text-[11px]">
                        {unit.page_start && unit.page_end
                          ? `Hal ${unit.page_start} - ${unit.page_end}`
                          : '-'}
                      </td>

                      {/* Aksi */}
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(unit)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Materi"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUnit(unit.id, unit.title)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Materi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* Add / Edit Modal */}
      {(isCreating || editingUnit) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>{isCreating ? 'Tambah Materi Silabus Baru' : 'Edit Materi Silabus'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingUnit(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Mata Pelajaran *</label>
                <select
                  value={formSubjectId}
                  onChange={(e) => setFormSubjectId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-semibold"
                  required
                >
                  {db.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Pokok Bahasan / Judul Materi *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Contoh: Bab 1: Mengenal Kalimat Thayyibah"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nomor Bab / Urutan</label>
                  <input
                    type="number"
                    min={1}
                    value={formNo}
                    onChange={(e) => setFormNo(parseInt(e.target.value) || 1)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nomor Bab Akhir (Rentang)</label>
                  <input
                    type="number"
                    min={1}
                    value={formEno}
                    onChange={(e) => setFormEno(parseInt(e.target.value) || 1)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Jam (PT)</label>
                  <input
                    type="text"
                    value={formPart}
                    onChange={(e) => setFormPart(e.target.value)}
                    placeholder="Contoh: 2"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Halaman Awal</label>
                  <input
                    type="text"
                    value={formPageStart}
                    onChange={(e) => setFormPageStart(e.target.value)}
                    placeholder="Contoh: 12"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Halaman Akhir</label>
                  <input
                    type="text"
                    value={formPageEnd}
                    onChange={(e) => setFormPageEnd(e.target.value)}
                    placeholder="Contoh: 18"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingUnit(null);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer shadow-2xs"
                >
                  Simpan Materi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Syllabus Importer Modal */}
      <SyllabusImporterModal
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        db={db}
        onImportUnits={handleImportSyllabusUnits}
      />
    </div>
  );
};
