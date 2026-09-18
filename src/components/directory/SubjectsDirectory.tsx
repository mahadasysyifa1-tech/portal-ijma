import React, { useState, useMemo } from 'react';
import { DatabaseState, Subject } from '../../types';
import {
  BookOpen,
  Search,
  User,
  DoorOpen,
  Layers,
  ArrowLeft,
  Book,
  FileText,
  ShoppingCart,
  ShoppingBag,
  ExternalLink
} from 'lucide-react';

interface SubjectsDirectoryProps {
  db: DatabaseState;
  onBackToSchedule: () => void;
  onSelectSubject: (subjectId: string) => void;
}

export const SubjectsDirectory: React.FC<SubjectsDirectoryProps> = ({
  db,
  onBackToSchedule,
  onSelectSubject
}) => {
  const [search, setSearch] = useState('');
  const teacherMap = useMemo(() => new Map(db.teachers.map((t) => [t.id, t])), [db.teachers]);
  const roomMap = useMemo(() => new Map(db.rooms.map((r) => [r.id, r])), [db.rooms]);

  const filteredSubjects = useMemo(() => {
    return db.subjects.filter((s) => {
      const q = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.department && s.department.toLowerCase().includes(q))
      );
    });
  }, [db.subjects, search]);

  // Compute how many rules/sessions are scheduled for each subject
  const subjectSessionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    db.rules.forEach((r) => {
      if (r.active) {
        counts[r.subjectId] = (counts[r.subjectId] || 0) + (r.daysOfWeek?.length || 1);
      }
    });
    return counts;
  }, [db.rules]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-4 w-px bg-slate-200 hidden sm:block" />
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <span>Daftar Mata Pelajaran</span>
            </h2>
            <p className="text-xs text-slate-500">
              Kurikulum dan materi pelajaran Ma'had Asy-Syifa
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari mata pelajaran, kode..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900"
          />
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSubjects.map((subject) => {
          const defaultTeacher = subject.defaultTeacherId ? teacherMap.get(subject.defaultTeacherId) : null;
          const defaultRoom = subject.defaultRoomId ? roomMap.get(subject.defaultRoomId) : null;
          const totalSessions = subjectSessionCounts[subject.id] || 0;
          const syllabusUnits = (db.syllabusUnits || [])
            .filter((u) => u.subject_id === subject.id)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

          return (
            <div
              key={subject.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-1.5 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-md shrink-0 shadow-2xs"
                      style={{ backgroundColor: subject.color }}
                    />
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                      {subject.code}
                    </span>
                    <span className="text-base font-bold text-slate-900">
                      {subject.name}
                    </span>
                  </div>
                  {subject.department && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                      {subject.department}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Pengampu: {defaultTeacher ? defaultTeacher.name : 'Disesuaikan per jadwal'}</span>
                  </div>
                  {subject.book && (
                    <div className="flex items-center gap-2">
                      <Book className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="items-end truncate">{subject.book}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onSelectSubject(subject.id)}
                    className="flex justify-between items-center w-full p-1 rounded-xl bg-amber-50/60 border border-amber-200/70 hover:bg-amber-100/70 hover:border-amber-300 transition-colors cursor-pointer"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                       Silabus
                    </span>
                    <span className="text-[10px] font-semibold text-amber-700">
                        {syllabusUnits.length} materi
                    </span>
                  </button>   
                  
                  {defaultRoom && (
                    <div className="flex items-center gap-1.5">
                      <DoorOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Ruang: {defaultRoom.name}</span>
                    </div>
                  )}
                               

                  {/* Resource Links */}
                  {(subject.pdfLink || subject.shoppingLink || subject.shoppingLink2 || subject.siteLink) && (
                    <div className="flex items-center gap-1 pt-1">
                      {subject.pdfLink && (
                        <a
                          href={subject.pdfLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 flex items-center gap-1 text-[11px] font-medium px-2"
                          title="Buka PDF Buku"
                        >
                          <FileText className="w-3 h-3" />
                          <span>PDF</span>
                        </a>
                      )}
                      {subject.shoppingLink && (
                        <a
                          href={subject.shoppingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1 text-[11px] font-medium px-2"
                          title="Tautan Pembelian 1"
                        >
                          <ShoppingCart className="w-3 h-3" />
                          <span>Toko 1</span>
                        </a>
                      )}
                      {subject.shoppingLink2 && (
                        <a
                          href={subject.shoppingLink2}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 flex items-center gap-1 text-[11px] font-medium px-2"
                          title="Tautan Pembelian 2"
                        >
                          <ShoppingBag className="w-3 h-3" />
                          <span>Toko 2</span>
                        </a>
                      )}
                      {subject.siteLink && (
                        <a
                          href={subject.siteLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 flex items-center gap-1 text-[11px] font-medium px-2"
                          title="Situs / Portal Referensi"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Web</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span>Jadwal Aktif:</span>
                </span>
                <span className="font-bold text-slate-800">
                  {totalSessions} sesi / pekan
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
