import React, { useState } from 'react';
import { DatabaseState, ScheduleRule } from '../../types';
import {
  Layers,
  BookOpen,
  Sliders,
  ArrowRight,
  Calendar,
  LayoutGrid,
  Rows,
  Columns,
  Maximize2
} from 'lucide-react';
import { RulesDatabaseTab } from '../database/RulesDatabaseTab';
import { SyllabusPanel } from './SyllabusPanel';

type PanelMode = 'both' | 'rules' | 'syllabus';
type BothLayoutMode = 'stacked' | 'split';

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
  // Panel mode: 'both' (Tampilkan Keduanya) vs 'rules' (Aturan Jadwal & Kaldik) vs 'syllabus' (Distribusi Silabus)
  const [activePanel, setActivePanel] = useState<PanelMode>(() => {
    const saved = localStorage.getItem('app_rule_manager_panel_mode');
    if (saved === 'both' || saved === 'rules' || saved === 'syllabus') {
      return saved;
    }
    return 'rules';
  });

  // Layout mode when showing both panels: 'stacked' (vertical) vs 'split' (side-by-side 2-columns)
  const [bothLayout, setBothLayout] = useState<BothLayoutMode>(() => {
    const saved = localStorage.getItem('app_rule_manager_both_layout');
    if (saved === 'stacked' || saved === 'split') {
      return saved;
    }
    return 'stacked';
  });

  const handleSetPanel = (mode: PanelMode) => {
    setActivePanel(mode);
    try {
      localStorage.setItem('app_rule_manager_panel_mode', mode);
    } catch {
      // ignore storage errors
    }
  };

  const handleSetBothLayout = (layout: BothLayoutMode) => {
    setBothLayout(layout);
    try {
      localStorage.setItem('app_rule_manager_both_layout', layout);
    } catch {
      // ignore storage errors
    }
  };

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

        {/* Panel Switcher & Layout Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 overflow-x-auto">
            {/* Panel Mode: Tampilkan Keduanya (Both) */}
            <button
              type="button"
              id="panel-btn-both"
              onClick={() => handleSetPanel('both')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activePanel === 'both'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/70'
              }`}
            >
              <LayoutGrid className="w-4 h-4 shrink-0" />
              <span>Tampilkan Keduanya</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activePanel === 'both'
                    ? 'bg-indigo-700/80 text-white'
                    : 'bg-slate-200/80 text-slate-700'
                }`}
              >
                Split / Tumpuk
              </span>
            </button>

            {/* Panel 1: Aturan Jadwal & Kaldik */}
            <button
              type="button"
              id="panel-btn-rules"
              onClick={() => handleSetPanel('rules')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
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

            {/* Panel 2: Distribusi Silabus (The syllabus panel) */}
            <button
              type="button"
              id="panel-btn-syllabus"
              onClick={() => handleSetPanel('syllabus')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
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

          {/* Sub-layout controls when 'both' is active */}
          {activePanel === 'both' && (
            <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200 text-xs shrink-0 self-start sm:self-auto">
              <button
                type="button"
                id="layout-btn-stacked"
                onClick={() => handleSetBothLayout('stacked')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  bothLayout === 'stacked'
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilkan panel bertumpuk secara vertikal (Lebar penuh)"
              >
                <Rows className="w-3.5 h-3.5" />
                <span>Tumpuk (Vertikal)</span>
              </button>

              <button
                type="button"
                id="layout-btn-split"
                onClick={() => handleSetBothLayout('split')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  bothLayout === 'split'
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilkan panel berdampingan (2 Kolom di layar lebar)"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Berdampingan (2 Kolom)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* VIEW: BOTH PANELS SHOWN SIMULTANEOUSLY */}
      {activePanel === 'both' && (
        <div
          className={
            bothLayout === 'split'
              ? 'grid grid-cols-1 xl:grid-cols-2 gap-6 items-start'
              : 'space-y-6'
          }
        >
          {/* Panel 1 Wrapper */}
          <div className="space-y-3 min-w-0">
            <div className="flex items-center justify-between bg-slate-100/90 border border-slate-200/90 px-3.5 py-2 rounded-xl text-xs shadow-2xs">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Panel 1: Aturan Jadwal &amp; Event Kaldik</span>
                <span className="text-[10px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                  {ruleCount} aturan • {kaldikCount} event
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleSetPanel('rules')}
                className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                title="Buka panel ini saja dalam ukuran penuh"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Fokuskan Panel</span>
              </button>
            </div>

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
          </div>

          {/* Panel 2 Wrapper */}
          <div className="space-y-3 min-w-0">
            <div className="flex items-center justify-between bg-slate-100/90 border border-slate-200/90 px-3.5 py-2 rounded-xl text-xs shadow-2xs">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>Panel 2: Distribusi Silabus (Pacing &amp; Target Materi)</span>
                <span className="text-[10px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                  {packageCount} paket
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleSetPanel('syllabus')}
                className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                title="Buka panel ini saja dalam ukuran penuh"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Fokuskan Panel</span>
              </button>
            </div>

            <SyllabusPanel
              db={db}
              onUpdateDb={onUpdateDb}
              isAdmin={isAdmin}
              onOpenAdminLogin={onOpenAdminLogin}
              onNavigateToJournal={onNavigateToJournal}
            />
          </div>
        </div>
      )}

      {/* VIEW: SINGLE PANEL - ATURAN JADWAL & KALDIK ONLY */}
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

      {/* VIEW: SINGLE PANEL - DISTRIBUSI SILABUS ONLY */}
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
