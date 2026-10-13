import { DatabaseState } from '../types';

export const initialData: DatabaseState = {
  subjects: [
    {
      id: 'sub-math',
      name: 'Advanced Mathematics',
      color: '#3B82F6', // Blue
      department: 'Mathematics',
      defaultTeacherId: 'tch-chen',
      defaultRoomId: 'rm-101',
      default_book: 'bk-sub-math'
    },
    {
      id: 'sub-physics',
      name: 'General Physics & Lab',
      color: '#8B5CF6', // Purple
      department: 'Science',
      defaultTeacherId: 'tch-elena',
      defaultRoomId: 'rm-lab-sci',
      default_book: 'bk-sub-physics'
    },
    {
      id: 'sub-english',
      name: 'English Literature',
      color: '#10B981', // Emerald
      department: 'Humanities',
      defaultTeacherId: 'tch-sarah',
      defaultRoomId: 'rm-102'
    },
    {
      id: 'sub-chemistry',
      name: 'Organic Chemistry',
      color: '#F59E0B', // Amber
      department: 'Science',
      defaultTeacherId: 'tch-david',
      defaultRoomId: 'rm-lab-sci'
    },
    {
      id: 'sub-cs',
      name: 'Computer Programming',
      color: '#06B6D4', // Cyan
      department: 'Technology',
      defaultTeacherId: 'tch-turing',
      defaultRoomId: 'rm-lab-cs'
    },
    {
      id: 'sub-history',
      name: 'World History',
      color: '#EC4899', // Pink
      department: 'Humanities',
      defaultTeacherId: 'tch-sarah',
      defaultRoomId: 'rm-103'
    }
  ],
  classes: [
    { id: 'cls-10a', name: 'Grade 10-A', grade: 10, section: 'A', studentCount: 28, color: '#E0E7FF', icon: 'GraduationCap', onlineClassLink: 'https://meet.google.com/abc-defg-hij' },
    { id: 'cls-10b', name: 'Grade 10-B', grade: 10, section: 'B', studentCount: 30, color: '#FEF3C7', icon: 'Users', onlineClassLink: 'https://meet.google.com/klm-nopq-rst' },
    { id: 'cls-11sci', name: 'Grade 11-Science', grade: 11, section: 'SCI', studentCount: 25, color: '#DCFCE7', icon: 'Compass', onlineClassLink: 'https://meet.google.com/uvw-xyza-bcd' },
    { id: 'cls-12eng', name: 'Grade 12-Honors', grade: 12, section: 'HON', studentCount: 22, color: '#FCE7F3', icon: 'Award', onlineClassLink: 'https://meet.google.com/efg-hijk-lmn' }
  ],
  rooms: [
    { id: 'rm-101', name: 'Room 101', building: 'Academic Hall A', capacity: 35, type: 'Standard' },
    { id: 'rm-102', name: 'Room 102', building: 'Academic Hall A', capacity: 35, type: 'Standard' },
    { id: 'rm-103', name: 'Room 103', building: 'Academic Hall B', capacity: 30, type: 'Standard' },
    { id: 'rm-lab-sci', name: 'Science Laboratory', building: 'Science Wing', capacity: 28, type: 'Science Lab' },
    { id: 'rm-lab-cs', name: 'Computer Lab 1', building: 'Tech Center', capacity: 32, type: 'Computer Lab' },
    { id: 'rm-auditorium', name: 'Auditorium', building: 'Main Hall', capacity: 150, type: 'Auditorium' }
  ],
  teachers: [
    { id: 'tch-chen', name: 'Dr. Robert Chen', panggilan: 'Dr. Chen', email: 'r.chen@school.edu', department: 'Mathematics', maxPeriodsPerWeek: 18, color: '#0284C7' },
    { id: 'tch-elena', name: 'Prof. Elena Rostova', panggilan: 'Prof. Elena', email: 'e.rostova@school.edu', department: 'Science', maxPeriodsPerWeek: 16, color: '#10B981' },
    { id: 'tch-sarah', name: 'Ms. Sarah Mitchell', panggilan: 'Ms. Sarah', email: 's.mitchell@school.edu', department: 'Humanities', maxPeriodsPerWeek: 20, color: '#F59E0B' },
    { id: 'tch-david', name: 'Mr. David Miller', panggilan: 'Mr. David', email: 'd.miller@school.edu', department: 'Science', maxPeriodsPerWeek: 16, color: '#EC4899' },
    { id: 'tch-turing', name: 'Dr. Alan Turing', panggilan: 'Dr. Turing', email: 'a.turing@school.edu', department: 'Technology', maxPeriodsPerWeek: 15, color: '#8B5CF6' }
  ],
  sessions: [
    { id: 'ses-1', name: 'Session 1 (Morning)', order: 1, startTime: '08:00', endTime: '10:00' },
    { id: 'ses-2', name: 'Session 2 (Mid-Day)', order: 2, startTime: '10:15', endTime: '12:15' },
    { id: 'ses-3', name: 'Session 3 (Afternoon)', order: 3, startTime: '13:00', endTime: '15:00' },
    { id: 'ses-4', name: 'Session 4 (Late Afternoon)', order: 4, startTime: '15:15', endTime: '17:00' }
  ],
  periods: [
    { id: 'prd-1', name: 'Period 1 (Cycle 1)', periodNumber: 1, startDate: '2026-09-01', endDate: '2026-09-30', description: 'Early Fall Term' },
    { id: 'prd-2', name: 'Period 2 (Cycle 2)', periodNumber: 2, startDate: '2026-10-01', endDate: '2026-10-31', description: 'Mid Fall Term' },
    { id: 'prd-3', name: 'Period 3 (Cycle 3)', periodNumber: 3, startDate: '2026-11-01', endDate: '2026-11-30', description: 'Late Fall Term' },
    { id: 'prd-4', name: 'Period 4 (Cycle 4)', periodNumber: 4, startDate: '2026-12-01', endDate: '2026-12-22', description: 'Winter Final Cycle' }
  ],
  rules: [
    {
      id: 'rule-math-1',
      subjectId: 'sub-math',
      classId: 'cls-10a',
      teacherId: 'tch-chen',
      roomId: 'rm-101',
      sessionId: 'ses-1',
      dayOfWeek: 'Monday',
      periodIds: ['prd-1', 'prd-2', 'prd-3'],
      repeatDetail: 'Weekly',
      active: true,
      notes: 'Math lecture with special Session 3 lab exception on Period 3',
      // USER'S EXACT REQUIREMENT:
      // "subject A in session 1 except through periode3 which is in session3, etc"
      exceptions: [
        {
          id: 'exc-math-1',
          ruleId: 'rule-math-1',
          periodId: 'prd-3',
          overrideSessionId: 'ses-3',
          overrideRoomId: 'rm-lab-cs',
          note: 'Period 3 relocated to Session 3 (Afternoon) in Computer Lab for Math computation'
        }
      ]
    },
    {
      id: 'rule-math-2',
      subjectId: 'sub-math',
      classId: 'cls-10a',
      teacherId: 'tch-chen',
      roomId: 'rm-101',
      sessionId: 'ses-2',
      dayOfWeek: 'Wednesday',
      periodIds: ['prd-3', 'prd-4'],
      repeatDetail: 'Weekly',
      active: true,
      exceptions: []
    },
    {
      id: 'rule-math-3',
      subjectId: 'sub-math',
      classId: 'cls-10b',
      teacherId: 'tch-chen',
      roomId: 'rm-102',
      sessionId: 'ses-1',
      dayOfWeek: 'Tuesday',
      periodIds: ['prd-1', 'prd-2'],
      repeatDetail: 'Weekly',
      active: true,
      exceptions: []
    },
    {
      id: 'rule-physics-1',
      subjectId: 'sub-physics',
      classId: 'cls-10a',
      teacherId: 'tch-elena',
      roomId: 'rm-lab-sci',
      sessionId: 'ses-2',
      dayOfWeek: 'Monday',
      periodIds: ['prd-3', 'prd-4'],
      repeatDetail: 'Weekly',
      active: true,
      exceptions: []
    },
    {
      id: 'rule-english-1',
      subjectId: 'sub-english',
      classId: 'cls-10a',
      teacherId: 'tch-sarah',
      roomId: 'rm-102',
      sessionId: 'ses-3',
      dayOfWeek: 'Monday',
      periodIds: ['prd-1', 'prd-2'],
      repeatDetail: 'Weekly',
      active: true,
      exceptions: []
    },
    {
      id: 'rule-cs-1',
      subjectId: 'sub-cs',
      classId: 'cls-10a',
      teacherId: 'tch-turing',
      roomId: 'rm-lab-cs',
      sessionId: 'ses-1',
      dayOfWeek: 'Thursday',
      periodIds: ['prd-1', 'prd-2'],
      repeatDetail: 'Weekly',
      active: true,
      exceptions: []
    },
    {
      id: 'rule-chem-1',
      subjectId: 'sub-chemistry',
      classId: 'cls-10b',
      teacherId: 'tch-david',
      roomId: 'rm-lab-sci',
      sessionId: 'ses-2',
      dayOfWeek: 'Thursday',
      periodIds: ['prd-3', 'prd-4'],
      repeatDetail: 'Weekly',
      active: true,
      exceptions: []
    }
  ],
  syllabusUnits: [
    // Mathematics (sub-math)
    { id: 'unit-math-1', bookId: 'bk-sub-math', chapterBookId: 'chap-math-1', order: 1, title: 'Pengantar Aljabar & Persamaan Linear', page_start: 1, page_end: 14, part: 1, no: 1, eno: 12 },
    { id: 'unit-math-2', bookId: 'bk-sub-math', chapterBookId: 'chap-math-1', order: 2, title: 'Sistem Pertidaksamaan Linear Dua Variabel', page_start: 15, page_end: 28, part: 1, no: 13, eno: 25 },
    { id: 'unit-math-3', bookId: 'bk-sub-math', chapterBookId: 'chap-math-2', order: 3, title: 'Matriks & Operasi Determinan Matriks', page_start: 29, page_end: 44, part: 1, no: 26, eno: 40 },
    { id: 'unit-math-4', bookId: 'bk-sub-math', chapterBookId: 'chap-math-2', order: 4, title: 'Vektor Dimensi Dua dan Dimensi Tiga', page_start: 45, page_end: 60, part: 1, no: 41, eno: 55 },
    { id: 'unit-math-5', bookId: 'bk-sub-math', chapterBookId: 'chap-math-3', order: 5, title: 'Fungsi Kuadrat, Titik Puncak & Parabola', page_start: 61, page_end: 78, part: 2, no: 56, eno: 72 },
    { id: 'unit-math-6', bookId: 'bk-sub-math', chapterBookId: 'chap-math-3', order: 6, title: 'Trigonometri Dasar & Aturan Sinus Cosinus', page_start: 79, page_end: 98, part: 2, no: 73, eno: 90 },
    { id: 'unit-math-7', bookId: 'bk-sub-math', chapterBookId: 'chap-math-4', order: 7, title: 'Limit Fungsi Aljabar & Asimtot', page_start: 99, page_end: 118, part: 2, no: 91, eno: 108 },
    { id: 'unit-math-8', bookId: 'bk-sub-math', chapterBookId: 'chap-math-4', order: 8, title: 'Turunan Fungsi Aljabar & Garis Singgung', page_start: 119, page_end: 138, part: 2, no: 109, eno: 128 },
    { id: 'unit-math-9', bookId: 'bk-sub-math', chapterBookId: 'chap-math-5', order: 9, title: 'Aplikasi Turunan: Nilai Maksimum dan Minimum', page_start: 139, page_end: 156, part: 3, no: 129, eno: 145 },
    { id: 'unit-math-10', bookId: 'bk-sub-math', chapterBookId: 'chap-math-5', order: 10, title: 'Integral Tak Tentu & Teknik Substitusi', page_start: 157, page_end: 176, part: 3, no: 146, eno: 165 },
    { id: 'unit-math-11', bookId: 'bk-sub-math', chapterBookId: 'chap-math-6', order: 11, title: 'Integral Tentu & Kalkulasi Luas Daerah', page_start: 177, page_end: 198, part: 3, no: 166, eno: 185 },
    { id: 'unit-math-12', bookId: 'bk-sub-math', chapterBookId: 'chap-math-6', order: 12, title: 'Evaluasi & Review Portofolio Akhir Semester', page_start: 199, page_end: 215, part: 3, no: 186, eno: 200 },

    // Physics (sub-physics)
    { id: 'unit-phy-1', bookId: 'bk-sub-physics', chapterBookId: 'chap-phy-1', order: 1, title: 'Besaran, Satuan & Analisis Vektor Fisika', page_start: 1, page_end: 18, part: 1, no: 1, eno: 15 },
    { id: 'unit-phy-2', bookId: 'bk-sub-physics', chapterBookId: 'chap-phy-1', order: 2, title: 'Kinematika Gerak Lurus Beraturan (GLB & GLBB)', page_start: 19, page_end: 38, part: 1, no: 16, eno: 32 },
    { id: 'unit-phy-3', bookId: 'bk-sub-physics', chapterBookId: 'chap-phy-2', order: 3, title: 'Hukum Newton tentang Gerak & Gaya Gesek', page_start: 39, page_end: 58, part: 1, no: 33, eno: 50 },
    { id: 'unit-phy-4', bookId: 'bk-sub-physics', chapterBookId: 'chap-phy-2', order: 4, title: 'Usaha, Energi Kinetik, & Kekekalan Energi Mekanik', page_start: 59, page_end: 80, part: 2, no: 51, eno: 70 },
    { id: 'unit-phy-5', bookId: 'bk-sub-physics', chapterBookId: 'chap-phy-3', order: 5, title: 'Momentum, Impuls, & Tumbukan', page_start: 81, page_end: 102, part: 2, no: 71, eno: 90 },
    { id: 'unit-phy-6', bookId: 'bk-sub-physics', chapterBookId: 'chap-phy-3', order: 6, title: 'Praktikum Laboratorium: Dinamika Gerak & Ayunan', page_start: 103, page_end: 120, part: 2, no: 91, eno: 110 },

    // English (sub-english)
    { id: 'unit-eng-1', bookId: 'bk-sub-english', chapterBookId: 'chap-eng-1', order: 1, title: 'Introduction to Academic Essay Writing & Structure', page_start: 1, page_end: 20, part: 1, no: 1, eno: 18 },
    { id: 'unit-eng-2', bookId: 'bk-sub-english', chapterBookId: 'chap-eng-1', order: 2, title: 'Critical Reading: Identifying Thesis & Arguments', page_start: 21, page_end: 42, part: 1, no: 19, eno: 36 },
    { id: 'unit-eng-3', bookId: 'bk-sub-english', chapterBookId: 'chap-eng-2', order: 3, title: 'Advanced Grammar: Complex Sentences & Clauses', page_start: 43, page_end: 65, part: 1, no: 37, eno: 55 },
    { id: 'unit-eng-4', bookId: 'bk-sub-english', chapterBookId: 'chap-eng-2', order: 4, title: 'Literary Analysis of Classic Poetry & Prose', page_start: 66, page_end: 90, part: 2, no: 56, eno: 75 },

    // Computer Science (sub-cs)
    { id: 'unit-cs-1', bookId: 'bk-sub-cs', chapterBookId: 'chap-cs-1', order: 1, title: 'Algoritma Pemrograman & Flowchart Logic', page_start: 1, page_end: 22, part: 1, no: 1, eno: 20 },
    { id: 'unit-cs-2', bookId: 'bk-sub-cs', chapterBookId: 'chap-cs-1', order: 2, title: 'Struktur Data Dasar: Array, List, & Object Dictionary', page_start: 23, page_end: 48, part: 1, no: 21, eno: 42 },
    { id: 'unit-cs-3', bookId: 'bk-sub-cs', chapterBookId: 'chap-cs-2', order: 3, title: 'Fungsi, Rekursi, & Modularitas Kode', page_start: 49, page_end: 75, part: 2, no: 43, eno: 68 },
    { id: 'unit-cs-4', bookId: 'bk-sub-cs', chapterBookId: 'chap-cs-2', order: 4, title: 'Proyek Mini Aplikasi & Debugging Code', page_start: 76, page_end: 105, part: 2, no: 69, eno: 95 }
  ],
  syllabusScopes: [
    {
      id: 'scope-math-10a',
      subject_id: 'sub-math',
      class_section_id: 'cls-10a',
      book_ids: ['bk-sub-math'],
      book_id: 'bk-sub-math',
      start_unit_id: 'unit-math-1',
      end_unit_id: 'unit-math-8'
    }
  ],
  kaldikEvents: [
    {
      id: 'evt-kbm-prd-1',
      title: 'KBM Periode 1 (Cycle 1)',
      isKbm: true,
      type: 'kbm',
      isAllDay: true,
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      periodId: 'prd-1',
      color: '#F59E0B',
      description: 'Kegiatan Belajar Mengajar resmi Periode 1 T.A. 2026/2027'
    },
    {
      id: 'evt-kbm-prd-2',
      title: 'KBM Periode 2 (Cycle 2)',
      isKbm: true,
      type: 'kbm',
      isAllDay: true,
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      periodId: 'prd-2',
      color: '#F59E0B',
      description: 'Kegiatan Belajar Mengajar resmi Periode 2 T.A. 2026/2027'
    },
    {
      id: 'evt-orientasi',
      title: 'Ta’aruf & Orientasi Santri Baru',
      isKbm: false,
      type: 'activity',
      isAllDay: true,
      startDate: '2026-09-01',
      endDate: '2026-09-02',
      color: '#0284C7',
      description: 'Pembukaan tahun ajaran baru & pengenalan kurikulum ma’had'
    },
    {
      id: 'evt-puasa-senin-kamis',
      title: 'Puasa Sunnah & Tahfidz Sore',
      isKbm: false,
      type: 'activity',
      isAllDay: false,
      startTime: '16:00',
      endTime: '17:30',
      startDate: '2026-09-01',
      endDate: '2026-12-31',
      isRecurring: true,
      daysOfWeek: ['Monday', 'Thursday'],
      repeatDetail: 'Weekly',
      color: '#10B981',
      description: 'Kegiatan halaqah murajaah hafalan santri tiap Senin & Kamis'
    },
    {
      id: 'evt-uts-1',
      title: 'Asesmen Tengah Periode 1',
      isKbm: false,
      type: 'exam',
      isAllDay: true,
      startDate: '2026-09-17',
      endDate: '2026-09-18',
      color: '#8B5CF6',
      description: 'Evaluasi capaian materi pekan ke-3'
    },
    {
      id: 'evt-santri',
      title: 'Peringatan Hari Santri Nasional',
      isKbm: false,
      type: 'holiday',
      isAllDay: true,
      startDate: '2026-10-22',
      endDate: '2026-10-22',
      color: '#EF4444',
      description: 'Upacara hari santri & libur kegiatan formal KBM'
    }
  ],
  books: [
    {
      id: 'bk-sub-math',
      title: 'Advanced Mathematics for High School',
      altTitle: 'Kalkulus & Aljabar Lanjut',
      author: 'Prof. S. Chen',
      publisher: 'Cambridge University Press',
      edition: '3rd Edition',
      totalChapters: 12,
      totalPages: 480,
      defaultSubjectId: 'sub-math',
      defaultTeacherId: 'tch-chen',
      links: [
        { bookId: 'bk-sub-math', type: 'pdf', label: 'E-Book PDF', url: 'https://example.com/math101.pdf' }
      ]
    },
    {
      id: 'bk-sub-physics',
      title: 'Fundamentals of Modern Physics & Laboratory',
      altTitle: 'Fisika Eksperimental',
      author: 'Dr. Elena Rostova',
      publisher: 'Oxford Academic',
      edition: 'Global Edition',
      totalChapters: 10,
      totalPages: 420,
      defaultSubjectId: 'sub-physics',
      defaultTeacherId: 'tch-elena',
      links: []
    },
    {
      id: 'bk-sub-54462',
      title: 'العربية للناشئين',
      altTitle: 'Tadrib Lughawi',
      author: 'Penyusun Akademik',
      publisher: 'Maktabah Arabiyyah',
      edition: 'Jilid 1-6',
      totalChapters: 6,
      totalPages: 350,
      defaultSubjectId: 'sub-arabic',
      links: [
        { bookId: 'bk-sub-54462', type: 'pdf', label: 'Download PDF Kitab', url: 'https://archive.org/details/Alarabiyah_linnasyiiyin/' }
      ]
    }
  ]
};
