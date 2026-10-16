import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Search,
  Plus,
  UserPlus,
  Trash2,
  Check,
  X,
  AlertCircle,
  Sparkles,
  School,
  ChevronRight,
  Edit2,
  GraduationCap,
  Eye,
  EyeOff
} from 'lucide-react';
import { DatabaseState, StudentRecord, EnrollmentRecord } from '../../types';

export interface EnrollmentStudent {
  id: string;
  nisn: string;
  name: string;
  gender: 'L' | 'P';
  phone?: string;
  enrolledClassIds: string[];
}

export interface EnrollmentClass {
  id: string;
  name: string;
  grade?: number;
  section?: string;
  color?: string;
  studentCount: number;
  homeroomTeacherId?: string;
  homeroomTeacherName?: string;
}

export interface EnrollmentTeacher {
  id: string;
  name: string;
  panggilan?: string;
  color?: string;
  department?: string;
  assignedClassIds: string[];
}

interface EnrollmentViewProps {
  db: DatabaseState;
  isAdmin: boolean;
  onOpenAdminLogin: () => void;
  onBackToPresensi?: () => void;
  onUpdateDb?: (updater: (prev: DatabaseState) => DatabaseState) => void;
}

export const EnrollmentView: React.FC<EnrollmentViewProps> = ({
  db,
  isAdmin,
  onOpenAdminLogin,
  onBackToPresensi: _onBackToPresensi,
  onUpdateDb,
}) => {
  // Mutually exclusive selection:
  // If selectedClassId is set, selectedPerson is null
  // If selectedPerson is set, selectedClassId is null
  // If both are empty/null, full default view without dimming
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedPerson, setSelectedPerson] = useState<{ type: 'teacher' | 'student'; id: string } | null>(null);

  // Search queries
  const [classSearch, setClassSearch] = useState('');
  const [peopleSearch, setPeopleSearch] = useState('');

  // Local data state
  const [_loading, setLoading] = useState(true);
  const [students, setStudents] = useState<EnrollmentStudent[]>([]);
  const [classes, setClasses] = useState<EnrollmentClass[]>([]);
  const [teachers, setTeachers] = useState<EnrollmentTeacher[]>([]);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ text: string; type: 'info' | 'success' | 'warn' } | null>(null);

  // Modal for new student
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState({
    name: '',
    nisn: '',
    gender: 'L' as 'L' | 'P',
    phone: '',
    classId: '',
  });

  // Modal for edit student
  const [editStudentModal, setEditStudentModal] = useState<EnrollmentStudent | null>(null);

  // Modal for quick new class
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [newClassForm, setNewClassForm] = useState({
    name: '',
    grade: 7,
    section: 'A',
  });

  // Flash temporary notification
  const notify = (text: string, type: 'info' | 'success' | 'warn' = 'info') => {
    setActionNotice({ text, type });
    setTimeout(() => {
      setActionNotice((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  // Build enrollment overview from local db and initial server state
  const loadInitialData = useCallback(() => {
    try {
      setLoading(true);

      // 1. Build classes from db
      const classMap = new Map<string, EnrollmentClass>();
      (db.classes || []).forEach((c) => {
        classMap.set(c.id, {
          id: c.id,
          name: c.name,
          grade: c.grade,
          section: c.section,
          color: c.color,
          studentCount: c.studentCount || 0,
        });
      });

      // 2. Build teachers from db (read assignedClassIds and rules)
      const teacherClassMap = new Map<string, Set<string>>();
      (db.teachers || []).forEach((t) => {
        if (Array.isArray(t.assignedClassIds)) {
          if (!teacherClassMap.has(t.id)) teacherClassMap.set(t.id, new Set());
          t.assignedClassIds.forEach((cId) => teacherClassMap.get(t.id)!.add(cId));
        }
      });
      (db.rules || []).forEach((r) => {
        if (r.active !== false && r.teacherId && r.classId) {
          if (!teacherClassMap.has(r.teacherId)) teacherClassMap.set(r.teacherId, new Set());
          teacherClassMap.get(r.teacherId)!.add(r.classId);
        }
      });

      const teacherList: EnrollmentTeacher[] = (db.teachers || []).map((t) => ({
        id: t.id,
        name: t.name,
        panggilan: t.panggilan,
        color: t.color,
        department: t.department,
        assignedClassIds: Array.from(teacherClassMap.get(t.id) || []),
      }));
      setTeachers(teacherList);

      // 3. Build students from db.students or fetch from overview
      if (Array.isArray(db.students) && db.students.length > 0) {
        // Build enrollment map from db.enrollments
        const studentEnrollMap = new Map<string, string[]>();
        if (Array.isArray(db.enrollments)) {
          db.enrollments.forEach((e) => {
            if (e.active !== false && e.active !== 0 && e.studentId && e.classId) {
              const list = studentEnrollMap.get(e.studentId) || [];
              if (!list.includes(e.classId)) list.push(e.classId);
              studentEnrollMap.set(e.studentId, list);
            }
          });
        }

        const studentList: EnrollmentStudent[] = db.students.map((s) => ({
          id: s.id,
          nisn: s.nisn || '',
          name: s.name,
          gender: s.gender === 'P' ? 'P' : 'L',
          phone: s.phone,
          enrolledClassIds: s.enrolledClassIds || studentEnrollMap.get(s.id) || [],
        }));

        // Recalculate live class counts
        const classCountMap = new Map<string, number>();
        studentList.forEach((s) => {
          s.enrolledClassIds.forEach((cId) => {
            classCountMap.set(cId, (classCountMap.get(cId) || 0) + 1);
          });
        });

        const classList = Array.from(classMap.values()).map((c) => ({
          ...c,
          studentCount: classCountMap.get(c.id) ?? c.studentCount,
        }));

        setStudents(studentList);
        setClasses(classList);
        setLoading(false);
      } else {
        // Fetch from API overview once
        fetch('/api/enrollment/overview')
          .then((res) => {
            if (!res.ok) throw new Error('API offline');
            return res.json();
          })
          .then((data) => {
            if (data.students && Array.isArray(data.students)) {
              setStudents(data.students);
            }
            if (data.classes && Array.isArray(data.classes)) {
              setClasses(data.classes);
            } else {
              setClasses(Array.from(classMap.values()));
            }
            if (data.teachers && Array.isArray(data.teachers)) {
              setTeachers(data.teachers);
            }
          })
          .catch(() => {
            // Fallback purely on local db
            setClasses(Array.from(classMap.values()));
            setStudents([]);
          })
          .finally(() => {
            setLoading(false);
          });
      }
    } catch {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Sync state changes to db without writing to network (Client-First)
  const syncToDb = (
    nextStudents: EnrollmentStudent[],
    nextClasses: EnrollmentClass[],
    nextTeachers: EnrollmentTeacher[]
  ) => {
    setHasPendingChanges(true);

    if (onUpdateDb) {
      onUpdateDb((prevDb) => {
        // 1. Build updated enrollments array
        const enrollments: EnrollmentRecord[] = [];
        nextStudents.forEach((s) => {
          s.enrolledClassIds.forEach((cId) => {
            enrollments.push({
              classId: cId,
              studentId: s.id,
              academicYear: '2025/2026',
              active: 1,
            });
          });
        });

        // 2. Updated student records
        const studentRecords: StudentRecord[] = nextStudents.map((s) => ({
          id: s.id,
          nisn: s.nisn,
          name: s.name,
          gender: s.gender,
          phone: s.phone,
          enrolledClassIds: s.enrolledClassIds,
        }));

        // 3. Updated classes with correct live counts
        const classCountMap = new Map<string, number>();
        nextStudents.forEach((s) => {
          s.enrolledClassIds.forEach((cId) => {
            classCountMap.set(cId, (classCountMap.get(cId) || 0) + 1);
          });
        });

        const updatedClasses = (prevDb.classes || []).map((c) => ({
          ...c,
          studentCount: classCountMap.get(c.id) ?? 0,
        }));

        // 4. Update teachers with assignedClassIds
        const teacherMap = new Map(nextTeachers.map((nt) => [nt.id, nt]));
        const updatedTeachers = (prevDb.teachers || []).map((t) => {
          const match = teacherMap.get(t.id);
          return match ? { ...t, assignedClassIds: match.assignedClassIds } : t;
        });

        // 5. Keep rules synchronized so teacher assignments persist
        const currentRules = [...(prevDb.rules || [])];
        nextTeachers.forEach((t) => {
          t.assignedClassIds.forEach((cId) => {
            const hasRule = currentRules.some(
              (r) => r.active !== false && r.teacherId === t.id && r.classId === cId
            );
            if (!hasRule) {
              currentRules.push({
                id: `rul-assign-${t.id}-${cId}`,
                subjectId: prevDb.subjects?.[0]?.id || 'sub-1',
                classId: cId,
                teacherId: t.id,
                roomId: prevDb.rooms?.[0]?.id || 'rom-1',
                sessionId: prevDb.sessions?.[0]?.id || 'ses-1',
                periodIds: [],
                repeatDetail: 'Weekly',
                active: true,
              });
            }
          });
        });

        const finalRules = currentRules.map((r) => {
          const teacherAssignedClasses = teacherMap.get(r.teacherId)?.assignedClassIds;
          if (teacherAssignedClasses && !teacherAssignedClasses.includes(r.classId)) {
            return { ...r, active: false };
          }
          return r;
        });

        return {
          ...prevDb,
          classes: updatedClasses,
          teachers: updatedTeachers,
          rules: finalRules,
          students: studentRecords,
          enrollments,
        };
      });
    }

    notify('Tekan tombol Simpan Perubahan untuk menyimpan.', 'info');
  };

  // ============================================================================
  // Mutually Exclusive Selection Handlers
  // ============================================================================

  // Clicking a class card ALWAYS selects/deselects the class and activates Class div
  const handleClassClick = (classId: string) => {
    if (selectedClassId === classId) {
      setSelectedClassId('');
    } else {
      setSelectedClassId(classId);
      setSelectedPerson(null); // Clears person selection immediately!
    }
  };

  // Clicking a person card ALWAYS selects/deselects the person and activates Person div
  const handlePersonClick = (type: 'teacher' | 'student', id: string) => {
    if (selectedPerson?.id === id && selectedPerson?.type === type) {
      setSelectedPerson(null);
    } else {
      setSelectedPerson({ type, id });
      setSelectedClassId(''); // Clears class selection immediately!
    }
  };

  const handleClearClassSelection = () => {
    setSelectedClassId('');
  };

  const handleClearPersonSelection = () => {
    setSelectedPerson(null);
  };

  // ============================================================================
  // Checkbox Toggle Handlers (Client-First)
  // ============================================================================

  // When Class div is active: toggle Student enrollment in active class
  const handleToggleStudentInActiveClass = (studentId: string, currentEnrolled: boolean) => {
    if (!isAdmin) {
      onOpenAdminLogin();
      return;
    }
    if (!selectedClassId) return;

    const nextStudents = students.map((s) => {
      if (s.id !== studentId) return s;
      const set = new Set(s.enrolledClassIds);
      if (currentEnrolled) {
        set.delete(selectedClassId);
      } else {
        set.add(selectedClassId);
      }
      return { ...s, enrolledClassIds: Array.from(set) };
    });

    const nextClasses = classes.map((c) => {
      if (c.id !== selectedClassId) return c;
      return {
        ...c,
        studentCount: Math.max(0, c.studentCount + (currentEnrolled ? -1 : 1)),
      };
    });

    setStudents(nextStudents);
    setClasses(nextClasses);
    syncToDb(nextStudents, nextClasses, teachers);
  };

  // When Class div is active: toggle Teacher assignment in active class
  const handleToggleTeacherInActiveClass = (teacherId: string, currentAssigned: boolean) => {
    if (!isAdmin) {
      onOpenAdminLogin();
      return;
    }
    if (!selectedClassId) return;

    const nextTeachers = teachers.map((t) => {
      if (t.id !== teacherId) return t;
      const set = new Set(t.assignedClassIds);
      if (currentAssigned) {
        set.delete(selectedClassId);
      } else {
        set.add(selectedClassId);
      }
      return { ...t, assignedClassIds: Array.from(set) };
    });

    setTeachers(nextTeachers);
    syncToDb(students, classes, nextTeachers);
  };

  // When Person div is active: ONLY clicking the checkbox toggles assignment to that class
  const handleToggleClassForActivePerson = (classId: string, isAssigned: boolean) => {
    if (!isAdmin) {
      onOpenAdminLogin();
      return;
    }
    if (!selectedPerson) return;

    if (selectedPerson.type === 'student') {
      const nextStudents = students.map((s) => {
        if (s.id !== selectedPerson.id) return s;
        const set = new Set(s.enrolledClassIds);
        if (isAssigned) {
          set.delete(classId);
        } else {
          set.add(classId);
        }
        return { ...s, enrolledClassIds: Array.from(set) };
      });

      const nextClasses = classes.map((c) => {
        if (c.id !== classId) return c;
        return {
          ...c,
          studentCount: Math.max(0, c.studentCount + (isAssigned ? -1 : 1)),
        };
      });

      setStudents(nextStudents);
      setClasses(nextClasses);
      syncToDb(nextStudents, nextClasses, teachers);
    } else {
      // Teacher
      const nextTeachers = teachers.map((t) => {
        if (t.id !== selectedPerson.id) return t;
        const set = new Set(t.assignedClassIds);
        if (isAssigned) {
          set.delete(classId);
        } else {
          set.add(classId);
        }
        return { ...t, assignedClassIds: Array.from(set) };
      });

      setTeachers(nextTeachers);
      syncToDb(students, classes, nextTeachers);
    }
  };

  // ============================================================================
  // Add / Edit / Delete Student Handlers (Client-First)
  // ============================================================================

  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentForm.name.trim()) return;

    const newId = `std-${Date.now()}`;
    const targetClass = newStudentForm.classId || selectedClassId || '';
    const newStudent: EnrollmentStudent = {
      id: newId,
      nisn: newStudentForm.nisn.trim(),
      name: newStudentForm.name.trim(),
      gender: newStudentForm.gender,
      phone: newStudentForm.phone.trim() || undefined,
      enrolledClassIds: targetClass ? [targetClass] : [],
    };

    const nextStudents = [newStudent, ...students];
    const nextClasses = classes.map((c) => {
      if (c.id !== targetClass) return c;
      return { ...c, studentCount: c.studentCount + 1 };
    });

    setStudents(nextStudents);
    setClasses(nextClasses);
    syncToDb(nextStudents, nextClasses, teachers);

    setIsAddStudentOpen(false);
    setNewStudentForm({
      name: '',
      nisn: '',
      gender: 'L',
      phone: '',
      classId: '',
    });
    notify(`Siswa "${newStudent.name}" berhasil ditambahkan ke memori lokal.`, 'success');
  };

  const handleSaveEditStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStudentModal || !editStudentModal.name.trim()) return;

    const nextStudents = students.map((s) => (s.id === editStudentModal.id ? editStudentModal : s));
    setStudents(nextStudents);
    syncToDb(nextStudents, classes, teachers);
    setEditStudentModal(null);
    notify(`Data siswa "${editStudentModal.name}" berhasil diperbarui.`, 'success');
  };

  const handleDeleteStudent = (studentId: string, studentName: string) => {
    if (!isAdmin) {
      onOpenAdminLogin();
      return;
    }
    if (!window.confirm(`Hapus siswa "${studentName}" dari daftar?`)) return;

    const studentToDelete = students.find((s) => s.id === studentId);
    const affectedClasses = new Set(studentToDelete?.enrolledClassIds || []);

    const nextStudents = students.filter((s) => s.id !== studentId);
    const nextClasses = classes.map((c) => {
      if (!affectedClasses.has(c.id)) return c;
      return { ...c, studentCount: Math.max(0, c.studentCount - 1) };
    });

    if (selectedPerson?.id === studentId) {
      setSelectedPerson(null);
    }

    setStudents(nextStudents);
    setClasses(nextClasses);
    syncToDb(nextStudents, nextClasses, teachers);
    notify(`Siswa "${studentName}" telah dihapus.`, 'info');
  };

  const handleCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassForm.name.trim()) return;

    const newId = `cls-${newClassForm.grade}${newClassForm.section.toLowerCase()}-${Date.now().toString(36).substring(4)}`;
    const newClass: EnrollmentClass = {
      id: newId,
      name: newClassForm.name.trim(),
      grade: Number(newClassForm.grade) || 7,
      section: newClassForm.section.trim() || 'A',
      color: '#4F46E5',
      studentCount: 0,
    };

    const nextClasses = [...classes, newClass];
    setClasses(nextClasses);

    if (onUpdateDb) {
      onUpdateDb((prevDb) => ({
        ...prevDb,
        classes: [
          ...(prevDb.classes || []),
          {
            id: newClass.id,
            name: newClass.name,
            grade: newClass.grade,
            section: newClass.section,
            studentCount: 0,
            color: newClass.color,
          },
        ],
      }));
    }

    setIsAddClassOpen(false);
    setSelectedClassId(newClass.id);
    setSelectedPerson(null);
    notify(`Rombel "${newClass.name}" berhasil dibuat.`, 'success');
  };

  // ============================================================================
  // Derived Data, Filtering & Dynamic Sorting (Selection Always on Top)
  // ============================================================================

  const activeClass = useMemo(() => {
    if (!selectedClassId) return null;
    return classes.find((c) => c.id === selectedClassId) || null;
  }, [classes, selectedClassId]);

  const activePersonObj = useMemo(() => {
    if (!selectedPerson) return null;
    if (selectedPerson.type === 'teacher') {
      const t = teachers.find((tch) => tch.id === selectedPerson.id);
      return t ? { isTeacher: true, name: t.name, panggilan: t.panggilan, entity: t } : null;
    }
    const s = students.find((std) => std.id === selectedPerson.id);
    return s ? { isTeacher: false, name: s.name, nisn: s.nisn, entity: s } : null;
  }, [selectedPerson, teachers, students]);

  // Helper: check if a class is related to active person
  const isClassRelatedToPerson = useCallback(
    (classId: string) => {
      if (!selectedPerson) return false;
      if (selectedPerson.type === 'student') {
        const s = students.find((std) => std.id === selectedPerson.id);
        return Boolean(s && s.enrolledClassIds.includes(classId));
      } else {
        const t = teachers.find((tch) => tch.id === selectedPerson.id);
        return Boolean(t && t.assignedClassIds.includes(classId));
      }
    },
    [selectedPerson, students, teachers]
  );

  // 1. FILTER & SORT CLASSES (Keep natural stable order as usual)
  const displayClasses = useMemo(() => {
    const q = classSearch.trim().toLowerCase();
    const filtered = classes.filter((c) => {
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.section && c.section.toLowerCase().includes(q)) ||
        (c.grade && String(c.grade).includes(q))
      );
    });

    // Stable natural sort by grade, section, and name
    return [...filtered].sort((a, b) => {
      if ((a.grade || 0) !== (b.grade || 0)) return (a.grade || 0) - (b.grade || 0);
      return a.name.localeCompare(b.name, 'id');
    });
  }, [classes, classSearch]);

  // Unified Filter for People in Div 2: Filters both teachers and students simultaneously
  const queryPeople = peopleSearch.trim().toLowerCase();

  // 2. FILTER & SORT TEACHERS (Keep natural stable alphabetical order as usual)
  const displayTeachers = useMemo(() => {
    const filtered = teachers.filter((t) => {
      if (!queryPeople) return true;
      return (
        t.name.toLowerCase().includes(queryPeople) ||
        (t.panggilan && t.panggilan.toLowerCase().includes(queryPeople)) ||
        (t.department && t.department.toLowerCase().includes(queryPeople)) ||
        t.id.toLowerCase().includes(queryPeople)
      );
    });

    return [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [teachers, queryPeople]);

  // 3. FILTER & SORT STUDENTS (Keep natural stable alphabetical order as usual)
  const displayStudents = useMemo(() => {
    const filtered = students.filter((s) => {
      if (!queryPeople) return true;
      return (
        s.name.toLowerCase().includes(queryPeople) ||
        (s.nisn && s.nisn.toLowerCase().includes(queryPeople)) ||
        (s.phone && s.phone.includes(queryPeople)) ||
        s.id.toLowerCase().includes(queryPeople)
      );
    });

    return [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [students, queryPeople]);

  // Quick statistics for active class
  const classAssignedTeachersCount = useMemo(() => {
    if (!selectedClassId) return 0;
    return teachers.filter((t) => t.assignedClassIds.includes(selectedClassId)).length;
  }, [teachers, selectedClassId]);

  const classAssignedStudentsCount = useMemo(() => {
    if (!selectedClassId) return 0;
    return students.filter((s) => s.enrolledClassIds.includes(selectedClassId)).length;
  }, [students, selectedClassId]);

  // Summarize classes the active person relates to
  const personRelatedClasses = useMemo(() => {
    if (!selectedPerson) return [];
    return classes.filter((c) => isClassRelatedToPerson(c.id));
  }, [classes, selectedPerson, isClassRelatedToPerson]);

  const personRelatedClassesCount = personRelatedClasses.length;

  // Split teachers into assigned & unassigned (based on active class, or having any class if no class selected)
  const { assignedTeachers, unassignedTeachers } = useMemo(() => {
    const assigned: EnrollmentTeacher[] = [];
    const unassigned: EnrollmentTeacher[] = [];

    displayTeachers.forEach((tch) => {
      const isAssigned = selectedClassId
        ? tch.assignedClassIds.includes(selectedClassId)
        : tch.assignedClassIds.length > 0;

      if (isAssigned) {
        assigned.push(tch);
      } else {
        unassigned.push(tch);
      }
    });

    return { assignedTeachers: assigned, unassignedTeachers: unassigned };
  }, [displayTeachers, selectedClassId]);

  // Split students into assigned & unassigned (based on active class, or having any class if no class selected)
  const { assignedStudents, unassignedStudents } = useMemo(() => {
    const assigned: EnrollmentStudent[] = [];
    const unassigned: EnrollmentStudent[] = [];

    displayStudents.forEach((std) => {
      const isAssigned = selectedClassId
        ? std.enrolledClassIds.includes(selectedClassId)
        : std.enrolledClassIds.length > 0;

      if (isAssigned) {
        assigned.push(std);
      } else {
        unassigned.push(std);
      }
    });

    return { assignedStudents: assigned, unassignedStudents: unassigned };
  }, [displayStudents, selectedClassId]);

  // Small hide/unhide state for each of the 4 people sections
  const [collapsedSections, setCollapsedSections] = useState({
    assignedTeachers: false,
    unassignedTeachers: false,
    assignedStudents: false,
    unassignedStudents: false,
  });

  const toggleSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className="flex flex-col h-full min-h-screen">
      {/* Action Notification Toast */}
      {actionNotice && (
        <div className="fixed top-16 right-6 z-50 transition-all transform animate-in fade-in slide-in-from-top-4">
          <div
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg shadow-lg text-xs font-medium border ${
              actionNotice.type === 'success'
                ? 'bg-slate-900 text-white border-slate-700'
                : actionNotice.type === 'warn'
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-indigo-50 text-indigo-800 border-indigo-300'
            }`}
          >
            <Sparkles className="w-4 h-4 flex-shrink-0 text-indigo-400" />
            <span>{actionNotice.text}</span>
            <button
              onClick={() => setActionNotice(null)}
              className="ml-2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Dual-Panel View: 2 main divs, no top banner */}
      <div className="flex-1 p-3 lg:p-5 max-w-[1700px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* ==================================================================== */}
        {/* DIV 1: DAFTAR ROMBEL / KELAS                                         */}
        {/* ==================================================================== */}
        <div className={`lg:col-span-5 xl:col-span-4 rounded-xl border shadow-xs flex flex-col overflow-hidden min-h-[550px] max-h-[calc(100vh-100px)] transition-all duration-200 ${
          selectedClassId ? 'border-indigo-400 ring-2 ring-indigo-200/60 bg-indigo-50/10' : 'border-slate-200 bg-white'
        }`}>
          {/* Div 1 Minimal Header */}
          <div className="px-3.5 py-2.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-2 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <School className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <span className="font-semibold text-sm text-slate-800 tracking-tight">Rombel</span>
              <span className="px-1.5 py-0.5 text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md">
                {classes.length}
              </span>
            </div>

            {/* Selection Status Badge */}
            <div className="flex items-center gap-1.5 min-w-0">
              {selectedClassId && activeClass && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full max-w-[150px] truncate">
                  <span className="truncate">Terpilih: {activeClass.name}</span>
                  <button
                    onClick={handleClearClassSelection}
                    title="Tampilkan semua rombel"
                    className="hover:text-red-600 ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {selectedPerson && activePersonObj && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-amber-100 text-amber-700 border border-amber-200 rounded-full max-w-[220px] truncate">
                  <span className="truncate">
                    {personRelatedClassesCount} Rombel: {personRelatedClasses.map((c) => c.name).join(', ')}
                  </span>
                  <button
                    onClick={handleClearPersonSelection}
                    title="Hapus filter person"
                    className="hover:text-red-600 ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {isAdmin && (
                <button
                  onClick={() => setIsAddClassOpen(true)}
                  title="Tambah Rombel Baru"
                  className="p-1 text-slate-600 hover:text-indigo-600 hover:bg-white rounded transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Div 1 Minimal Filter */}
          <div className="p-2 border-b border-slate-100 bg-white flex-shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
                placeholder="Cari rombel / tingkat..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
              />
              {classSearch && (
                <button
                  onClick={() => setClassSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Div 1 Class List Container */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {displayClasses.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                Tidak ada rombel yang cocok.
              </div>
            ) : (
              displayClasses.map((cls) => {
                const isSelected = selectedClassId === cls.id;
                const isPersonRelated = selectedPerson ? isClassRelatedToPerson(cls.id) : false;

                // Dimming logic:
                // - If selectedClassId is active: dim all non-selected classes, keep selected row bright
                // - If selectedPerson is active: dim all non-related classes, keep related classes bright
                const isDimmed =
                  (selectedClassId && !isSelected) ||
                  (selectedPerson && !isPersonRelated);

                return (
                  <div
                    key={cls.id}
                    onClick={() => {
                      // Clicking the card ALWAYS selects it and activates Class div
                      handleClassClick(cls.id);
                    }}
                    className={`group relative flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-all border ${
                      isSelected
                        ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 ring-1 ring-indigo-400 shadow-xs font-semibold opacity-100'
                        : isPersonRelated
                        ? 'bg-indigo-50/40 border-indigo-300 text-indigo-950 shadow-xs font-medium opacity-100'
                        : isDimmed
                        ? 'bg-white border-transparent text-slate-400 opacity-40 hover:opacity-90 hover:bg-slate-50 hover:border-slate-200'
                        : 'bg-white border-slate-100 text-slate-800 hover:border-indigo-200 hover:bg-slate-50/80 opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Checkbox: ONLY shown when in Person Focus mode. Only ticking checkbox assigns/unassigns */}
                      {selectedPerson ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleClassForActivePerson(cls.id, isPersonRelated);
                          }}
                          title={isPersonRelated ? 'Keluarkan dari rombel ini' : 'Hubungkan ke rombel ini'}
                          className={`w-4 h-4 flex items-center justify-center rounded border transition flex-shrink-0 ${
                            isPersonRelated
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'bg-white border-slate-300 text-transparent hover:border-slate-400'
                          }`}
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                        </button>
                      ) : (
                        <div
                          className={`w-2 h-7 rounded-full flex-shrink-0 ${
                            isSelected
                              ? 'bg-indigo-600'
                              : cls.color || 'bg-slate-300'
                          }`}
                        />
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs leading-none truncate ${isSelected ? 'font-bold' : 'font-semibold'}`}>
                            {cls.name}
                          </span>
                          {cls.grade && (
                            <span className="text-[10px] text-slate-400">
                              Tingkat {cls.grade}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {cls.studentCount} Siswa terdaftar
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isSelected && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-200/80 text-indigo-900 rounded">
                          Aktif
                        </span>
                      )}
                      <ChevronRight
                        className={`w-3.5 h-3.5 transition-transform ${
                          isSelected ? 'text-indigo-600 translate-x-0.5' : 'text-slate-300 group-hover:text-slate-400'
                        }`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Div 1 Bottom Footer Status */}
          <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between flex-shrink-0">
            <span>
              {selectedPerson && activePersonObj
                ? `${personRelatedClassesCount} dari ${classes.length} rombel terhubung dengan ${activePersonObj.name}`
                : selectedClassId
                ? 'Klik rombel aktif untuk batal pilih'
                : 'Pilih rombel untuk kelola anggotanya'}
            </span>
            {selectedClassId && (
              <button
                onClick={handleClearClassSelection}
                className="text-indigo-600 hover:underline font-medium"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* ==================================================================== */}
        {/* DIV 2: DAFTAR ORANG (4 SEKSI: GURU & SISWA DITUGASKAN / BELUM)       */}
        {/* ==================================================================== */}
        <div className={`lg:col-span-7 xl:col-span-8 rounded-xl border shadow-xs flex flex-col overflow-hidden min-h-[550px] max-h-[calc(100vh-100px)] transition-all duration-200 ${
          selectedPerson ? 'border-amber-400 ring-2 ring-amber-200/60 bg-amber-50/10' : 'border-slate-200 bg-white'
        }`}>
          {/* Div 2 Minimal Header */}
          <div className="px-3.5 py-2.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-2 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Users className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span className="font-semibold text-sm text-slate-800 tracking-tight">Orang</span>
              <span className="px-1.5 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60 rounded-md">
                {teachers.length} Guru • {students.length} Siswa
              </span>
            </div>

            {/* Selection Status Badge */}
            <div className="flex items-center gap-1.5 min-w-0">
              {selectedClassId && activeClass && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full max-w-[200px] truncate">
                  <span className="truncate">
                    ({classAssignedTeachersCount} Guru • {classAssignedStudentsCount} Siswa)
                  </span>
                  <button
                    onClick={handleClearClassSelection}
                    title="Tampilkan semua orang"
                    className="hover:text-red-600 ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {selectedPerson && activePersonObj && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-amber-100 text-amber-700 border border-amber-200 rounded-full max-w-[180px] truncate">
                  <span className="truncate">Terpilih: {activePersonObj.name}</span>
                  <button
                    onClick={handleClearPersonSelection}
                    title="Hapus pilihan"
                    className="hover:text-red-600 ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {isAdmin && (
                <button
                  onClick={() => {
                    setNewStudentForm({
                      name: '',
                      nisn: '',
                      gender: 'L',
                      phone: '',
                      classId: selectedClassId || '',
                    });
                    setIsAddStudentOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded transition shadow-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Siswa</span>
                </button>
              )}
            </div>
          </div>

          {/* Div 2 Minimal Unified Filter (Simultaneously filters teachers & students) */}
          <div className="p-2 border-b border-slate-100 bg-white flex-shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={peopleSearch}
                onChange={(e) => setPeopleSearch(e.target.value)}
                placeholder="Cari guru atau siswa (nama, kode, NISN)..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition"
              />
              {peopleSearch && (
                <button
                  onClick={() => setPeopleSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Pending Changes In-Memory Notification Banner */}
          {hasPendingChanges && (
            <div className="px-3 py-1.5 bg-amber-50/90 border-b border-amber-200 text-amber-800 text-[11px] flex items-center justify-between gap-2 flex-shrink-0">
              <div className="flex items-center gap-1.5 truncate">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                <span className="truncate">
                  Perubahan dicatat di memori lokal. Tekan tombol <strong>Simpan Perubahan</strong> di header atas untuk menyimpan ke Turso.
                </span>
              </div>
            </div>
          )}

          {/* Div 2 People List Container: 4 Main Divs with Hide/Unhide Buttons */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-3.5">
            
            {/* ================================================================ */}
            {/* SUB-DIV 1: GURU DITUGASKAN                                       */}
            {/* ================================================================ */}
            {assignedTeachers.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between px-2 py-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider bg-slate-100/70 border border-slate-200/60 rounded-md">
                  <span className="flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-amber-600" />
                    <span>Guru Ditugaskan</span>
                    <span className="px-1.5 py-0.2 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full">
                      {assignedTeachers.length}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSection('assignedTeachers')}
                    className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 rounded transition"
                    title={collapsedSections.assignedTeachers ? 'Tampilkan Guru Ditugaskan' : 'Sembunyikan Guru Ditugaskan'}
                  >
                    {collapsedSections.assignedTeachers ? (
                      <>
                        <EyeOff className="w-3 h-3 text-slate-400" />
                        <span className="font-normal text-[10px]">Sembunyi</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3 text-amber-600" />
                        <span className="font-normal text-[10px]">Tampil</span>
                      </>
                    )}
                  </button>
                </div>

                {!collapsedSections.assignedTeachers && (
                  <div className="space-y-1">
                    {assignedTeachers.map((tch) => {
                      const isTeacherAssignedToActiveClass = selectedClassId
                        ? tch.assignedClassIds.includes(selectedClassId)
                        : tch.assignedClassIds.length > 0;

                      const isPersonSelected =
                        selectedPerson?.type === 'teacher' && selectedPerson.id === tch.id;

                      const isDimmed = selectedPerson && !isPersonSelected;

                      return (
                        <div
                          key={`tch-assigned-${tch.id}`}
                          onClick={() => handlePersonClick('teacher', tch.id)}
                          className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition cursor-pointer text-xs ${
                            isPersonSelected
                              ? 'bg-amber-50/90 border-amber-400 text-amber-950 ring-1 ring-amber-400 shadow-xs font-semibold opacity-100'
                              : isDimmed
                              ? 'bg-white border-transparent text-slate-400 opacity-40 hover:opacity-90 hover:bg-slate-50 hover:border-slate-200'
                              : selectedClassId && isTeacherAssignedToActiveClass
                              ? 'bg-slate-50/80 border-slate-300 text-slate-900 shadow-xs opacity-100'
                              : 'bg-white border-slate-200 text-slate-800 hover:border-amber-300 hover:bg-slate-50 opacity-100'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {selectedClassId && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleTeacherInActiveClass(tch.id, true);
                                }}
                                title="Keluarkan guru dari rombel ini"
                                className="w-4 h-4 flex items-center justify-center rounded border transition flex-shrink-0 bg-amber-600 border-amber-600 text-white"
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                              </button>
                            )}

                            <span
                              className={`px-1.5 py-0.5 text-[10px] font-bold rounded flex-shrink-0 ${
                                isPersonSelected
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-purple-100 text-purple-700'
                              }`}
                            >
                              Guru
                            </span>

                            <span className="truncate font-medium">{tch.name}</span>
                            {tch.panggilan && (
                              <span className="text-[11px] text-slate-400 truncate">
                                ({tch.panggilan})
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0 text-[11px]">
                            {tch.assignedClassIds.length > 0 ? (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded truncate max-w-[150px]">
                                {tch.assignedClassIds.join(', ')}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-[10px]">Belum ada rombel</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ================================================================ */}
            {/* SUB-DIV 2: GURU BELUM DITUGASKAN                                 */}
            {/* ================================================================ */}
            {unassignedTeachers.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between px-2 py-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider bg-slate-100/50 border border-slate-200/50 rounded-md">
                  <span className="flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                    <span>Guru Belum Ditugaskan</span>
                    <span className="px-1.5 py-0.2 text-[10px] font-bold bg-slate-200/70 text-slate-700 rounded-full">
                      {unassignedTeachers.length}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSection('unassignedTeachers')}
                    className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 rounded transition"
                    title={collapsedSections.unassignedTeachers ? 'Tampilkan' : 'Sembunyikan'}
                  >
                    {collapsedSections.unassignedTeachers ? (
                      <>
                        <EyeOff className="w-3 h-3 text-slate-400" />
                        <span className="font-normal text-[10px]">Sembunyi</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3 text-amber-600" />
                        <span className="font-normal text-[10px]">Tampil</span>
                      </>
                    )}
                  </button>
                </div>

                {!collapsedSections.unassignedTeachers && (
                  <div className="space-y-1">
                    {unassignedTeachers.map((tch) => {
                      const isPersonSelected =
                        selectedPerson?.type === 'teacher' && selectedPerson.id === tch.id;

                      const isDimmed = selectedPerson && !isPersonSelected;

                      return (
                        <div
                          key={`tch-unassigned-${tch.id}`}
                          onClick={() => handlePersonClick('teacher', tch.id)}
                          className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition cursor-pointer text-xs ${
                            isPersonSelected
                              ? 'bg-amber-50/90 border-amber-400 text-amber-950 ring-1 ring-amber-400 shadow-xs font-semibold opacity-100'
                              : isDimmed
                              ? 'bg-white border-transparent text-slate-400 opacity-40 hover:opacity-90 hover:bg-slate-50 hover:border-slate-200'
                              : 'bg-white border-slate-200 text-slate-800 hover:border-amber-300 hover:bg-slate-50 opacity-100'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {selectedClassId && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleTeacherInActiveClass(tch.id, false);
                                }}
                                title="Tugaskan guru ke rombel ini"
                                className="w-4 h-4 flex items-center justify-center rounded border transition flex-shrink-0 bg-white border-slate-300 hover:border-amber-400 text-transparent"
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                              </button>
                            )}

                            <span
                              className={`px-1.5 py-0.5 text-[10px] font-bold rounded flex-shrink-0 ${
                                isPersonSelected
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              Guru
                            </span>

                            <span className="truncate font-medium">{tch.name}</span>
                            {tch.panggilan && (
                              <span className="text-[11px] text-slate-400 truncate">
                                ({tch.panggilan})
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0 text-[11px]">
                            {tch.assignedClassIds.length > 0 ? (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded truncate max-w-[150px]">
                                {tch.assignedClassIds.join(', ')}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-[10px]">Belum ada rombel</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ================================================================ */}
            {/* SUB-DIV 3: SISWA TERDAFTAR                                       */}
            {/* ================================================================ */}
            {assignedStudents.length > 0 && (
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between px-2 py-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider bg-slate-100/70 border border-slate-200/60 rounded-md">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-600" />
                    <span>Siswa Terdaftar</span>
                    <span className="px-1.5 py-0.2 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full">
                      {assignedStudents.length}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSection('assignedStudents')}
                    className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 rounded transition"
                    title={collapsedSections.assignedStudents ? 'Tampilkan Siswa Terdaftar' : 'Sembunyikan Siswa Terdaftar'}
                  >
                    {collapsedSections.assignedStudents ? (
                      <>
                        <EyeOff className="w-3 h-3 text-slate-400" />
                        <span className="font-normal text-[10px]">Sembunyi</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3 text-amber-600" />
                        <span className="font-normal text-[10px]">Tampil</span>
                      </>
                    )}
                  </button>
                </div>

                {!collapsedSections.assignedStudents && (
                  <div className="space-y-1">
                    {assignedStudents.map((std) => {
                      const isStudentEnrolledInActiveClass = selectedClassId
                        ? std.enrolledClassIds.includes(selectedClassId)
                        : std.enrolledClassIds.length > 0;

                      const isPersonSelected =
                        selectedPerson?.type === 'student' && selectedPerson.id === std.id;

                      const isDimmed = selectedPerson && !isPersonSelected;

                      return (
                        <div
                          key={`std-assigned-${std.id}`}
                          onClick={() => handlePersonClick('student', std.id)}
                          className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition cursor-pointer text-xs ${
                            isPersonSelected
                              ? 'bg-amber-50/90 border-amber-400 text-amber-950 ring-1 ring-amber-400 shadow-xs font-semibold opacity-100'
                              : isDimmed
                              ? 'bg-white border-transparent text-slate-400 opacity-40 hover:opacity-90 hover:bg-slate-50 hover:border-slate-200'
                              : selectedClassId && isStudentEnrolledInActiveClass
                              ? 'bg-slate-50/80 border-slate-300 text-slate-900 shadow-xs opacity-100'
                              : 'bg-white border-slate-200 text-slate-800 hover:border-amber-300 hover:bg-slate-50 opacity-100'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {selectedClassId && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleStudentInActiveClass(std.id, true);
                                }}
                                title="Keluarkan siswa dari rombel ini"
                                className="w-4 h-4 flex items-center justify-center rounded border transition flex-shrink-0 bg-amber-600 border-amber-600 text-white"
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                              </button>
                            )}

                            <span
                              className={`px-1 py-0.2 text-[9px] font-bold rounded flex-shrink-0 ${
                                std.gender === 'P'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {std.gender}
                            </span>

                            <span className="truncate font-medium">{std.name}</span>

                            {std.nisn && (
                              <span className="text-[11px] text-slate-400 font-mono truncate">
                                {std.nisn}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {std.enrolledClassIds.length > 0 ? (
                              <span className="px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-600 rounded truncate max-w-[150px]">
                                {std.enrolledClassIds.join(', ')}
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded">
                                Belum ada rombel
                              </span>
                            )}

                            {isAdmin && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditStudentModal(std);
                                  }}
                                  title="Edit Siswa"
                                  className="p-1 text-slate-400 hover:text-amber-600 rounded"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteStudent(std.id, std.name);
                                  }}
                                  title="Hapus Siswa"
                                  className="p-1 text-slate-400 hover:text-red-600 rounded"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ================================================================ */}
            {/* SUB-DIV 4: SISWA BELUM TERDAFTAR                                 */}
            {/* ================================================================ */}
            {unassignedStudents.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between px-2 py-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider bg-slate-100/50 border border-slate-200/50 rounded-md">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>Siswa Belum Terdaftar</span>
                    <span className="px-1.5 py-0.2 text-[10px] font-bold bg-slate-200/70 text-slate-700 rounded-full">
                      {unassignedStudents.length}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSection('unassignedStudents')}
                    className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 rounded transition"
                    title={collapsedSections.unassignedStudents ? 'Tampilkan' : 'Sembunyikan'}
                  >
                    {collapsedSections.unassignedStudents ? (
                      <>
                        <EyeOff className="w-3 h-3 text-slate-400" />
                        <span className="font-normal text-[10px]">Sembunyi</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3 text-amber-600" />
                        <span className="font-normal text-[10px]">Tampil</span>
                      </>
                    )}
                  </button>
                </div>

                {!collapsedSections.unassignedStudents && (
                  <div className="space-y-1">
                    {unassignedStudents.map((std) => {
                      const isPersonSelected =
                        selectedPerson?.type === 'student' && selectedPerson.id === std.id;

                      const isDimmed = selectedPerson && !isPersonSelected;

                      return (
                        <div
                          key={`std-unassigned-${std.id}`}
                          onClick={() => handlePersonClick('student', std.id)}
                          className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition cursor-pointer text-xs ${
                            isPersonSelected
                              ? 'bg-amber-50/90 border-amber-400 text-amber-950 ring-1 ring-amber-400 shadow-xs font-semibold opacity-100'
                              : isDimmed
                              ? 'bg-white border-transparent text-slate-400 opacity-40 hover:opacity-90 hover:bg-slate-50 hover:border-slate-200'
                              : 'bg-white border-slate-200 text-slate-800 hover:border-amber-300 hover:bg-slate-50 opacity-100'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {selectedClassId && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleStudentInActiveClass(std.id, false);
                                }}
                                title="Daftarkan siswa ke rombel ini"
                                className="w-4 h-4 flex items-center justify-center rounded border transition flex-shrink-0 bg-white border-slate-300 hover:border-amber-400 text-transparent"
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                              </button>
                            )}

                            <span
                              className={`px-1 py-0.2 text-[9px] font-bold rounded flex-shrink-0 ${
                                std.gender === 'P'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {std.gender}
                            </span>

                            <span className="truncate font-medium">{std.name}</span>

                            {std.nisn && (
                              <span className="text-[11px] text-slate-400 font-mono truncate">
                                {std.nisn}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {std.enrolledClassIds.length > 0 ? (
                              <span className="px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-600 rounded truncate max-w-[150px]">
                                {std.enrolledClassIds.join(', ')}
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded">
                                Belum ada rombel
                              </span>
                            )}

                            {isAdmin && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditStudentModal(std);
                                  }}
                                  title="Edit Siswa"
                                  className="p-1 text-slate-400 hover:text-amber-600 rounded"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteStudent(std.id, std.name);
                                  }}
                                  title="Hapus Siswa"
                                  className="p-1 text-slate-400 hover:text-red-600 rounded"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Empty state when all 4 categories have 0 people */}
            {assignedTeachers.length === 0 &&
              unassignedTeachers.length === 0 &&
              assignedStudents.length === 0 &&
              unassignedStudents.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400 italic">
                  {peopleSearch
                    ? `Tidak ada guru atau siswa yang cocok dengan pencarian "${peopleSearch}".`
                    : 'Tidak ada data orang.'}
                </div>
              )}
          </div>

          {/* Div 2 Bottom Status Footer */}
          <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between flex-shrink-0">
            <span>
              {selectedPerson
                ? 'Klik person aktif untuk batal pilih'
                : selectedClassId
                ? 'Centang kotak untuk memasukkan/mengeluarkan dari rombel'
                : 'Pilih guru atau siswa untuk melihat rombel terhubung'}
            </span>
            {selectedPerson && (
              <button
                onClick={handleClearPersonSelection}
                className="text-amber-600 hover:underline font-medium"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* MODAL: TAMBAH SISWA (Client-First)                                   */}
      {/* ==================================================================== */}
      {isAddStudentOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-600" />
                Tambah Siswa Baru
              </h3>
              <button
                onClick={() => setIsAddStudentOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="space-y-3 pt-3 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  required
                  value={newStudentForm.name}
                  onChange={(e) =>
                    setNewStudentForm({ ...newStudentForm, name: e.target.value })
                  }
                  placeholder="Contoh: Muhammad Farhan"
                  className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    NISN
                  </label>
                  <input
                    type="text"
                    value={newStudentForm.nisn}
                    onChange={(e) =>
                      setNewStudentForm({ ...newStudentForm, nisn: e.target.value })
                    }
                    placeholder="Contoh: 0081234567"
                    className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Jenis Kelamin
                  </label>
                  <select
                    value={newStudentForm.gender}
                    onChange={(e) =>
                      setNewStudentForm({
                        ...newStudentForm,
                        gender: e.target.value as 'L' | 'P',
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Nomor HP / WhatsApp
                </label>
                <input
                  type="text"
                  value={newStudentForm.phone}
                  onChange={(e) =>
                    setNewStudentForm({ ...newStudentForm, phone: e.target.value })
                  }
                  placeholder="Contoh: 081234567890"
                  className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Daftarkan Langsung ke Rombel
                </label>
                <select
                  value={newStudentForm.classId}
                  onChange={(e) =>
                    setNewStudentForm({ ...newStudentForm, classId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="">-- Tanpa Rombel (Tersedia) --</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.studentCount} Siswa)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddStudentOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-md font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold"
                >
                  Tambah Siswa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: EDIT SISWA (Client-First)                                     */}
      {/* ==================================================================== */}
      {editStudentModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-600" />
                Edit Data Siswa
              </h3>
              <button
                onClick={() => setEditStudentModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditStudent} className="space-y-3 pt-3 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  required
                  value={editStudentModal.name}
                  onChange={(e) =>
                    setEditStudentModal({ ...editStudentModal, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    NISN
                  </label>
                  <input
                    type="text"
                    value={editStudentModal.nisn}
                    onChange={(e) =>
                      setEditStudentModal({ ...editStudentModal, nisn: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Jenis Kelamin
                  </label>
                  <select
                    value={editStudentModal.gender}
                    onChange={(e) =>
                      setEditStudentModal({
                        ...editStudentModal,
                        gender: e.target.value as 'L' | 'P',
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Nomor HP / WhatsApp
                </label>
                <input
                  type="text"
                  value={editStudentModal.phone || ''}
                  onChange={(e) =>
                    setEditStudentModal({ ...editStudentModal, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditStudentModal(null)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-md font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: TAMBAH ROMBEL (Client-First)                                  */}
      {/* ==================================================================== */}
      {isAddClassOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full p-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <School className="w-4 h-4 text-indigo-600" />
                Tambah Rombel Baru
              </h3>
              <button
                onClick={() => setIsAddClassOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-3 pt-3 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Nama Rombel *
                </label>
                <input
                  type="text"
                  required
                  value={newClassForm.name}
                  onChange={(e) =>
                    setNewClassForm({ ...newClassForm, name: e.target.value })
                  }
                  placeholder="Contoh: VII-A atau X-MIPA-1"
                  className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Tingkat (Grade)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={newClassForm.grade}
                    onChange={(e) =>
                      setNewClassForm({
                        ...newClassForm,
                        grade: Number(e.target.value) || 7,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Seksi / Section
                  </label>
                  <input
                    type="text"
                    value={newClassForm.section}
                    onChange={(e) =>
                      setNewClassForm({ ...newClassForm, section: e.target.value })
                    }
                    placeholder="Contoh: A"
                    className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddClassOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-md font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold"
                >
                  Buat Rombel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
