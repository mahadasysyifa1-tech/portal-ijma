import { DatabaseState, DayOfWeek, ScheduleRule } from '../types';

/**
 * Escapes a field for CSV format (RFC 4180)
 */
function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r') || str.includes('\t')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export rules starting with id column followed by all rule and entity details
 */
export function exportRulesToCsv(db: DatabaseState): string {
  const subjectMap = new Map(db.subjects.map((s) => [s.id, s.name]));
  const classMap = new Map(db.classes.map((c) => [c.id, c.name]));
  const teacherMap = new Map(db.teachers.map((t) => [t.id, t.panggilan || t.name]));
  const roomMap = new Map(db.rooms.map((r) => [r.id, r.name]));
  const sessionMap = new Map(db.sessions.map((s) => [s.id, s.name]));

  const headers = [
    'id',
    'subjectId',
    'subjectName',
    'classId',
    'className',
    'teacherId',
    'teacherName',
    'roomId',
    'roomName',
    'sessionId',
    'sessionName',
    'dayOfWeek',
    'daysOfWeek',
    'periodIds',
    'repeatDetail',
    'active',
    'notes'
  ];

  const rows = db.rules.map((rule) => {
    const rawDays = rule.daysOfWeek || (rule as any).days_of_week || [];
    const daysStr = Array.isArray(rawDays) ? rawDays.join(';') : String(rawDays);

    const rawPids = rule.periodIds || (rule as any).period_ids || [];
    const pidsStr = Array.isArray(rawPids) ? rawPids.join(';') : String(rawPids);

    const sId = rule.subjectId || (rule as any).subject_id || '';
    const cId = rule.classId || (rule as any).class_id || '';
    const tId = rule.teacherId || (rule as any).teacher_id || '';
    const rId = rule.roomId || (rule as any).room_id || '';
    const sesId = rule.sessionId || (rule as any).session_id || '';

    return [
      escapeCsvValue(rule.id),
      escapeCsvValue(sId),
      escapeCsvValue(subjectMap.get(sId) || ''),
      escapeCsvValue(cId),
      escapeCsvValue(classMap.get(cId) || ''),
      escapeCsvValue(tId),
      escapeCsvValue(teacherMap.get(tId) || ''),
      escapeCsvValue(rId),
      escapeCsvValue(roomMap.get(rId) || ''),
      escapeCsvValue(sesId),
      escapeCsvValue(sessionMap.get(sesId) || ''),
      escapeCsvValue(rule.dayOfWeek || (rule as any).day_of_week || ''),
      escapeCsvValue(daysStr),
      escapeCsvValue(pidsStr),
      escapeCsvValue(rule.repeatDetail || (rule as any).repeat_detail || 'Weekly'),
      escapeCsvValue(rule.active !== false ? 'true' : 'false'),
      escapeCsvValue(rule.notes || '')
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

const JS_DOW_TO_DAYOFWEEK: Record<number, DayOfWeek> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday'
};

/**
 * Export chip details ("evtlog") containing 2 columns: date and rulexID
 * Generates resolved chip occurrences for academic dates mapped to their parent rule ID.
 */
export function exportEvtlogToCsv(db: DatabaseState): string {
  interface EvtRow {
    date: string;
    rulexID: string;
  }

  const events: EvtRow[] = [];
  const periodMap = new Map(db.periods.map((p) => [p.id, p]));

  db.rules.forEach((rule) => {
    if (rule.active === false) return;

    // Resolve days of week
    const rawDays = rule.daysOfWeek || (rule as any).days_of_week;
    const ruleDays: DayOfWeek[] =
      Array.isArray(rawDays) && rawDays.length > 0
        ? (rawDays as DayOfWeek[])
        : [(rule.dayOfWeek || (rule as any).day_of_week || 'Monday') as DayOfWeek];

    // Resolve period IDs
    let rulePeriodIds: string[] = [];
    const rawPids = rule.periodIds || (rule as any).period_ids;
    if (Array.isArray(rawPids) && rawPids.length > 0) {
      rulePeriodIds = rawPids.map(String);
    } else if (db.periods.length > 0) {
      rulePeriodIds = db.periods.map((p) => p.id);
    }

    rulePeriodIds.forEach((pid) => {
      const period = periodMap.get(pid);
      if (!period || !period.startDate || !period.endDate) return;

      const start = new Date(period.startDate);
      const end = new Date(period.endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return;

      const curr = new Date(start);
      // Loop over dates
      while (curr <= end) {
        const jsDay = curr.getDay(); // 0 = Sun, 1 = Mon, ...
        const dow = JS_DOW_TO_DAYOFWEEK[jsDay];

        if (dow && ruleDays.includes(dow)) {
          const year = curr.getFullYear();
          const month = String(curr.getMonth() + 1).padStart(2, '0');
          const day = String(curr.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;

          events.push({
            date: dateStr,
            rulexID: rule.id
          });
        }
        curr.setDate(curr.getDate() + 1);
      }
    });
  });

  // Sort events chronologically, then by rulexID
  events.sort((a, b) => a.date.localeCompare(b.date) || a.rulexID.localeCompare(b.rulexID));

  // 2 columns: date and rulexID
  const headers = ['date', 'rulexID'];
  const rows = events.map((e) => `${escapeCsvValue(e.date)},${escapeCsvValue(e.rulexID)}`);

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Export teachers table to CSV
 */
export function exportTeachersToCsv(db: DatabaseState): string {
  const headers = ['id', 'name', 'panggilan', 'email', 'department', 'maxPeriodsPerWeek', 'color'];
  const rows = db.teachers.map((t) => [
    escapeCsvValue(t.id),
    escapeCsvValue(t.name),
    escapeCsvValue(t.panggilan || ''),
    escapeCsvValue(t.email || ''),
    escapeCsvValue(t.department || ''),
    escapeCsvValue(t.maxPeriodsPerWeek ?? t.max_periods_per_week ?? 18),
    escapeCsvValue(t.color || '#0284C7')
  ].join(','));
  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Export classes table to CSV
 */
export function exportClassesToCsv(db: DatabaseState): string {
  const roomMap = new Map(db.rooms.map((r) => [r.id, r.name]));
  const headers = ['id', 'name', 'icon', 'color', 'onlineClassLink', 'defaultRoomId', 'defaultRoomName', 'grade', 'section', 'studentCount'];
  const rows = db.classes.map((c) => [
    escapeCsvValue(c.id),
    escapeCsvValue(c.name),
    escapeCsvValue(c.icon || 'GraduationCap'),
    escapeCsvValue(c.color || '#E0E7FF'),
    escapeCsvValue(c.onlineClassLink || c.online_class_link || ''),
    escapeCsvValue(c.defaultRoomId || ''),
    escapeCsvValue(c.defaultRoomId ? roomMap.get(c.defaultRoomId) || '' : ''),
    escapeCsvValue(c.grade),
    escapeCsvValue(c.section),
    escapeCsvValue(c.studentCount)
  ].join(','));
  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Export subjects table to CSV
 */
export function exportSubjectsToCsv(db: DatabaseState): string {
  const teacherMap = new Map(db.teachers.map((t) => [t.id, t.panggilan || t.name]));
  const roomMap = new Map(db.rooms.map((r) => [r.id, r.name]));

  const headers = [
    'id',
    'name',
    'code',
    'book',
    'pdfLink',
    'shoppingLink',
    'shoppingLink2',
    'siteLink',
    'color',
    'department',
    'defaultTeacherId',
    'defaultTeacherName',
    'defaultRoomId',
    'defaultRoomName'
  ];
  const rows = db.subjects.map((s) => [
    escapeCsvValue(s.id),
    escapeCsvValue(s.name),
    escapeCsvValue(s.code),
    escapeCsvValue(s.book || ''),
    escapeCsvValue(s.pdfLink || s.links?.pdf || ''),
    escapeCsvValue(s.shoppingLink || s.links?.shopping || ''),
    escapeCsvValue(s.shoppingLink2 || s.links?.shopping2 || ''),
    escapeCsvValue(s.siteLink || s.links?.site || ''),
    escapeCsvValue(s.color || '#3B82F6'),
    escapeCsvValue(s.department || ''),
    escapeCsvValue(s.defaultTeacherId || ''),
    escapeCsvValue(s.defaultTeacherId ? teacherMap.get(s.defaultTeacherId) || '' : ''),
    escapeCsvValue(s.defaultRoomId || ''),
    escapeCsvValue(s.defaultRoomId ? roomMap.get(s.defaultRoomId) || '' : '')
  ].join(','));
  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Export rooms table to CSV
 */
export function exportRoomsToCsv(db: DatabaseState): string {
  const headers = ['id', 'name', 'building', 'capacity', 'type'];
  const rows = db.rooms.map((r) => [
    escapeCsvValue(r.id),
    escapeCsvValue(r.name),
    escapeCsvValue(r.building || ''),
    escapeCsvValue(r.capacity),
    escapeCsvValue(r.type || '')
  ].join(','));
  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Export sessions table to CSV
 */
export function exportSessionsToCsv(db: DatabaseState): string {
  const headers = ['id', 'name', 'order', 'startTime', 'endTime'];
  const rows = db.sessions.map((s) => [
    escapeCsvValue(s.id),
    escapeCsvValue(s.name),
    escapeCsvValue(s.order),
    escapeCsvValue(s.startTime),
    escapeCsvValue(s.endTime)
  ].join(','));
  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Export periods table to CSV
 */
export function exportPeriodsToCsv(db: DatabaseState): string {
  const headers = ['id', 'name', 'periodNumber', 'startDate', 'endDate', 'description'];
  const rows = db.periods.map((p) => [
    escapeCsvValue(p.id),
    escapeCsvValue(p.name),
    escapeCsvValue(p.periodNumber),
    escapeCsvValue(p.startDate),
    escapeCsvValue(p.endDate),
    escapeCsvValue(p.description || '')
  ].join(','));
  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Triggers a browser download of CSV text
 */
export function downloadCsvFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
