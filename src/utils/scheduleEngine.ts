import {
  DatabaseState,
  ScheduleRule,
  ScheduleConflict,
  ScheduleCell,
  DayOfWeek,
  Period,
  Session,
  RuleException,
  ResolvedSlot
} from '../types';

export type { ResolvedSlot };

export function computeResolvedSlots(rules: ScheduleRule[]): ResolvedSlot[] {
  const slots: ResolvedSlot[] = [];
  if (!Array.isArray(rules)) return slots;

  for (const rule of rules) {
    if (!rule || !rule.active) continue;

    // Resolve days safely
    const rawDays = rule.daysOfWeek || rule.days_of_week;
    const daysToSchedule: DayOfWeek[] = (Array.isArray(rawDays) && rawDays.length > 0)
      ? (rawDays as DayOfWeek[])
      : [(rule.dayOfWeek || rule.day_of_week || 'Monday') as DayOfWeek];

    // Resolve periodIds safely (handling periodIds array, period_ids array, or json string)
    let periodIds: string[] = [];
    const rawPids: unknown = (rule as any).periodIds !== undefined ? (rule as any).periodIds : (rule as any).period_ids;
    if (Array.isArray(rawPids)) {
      periodIds = rawPids.map(String).filter(Boolean);
    } else if (typeof rawPids === 'string') {
      try {
        const parsed = JSON.parse(rawPids);
        if (Array.isArray(parsed)) periodIds = parsed.map(String).filter(Boolean);
        else if (rawPids.trim()) periodIds = [rawPids.trim()];
      } catch {
        if (rawPids.trim()) periodIds = [rawPids.trim()];
      }
    }

    if (periodIds.length === 0) continue;

    const exceptions: RuleException[] = Array.isArray(rule.exceptions) ? rule.exceptions : [];
    const ruleSubjectId = rule.subjectId || rule.subject_id || '';
    const ruleClassId = rule.classId || rule.class_id || '';
    const ruleTeacherId = rule.teacherId || rule.teacher_id || '';
    const ruleRoomId = rule.roomId || rule.room_id || '';
    const ruleSessionId = rule.sessionId || rule.session_id || '';

    for (const day of daysToSchedule) {
      for (const periodId of periodIds) {
        // Check for exception on this period
        const exception = exceptions.find((e) => (e.periodId || e.period_id) === periodId);

        const effectiveSessionId = exception?.overrideSessionId || exception?.override_session_id || ruleSessionId;
        const effectiveRoomId = exception?.overrideRoomId || exception?.override_room_id || ruleRoomId;
        const effectiveTeacherId = exception?.overrideTeacherId || exception?.override_teacher_id || ruleTeacherId;

        slots.push({
          ruleId: rule.id,
          subjectId: ruleSubjectId,
          classId: ruleClassId,
          teacherId: effectiveTeacherId,
          roomId: effectiveRoomId,
          sessionId: effectiveSessionId,
          day,
          periodId: periodId,
          hasException: Boolean(exception),
          exceptionDetail: exception?.note || ((exception?.overrideSessionId || exception?.override_session_id) ? `Session overridden to ${exception?.overrideSessionId || exception?.override_session_id}` : undefined)
        });
      }
    }
  }

  return slots;
}

export function detectConflicts(db: DatabaseState): ScheduleConflict[] {
  if (!db || !Array.isArray(db.rules)) return [];
  const slots = computeResolvedSlots(db.rules);
  const conflicts: ScheduleConflict[] = [];

  const periods = Array.isArray(db.periods) ? db.periods : [];
  const sessions = Array.isArray(db.sessions) ? db.sessions : [];
  const classes = Array.isArray(db.classes) ? db.classes : [];
  const teachers = Array.isArray(db.teachers) ? db.teachers : [];
  const rooms = Array.isArray(db.rooms) ? db.rooms : [];
  const subjects = Array.isArray(db.subjects) ? db.subjects : [];

  // Group slots by Day + Period (date range) + Session (time range) to find true simultaneous bookings
  const dayPeriodSessionMap = new Map<string, ResolvedSlot[]>();

  for (const slot of slots) {
    const key = `${slot.day}_${slot.periodId}_${slot.sessionId}`;
    if (!dayPeriodSessionMap.has(key)) {
      dayPeriodSessionMap.set(key, []);
    }
    dayPeriodSessionMap.get(key)!.push(slot);
  }

  dayPeriodSessionMap.forEach((timeSlots, key) => {
    const [dayStr, periodId, sessionId] = key.split('_');
    const day = dayStr as DayOfWeek;
    const periodObj = periods.find((p) => p.id === periodId);
    const sessionObj = sessions.find((s) => s.id === sessionId);
    const periodLabel = periodObj ? `${periodObj.name} (${periodObj.startDate || periodObj.start_date} to ${periodObj.endDate || periodObj.end_date})` : periodId;
    const sessionLabel = sessionObj ? `${sessionObj.name} (${sessionObj.startTime || sessionObj.start_time}-${sessionObj.endTime || sessionObj.end_time})` : sessionId;

    // 1. Check Teacher Conflicts (Same teacher booked in > 1 class/room at the same time)
    const teacherMap = new Map<string, ResolvedSlot[]>();
    for (const slot of timeSlots) {
      if (!teacherMap.has(slot.teacherId)) {
        teacherMap.set(slot.teacherId, []);
      }
      teacherMap.get(slot.teacherId)!.push(slot);
    }

    teacherMap.forEach((teacherSlots, teacherId) => {
      if (teacherSlots.length > 1) {
        const teacher = teachers.find((t) => t.id === teacherId);
        const teacherName = teacher?.name || 'Unknown Teacher';
        const classNames = teacherSlots
          .map((s) => classes.find((c) => c.id === s.classId)?.name || 'Class')
          .join(' and ');

        conflicts.push({
          id: `conflict-tch-${teacherId}-${key}`,
          type: 'teacher',
          title: `Teacher Double-Booking: ${teacherName}`,
          description: `${teacherName} is assigned to ${teacherSlots.length} classes (${classNames}) simultaneously on ${day} during ${sessionLabel} in ${periodLabel}.`,
          day,
          periodId,
          sessionId,
          involvedRuleIds: teacherSlots.map((s) => s.ruleId),
          severity: 'critical'
        });
      }
    });

    // 2. Check Class Conflicts (Same class scheduled for > 1 subject/room at the same time)
    const classMap = new Map<string, ResolvedSlot[]>();
    for (const slot of timeSlots) {
      if (!classMap.has(slot.classId)) {
        classMap.set(slot.classId, []);
      }
      classMap.get(slot.classId)!.push(slot);
    }

    classMap.forEach((classSlots, classId) => {
      if (classSlots.length > 1) {
        const cls = classes.find((c) => c.id === classId);
        const className = cls?.name || 'Unknown Class';
        const subjectNames = classSlots
          .map((s) => subjects.find((sub) => sub.id === s.subjectId)?.name || 'Subject')
          .join(' and ');

        conflicts.push({
          id: `conflict-cls-${classId}-${key}`,
          type: 'class',
          title: `Class Overlap: ${className}`,
          description: `${className} has multiple subjects (${subjectNames}) scheduled concurrently on ${day} during ${sessionLabel} in ${periodLabel}.`,
          day,
          periodId,
          sessionId,
          involvedRuleIds: classSlots.map((s) => s.ruleId),
          severity: 'critical'
        });
      }
    });

    // 3. Check Room Conflicts (Same room booked for > 1 class/teacher at the same time)
    const roomMap = new Map<string, ResolvedSlot[]>();
    for (const slot of timeSlots) {
      if (!roomMap.has(slot.roomId)) {
        roomMap.set(slot.roomId, []);
      }
      roomMap.get(slot.roomId)!.push(slot);
    }

    roomMap.forEach((roomSlots, roomId) => {
      if (roomSlots.length > 1) {
        const room = rooms.find((r) => r.id === roomId);
        const roomName = room?.name || 'Unknown Room';
        const classNames = roomSlots
          .map((s) => classes.find((c) => c.id === s.classId)?.name || 'Class')
          .join(' and ');

        conflicts.push({
          id: `conflict-rm-${roomId}-${key}`,
          type: 'room',
          title: `Room Collision: ${roomName}`,
          description: `${roomName} is double-booked for classes: ${classNames} on ${day} during ${sessionLabel} in ${periodLabel}.`,
          day,
          periodId,
          sessionId,
          involvedRuleIds: roomSlots.map((s) => s.ruleId),
          severity: 'critical'
        });
      }
    });
  });

  return conflicts;
}

export function buildScheduleMatrix(
  db: DatabaseState,
  filterType: 'all' | 'class' | 'teacher' | 'room',
  filterId: string,
  allConflicts: ScheduleConflict[],
  selectedPeriodId?: string
): {
  days: DayOfWeek[];
  sortedSessions: Session[];
  periods: Period[];
  matrix: Map<string, ScheduleCell>;
} {
  const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const rawSessions = Array.isArray(db?.sessions) ? db.sessions : [];
  const rawPeriods = Array.isArray(db?.periods) ? db.periods : [];
  const rawRules = Array.isArray(db?.rules) ? db.rules : [];

  const sortedSessions = [...rawSessions].sort(
    (a, b) => (a.order ?? a.sort_order ?? 0) - (b.order ?? b.sort_order ?? 0)
  );
  const periods = [...rawPeriods].sort(
    (a, b) => (a.periodNumber ?? a.period_number ?? 0) - (b.periodNumber ?? b.period_number ?? 0)
  );

  const resolvedSlots = computeResolvedSlots(rawRules);

  // Filter slots if a filter is active
  const filteredSlots = resolvedSlots.filter((slot) => {
    if (selectedPeriodId && selectedPeriodId !== 'all' && slot.periodId !== selectedPeriodId) {
      return false;
    }
    if (filterType === 'class' && filterId && filterId !== 'all') return slot.classId === filterId;
    if (filterType === 'teacher' && filterId && filterId !== 'all') return slot.teacherId === filterId;
    if (filterType === 'room' && filterId && filterId !== 'all') return slot.roomId === filterId;
    return true;
  });

  const matrix = new Map<string, ScheduleCell>();

  // Initialize every day + session cell
  for (const day of days) {
    for (const session of sortedSessions) {
      const cellKey = `${day}_${session.id}`;

      // Find slots matching this cell
      const matchingSlots = filteredSlots.filter(
        (s) => s.day === day && s.sessionId === session.id
      );

      // Find conflicts for this day and session
      const matchingConflicts = allConflicts.filter(
        (c) =>
          c.day === day &&
          c.sessionId === session.id &&
          (!selectedPeriodId || selectedPeriodId === 'all' || c.periodId === selectedPeriodId)
      );

      if (matchingSlots.length > 0) {
        const primarySlot = matchingSlots[0];
        matrix.set(cellKey, {
          day,
          periodId: primarySlot.periodId,
          sessionId: session.id,
          isFilled: true,
          ruleId: primarySlot.ruleId,
          subjectId: primarySlot.subjectId,
          classId: primarySlot.classId,
          teacherId: primarySlot.teacherId,
          roomId: primarySlot.roomId,
          hasException: primarySlot.hasException,
          exceptionDetail: primarySlot.exceptionDetail,
          conflicts: matchingConflicts,
          slots: matchingSlots
        });
      } else {
        matrix.set(cellKey, {
          day,
          periodId: selectedPeriodId && selectedPeriodId !== 'all' ? selectedPeriodId : (periods[0]?.id || 'prd-1'),
          sessionId: session.id,
          isFilled: false,
          conflicts: matchingConflicts,
          slots: []
        });
      }
    }
  }

  return { days, sortedSessions, periods, matrix };
}
