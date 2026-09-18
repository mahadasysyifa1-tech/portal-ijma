import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DatabaseState, ScheduleRule, ScheduleConflict, DayOfWeek } from './types';
import { initialData } from './data/initialData';
import { detectConflicts } from './utils/scheduleEngine';
import { normalizeDatabaseState, normalizeRule } from './utils/normalize';
import { Header, ActiveTabType } from './components/Header';
import { UnifiedStudio } from './components/UnifiedStudio';
import { SubjectsDirectory } from './components/directory/SubjectsDirectory';
import { TeachersDirectory } from './components/directory/TeachersDirectory';
import { ConflictCenter } from './components/ConflictCenter';
import { EntityManager } from './components/EntityManager';
import { RuleModal } from './components/RuleModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { HomeTab } from './components/HomeTab';
import { JournalView, ViewerRole } from './components/JournalView';
import { ExportImportView } from './components/ExportImportView';
import { KaldikView } from './components/kaldik/KaldikView';
import { RuleManagerView } from './components/ruleManager/RuleManagerView';
import { parseUrlRoute, updateUrlRoute } from './utils/routing';

export default function App() {
  const initialRoute = useMemo(() => parseUrlRoute(), []);

  const [activeTab, setActiveTab] = useState<ActiveTabType>(() => {
    if (initialRoute.tab) return initialRoute.tab;
    try {
      const savedTab = localStorage.getItem('ijma_last_tab') as ActiveTabType;
      if (savedTab && ['home', 'studio'].includes(savedTab)) {
        return savedTab;
      }
    } catch {}
    return 'home';
  });

  const [db, setDb] = useState<DatabaseState>(() => {
    try {
      const cached = localStorage.getItem('school_schedule_db');
      if (cached) {
        return normalizeDatabaseState(JSON.parse(cached));
      }
    } catch (e) {
      console.warn('Could not parse cached database', e);
    }
    return normalizeDatabaseState(initialData);
  });

  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ijma_admin_auth') === 'true';
    } catch {
      return false;
    }
  });

  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ScheduleRule | null>(null);
  const [slotPrefill, setSlotPrefill] = useState<{
    day?: DayOfWeek;
    periodId?: string;
    sessionId?: string;
    classId?: string;
    subjectId?: string;
  } | undefined>(undefined);

  // Viewer role & identity state for Home, Studio/Jadwal & Journal
  const [viewerRole, setViewerRole] = useState<ViewerRole>(() => {
    if (initialRoute.role) return initialRoute.role;
    try {
      const savedRole = localStorage.getItem('ijma_viewer_role') as ViewerRole;
      if (savedRole === 'student' || savedRole === 'teacher') return savedRole;
    } catch {}
    return 'student';
  });

  const [viewerId, setViewerId] = useState<string>(() => {
    if (initialRoute.id) return initialRoute.id;
    try {
      const savedId = localStorage.getItem('ijma_viewer_id');
      if (savedId) return savedId;
    } catch {}
    return '';
  });

  // Deep linking to Journal view
  const [journalNavParams, setJournalNavParams] = useState<{
    subjectId?: string;
    classId?: string;
    date?: string;
  } | null>(null);

  const handleSetViewerRole = (role: ViewerRole) => {
    setViewerRole(role);
  };

  const handleSetViewerId = (id: string) => {
    setViewerId(id);
  };

  const handleNavigateToJournal = (subjectId?: string, classId?: string, date?: string) => {
    if (subjectId) {
      setJournalNavParams({ subjectId, classId, date });
    } else {
      setJournalNavParams(null);
    }
    setActiveTab('journal');
    updateUrlRoute('journal', viewerRole, viewerId, 'push');
  };

  const handleTabChange = (tab: ActiveTabType) => {
    // Navigating between tabs clears all 1-time deep link tokens
    setJournalNavParams(null);
    setActiveTab(tab);
    updateUrlRoute(tab, viewerRole, viewerId, 'push');
  };

  // Sync token in localStorage & URL
  useEffect(() => {
    try {
      localStorage.setItem('ijma_last_tab', activeTab);
      if (activeTab === 'home' || activeTab === 'studio') {
        if (viewerRole) localStorage.setItem('ijma_viewer_role', viewerRole);
        if (viewerId) localStorage.setItem('ijma_viewer_id', viewerId);
      }
    } catch {}

    updateUrlRoute(activeTab, viewerRole, viewerId, 'replace');
  }, [activeTab, viewerRole, viewerId]);

  // Handle browser back/forward buttons (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const route = parseUrlRoute(db);
      if (route.tab) setActiveTab(route.tab);
      if (route.role) setViewerRole(route.role);
      if (route.id) setViewerId(route.id);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [db]);

  // Fetch from backend API on mount
  useEffect(() => {
    fetch('/api/database')
      .then((res) => {
        if (!res.ok) throw new Error('API failed');
        return res.json();
      })
      .then((data: any) => {
        if (data && data.subjects && data.subjects.length > 0) {
          const normalized = normalizeDatabaseState(data);
          setDb(normalized);
          try {
            localStorage.setItem('school_schedule_db', JSON.stringify(normalized));
          } catch {}
        }
      })
      .catch((err) => {
        console.warn('Using local state database (backend pending):', err);
      });
  }, []);

  // Ensure viewerId stays valid when classes or teachers change
  useEffect(() => {
    if (viewerRole === 'student') {
      const valid = db.classes.some((c) => c.id === viewerId);

      if (!valid && db.classes.length > 0) {
        handleSetViewerId(db.classes[0].id);
      }
    }

    if (viewerRole === 'teacher') {
      const valid = db.teachers.some((t) => t.id === viewerId);

      if (!valid && db.teachers.length > 0) {
        handleSetViewerId(db.teachers[0].id);
      }
    }
  }, [db.classes, db.teachers, viewerRole, viewerId]);

  // Sync save to server and local cache
  const saveDatabase = useCallback((newDb: DatabaseState) => {
    const normalized = normalizeDatabaseState(newDb);
    setDb(normalized);
    try {
      localStorage.setItem('school_schedule_db', JSON.stringify(normalized));
    } catch (e) {
      console.warn('Local storage error', e);
    }

    setIsSaving(true);
    fetch('/api/database/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized)
    })
      .then((res) => res.json())
      .catch((err) => console.warn('Sync save to server error:', err))
      .finally(() => setIsSaving(false));
  }, []);

  // Conflicts calculation
  const conflicts = useMemo(() => {
    return detectConflicts(db);
  }, [db]);

  // Admin login / logout
  const handleOpenAdminLogin = () => {
    setIsAdminModalOpen(true);
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    try {
      localStorage.removeItem('ijma_admin_auth');
    } catch {}
  };

  const handleAdminSuccess = () => {
    setIsAdmin(true);
    try {
      localStorage.setItem('ijma_admin_auth', 'true');
    } catch {}
  };

  // Rule Handlers
  const handleOpenNewRule = (prefillSubjectId?: string) => {
    if (!isAdmin) {
      setIsAdminModalOpen(true);
      return;
    }
    setEditingRule(null);
    setSlotPrefill(prefillSubjectId ? { subjectId: prefillSubjectId } : undefined);
    setIsModalOpen(true);
  };

  const handleOpenNewRuleForSlot = (
    day: DayOfWeek,
    periodId: string,
    sessionId: string,
    classId?: string
  ) => {
    if (!isAdmin) {
      setIsAdminModalOpen(true);
      return;
    }
    setEditingRule(null);
    setSlotPrefill({ day, periodId, sessionId, classId });
    setIsModalOpen(true);
  };

  const handleEditRule = (rule: ScheduleRule) => {
    if (!isAdmin) {
      setIsAdminModalOpen(true);
      return;
    }
    setEditingRule(rule);
    setSlotPrefill(undefined);
    setIsModalOpen(true);
  };

  const handleAddRule = () => {
    if (!isAdmin) {
      setIsAdminModalOpen(true);
      return;
    }
    setEditingRule(null);
    setSlotPrefill(undefined);
    setIsModalOpen(true);
  };

  const handleDuplicateRule = (rule: ScheduleRule) => {
    if (!isAdmin) {
      setIsAdminModalOpen(true);
      return;
    }
    const duplicated: ScheduleRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      notes: `${rule.notes || 'Aturan Jadwal'} (Salinan)`,
      createdAt: new Date().toISOString(),
      exceptions: rule.exceptions.map((e) => ({
        ...e,
        id: `exc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
      }))
    };
    saveDatabase({
      ...db,
      rules: [duplicated, ...db.rules]
    });
  };

  const handleDeleteRule = (ruleId: string) => {
    if (!isAdmin) {
      setIsAdminModalOpen(true);
      return;
    }
    saveDatabase({
      ...db,
      rules: db.rules.filter((r) => r.id !== ruleId)
    });
  };

  const handleToggleRuleActive = (ruleId: string, active: boolean) => {
    if (!isAdmin) {
      setIsAdminModalOpen(true);
      return;
    }
    saveDatabase({
      ...db,
      rules: db.rules.map((r) => (r.id === ruleId ? { ...r, active } : r))
    });
  };

  const handleToggleSubjectRulesActive = (subjectId: string, active: boolean) => {
    if (!isAdmin) {
      setIsAdminModalOpen(true);
      return;
    }
    saveDatabase({
      ...db,
      rules: db.rules.map((r) => (r.subjectId === subjectId ? { ...r, active } : r))
    });
  };

  const handleSaveRule = (rule: ScheduleRule) => {
    const normalized = normalizeRule(rule, db.periods);
    const exists = db.rules.some((r) => r.id === normalized.id);
    let updatedRules: ScheduleRule[];
    if (exists) {
      updatedRules = db.rules.map((r) => (r.id === normalized.id ? normalized : r));
    } else {
      updatedRules = [normalized, ...db.rules];
    }
    saveDatabase({
      ...db,
      rules: updatedRules
    });
    setIsModalOpen(false);
  };

  // Reset demo template
  const handleResetData = () => {
    if (!isAdmin) {
      setIsAdminModalOpen(true);
      return;
    }
    if (!window.confirm('Kembalikan seluruh data jadwal ke data template bawaan IJMA?')) return;
    fetch('/api/database/reset', { method: 'POST' })
      .then((res) => res.json())
      .then(() => {
        setDb(initialData);
        localStorage.setItem('school_schedule_db', JSON.stringify(initialData));
      })
      .catch(() => {
        setDb(initialData);
        localStorage.setItem('school_schedule_db', JSON.stringify(initialData));
      });
  };

  // Export JSON
  const handleExportJson = () => {
    const dataStr = JSON.stringify(db, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jadwal_ijma_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON
  const handleImportJson = (jsonString: string) => {
    if (!isAdmin) {
      setIsAdminModalOpen(true);
      return;
    }
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Format JSON tidak valid');
    }
    const normalized = normalizeDatabaseState(parsed);
    saveDatabase(normalized);
  };

  return (
    <div className="min-h-screen bg-[#024884] text-slate-900 flex flex-col font-sans antialiased selection:bg-amber-500 selection:text-white">
      {/* Top Header & Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        conflicts={conflicts}
        showRules={showRules}
        onToggleRules={setShowRules}
        isSaving={isSaving}
        isAdmin={isAdmin}
        onOpenAdminLogin={handleOpenAdminLogin}
        onAdminLogout={handleAdminLogout}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Portal Home Tab */}
        {activeTab === 'home' && (
          <HomeTab
            db={db}
            viewerRole={viewerRole}
            setViewerRole={handleSetViewerRole}
            viewerId={viewerId}
            setViewerId={handleSetViewerId}
            onNavigateToJournal={handleNavigateToJournal}
            onNavigateToSchedule={() => handleTabChange('studio')}
          />
        )}

        {/* Kaldik Tab */}
        {activeTab === 'kaldik' && (
          <KaldikView
            db={db}
            onUpdateDb={(updater) => {
              const updated = typeof updater === 'function' ? updater(db) : updater;
              saveDatabase(updated);
            }}
            isAdmin={isAdmin}
            onOpenAdminLogin={handleOpenAdminLogin}
          />
        )}

        {/* Jurnal Tab */}
        {activeTab === 'journal' && (
          <JournalView
            db={db}
            isAdmin={isAdmin}
            onUpdateDb={(updater) => {
              const updated = updater(db);
              saveDatabase(updated);
            }}
            viewerRole={viewerRole}
            setViewerRole={handleSetViewerRole}
            viewerId={viewerId}
            setViewerId={handleSetViewerId}
            initialSubjectId={journalNavParams?.subjectId}
            initialClassId={journalNavParams?.classId}
            highlightDate={journalNavParams?.date}
            onClearInitialDeepLink={() => setJournalNavParams(null)}
            onOpenAdminLogin={handleOpenAdminLogin}
            onNavigateToRuleManager={() => handleTabChange('rule-manager')}
          />
        )}

        {/* Main Tab: Jadwal (Calendar is hero view) */}
        {activeTab === 'studio' && (
          <UnifiedStudio
            db={db}
            onUpdateDb={(updater) => {
              const updated = typeof updater === 'function' ? updater(db) : updater;
              saveDatabase(updated);
            }}
            conflicts={conflicts}
            showRules={showRules}
            onToggleRules={setShowRules}
            onOpenNewRule={handleOpenNewRule}
            onOpenNewRuleForSlot={handleOpenNewRuleForSlot}
            onEditRule={handleEditRule}
            onDuplicateRule={handleDuplicateRule}
            onDeleteRule={handleDeleteRule}
            onToggleRuleActive={handleToggleRuleActive}
            onToggleSubjectRulesActive={handleToggleSubjectRulesActive}
            onViewConflict={() => handleTabChange('conflicts')}
            isAdmin={isAdmin}
            onOpenAdminLogin={handleOpenAdminLogin}
            viewerRole={viewerRole}
            viewerId={viewerId}
            onViewerChange={(role, id) => {
              setViewerRole(role);
              setViewerId(id);
            }}
          />
        )}

        {/* Menu Tab: Pelajaran */}
        {activeTab === 'subjects' && (
          <SubjectsDirectory
            db={db}
            onBackToSchedule={() => handleTabChange('studio')}
            onSelectSubject={(subjectId) => {
              // Do not force carry-over any classId so user can choose or auto-resolve properly
              handleNavigateToJournal(subjectId, '', '');
            }}
          />
        )}

        {/* Menu Tab: Guru */}
        {activeTab === 'teachers' && (
          <TeachersDirectory
            db={db}
            onBackToSchedule={() => handleTabChange('studio')}
            onSelectTeacherSchedule={(teacherId) => {
              setViewerRole('teacher');
              setViewerId(teacherId);
              handleTabChange('studio');
            }}
          />
        )}

        {/* Menu Tab: Conflict Inspector (3rd in menu) */}
        {activeTab === 'conflicts' && (
          <ConflictCenter
            conflicts={conflicts}
            db={db}
            onEditRule={handleEditRule}
            onToggleRuleActive={handleToggleRuleActive}
            onNavigateToCalendar={() => handleTabChange('studio')}
          />
        )}

        {/* Menu Tab: Rule Manager Studio (Aturan Jadwal, Event Kaldik, & Distribusi Silabus) */}
        {activeTab === 'rule-manager' && (
          <RuleManagerView
            db={db}
            onUpdateDb={(updater) => {
              if (!isAdmin) {
                setIsAdminModalOpen(true);
                return;
              }
              const updated = updater(db);
              saveDatabase(updated);
            }}
            onEditRule={handleEditRule}
            onAddRule={handleAddRule}
            onToggleRuleActive={(ruleId) => {
              const rule = db.rules.find((r) => r.id === ruleId);
              if (rule) {
                handleToggleRuleActive(ruleId, !rule.active);
              }
            }}
            onDeleteRule={handleDeleteRule}
            isAdmin={isAdmin}
            onOpenAdminLogin={handleOpenAdminLogin}
            onNavigateToJournal={handleNavigateToJournal}
            onNavigateToSchedule={() => handleTabChange('studio')}
          />
        )}

        {/* Menu Tab: Basis Data */}
        {activeTab === 'database' && (
          <EntityManager
            db={db}
            onUpdateDb={(updater) => {
              if (!isAdmin) {
                setIsAdminModalOpen(true);
                return;
              }
              const updated = updater(db);
              saveDatabase(updated);
            }}
            onExportJson={handleExportJson}
            onImportJson={handleImportJson}
            onEditRule={handleEditRule}
            onAddRule={handleAddRule}
            onToggleRuleActive={(ruleId) => {
              const rule = db.rules.find((r) => r.id === ruleId);
              if (rule) {
                handleToggleRuleActive(ruleId, !rule.active);
              }
            }}
            onDeleteRule={handleDeleteRule}
            onNavigateToExportImport={() => handleTabChange('export-import')}
            onNavigateToRuleManager={() => handleTabChange('rule-manager')}
            isAdmin={isAdmin}
            onOpenAdminLogin={handleOpenAdminLogin}
          />
        )}

        {/* Menu Tab: Ekspor & Impor Data */}
        {activeTab === 'export-import' && (
          <ExportImportView
            db={db}
            onExportJson={handleExportJson}
            onImportJson={handleImportJson}
            onUpdateDb={(updater) => {
              if (!isAdmin) {
                setIsAdminModalOpen(true);
                return;
              }
              const updated = updater(db);
              saveDatabase(updated);
            }}
            onBackToDatabase={() => handleTabChange('database')}
            onNavigateToSchedule={() => handleTabChange('studio')}
          />
        )}
      </main>

      {/* Rule Creator / Editor Modal with dynamic Exceptions */}
      <RuleModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingRule(null);
          setSlotPrefill(undefined);
        }}
        onSave={handleSaveRule}
        onDelete={(ruleId) => {
          handleDeleteRule(ruleId);
          setIsModalOpen(false);
          setEditingRule(null);
        }}
        db={db}
        editingRule={editingRule}
        prefill={slotPrefill}
      />

      {/* Admin Password Authentication Modal */}
      <AdminLoginModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onSuccess={handleAdminSuccess}
      />
    </div>
  );
}
