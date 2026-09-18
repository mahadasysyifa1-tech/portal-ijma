import {
  DatabaseState,
  SyllabusUnit,
  SyllabusScope,
  ScheduledSessionOccurrence,
  DayOfWeek
} from '../types';
import { getNormalizedDateRangesForRule } from './dateNormalizer';

const JS_DOW_TO_DAYOFWEEK: Record<number, DayOfWeek> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday'
};

/**
 * Unit weight calculation per specification:
 * Unit weight = eno - no + 1.
 * Never use pages for calculation — no/eno are pre-corrected and continuous across pt,
 * pages/part are display-only.
 */
export function getUnitWeight(unit: SyllabusUnit): number {
  const no = typeof unit.no === 'number' ? unit.no : parseInt(String(unit.no), 10);
  const eno = typeof unit.eno === 'number' ? unit.eno : parseInt(String(unit.eno), 10);
  const validNo = isNaN(no) ? 1 : no;
  const validEno = isNaN(eno) ? validNo : eno;
  return Math.max(1, validEno - validNo + 1);
}

/**
 * Display helper per specification:
 * Rendered as "{part}/{page_start}: {title}"
 */
export function formatUnitDisplay(unit: SyllabusUnit): string {
  const part = unit.part !== undefined && unit.part !== null ? String(unit.part).trim() : '';
  const pageStart = unit.page_start !== undefined && unit.page_start !== null ? String(unit.page_start).trim() : '';
  const title = unit.title || 'Untitled Material';
  
  if (part) {
    return `${part}/${pageStart}: ${title}`;
  }
  return `${pageStart}: ${title}`;
}

/**
 * Retrieves the scoped syllabus units for a given (subject, class-section).
 * - Full syllabus ordered by order.
 * - Sliced by SyllabusScope if present; no row = default to full syllabus.
 */
export function getScopedUnits(
  db: DatabaseState,
  subject_id: string,
  class_section_id: string
): SyllabusUnit[] {
  const allUnits = Array.isArray(db.syllabusUnits) ? db.syllabusUnits : [];
  
  // Filter by subject_id and sort by order ascending (as specified: "Sort by mapel_n per mapel_id to assign order — don't trust file row order")
  const subjectUnits = allUnits
    .filter((u) => u.subject_id === subject_id)
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (subjectUnits.length === 0) {
    return [];
  }

  // Look for SyllabusScope override
  const scopes = Array.isArray(db.syllabusScopes) ? db.syllabusScopes : [];
  const scope = scopes.find(
    (s) => s.subject_id === subject_id && s.class_section_id === class_section_id
  );

  if (!scope || (!scope.start_unit_id && !scope.end_unit_id)) {
    return subjectUnits;
  }

  let startIndex = 0;
  let endIndex = subjectUnits.length - 1;

  if (scope.start_unit_id) {
    const sIdx = subjectUnits.findIndex((u) => u.id === scope.start_unit_id);
    if (sIdx !== -1) startIndex = sIdx;
  }

  if (scope.end_unit_id) {
    const eIdx = subjectUnits.findIndex((u) => u.id === scope.end_unit_id);
    if (eIdx !== -1) endIndex = eIdx;
  }

  if (startIndex > endIndex) {
    // If indices are inverted, swap them
    const temp = startIndex;
    startIndex = endIndex;
    endIndex = temp;
  }

  return subjectUnits.slice(startIndex, endIndex + 1);
}

/**
 * Live query of scheduled sessions for that subject+class-section within the Rule's period dates.
 * Always computed live — never cached, so schedule changes reflect immediately.
 */
export function getScheduledSessionsForSubjectClass(
  db: DatabaseState,
  subject_id: string,
  class_section_id: string
): ScheduledSessionOccurrence[] {
  const occurrences: ScheduledSessionOccurrence[] = [];
  const sessionMap = new Map((db.sessions || []).map((s) => [s.id, s]));

  const activeRules = (db.rules || []).filter(
    (r) =>
      r.active !== false &&
      (r.subjectId === subject_id || (r as any).subject_id === subject_id) &&
      (r.classId === class_section_id || (r as any).class_id === class_section_id)
  );

  const seenOccurrenceKeys = new Set<string>();

  for (const rule of activeRules) {
    // Resolve scheduled days
    const rawDays = rule.daysOfWeek || (rule as any).days_of_week;
    const ruleDays: DayOfWeek[] =
      Array.isArray(rawDays) && rawDays.length > 0
        ? (rawDays as DayOfWeek[])
        : [(rule.dayOfWeek || (rule as any).day_of_week || 'Monday') as DayOfWeek];

    // Compute normalized date ranges for rule (merges overlapping presets)
    const normalizedRanges = getNormalizedDateRangesForRule(rule, db.periods || []);
    const ruleSessionId = rule.sessionId || (rule as any).session_id || '';
    const sessionObj = sessionMap.get(ruleSessionId);
    const ruleTeacherId = rule.teacherId || (rule as any).teacher_id || '';
    const ruleRoomId = rule.roomId || (rule as any).room_id || '';

    for (const range of normalizedRanges) {
      const start = new Date(range.startDate);
      const end = new Date(range.endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) continue;

      const curr = new Date(start);
      while (curr <= end) {
        const jsDay = curr.getDay(); // 0 = Sun, 1 = Mon, ...
        const dow = JS_DOW_TO_DAYOFWEEK[jsDay];

        if (dow && ruleDays.includes(dow)) {
          const year = curr.getFullYear();
          const month = String(curr.getMonth() + 1).padStart(2, '0');
          const day = String(curr.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;

          const occurrenceKey = `${dateStr}_${ruleSessionId}_${rule.id}`;
          if (!seenOccurrenceKeys.has(occurrenceKey)) {
            seenOccurrenceKeys.add(occurrenceKey);

            // Optional informational matching period
            const matchingPeriod = (db.periods || []).find(
              (p) => (p.startDate || (p as any).start_date || '') <= dateStr && dateStr <= (p.endDate || (p as any).end_date || '')
            );

            occurrences.push({
              id: occurrenceKey,
              date: dateStr,
              day: dow,
              sessionId: ruleSessionId,
              sessionName: sessionObj?.name || ruleSessionId,
              startTime: sessionObj?.startTime || (sessionObj as any)?.start_time || '08:00',
              endTime: sessionObj?.endTime || (sessionObj as any)?.end_time || '10:00',
              ruleId: rule.id,
              subjectId: subject_id,
              classId: class_section_id,
              teacherId: ruleTeacherId,
              roomId: ruleRoomId,
              periodId: matchingPeriod?.id || (rule.periodIds?.[0] || ''),
              meetingIndex: 0 // populated after sorting
            });
          }
        }
        curr.setDate(curr.getDate() + 1);
      }
    }
  }

  // Sort chronological by date, then by session start time
  occurrences.sort((a, b) => {
    const dComp = a.date.localeCompare(b.date);
    if (dComp !== 0) return dComp;
    return a.startTime.localeCompare(b.startTime);
  });

  // Assign 1-based meeting indices
  occurrences.forEach((occ, idx) => {
    occ.meetingIndex = idx + 1;
  });

  return occurrences;
}

/**
 * Proportional pacing engine:
 * Spread unit weights proportionally across sessions.
 * Returns array of { session: ScheduledSessionOccurrence, units: SyllabusUnit[] }
 */
export function computePacingProjection(
  db: DatabaseState,
  subject_id: string,
  class_section_id: string
): Array<{
  session: ScheduledSessionOccurrence;
  units: SyllabusUnit[];
  startWeightProgress: number;
  endWeightProgress: number;
}> {
  const units = getScopedUnits(db, subject_id, class_section_id);
  const sessions = getScheduledSessionsForSubjectClass(db, subject_id, class_section_id);

  if (sessions.length === 0) {
    return [];
  }

  if (units.length === 0) {
    return sessions.map((session) => ({
      session,
      units: [],
      startWeightProgress: 0,
      endWeightProgress: 0
    }));
  }

  // Compute unit weights and cumulative intervals
  const unitWeights = units.map(getUnitWeight);
  const totalWeight = unitWeights.reduce((acc, w) => acc + w, 0);

  // Cumulative positions for units: [C_k, C_{k+1}]
  const unitCumulative: Array<{ start: number; end: number; unit: SyllabusUnit }> = [];
  let currentCum = 0;
  for (let i = 0; i < units.length; i++) {
    const w = unitWeights[i];
    unitCumulative.push({
      start: currentCum,
      end: currentCum + w,
      unit: units[i]
    });
    currentCum += w;
  }

  const numSessions = sessions.length;
  const weightPerSession = totalWeight / numSessions;
  const EPSILON = 1e-6;

  return sessions.map((session, i) => {
    const sessionStart = i * weightPerSession;
    const sessionEnd = (i + 1) * weightPerSession;

    // A unit overlaps with session if interval [unit.start, unit.end] intersects [sessionStart, sessionEnd]
    const assignedUnits = unitCumulative
      .filter((uc) => {
        return uc.start < sessionEnd - EPSILON && uc.end > sessionStart + EPSILON;
      })
      .map((uc) => uc.unit);

    // Fallback: If discrete floating gap yields empty set, assign closest unit
    if (assignedUnits.length === 0) {
      const sessionMid = (sessionStart + sessionEnd) / 2;
      let closestUnit = units[0];
      let minDiff = Infinity;
      for (const uc of unitCumulative) {
        const unitMid = (uc.start + uc.end) / 2;
        const diff = Math.abs(sessionMid - unitMid);
        if (diff < minDiff) {
          minDiff = diff;
          closestUnit = uc.unit;
        }
      }
      assignedUnits.push(closestUnit);
    }

    return {
      session,
      units: assignedUnits,
      startWeightProgress: sessionStart,
      endWeightProgress: sessionEnd
    };
  });
}

/**
 * Core function per specification:
 * get_units_for_session(subject_id, class_section_id, session_id) -> list[SyllabusUnit]
 * 
 * Supports session_id as:
 * - scheduled session occurrence id (e.g. `${date}_${sessionId}_${ruleId}`)
 * - date string (`YYYY-MM-DD`)
 * - numeric meetingIndex (1, 2, ...)
 * - raw session id combined with date or first matching
 */
export function get_units_for_session(
  db: DatabaseState,
  subject_id: string,
  class_section_id: string,
  session_id: string | number
): SyllabusUnit[] {
  const projection = computePacingProjection(db, subject_id, class_section_id);
  if (projection.length === 0) return [];

  const sidStr = String(session_id).trim();

  // 1. Direct match on occurrence ID
  const directMatch = projection.find((p) => p.session.id === sidStr);
  if (directMatch) return directMatch.units;

  // 2. Match on 1-based meeting index if numeric
  const numericIndex = parseInt(sidStr, 10);
  if (!isNaN(numericIndex) && numericIndex >= 1 && numericIndex <= projection.length) {
    const idxMatch = projection.find((p) => p.session.meetingIndex === numericIndex);
    if (idxMatch) return idxMatch.units;
  }

  // 3. Match on date string (YYYY-MM-DD)
  const dateMatches = projection.filter((p) => p.session.date === sidStr);
  if (dateMatches.length === 1) return dateMatches[0].units;
  if (dateMatches.length > 1) {
    // If multiple sessions on that date, return union
    const unique = new Map<string, SyllabusUnit>();
    dateMatches.forEach((dm) => dm.units.forEach((u) => unique.set(u.id, u)));
    return Array.from(unique.values());
  }

  // 4. Partial or session slot id match (e.g. 'ses-1')
  const slotMatch = projection.find((p) => p.session.sessionId === sidStr);
  if (slotMatch) return slotMatch.units;

  // Default: empty list
  return [];
}

/**
 * Resolves all scheduled sessions across the entire school for a viewer
 * (Student Class, Teacher, or Admin) sorted chronologically.
 */
export function getViewerScheduledSessions(
  db: DatabaseState,
  viewerRole: 'student' | 'teacher' | 'admin',
  viewerId?: string
): ScheduledSessionOccurrence[] {
  const allOccurrences: ScheduledSessionOccurrence[] = [];
  const subjects = db.subjects || [];
  const classes = db.classes || [];

  for (const subject of subjects) {
    for (const cls of classes) {
      // Filter by viewer role
      if (viewerRole === 'student' && viewerId && cls.id !== viewerId) {
        continue;
      }
      
      const sessions = getScheduledSessionsForSubjectClass(db, subject.id, cls.id);
      
      if (viewerRole === 'teacher' && viewerId) {
        const teacherSessions = sessions.filter((s) => s.teacherId === viewerId);
        allOccurrences.push(...teacherSessions);
      } else {
        allOccurrences.push(...sessions);
      }
    }
  }

  // Sort chronologically
  allOccurrences.sort((a, b) => {
    const dComp = a.date.localeCompare(b.date);
    if (dComp !== 0) return dComp;
    return a.startTime.localeCompare(b.startTime);
  });

  return allOccurrences;
}

export interface ResolvedViewerClassStatus {
  currentClass: {
    occurrence: ScheduledSessionOccurrence;
    subjectName: string;
    subjectBook?: string;
    subjectColor: string;
    classColor?: string;
    className?: string;
    counterpartLabel: string;
    roomName: string;
    units: SyllabusUnit[];
    timeRemainingMinutes?: number;
  } | null;
  nextClass: {
    occurrence: ScheduledSessionOccurrence;
    subjectName: string;
    subjectBook?: string;
    subjectColor: string;
    classColor?: string;
    className?: string;
    counterpartLabel: string;
    roomName: string;
    units: SyllabusUnit[];
    isToday: boolean;
  } | null;
}

/**
 * Home tab resolution engine:
 * Resolves viewer's current class (today's date/time vs. their schedule)
 * and next class (walk forward, may be a future day).
 */
export function resolveViewerCurrentAndNextClass(
  db: DatabaseState,
  viewerRole: 'student' | 'teacher' | 'admin',
  viewerId?: string,
  referenceDate: Date = new Date()
): ResolvedViewerClassStatus {
  const occurrences = getViewerScheduledSessions(db, viewerRole, viewerId);

  const subjectMap = new Map((db.subjects || []).map((s) => [s.id, s]));
  const classMap = new Map((db.classes || []).map((c) => [c.id, c]));
  const teacherMap = new Map((db.teachers || []).map((t) => [t.id, t]));
  const roomMap = new Map((db.rooms || []).map((r) => [r.id, r]));

  const year = referenceDate.getFullYear();
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const day = String(referenceDate.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  const currentHours = String(referenceDate.getHours()).padStart(2, '0');
  const currentMins = String(referenceDate.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMins}`;

  let currentOcc: ScheduledSessionOccurrence | null = null;
  let nextOcc: ScheduledSessionOccurrence | null = null;

  // 1. Check for current class today
  for (const occ of occurrences) {
    if (occ.date === todayStr) {
      if (currentTimeStr >= occ.startTime && currentTimeStr <= occ.endTime) {
        currentOcc = occ;
        break;
      }
    }
  }

  // 2. Resolve next class (walk forward: today after current time, or future days)
  for (const occ of occurrences) {
    if (occ.date > todayStr) {
      nextOcc = occ;
      break;
    } else if (occ.date === todayStr) {
      if (occ.startTime > currentTimeStr) {
        nextOcc = occ;
        break;
      }
    }
  }

  const formatCounterpart = (occ: ScheduledSessionOccurrence): string => {
    if (viewerRole === 'student') {
      const teacher = teacherMap.get(occ.teacherId);
      return teacher?.panggilan || teacher?.name || 'Ustadz / Guru';
    } else if (viewerRole === 'teacher') {
      const cls = classMap.get(occ.classId);
      return cls?.name || 'Kelas';
    } else {
      const teacher = teacherMap.get(occ.teacherId);
      const cls = classMap.get(occ.classId);
      return `${cls?.name || 'Kelas'} • ${teacher?.panggilan || teacher?.name || 'Guru'}`;
    }
  };

  let currentResult = null;
  if (currentOcc) {
    const sub = subjectMap.get(currentOcc.subjectId);
    const room = roomMap.get(currentOcc.roomId);
    const cls = classMap.get(currentOcc.classId);
    const units = get_units_for_session(db, currentOcc.subjectId, currentOcc.classId, currentOcc.id);

    // Calculate time remaining in minutes
    const [endH, endM] = currentOcc.endTime.split(':').map(Number);
    const endMinutes = endH * 60 + endM;
    const nowMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes();
    const diff = Math.max(0, endMinutes - nowMinutes);

    currentResult = {
      occurrence: currentOcc,
      subjectName: sub?.name || 'Mata Pelajaran',
      subjectBook: sub?.book || undefined,
      subjectColor: sub?.color || '#3B82F6',
      classColor: cls?.color || undefined,
      className: cls?.name || undefined,
      counterpartLabel: formatCounterpart(currentOcc),
      roomName: room?.name || 'Ruang Kelas',
      units,
      timeRemainingMinutes: diff
    };
  }

  let nextResult = null;
  if (nextOcc) {
    const sub = subjectMap.get(nextOcc.subjectId);
    const room = roomMap.get(nextOcc.roomId);
    const cls = classMap.get(nextOcc.classId);
    const units = get_units_for_session(db, nextOcc.subjectId, nextOcc.classId, nextOcc.id);

    nextResult = {
      occurrence: nextOcc,
      subjectName: sub?.name || 'Mata Pelajaran',
      subjectBook: sub?.book || undefined,
      subjectColor: sub?.color || '#3B82F6',
      classColor: cls?.color || undefined,
      className: cls?.name || undefined,
      counterpartLabel: formatCounterpart(nextOcc),
      roomName: room?.name || 'Ruang Kelas',
      units,
      isToday: nextOcc.date === todayStr
    };
  }

  return {
    currentClass: currentResult,
    nextClass: nextResult
  };
}
