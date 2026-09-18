import React, { useState, useRef } from 'react';
import {
  DatabaseState,
  SyllabusUnit
} from '../types';
import {
  Database,
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  Users,
  GraduationCap,
  BookOpen,
  DoorOpen,
  Clock,
  Sliders,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  FolderDown,
  Layers,
  Sparkles
} from 'lucide-react';
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

interface ExportImportViewProps {
  db: DatabaseState;
  onExportJson: () => void;
  onImportJson: (jsonString: string) => void;
  onUpdateDb: (updater: (prev: DatabaseState) => DatabaseState) => void;
  onBackToDatabase?: () => void;
  onNavigateToSchedule?: () => void;
}

export const ExportImportView: React.FC<ExportImportViewProps> = ({
  db,
  onExportJson,
  onImportJson,
  onUpdateDb,
  onBackToDatabase,
  onNavigateToSchedule
}) => {
  const [isSyllabusImporterOpen, setIsSyllabusImporterOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const processJsonFile = (file: File) => {
    if (!file.name.endsWith('.json')) {
      setImportStatus({
        type: 'error',
        message: 'Berkas harus memiliki ekstensi .json'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      try {
        const parsed = JSON.parse(content);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Format JSON tidak valid.');
        }
        onImportJson(content);
        setImportStatus({
          type: 'success',
          message: `Basis data berhasil dipulihkan dari berkas "${file.name}"!`
        });
      } catch (err: any) {
        setImportStatus({
          type: 'error',
          message: `Gagal memproses JSON: ${err.message || 'Format tidak valid'}`
        });
      }
    };
    reader.readAsText(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processJsonFile(file);
    }
    // reset input value so re-selecting same file triggers event
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processJsonFile(file);
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-700 shrink-0">
              <FolderDown className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Pusat Ekspor &amp; Impor Basis Data
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Data Backup &amp; Interoperabilitas
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Kelola pencadangan penuh sistem (JSON) untuk migrasi atau cadangan darurat, pulihkan berkas basis data, dan unduh data tabular format CSV untuk laporan akademik, silabus, dan jadwal.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onBackToDatabase && (
              <button
                type="button"
                onClick={onBackToDatabase}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Basis Data Master</span>
              </button>
            )}
          </div>
        </div>

        {/* Database Inventory Snapshot */}
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 text-center">
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Pelajaran</span>
            <span className="text-sm font-bold text-slate-900">{db.subjects.length}</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Kelas</span>
            <span className="text-sm font-bold text-slate-900">{db.classes.length}</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Guru</span>
            <span className="text-sm font-bold text-slate-900">{db.teachers.length}</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Ruangan</span>
            <span className="text-sm font-bold text-slate-900">{db.rooms.length}</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Sesi Jam</span>
            <span className="text-sm font-bold text-slate-900">{db.sessions.length}</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Periode</span>
            <span className="text-sm font-bold text-slate-900">{db.periods.length}</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Aturan Jadwal</span>
            <span className="text-sm font-bold text-indigo-700">{db.rules.length}</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Silabus Materi</span>
            <span className="text-sm font-bold text-amber-700">{(db.syllabusUnits || []).length}</span>
          </div>
        </div>
      </div>

      {/* Notification banner if import was executed */}
      {importStatus && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
            importStatus.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            {importStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{importStatus.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setImportStatus(null)}
            className="text-xs font-bold underline opacity-70 hover:opacity-100 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Grid: JSON Full System Backup & Restore */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Ekspor Cadangan Sistem (JSON) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Cadangan Penuh Basis Data (Ekspor JSON)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Menyimpan keseluruhan entitas &amp; konfigurasi dalam satu berkas terstruktur.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/70 text-xs text-slate-600 space-y-1.5 mt-3">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cakupan Isi Cadangan JSON:</span>
              </div>
              <ul className="list-disc list-inside text-[11px] space-y-0.5 pl-1 text-slate-600">
                <li>Seluruh Mata Pelajaran ({db.subjects.length}) &amp; Guru Pengampu ({db.teachers.length})</li>
                <li>Rombel Kelas ({db.classes.length}), Ruangan ({db.rooms.length}), dan Sesi ({db.sessions.length})</li>
                <li>Periode Kalender Akademik ({db.periods.length})</li>
                <li>Aturan Jadwal Utama &amp; Pengecualian Tanggal ({db.rules.length} aturan)</li>
                <li>Pangkalan Data Silabus Materi ({(db.syllabusUnits || []).length} unit materi)</li>
              </ul>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              id="btn-export-full-json"
              onClick={onExportJson}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs hover:shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Cadangan Basis Data (.json)</span>
            </button>
          </div>
        </div>

        {/* Card 2: Impor Pemulihan Basis Data (JSON) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Pemulihan Basis Data (Impor JSON)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Pulihkan seluruh tabel basis data dari berkas cadangan JSON yang telah disimpan.
                </p>
              </div>
            </div>

            {/* Drag and drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all mt-3 ${
                isDragging
                  ? 'border-amber-500 bg-amber-50/60'
                  : 'border-slate-200 hover:border-amber-400 bg-slate-50/50 hover:bg-amber-50/20'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <Upload className="w-7 h-7 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-800">
                Klik untuk memilih berkas atau seret berkas JSON ke sini
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Format yang didukung: berkas JSON cadangan portal IJMA
              </p>
            </div>
          </div>

          <div className="text-[11px] text-amber-900 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/80 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Perhatian:</strong> Mengimpor berkas JSON akan menggantikan isi database aktif saat ini. Pastikan Anda telah mengunduh cadangan terbaru sebelum melakukan pemulihan.
            </span>
          </div>
        </div>
      </div>

      {/* Section 2: Ekspor CSV per Tabel Basis Data */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Ekspor Spreadsheet CSV per Tabel Basis Data
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Unduh data tabular individu dalam format CSV standar yang siap dibuka di Microsoft Excel, Google Sheets, atau aplikasi pengolah angka lainnya.
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Tanggal ekspor: {todayStr}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
          {/* Guru CSV */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-emerald-50/30 hover:border-emerald-200 transition-all flex items-center justify-between gap-3 group">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-lg bg-teal-50 text-teal-700 group-hover:bg-teal-100 transition-colors">
                <Users className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900 truncate">Data Guru (Asatidzah)</h4>
                <p className="text-[10px] text-slate-500 truncate">{db.teachers.length} akun terdaftar</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const csv = exportTeachersToCsv(db);
                downloadCsvFile(`teachers_${todayStr}.csv`, csv);
              }}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-emerald-600 hover:text-white border border-slate-200 hover:border-emerald-600 rounded-lg transition-all shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
              title="Unduh data Guru ke format CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>

          {/* Kelas CSV */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-emerald-50/30 hover:border-emerald-200 transition-all flex items-center justify-between gap-3 group">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-700 group-hover:bg-blue-100 transition-colors">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900 truncate">Data Kelas (Rombel)</h4>
                <p className="text-[10px] text-slate-500 truncate">{db.classes.length} rombel kelas</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const csv = exportClassesToCsv(db);
                downloadCsvFile(`classes_${todayStr}.csv`, csv);
              }}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-emerald-600 hover:text-white border border-slate-200 hover:border-emerald-600 rounded-lg transition-all shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
              title="Unduh data Kelas ke format CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>

          {/* Pelajaran CSV */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-emerald-50/30 hover:border-emerald-200 transition-all flex items-center justify-between gap-3 group">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700 group-hover:bg-indigo-100 transition-colors">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900 truncate">Data Pelajaran (Mapel)</h4>
                <p className="text-[10px] text-slate-500 truncate">{db.subjects.length} mata pelajaran</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const csv = exportSubjectsToCsv(db);
                downloadCsvFile(`subjects_${todayStr}.csv`, csv);
              }}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-emerald-600 hover:text-white border border-slate-200 hover:border-emerald-600 rounded-lg transition-all shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
              title="Unduh data Pelajaran ke format CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>

          {/* Ruangan CSV */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-emerald-50/30 hover:border-emerald-200 transition-all flex items-center justify-between gap-3 group">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-700 group-hover:bg-amber-100 transition-colors">
                <DoorOpen className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900 truncate">Data Ruangan &amp; Gedung</h4>
                <p className="text-[10px] text-slate-500 truncate">{db.rooms.length} ruangan</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const csv = exportRoomsToCsv(db);
                downloadCsvFile(`rooms_${todayStr}.csv`, csv);
              }}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-emerald-600 hover:text-white border border-slate-200 hover:border-emerald-600 rounded-lg transition-all shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
              title="Unduh data Ruangan ke format CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>

          {/* Sesi Jam CSV */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-emerald-50/30 hover:border-emerald-200 transition-all flex items-center justify-between gap-3 group">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-lg bg-sky-50 text-sky-700 group-hover:bg-sky-100 transition-colors">
                <Clock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900 truncate">Sesi Jam Pelajaran</h4>
                <p className="text-[10px] text-slate-500 truncate">{db.sessions.length} slot waktu</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const csv = exportSessionsToCsv(db);
                downloadCsvFile(`sessions_${todayStr}.csv`, csv);
              }}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-emerald-600 hover:text-white border border-slate-200 hover:border-emerald-600 rounded-lg transition-all shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
              title="Unduh data Sesi Jam ke format CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>

          {/* Periode Akademik CSV */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-emerald-50/30 hover:border-emerald-200 transition-all flex items-center justify-between gap-3 group">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-lg bg-purple-50 text-purple-700 group-hover:bg-purple-100 transition-colors">
                <Sliders className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900 truncate">Periode Akademik</h4>
                <p className="text-[10px] text-slate-500 truncate">{db.periods.length} siklus periode</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const csv = exportPeriodsToCsv(db);
                downloadCsvFile(`periods_${todayStr}.csv`, csv);
              }}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-emerald-600 hover:text-white border border-slate-200 hover:border-emerald-600 rounded-lg transition-all shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
              title="Unduh data Periode ke format CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section 3: Jadwal, Event Log & Materi Silabus CSV */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Jadwal Operasional, Event Log &amp; Silabus Kurikulum
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Ekspor relasi aturan jadwal aktif, rekaman event log chip, atau kelola impor/ekspor data materi silabus komprehensif.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
          {/* Rules CSV */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-indigo-50/30 hover:border-indigo-200 transition-all flex flex-col justify-between gap-3 group">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-indigo-700">
                <FileSpreadsheet className="w-4 h-4" />
                <span className="text-xs font-bold">Aturan Jadwal (Rules)</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Daftar lengkap {db.rules.length} aturan jadwal dengan kolom ID, hari, sesi, kelas, mapel, guru, dan periode.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const csv = exportRulesToCsv(db);
                downloadCsvFile(`rules_${todayStr}.csv`, csv);
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-600 hover:text-white border border-indigo-200 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Rules CSV</span>
            </button>
          </div>

          {/* Event Log CSV */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-amber-50/30 hover:border-amber-200 transition-all flex flex-col justify-between gap-3 group">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-700">
                <FileText className="w-4 h-4" />
                <span className="text-xs font-bold">Event Log Chip</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Log chip jadwal 2-kolom standar (<code className="font-mono text-[10px]">date, rulexID</code>) untuk integrasi kalender dan analisis kehadiran.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const csv = exportEvtlogToCsv(db);
                downloadCsvFile(`evtlog_${todayStr}.csv`, csv);
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-600 hover:text-white border border-amber-200 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Log Chip CSV</span>
            </button>
          </div>

          {/* Silabus Units CSV */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-teal-50/30 hover:border-teal-200 transition-all flex flex-col justify-between gap-3 group">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-teal-700">
                <FileSpreadsheet className="w-4 h-4" />
                <span className="text-xs font-bold">Silabus Units CSV</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Ekspor seluruh {(db.syllabusUnits || []).length} unit materi silabus (mapel_id, judul materi, nomor bab, rentang hal).
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const csv = exportSyllabusToCsv(db.syllabusUnits || []);
                downloadCsvFile(`silabus_units_${todayStr}.csv`, csv);
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-600 hover:text-white border border-teal-200 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Silabus CSV</span>
            </button>
          </div>

          {/* Impor Silabus CSV */}
          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/60 transition-all flex flex-col justify-between gap-3 group">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-emerald-800">
                <Upload className="w-4 h-4" />
                <span className="text-xs font-bold">Impor Silabus CSV</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                Unggah berkas CSV silabus baru dengan opsi mode tambahkan (append) atau gantikan (replace) kurikulum.
              </p>
            </div>
            <button
              type="button"
              id="btn-open-syllabus-importer-view"
              onClick={() => setIsSyllabusImporterOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Buka Impor Silabus</span>
            </button>
          </div>
        </div>
      </div>

      {/* Syllabus Importer Modal */}
      <SyllabusImporterModal
        isOpen={isSyllabusImporterOpen}
        onClose={() => setIsSyllabusImporterOpen(false)}
        db={db}
        onImportUnits={handleImportSyllabusUnits}
      />
    </div>
  );
};
