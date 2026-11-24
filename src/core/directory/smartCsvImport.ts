// Step 3: Zero-Dependency Smart Excel / UTF-8 BOM CSV Importer (Students + Staff/Teachers)
// Auto-detects Persian columns, validates into 3 color-coded buckets (Valid/Green, Incomplete/Amber, Duplicate/Red),
// enforces Layer-1 sanitization + non-Persian usernames + distinct hashed passwords, and builds printable HTML reports.
import { buildUtf8BomCsv, parseCsvText } from '../../lib/csv';
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import type { ClassRoom, Student, Teacher } from '../../types/domain';
import { ensureStudentDualCredentials, ensureTeacherHashed } from '../auth/authService';
import { escapeHtml, generateUUID, sanitizeText } from '../security/sanitize';
import { validateIranianMobile, validateIranianNationalId } from '../validation/validators';

export type SmartImportRowStatus = 'valid' | 'incomplete' | 'duplicate';

export interface SmartStudentImportRow {
  rowNumber: number;
  status: SmartImportRowStatus;
  firstName: string;
  lastName: string;
  fullName: string;
  nationalId: string;
  parentName: string;
  parentMobile: string;
  studentMobile?: string;
  gradeLabel?: string;
  classId: string;
  className: string;
  birthDateJalali?: string;
  generatedStudentUsername?: string;
  generatedParentUsername?: string;
  reasons: string[];
}

export interface SmartTeacherImportRow {
  rowNumber: number;
  status: SmartImportRowStatus;
  firstName: string;
  lastName: string;
  fullName: string;
  nationalId: string;
  mobile: string;
  specialty: string;
  personnelCode: string;
  weeklyQuotaPeriods: number;
  assignedClassIds: string[];
  assignedClassNames: string[];
  reasons: string[];
}

export interface SmartImportSummary<T> {
  detectedColumns: Record<string, number>;
  rows: T[];
  validCount: number;
  incompleteCount: number;
  duplicateCount: number;
}

function normalizeHeader(raw: string): string {
  return toAsciiDigits(raw)
    .replace(/^\uFEFF/, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\s_\-()]/g, '')
    .toLowerCase();
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  const normalizedHeaders = headers.map(normalizeHeader);
  const normalizedAliases = aliases.map(normalizeHeader);
  for (const alias of normalizedAliases) {
    const exact = normalizedHeaders.findIndex((h) => h === alias);
    if (exact >= 0) return exact;
  }
  for (const alias of normalizedAliases) {
    const partial = normalizedHeaders.findIndex((h) => h.includes(alias));
    if (partial >= 0) return partial;
  }
  return -1;
}

function cleanCell(cols: string[], idx: number): string {
  if (idx < 0 || idx >= cols.length) return '';
  return sanitizeText(cols[idx] ?? '', 200);
}

function normalizeDigitsField(raw: string): string {
  return toAsciiDigits(raw).replace(/[\s\-_]/g, '');
}

function matchClassRoom(
  classes: ClassRoom[],
  classHint: string,
  gradeHint: string
): ClassRoom | undefined {
  const normClass = normalizeHeader(classHint);
  const normGrade = normalizeHeader(gradeHint);
  if (normClass) {
    const exact = classes.find(
      (c) =>
        normalizeHeader(c.name) === normClass ||
        normalizeHeader(c.id) === normClass ||
        normalizeHeader(c.roomCode) === normClass
    );
    if (exact) return exact;
    const partial = classes.find(
      (c) =>
        normalizeHeader(c.name).includes(normClass) ||
        normClass.includes(normalizeHeader(c.name))
    );
    if (partial) return partial;
  }
  if (normGrade) {
    const gradeNumMatch = toAsciiDigits(gradeHint).match(/[2-6]/);
    if (gradeNumMatch) {
      const g = Number(gradeNumMatch[0]);
      const byGrade = classes.find((c) => c.gradeLevel === g);
      if (byGrade) return byGrade;
    }
    const gradeWordMap: Record<string, number> = {
      دوم: 2,
      سوم: 3,
      چهارم: 4,
      پنجم: 5,
      ششم: 6,
    };
    for (const [word, g] of Object.entries(gradeWordMap)) {
      if (gradeHint.includes(word)) {
        const byWord = classes.find((c) => c.gradeLevel === g);
        if (byWord) return byWord;
      }
    }
  }
  return classes[0];
}

/**
 * Parses and validates Student CSV/Excel text into 3 distinct categories:
 * - valid (green)
 * - incomplete (amber, exact missing/invalid column reasons)
 * - duplicate (red, duplicate nationalId or username)
 */
export function parseAndValidateStudentCsv(params: {
  csvText: string;
  classes: ClassRoom[];
  existingStudents: Student[];
}): SmartImportSummary<SmartStudentImportRow> {
  const parsed = parseCsvText(params.csvText);
  const headers = parsed.headers;

  let firstNameCol = findColumnIndex(headers, ['نام']);
  const lastNameCol = findColumnIndex(headers, ['نام خانوادگی', 'نامخانوادگی', 'فامیلی']);
  const fullNameCol = findColumnIndex(headers, ['نام و نام خانوادگی', 'نامونامخانوادگی', 'نام کامل', 'دانش آموز']);
  // If «نام» matched «نام و نام خانوادگی», avoid double-matching
  if (firstNameCol === fullNameCol && lastNameCol === -1) {
    firstNameCol = -1;
  }
  const nationalIdCol = findColumnIndex(headers, ['کد ملی', 'کدملی', 'شماره ملی']);
  const parentNameCol = findColumnIndex(headers, ['نام ولی', 'نام پدر', 'ولی']);
  const parentMobileCol = findColumnIndex(headers, [
    'شماره موبایل ولی',
    'موبایل ولی',
    'تلفن ولی',
    'همراه ولی',
    'موبایل',
  ]);
  const studentMobileCol = findColumnIndex(headers, [
    'شماره موبایل دانش آموز',
    'موبایل دانش آموز',
    'همراه دانش آموز',
  ]);
  const gradeCol = findColumnIndex(headers, ['پایه', 'پایه تحصیلی', 'مقطع']);
  const classCol = findColumnIndex(headers, ['کلاس', 'نام کلاس', 'شعبه']);
  const birthCol = findColumnIndex(headers, ['تاریخ تولد', 'تاریخ تولد شمسی', 'تولد']);

  // Positional fallback when user uploads headerless or custom-header 6-column legacy CSV
  const hasDetectedAny =
    fullNameCol >= 0 || firstNameCol >= 0 || nationalIdCol >= 0 || parentMobileCol >= 0;

  const detectedColumns: Record<string, number> = {
    firstName: hasDetectedAny ? firstNameCol : -1,
    lastName: hasDetectedAny ? lastNameCol : -1,
    fullName: hasDetectedAny ? fullNameCol : 0,
    nationalId: hasDetectedAny ? nationalIdCol : 1,
    className: hasDetectedAny ? classCol : 2,
    parentName: hasDetectedAny ? parentNameCol : 3,
    parentMobile: hasDetectedAny ? parentMobileCol : 4,
    studentMobile: hasDetectedAny ? studentMobileCol : -1,
    grade: hasDetectedAny ? gradeCol : -1,
    birthDate: hasDetectedAny ? birthCol : 5,
  };

  const existingNatIds = new Set(params.existingStudents.map((s) => normalizeDigitsField(s.nationalId)));
  const existingUsernames = new Set(
    params.existingStudents
      .flatMap((s) => [s.studentUsername, s.parentUsername])
      .filter((u): u is string => Boolean(u))
      .map((u) => u.toLowerCase())
  );
  const seenNatIdsInFile = new Set<string>();

  const rows: SmartStudentImportRow[] = [];

  for (let i = 0; i < parsed.rows.length; i += 1) {
    const cols = parsed.rows[i];
    const fName = cleanCell(cols, detectedColumns.firstName);
    const lName = cleanCell(cols, detectedColumns.lastName);
    const rawFull = cleanCell(cols, detectedColumns.fullName);
    const fullName = rawFull || [fName, lName].filter(Boolean).join(' ').trim();
    const firstName = fName || fullName.split(' ')[0] || '';
    const lastName = lName || fullName.split(' ').slice(1).join(' ');

    const nationalId = normalizeDigitsField(cleanCell(cols, detectedColumns.nationalId));
    const parentName = cleanCell(cols, detectedColumns.parentName) || (lastName ? `ولی ${lastName}` : '');
    const parentMobile = normalizeDigitsField(cleanCell(cols, detectedColumns.parentMobile));
    const studentMobile = normalizeDigitsField(cleanCell(cols, detectedColumns.studentMobile)) || undefined;
    const gradeHint = cleanCell(cols, detectedColumns.grade);
    const classHint = cleanCell(cols, detectedColumns.className);
    const birthDateJalali = normalizeDigitsField(cleanCell(cols, detectedColumns.birthDate)) || undefined;

    const matchedClass = matchClassRoom(params.classes, classHint, gradeHint);
    const candidateStUser = nationalId ? `st-${nationalId}` : '';
    const candidatePrUser = nationalId ? `pr-${nationalId}` : '';

    const duplicateReasons: string[] = [];
    const incompleteReasons: string[] = [];

    if (!fullName || fullName.length < 3) {
      incompleteReasons.push('ستون «نام / نام خانوادگی» خالی یا کمتر از ۳ کاراکتر است.');
    }
    if (!nationalId) {
      incompleteReasons.push('ستون «کد ملی» خالی است.');
    } else if (!validateIranianNationalId(nationalId)) {
      incompleteReasons.push('«کد ملی» باید ۱۰ رقم معتبر ایرانی باشد.');
    }
    if (!parentMobile) {
      incompleteReasons.push('ستون «شماره موبایل ولی» خالی است.');
    } else if (!validateIranianMobile(parentMobile)) {
      incompleteReasons.push('«شماره موبایل ولی» معتبر نیست (باید ۱۱ رقم و با ۰۹ شروع شود).');
    }
    if (studentMobile && !validateIranianMobile(studentMobile)) {
      incompleteReasons.push('«شماره موبایل دانش‌آموز» نامعتبر است (۱۱ رقم با شروع ۰۹).');
    }
    if (!matchedClass) {
      incompleteReasons.push('ستون «کلاس / پایه» با هیچ کلاسی در مدرسه مطابقت ندارد.');
    }

    if (nationalId) {
      if (existingNatIds.has(nationalId)) {
        duplicateReasons.push(`تکراری: کد ملی ${toPersianDigits(nationalId)} قبلاً در مدرسه ثبت شده است.`);
      } else if (seenNatIdsInFile.has(nationalId)) {
        duplicateReasons.push(`تکراری: کد ملی ${toPersianDigits(nationalId)} در همین فایل تکرار شده است.`);
      }
      if (
        existingUsernames.has(candidateStUser.toLowerCase()) ||
        existingUsernames.has(candidatePrUser.toLowerCase())
      ) {
        duplicateReasons.push('تکراری: نام کاربری تولیدشده قبلاً ثبت شده است.');
      }
      seenNatIdsInFile.add(nationalId);
    }

    let status: SmartImportRowStatus = 'valid';
    let reasons: string[] = [];
    if (duplicateReasons.length > 0) {
      status = 'duplicate';
      reasons = [...duplicateReasons, ...incompleteReasons];
    } else if (incompleteReasons.length > 0) {
      status = 'incomplete';
      reasons = incompleteReasons;
    }

    rows.push({
      rowNumber: i + 2,
      status,
      firstName,
      lastName,
      fullName,
      nationalId,
      parentName: parentName || 'ولی دانش‌آموز',
      parentMobile,
      studentMobile,
      gradeLabel: gradeHint || (matchedClass ? `پایه ${toPersianDigits(matchedClass.gradeLevel)}` : ''),
      classId: matchedClass?.id ?? '',
      className: matchedClass?.name ?? (classHint || 'نامشخص'),
      birthDateJalali,
      generatedStudentUsername: status === 'valid' ? candidateStUser : undefined,
      generatedParentUsername: status === 'valid' ? candidatePrUser : undefined,
      reasons,
    });
  }

  return {
    detectedColumns,
    rows,
    validCount: rows.filter((r) => r.status === 'valid').length,
    incompleteCount: rows.filter((r) => r.status === 'incomplete').length,
    duplicateCount: rows.filter((r) => r.status === 'duplicate').length,
  };
}

/**
 * Parses and validates Staff/Teacher CSV/Excel text into 3 color-coded buckets.
 */
export function parseAndValidateTeacherCsv(params: {
  csvText: string;
  classes: ClassRoom[];
  existingTeachers: Teacher[];
}): SmartImportSummary<SmartTeacherImportRow> {
  const parsed = parseCsvText(params.csvText);
  const headers = parsed.headers;

  let firstNameCol = findColumnIndex(headers, ['نام']);
  const lastNameCol = findColumnIndex(headers, ['نام خانوادگی', 'نامخانوادگی']);
  const fullNameCol = findColumnIndex(headers, ['نام و نام خانوادگی', 'نامونامخانوادگی', 'نام معلم', 'نام همکار']);
  if (firstNameCol === fullNameCol && lastNameCol === -1) {
    firstNameCol = -1;
  }
  const nationalIdCol = findColumnIndex(headers, ['کد ملی', 'کدملی']);
  const mobileCol = findColumnIndex(headers, ['شماره موبایل', 'موبایل', 'تلفن همراه', 'همراه']);
  const specialtyCol = findColumnIndex(headers, ['تخصص', 'سمت', 'رشته', 'درس']);
  const personnelCol = findColumnIndex(headers, ['کد پرسنلی', 'شماره پرسنلی', 'پرسنلی']);
  const quotaCol = findColumnIndex(headers, ['ساعات هفتگی', 'ساعت موظفی', 'موظفی', 'زنگ هفتگی']);
  const classCol = findColumnIndex(headers, ['کلاس', 'کلاس ها', 'کلاس تخصیصی']);

  const hasAny = fullNameCol >= 0 || firstNameCol >= 0 || nationalIdCol >= 0 || mobileCol >= 0;
  const detectedColumns: Record<string, number> = {
    firstName: hasAny ? firstNameCol : -1,
    lastName: hasAny ? lastNameCol : -1,
    fullName: hasAny ? fullNameCol : 0,
    nationalId: hasAny ? nationalIdCol : 1,
    mobile: hasAny ? mobileCol : 2,
    specialty: hasAny ? specialtyCol : 3,
    personnelCode: hasAny ? personnelCol : 4,
    weeklyQuota: hasAny ? quotaCol : 5,
    className: hasAny ? classCol : 6,
  };

  const existingNatIds = new Set(params.existingTeachers.map((t) => normalizeDigitsField(t.nationalId)));
  const existingMobiles = new Set(params.existingTeachers.map((t) => normalizeDigitsField(t.mobile)));
  const seenNatIdsInFile = new Set<string>();

  const rows: SmartTeacherImportRow[] = [];

  for (let i = 0; i < parsed.rows.length; i += 1) {
    const cols = parsed.rows[i];
    const fName = cleanCell(cols, detectedColumns.firstName);
    const lName = cleanCell(cols, detectedColumns.lastName);
    const rawFull = cleanCell(cols, detectedColumns.fullName);
    const fullName = rawFull || [fName, lName].filter(Boolean).join(' ').trim();
    const firstName = fName || fullName.split(' ')[0] || '';
    const lastName = lName || fullName.split(' ').slice(1).join(' ');

    const nationalId = normalizeDigitsField(cleanCell(cols, detectedColumns.nationalId));
    const mobile = normalizeDigitsField(cleanCell(cols, detectedColumns.mobile));
    const specialty = cleanCell(cols, detectedColumns.specialty) || 'آموزگار / دبیر';
    const personnelCode =
      normalizeDigitsField(cleanCell(cols, detectedColumns.personnelCode)) ||
      `P${String(params.existingTeachers.length + i + 101)}`;
    const quotaRaw = Number(normalizeDigitsField(cleanCell(cols, detectedColumns.weeklyQuota)));
    const weeklyQuotaPeriods =
      Number.isFinite(quotaRaw) && quotaRaw >= 4 && quotaRaw <= 36 ? quotaRaw : 16;

    const classHint = cleanCell(cols, detectedColumns.className);
    const matchedClass = matchClassRoom(params.classes, classHint, '');
    const assignedClassIds = matchedClass ? [matchedClass.id] : [];
    const assignedClassNames = matchedClass ? [matchedClass.name] : [];

    const duplicateReasons: string[] = [];
    const incompleteReasons: string[] = [];

    if (!fullName || fullName.length < 3) {
      incompleteReasons.push('ستون «نام / نام خانوادگی» خالی یا کمتر از ۳ کاراکتر است.');
    }
    if (!nationalId) {
      incompleteReasons.push('ستون «کد ملی» خالی است.');
    } else if (!validateIranianNationalId(nationalId)) {
      incompleteReasons.push('«کد ملی» باید ۱۰ رقم معتبر باشد.');
    }
    if (!mobile) {
      incompleteReasons.push('ستون «شماره موبایل» خالی است.');
    } else if (!validateIranianMobile(mobile)) {
      incompleteReasons.push('«شماره موبایل» باید ۱۱ رقم معتبر با شروع ۰۹ باشد.');
    }

    if (nationalId) {
      if (existingNatIds.has(nationalId)) {
        duplicateReasons.push(`تکراری: کد ملی ${toPersianDigits(nationalId)} قبلاً در فهرست همکاران ثبت شده است.`);
      } else if (seenNatIdsInFile.has(nationalId)) {
        duplicateReasons.push(`تکراری: کد ملی ${toPersianDigits(nationalId)} در همین فایل تکرار شده است.`);
      }
      seenNatIdsInFile.add(nationalId);
    }
    if (mobile && existingMobiles.has(mobile)) {
      duplicateReasons.push(`تکراری: شماره موبایل ${toPersianDigits(mobile)} قبلاً برای همکار دیگری ثبت شده است.`);
    }

    let status: SmartImportRowStatus = 'valid';
    let reasons: string[] = [];
    if (duplicateReasons.length > 0) {
      status = 'duplicate';
      reasons = [...duplicateReasons, ...incompleteReasons];
    } else if (incompleteReasons.length > 0) {
      status = 'incomplete';
      reasons = incompleteReasons;
    }

    rows.push({
      rowNumber: i + 2,
      status,
      firstName,
      lastName,
      fullName,
      nationalId,
      mobile,
      specialty,
      personnelCode,
      weeklyQuotaPeriods,
      assignedClassIds,
      assignedClassNames,
      reasons,
    });
  }

  return {
    detectedColumns,
    rows,
    validCount: rows.filter((r) => r.status === 'valid').length,
    incompleteCount: rows.filter((r) => r.status === 'incomplete').length,
    duplicateCount: rows.filter((r) => r.status === 'duplicate').length,
  };
}

export function buildStudentsFromValidImportRows(params: {
  validRows: SmartStudentImportRow[];
  schoolId: string;
  existingCount: number;
}): Student[] {
  const schoolNum = params.schoolId.replace(/\D/g, '') || '1';
  return params.validRows.map((row, idx) =>
    ensureStudentDualCredentials({
      id: generateUUID(),
      schoolId: params.schoolId,
      classId: row.classId,
      fullName: sanitizeText(row.fullName, 140),
      firstName: sanitizeText(row.firstName, 70),
      lastName: sanitizeText(row.lastName, 70),
      nationalId: row.nationalId,
      studentCode: `${schoolNum}45${String(params.existingCount + idx + 1).padStart(3, '0')}`,
      parentName: sanitizeText(row.parentName, 120),
      parentMobile: row.parentMobile,
      birthDateJalali: row.birthDateJalali,
      emergencyNotes: row.studentMobile ? `موبایل دانش‌آموز: ${row.studentMobile}` : undefined,
      active: true,
    })
  );
}

export function buildTeachersFromValidImportRows(params: {
  validRows: SmartTeacherImportRow[];
  schoolId: string;
}): Teacher[] {
  return params.validRows.map((row) =>
    ensureTeacherHashed({
      id: generateUUID(),
      schoolId: params.schoolId,
      fullName: sanitizeText(row.fullName, 140),
      nationalId: row.nationalId,
      personnelCode: row.personnelCode,
      mobile: row.mobile,
      specialty: sanitizeText(row.specialty, 120),
      assignedClassIds: row.assignedClassIds,
      weeklyQuotaPeriods: row.weeklyQuotaPeriods,
      active: true,
    })
  );
}

export function buildStandardStudentTemplateCsv(sampleClassName?: string): string {
  const cls = sampleClassName || 'پایه دوم - کلاس الف';
  return buildUtf8BomCsv(
    [
      'نام',
      'نام خانوادگی',
      'کد ملی',
      'نام ولی',
      'شماره موبایل ولی',
      'شماره موبایل دانش‌آموز',
      'پایه',
      'کلاس',
      'تاریخ تولد',
    ],
    [
      ['سهیل', 'محمدپور', '0084567892', 'مهدی محمدپور', '09123456789', '09198765432', 'پایه دوم', cls, '1397/06/15'],
      ['آرمین', 'کاظمی', '0013520849', 'حسین کاظمی', '09127654321', '', 'پایه دوم', cls, '1397/08/20'],
    ]
  );
}

export function buildStandardTeacherTemplateCsv(sampleClassName?: string): string {
  const cls = sampleClassName || 'پایه دوم - کلاس الف';
  return buildUtf8BomCsv(
    ['نام', 'نام خانوادگی', 'کد ملی', 'شماره موبایل', 'تخصص', 'کد پرسنلی', 'ساعات هفتگی', 'کلاس'],
    [
      ['فاطمه', 'رضایی', '0084567892', '09125551122', 'ریاضی و علوم', '1045', '16', cls],
      ['علی', 'موسوی', '0013520849', '09126663344', 'فارسی و نگارش', '1046', '16', cls],
    ]
  );
}

export function buildImportReportPrintHtml(params: {
  title: string;
  schoolName: string;
  jalaliDate: string;
  validCount: number;
  incompleteCount: number;
  duplicateCount: number;
  rows: Array<{
    rowNumber: number;
    fullName: string;
    nationalId: string;
    extraInfo: string;
    status: SmartImportRowStatus;
    reasons: string[];
  }>;
}): string {
  const statusLabel: Record<SmartImportRowStatus, string> = {
    valid: 'سالم و آماده ثبت',
    incomplete: 'ناقص (مسدود)',
    duplicate: 'تکراری (مسدود)',
  };

  const rowsHtml = params.rows
    .map(
      (r) => `
      <tr>
        <td style="text-align:center;">${toPersianDigits(r.rowNumber)}</td>
        <td>${escapeHtml(r.fullName || '—')}</td>
        <td style="text-align:center;">${escapeHtml(toPersianDigits(r.nationalId || '—'))}</td>
        <td>${escapeHtml(r.extraInfo)}</td>
        <td style="text-align:center;font-weight:700;">${statusLabel[r.status]}</td>
        <td>${r.reasons.length > 0 ? escapeHtml(r.reasons.join(' | ')) : 'تاییدشده بدون خطا'}</td>
      </tr>
    `
    )
    .join('');

  return `
    <div dir="rtl" style="font-family:Vazirmatn,Tahoma,sans-serif;color:#0f172a;">
      <h2 style="margin:0 0 6px;font-size:16px;">${escapeHtml(params.title)} — ${escapeHtml(params.schoolName)}</h2>
      <p style="margin:0 0 12px;font-size:12px;color:#475569;">
        تاریخ گزارش: ${escapeHtml(toPersianDigits(params.jalaliDate))} |
        سالم: ${toPersianDigits(params.validCount)} |
        ناقص: ${toPersianDigits(params.incompleteCount)} |
        تکراری: ${toPersianDigits(params.duplicateCount)}
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="border:1px solid #cbd5e1;padding:6px;">ردیف اکسل</th>
            <th style="border:1px solid #cbd5e1;padding:6px;">نام و نام خانوادگی</th>
            <th style="border:1px solid #cbd5e1;padding:6px;">کد ملی</th>
            <th style="border:1px solid #cbd5e1;padding:6px;">مشخصات تکمیلی</th>
            <th style="border:1px solid #cbd5e1;padding:6px;">وضعیت</th>
            <th style="border:1px solid #cbd5e1;padding:6px;">توضیح اعتبارسنجی</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}
