export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface SubjectLinks {
  pdf?: string;
  shopping?: string;
  shopping2?: string;
  site?: string;
  [key: string]: string | undefined;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  color: string;
  department: string;
  defaultTeacherId?: string;
  defaultRoomId?: string;
  default_teacher_id?: string | null;
  default_room_id?: string | null;
  book?: string;
  links?: SubjectLinks;
  pdfLink?: string;
  shoppingLink?: string;
  shoppingLink2?: string;
  siteLink?: string;
}

export interface ClassEntity {
  id: string;
  name: string;
  grade: number;
  section: string;
  studentCount: number;
  student_count?: number;
  icon?: string;
  color?: string;
  onlineClassLink?: string;
  online_class_link?: string;
  defaultRoomId?: string;
  default_room_id?: string | null;
}

export interface Room {
  id: string;
  name: string;
  building: string;
  capacity: number;
  type: 'Standard' | 'Science Lab' | 'Computer Lab' | 'Gymnasium' | 'Auditorium' | string;
}

export interface Teacher {
  id: string;
  name: string;
  panggilan?: string;
  email: string;
  department: string;
  maxPeriodsPerWeek: number;
  max_periods_per_week?: number;
  color?: string;
}

export interface Session {
  id: string;
  name: string;
  order: number;
  startTime: string; // timeA (e.g. '08:00')
  endTime: string; // timeB (e.g. '10:00')
  sort_order?: number;
  start_time?: string;
  end_time?: string;
}

export interface Period {
  id: string;
  name: string; // e.g. 'Period 1 (Term 1)'
  periodNumber: number;
  startDate: string; // dateA (e.g. '2026-09-01')
  endDate: string; // dateB (e.g. '2026-09-30')
  description?: string;
  period_number?: number;
  start_date?: string;
  end_date?: string;
}

export interface RuleException {
  id: string;
  ruleId: string;
  periodId: string; // The date-range period that triggers this exception
  overrideSessionId?: string; // e.g. 'ses-3' (override time-range session)
  overrideRoomId?: string;
  overrideTeacherId?: string;
  note?: string;
  period_id?: string;
  override_session_id?: string;
  override_room_id?: string;
  override_teacher_id?: string;
}

export interface ResolvedSlot {
  ruleId: string;
  subjectId: string;
  classId: string;
  teacherId: string;
  roomId: string;
  sessionId: string;
  day: DayOfWeek;
  periodId: string;
  hasException: boolean;
  exceptionDetail?: string;
}

export interface ScheduleRule {
  id: string;
  subjectId: string;
  classId: string;
  teacherId: string;
  roomId: string;
  sessionId: string;
  dayOfWeek?: DayOfWeek;
  daysOfWeek?: DayOfWeek[];
  periodIds: string[];
  repeatDetail: 'Weekly' | 'Bi-Weekly' | 'Custom';
  active: boolean;
  exceptions: RuleException[];
  notes?: string;
  createdAt?: string;

  // Interoperability aliases for SQLite / Python JSON exports
  subject_id?: string;
  class_id?: string;
  teacher_id?: string;
  room_id?: string;
  session_id?: string;
  day_of_week?: string;
  days_of_week?: string[];
  period_ids?: string[];
  repeat_detail?: string;
}

export interface EventLog {
  id: string;
  timestamp: string;
  action: string;
  category: 'rule' | 'database' | 'conflict' | 'system';
  details: string;
}

export type ConflictType = 'teacher' | 'class' | 'room' | 'session';

export interface ScheduleConflict {
  id: string;
  type: ConflictType;
  title: string;
  description: string;
  day: DayOfWeek;
  periodId: string;
  sessionId: string;
  involvedRuleIds: string[];
  severity: 'critical' | 'warning';
  entityName?: string;
  message?: string;
}

export interface ScheduleCell {
  day: DayOfWeek;
  periodId: string;
  sessionId: string;
  isFilled: boolean;
  ruleId?: string;
  subjectId?: string;
  classId?: string;
  teacherId?: string;
  roomId?: string;
  hasException?: boolean;
  exceptionDetail?: string;
  conflicts: ScheduleConflict[];
  slots?: ResolvedSlot[];
}

export type KaldikEventType = 'kbm' | 'holiday' | 'exam' | 'activity' | 'general';

export interface KaldikEvent {
  id: string;
  title: string;
  isKbm?: boolean;
  type: KaldikEventType;
  isAllDay: boolean;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
  startTime?: string; // '08:00'
  endTime?: string; // '10:00'
  isRecurring?: boolean;
  daysOfWeek?: DayOfWeek[]; // e.g. ['Monday', 'Thursday']
  repeatDetail?: 'Weekly' | 'Bi-Weekly' | 'Custom';
  periodId?: string; // Associated period ID for KBM or academic terms
  color?: string; // Hex color badge e.g. '#F59E0B'
  description?: string;
  createdAt?: string;
}

export interface DatabaseState {
  subjects: Subject[];
  classes: ClassEntity[];
  rooms: Room[];
  teachers: Teacher[];
  sessions: Session[];
  periods: Period[];
  rules: ScheduleRule[];
  kaldikEvents?: KaldikEvent[];
  syllabusUnits?: SyllabusUnit[];
  syllabusScopes?: SyllabusScope[];
}

export interface SyllabusUnit {
  id: string;
  subject_id: string; // from mapel_id
  order: number; // from mapel_n
  title: string; // from mtr
  page_start: number | string; // from hal pertama
  page_end: number | string; // from hal terakhir
  part: number | string; // from pt
  no: number;
  eno: number;
}

export interface SyllabusScope {
  id: string;
  subject_id: string;
  class_section_id: string; // class entity id
  start_unit_id: string; // FK to SyllabusUnit
  end_unit_id: string; // FK to SyllabusUnit
}

export interface ScheduledSessionOccurrence {
  id: string; // unique identifier: `${date}_${sessionId}_${ruleId}`
  date: string; // 'YYYY-MM-DD'
  day: DayOfWeek;
  sessionId: string; // references Session
  sessionName: string;
  startTime: string;
  endTime: string;
  ruleId: string;
  subjectId: string;
  classId: string;
  teacherId: string;
  roomId: string;
  periodId: string;
  meetingIndex: number; // 1-based index for this subject & class in the term
}
