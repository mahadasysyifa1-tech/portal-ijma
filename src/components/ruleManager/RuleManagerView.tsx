import React, { useState } from 'react';
import { DatabaseState, ScheduleRule } from '../../types';
import {
  Layers,
  BookOpen,
  CalendarDays,
  Sliders,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { RulesDatabaseTab } from '../database/RulesDatabaseTab';
import { SyllabusPanel } from './SyllabusPanel';

interface RuleManagerViewProps {
  db: DatabaseState;
  onUpdateDb: (updater: (prev: DatabaseState) => DatabaseState) => void;
  onEditRule?: (rule: ScheduleRule) => void;
  onAddRule?: () => void;
  onToggleRuleActive?: (ruleId: string) => void;
  onDeleteRule?: (ruleId: string) => void;
  isAdmin?: boolean;
  onOpenAdminLogin?: () => void;
  onNavigateToJournal?: (subjectId?: string, classId?: string, date?: string) => void;
  onNavigateToSchedule?: () => void;
}

export const RuleManagerView: React.FC<RuleManagerViewProps> = ({
  db,
  onUpdateDb,
  onEditRule,
  onAddRule,
  onToggleRuleActive,
  onDeleteRule,
  isAdmin = true,
  onOpenAdminLogin,
  onNavigateToJournal,
  onNavigateToSchedule
}) => {
  // Panel mode: 'rules' (Aturan Jadwal & Event Kaldik) vs 'syllabus' (Distribusi Silabus)
  const [activePanel, setActivePanel] = useState<'rules' | 'syllabus'>('rules');

  const ruleCount = db.rules?.length || 0;
  const kaldikCount = db.kaldikEvents?.length || 0;
  const packageCount = (db.subjects?.length || 0) * (db.classes?.length || 0);

  return (
    <div className="space-y-5">
      {/* Studio Header & Navigation Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                <Sliders className="w-3 h-3 text-indigo-600" />
                Admin Studio
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-500 font-medium">Perencanaan KBM &amp; Kurikulum</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2.5">
              <span>Rule Manager Studio</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl">
              Pusat perencanaan terpadu untuk mengelola aturan jadwal KBM, agenda event kalender akademik (kaldik), serta distribusi silabus materi antar paket kelas.
            </p>
          </div>

          {/* Quick Schedule shortcut */}
          {onNavigateToSchedule && (
            <button
              type="button"
              onClick={onNavigateToSchedule}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shrink-0 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Lihat Hasil di Jadwal</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
            </button>
          )}
        </div>

        {/* Panel Switcher (Two Panels: Old Rules Manager Tab vs New Syllabus Panel) */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-100 overflow-x-auto">
          {/* Panel 1: Aturan Jadwal & Kaldik (The old rules manager tab) */}
          <button
            type="button"
            id="panel-btn-rules"
            onClick={() => setActivePanel('rules')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activePanel === 'rules'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/70'
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span>Aturan Jadwal &amp; Kaldik</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activePanel === 'rules'
                  ? 'bg-indigo-700/80 text-white'
                  : 'bg-slate-200/80 text-slate-700'
              }`}
            >
              {ruleCount} Aturan • {kaldikCount} Kaldik
            </span>
          </button>

          {/* Panel 2: Distribusi Silabus (The new syllabus panel) */}
          <button
            type="button"
            id="panel-btn-syllabus"
            onClick={() => setActivePanel('syllabus')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activePanel === 'syllabus'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/70'
            }`}
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span>Distribusi Silabus (Pacing)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activePanel === 'syllabus'
                  ? 'bg-indigo-700/80 text-white'
                  : 'bg-slate-200/80 text-slate-700'
              }`}
            >
              {packageCount} Paket
            </span>
          </button>
        </div>
      </div>

      {/* PANEL 1: Aturan Jadwal & Kaldik (Schedule rules and event rules) */}
      {activePanel === 'rules' && (
        <RulesDatabaseTab
          db={db}
          onUpdateDb={onUpdateDb}
          onEditRule={onEditRule}
          onAddRule={onAddRule}
          onToggleRuleActive={onToggleRuleActive}
          onDeleteRule={onDeleteRule}
          isAdmin={isAdmin}
          onOpenAdminLogin={onOpenAdminLogin}
          initialSubView="rules"
        />
      )}

      {/* PANEL 2: Distribusi Silabus (Syllabus distribution & pacing studio) */}
      {activePanel === 'syllabus' && (
        <SyllabusPanel
          db={db}
          onUpdateDb={onUpdateDb}
          isAdmin={isAdmin}
          onOpenAdminLogin={onOpenAdminLogin}
          onNavigateToJournal={onNavigateToJournal}
        />
      )}
    </div>
  );
};
