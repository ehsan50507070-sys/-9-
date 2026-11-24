// Phase 1.5 Core Module: Dedicated Student Entry & School Directory («مدیریت دانش‌آموزان، کلاس‌ها و کادر»)
import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowLeftRight,
  BookOpen,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  GraduationCap,
  KeyRound,
  Lock,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { buildUtf8BomCsv, downloadTextFile } from '../../lib/csv';
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import { getTodayJalali, PERSIAN_WEEKDAY_NAMES } from '../../lib/jalali';
import { copyTextToClipboard } from '../../lib/messenger';
import type {
  ClassRoom,
  PeriodNumber,
  PersianWeekdayIndex,
  ScheduleSlot,
  Student,
  Teacher,
} from '../../types/domain';
import { useAcademicYear } from '../academic-year/AcademicYearContext';
import {
  createStudentWithInitialCredentials,
  ensureStudentDualCredentials,
} from '../auth/authService';
import { useSchoolData } from '../data/DataContext';
import { PrintShell } from '../export/PrintShell';
import { PrintIconButton } from '../print/PrintIconButton';
import { escapeHtml, sanitizeText } from '../security/sanitize';
import { useToast } from '../ui/ToastContext';
import {
  validateClassFormInput,
  validateStudentFormInput,
  validateTeacherFormInput,
} from '../validation/validators';
import {
  buildImportReportPrintHtml,
  buildStandardStudentTemplateCsv,
  buildStandardTeacherTemplateCsv,
  buildStudentsFromValidImportRows,
  buildTeachersFromValidImportRows,
  parseAndValidateStudentCsv,
  parseAndValidateTeacherCsv,
  type SmartImportRowStatus,
  type SmartImportSummary,
  type SmartStudentImportRow,
  type SmartTeacherImportRow,
} from './smartCsvImport';

type DirectoryTab = 'students' | 'classes' | 'teachers';

const GRADE_OPTIONS: Array<{ value: 2 | 3 | 4 | 5 | 6; label: string }> = [
  { value: 2, label: 'پایه دوم' },
  { value: 3, label: 'پایه سوم' },
  { value: 4, label: 'پایه چهارم' },
  { value: 5, label: 'پایه پنجم' },
  { value: 6, label: 'پایه ششم' },
];

export const SchoolDirectoryPage: React.FC = () => {
  const {
    activeSchool,
    activeSchoolId,
    classes,
    students,
    teachers,
    schedules,
    studentTransferLogs,
    upsertStudent,
    setStudentActiveStatus,
    deleteStudentPermanently,
    importStudentsBatch,
    importTeachersBatch,
    transferStudentsToClass,
    upsertClassRoom,
    upsertTeacherWithSchedule,
  } = useSchoolData();
  const { isViewingArchivedYear } = useAcademicYear();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<DirectoryTab>('students');

  // --- Tab 1: Students State ---
  const [studentClassFilter, setStudentClassFilter] = useState<string>('all');
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [studentModalOpen, setStudentModalOpen] = useState<boolean>(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [newlyCreatedCreds, setNewlyCreatedCreds] = useState<{
    studentName: string;
    className: string;
    studentUsername: string;
    studentPassword: string;
    parentUsername: string;
    parentPassword: string;
    nationalId: string;
  } | null>(null);
  const [studentPrintMode, setStudentPrintMode] = useState<'roster' | 'credentials'>('roster');

  // Student form fields
  const [stFullName, setStFullName] = useState('');
  const [stNationalId, setStNationalId] = useState('');
  const [stClassId, setStClassId] = useState(classes[0]?.id ?? '');
  const [stParentName, setStParentName] = useState('');
  const [stParentMobile, setStParentMobile] = useState('');
  const [stBirthDate, setStBirthDate] = useState('');
  const [stNotes, setStNotes] = useState('');
  const [stErrors, setStErrors] = useState<string[]>([]);

  // Smart 3-Category CSV/Excel Importer (Students + Teachers)
  const csvFileInputRef = useRef<HTMLInputElement | null>(null);
  const teacherCsvFileInputRef = useRef<HTMLInputElement | null>(null);
  const [csvModalMode, setCsvModalMode] = useState<null | 'students' | 'teachers'>(null);
  const [csvPasteText, setCsvPasteText] = useState('');
  const [csvFilterStatus, setCsvFilterStatus] = useState<'all' | SmartImportRowStatus>('all');
  const [studentImportSummary, setStudentImportSummary] =
    useState<SmartImportSummary<SmartStudentImportRow> | null>(null);
  const [teacherImportSummary, setTeacherImportSummary] =
    useState<SmartImportSummary<SmartTeacherImportRow> | null>(null);

  // Mid-Year Safe Class Transfer Modal
  const [transferStudent, setTransferStudent] = useState<Student | null>(null);
  const [transferTargetClassId, setTransferTargetClassId] = useState<string>('');
  const [transferReason, setTransferReason] = useState<string>('');

  // --- Tab 2: Classes State ---
  const [classModalOpen, setClassModalOpen] = useState<boolean>(false);
  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null);
  const [clsName, setClsName] = useState('');
  const [clsGradeLevel, setClsGradeLevel] = useState<2 | 3 | 4 | 5 | 6>(2);
  const [clsCustomGrade, setClsCustomGrade] = useState('');
  const [clsSection, setClsSection] = useState('ب');
  const [clsRoomCode, setClsRoomCode] = useState('');
  const [clsCapacity, setClsCapacity] = useState('24');
  const [clsHomeroomTeacherId, setClsHomeroomTeacherId] = useState('');
  const [clsErrors, setClsErrors] = useState<string[]>([]);

  // --- Tab 3: Teachers State ---
  const [teacherModalOpen, setTeacherModalOpen] = useState<boolean>(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [tFullName, setTFullName] = useState('');
  const [tNationalId, setTNationalId] = useState('');
  const [tMobile, setTMobile] = useState('');
  const [tSpecialty, setTSpecialty] = useState('');
  const [tQuota, setTQuota] = useState('16');
  const [tAssignedClassIds, setTAssignedClassIds] = useState<string[]>([]);
  // Weekly slot grid: key `${weekday}:${period}` -> classId (or '' for free)
  const [tScheduleGrid, setTScheduleGrid] = useState<Record<string, string>>({});
  const [tErrors, setTErrors] = useState<string[]>([]);

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const teacherMap = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);

  const activeStudentsCount = useMemo(() => students.filter((s) => s.active).length, [students]);
  const archivedStudentsCount = useMemo(() => students.filter((s) => !s.active).length, [students]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim();
    const qAscii = toAsciiDigits(q);
    return students.filter((s) => {
      if (showArchived ? s.active : !s.active) return false;
      if (studentClassFilter !== 'all' && s.classId !== studentClassFilter) return false;
      if (!q) return true;
      return (
        s.fullName.includes(q) ||
        s.parentName.includes(q) ||
        s.nationalId.includes(qAscii) ||
        s.studentCode.includes(qAscii) ||
        s.parentMobile.includes(qAscii)
      );
    });
  }, [students, showArchived, studentClassFilter, studentSearch]);

  // --- Student Handlers ---
  const openAddStudentModal = () => {
    setEditingStudent(null);
    setStFullName('');
    setStNationalId('');
    setStClassId(studentClassFilter !== 'all' ? studentClassFilter : (classes[0]?.id ?? ''));
    setStParentName('');
    setStParentMobile('');
    setStBirthDate('');
    setStNotes('');
    setStErrors([]);
    setStudentModalOpen(true);
  };

  const openEditStudentModal = (student: Student) => {
    setEditingStudent(student);
    setStFullName(student.fullName);
    setStNationalId(student.nationalId);
    setStClassId(student.classId);
    setStParentName(student.parentName);
    setStParentMobile(student.parentMobile);
    setStBirthDate(student.birthDateJalali ?? '');
    setStNotes(student.emergencyNotes ?? '');
    setStErrors([]);
    setStudentModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const existingNatIds = students
      .filter((s) => !editingStudent || s.id !== editingStudent.id)
      .map((s) => s.nationalId);

    const validation = validateStudentFormInput(
      {
        fullName: stFullName,
        nationalId: stNationalId,
        classId: stClassId,
        parentName: stParentName,
        parentMobile: stParentMobile,
        birthDateJalali: stBirthDate,
        emergencyNotes: stNotes,
      },
      existingNatIds
    );

    if (!validation.valid || !validation.data) {
      setStErrors(validation.errors);
      return;
    }

    const nextCode =
      editingStudent?.studentCode ??
      `${activeSchoolId.replace(/\D/g, '') || '1'}40${String(students.length + 51).padStart(2, '0')}`;

    const baseRecord: Student = {
      id: editingStudent?.id ?? `${activeSchoolId}-s-${Date.now()}`,
      schoolId: activeSchoolId,
      classId: validation.data.classId,
      fullName: validation.data.fullName,
      nationalId: validation.data.nationalId,
      studentCode: nextCode,
      parentName: validation.data.parentName,
      parentMobile: validation.data.parentMobile,
      birthDateJalali: validation.data.birthDateJalali,
      emergencyNotes: validation.data.emergencyNotes,
      studentUsername: editingStudent?.studentUsername,
      studentPasswordHash: editingStudent?.studentPasswordHash,
      studentPasswordSalt: editingStudent?.studentPasswordSalt,
      parentUsername: editingStudent?.parentUsername,
      parentPasswordHash: editingStudent?.parentPasswordHash,
      parentPasswordSalt: editingStudent?.parentPasswordSalt,
      active: editingStudent ? editingStudent.active : true,
    };

    const createdBundle = !editingStudent
      ? await createStudentWithInitialCredentials(baseRecord)
      : null;
    const record: Student = createdBundle
      ? createdBundle.student
      : ensureStudentDualCredentials(baseRecord);

    const res = await upsertStudent(record);
    if (!res.ok) {
      setStErrors([res.errorFa ?? 'خطا در ذخیره اطلاعات دانش‌آموز.']);
      return;
    }

    setStudentModalOpen(false);
    if (!editingStudent && createdBundle) {
      const clsName = classMap.get(record.classId)?.name ?? '';
      setNewlyCreatedCreds({
        studentName: record.fullName,
        className: clsName,
        studentUsername: record.studentUsername ?? `st-${record.nationalId}`,
        studentPassword: createdBundle.initialStudentPassword,
        parentUsername: record.parentUsername ?? `pr-${record.nationalId}`,
        parentPassword: createdBundle.initialParentPassword,
        nationalId: record.nationalId,
      });
      showToast(
        `دانش‌آموز «${record.fullName}» ثبت شد و رمز اولیه مجزای دانش‌آموز و ولی (نمایش یک‌باره) تولید گردید.`
      );
    } else {
      showToast(`مشخصات «${record.fullName}» با موفقیت به‌روزرسانی شد.`);
    }
  };

  // --- Smart 3-Category Excel/CSV Bulk Import (Students & Teachers) ---
  const runSmartStudentCsvParse = (rawText: string) => {
    const summary = parseAndValidateStudentCsv({
      csvText: rawText,
      classes,
      existingStudents: students,
    });
    if (summary.rows.length === 0) {
      showToast('فایل یا متن واردشده فاقد ردیف داده است.', 'warning');
      return;
    }
    setStudentImportSummary(summary);
    setTeacherImportSummary(null);
    setCsvFilterStatus('all');
    setCsvModalMode('students');
  };

  const runSmartTeacherCsvParse = (rawText: string) => {
    const summary = parseAndValidateTeacherCsv({
      csvText: rawText,
      classes,
      existingTeachers: teachers,
    });
    if (summary.rows.length === 0) {
      showToast('فایل یا متن همکاران فاقد ردیف داده است.', 'warning');
      return;
    }
    setTeacherImportSummary(summary);
    setStudentImportSummary(null);
    setCsvFilterStatus('all');
    setCsvModalMode('teachers');
  };

  const handleCsvFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setCsvPasteText(text);
      runSmartStudentCsvParse(text);
    } finally {
      event.target.value = '';
    }
  };

  const handleTeacherCsvFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setCsvPasteText(text);
      runSmartTeacherCsvParse(text);
    } finally {
      event.target.value = '';
    }
  };

  const handleConfirmSmartImport = async () => {
    if (isViewingArchivedYear) return;
    if (csvModalMode === 'students' && studentImportSummary) {
      const validRows = studentImportSummary.rows.filter((r) => r.status === 'valid');
      if (validRows.length === 0) {
        showToast('هیچ ردیف سالم و آماده‌ای برای ثبت وجود ندارد.', 'warning');
        return;
      }
      const newStudents = buildStudentsFromValidImportRows({
        validRows,
        schoolId: activeSchoolId,
        existingCount: students.length,
      });
      const res = await importStudentsBatch(newStudents);
      if (!res.ok) {
        showToast(res.errorFa ?? 'عدم دسترسی برای ورود گروهی.', 'error');
        return;
      }
      setCsvModalMode(null);
      setStudentImportSummary(null);
      setCsvPasteText('');
      showToast(
        `${toPersianDigits(newStudents.length)} دانش‌آموز سالم ثبت شدند و نام کاربری و رمزهای مجزای امن برای آنان ایجاد شد.`
      );
    } else if (csvModalMode === 'teachers' && teacherImportSummary) {
      const validRows = teacherImportSummary.rows.filter((r) => r.status === 'valid');
      if (validRows.length === 0) {
        showToast('هیچ ردیف سالمی در فهرست معلمان وجود ندارد.', 'warning');
        return;
      }
      const newTeachers = buildTeachersFromValidImportRows({
        validRows,
        schoolId: activeSchoolId,
      });
      const res = await importTeachersBatch(newTeachers);
      if (!res.ok) {
        showToast(res.errorFa ?? 'عدم دسترسی برای ورود گروهی معلمان.', 'error');
        return;
      }
      setCsvModalMode(null);
      setTeacherImportSummary(null);
      setCsvPasteText('');
      showToast(`${toPersianDigits(newTeachers.length)} معلم و همکار جدید با موفقیت ثبت شدند.`);
    }
  };

  const handleConfirmMidYearTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferStudent || !transferTargetClassId || isViewingArchivedYear) return;
    if (transferTargetClassId === transferStudent.classId) {
      showToast('کلاس مقصد باید متفاوت از کلاس فعلی دانش‌آموز باشد.', 'warning');
      return;
    }
    const res = await transferStudentsToClass(
      [transferStudent.id],
      transferTargetClassId,
      sanitizeText(transferReason, 240)
    );
    if (!res.ok) {
      showToast(res.errorFa ?? 'امکان انتقال کلاس نبود.', 'warning');
      return;
    }
    const targetName = classMap.get(transferTargetClassId)?.name ?? '';
    setTransferStudent(null);
    setTransferTargetClassId('');
    setTransferReason('');
    showToast(
      `انتقال امن «${transferStudent.fullName}» به «${targetName}» انجام شد و تمام نمرات و حضور و غیاب‌های قبلی با برچسب کلاس پیشین حفظ گردید.`
    );
  };

  const buildDualCredentialCopyText = (st: Student): string => {
    const normalized = ensureStudentDualCredentials(st);
    const clsName = classMap.get(st.classId)?.name ?? 'نامشخص';
    return [
      `مشخصات ورود به سامانه ${activeSchool.name}`,
      `دانش‌آموز: ${normalized.fullName}`,
      `کلاس: ${clsName}`,
      `----------------`,
      `حساب کاربری دانش‌آموز (تکالیف، کلاس وارونه، آزمون و کلاس آنلاین):`,
      `نام کاربری دانش‌آموز: ${normalized.studentUsername}`,
      `رمز عبور: رمزگذاری‌شده و محرمانه (رمز اولیه: کد ملی دانش‌آموز)`,
      `----------------`,
      `حساب کاربری ولی (مشاهده کارنامه، حضور و گفت‌وگوی اختصاصی با معلم و مدیر):`,
      `نام کاربری ولی: ${normalized.parentUsername} (یا کد ملی: ${normalized.nationalId})`,
      `رمز عبور ولی: رمزگذاری‌شده و مجزا (ارائه‌شده هنگام ثبت‌نام)`,
    ].join('\n');
  };

  const handleExportStudentsCsv = () => {
    const headers = [
      'نام و نام خانوادگی',
      'کد ملی',
      'کلاس',
      'نام ولی',
      'موبایل ولی',
      'تاریخ تولد شمسی',
      'نام کاربری دانش‌آموز',
      'وضعیت رمز دانش‌آموز',
      'نام کاربری ولی',
      'وضعیت رمز ولی',
      'یادداشت',
    ];
    const rows = filteredStudents.map((raw) => {
      const s = ensureStudentDualCredentials(raw);
      return [
        s.fullName,
        s.nationalId,
        classMap.get(s.classId)?.name ?? '',
        s.parentName,
        s.parentMobile,
        s.birthDateJalali ?? '',
        s.studentUsername ?? '',
        'رمزگذاری‌شده (محرمانه)',
        s.parentUsername ?? '',
        'رمزگذاری‌شده (محرمانه)',
        s.emergencyNotes ?? '',
      ];
    });
    const csv = buildUtf8BomCsv(headers, rows);
    downloadTextFile(`students-${activeSchoolId}.csv`, csv, 'text/csv;charset=utf-8');
    showToast('فهرست دانش‌آموزان و نام‌های کاربری (CSV امن) دریافت شد.');
  };

  const handleDownloadCsvTemplate = () => {
    const csv = buildStandardStudentTemplateCsv(classes[0]?.name);
    downloadTextFile('students-standard-template-fa.csv', csv, 'text/csv;charset=utf-8');
    showToast('فایل نمونه استاندارد فارسی دانش‌آموزان (UTF-8 BOM) دریافت شد.');
  };

  const handleDownloadTeacherTemplate = () => {
    const csv = buildStandardTeacherTemplateCsv(classes[0]?.name);
    downloadTextFile('teachers-standard-template-fa.csv', csv, 'text/csv;charset=utf-8');
    showToast('فایل نمونه استاندارد فارسی معلمان و کادر (UTF-8 BOM) دریافت شد.');
  };

  const smartImportReportPrintHtml = useMemo(() => {
    if (csvModalMode === 'students' && studentImportSummary) {
      return buildImportReportPrintHtml({
        title: 'گزارش ورود گروهی دانش‌آموزان از اکسل',
        schoolName: activeSchool.name,
        jalaliDate: getTodayJalali(),
        validCount: studentImportSummary.validCount,
        incompleteCount: studentImportSummary.incompleteCount,
        duplicateCount: studentImportSummary.duplicateCount,
        rows: studentImportSummary.rows.map((r) => ({
          rowNumber: r.rowNumber,
          fullName: r.fullName,
          nationalId: r.nationalId,
          extraInfo: `${r.className} · ولی: ${r.parentName} (${toPersianDigits(r.parentMobile || '—')})`,
          status: r.status,
          reasons: r.reasons,
        })),
      });
    }
    if (csvModalMode === 'teachers' && teacherImportSummary) {
      return buildImportReportPrintHtml({
        title: 'گزارش ورود گروهی معلمان و کادر از اکسل',
        schoolName: activeSchool.name,
        jalaliDate: getTodayJalali(),
        validCount: teacherImportSummary.validCount,
        incompleteCount: teacherImportSummary.incompleteCount,
        duplicateCount: teacherImportSummary.duplicateCount,
        rows: teacherImportSummary.rows.map((r) => ({
          rowNumber: r.rowNumber,
          fullName: r.fullName,
          nationalId: r.nationalId,
          extraInfo: `${r.specialty} · موبایل: ${toPersianDigits(r.mobile || '—')}`,
          status: r.status,
          reasons: r.reasons,
        })),
      });
    }
    return '';
  }, [csvModalMode, studentImportSummary, teacherImportSummary, activeSchool.name]);

  const transferLogsPrintHtml = useMemo(() => {
    const rows = studentTransferLogs
      .map(
        (log, i) => `
      <tr>
        <td style="text-align:center;">${toPersianDigits(i + 1)}</td>
        <td>${escapeHtml(log.studentName)}</td>
        <td>${escapeHtml(log.fromClassName)}</td>
        <td>${escapeHtml(log.toClassName)}</td>
        <td style="text-align:center;">${escapeHtml(toPersianDigits(log.transferDateJalali))}</td>
        <td style="text-align:center;">${toPersianDigits(log.preservedGradesCount)} نمره / ${toPersianDigits(log.preservedAttendanceCount)} حضور</td>
        <td>${escapeHtml(log.reason || '—')}</td>
      </tr>`
      )
      .join('');
    return `
      <div dir="rtl" style="font-family:Vazirmatn,Tahoma,sans-serif;color:#0f172a;">
        <h2 style="margin:0 0 6px;font-size:16px;">تاریخچه انتقال امن کلاس دانش‌آموزان — ${escapeHtml(activeSchool.name)}</h2>
        <p style="margin:0 0 12px;font-size:12px;color:#475569;">تاریخ چاپ: ${escapeHtml(toPersianDigits(getTodayJalali()))}</p>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="border:1px solid #cbd5e1;padding:6px;">ردیف</th>
              <th style="border:1px solid #cbd5e1;padding:6px;">نام دانش‌آموز</th>
              <th style="border:1px solid #cbd5e1;padding:6px;">کلاس مبدأ</th>
              <th style="border:1px solid #cbd5e1;padding:6px;">کلاس مقصد</th>
              <th style="border:1px solid #cbd5e1;padding:6px;">تاریخ انتقال</th>
              <th style="border:1px solid #cbd5e1;padding:6px;">سوابق حفظ‌شده</th>
              <th style="border:1px solid #cbd5e1;padding:6px;">علت</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }, [studentTransferLogs, activeSchool.name]);

  // --- Class Handlers ---
  const openAddClassModal = () => {
    setEditingClass(null);
    setClsGradeLevel(2);
    setClsCustomGrade('');
    setClsSection('ب');
    setClsName('پایه دوم - کلاس ب');
    setClsRoomCode(`${(activeSchoolId.replace(/\D/g, '') || '1')}0${classes.length + 2}`);
    setClsCapacity('24');
    setClsHomeroomTeacherId(teachers[0]?.id ?? '');
    setClsErrors([]);
    setClassModalOpen(true);
  };

  const openEditClassModal = (cls: ClassRoom) => {
    setEditingClass(cls);
    setClsName(cls.name);
    setClsGradeLevel(cls.gradeLevel);
    setClsCustomGrade(cls.customGradeLabel ?? '');
    setClsSection(cls.section);
    setClsRoomCode(cls.roomCode);
    setClsCapacity(String(cls.capacity));
    setClsHomeroomTeacherId(cls.homeroomTeacherId);
    setClsErrors([]);
    setClassModalOpen(true);
  };

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateClassFormInput({
      name: clsName,
      gradeLevel: clsGradeLevel,
      customGradeLabel: clsCustomGrade,
      section: clsSection,
      homeroomTeacherId: clsHomeroomTeacherId,
      capacity: Number(toAsciiDigits(clsCapacity)),
      roomCode: clsRoomCode,
    });
    if (!validation.valid || !validation.data) {
      setClsErrors(validation.errors);
      return;
    }

    const record: ClassRoom = {
      id: editingClass?.id ?? `${activeSchoolId}-c-${Date.now()}`,
      schoolId: activeSchoolId,
      name: validation.data.name,
      gradeLevel: validation.data.gradeLevel,
      customGradeLabel: validation.data.customGradeLabel,
      section: validation.data.section,
      homeroomTeacherId: validation.data.homeroomTeacherId,
      capacity: validation.data.capacity,
      roomCode: validation.data.roomCode,
    };

    const res = await upsertClassRoom(record);
    if (!res.ok) {
      setClsErrors([res.errorFa ?? 'خطا در ذخیره کلاس.']);
      return;
    }

    setClassModalOpen(false);
    showToast(editingClass ? `کلاس «${record.name}» ویرایش شد.` : `کلاس جدید «${record.name}» اضافه شد.`);
  };

  // --- Teacher Handlers ---
  const openAddTeacherModal = () => {
    setEditingTeacher(null);
    setTFullName('');
    setTNationalId('');
    setTMobile('');
    setTSpecialty('');
    setTQuota('16');
    setTAssignedClassIds(classes[0] ? [classes[0].id] : []);
    setTScheduleGrid({});
    setTErrors([]);
    setTeacherModalOpen(true);
  };

  const openEditTeacherModal = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setTFullName(teacher.fullName);
    setTNationalId(teacher.nationalId);
    setTMobile(teacher.mobile);
    setTSpecialty(teacher.specialty);
    setTQuota(String(teacher.weeklyQuotaPeriods));
    setTAssignedClassIds([...teacher.assignedClassIds]);

    const grid: Record<string, string> = {};
    for (const slot of schedules) {
      if (slot.teacherId === teacher.id) {
        grid[`${slot.weekday}:${slot.period}`] = slot.classId;
      }
    }
    setTScheduleGrid(grid);
    setTErrors([]);
    setTeacherModalOpen(true);
  };

  const toggleTeacherAssignedClass = (classId: string) => {
    setTAssignedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    const existingNatIds = teachers
      .filter((t) => !editingTeacher || t.id !== editingTeacher.id)
      .map((t) => t.nationalId);

    const validation = validateTeacherFormInput(
      {
        fullName: tFullName,
        nationalId: tNationalId,
        mobile: tMobile,
        specialty: tSpecialty,
        assignedClassIds: tAssignedClassIds,
        weeklyQuotaPeriods: Number(toAsciiDigits(tQuota)),
      },
      existingNatIds
    );
    if (!validation.valid || !validation.data) {
      setTErrors(validation.errors);
      return;
    }

    const teacherId = editingTeacher?.id ?? `${activeSchoolId}-t-${Date.now()}`;
    const teacherRecord: Teacher = {
      id: teacherId,
      schoolId: activeSchoolId,
      fullName: validation.data.fullName,
      nationalId: validation.data.nationalId,
      personnelCode:
        editingTeacher?.personnelCode ??
        `${activeSchoolId.replace(/\D/g, '') || '1'}0${String(teachers.length + 21).padStart(2, '0')}`,
      mobile: validation.data.mobile,
      specialty: validation.data.specialty,
      assignedClassIds: validation.data.assignedClassIds,
      weeklyQuotaPeriods: validation.data.weeklyQuotaPeriods,
      active: editingTeacher ? editingTeacher.active : true,
    };

    // Build schedule slots from interactive 4-period grid
    const teacherSlots: ScheduleSlot[] = [];
    for (const [key, assignedClassId] of Object.entries(tScheduleGrid)) {
      if (!assignedClassId) continue;
      const [wdStr, pStr] = key.split(':');
      const weekday = Number(wdStr) as PersianWeekdayIndex;
      const period = Number(pStr) as PeriodNumber;
      teacherSlots.push({
        id: `${activeSchoolId}:sched:${weekday}:${period}:${teacherId}:${assignedClassId}`,
        schoolId: activeSchoolId,
        weekday,
        period,
        classId: assignedClassId,
        teacherId,
        subjectName: teacherRecord.specialty,
      });
    }

    const res = await upsertTeacherWithSchedule(teacherRecord, teacherSlots);
    if (!res.ok) {
      setTErrors([res.errorFa ?? 'خطا در ذخیره اطلاعات معلم.']);
      return;
    }

    setTeacherModalOpen(false);
    showToast(
      editingTeacher
        ? `اطلاعات و برنامه «${teacherRecord.fullName}» به‌روزرسانی شد.`
        : `همکار جدید «${teacherRecord.fullName}» ثبت شد و در حضور کادر و جایگزینی فعال است.`
    );
  };

  const selectedClassNameForPrint =
    studentClassFilter === 'all'
      ? 'کل دانش‌آموزان مدرسه'
      : (classMap.get(studentClassFilter)?.name ?? 'کلاس انتخابی');

  const printDocumentTitle =
    activeTab === 'classes'
      ? `فهرست کلاس‌های ${activeSchool.name}`
      : activeTab === 'teachers'
        ? `فهرست کادر و معلمان ${activeSchool.name}`
        : studentPrintMode === 'credentials'
          ? `مشخصات ورود مجزای دانش‌آموز و ولی — ${selectedClassNameForPrint}`
          : `فهرست رسمی دانش‌آموزان — ${selectedClassNameForPrint}`;

  return (
    <PrintShell
      school={activeSchool}
      documentTitle={printDocumentTitle}
      subtitle={`تعداد: ${toPersianDigits(
        activeTab === 'classes'
          ? classes.length
          : activeTab === 'teachers'
            ? teachers.length
            : filteredStudents.length
      )} مورد | سال تحصیلی ${toPersianDigits(activeSchool.academicYear)}`}
      landscape={false}
    >
      <div className="space-y-6">
        {/* Page Header */}
        <div className="no-print flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              مدیریت دانش‌آموزان، کلاس‌ها و کادر
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              ثبت و ویرایش اختصاصی «{activeSchool.name}» با ایجاد خودکار دو حساب مجزای «دانش‌آموز» و
              «ولی» و اتصال لحظه‌ای به تمام ماژول‌ها.
            </p>
          </div>

          {/* 3-Tab Segmented Switcher */}
          <div
            role="tablist"
            aria-label="بخش‌های مدیریت مدرسه"
            className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 gap-1 self-start lg:self-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'students'}
              onClick={() => setActiveTab('students')}
              className={`min-h-[40px] px-3.5 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'students'
                  ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <GraduationCap className="w-4 h-4 shrink-0" />
              <span>دانش‌آموزان ({toPersianDigits(activeStudentsCount)})</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'classes'}
              onClick={() => setActiveTab('classes')}
              className={`min-h-[40px] px-3.5 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'classes'
                  ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>کلاس‌ها ({toPersianDigits(classes.length)})</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'teachers'}
              onClick={() => setActiveTab('teachers')}
              className={`min-h-[40px] px-3.5 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'teachers'
                  ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>معلمان و کادر ({toPersianDigits(teachers.length)})</span>
            </button>
          </div>
        </div>

        {/* Newly Created Dual Credentials Callout (Student + Parent) */}
        {newlyCreatedCreds && activeTab === 'students' && (
          <div
            role="status"
            data-testid="new-parent-credentials"
            className="no-print rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-3">
              <KeyRound className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <div className="font-bold text-emerald-900 dark:text-emerald-200">
                  دو حساب مجزای «دانش‌آموز» و «ولی» برای «{newlyCreatedCreds.studentName}» ایجاد شد
                </div>
                <div className="text-xs text-emerald-800 dark:text-emerald-300 tabular-nums space-y-0.5">
                  <div>
                    <strong>حساب دانش‌آموز:</strong> نام کاربری{' '}
                    <strong dir="ltr" className="font-mono">
                      {newlyCreatedCreds.studentUsername}
                    </strong>{' '}
                    · رمز{' '}
                    <strong dir="ltr" className="font-mono">
                      {toPersianDigits(newlyCreatedCreds.studentPassword)}
                    </strong>
                  </div>
                  <div>
                    <strong>حساب ولی:</strong> نام کاربری{' '}
                    <strong dir="ltr" className="font-mono">
                      {newlyCreatedCreds.parentUsername}
                    </strong>{' '}
                    (یا کد ملی {toPersianDigits(newlyCreatedCreds.nationalId)}) · رمز{' '}
                    <strong dir="ltr" className="font-mono">
                      {toPersianDigits(newlyCreatedCreds.parentPassword)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  const text = [
                    `مشخصات ورود به سامانه ${activeSchool.name}`,
                    `دانش‌آموز: ${newlyCreatedCreds.studentName}`,
                    `کلاس: ${newlyCreatedCreds.className}`,
                    `----------------`,
                    `حساب کاربری دانش‌آموز:`,
                    `نام کاربری: ${newlyCreatedCreds.studentUsername}`,
                    `رمز عبور: ${newlyCreatedCreds.studentPassword}`,
                    `----------------`,
                    `حساب کاربری ولی (پدر / مادر):`,
                    `نام کاربری: ${newlyCreatedCreds.parentUsername} (یا کد ملی ${newlyCreatedCreds.nationalId})`,
                    `رمز عبور: ${newlyCreatedCreds.parentPassword}`,
                  ].join('\n');
                  await copyTextToClipboard(text);
                  showToast('مشخصات هر دو حساب (دانش‌آموز و ولی) کپی شد.');
                }}
                className="min-h-[38px] px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Copy className="w-3.5 h-3.5" />
                کپی مشخصات ورود
              </button>
              <button
                type="button"
                onClick={() => setNewlyCreatedCreds(null)}
                aria-label="بستن اعلان"
                className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ==================== TAB 1: STUDENTS ==================== */}
        {activeTab === 'students' && (
          <div className="no-print space-y-4">
            {/* Action Toolbar */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isViewingArchivedYear}
                    onClick={openAddStudentModal}
                    className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    ثبت دانش‌آموز جدید
                  </button>

                  <input
                    ref={csvFileInputRef}
                    type="file"
                    accept=".csv,.txt,text/csv"
                    onChange={(e) => void handleCsvFileSelected(e)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isViewingArchivedYear}
                    onClick={() => csvFileInputRef.current?.click()}
                    className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 text-slate-700 dark:text-slate-200 text-sm font-medium px-3.5 py-2 transition-colors whitespace-nowrap"
                  >
                    <Upload className="w-4 h-4 shrink-0" />
                    ورود هوشمند اکسل (CSV)
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadCsvTemplate}
                    className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium px-3 py-2 transition-colors whitespace-nowrap"
                  >
                    دانلود فایل نمونه استاندارد فارسی
                  </button>
                  {isViewingArchivedYear && (
                    <span className="inline-flex items-center gap-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                      <Lock className="w-3.5 h-3.5" />
                      سال آرشیو
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportStudentsCsv}
                    className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium px-3.5 py-2 transition-colors whitespace-nowrap"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    خروجی اکسل
                  </button>
                  <select
                    aria-label="نوع سند چاپی دانش‌آموزان"
                    value={studentPrintMode}
                    onChange={(e) => setStudentPrintMode(e.target.value as 'roster' | 'credentials')}
                    className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    <option value="roster">چاپ فهرست کلاسی</option>
                    <option value="credentials">چاپ کارت‌های ورود (دانش‌آموز و ولی)</option>
                  </select>
                  <PrintIconButton
                    documentLabel={
                      studentPrintMode === 'credentials'
                        ? 'مشخصات ورود دانش‌آموزان و اولیا'
                        : 'فهرست دانش‌آموزان'
                    }
                  />
                </div>
              </div>

              {/* Filter & Search Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="جستجوی نام، کد ملی، ولی یا موبایل..."
                    aria-label="جستجو در فهرست دانش‌آموزان"
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 pr-9 pl-3 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>

                <select
                  aria-label="فیلتر بر اساس کلاس"
                  value={studentClassFilter}
                  onChange={(e) => setStudentClassFilter(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 text-sm font-medium text-slate-900 dark:text-slate-100"
                >
                  <option value="all">همه کلاس‌های {activeSchool.name}</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} (اتاق {toPersianDigits(cls.roomCode)})
                    </option>
                  ))}
                </select>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowArchived(false)}
                    className={`min-h-[42px] px-3 rounded-xl text-xs font-semibold border transition-colors ${
                      !showArchived
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    فعال ({toPersianDigits(activeStudentsCount)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowArchived(true)}
                    className={`min-h-[42px] px-3 rounded-xl text-xs font-semibold border transition-colors ${
                      showArchived
                        ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    بایگانی‌شده ({toPersianDigits(archivedStudentsCount)})
                  </button>
                </div>
              </div>
            </div>

            {/* Student Directory Table */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              {filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  {showArchived
                    ? 'هیچ دانش‌آموز بایگانی‌شده‌ای وجود ندارد.'
                    : 'دانش‌آموزی با این مشخصات در این مدرسه یافت نشد.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                        <th className="py-3 px-4 font-semibold">دانش‌آموز</th>
                        <th className="py-3 px-3 font-semibold">حساب دانش‌آموز / حساب ولی</th>
                        <th className="py-3 px-3 font-semibold">پایه و کلاس</th>
                        <th className="py-3 px-3 font-semibold">ولی و تماس</th>
                        <th className="py-3 px-4 font-semibold text-left">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                      {filteredStudents.map((rawSt) => {
                        const st = ensureStudentDualCredentials(rawSt);
                        const cls = classMap.get(st.classId);
                        return (
                          <tr
                            key={st.id}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900 dark:text-slate-100">
                                {st.fullName}
                              </div>
                              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                کد ملی: {toPersianDigits(st.nationalId)} · کد:{' '}
                                {toPersianDigits(st.studentCode)}
                              </div>
                              {st.emergencyNotes && (
                                <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                                  یادداشت: {st.emergencyNotes}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-3">
                              <div className="space-y-1 text-xs">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-[10px]">
                                    دانش‌آموز
                                  </span>
                                  <span dir="ltr" className="font-mono text-slate-800 dark:text-slate-200">
                                    {st.studentUsername}
                                  </span>
                                  <span className="text-slate-400">·</span>
                                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                    رمز هش‌شده (محرمانه)
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                                    ولی
                                  </span>
                                  <span dir="ltr" className="font-mono text-slate-800 dark:text-slate-200">
                                    {st.parentUsername}
                                  </span>
                                  <span className="text-slate-400">·</span>
                                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                    رمز هش‌شده (مجزا)
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300">
                              {cls?.name ?? 'نامشخص'}
                            </td>
                            <td className="py-3.5 px-3">
                              <div className="text-slate-800 dark:text-slate-200 font-medium">
                                {st.parentName}
                              </div>
                              <div dir="ltr" className="text-right text-xs text-slate-500 dark:text-slate-400">
                                {toPersianDigits(st.parentMobile)}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  disabled={isViewingArchivedYear || classes.length < 2}
                                  onClick={() => {
                                    const otherClass = classes.find((c) => c.id !== st.classId);
                                    setTransferStudent(st);
                                    setTransferTargetClassId(otherClass?.id ?? '');
                                    setTransferReason('');
                                  }}
                                  aria-label={`انتقال کلاس ${st.fullName}`}
                                  title="انتقال امن به کلاس دیگر (با حفظ ۱۰۰٪ سوابق قبلی)"
                                  className="min-h-[38px] px-2.5 inline-flex items-center justify-center gap-1 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50 disabled:opacity-40 text-xs font-semibold whitespace-nowrap"
                                >
                                  <ArrowLeftRight className="w-3.5 h-3.5" />
                                  <span>انتقال کلاس</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await copyTextToClipboard(buildDualCredentialCopyText(st));
                                    showToast(
                                      `مشخصات ورود دانش‌آموز و ولی برای «${st.fullName}» کپی شد.`
                                    );
                                  }}
                                  aria-label={`کپی مشخصات ورود ${st.fullName}`}
                                  title="کپی مشخصات ورود دانش‌آموز و ولی"
                                  className="min-h-[38px] px-2.5 inline-flex items-center justify-center gap-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-xs font-semibold whitespace-nowrap"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>کپی رمزها</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isViewingArchivedYear}
                                  onClick={() => openEditStudentModal(st)}
                                  aria-label={`ویرایش ${st.fullName}`}
                                  title="ویرایش مشخصات"
                                  className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  disabled={isViewingArchivedYear}
                                  onClick={async () => {
                                    const res = await setStudentActiveStatus(st.id, !st.active);
                                    if (res.ok) {
                                      showToast(
                                        st.active
                                          ? `«${st.fullName}» به بایگانی منتقل شد.`
                                          : `«${st.fullName}» به فهرست فعال بازگردانده شد.`,
                                        'info'
                                      );
                                    }
                                  }}
                                  aria-label={st.active ? `بایگانی ${st.fullName}` : `بازگردانی ${st.fullName}`}
                                  title={st.active ? 'بایگانی (غیرفعال‌سازی)' : 'بازگردانی به فعال'}
                                  className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/40 disabled:opacity-40"
                                >
                                  {st.active ? (
                                    <Archive className="w-4 h-4" />
                                  ) : (
                                    <RotateCcw className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  disabled={isViewingArchivedYear}
                                  onClick={async () => {
                                    const res = await deleteStudentPermanently(st.id);
                                    if (res.ok) {
                                      showToast(`دانش‌آموز «${st.fullName}» حذف شد.`, 'info');
                                    }
                                  }}
                                  aria-label={`حذف ${st.fullName}`}
                                  title="حذف کامل"
                                  className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-40"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Safe Mid-Year Class Transfer History Log */}
            {studentTransferLogs.length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      تاریخچه انتقال‌های امن میانه سال ({toPersianDigits(studentTransferLogs.length)} مورد)
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      سوابق نمرات و حضور و غیاب پیشین زیر برچسب کلاس مبدأ به‌طور کامل حفظ شده‌اند.
                    </p>
                  </div>
                  <PrintIconButton
                    compact
                    documentLabel="تاریخچه انتقال امن کلاس‌ها"
                    html={transferLogsPrintHtml}
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs border-collapse tabular-nums">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <th className="py-2 px-3">دانش‌آموز</th>
                        <th className="py-2 px-3">از کلاس</th>
                        <th className="py-2 px-3">به کلاس</th>
                        <th className="py-2 px-3">تاریخ</th>
                        <th className="py-2 px-3">سوابق حفظ‌شده</th>
                        <th className="py-2 px-3">علت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {studentTransferLogs.slice(0, 15).map((log) => (
                        <tr key={log.id}>
                          <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">
                            {log.studentName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                            {log.fromClassName}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-sky-700 dark:text-sky-400">
                            {log.toClassName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {toPersianDigits(log.transferDateJalali)}
                          </td>
                          <td className="py-2.5 px-3 text-emerald-700 dark:text-emerald-400">
                            {toPersianDigits(log.preservedGradesCount)} نمره ·{' '}
                            {toPersianDigits(log.preservedAttendanceCount)} حضور
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{log.reason || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 2: CLASSES ==================== */}
        {activeTab === 'classes' && (
          <div className="no-print space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                مدیریت کلاس‌ها، اتاق‌ها، ظرفیت و انتصاب آموزگار راهنمای هر کلاس در {activeSchool.name}.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <PrintIconButton documentLabel="فهرست کلاس‌ها" />
                <button
                  type="button"
                  disabled={isViewingArchivedYear}
                  onClick={openAddClassModal}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 transition-colors whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  افزودن کلاس جدید
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.map((cls) => {
                const count = students.filter((s) => s.classId === cls.id && s.active).length;
                const homeroom = teacherMap.get(cls.homeroomTeacherId);
                return (
                  <article
                    key={cls.id}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                            {cls.customGradeLabel ?? `پایه ${toPersianDigits(cls.gradeLevel)}`} · اتاق{' '}
                            {toPersianDigits(cls.roomCode)}
                          </div>
                          <h2 className="mt-0.5 text-base font-bold text-slate-900 dark:text-slate-100">
                            {cls.name}
                          </h2>
                        </div>
                        <button
                          type="button"
                          onClick={() => openEditClassModal(cls)}
                          aria-label={`ویرایش کلاس ${cls.name}`}
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                        <div>
                          آموزگار / معلم راهنما:{' '}
                          <strong className="text-slate-900 dark:text-slate-100">
                            {homeroom?.fullName ?? 'تعیین‌نشده'}
                          </strong>
                        </div>
                        <div className="tabular-nums">
                          تعداد دانش‌آموز فعال:{' '}
                          <strong className="text-slate-900 dark:text-slate-100">
                            {toPersianDigits(count)} نفر
                          </strong>{' '}
                          از ظرفیت {toPersianDigits(cls.capacity)} نفر
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setStudentClassFilter(cls.id);
                        setActiveTab('students');
                      }}
                      className="min-h-[40px] w-full rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      مشاهده دانش‌آموزان این کلاس
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== TAB 3: TEACHERS & STAFF ==================== */}
        {activeTab === 'teachers' && (
          <div className="no-print space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                ثبت معلمان و کادر با برنامه ۴ زنگه هفتگی (به‌محض ثبت، در حضور ۴ زنگه و جایگزینی ظاهر
                می‌شوند).
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={teacherCsvFileInputRef}
                  type="file"
                  accept=".csv,.txt,text/csv"
                  onChange={(e) => void handleTeacherCsvFileSelected(e)}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isViewingArchivedYear}
                  onClick={() => teacherCsvFileInputRef.current?.click()}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 text-slate-700 dark:text-slate-200 text-sm font-medium px-3.5 py-2 transition-colors whitespace-nowrap"
                >
                  <Upload className="w-4 h-4 shrink-0" />
                  ورود هوشمند اکسل معلمان (CSV)
                </button>
                <button
                  type="button"
                  onClick={handleDownloadTeacherTemplate}
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium px-3 py-2 transition-colors whitespace-nowrap"
                >
                  فایل نمونه فارسی معلمان
                </button>
                <PrintIconButton documentLabel="فهرست معلمان و کادر" />
                <button
                  type="button"
                  disabled={isViewingArchivedYear}
                  onClick={openAddTeacherModal}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 transition-colors whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  افزودن معلم / همکار جدید
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teachers.map((teacher) => {
                const teacherSlots = schedules.filter((s) => s.teacherId === teacher.id);
                const assignedNames = teacher.assignedClassIds
                  .map((cid) => classMap.get(cid)?.name)
                  .filter(Boolean)
                  .join('، ');

                return (
                  <article
                    key={teacher.id}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                          {teacher.fullName}
                        </h2>
                        <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                          {teacher.specialty}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openEditTeacherModal(teacher)}
                        aria-label={`ویرایش ${teacher.fullName}`}
                        className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        ویرایش و برنامه
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 tabular-nums pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div>کد ملی: {toPersianDigits(teacher.nationalId)}</div>
                      <div>موبایل: {toPersianDigits(teacher.mobile)}</div>
                      <div>کد پرسنلی: {toPersianDigits(teacher.personnelCode)}</div>
                      <div>
                        زنگ برنامه‌ریزی‌شده: {toPersianDigits(teacherSlots.length)} از{' '}
                        {toPersianDigits(teacher.weeklyQuotaPeriods)}
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      کلاس‌های محول‌شده:{' '}
                      <span className="text-slate-700 dark:text-slate-200 font-medium">
                        {assignedNames || 'همکار آزاد / بدون کلاس ثابت'}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== A4 / A5 PRINT ROSTER & CREDENTIALS ==================== */}
        <div className="print-only">
          {activeTab === 'classes' ? (
            <table>
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>نام کلاس</th>
                  <th>اتاق</th>
                  <th>آموزگار راهنما</th>
                  <th>تعداد دانش‌آموز / ظرفیت</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((cls, idx) => (
                  <tr key={cls.id}>
                    <td className="text-center tabular-nums">{toPersianDigits(idx + 1)}</td>
                    <td className="font-semibold">{cls.name}</td>
                    <td className="text-center tabular-nums">{toPersianDigits(cls.roomCode)}</td>
                    <td>{teacherMap.get(cls.homeroomTeacherId)?.fullName ?? '—'}</td>
                    <td className="text-center tabular-nums">
                      {toPersianDigits(
                        students.filter((s) => s.classId === cls.id && s.active).length
                      )}{' '}
                      / {toPersianDigits(cls.capacity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : activeTab === 'teachers' ? (
            <table>
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>نام و نام خانوادگی</th>
                  <th>تخصص</th>
                  <th>کد پرسنلی</th>
                  <th>موبایل</th>
                  <th>سقف زنگ هفتگی</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t, idx) => (
                  <tr key={t.id}>
                    <td className="text-center tabular-nums">{toPersianDigits(idx + 1)}</td>
                    <td className="font-semibold">{t.fullName}</td>
                    <td>{t.specialty}</td>
                    <td className="text-center tabular-nums">{toPersianDigits(t.personnelCode)}</td>
                    <td className="text-center tabular-nums">{toPersianDigits(t.mobile)}</td>
                    <td className="text-center tabular-nums">
                      {toPersianDigits(t.weeklyQuotaPeriods)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : studentPrintMode === 'credentials' ? (
            <table>
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>دانش‌آموز / کلاس</th>
                  <th>حساب دانش‌آموز (کاربری / رمز)</th>
                  <th>حساب ولی (کاربری / رمز)</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((rawSt, idx) => {
                  const st = ensureStudentDualCredentials(rawSt);
                  return (
                    <tr key={st.id}>
                      <td className="text-center tabular-nums">{toPersianDigits(idx + 1)}</td>
                      <td>
                        <div className="font-semibold">{st.fullName}</div>
                        <div className="text-xs">{classMap.get(st.classId)?.name ?? ''}</div>
                      </td>
                      <td className="tabular-nums">
                        <div dir="ltr">{st.studentUsername}</div>
                        <div className="text-[11px] text-slate-500">رمز: محرمانه (هش‌شده)</div>
                      </td>
                      <td className="tabular-nums">
                        <div dir="ltr">{st.parentUsername}</div>
                        <div className="text-[11px] text-slate-500">رمز: محرمانه (هش‌شده و مجزا)</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: '6%' }}>ردیف</th>
                  <th style={{ width: '24%' }}>نام و نام خانوادگی</th>
                  <th style={{ width: '16%' }}>کد ملی</th>
                  <th style={{ width: '20%' }}>کلاس</th>
                  <th style={{ width: '17%' }}>نام ولی</th>
                  <th style={{ width: '17%' }}>موبایل ولی</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((st, idx) => (
                  <tr key={st.id}>
                    <td className="text-center tabular-nums">{toPersianDigits(idx + 1)}</td>
                    <td className="font-semibold">{st.fullName}</td>
                    <td className="text-center tabular-nums">{toPersianDigits(st.nationalId)}</td>
                    <td>{classMap.get(st.classId)?.name ?? ''}</td>
                    <td>{st.parentName}</td>
                    <td className="text-center tabular-nums">{toPersianDigits(st.parentMobile)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ==================== MODAL 1: ADD / EDIT STUDENT ==================== */}
      {studentModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingStudent ? 'ویرایش دانش‌آموز' : 'ثبت دانش‌آموز جدید'}
          className="no-print fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setStudentModalOpen(false)}
        >
          <div
            className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {editingStudent ? 'ویرایش مشخصات دانش‌آموز' : `ثبت دانش‌آموز جدید (${activeSchool.name})`}
              </h2>
              <button
                type="button"
                onClick={() => setStudentModalOpen(false)}
                aria-label="بستن پنجره"
                className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {stErrors.length > 0 && (
              <div
                role="alert"
                className="mt-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-3 text-xs sm:text-sm text-rose-800 dark:text-rose-200 space-y-1"
              >
                {stErrors.map((err, i) => (
                  <div key={i}>• {err}</div>
                ))}
              </div>
            )}

            <form onSubmit={(e) => void handleSaveStudent(e)} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="st-fullname" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    نام و نام خانوادگی *
                  </label>
                  <input
                    id="st-fullname"
                    type="text"
                    value={stFullName}
                    onChange={(e) => setStFullName(e.target.value)}
                    placeholder="مثلاً کیانوش بهرامی"
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="st-natid" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    کد ملی ۱۰ رقمی *
                  </label>
                  <input
                    id="st-natid"
                    type="text"
                    dir="ltr"
                    value={stNationalId}
                    onChange={(e) => setStNationalId(e.target.value)}
                    placeholder="0012345679"
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-left tabular-nums"
                  />
                </div>

                <div>
                  <label htmlFor="st-class" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    پایه و کلاس *
                  </label>
                  <select
                    id="st-class"
                    value={stClassId}
                    onChange={(e) => setStClassId(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm"
                  >
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="st-birth" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    تاریخ تولد شمسی (اختیاری)
                  </label>
                  <input
                    id="st-birth"
                    type="text"
                    dir="ltr"
                    value={stBirthDate}
                    onChange={(e) => setStBirthDate(e.target.value)}
                    placeholder="1397/05/14"
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-left tabular-nums"
                  />
                </div>

                <div>
                  <label htmlFor="st-parent" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    نام ولی *
                  </label>
                  <input
                    id="st-parent"
                    type="text"
                    value={stParentName}
                    onChange={(e) => setStParentName(e.target.value)}
                    placeholder="مثلاً رضا بهرامی"
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="st-mobile" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    شماره موبایل ولی *
                  </label>
                  <input
                    id="st-mobile"
                    type="text"
                    dir="ltr"
                    value={stParentMobile}
                    onChange={(e) => setStParentMobile(e.target.value)}
                    placeholder="09123456789"
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-left tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="st-notes" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  یادداشت بهداشتی / آموزشی (اختیاری)
                </label>
                <textarea
                  id="st-notes"
                  rows={2}
                  value={stNotes}
                  onChange={(e) => setStNotes(e.target.value)}
                  placeholder="حساسیت غذایی، عینک، ملاحظات آموزشی یا انضباطی..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-sm"
                />
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3 text-xs text-slate-500 dark:text-slate-400 leading-5">
                پس از ثبت، دو حساب کاملاً مجزا ایجاد می‌شود: <strong>حساب کاربری دانش‌آموز</strong>{' '}
                (برای تکالیف، کلاس وارونه، آزمون و کلاس آنلاین) و <strong>حساب کاربری ولی</strong>{' '}
                (برای مشاهده کارنامه، حضور و گفت‌وگوی اختصاصی با معلم و مدیر).
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStudentModalOpen(false)}
                  className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
                >
                  {editingStudent ? 'ذخیره تغییرات' : 'ثبت دانش‌آموز و ایجاد ۲ حساب ورود'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 2: SMART 3-CATEGORY EXCEL/CSV PREVIEW (STUDENTS & TEACHERS) ==================== */}
      {csvModalMode && (studentImportSummary || teacherImportSummary) && (() => {
        const isStudents = csvModalMode === 'students';
        const validCount = isStudents
          ? (studentImportSummary?.validCount ?? 0)
          : (teacherImportSummary?.validCount ?? 0);
        const incompleteCount = isStudents
          ? (studentImportSummary?.incompleteCount ?? 0)
          : (teacherImportSummary?.incompleteCount ?? 0);
        const duplicateCount = isStudents
          ? (studentImportSummary?.duplicateCount ?? 0)
          : (teacherImportSummary?.duplicateCount ?? 0);
        const visibleRows = isStudents
          ? (studentImportSummary?.rows ?? []).filter(
              (r) => csvFilterStatus === 'all' || r.status === csvFilterStatus
            )
          : (teacherImportSummary?.rows ?? []).filter(
              (r) => csvFilterStatus === 'all' || r.status === csvFilterStatus
            );

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="پیش‌نمایش ورود هوشمند اکسل"
            className="no-print fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setCsvModalMode(null)}
          >
            <div
              className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {isStudents
                      ? `پیش‌نمایش هوشمند ورود دانش‌آموزان (${activeSchool.name})`
                      : `پیش‌نمایش هوشمند ورود معلمان و کادر (${activeSchool.name})`}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    ستون‌های فارسی به‌صورت خودکار تشخیص داده شدند. صرفاً ردیف‌های سبز (سالم) ثبت و ردیف‌های ناقص و تکراری مسدود می‌شوند.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <PrintIconButton
                    compact
                    landscape
                    documentLabel="گزارش بررسی اکسل ورود گروهی"
                    html={smartImportReportPrintHtml}
                  />
                  <button
                    type="button"
                    onClick={() => setCsvModalMode(null)}
                    className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* 3 Color-Coded Category Summary Cards */}
              <div className="px-5 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5 tabular-nums">
                <button
                  type="button"
                  onClick={() => setCsvFilterStatus(csvFilterStatus === 'valid' ? 'all' : 'valid')}
                  className={`rounded-xl border p-3 text-right transition-colors ${
                    csvFilterStatus === 'valid'
                      ? 'bg-emerald-100 dark:bg-emerald-950 border-emerald-500'
                      : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    <span>سالم و آماده ثبت</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="mt-1 text-xl font-extrabold text-emerald-900 dark:text-emerald-200">
                    {toPersianDigits(validCount)} ردیف
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setCsvFilterStatus(csvFilterStatus === 'incomplete' ? 'all' : 'incomplete')
                  }
                  className={`rounded-xl border p-3 text-right transition-colors ${
                    csvFilterStatus === 'incomplete'
                      ? 'bg-amber-100 dark:bg-amber-950 border-amber-500'
                      : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300">
                    <span>ناقص (مسدود — نیازمند اصلاح)</span>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="mt-1 text-xl font-extrabold text-amber-900 dark:text-amber-200">
                    {toPersianDigits(incompleteCount)} ردیف
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setCsvFilterStatus(csvFilterStatus === 'duplicate' ? 'all' : 'duplicate')
                  }
                  className={`rounded-xl border p-3 text-right transition-colors ${
                    csvFilterStatus === 'duplicate'
                      ? 'bg-rose-100 dark:bg-rose-950 border-rose-500'
                      : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-rose-800 dark:text-rose-300">
                    <span>تکراری (مسدود)</span>
                    <XCircle className="w-4 h-4" />
                  </div>
                  <div className="mt-1 text-xl font-extrabold text-rose-900 dark:text-rose-200">
                    {toPersianDigits(duplicateCount)} ردیف
                  </div>
                </button>
              </div>

              {/* Preview Table */}
              <div className="flex-1 overflow-auto p-4">
                <table className="w-full text-right text-xs border-collapse tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="py-2 px-2">ردیف</th>
                      <th className="py-2 px-2">نام و نام خانوادگی</th>
                      <th className="py-2 px-2">کد ملی</th>
                      <th className="py-2 px-2">{isStudents ? 'کلاس / ولی' : 'تخصص / موبایل'}</th>
                      <th className="py-2 px-2">وضعیت و دلیل اعتبارسنجی</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {visibleRows.map((row) => {
                      const rowBg =
                        row.status === 'valid'
                          ? 'bg-emerald-50/30 dark:bg-emerald-950/15'
                          : row.status === 'incomplete'
                            ? 'bg-amber-50/40 dark:bg-amber-950/20'
                            : 'bg-rose-50/40 dark:bg-rose-950/20';
                      return (
                        <tr key={row.rowNumber} className={rowBg}>
                          <td className="py-2 px-2 font-bold">{toPersianDigits(row.rowNumber)}</td>
                          <td className="py-2 px-2 font-semibold">{row.fullName || '—'}</td>
                          <td className="py-2 px-2">{toPersianDigits(row.nationalId || '—')}</td>
                          <td className="py-2 px-2">
                            {'parentName' in row
                              ? `${row.className} · ${row.parentName} (${toPersianDigits(row.parentMobile || '—')})`
                              : `${row.specialty} · ${toPersianDigits(row.mobile || '—')}`}
                          </td>
                          <td className="py-2 px-2">
                            {row.status === 'valid' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                سالم و آماده ثبت
                              </span>
                            ) : row.status === 'incomplete' ? (
                              <span className="text-amber-800 dark:text-amber-300 font-semibold">
                                ناقص: {row.reasons.join(' | ')}
                              </span>
                            ) : (
                              <span className="text-rose-700 dark:text-rose-400 font-bold">
                                {row.reasons.join(' | ')}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Optional quick paste re-parse box */}
                <details className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <summary className="text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                    ویرایش یا جای‌گذاری مستقیم متن اکسل / CSV
                  </summary>
                  <div className="mt-2 space-y-2">
                    <textarea
                      rows={4}
                      value={csvPasteText}
                      onChange={(e) => setCsvPasteText(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        isStudents
                          ? runSmartStudentCsvParse(csvPasteText)
                          : runSmartTeacherCsvParse(csvPasteText)
                      }
                      className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold"
                    >
                      بررسی مجدد ردیف‌ها
                    </button>
                  </div>
                </details>
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  ردیف‌های ناقص و تکراری به‌صورت خودکار نادیده گرفته می‌شوند.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCsvModalMode(null)}
                    className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    disabled={validCount === 0 || isViewingArchivedYear}
                    onClick={() => void handleConfirmSmartImport()}
                    className="min-h-[42px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold"
                  >
                    ثبت نهایی {toPersianDigits(validCount)} ردیف سالم
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ==================== MODAL 3: ADD / EDIT CLASS ==================== */}
      {classModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingClass ? 'ویرایش کلاس' : 'افزودن کلاس جدید'}
          className="no-print fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setClassModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {editingClass ? 'ویرایش اطلاعات کلاس' : 'افزودن کلاس جدید'}
              </h2>
              <button
                type="button"
                onClick={() => setClassModalOpen(false)}
                className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {clsErrors.length > 0 && (
              <div role="alert" className="mt-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-3 text-xs text-rose-800 dark:text-rose-200 space-y-1">
                {clsErrors.map((err, i) => (
                  <div key={i}>• {err}</div>
                ))}
              </div>
            )}

            <form onSubmit={(e) => void handleSaveClass(e)} className="mt-4 space-y-3.5">
              <div>
                <label htmlFor="cls-name" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  عنوان کامل کلاس *
                </label>
                <input
                  id="cls-name"
                  type="text"
                  value={clsName}
                  onChange={(e) => setClsName(e.target.value)}
                  placeholder="مثلاً پایه پنجم - کلاس ب"
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cls-grade" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    پایه تحصیلی
                  </label>
                  <select
                    id="cls-grade"
                    value={clsGradeLevel}
                    onChange={(e) => setClsGradeLevel(Number(e.target.value) as 2 | 3 | 4 | 5 | 6)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm"
                  >
                    {GRADE_OPTIONS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="cls-custom-grade" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    عنوان پایه سفارشی (اختیاری)
                  </label>
                  <input
                    id="cls-custom-grade"
                    type="text"
                    value={clsCustomGrade}
                    onChange={(e) => setClsCustomGrade(e.target.value)}
                    placeholder="مثلاً پیش‌دبستانی / اول"
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="cls-section" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    شعبه *
                  </label>
                  <input
                    id="cls-section"
                    type="text"
                    value={clsSection}
                    onChange={(e) => setClsSection(e.target.value)}
                    placeholder="الف / ب"
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="cls-room" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    کد اتاق *
                  </label>
                  <input
                    id="cls-room"
                    type="text"
                    dir="ltr"
                    value={clsRoomCode}
                    onChange={(e) => setClsRoomCode(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-left tabular-nums"
                  />
                </div>

                <div>
                  <label htmlFor="cls-cap" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    ظرفیت
                  </label>
                  <input
                    id="cls-cap"
                    type="text"
                    dir="ltr"
                    value={clsCapacity}
                    onChange={(e) => setClsCapacity(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-left tabular-nums"
                  />
                </div>

                <div>
                  <label htmlFor="cls-teacher" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    آموزگار راهنما
                  </label>
                  <select
                    id="cls-teacher"
                    value={clsHomeroomTeacherId}
                    onChange={(e) => setClsHomeroomTeacherId(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm"
                  >
                    <option value="">انتخاب معلم...</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setClassModalOpen(false)}
                  className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
                >
                  {editingClass ? 'ذخیره تغییرات' : 'ایجاد کلاس'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 4: ADD / EDIT TEACHER & 4-PERIOD SCHEDULE ==================== */}
      {teacherModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingTeacher ? 'ویرایش معلم' : 'افزودن معلم جدید'}
          className="no-print fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setTeacherModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {editingTeacher ? 'ویرایش معلم و برنامه هفتگی' : 'افزودن معلم / همکار جدید'}
              </h2>
              <button
                type="button"
                onClick={() => setTeacherModalOpen(false)}
                className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {tErrors.length > 0 && (
              <div role="alert" className="mt-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-3 text-xs text-rose-800 dark:text-rose-200 space-y-1">
                {tErrors.map((err, i) => (
                  <div key={i}>• {err}</div>
                ))}
              </div>
            )}

            <form onSubmit={(e) => void handleSaveTeacher(e)} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="t-name" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    نام و نام خانوادگی *
                  </label>
                  <input
                    id="t-name"
                    type="text"
                    value={tFullName}
                    onChange={(e) => setTFullName(e.target.value)}
                    placeholder="مثلاً استاد بابک کریمی"
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="t-natid" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    کد ملی ۱۰ رقمی *
                  </label>
                  <input
                    id="t-natid"
                    type="text"
                    dir="ltr"
                    value={tNationalId}
                    onChange={(e) => setTNationalId(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-left tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="t-mobile" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    شماره موبایل *
                  </label>
                  <input
                    id="t-mobile"
                    type="text"
                    dir="ltr"
                    value={tMobile}
                    onChange={(e) => setTMobile(e.target.value)}
                    placeholder="0912..."
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-left tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="t-spec" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    تخصص / درس تدریسی *
                  </label>
                  <input
                    id="t-spec"
                    type="text"
                    value={tSpecialty}
                    onChange={(e) => setTSpecialty(e.target.value)}
                    placeholder="مثلاً دبیر ریاضی و علوم"
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm"
                  />
                </div>
              </div>

              {/* Assigned Classes Multi-Check */}
              <div>
                <span className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  کلاس‌های مجاز برای ثبت حضور و غیاب توسط این معلم:
                </span>
                <div className="flex flex-wrap gap-2">
                  {classes.map((cls) => {
                    const checked = tAssignedClassIds.includes(cls.id);
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => toggleTeacherAssignedClass(cls.id)}
                        className={`min-h-[36px] px-3 rounded-lg border text-xs font-semibold transition-colors ${
                          checked
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-700 dark:text-indigo-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {cls.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Weekly 4-Period Schedule Grid */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    برنامه ۴ زنگه هفتگی (خانه‌های خالی به‌عنوان «همکار آزاد» در جایگزینی پیشنهاد می‌شوند)
                  </span>
                  <div className="flex items-center gap-1.5 text-xs">
                    <label htmlFor="t-quota" className="text-slate-500">
                      سقف موظف:
                    </label>
                    <input
                      id="t-quota"
                      type="text"
                      dir="ltr"
                      value={tQuota}
                      onChange={(e) => setTQuota(e.target.value)}
                      className="w-12 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 text-center tabular-nums"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500">
                        <th className="p-2 font-semibold">روز کاری</th>
                        {([1, 2, 3, 4] as PeriodNumber[]).map((p) => (
                          <th key={p} className="p-2 text-center font-semibold">
                            زنگ {toPersianDigits(p)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {activeSchool.activeWorkdays.map((wd) => (
                        <tr key={wd}>
                          <td className="p-2 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                            {PERSIAN_WEEKDAY_NAMES[wd]}
                          </td>
                          {([1, 2, 3, 4] as PeriodNumber[]).map((p) => {
                            const key = `${wd}:${p}`;
                            return (
                              <td key={key} className="p-1.5">
                                <select
                                  aria-label={`${PERSIAN_WEEKDAY_NAMES[wd]} زنگ ${toPersianDigits(p)}`}
                                  value={tScheduleGrid[key] ?? ''}
                                  onChange={(e) =>
                                    setTScheduleGrid((prev) => ({
                                      ...prev,
                                      [key]: e.target.value,
                                    }))
                                  }
                                  className="w-full min-h-[34px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 text-[11px]"
                                >
                                  <option value="">آزاد (بدون کلاس)</option>
                                  {classes.map((cls) => (
                                    <option key={cls.id} value={cls.id}>
                                      {cls.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTeacherModalOpen(false)}
                  className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
                >
                  {editingTeacher ? 'ذخیره تغییرات معلم' : 'ثبت معلم و برنامه هفتگی'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 5: SAFE MID-YEAR CLASS TRANSFER ==================== */}
      {transferStudent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="انتقال امن کلاس دانش‌آموز"
          className="no-print fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setTransferStudent(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                انتقال امن کلاس در میانه سال
              </h2>
              <button
                type="button"
                onClick={() => setTransferStudent(null)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl bg-sky-50/70 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 p-3 text-xs text-sky-900 dark:text-sky-200 space-y-1">
              <div className="font-bold">دانش‌آموز: {transferStudent.fullName}</div>
              <div>کلاس فعلی: {classMap.get(transferStudent.classId)?.name ?? 'نامشخص'}</div>
              <div className="text-[11px] opacity-90">
                تمام نمرات و حضور و غیاب‌های قبلی زیر برچسب کلاس قبلی به‌طور کامل حفظ و این جابه‌جایی در تاریخچه ثبت می‌شود.
              </div>
            </div>

            <form onSubmit={(e) => void handleConfirmMidYearTransfer(e)} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  انتخاب کلاس مقصد *
                </label>
                <select
                  required
                  value={transferTargetClassId}
                  onChange={(e) => setTransferTargetClassId(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm"
                >
                  {classes
                    .filter((c) => c.id !== transferStudent.classId)
                    .map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} (اتاق {toPersianDigits(cls.roomCode)})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  علت انتقال (اختیاری)
                </label>
                <input
                  type="text"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="مثلاً توازن ظرفیت کلاس‌ها یا درخواست مشاوره‌ای..."
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTransferStudent(null)}
                  className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] px-5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold"
                >
                  تأیید و انتقال امن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PrintShell>
  );
};
