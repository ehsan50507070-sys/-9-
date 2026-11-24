// Pure Helper Functions for Phase 4 Notification Templates Bank («بانک قالب‌های پیام آماده»)
// Decoupled from React for direct unit testing via node:test.
import { toPersianDigits } from '../../lib/digits';
import type {
  ClassRoom,
  NotificationTemplateCategory,
  Student,
  StudentAttendanceRecord,
} from '../../types/domain';

export const TEMPLATE_CATEGORY_LABELS: Record<NotificationTemplateCategory, string> = {
  absence_late: 'غیبت و تاخیر',
  praise: 'تشویق و قدردانی',
  homework_exam: 'تکلیف و آزمون',
  meeting_trip: 'جلسه اولیا و اردو',
  general: 'اطلاع‌رسانی عمومی',
};

export interface TemplateVariableDef {
  token: string;
  labelFa: string;
}

export const TEMPLATE_VARIABLES: readonly TemplateVariableDef[] = [
  { token: '{نام_دانشآموز}', labelFa: 'نام دانش‌آموز' },
  { token: '{نام_کلاس}', labelFa: 'نام کلاس' },
  { token: '{نام_مدرسه}', labelFa: 'نام مدرسه' },
  { token: '{تاریخ_امروز}', labelFa: 'تاریخ امروز' },
  { token: '{نام_معلم}', labelFa: 'نام معلم' },
  { token: '{نام_درس}', labelFa: 'نام درس' },
  { token: '{توضیحات}', labelFa: 'توضیحات' },
] as const;

export interface TemplateRenderContext {
  studentName: string;
  className: string;
  schoolName: string;
  todayJalali: string;
  teacherName: string;
  subjectName: string;
  notes: string;
}

/**
 * Replaces all dynamic Persian variable tokens, converts digits to Persian numerals,
 * and enforces strict single-column messenger-safe formatting (no tabs or wide multi-column layouts).
 */
export function renderNotificationTemplate(body: string, ctx: TemplateRenderContext): string {
  const replacements: Record<string, string> = {
    '{نام_دانشآموز}': ctx.studentName || 'دانش‌آموز گرامی',
    '{نام_دانش‌آموز}': ctx.studentName || 'دانش‌آموز گرامی',
    '{نام_کلاس}': ctx.className || 'کلاس مربوطه',
    '{نام_مدرسه}': ctx.schoolName || 'مدرسه',
    '{تاریخ_امروز}': toPersianDigits(ctx.todayJalali),
    '{نام_معلم}': ctx.teacherName || 'معلم کلاس',
    '{نام_درس}': ctx.subjectName || 'درس مربوطه',
    '{توضیحات}': ctx.notes.trim() || '—',
  };

  let rendered = body;
  for (const [token, value] of Object.entries(replacements)) {
    rendered = rendered.split(token).join(value);
  }

  return toPersianDigits(rendered)
    .replace(/\t+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Resolves today's absent or late students from attendance records so teachers/deputies can batch-generate notices in 1 click.
 */
export function getTodaysAbsentOrLateStudents(params: {
  jalaliDate: string;
  students: Student[];
  attendanceRecords: StudentAttendanceRecord[];
  classIdFilter?: string;
}): Array<{ student: Student; status: 'absent' | 'late'; note?: string }> {
  const { jalaliDate, students, attendanceRecords, classIdFilter } = params;
  const studentById = new Map(students.filter((s) => s.active).map((s) => [s.id, s]));
  const seen = new Set<string>();
  const result: Array<{ student: Student; status: 'absent' | 'late'; note?: string }> = [];

  for (const rec of attendanceRecords) {
    if (rec.jalaliDate !== jalaliDate) continue;
    if (rec.status !== 'absent' && rec.status !== 'late') continue;
    if (classIdFilter && classIdFilter !== 'ALL' && rec.classId !== classIdFilter) continue;
    if (seen.has(rec.studentId)) continue;
    const st = studentById.get(rec.studentId);
    if (!st) continue;
    seen.add(rec.studentId);
    result.push({ student: st, status: rec.status, note: rec.note });
  }

  return result;
}

/**
 * Generates a single-column batch output for multiple selected students (e.g., whole class or today's absentees).
 */
export function renderBatchNotificationMessages(params: {
  body: string;
  students: Student[];
  classes: ClassRoom[];
  schoolName: string;
  todayJalali: string;
  teacherName: string;
  subjectName: string;
  notes: string;
}): string {
  const { body, students, classes, schoolName, todayJalali, teacherName, subjectName, notes } = params;
  const classById = new Map(classes.map((c) => [c.id, c.name]));

  if (students.length === 0) return '';
  if (students.length === 1) {
    const st = students[0];
    return renderNotificationTemplate(body, {
      studentName: st.fullName,
      className: classById.get(st.classId) ?? '',
      schoolName,
      todayJalali,
      teacherName,
      subjectName,
      notes,
    });
  }

  return students
    .map((st, idx) => {
      const msg = renderNotificationTemplate(body, {
        studentName: st.fullName,
        className: classById.get(st.classId) ?? '',
        schoolName,
        todayJalali,
        teacherName,
        subjectName,
        notes,
      });
      return `【${toPersianDigits(idx + 1)} — ${st.fullName} (ولی: ${st.parentName})】\n${msg}`;
    })
    .join('\n\n────────────────────\n\n');
}
