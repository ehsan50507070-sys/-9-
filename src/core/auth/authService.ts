// Layer-1 Hardened Authentication Service (Web Crypto PBKDF2/SHA-256, Zero Plaintext Storage,
// Non-Persian Usernames, Distinct Student/Parent Passwords, Brute-Force Lockout, Mandatory First-Login Password Change)
import { toAsciiDigits } from '../../lib/digits';
import type {
  AuthSession,
  ManagedAdminAccount,
  RoleId,
  School,
  Student,
  Teacher,
} from '../../types/domain';
import { OFFICIAL_SCHOOL_NAMES } from '../branding/BrandLogo';
import {
  deriveDistinctParentInitialPassword,
  hashPassword,
  hashPasswordSync,
  verifyPassword,
} from '../security/cryptoService';
import {
  normalizeUsernameInput,
  validateNonPersianUsername,
  validateStrongPassword,
} from '../security/sanitize';
import {
  clearFailedLoginAttempts,
  getLoginLockoutStatus,
  recordFailedLoginAttempt,
  type LockoutStatus,
} from '../security/securityGuard';
import { ROLE_DEFINITIONS } from './rbac';

export const AUTH_SESSION_STORAGE_KEY = 'smart_school_session_v1';
export const COMPLEX_ADMIN_SCOPE = '__complex__';
export const SUPER_ADMIN_SCOPE = '__super_admin__';

export type LoginRoleGroup = 'management' | 'teacher' | 'student' | 'parent';

export const LOGIN_ROLE_GROUPS: Array<{
  id: LoginRoleGroup;
  labelFa: string;
  subtitleFa: string;
  allowedRoles: RoleId[];
}> = [
  {
    id: 'management',
    labelFa: 'مدیریت و راهبری',
    subtitleFa: 'راهبر ارشد، مدیر کل، مدیر، معاون و مشاور',
    allowedRoles: ['super_admin', 'complex_admin', 'principal', 'deputy', 'counselor'],
  },
  {
    id: 'teacher',
    labelFa: 'معلم و دبیر',
    subtitleFa: 'کادر آموزشی و دبیران مدارس',
    allowedRoles: ['teacher'],
  },
  {
    id: 'student',
    labelFa: 'دانش‌آموز',
    subtitleFa: 'پرتال یادگیری، تکالیف و آزمون',
    allowedRoles: ['student'],
  },
  {
    id: 'parent',
    labelFa: 'ولی (پدر / مادر)',
    subtitleFa: 'پایش تحصیلی و ارتباط با مدرسه',
    allowedRoles: ['parent'],
  },
];

export interface LoginAttemptInput {
  selectedScope?: string;
  roleGroup?: LoginRoleGroup;
  username: string;
  password: string;
}

export interface LoginResult {
  ok: boolean;
  session?: AuthSession;
  errorFa?: string;
  lockoutStatus?: LockoutStatus;
  lockedNow?: boolean;
  resolvedSchoolId?: string;
  resolvedComplexId?: string;
  resolvedRole?: RoleId;
}

interface StoredPasswordOverride {
  passwordHash: string;
  passwordSalt: string;
  mustChangePassword: boolean;
  updatedAtIso: string;
}

const HASHED_PASSWORD_OVERRIDES_KEY = 'grr_pw_hash_overrides_v2';
const LEGACY_PLAINTEXT_OVERRIDES_KEY = 'smart_school_pw_overrides_v1';

interface ResolvedHashedAccount {
  userId: string;
  usernames: string[];
  passwordHash?: string;
  passwordSalt?: string;
  mustChangePassword?: boolean;
  displayName: string;
  role: RoleId;
  schoolId: string;
  complexId?: string;
  isComplexWide: boolean;
  isSuperAdmin?: boolean;
  isActive: boolean;
  linkedTeacherId?: string;
  linkedStudentId?: string;
}

/**
 * Generates a distinct initial parent password (never equal to student's National ID).
 */
export function deriveDefaultParentPassword(
  studentNationalId: string,
  parentNationalId?: string
): string {
  return deriveDistinctParentInitialPassword(studentNationalId, parentNationalId);
}

/**
 * Generates a distinct non-Persian parent login username (pr-<nationalId>).
 */
export function deriveDefaultParentUsername(nationalId: string): string {
  const digits = toAsciiDigits(nationalId).replace(/\D/g, '');
  return digits ? `pr-${digits}` : 'pr-parent';
}

/**
 * Generates a distinct non-Persian student login username (st-<nationalId>).
 */
export function deriveDefaultStudentUsername(nationalId: string): string {
  const digits = toAsciiDigits(nationalId).replace(/\D/g, '');
  return digits ? `st-${digits}` : 'st-student';
}

/**
 * Student initial password equals the student's 10-digit National ID.
 */
export function deriveDefaultStudentPassword(nationalId: string): string {
  const digits = toAsciiDigits(nationalId).replace(/\D/g, '');
  return digits || '1000000000';
}

/**
 * Creates a Student with salted hashed credentials (zero plaintext persisted) and returns
 * one-time displayable initial passwords for staff onboarding.
 * - Student initial password = student's National ID
 * - Parent initial password = parent's own National ID (if provided & distinct) OR secure random 8-char password
 */
export async function createStudentWithInitialCredentials(
  student: Student,
  options?: { parentNationalId?: string; customParentPassword?: string }
): Promise<{
  student: Student;
  initialStudentPassword: string;
  initialParentPassword: string;
}> {
  const studentUsername =
    student.studentUsername?.trim() || deriveDefaultStudentUsername(student.nationalId);
  const parentUsername =
    student.parentUsername?.trim() || deriveDefaultParentUsername(student.nationalId);

  const initialStudentPassword = deriveDefaultStudentPassword(student.nationalId);
  const candidateParentPw = options?.customParentPassword?.trim()
    ? toAsciiDigits(options.customParentPassword).trim()
    : deriveDistinctParentInitialPassword(
        student.nationalId,
        options?.parentNationalId ?? student.parentNationalId
      );
  const initialParentPassword =
    candidateParentPw === initialStudentPassword
      ? deriveDistinctParentInitialPassword(student.nationalId)
      : candidateParentPw;

  const [studentCred, parentCred] = await Promise.all([
    hashPassword(initialStudentPassword),
    hashPassword(initialParentPassword),
  ]);

  const sanitizedStudent: Student = {
    ...student,
    parentNationalId: options?.parentNationalId ?? student.parentNationalId,
    studentUsername,
    studentPasswordHash: studentCred.passwordHash,
    studentPasswordSalt: studentCred.passwordSalt,
    studentMustChangePassword: true,
    parentUsername,
    parentPasswordHash: parentCred.passwordHash,
    parentPasswordSalt: parentCred.passwordSalt,
    parentMustChangePassword: true,
  };
  delete sanitizedStudent.studentPassword;
  delete sanitizedStudent.parentPassword;

  return {
    student: sanitizedStudent,
    initialStudentPassword,
    initialParentPassword,
  };
}

export function createStudentWithInitialCredentialsSync(
  student: Student,
  options?: { parentNationalId?: string; customParentPassword?: string }
): {
  student: Student;
  initialStudentPassword: string;
  initialParentPassword: string;
} {
  const studentUsername =
    student.studentUsername?.trim() || deriveDefaultStudentUsername(student.nationalId);
  const parentUsername =
    student.parentUsername?.trim() || deriveDefaultParentUsername(student.nationalId);

  const initialStudentPassword = deriveDefaultStudentPassword(student.nationalId);
  const candidateParentPw = options?.customParentPassword?.trim()
    ? toAsciiDigits(options.customParentPassword).trim()
    : deriveDistinctParentInitialPassword(
        student.nationalId,
        options?.parentNationalId ?? student.parentNationalId
      );
  const initialParentPassword =
    candidateParentPw === initialStudentPassword
      ? deriveDistinctParentInitialPassword(student.nationalId)
      : candidateParentPw;

  const studentCred = hashPasswordSync(initialStudentPassword);
  const parentCred = hashPasswordSync(initialParentPassword);

  const sanitizedStudent: Student = {
    ...student,
    parentNationalId: options?.parentNationalId ?? student.parentNationalId,
    studentUsername,
    studentPasswordHash: studentCred.passwordHash,
    studentPasswordSalt: studentCred.passwordSalt,
    studentMustChangePassword: true,
    parentUsername,
    parentPasswordHash: parentCred.passwordHash,
    parentPasswordSalt: parentCred.passwordSalt,
    parentMustChangePassword: true,
  };
  delete sanitizedStudent.studentPassword;
  delete sanitizedStudent.parentPassword;

  return {
    student: sanitizedStudent,
    initialStudentPassword,
    initialParentPassword,
  };
}

/**
 * Non-destructively ensures every Student has non-Persian usernames and salted password hashes,
 * and migrates/strips any legacy plaintext studentPassword / parentPassword fields.
 */
export function ensureStudentDualCredentials(student: Student): Student {
  const studentUsername =
    student.studentUsername?.trim() || deriveDefaultStudentUsername(student.nationalId);
  const parentUsername =
    student.parentUsername?.trim() || deriveDefaultParentUsername(student.nationalId);

  let studentPasswordHash = student.studentPasswordHash;
  let studentPasswordSalt = student.studentPasswordSalt;
  if (!studentPasswordHash || !studentPasswordSalt) {
    const seedPlain = student.studentPassword?.trim() || deriveDefaultStudentPassword(student.nationalId);
    const hashed = hashPasswordSync(seedPlain);
    studentPasswordHash = hashed.passwordHash;
    studentPasswordSalt = hashed.passwordSalt;
  }

  let parentPasswordHash = student.parentPasswordHash;
  let parentPasswordSalt = student.parentPasswordSalt;
  if (!parentPasswordHash || !parentPasswordSalt) {
    const legacyParentPlain = student.parentPassword?.trim();
    const studentPlain = deriveDefaultStudentPassword(student.nationalId);
    const seedPlain =
      legacyParentPlain && legacyParentPlain !== studentPlain
        ? legacyParentPlain
        : deriveDistinctParentInitialPassword(student.nationalId, student.parentNationalId);
    const hashed = hashPasswordSync(seedPlain);
    parentPasswordHash = hashed.passwordHash;
    parentPasswordSalt = hashed.passwordSalt;
  }

  const hasLegacyPlaintext =
    typeof student.studentPassword === 'string' || typeof student.parentPassword === 'string';

  if (
    !hasLegacyPlaintext &&
    student.studentUsername === studentUsername &&
    student.parentUsername === parentUsername &&
    student.studentPasswordHash === studentPasswordHash &&
    student.studentPasswordSalt === studentPasswordSalt &&
    student.parentPasswordHash === parentPasswordHash &&
    student.parentPasswordSalt === parentPasswordSalt
  ) {
    return student;
  }

  const next: Student = {
    ...student,
    studentUsername,
    studentPasswordHash,
    studentPasswordSalt,
    parentUsername,
    parentPasswordHash,
    parentPasswordSalt,
  };
  delete next.studentPassword;
  delete next.parentPassword;
  return next;
}

/**
 * Migrates any legacy ManagedAdminAccount with plaintext `password` into salted hash and removes plaintext.
 */
export function ensureManagedAdminAccountHashed(account: ManagedAdminAccount): ManagedAdminAccount {
  const hasPlain = typeof account.password === 'string' && account.password.length > 0;
  let passwordHash = account.passwordHash;
  let passwordSalt = account.passwordSalt;

  if ((!passwordHash || !passwordSalt) && hasPlain) {
    const hashed = hashPasswordSync(account.password!);
    passwordHash = hashed.passwordHash;
    passwordSalt = hashed.passwordSalt;
  }

  if (!hasPlain && account.passwordHash === passwordHash && account.passwordSalt === passwordSalt) {
    return account;
  }

  const next: ManagedAdminAccount = {
    ...account,
    passwordHash,
    passwordSalt,
  };
  delete next.password;
  return next;
}

/**
 * Migrates any Teacher missing a salted hash (initial password = teacher's nationalId) without storing plaintext.
 */
export function ensureTeacherHashed(teacher: Teacher): Teacher {
  if (teacher.passwordHash && teacher.passwordSalt) {
    return teacher;
  }
  const hashed = hashPasswordSync(toAsciiDigits(teacher.nationalId).trim() || 'Teacher@1404');
  return {
    ...teacher,
    passwordHash: hashed.passwordHash,
    passwordSalt: hashed.passwordSalt,
  };
}

/**
 * Loads hashed password overrides from localStorage and migrates/purges any legacy plaintext storage key.
 */
export function loadHashedPasswordOverrides(): Record<string, StoredPasswordOverride> {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    // Purge legacy plaintext override storage immediately if found
    const legacyRaw = window.localStorage.getItem(LEGACY_PLAINTEXT_OVERRIDES_KEY);
    const existingRaw = window.localStorage.getItem(HASHED_PASSWORD_OVERRIDES_KEY);
    const map: Record<string, StoredPasswordOverride> = existingRaw
      ? (JSON.parse(existingRaw) as Record<string, StoredPasswordOverride>)
      : {};

    if (legacyRaw) {
      try {
        const legacy = JSON.parse(legacyRaw) as Record<string, string>;
        if (legacy && typeof legacy === 'object') {
          for (const [uid, plain] of Object.entries(legacy)) {
            if (typeof plain === 'string' && plain.trim() && !map[uid]) {
              const hashed = hashPasswordSync(plain.trim());
              map[uid] = {
                passwordHash: hashed.passwordHash,
                passwordSalt: hashed.passwordSalt,
                mustChangePassword: false,
                updatedAtIso: new Date().toISOString(),
              };
            }
          }
        }
      } catch {
        // Ignore malformed legacy payload
      }
      window.localStorage.setItem(HASHED_PASSWORD_OVERRIDES_KEY, JSON.stringify(map));
      window.localStorage.removeItem(LEGACY_PLAINTEXT_OVERRIDES_KEY);
    }

    return map;
  } catch {
    return {};
  }
}

function saveHashedPasswordOverride(userId: string, override: StoredPasswordOverride): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const map = loadHashedPasswordOverrides();
    map[userId] = override;
    window.localStorage.setItem(HASHED_PASSWORD_OVERRIDES_KEY, JSON.stringify(map));
  } catch {
    // ignore quota
  }
}

function buildHashedAccountDirectory(
  schools: School[],
  students: Student[],
  teachers: Teacher[],
  managedAdminAccounts?: ManagedAdminAccount[]
): ResolvedHashedAccount[] {
  const accounts: ResolvedHashedAccount[] = [];
  const defaultSchoolId = schools[0]?.id ?? 'school-1';
  const hasManaged = Array.isArray(managedAdminAccounts) && managedAdminAccounts.length > 0;

  if (hasManaged) {
    for (const rawAccount of managedAdminAccounts) {
      const m = ensureManagedAdminAccountHashed(rawAccount);
      const assignedSchoolId = m.schoolId && m.schoolId !== '__global__' ? m.schoolId : undefined;
      const targetSchoolId =
        assignedSchoolId && schools.some((s) => s.id === assignedSchoolId)
          ? assignedSchoolId
          : m.complexId
            ? (schools.find((s) => (s.complexId ?? 'complex-1') === m.complexId)?.id ??
              defaultSchoolId)
            : defaultSchoolId;

      accounts.push({
        userId: m.id,
        usernames: [normalizeUsernameInput(m.username).toLowerCase()],
        passwordHash: m.passwordHash,
        passwordSalt: m.passwordSalt,
        mustChangePassword: Boolean(m.mustChangePassword),
        displayName: m.fullName,
        role: m.role,
        schoolId: targetSchoolId,
        complexId:
          m.complexId ??
          (assignedSchoolId
            ? (schools.find((s) => s.id === assignedSchoolId)?.complexId ?? 'complex-1')
            : undefined),
        isComplexWide: m.role === 'complex_admin' || m.role === 'super_admin',
        isSuperAdmin: m.role === 'super_admin',
        isActive: m.isActive,
      });
    }
  } else {
    const bootSuper = hashPasswordSync('Admin@1404');
    accounts.push({
      userId: 'user-super-admin',
      usernames: ['09120000001'],
      passwordHash: bootSuper.passwordHash,
      passwordSalt: bootSuper.passwordSalt,
      mustChangePassword: true,
      displayName: 'راهبر ارشد سامانه گلستان راه روشن',
      role: 'super_admin',
      schoolId: defaultSchoolId,
      isComplexWide: true,
      isSuperAdmin: true,
      isActive: true,
    });
  }

  schools.forEach((school) => {
    const schoolComplexId = school.complexId ?? 'complex-1';

    const schoolTeachers = teachers.filter((t) => t.schoolId === school.id && t.active);
    schoolTeachers.forEach((rawTeacher) => {
      const teacher = ensureTeacherHashed(rawTeacher);
      const usernames = Array.from(
        new Set(
          [teacher.nationalId, teacher.mobile, teacher.personnelCode]
            .map((v) => normalizeUsernameInput(v).toLowerCase())
            .filter(Boolean)
        )
      );
      accounts.push({
        userId: `user-teacher-${teacher.id}`,
        usernames,
        passwordHash: teacher.passwordHash,
        passwordSalt: teacher.passwordSalt,
        mustChangePassword: Boolean(teacher.mustChangePassword),
        displayName: teacher.fullName,
        role: 'teacher',
        schoolId: school.id,
        complexId: schoolComplexId,
        isComplexWide: false,
        isActive: true,
        linkedTeacherId: teacher.id,
      });
    });

    const schoolStudents = students.filter((s) => s.schoolId === school.id && s.active);
    schoolStudents.forEach((rawStudent) => {
      const student = ensureStudentDualCredentials(rawStudent);

      const parentUsernames = Array.from(
        new Set(
          [student.parentUsername, student.parentMobile, student.parentNationalId]
            .map((v) => normalizeUsernameInput(v ?? '').toLowerCase())
            .filter(Boolean)
        )
      );
      accounts.push({
        userId: `user-parent-${student.id}`,
        usernames: parentUsernames,
        passwordHash: student.parentPasswordHash,
        passwordSalt: student.parentPasswordSalt,
        mustChangePassword: Boolean(student.parentMustChangePassword),
        displayName: `ولی ${student.fullName} (${student.parentName})`,
        role: 'parent',
        schoolId: school.id,
        complexId: schoolComplexId,
        isComplexWide: false,
        isActive: true,
        linkedStudentId: student.id,
      });

      const studentUsernames = Array.from(
        new Set(
          [student.studentUsername, student.nationalId, student.studentCode]
            .map((v) => normalizeUsernameInput(v ?? '').toLowerCase())
            .filter(Boolean)
        )
      );
      accounts.push({
        userId: `user-student-${student.id}`,
        usernames: studentUsernames,
        passwordHash: student.studentPasswordHash,
        passwordSalt: student.studentPasswordSalt,
        mustChangePassword: Boolean(student.studentMustChangePassword),
        displayName: student.fullName,
        role: 'student',
        schoolId: school.id,
        complexId: schoolComplexId,
        isComplexWide: false,
        isActive: true,
        linkedStudentId: student.id,
      });
    });
  });

  return accounts;
}

/**
 * Primary async authentication engine using Web Crypto PBKDF2 / SHA-256 verification,
 * non-Persian username check, role-group matching, and 5-attempt / 15-minute lockout enforcement.
 */
export async function authenticateUserAsync(
  input: LoginAttemptInput,
  schools: School[],
  students: Student[],
  teachers: Teacher[],
  managedAdminAccounts?: ManagedAdminAccount[]
): Promise<LoginResult> {
  const usernameCheck = validateNonPersianUsername(input.username);
  if (!usernameCheck.valid) {
    return { ok: false, errorFa: usernameCheck.errorFa };
  }
  const cleanUser = usernameCheck.normalized.toLowerCase();
  const cleanPass = toAsciiDigits(input.password).trim();

  if (!cleanPass) {
    return { ok: false, errorFa: 'لطفاً رمز عبور را وارد کنید.' };
  }

  // 1. Check brute-force lockout before password verification
  const existingLockout = getLoginLockoutStatus(cleanUser);
  if (existingLockout.isLocked) {
    return {
      ok: false,
      lockoutStatus: existingLockout,
      errorFa: `حساب کاربری به دلیل ۵ تلاش ناموفق به مدت ۱۵ دقیقه قفل شده است. زمان باقی‌مانده: ${existingLockout.remainingFormattedFa}`,
    };
  }

  const directory = buildHashedAccountDirectory(schools, students, teachers, managedAdminAccounts);

  // Filter by role group if selected on unified login page
  const groupDef = input.roleGroup
    ? LOGIN_ROLE_GROUPS.find((g) => g.id === input.roleGroup)
    : undefined;

  let matchingAccounts = directory.filter((acc) =>
    acc.usernames.some((u) => u.toLowerCase() === cleanUser)
  );

  if (groupDef) {
    const roleFiltered = matchingAccounts.filter((acc) => groupDef.allowedRoles.includes(acc.role));
    if (matchingAccounts.length > 0 && roleFiltered.length === 0) {
      const fail = recordFailedLoginAttempt(cleanUser);
      return {
        ok: false,
        lockoutStatus: fail.status,
        lockedNow: fail.lockedNow,
        errorFa: fail.lockedNow
          ? `به دلیل ۵ تلاش ناموفق متوالی، ورود این نام کاربری به مدت ۱۵ دقیقه مسدود شد (${fail.status.remainingFormattedFa}).`
          : 'نقش انتخاب‌شده با این حساب کاربری مطابقت ندارد. لطفاً نقش صحیح را انتخاب نمایید.',
      };
    }
    matchingAccounts = roleFiltered;
  }

  // Optional legacy scope filtering when selectedScope is passed
  if (input.selectedScope && matchingAccounts.length > 0) {
    matchingAccounts = matchingAccounts.filter((acc) => {
      if (acc.isSuperAdmin) return true;
      if (input.selectedScope === SUPER_ADMIN_SCOPE) return Boolean(acc.isSuperAdmin);
      if (input.selectedScope === COMPLEX_ADMIN_SCOPE) return acc.isComplexWide;
      if (acc.role === 'complex_admin') {
        const selectedSchool = schools.find((s) => s.id === input.selectedScope);
        if (!selectedSchool) return true;
        return !acc.complexId || (selectedSchool.complexId ?? 'complex-1') === acc.complexId;
      }
      return acc.schoolId === input.selectedScope;
    });
  }

  const activeMatches = matchingAccounts.filter((acc) => acc.isActive);
  if (matchingAccounts.length > 0 && activeMatches.length === 0) {
    return {
      ok: false,
      errorFa: 'این حساب کاربری توسط راهبر ارشد سامانه غیرفعال (معلق) شده است.',
    };
  }

  const overrides = loadHashedPasswordOverrides();
  let verified: ResolvedHashedAccount | null = null;
  let resolvedMustChangePassword = false;

  for (const acc of activeMatches) {
    const override = overrides[acc.userId];
    const hashToCheck = override?.passwordHash ?? acc.passwordHash;
    const saltToCheck = override?.passwordSalt ?? acc.passwordSalt;
    const isValid = await verifyPassword(cleanPass, hashToCheck, saltToCheck);
    if (isValid) {
      verified = acc;
      resolvedMustChangePassword = override
        ? Boolean(override.mustChangePassword)
        : Boolean(acc.mustChangePassword);
      break;
    }
  }

  if (!verified) {
    const fail = recordFailedLoginAttempt(cleanUser);
    const firstMatch = activeMatches[0] ?? matchingAccounts[0];
    return {
      ok: false,
      lockoutStatus: fail.status,
      lockedNow: fail.lockedNow,
      resolvedSchoolId: firstMatch?.schoolId,
      resolvedComplexId: firstMatch?.complexId,
      resolvedRole: firstMatch?.role,
      errorFa: fail.lockedNow
        ? `به دلیل ۵ تلاش ناموفق متوالی، ورود با این نام کاربری به مدت ۱۵ دقیقه قفل شد. زمان باقی‌مانده: ${fail.status.remainingFormattedFa}`
        : 'نام کاربری یا رمز عبور نادرست است.',
    };
  }

  clearFailedLoginAttempts(cleanUser);

  const selectedSchoolObj = input.selectedScope
    ? schools.find((s) => s.id === input.selectedScope)
    : undefined;
  const resolvedSchoolId =
    verified.isComplexWide &&
    input.selectedScope &&
    input.selectedScope !== COMPLEX_ADMIN_SCOPE &&
    input.selectedScope !== SUPER_ADMIN_SCOPE &&
    selectedSchoolObj &&
    (verified.isSuperAdmin ||
      !verified.complexId ||
      (selectedSchoolObj.complexId ?? 'complex-1') === verified.complexId)
      ? selectedSchoolObj.id
      : verified.schoolId;

  const session: AuthSession = {
    userId: verified.userId,
    username: cleanUser,
    displayName: verified.displayName,
    role: verified.role,
    schoolId: resolvedSchoolId,
    complexId: verified.complexId,
    isComplexWide: verified.isComplexWide,
    isSuperAdmin: verified.isSuperAdmin,
    mustChangePassword: resolvedMustChangePassword,
    linkedTeacherId: verified.linkedTeacherId,
    linkedStudentId: verified.linkedStudentId,
    loggedInAt: new Date().toISOString(),
  };

  return {
    ok: true,
    session,
    resolvedSchoolId,
    resolvedComplexId: verified.complexId,
    resolvedRole: verified.role,
  };
}

/**
 * Updates a user's password with strong password enforcement (>=8 chars, letters + digits)
 * and persists ONLY a Web Crypto PBKDF2 salted hash. Clears mustChangePassword flag.
 */
export async function updateUserPasswordAsync(params: {
  userId: string;
  currentPassword: string;
  newPassword: string;
  schools: School[];
  students: Student[];
  teachers: Teacher[];
  managedAdminAccounts?: ManagedAdminAccount[];
}): Promise<{
  ok: boolean;
  errorFa?: string;
  passwordHash?: string;
  passwordSalt?: string;
}> {
  const cleanCurrent = toAsciiDigits(params.currentPassword).trim();
  const cleanNew = toAsciiDigits(params.newPassword).trim();

  const strength = validateStrongPassword(cleanNew);
  if (!strength.valid) {
    return { ok: false, errorFa: strength.errorFa };
  }
  if (cleanNew.length > 64) {
    return { ok: false, errorFa: 'رمز عبور جدید نباید بیشتر از ۶۴ کاراکتر باشد.' };
  }
  if (cleanNew === cleanCurrent) {
    return { ok: false, errorFa: 'رمز عبور جدید نباید با رمز عبور فعلی یکسان باشد.' };
  }

  const overrides = loadHashedPasswordOverrides();
  const existingOverride = overrides[params.userId];
  if (existingOverride) {
    const valid = await verifyPassword(
      cleanCurrent,
      existingOverride.passwordHash,
      existingOverride.passwordSalt
    );
    if (!valid) {
      return { ok: false, errorFa: 'رمز عبور فعلی واردشده صحیح نیست.' };
    }
  } else {
    const directory = buildHashedAccountDirectory(
      params.schools,
      params.students,
      params.teachers,
      params.managedAdminAccounts
    );
    const acc = directory.find((a) => a.userId === params.userId);
    if (!acc) {
      return { ok: false, errorFa: 'حساب کاربری یافت نشد.' };
    }
    const valid = await verifyPassword(cleanCurrent, acc.passwordHash, acc.passwordSalt);
    if (!valid) {
      return { ok: false, errorFa: 'رمز عبور فعلی واردشده صحیح نیست.' };
    }
  }

  const hashed = await hashPassword(cleanNew);
  saveHashedPasswordOverride(params.userId, {
    passwordHash: hashed.passwordHash,
    passwordSalt: hashed.passwordSalt,
    mustChangePassword: false,
    updatedAtIso: new Date().toISOString(),
  });

  return {
    ok: true,
    passwordHash: hashed.passwordHash,
    passwordSalt: hashed.passwordSalt,
  };
}

/**
 * Step 3-B: Verifies a user's current password against their persisted PBKDF2/SHA-256 hash
 * for two-step verification of sensitive actions (Panic Mode unlock, Backup Restore, Safe Reset).
 */
export async function verifyUserPasswordAsync(params: {
  userId: string;
  candidatePassword: string;
  schools: School[];
  students: Student[];
  teachers: Teacher[];
  managedAdminAccounts?: ManagedAdminAccount[];
}): Promise<boolean> {
  const cleanCandidate = toAsciiDigits(params.candidatePassword).trim();
  if (!cleanCandidate) return false;

  const overrides = loadHashedPasswordOverrides();
  const existingOverride = overrides[params.userId];
  if (existingOverride) {
    return verifyPassword(
      cleanCandidate,
      existingOverride.passwordHash,
      existingOverride.passwordSalt
    );
  }

  const directory = buildHashedAccountDirectory(
    params.schools,
    params.students,
    params.teachers,
    params.managedAdminAccounts
  );
  const acc = directory.find((a) => a.userId === params.userId);
  if (!acc) return false;
  return verifyPassword(cleanCandidate, acc.passwordHash, acc.passwordSalt);
}

export function loadStoredSession(): AuthSession | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      !parsed ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.role !== 'string' ||
      typeof parsed.schoolId !== 'string' ||
      !(parsed.role in ROLE_DEFINITIONS)
    ) {
      return null;
    }
    return {
      userId: parsed.userId,
      username: parsed.username ?? '',
      displayName: parsed.displayName ?? '',
      role: parsed.role as RoleId,
      schoolId: parsed.schoolId,
      complexId: parsed.complexId,
      isComplexWide: Boolean(parsed.isComplexWide),
      isSuperAdmin: parsed.role === 'super_admin' || Boolean(parsed.isSuperAdmin),
      mustChangePassword: Boolean(parsed.mustChangePassword),
      linkedTeacherId: parsed.linkedTeacherId,
      linkedStudentId: parsed.linkedStudentId,
      loggedInAt: parsed.loggedInAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveStoredSession(session: AuthSession | null): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!session) {
      window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore storage quota
  }
}

// Re-export official names helper for any downstream consumers
export const DEFAULT_OFFICIAL_SCHOOL_NAME = OFFICIAL_SCHOOL_NAMES.school1;
