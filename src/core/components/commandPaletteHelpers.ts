// Pure Role-Scoped Global Quick Search Engine (Ctrl+K Command Palette)
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import type {
  ClassRoom,
  MockExam,
  RoleGovernanceConfig,
  RoleId,
  School,
  Student,
  Teacher,
} from '../../types/domain';
import { canRoleAccessRoute } from '../auth/rbac';
import type { PluginRuntimeStatus } from '../plugins/types';
import { evaluateModulePermission } from '../super-admin/superAdminHelpers';

export type CommandItemCategory =
  | 'modules'
  | 'students'
  | 'staff'
  | 'mock_exams'
  | 'quick_actions';

export interface CommandPaletteItem {
  id: string;
  category: CommandItemCategory;
  title: string;
  subtitle: string;
  iconName?: string;
  route?: string;
  schoolId?: string;
  schoolName?: string;
  classId?: string;
  studentId?: string;
  examId?: string;
  actionType?:
    | 'navigate'
    | 'open_student_profile'
    | 'open_student_report'
    | 'open_student_attendance'
    | 'create_mock_exam'
    | 'print_report_card'
    | 'switch_school';
  score: number;
}

export const COMMAND_CATEGORY_LABELS: Record<CommandItemCategory, string> = {
  modules: 'ماژول‌ها و صفحات سامانه',
  students: 'دانش‌آموزان',
  staff: 'معلمان و پرسنل',
  mock_exams: 'آزمون‌های آزمایشی و دوره‌ها',
  quick_actions: 'اقدامات سریع',
};

export function normalizePersianSearchText(raw: string): string {
  return toAsciiDigits(raw)
    .toLowerCase()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[أإآ]/g, 'ا')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function fuzzyMatchScore(queryRaw: string, ...fields: Array<string | undefined>): number {
  const q = normalizePersianSearchText(queryRaw);
  if (!q) return 10;

  let best = 0;
  fields.forEach((f, idx) => {
    if (!f) return;
    const norm = normalizePersianSearchText(f);
    if (!norm) return;
    if (norm === q) {
      best = Math.max(best, 100);
    } else if (norm.startsWith(q)) {
      best = Math.max(best, 85);
    } else if (norm.includes(q)) {
      best = Math.max(best, idx === 0 ? 75 : 65);
    } else {
      // Token-based partial match
      const tokens = q.split(' ').filter(Boolean);
      if (tokens.length > 1 && tokens.every((t) => norm.includes(t))) {
        best = Math.max(best, 60);
      } else if (idx === 0 && q.length >= 4 && norm.length <= 30) {
        // Ordered subsequence match strictly for short primary titles (4+ chars) to prevent Persian noise
        let qi = 0;
        for (let i = 0; i < norm.length && qi < q.length; i++) {
          if (norm[i] === q[qi]) qi++;
        }
        if (qi === q.length) {
          best = Math.max(best, 35);
        }
      }
    }
  });
  return best;
}

export interface BuildCommandPaletteParams {
  query: string;
  activeRole: RoleId;
  activeSchoolId: string;
  canSwitchSchool: boolean;
  pluginStatuses: PluginRuntimeStatus[];
  roleGovernanceConfigs: RoleGovernanceConfig[];
  getSectionTitle: (moduleId: string, fallback: string) => string;
  schools: School[];
  students: Student[];
  classes: ClassRoom[];
  teachers: Teacher[];
  mockExams: MockExam[];
  isViewingArchivedYear: boolean;
}

/**
 * Produces strictly role-scoped Command Palette items across:
 * 1. Authorized Modules/Pages (respecting LabelProvider + Super Admin RoleMatrix)
 * 2. Students (restricted to active schoolId unless complex_admin/super_admin, hidden for parent/student)
 * 3. Teachers & Staff (management roles only)
 * 4. Mock Exams (visible to authorized roles)
 * 5. Role-permitted Quick Actions
 */
export function buildCommandPaletteItems(
  params: BuildCommandPaletteParams
): CommandPaletteItem[] {
  const {
    query,
    activeRole,
    activeSchoolId,
    canSwitchSchool,
    pluginStatuses,
    roleGovernanceConfigs,
    getSectionTitle,
    schools,
    students,
    classes,
    teachers,
    mockExams,
    isViewingArchivedYear,
  } = params;

  const trimmed = query.trim();
  const manifests = pluginStatuses.map((p) => p.manifest);
  const items: CommandPaletteItem[] = [];

  const isStaff =
    activeRole === 'super_admin' ||
    activeRole === 'complex_admin' ||
    activeRole === 'principal' ||
    activeRole === 'deputy' ||
    activeRole === 'teacher';

  const isManagement =
    activeRole === 'super_admin' ||
    activeRole === 'complex_admin' ||
    activeRole === 'principal' ||
    activeRole === 'deputy';

  const schoolNameMap = new Map(schools.map((s) => [s.id, s.name]));
  const classNameMap = new Map(classes.map((c) => [c.id, c.name]));

  const canViewModule = (moduleId: string, allowedRoles: RoleId[]): boolean => {
    if (!canRoleAccessRoute(activeRole, allowedRoles)) return false;
    if (activeRole === 'super_admin' || moduleId === 'dashboard') return true;
    return evaluateModulePermission({
      role: activeRole,
      moduleId,
      action: 'view',
      configs: roleGovernanceConfigs,
      manifests,
    });
  };

  // 1. Authorized Modules & Pages
  for (const status of pluginStatuses) {
    const m = status.manifest;
    if (!m.implemented) continue;
    if (!m.isCore && (!status.installed || !status.enabled)) continue;
    if (!canViewModule(m.id, m.allowedRoles)) continue;

    const resolvedName = getSectionTitle(m.id, m.nameFa);
    const resolvedShort = getSectionTitle(m.id, m.shortNameFa);
    const score = fuzzyMatchScore(trimmed, resolvedName, resolvedShort, m.descriptionFa, m.route);
    if (score > 0) {
      items.push({
        id: `mod-${m.id}`,
        category: 'modules',
        title: resolvedName,
        subtitle: m.categoryLabelFa,
        iconName: m.iconName,
        route: m.route,
        actionType: 'navigate',
        score: score + 5,
      });
    }
  }

  // 2. Students (STRICTLY hidden from parent & student roles; school-scoped for non-complex_admin)
  if (isStaff) {
    const visibleStudents = canSwitchSchool
      ? students.filter((s) => s.active)
      : students.filter((s) => s.schoolId === activeSchoolId && s.active);

    const matchedStudents: CommandPaletteItem[] = [];
    for (const st of visibleStudents) {
      const clsName = classNameMap.get(st.classId) ?? '';
      const schName = schoolNameMap.get(st.schoolId) ?? '';
      const score = fuzzyMatchScore(trimmed, st.fullName, st.nationalId, clsName, schName);
      if (score > 0) {
        matchedStudents.push({
          id: `stu-${st.id}`,
          category: 'students',
          title: st.fullName,
          subtitle: `${clsName} · کد ملی ${toPersianDigits(st.nationalId)}${
            canSwitchSchool && schName ? ` · ${schName}` : ''
          }`,
          schoolId: st.schoolId,
          schoolName: schName,
          classId: st.classId,
          studentId: st.id,
          actionType: 'open_student_profile',
          score,
        });
      }
    }
    matchedStudents.sort((a, b) => b.score - a.score);
    items.push(...matchedStudents.slice(0, trimmed ? 8 : 4));
  }

  // 3. Teachers & Staff (STRICTLY management roles only)
  if (isManagement) {
    const visibleTeachers = canSwitchSchool
      ? teachers
      : teachers.filter((t) => t.schoolId === activeSchoolId);

    const matchedTeachers: CommandPaletteItem[] = [];
    for (const t of visibleTeachers) {
      const schName = schoolNameMap.get(t.schoolId) ?? '';
      const score = fuzzyMatchScore(trimmed, t.fullName, t.specialty, t.mobile, schName);
      if (score > 0) {
        matchedTeachers.push({
          id: `staff-${t.id}`,
          category: 'staff',
          title: t.fullName,
          subtitle: `${t.specialty}${canSwitchSchool && schName ? ` · ${schName}` : ''}`,
          schoolId: t.schoolId,
          schoolName: schName,
          route: '/directory',
          actionType: 'navigate',
          score,
        });
      }
    }
    matchedTeachers.sort((a, b) => b.score - a.score);
    items.push(...matchedTeachers.slice(0, trimmed ? 6 : 2));
  }

  // 4. Mock Exams (only if mock-exams module is visible to this role)
  const mockExamPlugin = pluginStatuses.find((p) => p.manifest.id === 'mock-exams');
  if (
    mockExamPlugin &&
    mockExamPlugin.installed &&
    mockExamPlugin.enabled &&
    canViewModule('mock-exams', mockExamPlugin.manifest.allowedRoles)
  ) {
    const visibleExams = mockExams.filter((ex) => {
      if (ex.scope === 'school' && ex.schoolId !== activeSchoolId && !canSwitchSchool) return false;
      if ((activeRole === 'student' || activeRole === 'parent') && ex.status === 'draft') {
        return false;
      }
      return true;
    });

    for (const ex of visibleExams) {
      const score = fuzzyMatchScore(trimmed, ex.title, ex.stageLabelFa, 'آزمون آزمایشی کنکور');
      if (score > 0) {
        items.push({
          id: `exam-${ex.id}`,
          category: 'mock_exams',
          title: ex.title,
          subtitle: `${ex.stageLabelFa} · ${toPersianDigits(ex.questions.length)} سوال`,
          route: '/mock-exams',
          examId: ex.id,
          actionType: 'navigate',
          score,
        });
      }
    }
  }

  // 5. Role-Scoped Quick Actions
  const quickActions: Array<Omit<CommandPaletteItem, 'score'> & { keywords: string }> = [];

  if (isStaff && !isViewingArchivedYear) {
    quickActions.push({
      id: 'act-new-mock-exam',
      category: 'quick_actions',
      title: 'ثبت آزمون آزمایشی جدید',
      subtitle: 'طراحی دفترچه، ضرایب دروس و کلید آزمون کنکوری',
      route: '/mock-exams',
      actionType: 'create_mock_exam',
      keywords: 'ثبت آزمون آزمایشی جدید کنکور تستی طراحی',
    });
  }

  if (activeRole === 'parent' || activeRole === 'student') {
    quickActions.push({
      id: 'act-print-report',
      category: 'quick_actions',
      title: 'مشاهده و چاپ کارنامه',
      subtitle: activeRole === 'parent' ? 'کارنامه جامع فرزند و آزمون آزمایشی' : 'کارنامه آزمون آزمایشی و نمرات',
      route: activeRole === 'parent' ? '/parent-portal' : '/mock-exams',
      actionType: 'print_report_card',
      keywords: 'چاپ کارنامه نمره تراز آزمون',
    });
  } else {
    quickActions.push({
      id: 'act-print-report-staff',
      category: 'quick_actions',
      title: 'چاپ کارنامه آزمون آزمایشی',
      subtitle: 'انتقال به بخش کارنامه‌های A4/A5 و چاپ گروهی کلاس',
      route: '/mock-exams',
      actionType: 'print_report_card',
      keywords: 'چاپ کارنامه تراز گروهی A4 A5',
    });
  }

  if (canSwitchSchool) {
    for (const sc of schools) {
      if (sc.id === activeSchoolId) continue;
      quickActions.push({
        id: `act-switch-${sc.id}`,
        category: 'quick_actions',
        title: `تغییر مدرسه فعال به «${sc.name}»`,
        subtitle: sc.subtitle,
        schoolId: sc.id,
        schoolName: sc.name,
        actionType: 'switch_school',
        keywords: `تغییر مدرسه ${sc.name} ${sc.subtitle}`,
      });
    }
  }

  for (const act of quickActions) {
    const score = fuzzyMatchScore(trimmed, act.title, act.subtitle, act.keywords);
    if (score > 0) {
      items.push({
        id: act.id,
        category: act.category,
        title: act.title,
        subtitle: act.subtitle,
        route: act.route,
        schoolId: act.schoolId,
        schoolName: act.schoolName,
        actionType: act.actionType,
        score: score + 2,
      });
    }
  }

  // Sort within balanced result cap
  return items.sort((a, b) => b.score - a.score);
}
