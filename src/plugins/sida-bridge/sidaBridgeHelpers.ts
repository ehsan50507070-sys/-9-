// Pure TypeScript Helpers for Phase 5 & 5.5 Enterprise Plugin: SIDA Bridge («پل اتصال هوشمند به سامانه سیدا»)
// Zero external libraries — native UTF-8 BOM CSV/Excel-TSV parsing (tab/comma/semicolon), interactive Column Mapper,
// strict Iranian mod-11 National ID validation, readiness auditor, speed-entry builder, and single-column messenger formatter.
import {
  createStudentWithInitialCredentialsSync,
  ensureStudentDualCredentials,
} from '../../core/auth/authService';
import {
  buildValidIranianNationalId,
  validateIranianMobile,
  validateIranianNationalId,
} from '../../core/validation/validators';
import { buildUtf8BomCsv } from '../../lib/csv';
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import type {
  ClassRoom,
  DescriptiveLevel,
  GradeAppeal,
  GradebookEntry,
  OnlineExam,
  OnlineExamSubmission,
  SidaEnrollmentStatus,
  Student,
  StudentElectronicProfile,
} from '../../types/domain';

export const SIDA_IMPORT_HEADERS = [
  'کد ملی',
  'نام',
  'نام خانوادگی',
  'نام پدر',
  'پایه',
  'نام کلاس',
  'شماره تماس ولی',
] as const;

export const SIDA_ENROLLMENT_STATUSES: SidaEnrollmentStatus[] = [
  'عادی',
  'انتقالی',
  'میهمان',
  'جهشی',
  'اتباع',
];

export type SidaColumnKey =
  | 'nationalId'
  | 'firstName'
  | 'lastName'
  | 'fatherName'
  | 'grade'
  | 'className'
  | 'parentMobile';

export type SidaColumnMapping = Record<SidaColumnKey, number>;

export const SIDA_COLUMN_META: Array<{ key: SidaColumnKey; labelFa: string; required: boolean }> = [
  { key: 'nationalId', labelFa: 'کد ملی (۱۰ رقمی)', required: true },
  { key: 'firstName', labelFa: 'نام', required: true },
  { key: 'lastName', labelFa: 'نام خانوادگی', required: true },
  { key: 'fatherName', labelFa: 'نام پدر', required: true },
  { key: 'grade', labelFa: 'پایه تحصیلی', required: false },
  { key: 'className', labelFa: 'کلاس', required: false },
  { key: 'parentMobile', labelFa: 'تلفن همراه ولی', required: true },
];

export type SidaImportRowStatus = 'valid' | 'duplicate' | 'invalid';

export interface SidaImportPreviewRow {
  rowIndex: number; // 1-indexed data row
  nationalId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  fatherName: string;
  gradeRaw: string;
  classNameRaw: string;
  parentMobile: string;
  matchedClassId: string | null;
  matchedClassName: string;
  existingStudentId?: string;
  status: SidaImportRowStatus;
  reasonsFa: string[];
}

export type SidaExportTerm = 'نوبت اول' | 'نوبت دوم' | 'مستمر' | 'توصیفی';
export type SidaSpeedEntryTerm = 'نوبت اول' | 'نوبت دوم' | 'مستمر' | 'سالانه';
export type SidaSpeedSortBy = 'lastName' | 'nationalId';

export interface SidaDescriptiveThresholds {
  veryGood: number; // default 18
  good: number; // default 15
  acceptable: number; // default 12
}

export const DEFAULT_SIDA_THRESHOLDS: SidaDescriptiveThresholds = {
  veryGood: 18,
  good: 15,
  acceptable: 12,
};

export interface SidaGradeExportRow {
  studentId: string;
  nationalId: string;
  nationalIdValid: boolean;
  fullName: string;
  lastName: string;
  gradeLabel: string;
  className: string;
  subject: string;
  continuousScore?: number;
  finalScore?: number;
  descriptiveLevel?: DescriptiveLevel;
  notes: string;
  warningsFa: string[];
}

export interface SidaSpeedEntryRow {
  studentId: string;
  nationalId: string;
  nationalIdValid: boolean;
  firstName: string;
  lastName: string;
  fullName: string;
  fatherName: string;
  numericScore?: number;
  descriptiveLevel?: DescriptiveLevel;
  sourceLabel: string;
}

export interface SidaReadinessAuditResult {
  readinessPercent: number;
  totalActiveStudents: number;
  invalidNationalIds: Array<{ student: Student; className: string; reasonFa: string }>;
  duplicateNationalIds: Array<{ nationalId: string; students: Array<{ student: Student; className: string }> }>;
  incompleteIdentity: Array<{ student: Student; className: string; missingFieldsFa: string[] }>;
  missingGrades: Array<{
    classId: string;
    className: string;
    subject: string;
    missingCount: number;
    totalStudents: number;
  }>;
}

/**
 * Splits a Persian full name into firstName and lastName gracefully.
 */
export function splitPersianFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

/**
 * Generates a downloadable UTF-8 BOM Persian CSV template compatible with SIDA columns
 * using mathematically valid Iranian mod-11 sample National IDs.
 */
export function buildSidaSampleCsv(): string {
  const sampleNid1 = buildValidIranianNationalId('002481920');
  const sampleNid2 = buildValidIranianNationalId('002481931');
  const sampleNid3 = buildValidIranianNationalId('002481942');
  return buildUtf8BomCsv(
    [...SIDA_IMPORT_HEADERS],
    [
      [sampleNid1, 'آرمان', 'پاکدل', 'مهدی', 'دوم', 'پایه دوم - کلاس الف', '09123456781'],
      [sampleNid2, 'یاسمین', 'شریفی', 'حسین', 'سوم', 'پایه سوم - کلاس الف', '09123456782'],
      [sampleNid3, 'کیان', 'توسلی', 'علی', 'چهارم', 'پایه چهارم - کلاس الف', '09123456783'],
    ]
  );
}

/**
 * Detects whether a CSV/TSV text uses tab (`\t` from Excel paste), semicolon (`;`), or comma (`,`) outside quotes.
 */
export function detectCsvDelimiter(rawText: string): ',' | ';' | '\t' {
  const clean = rawText.replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
  let tabCount = 0;
  let commaCount = 0;
  let semiCount = 0;
  let inQuotes = false;
  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === '\t') tabCount++;
      else if (ch === ',') commaCount++;
      else if (ch === ';') semiCount++;
    }
  }
  if (tabCount >= 1 && tabCount >= commaCount && tabCount >= semiCount) {
    return '\t';
  }
  return semiCount > commaCount ? ';' : ',';
}

/**
 * RFC-4180 pure TypeScript CSV/Excel-TSV parser supporting UTF-8 BOM, quoted cells, escaped quotes,
 * and tab (`\t`), comma (`,`), and semicolon (`;`) delimiters.
 */
export function parseSidaCsvRaw(rawText: string): {
  headers: string[];
  rows: string[][];
  delimiter: ',' | ';' | '\t';
  hadExplicitHeader: boolean;
} {
  const text = rawText.replace(/^\uFEFF/, '').trim();
  if (!text) return { headers: [], rows: [], delimiter: ',', hadExplicitHeader: false };

  const delimiter = detectCsvDelimiter(text);
  const records: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (ch === '\r' && next === '\n') {
        currentRow.push(currentField.trim());
        records.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        currentRow.push(currentField.trim());
        records.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    records.push(currentRow);
  }

  const nonEmpty = records.filter((r) => r.some((cell) => cell.length > 0));
  if (nonEmpty.length === 0) return { headers: [], rows: [], delimiter, hadExplicitHeader: false };

  // Detect if first row is a Persian/English header row or direct pasted data
  const firstRowJoined = nonEmpty[0].join(' ');
  const looksLikeHeader =
    firstRowJoined.includes('کد ملی') ||
    firstRowJoined.includes('کدملی') ||
    firstRowJoined.includes('نام خانوادگی') ||
    firstRowJoined.includes('نام پدر') ||
    firstRowJoined.includes('شماره تماس') ||
    firstRowJoined.includes('تلفن') ||
    firstRowJoined.includes('همراه') ||
    firstRowJoined.toLowerCase().includes('national');

  if (looksLikeHeader) {
    const [headers, ...rows] = nonEmpty;
    return { headers, rows, delimiter, hadExplicitHeader: true };
  }
  const colCount = Math.max(SIDA_IMPORT_HEADERS.length, nonEmpty[0].length);
  const fallbackHeaders = Array.from({ length: colCount }, (_, idx) =>
    SIDA_IMPORT_HEADERS[idx] ?? `ستون ${toPersianDigits(idx + 1)}`
  );
  return {
    headers: fallbackHeaders,
    rows: nonEmpty,
    delimiter,
    hadExplicitHeader: false,
  };
}

/**
 * Automatically maps detected CSV/Excel headers to standard SIDA field keys.
 */
export function autoDetectSidaColumnMapping(headers: string[]): SidaColumnMapping {
  const mapping: SidaColumnMapping = {
    nationalId: -1,
    firstName: -1,
    lastName: -1,
    fatherName: -1,
    grade: -1,
    className: -1,
    parentMobile: -1,
  };

  headers.forEach((rawH, idx) => {
    const h = rawH.trim().toLowerCase().replace(/\s+/g, ' ');
    if (mapping.nationalId === -1 && (h.includes('کد ملی') || h.includes('کدملی') || h.includes('national') || h.includes('nid'))) {
      mapping.nationalId = idx;
    } else if (mapping.lastName === -1 && (h.includes('نام خانوادگی') || h.includes('فامیل') || h.includes('last'))) {
      mapping.lastName = idx;
    } else if (mapping.fatherName === -1 && (h.includes('پدر') || h.includes('father'))) {
      mapping.fatherName = idx;
    } else if (mapping.firstName === -1 && (h === 'نام' || h.includes('نام دانش') || h.includes('first'))) {
      mapping.firstName = idx;
    } else if (mapping.grade === -1 && (h.includes('پایه') || h.includes('grade'))) {
      mapping.grade = idx;
    } else if (mapping.className === -1 && (h.includes('کلاس') || h.includes('class'))) {
      mapping.className = idx;
    } else if (
      mapping.parentMobile === -1 &&
      (h.includes('تلفن') || h.includes('تماس') || h.includes('همراه') || h.includes('موبایل') || h.includes('mobile') || h.includes('phone'))
    ) {
      mapping.parentMobile = idx;
    }
  });

  // Positional fallback if no headers matched at all
  const matchedAny = Object.values(mapping).some((v) => v >= 0);
  if (!matchedAny) {
    return {
      nationalId: 0,
      firstName: 1,
      lastName: 2,
      fatherName: 3,
      grade: 4,
      className: 5,
      parentMobile: 6,
    };
  }
  return mapping;
}

function normalizeGradeToken(raw: string): number | null {
  const clean = toAsciiDigits(raw).trim();
  if (!clean) return null;
  if (clean.includes('1') || clean.includes('اول')) return 1;
  if (clean.includes('2') || clean.includes('دوم')) return 2;
  if (clean.includes('3') || clean.includes('سوم')) return 3;
  if (clean.includes('4') || clean.includes('چهارم')) return 4;
  if (clean.includes('5') || clean.includes('پنجم')) return 5;
  if (clean.includes('6') || clean.includes('ششم')) return 6;
  return null;
}

function resolveClassForRow(
  gradeRaw: string,
  classNameRaw: string,
  classes: ClassRoom[]
): ClassRoom | null {
  if (classes.length === 0) return null;
  const cleanClass = classNameRaw.trim();
  if (cleanClass) {
    const exact = classes.find(
      (c) =>
        c.name.trim() === cleanClass ||
        c.name.includes(cleanClass) ||
        cleanClass.includes(c.name) ||
        c.roomCode === toAsciiDigits(cleanClass)
    );
    if (exact) return exact;
  }
  const gradeNum = normalizeGradeToken(gradeRaw) ?? normalizeGradeToken(classNameRaw);
  if (gradeNum !== null) {
    const byGrade = classes.find((c) => c.gradeLevel === gradeNum);
    if (byGrade) return byGrade;
  }
  return classes[0] ?? null;
}

/**
 * Validates parsed SIDA CSV/Excel rows against strict Iranian 10-digit National ID rules,
 * required fields, mobile format, and duplicates inside the active school or same batch.
 * Supports optional interactive `columnMapping` overrides.
 */
export function validateSidaImportRows(params: {
  rawText: string;
  existingStudents: Student[];
  classes: ClassRoom[];
  columnMapping?: SidaColumnMapping;
}): SidaImportPreviewRow[] {
  const { rawText, existingStudents, classes, columnMapping } = params;
  const parsed = parseSidaCsvRaw(rawText);
  const mapping = columnMapping ?? autoDetectSidaColumnMapping(parsed.headers);

  const existingByNid = new Map<string, Student>();
  for (const st of existingStudents) {
    const norm = toAsciiDigits(st.nationalId).replace(/\D/g, '');
    if (norm) existingByNid.set(norm, st);
  }

  const seenInBatch = new Set<string>();
  const pickCell = (cells: string[], colIdx: number): string =>
    colIdx >= 0 && colIdx < cells.length ? cells[colIdx] ?? '' : '';

  return parsed.rows.map((cells, idx) => {
    const nationalId = toAsciiDigits(pickCell(cells, mapping.nationalId)).replace(/[\s-]/g, '');
    const firstName = pickCell(cells, mapping.firstName).trim();
    const lastName = pickCell(cells, mapping.lastName).trim();
    const fatherName = pickCell(cells, mapping.fatherName).trim();
    const gradeRaw = pickCell(cells, mapping.grade).trim();
    const classNameRaw = pickCell(cells, mapping.className).trim();
    const parentMobile = toAsciiDigits(pickCell(cells, mapping.parentMobile)).replace(/[\s-]/g, '');

    const fullName = `${firstName} ${lastName}`.trim();
    const matchedClass = resolveClassForRow(gradeRaw, classNameRaw, classes);
    const reasonsFa: string[] = [];

    if (!nationalId) {
      reasonsFa.push('کد ملی وارد نشده است.');
    } else if (!/^\d{10}$/.test(nationalId)) {
      reasonsFa.push('کد ملی باید دقیقاً ۱۰ رقم عددی باشد.');
    } else if (/^(\d)\1{9}$/.test(nationalId)) {
      reasonsFa.push('کد ملی با ارقام تکراری (مانند ۱۱۱۱۱۱۱۱۱۱) نامعتبر است.');
    } else if (!validateIranianNationalId(nationalId)) {
      reasonsFa.push('رقم کنترلی کد ملی (الگوریتم سیدا/ثبت احوال) صحیح نیست.');
    }

    if (!firstName || !lastName) {
      reasonsFa.push('نام و نام خانوادگی دانش‌آموز الزامی است.');
    }
    if (!fatherName) {
      reasonsFa.push('نام پدر الزامی است.');
    }
    if (!matchedClass) {
      reasonsFa.push('کلاس متناظر در مدرسه یافت نشد.');
    }
    if (!parentMobile || !validateIranianMobile(parentMobile)) {
      reasonsFa.push('شماره تماس ولی باید ۱۱ رقم با شروع ۰۹ باشد.');
    }

    if (nationalId && seenInBatch.has(nationalId)) {
      reasonsFa.push('کد ملی در همین فایل ورودی تکراری است.');
    }

    if (nationalId) {
      seenInBatch.add(nationalId);
    }

    const existing = nationalId ? existingByNid.get(nationalId) : undefined;
    let status: SidaImportRowStatus = 'valid';
    if (reasonsFa.length > 0) {
      status = 'invalid';
    } else if (existing) {
      status = 'duplicate';
      reasonsFa.push(`دانش‌آموز «${existing.fullName}» با این کد ملی در مدرسه ثبت شده است.`);
    }

    return {
      rowIndex: idx + 1,
      nationalId,
      firstName,
      lastName,
      fullName,
      fatherName,
      gradeRaw,
      classNameRaw,
      parentMobile,
      matchedClassId: matchedClass?.id ?? null,
      matchedClassName: matchedClass?.name ?? 'نامشخص',
      existingStudentId: existing?.id,
      status,
      reasonsFa,
    };
  });
}

/**
 * Converts a validated SIDA import row into a full Student (with automatic Phase 3.5 dual student/parent credentials)
 * plus an initialized StudentElectronicProfile.
 */
export function buildStudentAndProfileFromSidaRow(params: {
  row: SidaImportPreviewRow;
  schoolId: string;
  existingStudent?: Student;
  sequenceNumber: number;
  actorName: string;
}): {
  student: Student;
  profile: StudentElectronicProfile;
  initialStudentPassword?: string;
  initialParentPassword?: string;
} {
  const { row, schoolId, existingStudent, sequenceNumber, actorName } = params;
  const studentId = existingStudent?.id ?? `${schoolId}-s-sida-${Date.now()}-${sequenceNumber}`;
  const studentCode =
    existingStudent?.studentCode ?? String(45000 + sequenceNumber + Math.floor(Math.random() * 500));
  const parentName =
    row.fatherName && row.lastName
      ? `${row.fatherName} ${row.lastName}`
      : existingStudent?.parentName ?? row.fatherName;

  const baseStudent: Student = {
    id: studentId,
    schoolId,
    classId: row.matchedClassId ?? existingStudent?.classId ?? '',
    fullName: row.fullName,
    firstName: row.firstName,
    lastName: row.lastName,
    fatherName: row.fatherName,
    nationalId: row.nationalId,
    studentCode,
    sidaStudentCode: existingStudent?.sidaStudentCode,
    birthCertificateNumber: existingStudent?.birthCertificateNumber,
    enrollmentStatus: existingStudent?.enrollmentStatus ?? 'عادی',
    parentName,
    parentMobile: row.parentMobile,
    birthDateJalali: existingStudent?.birthDateJalali,
    emergencyNotes: existingStudent?.emergencyNotes,
    studentUsername: existingStudent?.studentUsername,
    studentPasswordHash: existingStudent?.studentPasswordHash,
    studentPasswordSalt: existingStudent?.studentPasswordSalt,
    parentUsername: existingStudent?.parentUsername,
    parentPasswordHash: existingStudent?.parentPasswordHash,
    parentPasswordSalt: existingStudent?.parentPasswordSalt,
    active: true,
  };

  const created = !existingStudent
    ? createStudentWithInitialCredentialsSync(baseStudent)
    : null;
  const student = created ? created.student : ensureStudentDualCredentials(baseStudent);

  const profile: StudentElectronicProfile = {
    id: `${schoolId}:stprof:${student.id}`,
    schoolId,
    studentId: student.id,
    fatherName: row.fatherName,
    motherName: '',
    homeAddress: '',
    guardianRelation: 'پدر',
    emergencyContactName: parentName,
    emergencyContactPhone: row.parentMobile,
    documents: [],
    updatedByName: actorName,
    updatedAt: new Date().toISOString(),
  };

  return {
    student,
    profile,
    initialStudentPassword: created?.initialStudentPassword,
    initialParentPassword: created?.initialParentPassword,
  };
}

export interface SingleSidaStudentFormInput {
  existingStudentId?: string;
  nationalId: string;
  sidaStudentCode?: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  birthCertificateNumber?: string;
  birthDateJalali?: string;
  classId: string;
  enrollmentStatus: SidaEnrollmentStatus;
  parentName: string;
  parentMobile: string;
}

/**
 * Validates the individual SIDA registration / quick-edit form with mod-11 check and duplicate check in active school.
 */
export function validateSingleSidaStudentForm(params: {
  input: SingleSidaStudentFormInput;
  existingStudents: Student[];
}): {
  ok: boolean;
  normalizedNationalId: string;
  normalizedMobile: string;
  nationalIdStatus: 'empty' | 'invalid' | 'duplicate' | 'valid';
  nationalIdMessageFa: string;
  errorsFa: string[];
} {
  const { input, existingStudents } = params;
  const normalizedNationalId = toAsciiDigits(input.nationalId).replace(/[\s-]/g, '');
  const normalizedMobile = toAsciiDigits(input.parentMobile).replace(/[\s-]/g, '');
  const errorsFa: string[] = [];

  let nationalIdStatus: 'empty' | 'invalid' | 'duplicate' | 'valid' = 'valid';
  let nationalIdMessageFa = 'کد ملی معتبر و یکتا در این مدرسه است (الگوریتم سیدا تایید شد).';

  if (!normalizedNationalId) {
    nationalIdStatus = 'empty';
    nationalIdMessageFa = 'کد ملی ۱۰ رقمی را وارد کنید.';
    errorsFa.push('کد ملی دانش‌آموز الزامی است.');
  } else if (!validateIranianNationalId(normalizedNationalId)) {
    nationalIdStatus = 'invalid';
    nationalIdMessageFa = 'کد ملی واردشده نامعتبر است (کنترل ۱۰ رقم و رقم کنترلی ۱۱ برقرار نیست).';
    errorsFa.push('کد ملی دانش‌آموز نامعتبر است.');
  } else {
    const dup = existingStudents.find(
      (s) =>
        s.id !== input.existingStudentId &&
        toAsciiDigits(s.nationalId).replace(/\D/g, '') === normalizedNationalId
    );
    if (dup) {
      nationalIdStatus = 'duplicate';
      nationalIdMessageFa = `این کد ملی قبلاً برای «${dup.fullName}» در همین مدرسه ثبت شده است.`;
      errorsFa.push(nationalIdMessageFa);
    }
  }

  if (!input.firstName.trim()) errorsFa.push('نام دانش‌آموز الزامی است.');
  if (!input.lastName.trim()) errorsFa.push('نام خانوادگی دانش‌آموز الزامی است.');
  if (!input.fatherName.trim()) errorsFa.push('نام پدر الزامی است.');
  if (!input.classId.trim()) errorsFa.push('انتخاب کلاس الزامی است.');
  if (!normalizedMobile || !validateIranianMobile(normalizedMobile)) {
    errorsFa.push('شماره همراه ولی باید ۱۱ رقم با شروع ۰۹ باشد.');
  }

  return {
    ok: errorsFa.length === 0,
    normalizedNationalId,
    normalizedMobile,
    nationalIdStatus,
    nationalIdMessageFa,
    errorsFa,
  };
}

/**
 * Formats single-column login credentials for a single registered/updated student for Eitaa/Bale/Shad.
 */
export function formatSingleStudentCredentialsMessenger(params: {
  schoolName: string;
  className: string;
  student: Student;
  initialStudentPassword?: string;
  initialParentPassword?: string;
}): string {
  const { schoolName, className, student, initialStudentPassword, initialParentPassword } = params;
  return [
    `🔐 اطلاعات ورود به سامانه هوشمند مدارس گلستان راه روشن`,
    `🏫 ${schoolName}`,
    `👤 دانش‌آموز: ${student.fullName} (${className})`,
    `🆔 کد ملی: ${toPersianDigits(student.nationalId)}`,
    `────────────────────`,
    `🎓 حساب اختصاصی دانش‌آموز:`,
    `نام کاربری: ${student.studentUsername ?? '-'}`,
    `رمز عبور: ${initialStudentPassword ?? 'رمزگذاری‌شده (محرمانه)'}`,
    `────────────────────`,
    `👨‍👩‍👧 حساب اختصاصی ولی (نظارت و گفت‌وگو):`,
    `نام کاربری: ${student.parentUsername ?? '-'}`,
    `رمز عبور: ${initialParentPassword ?? 'رمزگذاری‌شده و مجزا (محرمانه)'}`,
    `────────────────────`,
    `با احترام — دفتر آموزش و امور سیدا`,
  ].join('\n');
}

/**
 * Maps numeric score (0..20) to standard Iranian elementary descriptive scale (Phase 5 default).
 */
export function scoreToDescriptiveLevel(score: number): DescriptiveLevel {
  if (score >= 17) return 'خیلی خوب';
  if (score >= 14) return 'خوب';
  if (score >= 10) return 'قابل قبول';
  return 'نیاز به تلاش بیشتر';
}

/**
 * Configurable numeric -> descriptive SIDA scale converter (default: 18-20 خیلی خوب, 15-17.99 خوب, 12-14.99 قابل قبول, <12 نیاز به تلاش بیشتر).
 */
export function scoreToConfigurableDescriptive(
  score: number,
  thresholds: SidaDescriptiveThresholds = DEFAULT_SIDA_THRESHOLDS
): DescriptiveLevel {
  if (score >= thresholds.veryGood) return 'خیلی خوب';
  if (score >= thresholds.good) return 'خوب';
  if (score >= thresholds.acceptable) return 'قابل قبول';
  return 'نیاز به تلاش بیشتر';
}

/**
 * Automated pre-submission SIDA Readiness Health-Check Scanner for active school.
 */
export function runSidaReadinessAudit(params: {
  students: Student[];
  classes: ClassRoom[];
  studentProfiles: StudentElectronicProfile[];
  gradebookEntries: GradebookEntry[];
  onlineExams: OnlineExam[];
  onlineExamSubmissions: OnlineExamSubmission[];
  activeSubjects?: string[];
}): SidaReadinessAuditResult {
  const {
    students,
    classes,
    studentProfiles,
    gradebookEntries,
    onlineExams,
    onlineExamSubmissions,
    activeSubjects,
  } = params;

  const activeStudents = students.filter((s) => s.active);
  const classMap = new Map(classes.map((c) => [c.id, c]));
  const profileByStudent = new Map(studentProfiles.map((p) => [p.studentId, p]));

  const invalidNationalIds: SidaReadinessAuditResult['invalidNationalIds'] = [];
  const nidBuckets = new Map<string, Array<{ student: Student; className: string }>>();
  const incompleteIdentity: SidaReadinessAuditResult['incompleteIdentity'] = [];

  for (const st of activeStudents) {
    const cls = classMap.get(st.classId);
    const className = cls?.name ?? 'بدون کلاس';
    const normNid = toAsciiDigits(st.nationalId ?? '').replace(/\D/g, '');

    if (!normNid) {
      invalidNationalIds.push({ student: st, className, reasonFa: 'کد ملی ثبت نشده است' });
    } else if (!validateIranianNationalId(normNid)) {
      invalidNationalIds.push({ student: st, className, reasonFa: 'کد ملی نامعتبر (کنترل رقم ۱۱)' });
    } else {
      const bucket = nidBuckets.get(normNid) ?? [];
      bucket.push({ student: st, className });
      nidBuckets.set(normNid, bucket);
    }

    const prof = profileByStudent.get(st.id);
    const fatherName = (st.fatherName ?? prof?.fatherName ?? '').trim();
    const birthDate = (st.birthDateJalali ?? '').trim();
    const missingFieldsFa: string[] = [];
    if (!fatherName) missingFieldsFa.push('نام پدر');
    if (!birthDate) missingFieldsFa.push('تاریخ تولد شمسی');
    if (!cls) missingFieldsFa.push('کلاس معتبر');

    if (missingFieldsFa.length > 0) {
      incompleteIdentity.push({ student: st, className, missingFieldsFa });
    }
  }

  const duplicateNationalIds: SidaReadinessAuditResult['duplicateNationalIds'] = [];
  for (const [nationalId, list] of nidBuckets.entries()) {
    if (list.length > 1) {
      duplicateNationalIds.push({ nationalId, students: list });
    }
  }

  // Check classes & subjects for unrecorded grades
  const subjectsSet = new Set<string>(
    activeSubjects && activeSubjects.length > 0 ? activeSubjects : ['ریاضی', 'فارسی و نگارش']
  );
  for (const g of gradebookEntries) {
    if (g.subject) subjectsSet.add(g.subject);
  }
  const subjectsToCheck = Array.from(subjectsSet).slice(0, 5);

  const missingGrades: SidaReadinessAuditResult['missingGrades'] = [];
  for (const cls of classes) {
    const classStudents = activeStudents.filter((s) => s.classId === cls.id);
    if (classStudents.length === 0) continue;

    for (const subject of subjectsToCheck) {
      const examIds = new Set(
        onlineExams.filter((ex) => ex.classId === cls.id && ex.subject === subject).map((ex) => ex.id)
      );
      let missingCount = 0;
      for (const st of classStudents) {
        const hasGb = gradebookEntries.some(
          (g) =>
            g.studentId === st.id &&
            g.subject === subject &&
            (typeof g.numericScore === 'number' || Boolean(g.descriptiveLevel))
        );
        const hasEx =
          examIds.size > 0 &&
          onlineExamSubmissions.some((sub) => sub.studentId === st.id && examIds.has(sub.examId));
        if (!hasGb && !hasEx) {
          missingCount++;
        }
      }
      if (missingCount > 0) {
        missingGrades.push({
          classId: cls.id,
          className: cls.name,
          subject,
          missingCount,
          totalStudents: classStudents.length,
        });
      }
    }
  }

  // Readiness Score Calculation (weighted across student identity + grade completeness)
  if (activeStudents.length === 0) {
    return {
      readinessPercent: 100,
      totalActiveStudents: 0,
      invalidNationalIds,
      duplicateNationalIds,
      incompleteIdentity,
      missingGrades,
    };
  }

  const totalChecks = activeStudents.length * 3 + Math.max(1, classes.length * subjectsToCheck.length);
  const dupStudentCount = duplicateNationalIds.reduce((acc, d) => acc + d.students.length, 0);
  const failedChecks =
    invalidNationalIds.length +
    dupStudentCount +
    incompleteIdentity.length +
    missingGrades.length;

  const readinessPercent = Math.max(
    0,
    Math.min(100, Math.round(((totalChecks - Math.min(totalChecks, failedChecks)) / totalChecks) * 100))
  );

  return {
    readinessPercent,
    totalActiveStudents: activeStudents.length,
    invalidNationalIds,
    duplicateNationalIds,
    incompleteIdentity,
    missingGrades,
  };
}

const GRADE_LABEL_MAP: Record<number, string> = {
  1: 'اول ابتدایی',
  2: 'دوم ابتدایی',
  3: 'سوم ابتدایی',
  4: 'چهارم ابتدایی',
  5: 'پنجم ابتدایی',
  6: 'ششم ابتدایی',
};

const TERM_MONTH_PRIORITY: Record<SidaExportTerm, string[]> = {
  'نوبت اول': ['دی', 'آذر', 'آبان', 'مهر'],
  'نوبت دوم': ['اردیبهشت', 'فروردین', 'اسفند', 'بهمن'],
  مستمر: ['آبان', 'آذر', 'بهمن', 'فروردین', 'مهر', 'دی', 'اسفند', 'اردیبهشت'],
  توصیفی: ['دی', 'اردیبهشت', 'آذر', 'آبان', 'بهمن', 'فروردین', 'مهر', 'اسفند'],
};

const SPEED_TERM_MONTHS: Record<SidaSpeedEntryTerm, string[]> = {
  'نوبت اول': ['دی', 'آذر', 'آبان', 'مهر'],
  'نوبت دوم': ['اردیبهشت', 'فروردین', 'اسفند', 'بهمن'],
  مستمر: ['آبان', 'آذر', 'بهمن', 'فروردین', 'مهر', 'دی', 'اسفند', 'اردیبهشت'],
  سالانه: ['اردیبهشت', 'دی', 'فروردین', 'اسفند', 'آذر', 'آبان', 'بهمن', 'مهر'],
};

/**
 * Builds rows for SIDA Speed-Entry Assistant with sorting by Persian Last Name or National ID
 * and configurable descriptive scale thresholds.
 */
export function buildSidaSpeedEntryRows(params: {
  students: Student[];
  studentProfiles: StudentElectronicProfile[];
  gradebookEntries: GradebookEntry[];
  onlineExams: OnlineExam[];
  onlineExamSubmissions: OnlineExamSubmission[];
  classId: string;
  subject: string;
  term: SidaSpeedEntryTerm;
  sortBy: SidaSpeedSortBy;
  thresholds?: SidaDescriptiveThresholds;
}): SidaSpeedEntryRow[] {
  const {
    students,
    studentProfiles,
    gradebookEntries,
    onlineExams,
    onlineExamSubmissions,
    classId,
    subject,
    term,
    sortBy,
    thresholds = DEFAULT_SIDA_THRESHOLDS,
  } = params;

  const profileMap = new Map(studentProfiles.map((p) => [p.studentId, p]));
  const monthPriority = SPEED_TERM_MONTHS[term];
  const classStudents = students.filter((s) => s.active && s.classId === classId);

  const rows: SidaSpeedEntryRow[] = classStudents.map((st) => {
    const split = splitPersianFullName(st.fullName);
    const firstName = st.firstName?.trim() || split.firstName;
    const lastName = st.lastName?.trim() || split.lastName || split.firstName;
    const fatherName = st.fatherName?.trim() || profileMap.get(st.id)?.fatherName?.trim() || '—';

    const studentEntries = gradebookEntries.filter(
      (g) => g.studentId === st.id && (!subject || g.subject === subject)
    );

    let selectedEntry: GradebookEntry | undefined;
    for (const m of monthPriority) {
      const found = studentEntries.find((e) => e.jalaliMonth === m);
      if (found) {
        selectedEntry = found;
        break;
      }
    }
    if (!selectedEntry) selectedEntry = studentEntries[0];

    const matchingExamIds = new Set(
      onlineExams
        .filter((ex) => ex.classId === st.classId && (!subject || ex.subject === subject))
        .map((ex) => ex.id)
    );
    const latestExamSub = onlineExamSubmissions
      .filter((sub) => sub.studentId === st.id && matchingExamIds.has(sub.examId))
      .sort((a, b) => b.submittedAtIso.localeCompare(a.submittedAtIso))[0];

    let numericScore: number | undefined;
    let sourceLabel = 'ثبت نشده';

    if (term === 'سالانه') {
      const allNumeric = studentEntries
        .map((e) => e.numericScore)
        .filter((v): v is number => typeof v === 'number');
      if (allNumeric.length > 0) {
        numericScore = Math.round((allNumeric.reduce((a, b) => a + b, 0) / allNumeric.length) * 10) / 10;
        sourceLabel = 'میانگین سالانه دفتر کلاسی';
      }
    } else if (term === 'مستمر' && selectedEntry) {
      const parts = [
        selectedEntry.oralQuizScore,
        selectedEntry.classActivityScore,
        selectedEntry.microQuizScore,
      ].filter((v): v is number => typeof v === 'number');
      if (parts.length > 0) {
        numericScore = Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 10) / 10;
        sourceLabel = `مستمر (${selectedEntry.jalaliMonth})`;
      } else if (typeof selectedEntry.numericScore === 'number') {
        numericScore = selectedEntry.numericScore;
        sourceLabel = `دفتر کلاسی (${selectedEntry.jalaliMonth})`;
      }
    } else if (selectedEntry && typeof selectedEntry.numericScore === 'number') {
      numericScore = selectedEntry.numericScore;
      sourceLabel = `دفتر کلاسی (${selectedEntry.jalaliMonth})`;
    }

    if (numericScore === undefined && latestExamSub && typeof latestExamSub.finalScore20 === 'number') {
      numericScore = Math.round(latestExamSub.finalScore20 * 10) / 10;
      sourceLabel = 'آزمون آنلاین';
    }

    const descriptiveLevel =
      typeof numericScore === 'number'
        ? scoreToConfigurableDescriptive(numericScore, thresholds)
        : selectedEntry?.descriptiveLevel;

    if (sourceLabel === 'ثبت نشده' && descriptiveLevel) {
      sourceLabel = `توصیفی (${selectedEntry?.jalaliMonth ?? 'دفتر'})`;
    }

    return {
      studentId: st.id,
      nationalId: st.nationalId,
      nationalIdValid: validateIranianNationalId(st.nationalId),
      firstName,
      lastName,
      fullName: st.fullName,
      fatherName,
      numericScore,
      descriptiveLevel,
      sourceLabel,
    };
  });

  if (sortBy === 'nationalId') {
    return rows.sort((a, b) =>
      toAsciiDigits(a.nationalId).localeCompare(toAsciiDigits(b.nationalId), 'en')
    );
  }
  return rows.sort((a, b) => {
    const byLast = a.lastName.localeCompare(b.lastName, 'fa');
    if (byLast !== 0) return byLast;
    return a.firstName.localeCompare(b.firstName, 'fa');
  });
}

/**
 * Aggregates live student scores from Gradebook & published Online Exams for SIDA standard export,
 * flagging missing national IDs or missing grades in amber.
 */
export function buildSidaGradeExportRows(params: {
  students: Student[];
  classes: ClassRoom[];
  gradebookEntries: GradebookEntry[];
  onlineExams: OnlineExam[];
  onlineExamSubmissions: OnlineExamSubmission[];
  gradeLevelFilter: number | 'all';
  classIdFilter: string;
  subjectFilter: string;
  term: SidaExportTerm;
}): SidaGradeExportRow[] {
  const {
    students,
    classes,
    gradebookEntries,
    onlineExams,
    onlineExamSubmissions,
    gradeLevelFilter,
    classIdFilter,
    subjectFilter,
    term,
  } = params;

  const classMap = new Map(classes.map((c) => [c.id, c]));
  const filteredStudents = students
    .filter((st) => st.active)
    .filter((st) => {
      const cls = classMap.get(st.classId);
      if (!cls) return false;
      if (gradeLevelFilter !== 'all' && cls.gradeLevel !== gradeLevelFilter) return false;
      if (classIdFilter !== 'all' && st.classId !== classIdFilter) return false;
      return true;
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'fa'));

  const monthPriority = TERM_MONTH_PRIORITY[term];

  return filteredStudents.map((st) => {
    const cls = classMap.get(st.classId);
    const gradeLabel = cls
      ? cls.customGradeLabel ?? GRADE_LABEL_MAP[cls.gradeLevel] ?? `پایه ${toPersianDigits(cls.gradeLevel)}`
      : 'نامشخص';

    const studentEntries = gradebookEntries.filter(
      (g) => g.studentId === st.id && (!subjectFilter || g.subject === subjectFilter)
    );

    let selectedEntry: GradebookEntry | undefined;
    for (const m of monthPriority) {
      const found = studentEntries.find((e) => e.jalaliMonth === m);
      if (found) {
        selectedEntry = found;
        break;
      }
    }
    if (!selectedEntry) {
      selectedEntry = studentEntries[0];
    }

    const matchingExamIds = new Set(
      onlineExams
        .filter((ex) => ex.classId === st.classId && (!subjectFilter || ex.subject === subjectFilter))
        .map((ex) => ex.id)
    );
    const examSubs = onlineExamSubmissions.filter(
      (sub) => sub.studentId === st.id && matchingExamIds.has(sub.examId)
    );
    const latestExamSub = examSubs.sort((a, b) => b.submittedAtIso.localeCompare(a.submittedAtIso))[0];
    const examScoreOn20 =
      latestExamSub && typeof latestExamSub.finalScore20 === 'number'
        ? Math.round(latestExamSub.finalScore20 * 10) / 10
        : undefined;

    const continuousParts = [
      selectedEntry?.oralQuizScore,
      selectedEntry?.classActivityScore,
      selectedEntry?.microQuizScore,
    ].filter((v): v is number => typeof v === 'number');

    const continuousScore =
      continuousParts.length > 0
        ? Math.round((continuousParts.reduce((acc, v) => acc + v, 0) / continuousParts.length) * 10) / 10
        : selectedEntry?.numericScore ?? examScoreOn20;

    const finalScore =
      term === 'مستمر'
        ? continuousScore
        : selectedEntry?.numericScore ?? examScoreOn20;

    const descriptiveLevel =
      selectedEntry?.descriptiveLevel ??
      (typeof finalScore === 'number' ? scoreToDescriptiveLevel(finalScore) : undefined);

    const nationalIdValid = validateIranianNationalId(st.nationalId);
    const warningsFa: string[] = [];
    if (!nationalIdValid) {
      warningsFa.push('کد ملی نامعتبر یا ناقص');
    }
    if (term === 'توصیفی') {
      if (!descriptiveLevel) warningsFa.push('ارزشیابی توصیفی ثبت نشده');
    } else if (finalScore === undefined && continuousScore === undefined) {
      warningsFa.push('نمره درس ثبت نشده');
    }

    const notesParts: string[] = [];
    if (selectedEntry?.disciplinaryNote) notesParts.push(selectedEntry.disciplinaryNote);
    if (latestExamSub) {
      notesParts.push(`همگام با آزمون آنلاین (${toPersianDigits(examScoreOn20 ?? 0)} از ۲۰)`);
    }

    const split = splitPersianFullName(st.fullName);

    return {
      studentId: st.id,
      nationalId: st.nationalId,
      nationalIdValid,
      fullName: st.fullName,
      lastName: st.lastName?.trim() || split.lastName || split.firstName,
      gradeLabel,
      className: cls?.name ?? 'نامشخص',
      subject: subjectFilter || selectedEntry?.subject || 'عمومی',
      continuousScore,
      finalScore,
      descriptiveLevel,
      notes: notesParts.join(' | '),
      warningsFa,
    };
  });
}

export function buildSidaGradeExportCsv(rows: SidaGradeExportRow[]): string {
  const headers = [
    'کد ملی',
    'نام و نام خانوادگی',
    'پایه',
    'کلاس',
    'نام درس',
    'نمره مستمر',
    'نمره پایانی',
    'وضعیت توصیفی',
    'توضیحات',
  ];
  return buildUtf8BomCsv(
    headers,
    rows.map((r) => [
      toAsciiDigits(r.nationalId),
      r.fullName,
      r.gradeLabel,
      r.className,
      r.subject,
      r.continuousScore !== undefined ? String(r.continuousScore) : '',
      r.finalScore !== undefined ? String(r.finalScore) : '',
      r.descriptiveLevel ?? '',
      r.notes,
    ])
  );
}

/**
 * Generates standard SIDA Student Roster UTF-8 BOM Persian CSV for active school.
 */
export function buildSidaStudentListCsv(params: {
  students: Student[];
  classes: ClassRoom[];
  studentProfiles: StudentElectronicProfile[];
  classIdFilter?: string;
}): string {
  const { students, classes, studentProfiles, classIdFilter } = params;
  const classMap = new Map(classes.map((c) => [c.id, c]));
  const profileMap = new Map(studentProfiles.map((p) => [p.studentId, p]));

  const filtered = students
    .filter((s) => s.active && (!classIdFilter || classIdFilter === 'all' || s.classId === classIdFilter))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'fa'));

  const headers = [
    'کد ملی',
    'کد سیدا',
    'نام',
    'نام خانوادگی',
    'نام پدر',
    'شماره شناسنامه',
    'تاریخ تولد',
    'پایه',
    'کلاس',
    'وضعیت ثبت‌نام',
    'نام ولی',
    'تلفن همراه ولی',
  ];

  return buildUtf8BomCsv(
    headers,
    filtered.map((st) => {
      const split = splitPersianFullName(st.fullName);
      const cls = classMap.get(st.classId);
      const prof = profileMap.get(st.id);
      const gradeLabel = cls
        ? cls.customGradeLabel ?? GRADE_LABEL_MAP[cls.gradeLevel] ?? `پایه ${cls.gradeLevel}`
        : '';
      return [
        toAsciiDigits(st.nationalId),
        st.sidaStudentCode ?? '',
        st.firstName?.trim() || split.firstName,
        st.lastName?.trim() || split.lastName,
        st.fatherName?.trim() || prof?.fatherName || '',
        st.birthCertificateNumber ?? '',
        st.birthDateJalali ?? '',
        gradeLabel,
        cls?.name ?? '',
        st.enrollmentStatus ?? 'عادی',
        st.parentName ?? '',
        toAsciiDigits(st.parentMobile ?? ''),
      ];
    })
  );
}

export function getSidaAppealStatusMeta(status: GradeAppeal['status']): {
  labelFa: string;
  badgeClass: string;
} {
  switch (status) {
    case 'submitted':
      return {
        labelFa: 'ثبت شده (جدید)',
        badgeClass: 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      };
    case 'in_review':
    case 'teacher_reviewed':
      return {
        labelFa: 'در حال بررسی',
        badgeClass: 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      };
    case 'principal_approved':
      return {
        labelFa: 'تایید اعتراض و اصلاح نمره',
        badgeClass: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      };
    case 'rejected':
      return {
        labelFa: 'رد اعتراض (تایید نمره اولیه)',
        badgeClass: 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      };
  }
}

/**
 * Formats a clean single-column Persian message for sending the grade objection resolution
 * directly to parents via Eitaa, Bale, or Shad.
 */
export function formatObjectionResolutionMessenger(params: {
  schoolName: string;
  studentName: string;
  className: string;
  appeal: GradeAppeal;
}): string {
  const { schoolName, studentName, className, appeal } = params;
  const statusMeta = getSidaAppealStatusMeta(appeal.status);
  const oldVal =
    appeal.originalScore !== undefined
      ? `${toPersianDigits(appeal.originalScore)} از ۲۰`
      : appeal.originalDescriptiveLevel ?? 'ثبت نشده';
  const newVal =
    appeal.revisedScore !== undefined
      ? `${toPersianDigits(appeal.revisedScore)} از ۲۰`
      : appeal.revisedDescriptiveLevel ?? oldVal;
  const explanation =
    appeal.sidaResolutionNote ?? appeal.principalNote ?? appeal.teacherResponse ?? 'برگه مجدداً بررسی شد.';
  const resolvedDate = appeal.resolvedAtJalali ?? getTodayJalali();

  return [
    `📌 پاسخ رسمی رسیدگی به اعتراض نمره`,
    `🏫 ${schoolName}`,
    `👤 دانش‌آموز: ${studentName} (${className})`,
    `📚 درس: ${appeal.subject} — ماه ${appeal.jalaliMonth}`,
    `📋 نتیجه بررسی: ${statusMeta.labelFa}`,
    `🔢 نمره اولیه: ${oldVal}`,
    appeal.status === 'principal_approved' ? `✅ نمره اصلاح‌شده (ثبت در سیدا): ${newVal}` : `ℹ️ نمره تاییدشده: ${oldVal}`,
    `📝 شرح بررسی برگه: ${toPersianDigits(explanation)}`,
    `📅 تاریخ اعلام نتیجه: ${toPersianDigits(resolvedDate)}`,
    `با احترام — واحد آموزش و ارزیابی مدرسه`,
  ].join('\n');
}
