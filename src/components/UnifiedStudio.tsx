import React, { useState, useMemo, useEffect } from 'react';
import {
  DatabaseState,
  ScheduleConflict,
  ScheduleRule,
  DayOfWeek
} from '../types';
import { CalendarView, ScheduleViewMode } from './CalendarView';
import { RulesManager } from './RulesManager';
import { ViewerRole } from './JournalView';

interface UnifiedStudioProps {
  db: DatabaseState;
  onUpdateDb?: React.Dispatch<React.SetStateAction<DatabaseState>>;
  conflicts: ScheduleConflict[];
  showRules: boolean;
  onToggleRules: (show: boolean) => void;
  onOpenNewRule: (prefillSubjectId?: string) => void;
  onOpenNewRuleForSlot: (day: DayOfWeek, periodId: string, sessionId: string, classId?: string) => void;
  onEditRule: (rule: ScheduleRule) => void;
  onDuplicateRule: (rule: ScheduleRule) => void;
  onDeleteRule: (ruleId: string) => void;
  onToggleRuleActive: (ruleId: string, active: boolean) => void;
  onToggleSubjectRulesActive: (subjectId: string, active: boolean) => void;
  onViewConflict: (conflict: ScheduleConflict) => void;
  isAdmin: boolean;
  onOpenAdminLogin: () => void;
  viewerRole?: ViewerRole;
  viewerId?: string;
  onViewerChange?: (role: ViewerRole, id: string) => void;
}

export const UnifiedStudio: React.FC<UnifiedStudioProps> = ({
  db,
  onUpdateDb,
  conflicts,
  showRules,
  onToggleRules,
  onOpenNewRule,
  onOpenNewRuleForSlot,
  onEditRule,
  onDuplicateRule,
  onDeleteRule,
  onToggleRuleActive,
  onToggleSubjectRulesActive,
  onViewConflict,
  isAdmin,
  onOpenAdminLogin,
  viewerRole = 'student',
  viewerId,
  onViewerChange
}) => {
  // Retain view mode persistently across rule panel toggles and sync with viewerRole
  const [activeCalendarView, setActiveCalendarView] = useState<ScheduleViewMode>(
    viewerRole === 'teacher' ? ScheduleViewMode.TEACHER_WEEK : ScheduleViewMode.STUDENT_WEEK
  );
  const [selectedClassId, setSelectedClassId] = useState<string>(
    viewerRole === 'student' && viewerId
      ? viewerId
      : db.classes.length > 0 ? db.classes[0].id : ''
  );
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(
    viewerRole === 'teacher' && viewerId
      ? viewerId
      : db.teachers.length > 0 ? db.teachers[0].id : ''
  );

  // Synchronize when viewerRole or viewerId changes from parent (e.g. Home tab or URL)
  useEffect(() => {
    if (viewerRole === 'student') {
      setActiveCalendarView(ScheduleViewMode.STUDENT_WEEK);
      if (viewerId && db.classes.some((c) => c.id === viewerId)) {
        setSelectedClassId(viewerId);
      }
    } else if (viewerRole === 'teacher') {
      setActiveCalendarView(ScheduleViewMode.TEACHER_WEEK);
      if (viewerId && db.teachers.some((t) => t.id === viewerId)) {
        setSelectedTeacherId(viewerId);
      }
    }
  }, [viewerRole, viewerId, db.classes, db.teachers]);

  const sortedPeriods = useMemo(
    () => [...db.periods].sort((a, b) => (a.periodNumber ?? 0) - (b.periodNumber ?? 0)),
    [db.periods]
  );
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(sortedPeriods.length > 0 ? sortedPeriods[0].id : 'prd-1');

  const handleSelectClass = (clsId: string) => {
    setSelectedClassId(clsId);
    onViewerChange?.('student', clsId);
  };

  const handleSelectTeacher = (tchId: string) => {
    setSelectedTeacherId(tchId);
    onViewerChange?.('teacher', tchId);
  };

  const handleViewModeChange = (mode: ScheduleViewMode) => {
    setActiveCalendarView(mode);
    if (mode === ScheduleViewMode.STUDENT_WEEK) {
      const clsId = selectedClassId || (db.classes[0]?.id || '');
      onViewerChange?.('student', clsId);
    } else if (mode === ScheduleViewMode.TEACHER_WEEK) {
      const tchId = selectedTeacherId || (db.teachers[0]?.id || '');
      onViewerChange?.('teacher', tchId);
    }
  };

  return (
    <div className="space-y-4">
      {/* Main Content: Single persistent CalendarView container to prevent remounting and state reset */}
      <div className={showRules ? 'grid grid-cols-1 xl:grid-cols-12 gap-5 items-start' : 'w-full'}>
        {/* Calendar View (Full width or 7 cols when rules open) */}
        <div className={showRules ? 'xl:col-span-7 space-y-4' : 'w-full space-y-4'}>
          <CalendarView
            db={db}
            onUpdateDb={onUpdateDb}
            conflicts={conflicts}
            activeViewMode={activeCalendarView}
            onViewModeChange={handleViewModeChange}
            selectedClassId={selectedClassId}
            onSelectClassId={handleSelectClass}
            selectedTeacherId={selectedTeacherId}
            onSelectTeacherId={handleSelectTeacher}
            selectedPeriodId={selectedPeriodId}
            onSelectPeriodId={setSelectedPeriodId}
            onOpenNewRuleForSlot={(day, periodId, sessionId, classId) => {
              if (!isAdmin) {
                onOpenAdminLogin();
                return;
              }
              onOpenNewRuleForSlot(day, periodId, sessionId, classId);
            }}
            onEditRule={(rule) => {
              if (!isAdmin) {
                onOpenAdminLogin();
                return;
              }
              onEditRule(rule);
            }}
            onViewConflict={onViewConflict}
            compact={showRules}
            isAdmin={isAdmin}
            onOpenAdminLogin={onOpenAdminLogin}
            showRules={showRules}
            onToggleRules={onToggleRules}
          />
        </div>

        {/* Rules Manager (5 cols, only rendered when showRules is true) */}
        {showRules && (
          <div className="xl:col-span-5 space-y-4 animate-in fade-in duration-200">
            <RulesManager
              db={db}
              conflicts={conflicts}
              onOpenNewRule={(prefillSubjectId) => {
                if (!isAdmin) {
                  onOpenAdminLogin();
                  return;
                }
                onOpenNewRule(prefillSubjectId);
              }}
              onEditRule={(rule) => {
                if (!isAdmin) {
                  onOpenAdminLogin();
                  return;
                }
                onEditRule(rule);
              }}
              onDuplicateRule={(rule) => {
                if (!isAdmin) {
                  onOpenAdminLogin();
                  return;
                }
                onDuplicateRule(rule);
              }}
              onDeleteRule={(ruleId) => {
                if (!isAdmin) {
                  onOpenAdminLogin();
                  return;
                }
                onDeleteRule(ruleId);
              }}
              onToggleRuleActive={(ruleId, active) => {
                if (!isAdmin) {
                  onOpenAdminLogin();
                  return;
                }
                onToggleRuleActive(ruleId, active);
              }}
              onToggleSubjectRulesActive={(subjectId, active) => {
                if (!isAdmin) {
                  onOpenAdminLogin();
                  return;
                }
                onToggleSubjectRulesActive(subjectId, active);
              }}
              isAdmin={isAdmin}
              onOpenAdminLogin={onOpenAdminLogin}
            />
          </div>
        )}
      </div>
    </div>
  );
};
