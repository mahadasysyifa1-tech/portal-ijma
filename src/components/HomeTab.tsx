import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
  School,
  BookOpen,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  CalendarCheck2,
  AlertCircle,
  ExternalLink,
  Flame,
  Layers,
  Video
} from 'lucide-react';
import { DatabaseState, SyllabusUnit, DayOfWeek } from '../types';
import { ClassIcon } from './ClassIcon';
import {
  resolveViewerCurrentAndNextClass,
  formatUnitDisplay,
  getScheduledSessionsForSubjectClass
} from '../utils/pacingEngine';
import { ViewerRole } from './JournalView';
const DAY_LABELS: Record<DayOfWeek, string> = {
  Monday: 'Senin',
  Tuesday: 'Selasa',
  Wednesday: 'Rabu',
  Thursday: 'Kamis',
  Friday: 'Jumat',
  Saturday: 'Sabtu',
  Sunday: 'Ahad'
};

interface HomeTabProps {
  db: DatabaseState;
  viewerRole: ViewerRole;
  setViewerRole: (role: ViewerRole) => void;
  viewerId: string;
  setViewerId: (id: string) => void;
  onNavigateToJournal: (subjectId: string, classId: string, date: string) => void;
  onNavigateToSchedule: () => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  db,
  viewerRole,
  setViewerRole,
  viewerId,
  setViewerId,
  onNavigateToJournal,
  onNavigateToSchedule
}) => {
  // Live ticker clock
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000); // refresh every 15s
    return () => clearInterval(timer);
  }, []);

  // Format today string
  const todayFormatted = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return currentTime.toLocaleDateString('id-ID', options);
  }, [currentTime]);

  const clockFormatted = useMemo(() => {
    return currentTime.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }, [currentTime]);

  // Resolve current and next class
  const resolved = useMemo(() => {
    return resolveViewerCurrentAndNextClass(db, viewerRole, viewerId, currentTime);
  }, [db, viewerRole, viewerId, currentTime]);

  const { currentClass, nextClass } = resolved;

  const currentClassEntity = useMemo(() => {
    if (!currentClass) return null;
    return db.classes.find((c) => c.id === currentClass.occurrence.classId) || null;
  }, [currentClass, db.classes]);

  const nextClassEntity = useMemo(() => {
    if (!nextClass) return null;
    return db.classes.find((c) => c.id === nextClass.occurrence.classId) || null;
  }, [nextClass, db.classes]);

  const currentClassColor = currentClassEntity?.color || currentClass?.classColor || '#E0E7FF';

  // Remaining time logic: 'Hari Ini' {remaining hours} : nextClass.occurrence.date - today
  const nextClassCountdownLabel = useMemo(() => {
    if (!nextClass) return '';
    const [ny, nm, nd] = nextClass.occurrence.date.split('-').map(Number);
    const [startH, startM] = (nextClass.occurrence.startTime || '00:00').split(':').map(Number);
    const targetTime = new Date(ny, nm - 1, nd, startH, startM, 0);
    const diffMs = targetTime.getTime() - currentTime.getTime();

    if (nextClass.isToday) {
      const totalMinutes = Math.max(0, Math.round(diffMs / 60000));
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      if (hours > 0) {
        return `Hari Ini (${hours} jam ${mins > 0 ? `${mins} mnt ` : ''}lagi)`;
      } else if (mins > 0) {
        return `Hari Ini (${mins} mnt lagi)`;
      } else {
        return 'Hari Ini (Segera)';
      }
    } else {
      const todayMidnight = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate());
      const targetMidnight = new Date(ny, nm - 1, nd);
      const diffDays = Math.max(1, Math.round((targetMidnight.getTime() - todayMidnight.getTime()) / (24 * 3600 * 1000)));
      return `${diffDays} hari lagi`;
    }
  }, [nextClass, currentTime]);

  // Active viewer label
  const viewerLabel = useMemo(() => {
    if (viewerRole === 'student') {
      const cls = db.classes.find((c) => c.id === viewerId);
      return cls ? `Kelas ${cls.name}` : 'peserta';
    } else if (viewerRole === 'teacher') {
      const tch = db.teachers.find((t) => t.id === viewerId);
      return tch ? `${tch.panggilan || tch.name}` : 'Guru/Ustadz';
    } else {
      return 'Admin Akademik (Semua Kelas)';
    }
  }, [viewerRole, viewerId, db.classes, db.teachers]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Hero Welcome & Viewer Selector */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-600" />
                Selamat Datang di Portal IJMA
              </span>
              <span className="text-xs text-slate-400 font-mono font-medium">
                <span>{clockFormatted} WIB </span><span>{todayFormatted}</span>
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Beranda {viewerLabel}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Pantau sesi kelas aktif anda &amp; informasi akademik lainnya
            </p>
          </div>

          {/* Role Switcher */}
          <div className="bg-slate-50 p-1.5 rounded-2xl border border-slate-200 flex flex-col gap-1.5 shrink-0">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setViewerRole('student');
                  if (!viewerId && db.classes.length > 0) setViewerId(db.classes[0].id);
                }}
                className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  viewerRole === 'student'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Peserta
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewerRole('teacher');
                  if (!viewerId && db.teachers.length > 0) setViewerId(db.teachers[0].id);
                }}
                className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  viewerRole === 'teacher'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ustadz
              </button>
              <button
                type="button"
                onClick={() => setViewerRole('admin')}
                className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  viewerRole === 'admin'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua
              </button>
            </div>

            {/* Selector dropdown for Class or Teacher */}
            {viewerRole === 'student' && (
              <select
                value={viewerId || db.classes[0]?.id}
                onChange={(e) => setViewerId(e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-slate-800"
              >
                {db.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    Kelas: {c.name}
                  </option>
                ))}
              </select>
            )}

            {viewerRole === 'teacher' && (
              <select
                value={viewerId || db.teachers[0]?.id}
                onChange={(e) => setViewerId(e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-slate-800"
              >
                {db.teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.panggilan || t.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* CURRENT CLASS: small notif when nothing is active, full card when a class is live */}
      {!currentClass && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200/90 text-slate-500">
          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
          <p className="text-xs font-medium">
            Tidak ada kelas aktif saat ini untuk {viewerLabel}.
          </p>
        </div>
      )}

      {/* TWO PRIMARY FOCUS CARDS: CURRENT CLASS & NEXT CLASS */}
      <div className={`grid grid-cols-1 gap-5 ${currentClass ? 'md:grid-cols-2' : ''}`}>
        {/* CARD 1: CURRENT CLASS (only rendered when a class is live) */}
        {currentClass && (
        <div
          className="rounded-3xl border-2 p-5 sm:p-6 transition-all relative overflow-hidden flex flex-col justify-between shadow-md"
          style={{
            borderColor: currentClassColor,
            background: `linear-gradient(135deg, #FFFFFF 0%, ${currentClassColor} 100%)`,
            boxShadow: `0 4px 20px -2px ${currentClassColor}66`
          }}
        >
          <div>
            {/* Header / Status pill */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded-full animate-ping shrink-0 bg-blue-500"
                  /* class color is too weak: style={{ backgroundColor: currentClassColor }} */
                />
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                  Kelas Berlangsung Saat Ini
                </span>
              </div>

              {currentClass.timeRemainingMinutes !== undefined && (
                <span
                  className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs text-slate-800"
                  style={{
                    backgroundColor: currentClassColor,
                    borderColor: 'rgba(0, 0, 0, 0.15)'
                  }}
                >
                  Tersisa ~{currentClass.timeRemainingMinutes} mnt
                </span>
              )}
            </div>

            <div className="space-y-3.5">
              {/* Subject & Counterpart */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: currentClass.subjectColor }}
                  />
                  <h3 className="text-base inline-flex gap-1.5 sm:text-lg font-bold text-slate-900 leading-tight">
                    {currentClass.subjectName}
                    {currentClass.subjectBook && (
                      <span className="text-slate-500 font-semibold"> ({currentClass.subjectBook})</span>
                    )}
                    {/* Class Badge with Class Database Color & Icon */}
                    {currentClassEntity && (
                      <span
                        className="px-2 py-0.5 rounded-md text-[11px] font-bold border flex items-center gap-1.5 text-slate-800 shadow-2xs"
                        style={{
                          backgroundColor: currentClassColor,
                          borderColor: 'rgba(0, 0, 0, 0.15)'
                        }}
                      >
                        <ClassIcon name={currentClassEntity.icon || 'GraduationCap'} className="w-3 h-3" />
                        <span className="text-sm">{currentClassEntity.name}</span>
                      </span>
                    )}
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-5">
                  <p className="text-xs font-semibold text-slate-600">
                    {viewerRole === 'student' ? 'Pengampu: ' : ''}
                    <span className="text-slate-900 font-bold">
                      {viewerRole === 'teacher' ? '' : currentClass.counterpartLabel}
                    </span>
                  </p>


                </div>
              </div>

              {/* Timing & Location */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 bg-white/85 backdrop-blur-xs p-3 rounded-2xl border border-slate-200/90 shadow-2xs">
                <div className="flex items-center gap-1.5 font-medium">
                  <Clock className="w-4 h-4 text-slate-600" />
                  <span>
                    {currentClass.occurrence.startTime} - {currentClass.occurrence.endTime} (
                    {currentClass.occurrence.sessionName})
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-medium">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{currentClass.roomName}</span>
                </div>
                <div>
                  {/* Online Class Link clickable icon */}
                  {currentClassEntity?.onlineClassLink && (
                    <a
                      href={currentClassEntity.onlineClassLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-2xs cursor-pointer ml-auto"
                      title={`Buka Kelas Online: ${currentClassEntity.onlineClassLink}`}
                    >
                      <Video className="w-4 h-4" />
                      <span>online</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Material rendered via get_units_for_session per specification:
                  "{part}/{page_start}: {title}" (list if multiple) */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Materi Silabus Sesi Ini:
                </span>

                {currentClass.units.length === 0 ? (
                  <div className="text-xs text-slate-400 italic p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    (Pembahasan Mandiri / Sesi Latihan Soal)
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {currentClass.units.map((unit) => (
                      <div
                        key={unit.id}
                        onClick={() =>
                          onNavigateToJournal(
                            currentClass.occurrence.subjectId,
                            currentClass.occurrence.classId,
                            currentClass.occurrence.date
                          )
                        }
                        className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border text-slate-900 text-xs font-bold flex items-center justify-between gap-2 cursor-pointer transition-colors group shadow-2xs"
                        style={{
                          borderColor: `${currentClassColor}99`
                        }}
                        title="Klik untuk membuka materi pada Jurnal"
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full shrink-0 mt-1"
                            style={{ backgroundColor: currentClassColor }}
                          />
                          <span className="break-words">
                            {formatUnitDisplay(unit)}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-700 shrink-0 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 group-hover:bg-slate-800 group-hover:text-white transition-colors">
                          hal. {unit.page_start}-{unit.page_end}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Deep link action button */}
          <div
            className="mt-5 pt-3.5 border-t flex items-center justify-between"
            style={{ borderColor: `${currentClassColor}55` }}
          >
            <span className="text-[11px] text-slate-700 font-semibold">
              Pertemuan #{currentClass.occurrence.meetingIndex}
            </span>
            <button
              type="button"
              onClick={() =>
                onNavigateToJournal(
                  currentClass.occurrence.subjectId,
                  currentClass.occurrence.classId,
                  currentClass.occurrence.date
                )
              }
              className="flex items-center gap-1.5 text-xs font-bold text-slate-900 hover:text-black bg-white hover:bg-slate-50 px-3 py-1.5 rounded-xl border shadow-2xs transition-all cursor-pointer"
              style={{ borderColor: currentClassColor }}
            >
              <span>Buka Jurnal Lengkap</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        )}

        {/* CARD 2: NEXT CLASS (Walk forward, may be a future day) */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
          <div>
            {/* Header / Status pill */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Kelas Berikutnya (Next Class)
                </span>
              </div>

              {nextClass && (
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                    nextClass.isToday
                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}
                >
                  {nextClassCountdownLabel}
                </span>
              )}
            </div>

            {nextClass ? (
              <div className="space-y-3.5">
                {/* Subject & Counterpart */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: nextClass.subjectColor }}
                    />
                    <h3 className="text-base inline-flex gap-1.5 sm:text-lg font-bold text-slate-900 leading-tight">
                      {nextClass.subjectName}
                      {nextClass.subjectBook && (
                        <span className="text-slate-500 font-semibold"> ({nextClass.subjectBook})</span>
                      )}
                      {/* Class Badge */}
                      {nextClassEntity && (
                        <span
                          className="px-2 py-0.5 rounded-md text-[11px] font-bold flex mb-1 border items-center gap-1.5 text-slate-800 shadow-2xs"
                          style={{
                            backgroundColor: nextClassEntity.color || '#E0E7FF',
                            borderColor: 'rgba(0, 0, 0, 0.15)'
                          }}
                        >
                          <ClassIcon name={nextClassEntity.icon || 'GraduationCap'} className="w-3 h-3" />
                          <span className="text-sm">{nextClassEntity.name}</span>
                        </span>
                      )}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-5">
                    <p className="text-xs font-semibold text-slate-600">
                      {viewerRole === 'student' ? 'Pengampu: ' : ''}
                      <span className="text-slate-900 font-bold">
                        {viewerRole === 'teacher' ? '' : nextClass.counterpartLabel}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Timing & Location */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                  <div className="flex items-center gap-1.5 font-medium">
                    <CalendarIcon className="w-4 h-4 text-emerald-600" />
                    <span>
                      {DAY_LABELS[nextClass.occurrence.day] || nextClass.occurrence.day}, {nextClass.occurrence.date}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-medium">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>
                      {nextClass.occurrence.startTime} - {nextClass.occurrence.endTime}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-medium">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span>{nextClass.roomName}</span>
                  </div>
                  <div>
                    {/* Online Class Link clickable icon */}
                    {nextClassEntity?.onlineClassLink && (
                      <a
                        href={nextClassEntity.onlineClassLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-2xs cursor-pointer ml-auto"
                        title={`Buka Kelas Online: ${nextClassEntity.onlineClassLink}`}
                      >
                        <Video className="w-3 h-3" />
                        <span>online</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Material rendered via get_units_for_session:
                    "{part}/{page_start}: {title}" (list if multiple) */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Materi Silabus Rencana Sesi:
                  </span>

                  {nextClass.units.length === 0 ? (
                    <div className="text-xs text-slate-400 italic p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      (Pembahasan Mandiri / Sesi Praktikum)
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {nextClass.units.map((unit) => (
                        <div
                          key={unit.id}
                          onClick={() =>
                            onNavigateToJournal(
                              nextClass.occurrence.subjectId,
                              nextClass.occurrence.classId,
                              nextClass.occurrence.date
                            )
                          }
                          className="p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 text-slate-800 hover:text-emerald-950 text-xs font-semibold flex items-center justify-between gap-2 cursor-pointer transition-colors group"
                          title="Klik untuk membuka materi pada Jurnal"
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                            <span className="break-words">
                              {formatUnitDisplay(unit)}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500 shrink-0 px-1.5 py-0.5 rounded bg-white border border-slate-200 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            hal. {unit.page_start}-{unit.page_end}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 space-y-2">
                <CalendarCheck2 className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-xs font-medium text-slate-500 max-w-xs mx-auto">
                  Tidak ada kelas berikutnya yang dijadwalkan dalam periode kalender akademik.
                </p>
              </div>
            )}
          </div>

          {/* Deep link action button */}
          {nextClass && (
            <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-semibold">
                Pertemuan #{nextClass.occurrence.meetingIndex}
              </span>
              <button
                type="button"
                onClick={() =>
                  onNavigateToJournal(
                    nextClass.occurrence.subjectId,
                    nextClass.occurrence.classId,
                    nextClass.occurrence.date
                  )
                }
                className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition-all cursor-pointer"
              >
                <span>Buka di Jurnal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* QUICK SHORTCUTS TO STUDIO & JOURNAL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          onClick={onNavigateToSchedule}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 hover:border-amber-400 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                Buka Kalender Jadwal Lengkap
              </h4>
              <p className="text-xs text-slate-500">
                Lihat matriks jadwal mingguan dan rotasi sesi per kelas
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
        </div>

        <div
          onClick={() => {
            onNavigateToJournal('', '', '');
          }}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 hover:border-amber-400 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                Jelajahi Jurnal Pembelajaran
              </h4>
              <p className="text-xs text-slate-500">
                Telusuri target materi kurikulum dan silabus per mata kuliah
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    </div>
  );
};
