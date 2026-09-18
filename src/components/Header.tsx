import React, { useState } from 'react';
import {
  Home,
  Calendar as CalendarIcon,
  AlertTriangle,
  BookOpen,
  Users,
  Database,
  Menu,
  ChevronDown,
  Lock,
  Unlock,
  RefreshCw,
  CheckCircle2,
  ShieldAlert,
  Layers,
  BookmarkCheck,
  CalendarDays,
  Download,
  Sliders
} from 'lucide-react';
import { ScheduleConflict } from '../types';
import { LOGO_BASE64 } from '../assets/logo';

export type ActiveTabType = 'home' | 'studio' | 'kaldik' | 'journal' | 'subjects' | 'teachers' | 'conflicts' | 'database' | 'export-import' | 'rule-manager';

interface HeaderProps {
  activeTab: ActiveTabType;
  setActiveTab: (tab: ActiveTabType) => void;
  conflicts: ScheduleConflict[];
  showRules?: boolean;
  onToggleRules?: (show: boolean) => void;
  isSaving: boolean;
  isAdmin: boolean;
  onOpenAdminLogin: () => void;
  onAdminLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  conflicts,
  showRules,
  onToggleRules,
  isSaving,
  isAdmin,
  onOpenAdminLogin,
  onAdminLogout
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const getMenuIcon = () => {
    switch (activeTab) {
      case 'kaldik':
        return <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-amber-600" />;
      case 'journal':
        return <BookmarkCheck className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-amber-600" />;
      case 'subjects':
        return <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-indigo-600" />;
      case 'teachers':
        return <Users className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-indigo-600" />;
      case 'database':
        return <Database className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-slate-700" />;
      case 'conflicts':
        return <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-rose-600" />;
      case 'export-import':
        return <Download className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-indigo-600" />;
      case 'rule-manager':
        return <Sliders className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-indigo-600" />;
      default:
        return <Menu className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />;
    }
  };

  return (
    <header className="bg-white backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-30 shadow-s">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-2 sm:py-2.5 min-h-[56px] sm:h-16 gap-2">
          {/* Logo & Title */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 rounded-xl sm:rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0 overflow-hidden relative">
              <img
                src={LOGO_BASE64}
                alt="Logo IJMA"
                className="w-9 h-9 sm:w-9 sm:h-9 md:w-11 md:h-11 max-w-none object-cover scale-110"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 tracking-tight truncate">
                  Portal Akademik IJMA
                </h1>
                <span className="hidden sm:inline-flex text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 shrink-0 whitespace-nowrap">
                  I'dad Jami'iy Ma'had Asy-Syifa
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">
                Pendidikan &amp; Aktivitas Program IJMA T.A. 2026 - 2027
              </p>
            </div>
          </div>

          {/* Right Area: Conflicts alert & Admin Auth */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {conflicts.length > 0 && (
              <button
                id="header-conflict-pill"
                onClick={() => {
                  if (!isAdmin) {
                    onOpenAdminLogin();
                  } else {
                    setActiveTab('conflicts');
                  }
                }}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors animate-pulse cursor-pointer whitespace-nowrap"
                title={isAdmin ? 'Buka Conflict Inspector' : 'Masuk admin untuk memeriksa konflik'}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span className="hidden sm:inline">{conflicts.length} Konflik</span>
                <span className="sm:hidden font-bold">{conflicts.length}</span>
                {!isAdmin && <Lock className="w-3 h-3 text-rose-400 shrink-0 ml-0.5" />}
              </button>
            )}

            {/* Admin status toggle */}
            {isAdmin ? (
              <div className="flex items-center gap-1 sm:gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold whitespace-nowrap">
                <Unlock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="hidden sm:inline">Admin Aktif</span>
                <span className="sm:hidden"></span>
                <button
                  type="button"
                  onClick={onAdminLogout}
                  className="ml-0.5 sm:ml-1 text-[10px] sm:text-[11px] text-emerald-700 hover:text-rose-600 underline font-normal cursor-pointer"
                  title="Keluar dari mode admin"
                >
                  (Kunci)
                </button>
              </div>
            ) : (
              <button
                type="button"
                id="header-admin-login-btn"
                onClick={onOpenAdminLogin}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200/90 border border-slate-200 transition-colors cursor-pointer whitespace-nowrap"
                title="Masuk mode admin untuk mengedit aturan"
              >
                <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="hidden sm:inline">Masuk Admin</span>
                <span className="sm:hidden"></span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Bar: Main "Jadwal" + Hidden Menus */}
        <div className="flex items-center justify-between border-t border-slate-100 py-1.5 gap-2">
          <div className="flex items-center space-x-1 sm:space-x-1.5">
            {/* Primary Tab: Beranda */}
            <button
              id="tab-btn-home"
              type="button"
              onClick={() => setActiveTab('home')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'home'
                  ? 'bg-amber-500 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Home className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>
                {activeTab === 'home' ? 'Beranda' : ''}
              </span>
            </button>

            {/* Primary Tab: Jadwal (Studio) */}
            <button
              id="tab-btn-studio"
              type="button"
              onClick={() => setActiveTab('studio')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'studio'
                  ? 'bg-amber-500 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>
                {activeTab === 'studio' ? 'Jadwal' : ''}
              </span>
            </button>

            {/* Dropdown Menu for other sections */}
            <div className="relative">
              <button
                type="button"
                id="header-menu-toggle-btn"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab !== 'studio' && activeTab !== 'home'
                    ? 'bg-slate-100 text-slate-900 border-slate-300 font-bold'
                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200'
                }`}
              >
                {getMenuIcon()}
                <span className="truncate max-w-[110px] sm:max-w-none">
                  {activeTab === 'kaldik'
                    ? 'Kaldik'
                    : activeTab === 'journal'
                    ? 'Jurnal'
                    : activeTab === 'subjects'
                    ? 'Pelajaran'
                    : activeTab === 'teachers'
                    ? 'Guru'
                    : activeTab === 'database'
                    ? 'Basis Data'
                    : activeTab === 'conflicts'
                    ? 'Conflict Inspector'
                    : activeTab === 'export-import'
                    ? 'Ekspor & Impor'
                    : activeTab === 'rule-manager'
                    ? 'Rule Manager'
                    : ''}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown items */}
              {isMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsMenuOpen(false)}
                  />
                  <div className="absolute left-0 mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <button
                      type="button"
                      id="menu-item-kaldik"
                      onClick={() => {
                        setActiveTab('kaldik');
                        setIsMenuOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                        activeTab === 'kaldik' ? 'text-amber-600 bg-amber-50/50' : 'text-slate-700'
                      }`}
                    >
                      <CalendarDays className="w-4 h-4 text-amber-600" />
                      <span>Kalender Akademik (Kaldik)</span>
                    </button>

                    <button
                      type="button"
                      id="menu-item-journal"
                      onClick={() => {
                        setActiveTab('journal');
                        setIsMenuOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                        activeTab === 'journal' ? 'text-amber-600 bg-amber-50/50' : 'text-slate-700'
                      }`}
                    >
                      <BookmarkCheck className="w-4 h-4 text-amber-600" />
                      <span>Jurnal &amp; Silabus</span>
                    </button>

                    <button
                      type="button"
                      id="menu-item-subjects"
                      onClick={() => {
                        setActiveTab('subjects');
                        setIsMenuOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                        activeTab === 'subjects' ? 'text-amber-600 bg-amber-50/50' : 'text-slate-700'
                      }`}
                    >
                      <BookOpen className="w-4 h-4 text-indigo-600" />
                      <span>Pelajaran (Mata Kuliah)</span>
                    </button>

                    <button
                      type="button"
                      id="menu-item-teachers"
                      onClick={() => {
                        setActiveTab('teachers');
                        setIsMenuOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                        activeTab === 'teachers' ? 'text-amber-600 bg-amber-50/50' : 'text-slate-700'
                      }`}
                    >
                      <Users className="w-4 h-4 text-indigo-600" />
                      <span>Guru (Asatidzah)</span>
                    </button>

                    <div className="h-px bg-slate-100 my-1" />

                    {/* Admin Sub Menu */}
                    <button
                      type="button"
                      id="tab-btn-rule-manager"
                      onClick={() => {
                        setIsMenuOpen(false);
                        if (!isAdmin) {
                          onOpenAdminLogin();
                        } else {
                          setActiveTab('rule-manager');
                        }
                      }}
                      className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                        activeTab === 'rule-manager' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Sliders className="w-4 h-4 text-indigo-600" />
                        <span>Rule Manager (Studio)</span>
                      </div>
                      {!isAdmin && (
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-normal">
                          Admin
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      id="tab-btn-database"
                      onClick={() => {
                        setIsMenuOpen(false);
                        if (!isAdmin) {
                          onOpenAdminLogin();
                        } else {
                          setActiveTab('database');
                        }
                      }}
                      className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                        activeTab === 'database' ? 'text-amber-600 bg-amber-50/50' : 'text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Database className="w-4 h-4 text-slate-500" />
                        <span>Basis Data Master</span>
                      </div>
                      {!isAdmin && (
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-normal">
                          Admin
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      id="tab-btn-conflicts"
                      onClick={() => {
                        setIsMenuOpen(false);
                        if (!isAdmin) {
                          onOpenAdminLogin();
                        } else {
                          setActiveTab('conflicts');
                        }
                      }}
                      className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                        activeTab === 'conflicts' ? 'text-rose-600 bg-rose-50/50' : 'text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                        <span>Conflict Inspector</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {conflicts.length > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-600 text-white font-bold">
                            {conflicts.length}
                          </span>
                        )}
                        {!isAdmin && (
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-normal">
                            Admin
                          </span>
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      id="tab-btn-export-import"
                      onClick={() => {
                        setIsMenuOpen(false);
                        if (!isAdmin) {
                          onOpenAdminLogin();
                        } else {
                          setActiveTab('export-import');
                        }
                      }}
                      className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                        activeTab === 'export-import' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Download className="w-4 h-4 text-indigo-600" />
                        <span>Ekspor &amp; Impor Data</span>
                      </div>
                      {!isAdmin && (
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-normal">
                          Admin
                        </span>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Status & Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {isSaving && (
              <span className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1 font-medium mr-0.5 sm:mr-1 whitespace-nowrap">
                <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
                <span className="hidden sm:inline">Menyimpan...</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
