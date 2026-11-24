// Pure Timetable Conflict Detection & Helpers (strictly isolated by schoolId)
import { toPersianDigits } from '../../lib/digits';
import { PERSIAN_WEEKDAY_NAMES } from '../../lib/jalali';
import type {
  ClassRoom,
  PeriodNumber,
  PersianWeekdayIndex,
  ScheduleSlot,
  Teacher,
} from '../../types/domain';

export interface ScheduleConflictResult {
  hasConflict: boolean;
  conflictType?: 'teacher_double_booked' | 'class_slot_occupied';
  conflictingSlot?: ScheduleSlot;
  messageFa?: string;
}

/**
 * Checks in real time whether assigning (teacherId, classId, weekday, period) in a given school
 * conflicts with another class for the same teacher OR another teacher for the same class slot.
 */
export function detectScheduleConflict(params: {
  candidate: {
    id?: string;
    schoolId: string;
    weekday: PersianWeekdayIndex;
    period: PeriodNumber;
    classId: string;
    teacherId: string;
  };
  existingSchedules: ScheduleSlot[];
  classes: ClassRoom[];
  teachers: Teacher[];
}): ScheduleConflictResult {
  const { candidate, existingSchedules, classes, teachers } = params;
  const schoolSlots = existingSchedules.filter(
    (s) => s.schoolId === candidate.schoolId && s.id !== candidate.id
  );

  const classMap = new Map(classes.map((c) => [c.id, c]));
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const dayLabel = PERSIAN_WEEKDAY_NAMES[candidate.weekday] ?? 'روز کاری';
  const periodLabel = `زنگ ${toPersianDigits(candidate.period)}`;

  // 1. Same teacher already scheduled in another class at the same weekday + period
  const teacherConflict = schoolSlots.find(
    (s) =>
      s.weekday === candidate.weekday &&
      s.period === candidate.period &&
      s.teacherId === candidate.teacherId &&
      s.classId !== candidate.classId
  );

  if (teacherConflict) {
    const teacherName = teacherMap.get(candidate.teacherId)?.fullName ?? 'معلم انتخاب‌شده';
    const otherClassName = classMap.get(teacherConflict.classId)?.name ?? teacherConflict.classId;
    return {
      hasConflict: true,
      conflictType: 'teacher_double_booked',
      conflictingSlot: teacherConflict,
      messageFa: `تداخل زمانی معلم: ${teacherName} در روز ${dayLabel} (${periodLabel}) هم‌زمان در کلاس «${otherClassName}» درس «${teacherConflict.subjectName}» دارد.`,
    };
  }

  // 2. Same class slot already booked by another record ID
  const classConflict = schoolSlots.find(
    (s) =>
      s.weekday === candidate.weekday &&
      s.period === candidate.period &&
      s.classId === candidate.classId
  );

  if (classConflict) {
    const existingTeacherName =
      teacherMap.get(classConflict.teacherId)?.fullName ?? 'همکار دیگر';
    const clsName = classMap.get(candidate.classId)?.name ?? candidate.classId;
    return {
      hasConflict: true,
      conflictType: 'class_slot_occupied',
      conflictingSlot: classConflict,
      messageFa: `تداخل برنامه کلاسی: کلاس «${clsName}» در روز ${dayLabel} (${periodLabel}) قبلاً به ${existingTeacherName} (${classConflict.subjectName}) اختصاص یافته است.`,
    };
  }

  return { hasConflict: false };
}

export function countTeacherWeeklyPeriods(
  schedules: ScheduleSlot[],
  schoolId: string,
  teacherId: string
): number {
  return schedules.filter((s) => s.schoolId === schoolId && s.teacherId === teacherId).length;
}
