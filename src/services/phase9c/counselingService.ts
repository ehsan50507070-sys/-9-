// Phase 9-C: Confidential Two-Layer Counseling Office & Follow-up Reminder Service
import { addDaysToJalali } from '../../lib/jalali';
import type {
  CounselingSession,
  CounselingSessionMode,
  CounselingSessionStatus,
  RoleId,
} from '../../types/domain';

export const COUNSELING_MODE_LABELS: Record<CounselingSessionMode, string> = {
  in_person: 'حضوری در دفتر مشاوره',
  phone: 'تلفنی',
  online: 'آنلاین',
};

export const COUNSELING_STATUS_LABELS: Record<CounselingSessionStatus, string> = {
  requested: 'درخواست جدید / ارجاع‌شده',
  scheduled: 'زمان‌بندی قطعی شده',
  completed: 'برگزار شده',
  cancelled: 'لغو شده',
};

export interface ClinicalLayer1AccessResult {
  allowed: boolean;
  mode: 'full' | 'principal_audit' | 'denied';
  reasonFa: string;
}

/**
 * STRICT LAYER-1 CONFIDENTIALITY GATE:
 * - counselor & super_admin: full read/write access (still audited on every view/edit).
 * - principal: audited READ-ONLY access ONLY if super_admin explicitly granted it for this schoolId.
 * - deputy, teacher, parent, student, complex_admin: ZERO access.
 */
export function canViewClinicalLayer1(
  role: RoleId,
  schoolId: string,
  principalAuditSchoolIds?: string[]
): ClinicalLayer1AccessResult {
  if (role === 'counselor' || role === 'super_admin') {
    return {
      allowed: true,
      mode: 'full',
      reasonFa: 'دسترسی کامل تخصصی به لایه محرمانه بالینی (با ثبت ممیزی خودکار).',
    };
  }
  if (role === 'principal' && Array.isArray(principalAuditSchoolIds) && principalAuditSchoolIds.includes(schoolId)) {
    return {
      allowed: true,
      mode: 'principal_audit',
      reasonFa: 'دسترسی ویژه ممیزی (فقط‌خواندنی) فعال‌شده توسط راهبر ارشد با ثبت علت در زنجیره SHA-256.',
    };
  }
  return {
    allowed: false,
    mode: 'denied',
    reasonFa: 'لایه محرمانه یادداشت‌های بالینی صرفاً در انحصار مشاور مدرسه است و برای نقش شما مسدود می‌باشد.',
  };
}

export function canEditClinicalLayer1(role: RoleId): boolean {
  return role === 'counselor' || role === 'super_admin';
}

export interface ScopedCounselingSessionView extends CounselingSession {
  canSeeSharedAdvice: boolean;
}

export function filterCounselingSessionsForRole(params: {
  sessions: CounselingSession[];
  role: RoleId;
  userId: string;
  linkedStudentId?: string;
  teacherAssignedClassIds?: string[];
}): ScopedCounselingSessionView[] {
  const { sessions, role, userId, linkedStudentId, teacherAssignedClassIds = [] } = params;
  const classSet = new Set(teacherAssignedClassIds);

  if (role === 'counselor' || role === 'super_admin') {
    return sessions.map((s) => ({ ...s, canSeeSharedAdvice: true }));
  }

  if (role === 'principal' || role === 'deputy' || role === 'complex_admin') {
    return sessions.map((s) => ({
      ...s,
      // Layer-2 shared advice visible to admin/deputy only when counselor explicitly shared with staff/teacher
      sharedAdviceText: s.shareWithTeacher ? s.sharedAdviceText : undefined,
      canSeeSharedAdvice: Boolean(s.shareWithTeacher && s.sharedAdviceText),
    }));
  }

  if (role === 'teacher') {
    return sessions
      .filter((s) => {
        const isReferrer = s.referredByUserId === userId;
        const sharedWithTeacherInClass =
          s.shareWithTeacher && (classSet.size === 0 || classSet.has(s.classId));
        return isReferrer || sharedWithTeacherInClass;
      })
      .map((s) => ({
        ...s,
        sharedAdviceText: s.shareWithTeacher ? s.sharedAdviceText : undefined,
        canSeeSharedAdvice: Boolean(s.shareWithTeacher && s.sharedAdviceText),
      }));
  }

  if (role === 'parent' || role === 'student') {
    if (!linkedStudentId) return [];
    return sessions
      .filter((s) => s.studentId === linkedStudentId)
      .map((s) => ({
        ...s,
        // Never leak internal teacher referral notes if counselor didn't share advice; show sharedAdviceText ONLY if shareWithParent
        sharedAdviceText: s.shareWithParent ? s.sharedAdviceText : undefined,
        canSeeSharedAdvice: Boolean(s.shareWithParent && s.sharedAdviceText),
      }));
  }

  return [];
}

export interface DueCounselingFollowUp {
  session: CounselingSession;
  followUpDateJalali: string;
  isOverdue: boolean;
  isToday: boolean;
}

/**
 * Finds counseling sessions whose follow-up date is overdue, today, or within the next 3 days.
 */
export function getDueCounselingFollowUps(
  sessions: CounselingSession[],
  todayJalali: string
): DueCounselingFollowUp[] {
  const windowEnd = addDaysToJalali(todayJalali, 3);
  const due: DueCounselingFollowUp[] = [];

  for (const session of sessions) {
    if (session.status === 'cancelled') continue;
    const fDate = session.followUpDateJalali?.trim();
    if (!fDate) continue;
    if (fDate <= windowEnd) {
      due.push({
        session,
        followUpDateJalali: fDate,
        isOverdue: fDate < todayJalali,
        isToday: fDate === todayJalali,
      });
    }
  }

  return due.sort((a, b) => a.followUpDateJalali.localeCompare(b.followUpDateJalali));
}
