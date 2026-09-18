import {
  DatabaseState,
  ScheduleRule,
  RuleException,
  Period,
  Session,
  Subject,
  ClassEntity,
  Teacher,
  Room,
  DayOfWeek,
  SyllabusUnit,
  SyllabusScope,
  KaldikEvent
} from '../types';

export function normalizeKaldikEvent(raw: any): KaldikEvent {
  if (!raw || typeof raw !== 'object') {
    return {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: 'Event Baru',
      type: 'general',
      isAllDay: true,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      color: '#6366F1'
    };
  }

  const startDate = String(raw.startDate || raw.start_date || new Date().toISOString().slice(0, 10));
  const endDate = String(raw.endDate || raw.end_date || startDate);

  return {
    id: String(raw.id || `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`),
    title: String(raw.title || 'Event Baru'),
    isKbm: Boolean(raw.isKbm || raw.is_kbm || raw.type === 'kbm'),
    type: (raw.type as any) || (raw.isKbm ? 'kbm' : 'general'),
    isAllDay: raw.isAllDay !== undefined ? Boolean(raw.isAllDay) : true,
    startDate,
    endDate,
    startTime: raw.startTime || raw.start_time || undefined,
    endTime: raw.endTime || raw.end_time || undefined,
    isRecurring: Boolean(raw.isRecurring || raw.is_recurring),
    daysOfWeek: Array.isArray(raw.daysOfWeek || raw.days_of_week) ? (raw.daysOfWeek || raw.days_of_week) : undefined,
    repeatDetail: raw.repeatDetail || raw.repeat_detail || undefined,
    periodId: raw.periodId || raw.period_id || undefined,
    color: raw.color || (raw.isKbm ? '#F59E0B' : '#6366F1'),
    description: raw.description || undefined,
    createdAt: raw.createdAt || raw.created_at || undefined
  };
}

export function normalizeRule(raw: any, availablePeriods: Period[] = []): ScheduleRule {
  if (!raw || typeof raw !== 'object') {
    return {
      id: `rule-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      subjectId: '',
      classId: '',
      teacherId: '',
      roomId: '',
      sessionId: '',
      dayOfWeek: 'Monday',
      daysOfWeek: ['Monday'],
      periodIds: availablePeriods.length > 0 ? [availablePeriods[0].id] : ['prd-1'],
      repeatDetail: 'Weekly',
      active: true,
      exceptions: [],
      notes: ''
    };
  }

  // 1. Resolve Period IDs (periodIds, period_ids, or JSON string)
  let periodIds: string[] = [];
  const rawPids = raw.periodIds !== undefined ? raw.periodIds : raw.period_ids;
  if (Array.isArray(rawPids)) {
    periodIds = rawPids.map(String).filter(Boolean);
  } else if (typeof rawPids === 'string') {
    try {
      const parsed = JSON.parse(rawPids);
      if (Array.isArray(parsed)) {
        periodIds = parsed.map(String).filter(Boolean);
      } else if (rawPids.trim()) {
        periodIds = [rawPids.trim()];
      }
    } catch {
      if (rawPids.trim()) {
        periodIds = [rawPids.trim()];
      }
    }
  }

  if (availablePeriods.length > 0) {
    const validPeriodIds = new Set(availablePeriods.map(p => p.id));
    const filteredPids = periodIds.filter(id => validPeriodIds.has(id));
    if (filteredPids.length > 0) {
      periodIds = filteredPids;
    } else {
      periodIds = [availablePeriods[0].id];
    }
    // Always sort periodIds according to availablePeriods order/periodNumber
    const periodOrderMap = new Map(availablePeriods.map((p, idx) => [p.id, p.periodNumber ?? idx]));
    periodIds.sort((a, b) => (periodOrderMap.get(a) ?? 999) - (periodOrderMap.get(b) ?? 999));
  }

  if (periodIds.length === 0) {
    if (availablePeriods.length > 0) {
      periodIds = [availablePeriods[0].id];
    } else {
      periodIds = ['prd-1'];
    }
  }

  // 2. Resolve Days
  let daysOfWeek: DayOfWeek[] = [];
  const rawDays = raw.daysOfWeek !== undefined ? raw.daysOfWeek : raw.days_of_week;
  if (Array.isArray(rawDays)) {
    daysOfWeek = rawDays.map(String) as DayOfWeek[];
  } else if (typeof rawDays === 'string') {
    try {
      const parsed = JSON.parse(rawDays);
      if (Array.isArray(parsed)) {
        daysOfWeek = parsed.map(String) as DayOfWeek[];
      } else if (rawDays.trim()) {
        daysOfWeek = [rawDays.trim() as DayOfWeek];
      }
    } catch {
      if (rawDays.trim()) {
        daysOfWeek = [rawDays.trim() as DayOfWeek];
      }
    }
  }

  const singleDay = (raw.dayOfWeek || raw.day_of_week || (daysOfWeek[0] || 'Monday')) as DayOfWeek;
  if (daysOfWeek.length === 0) {
    daysOfWeek = [singleDay];
  }

  // 3. Resolve Exceptions
  const rawExceptions = Array.isArray(raw.exceptions) ? raw.exceptions : [];
  const exceptions: RuleException[] = rawExceptions.map((e: any, idx: number) => ({
    id: String(e.id || `exc-${raw.id || 'rule'}-${idx}`),
    ruleId: String(e.ruleId || e.rule_id || raw.id || ''),
    periodId: String(e.periodId || e.period_id || (periodIds[0] || '')),
    overrideSessionId: e.overrideSessionId || e.override_session_id || undefined,
    overrideRoomId: e.overrideRoomId || e.override_room_id || undefined,
    overrideTeacherId: e.overrideTeacherId || e.override_teacher_id || undefined,
    note: e.note || e.notes || undefined,
    period_id: String(e.periodId || e.period_id || (periodIds[0] || '')),
    override_session_id: e.overrideSessionId || e.override_session_id || undefined,
    override_room_id: e.overrideRoomId || e.override_room_id || undefined,
    override_teacher_id: e.overrideTeacherId || e.override_teacher_id || undefined
  }));

  const ruleId = String(raw.id || `rule-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);
  const subjectId = String(raw.subjectId || raw.subject_id || '');
  const classId = String(raw.classId || raw.class_id || '');
  const teacherId = String(raw.teacherId || raw.teacher_id || '');
  const roomId = String(raw.roomId || raw.room_id || '');
  const sessionId = String(raw.sessionId || raw.session_id || '');
  const repeatDetail = raw.repeatDetail || raw.repeat_detail || 'Weekly';
  const active = raw.active !== undefined ? (raw.active === 1 || raw.active === true || raw.active === '1') : true;
  const notes = raw.notes || '';
  const dateRanges = Array.isArray(raw.dateRanges) ? raw.dateRanges : undefined;

  return {
    id: ruleId,
    subjectId,
    classId,
    teacherId,
    roomId,
    sessionId,
    dayOfWeek: singleDay,
    daysOfWeek,
    periodIds,
    dateRanges,
    repeatDetail,
    active,
    exceptions: [],
    notes,
    createdAt: raw.createdAt || raw.created_at || undefined,

    // Dual properties for 100% interoperability with Python / SQLite / JSON
    subject_id: subjectId,
    class_id: classId,
    teacher_id: teacherId,
    room_id: roomId,
    session_id: sessionId,
    day_of_week: singleDay,
    days_of_week: daysOfWeek,
    period_ids: periodIds,
    repeat_detail: repeatDetail
  };
}

export function normalizeDatabaseState(raw: any): DatabaseState {
  if (!raw || typeof raw !== 'object') {
    return {
      subjects: [],
      classes: [],
      rooms: [],
      teachers: [],
      sessions: [],
      periods: [],
      rules: []
    };
  }

  const periods: Period[] = (Array.isArray(raw.periods) ? raw.periods : [])
    .slice()
    .sort((a: any, b: any) => Number(a.periodNumber ?? a.period_number ?? 0) - Number(b.periodNumber ?? b.period_number ?? 0))
    .map((p: any, idx: number) => ({
      id: String(p.id || `prd-${idx + 1}`),
      name: String(p.name || `Period ${idx + 1}`),
      periodNumber: idx + 1,
      startDate: String(p.startDate || p.start_date || '2026-09-01'),
      endDate: String(p.endDate || p.end_date || '2026-09-30'),
      description: p.description || '',
      period_number: idx + 1,
      start_date: String(p.startDate || p.start_date || '2026-09-01'),
      end_date: String(p.endDate || p.end_date || '2026-09-30')
    }));

  const sessions: Session[] = (Array.isArray(raw.sessions) ? raw.sessions : [])
    .slice()
    .sort((a: any, b: any) => Number(a.order ?? a.sort_order ?? 0) - Number(b.order ?? b.sort_order ?? 0))
    .map((s: any, idx: number) => ({
      id: String(s.id || `ses-${idx + 1}`),
      name: String(s.name || `Session ${idx + 1}`),
      order: idx + 1,
      startTime: String(s.startTime || s.start_time || '08:00'),
      endTime: String(s.endTime || s.end_time || '10:00'),
      sort_order: idx + 1,
      start_time: String(s.startTime || s.start_time || '08:00'),
      end_time: String(s.endTime || s.end_time || '10:00')
    }));

  const subjects: Subject[] = (Array.isArray(raw.subjects) ? raw.subjects : []).map((s: any, idx: number) => {
    const rawLinks = s.links && typeof s.links === 'object' ? s.links : {};
    const pdf = s.pdfLink || s.pdf_link || rawLinks.pdf || undefined;
    const shopping = s.shoppingLink || s.shopping_link || rawLinks.shopping || undefined;
    const shopping2 = s.shoppingLink2 || s.shopping_link_2 || rawLinks.shopping2 || undefined;
    const site = s.siteLink || s.site_link || rawLinks.site || undefined;

    return {
      id: String(s.id || `sub-${idx + 1}`),
      code: String(s.code || `SUB${idx + 1}`),
      name: String(s.name || 'Subject'),
      color: String(s.color || '#4F46E5'),
      department: String(s.department || 'General'),
      defaultTeacherId: s.defaultTeacherId || s.default_teacher_id || undefined,
      defaultRoomId: s.defaultRoomId || s.default_room_id || undefined,
      default_teacher_id: s.defaultTeacherId || s.default_teacher_id || null,
      default_room_id: s.defaultRoomId || s.default_room_id || null,
      book: s.book ? String(s.book) : undefined,
      links: {
        pdf,
        shopping,
        shopping2,
        site,
        ...rawLinks
      },
      pdfLink: pdf,
      shoppingLink: shopping,
      shoppingLink2: shopping2,
      siteLink: site
    };
  });

  const classes: ClassEntity[] = (Array.isArray(raw.classes) ? raw.classes : []).map((c: any, idx: number) => ({
    id: String(c.id || `cls-${idx + 1}`),
    name: String(c.name || `Class ${idx + 1}`),
    grade: Number(c.grade ?? 1),
    section: String(c.section || 'A'),
    studentCount: Number(c.studentCount ?? c.student_count ?? 30),
    student_count: Number(c.studentCount ?? c.student_count ?? 30),
    icon: c.icon ? String(c.icon) : undefined,
    color: c.color ? String(c.color) : undefined,
    onlineClassLink: c.onlineClassLink || c.online_class_link || undefined,
    online_class_link: c.onlineClassLink || c.online_class_link || undefined,
    defaultRoomId: c.defaultRoomId || c.default_room_id || undefined,
    default_room_id: c.defaultRoomId || c.default_room_id || null
  }));

  const teachers: Teacher[] = (Array.isArray(raw.teachers) ? raw.teachers : []).map((t: any, idx: number) => ({
    id: String(t.id || `tch-${idx + 1}`),
    name: String(t.name || 'Teacher'),
    panggilan: t.panggilan ? String(t.panggilan) : undefined,
    email: String(t.email || ''),
    department: String(t.department || 'General'),
    maxPeriodsPerWeek: Number(t.maxPeriodsPerWeek ?? t.max_periods_per_week ?? 18),
    max_periods_per_week: Number(t.maxPeriodsPerWeek ?? t.max_periods_per_week ?? 18),
    color: t.color ? String(t.color) : undefined
  }));

  const rooms: Room[] = (Array.isArray(raw.rooms) ? raw.rooms : []).map((r: any, idx: number) => ({
    id: String(r.id || `rm-${idx + 1}`),
    name: String(r.name || 'Room'),
    building: String(r.building || 'Main Campus'),
    capacity: Number(r.capacity ?? 30),
    type: r.type || 'Standard'
  }));

  const rules: ScheduleRule[] = (Array.isArray(raw.rules) ? raw.rules : []).map((r: any) =>
    normalizeRule(r, periods)
  );

  const syllabusUnits: SyllabusUnit[] = (Array.isArray(raw.syllabusUnits) ? raw.syllabusUnits : []).map((u: any, idx: number) => ({
    id: String(u.id || `unit-${u.subject_id || u.subjectId || 'sub'}-${idx + 1}`),
    subject_id: String(u.subject_id || u.subjectId || ''),
    order: Number(u.order ?? (idx + 1)),
    title: String(u.title || `Materi ${idx + 1}`),
    page_start: u.page_start ?? u.pageStart ?? '',
    page_end: u.page_end ?? u.pageEnd ?? '',
    part: u.part ?? '',
    no: Number(u.no ?? (idx + 1)),
    eno: Number(u.eno ?? (u.no ?? (idx + 1)))
  }));

  const syllabusScopes: SyllabusScope[] = (Array.isArray(raw.syllabusScopes) ? raw.syllabusScopes : []).map((s: any, idx: number) => ({
    id: String(s.id || `scope-${idx + 1}`),
    subject_id: String(s.subject_id || s.subjectId || ''),
    class_section_id: String(s.class_section_id || s.classSectionId || s.classId || ''),
    start_unit_id: String(s.start_unit_id || s.startUnitId || ''),
    end_unit_id: String(s.end_unit_id || s.endUnitId || '')
  }));

  const kaldikEvents: KaldikEvent[] = (Array.isArray(raw.kaldikEvents) ? raw.kaldikEvents : []).map(
    normalizeKaldikEvent
  );

  return {
    subjects,
    classes,
    rooms,
    teachers,
    sessions,
    periods,
    rules,
    kaldikEvents,
    syllabusUnits,
    syllabusScopes
  };
}
