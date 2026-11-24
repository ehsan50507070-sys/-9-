// Step 3-C: Multi-Table Join, Missing-Cell Policy, Iranian Validation & Quarantine Engine
import { buildUtf8BomCsv } from '../../lib/csv';
import { toAsciiDigits } from '../../lib/digits';
import type {
  ClassRoom,
  GradebookEntry,
  Student,
  Teacher,
} from '../../types/domain';
import { getFieldLabelFa, getFieldsForTarget } from './columnMatcher';
import {
  normalizeGradeScore,
  normalizeIranianMobile,
  normalizeIranianNationalId,
  normalizeJalaliDateInput,
  normalizePersianText,
  splitPersianFullName,
} from './iranianValidators';
import type {
  ColumnMappingItem,
  DuplicateHandlingStrategy,
  JoinExecutionSummary,
  MissingCellPolicyMap,
  SecondaryJoinConfig,
  SmartImportDryRunSummary,
  SmartImportFieldKey,
  SmartImportTargetType,
  ValidatedImportRow,
} from './types';

export interface ExistingSchoolLookup {
  students: Student[];
  teachers: Teacher[];
  classes: ClassRoom[];
  gradebookEntries: GradebookEntry[];
}

export function getDefaultMissingCellPolicies(
  targetType: SmartImportTargetType
): MissingCellPolicyMap {
  if (targetType === 'students') {
    return {
      nationalId: { mode: 'quarantine', defaultValue: '' },
      fullName: { mode: 'quarantine', defaultValue: '' },
      parentName: { mode: 'auto_generate', defaultValue: '' },
      parentMobile: { mode: 'keep_existing', defaultValue: '' },
      className: { mode: 'keep_existing', defaultValue: '' },
      studentCode: { mode: 'auto_generate', defaultValue: '' },
      enrollmentStatus: { mode: 'use_default', defaultValue: 'عادی' },
    };
  }
  if (targetType === 'teachers') {
    return {
      nationalId: { mode: 'quarantine', defaultValue: '' },
      fullName: { mode: 'quarantine', defaultValue: '' },
      mobile: { mode: 'keep_existing', defaultValue: '' },
      personnelCode: { mode: 'auto_generate', defaultValue: '' },
      specialty: { mode: 'use_default', defaultValue: 'آموزگار عمومی' },
      weeklyQuotaPeriods: { mode: 'use_default', defaultValue: '24' },
    };
  }
  if (targetType === 'classes') {
    return {
      className: { mode: 'quarantine', defaultValue: '' },
      gradeLabel: { mode: 'use_default', defaultValue: 'چهارم' },
      section: { mode: 'auto_generate', defaultValue: 'الف' },
      roomCode: { mode: 'auto_generate', defaultValue: '' },
      capacity: { mode: 'use_default', defaultValue: '28' },
    };
  }
  return {
    nationalId: { mode: 'quarantine', defaultValue: '' },
    fullName: { mode: 'keep_existing', defaultValue: '' },
    subject: { mode: 'use_default', defaultValue: 'ریاضی' },
    finalScore: { mode: 'quarantine', defaultValue: '' },
    term: { mode: 'use_default', defaultValue: 'نوبت اول' },
    jalaliMonth: { mode: 'use_default', defaultValue: 'دی' },
  };
}

/**
 * Extracts raw key-value records from primary table, optionally joining a secondary table on normalized National ID.
 */
export function buildMergedRawRecords(params: {
  primaryRows: string[][];
  primaryHeaderRowIndex: number;
  columnMappings: ColumnMappingItem[];
  splitFullName: boolean;
  joinConfig: SecondaryJoinConfig;
}): {
  records: Array<{
    rowId: string;
    sourceRowNumber: number;
    joinedFromSecondary: boolean;
    rawValues: Partial<Record<SmartImportFieldKey, string>>;
  }>;
  joinSummary: JoinExecutionSummary;
} {
  const { primaryRows, primaryHeaderRowIndex, columnMappings, splitFullName, joinConfig } = params;
  const dataRows = primaryRows.slice(primaryHeaderRowIndex + 1);

  // Build secondary lookup index keyed by normalized National ID
  const secondaryMap = new Map<string, Partial<Record<SmartImportFieldKey, string>>>();
  let secondaryValidKeyCount = 0;

  if (
    joinConfig.enabled &&
    joinConfig.parsedTable &&
    joinConfig.nationalIdColIndex >= 0 &&
    joinConfig.selectedAppendColIndices.length > 0
  ) {
    const secDataRows = joinConfig.parsedTable.rows.slice(joinConfig.headerRowIndex + 1);
    for (const sRow of secDataRows) {
      const rawKey = sRow[joinConfig.nationalIdColIndex] ?? '';
      const natRes = normalizeIranianNationalId(rawKey);
      if (!natRes.valid) continue;
      secondaryValidKeyCount++;

      const extraFields: Partial<Record<SmartImportFieldKey, string>> = {};
      for (const colIdx of joinConfig.selectedAppendColIndices) {
        const mappedField = joinConfig.appendColumnMappings[colIdx];
        if (!mappedField || mappedField === '__ignore__') continue;
        const val = (sRow[colIdx] ?? '').trim();
        if (val) {
          extraFields[mappedField] = val;
        }
      }
      secondaryMap.set(natRes.normalized, extraFields);
    }
  }

  const matchedSecondaryKeys = new Set<string>();
  let joinedCount = 0;
  let unmatchedPrimaryCount = 0;

  const records = dataRows
    .map((cells, idx) => {
      const sourceRowNumber = primaryHeaderRowIndex + 2 + idx; // 1-based human row number
      const rawValues: Partial<Record<SmartImportFieldKey, string>> = {};

      for (const mapping of columnMappings) {
        if (mapping.targetField === '__ignore__') continue;
        const val = (cells[mapping.colIndex] ?? '').trim();
        if (val || rawValues[mapping.targetField] === undefined) {
          rawValues[mapping.targetField] = val;
        }
      }

      // Combine firstName + lastName if fullName absent, or split fullName when requested
      if (!rawValues.fullName && (rawValues.firstName || rawValues.lastName)) {
        rawValues.fullName = normalizePersianText(
          `${rawValues.firstName ?? ''} ${rawValues.lastName ?? ''}`
        );
      } else if (splitFullName && rawValues.fullName && !rawValues.firstName && !rawValues.lastName) {
        const parts = splitPersianFullName(rawValues.fullName);
        rawValues.firstName = parts.firstName;
        rawValues.lastName = parts.lastName;
      }

      // Multi-Table Join by normalized National ID
      let joinedFromSecondary = false;
      if (joinConfig.enabled && secondaryMap.size > 0) {
        const natRes = normalizeIranianNationalId(rawValues.nationalId ?? '');
        if (natRes.valid && secondaryMap.has(natRes.normalized)) {
          const secFields = secondaryMap.get(natRes.normalized)!;
          for (const [k, v] of Object.entries(secFields) as Array<[SmartImportFieldKey, string]>) {
            if (!v) continue;
            // Fill empty fields OR upgrade invalid mobile/notes from secondary file
            const currentVal = (rawValues[k] ?? '').trim();
            if (
              !currentVal ||
              ((k === 'parentMobile' || k === 'mobile') && !normalizeIranianMobile(currentVal).valid) ||
              k === 'emergencyNotes' ||
              k === 'finalScore' ||
              k === 'continuousScore' ||
              k === 'specialty'
            ) {
              rawValues[k] = v;
            }
          }
          joinedFromSecondary = true;
          joinedCount++;
          matchedSecondaryKeys.add(natRes.normalized);
        } else {
          unmatchedPrimaryCount++;
        }
      }

      return {
        rowId: `row-${sourceRowNumber}`,
        sourceRowNumber,
        joinedFromSecondary,
        rawValues,
      };
    })
    .filter((rec) =>
      Object.values(rec.rawValues).some((v) => typeof v === 'string' && v.trim().length > 0)
    );

  const unmatchedSecondaryCount = Math.max(0, secondaryMap.size - matchedSecondaryKeys.size);

  return {
    records,
    joinSummary: {
      joinedCount,
      unmatchedPrimaryCount,
      unmatchedSecondaryCount,
      secondaryValidKeyCount,
    },
  };
}

function getExistingFieldValue(
  targetType: SmartImportTargetType,
  field: SmartImportFieldKey,
  existingRecord: Student | Teacher | ClassRoom | GradebookEntry | undefined,
  classesById: Map<string, ClassRoom>
): string {
  if (!existingRecord) return '';
  if (targetType === 'students') {
    const s = existingRecord as Student;
    switch (field) {
      case 'fullName':
        return s.fullName;
      case 'firstName':
        return s.firstName ?? '';
      case 'lastName':
        return s.lastName ?? '';
      case 'fatherName':
        return s.fatherName ?? '';
      case 'parentName':
        return s.parentName;
      case 'parentMobile':
        return s.parentMobile;
      case 'className':
        return classesById.get(s.classId)?.name ?? '';
      case 'birthDateJalali':
        return s.birthDateJalali ?? '';
      case 'studentCode':
        return s.studentCode;
      case 'sidaStudentCode':
        return s.sidaStudentCode ?? '';
      case 'enrollmentStatus':
        return s.enrollmentStatus ?? 'عادی';
      case 'emergencyNotes':
        return s.emergencyNotes ?? '';
      default:
        return '';
    }
  }
  if (targetType === 'teachers') {
    const t = existingRecord as Teacher;
    switch (field) {
      case 'fullName':
        return t.fullName;
      case 'mobile':
        return t.mobile;
      case 'personnelCode':
        return t.personnelCode;
      case 'specialty':
        return t.specialty;
      case 'weeklyQuotaPeriods':
        return String(t.weeklyQuotaPeriods);
      default:
        return '';
    }
  }
  if (targetType === 'classes') {
    const c = existingRecord as ClassRoom;
    switch (field) {
      case 'className':
        return c.name;
      case 'gradeLabel':
        return c.customGradeLabel ?? String(c.gradeLevel);
      case 'section':
        return c.section;
      case 'roomCode':
        return c.roomCode;
      case 'capacity':
        return String(c.capacity);
      default:
        return '';
    }
  }
  return '';
}

/**
 * Evaluates a single row against Iranian validators, Missing-Cell policies, and duplicates.
 */
export function evaluateSingleImportRow(params: {
  rowId: string;
  sourceRowNumber: number;
  joinedFromSecondary: boolean;
  rawValues: Partial<Record<SmartImportFieldKey, string>>;
  targetType: SmartImportTargetType;
  policies: MissingCellPolicyMap;
  duplicateStrategy: DuplicateHandlingStrategy;
  existing: ExistingSchoolLookup;
  seenIdentifiersInFile: Set<string>;
  splitFullName: boolean;
}): ValidatedImportRow {
  const {
    rowId,
    sourceRowNumber,
    joinedFromSecondary,
    rawValues,
    targetType,
    policies,
    duplicateStrategy,
    existing,
    seenIdentifiersInFile,
    splitFullName,
  } = params;

  const classesById = new Map(existing.classes.map((c) => [c.id, c]));
  const studentsByNatId = new Map(existing.students.map((s) => [s.nationalId, s]));
  const teachersByNatId = new Map(existing.teachers.map((t) => [t.nationalId, t]));
  const classesByName = new Map(
    existing.classes.map((c) => [normalizePersianText(c.name), c])
  );

  const normalized: Partial<Record<SmartImportFieldKey, string>> = {};
  const warnings: string[] = [];
  const errors: string[] = [];
  const fixableFields = new Set<SmartImportFieldKey>();
  let hasHardQuarantineError = false;

  // Copy & normalize basic text
  for (const [k, v] of Object.entries(rawValues) as Array<[SmartImportFieldKey, string]>) {
    normalized[k] = normalizePersianText(v ?? '');
  }

  // Re-sync fullName / firstName / lastName
  if (!normalized.fullName && (normalized.firstName || normalized.lastName)) {
    normalized.fullName = normalizePersianText(
      `${normalized.firstName ?? ''} ${normalized.lastName ?? ''}`
    );
  } else if (splitFullName && normalized.fullName) {
    const parts = splitPersianFullName(normalized.fullName);
    if (!normalized.firstName) normalized.firstName = parts.firstName;
    if (!normalized.lastName) normalized.lastName = parts.lastName;
  }

  // 1. Validate National ID (for students, teachers, sida_grades)
  let existingRecord: Student | Teacher | ClassRoom | GradebookEntry | undefined;
  let existingRecordId: string | undefined;
  let existingRecordLabel: string | undefined;
  let dedupKey = '';

  if (targetType !== 'classes') {
    const rawNat = normalized.nationalId ?? '';
    const natRes = normalizeIranianNationalId(rawNat);
    if (!rawNat) {
      errors.push('کد ملی وارد نشده است.');
      hasHardQuarantineError = true;
      fixableFields.add('nationalId');
    } else if (!natRes.valid) {
      errors.push(natRes.errorFa ?? 'کد ملی نامعتبر است.');
      hasHardQuarantineError = true;
      fixableFields.add('nationalId');
    } else {
      normalized.nationalId = natRes.normalized;
      if (natRes.warningFa) {
        warnings.push(natRes.warningFa);
      }

      if (targetType === 'students') {
        dedupKey = `stu:${natRes.normalized}`;
        const found = studentsByNatId.get(natRes.normalized);
        if (found) {
          existingRecord = found;
          existingRecordId = found.id;
          existingRecordLabel = found.fullName;
        }
      } else if (targetType === 'teachers') {
        dedupKey = `tch:${natRes.normalized}`;
        const found = teachersByNatId.get(natRes.normalized);
        if (found) {
          existingRecord = found;
          existingRecordId = found.id;
          existingRecordLabel = found.fullName;
        }
      } else if (targetType === 'sida_grades') {
        const subj = normalized.subject || policies.subject?.defaultValue || 'ریاضی';
        dedupKey = `grd:${natRes.normalized}:${normalizePersianText(subj)}`;
        const foundStu = studentsByNatId.get(natRes.normalized);
        if (foundStu) {
          existingRecord = foundStu;
          existingRecordId = foundStu.id;
          existingRecordLabel = foundStu.fullName;
          if (!normalized.fullName) normalized.fullName = foundStu.fullName;
          if (!normalized.className) {
            normalized.className = classesById.get(foundStu.classId)?.name ?? '';
          }
        }
      }
    }
  } else {
    const classTitle = normalized.className ?? '';
    if (!classTitle || classTitle.length < 2) {
      errors.push('عنوان کلاس الزامی است و باید حداقل ۲ کاراکتر باشد.');
      hasHardQuarantineError = true;
      fixableFields.add('className');
    } else {
      dedupKey = `cls:${normalizePersianText(classTitle)}`;
      const foundCls = classesByName.get(normalizePersianText(classTitle));
      if (foundCls) {
        existingRecord = foundCls;
        existingRecordId = foundCls.id;
        existingRecordLabel = foundCls.name;
      }
    }
  }

  // In-file duplicate detection
  if (dedupKey) {
    if (seenIdentifiersInFile.has(dedupKey)) {
      errors.push('رکورد تکراری در داخل همین فایل (شناسه مشابه در ردیف قبلی ثبت شده است).');
      hasHardQuarantineError = true;
    } else {
      seenIdentifiersInFile.add(dedupKey);
    }
  }

  // 2. Apply Missing-Cell Policies for empty fields
  const relevantFields = getFieldsForTarget(targetType);
  for (const fieldDef of relevantFields) {
    const current = (normalized[fieldDef.key] ?? '').trim();
    if (current) continue;

    const policy = policies[fieldDef.key];
    if (!policy) continue;

    if (policy.mode === 'keep_existing') {
      const existingVal = getExistingFieldValue(
        targetType,
        fieldDef.key,
        existingRecord,
        classesById
      );
      if (existingVal) {
        normalized[fieldDef.key] = existingVal;
        warnings.push(`مقدار فعلی «${fieldDef.labelFa}» از سامانه حفظ شد.`);
      }
    } else if (policy.mode === 'use_default' && policy.defaultValue.trim()) {
      normalized[fieldDef.key] = normalizePersianText(policy.defaultValue);
    } else if (policy.mode === 'auto_generate') {
      if (fieldDef.key === 'parentName') {
        if (normalized.fatherName) {
          normalized.parentName = normalized.fatherName;
        } else if (normalized.lastName) {
          normalized.parentName = `ولی ${normalized.lastName}`;
        } else if (normalized.fullName) {
          normalized.parentName = `ولی ${normalized.fullName}`;
        }
      } else if (fieldDef.key === 'studentCode') {
        normalized.studentCode = String(50000 + ((sourceRowNumber * 137) % 45000));
      } else if (fieldDef.key === 'personnelCode') {
        normalized.personnelCode = String(480000 + sourceRowNumber * 13);
      } else if (fieldDef.key === 'section') {
        normalized.section = 'الف';
      } else if (fieldDef.key === 'roomCode') {
        normalized.roomCode = String(100 + sourceRowNumber);
      }
    } else if (policy.mode === 'quarantine') {
      errors.push(`فیلد اجباری «${fieldDef.labelFa}» خالی است (طبق سیاست ارسال به قرنطینه).`);
      hasHardQuarantineError = true;
      fixableFields.add(fieldDef.key);
    }
  }

  // 3. Entity-Specific Field Validation
  if (targetType === 'students') {
    if (!normalized.fullName || normalized.fullName.length < 3) {
      errors.push('نام و نام خانوادگی دانش‌آموز باید حداقل ۳ کاراکتر باشد.');
      fixableFields.add('fullName');
      hasHardQuarantineError = true;
    }

    if (!normalized.parentName || normalized.parentName.length < 2) {
      if (normalized.fatherName && normalized.fatherName.length >= 2) {
        normalized.parentName = normalized.fatherName;
      } else {
        errors.push('نام ولی دانش‌آموز مشخص نشده است (قابل اصلاح سریع).');
        fixableFields.add('parentName');
      }
    }

    const mobRes = normalizeIranianMobile(normalized.parentMobile ?? '');
    if (!mobRes.valid) {
      errors.push(mobRes.errorFa ?? 'شماره موبایل ولی نامعتبر است.');
      fixableFields.add('parentMobile');
    } else {
      normalized.parentMobile = mobRes.normalized;
      if (mobRes.warningFa) warnings.push(mobRes.warningFa);
    }

    if (normalized.birthDateJalali) {
      const dateRes = normalizeJalaliDateInput(normalized.birthDateJalali);
      if (!dateRes.valid) {
        errors.push(dateRes.errorFa ?? 'تاریخ تولد شمسی نامعتبر است.');
        fixableFields.add('birthDateJalali');
      } else {
        normalized.birthDateJalali = dateRes.normalized;
      }
    }

    if (!normalized.className) {
      const fallbackClass = existing.classes[0]?.name;
      if (fallbackClass) {
        normalized.className = fallbackClass;
        warnings.push(`کلاس خالی بود؛ کلاس پیش‌فرض «${fallbackClass}» انتخاب شد.`);
      } else {
        errors.push('نام کلاس دانش‌آموز مشخص نشده است.');
        fixableFields.add('className');
      }
    }
  }

  if (targetType === 'teachers') {
    if (!normalized.fullName || normalized.fullName.length < 3) {
      errors.push('نام و نام خانوادگی همکار باید حداقل ۳ کاراکتر باشد.');
      fixableFields.add('fullName');
      hasHardQuarantineError = true;
    }

    const mobRes = normalizeIranianMobile(normalized.mobile ?? '');
    if (!mobRes.valid) {
      errors.push(mobRes.errorFa ?? 'شماره موبایل همکار نامعتبر است.');
      fixableFields.add('mobile');
    } else {
      normalized.mobile = mobRes.normalized;
      if (mobRes.warningFa) warnings.push(mobRes.warningFa);
    }

    if (!normalized.specialty || normalized.specialty.length < 2) {
      errors.push('تخصص یا رشته تدریسی مشخص نشده است.');
      fixableFields.add('specialty');
    }

    if (normalized.weeklyQuotaPeriods) {
      const quota = Number(toAsciiDigits(normalized.weeklyQuotaPeriods));
      if (!Number.isFinite(quota) || quota < 1 || quota > 36) {
        errors.push('ساعات موظف هفتگی باید عددی بین ۱ تا ۳۶ باشد.');
        fixableFields.add('weeklyQuotaPeriods');
      } else {
        normalized.weeklyQuotaPeriods = String(Math.round(quota));
      }
    } else {
      normalized.weeklyQuotaPeriods = '24';
    }
  }

  if (targetType === 'classes') {
    if (normalized.capacity) {
      const cap = Number(toAsciiDigits(normalized.capacity));
      if (!Number.isFinite(cap) || cap < 1 || cap > 60) {
        errors.push('ظرفیت کلاس باید عددی بین ۱ تا ۶۰ نفر باشد.');
        fixableFields.add('capacity');
      } else {
        normalized.capacity = String(Math.round(cap));
      }
    } else {
      normalized.capacity = '28';
    }
    if (!normalized.section) normalized.section = 'الف';
    if (!normalized.roomCode) normalized.roomCode = String(100 + sourceRowNumber);
  }

  if (targetType === 'sida_grades') {
    if (!normalized.subject) {
      errors.push('عنوان درس مشخص نشده است.');
      fixableFields.add('subject');
    }
    if (normalized.continuousScore) {
      const contRes = normalizeGradeScore(normalized.continuousScore);
      if (!contRes.valid) {
        errors.push(`نمره مستمر: ${contRes.errorFa ?? 'نامعتبر است.'}`);
        fixableFields.add('continuousScore');
        hasHardQuarantineError = true;
      } else {
        normalized.continuousScore = contRes.normalized;
      }
    }
    const finalRes = normalizeGradeScore(normalized.finalScore ?? '');
    if (!finalRes.valid) {
      errors.push(`نمره پایانی: ${finalRes.errorFa ?? 'نامعتبر است.'}`);
      fixableFields.add('finalScore');
      hasHardQuarantineError = true;
    } else {
      normalized.finalScore = finalRes.normalized;
    }
    if (!existingRecordId) {
      warnings.push('دانش‌آموز متناظر با این کد ملی در مدرسه یافت نشد؛ رکورد با شناسه سیدا ثبت می‌شود.');
    }
  }

  // Determine operation (create vs update vs skip)
  let operation: 'create' | 'update' | 'skip' = existingRecordId ? 'update' : 'create';
  if (existingRecordId && duplicateStrategy === 'skip_duplicates') {
    operation = 'skip';
  }

  // Classify into 3 transparent buckets
  let bucket: 'valid' | 'needs_fix' | 'quarantine' = 'valid';
  if (errors.length > 0) {
    bucket = hasHardQuarantineError ? 'quarantine' : 'needs_fix';
  }

  return {
    rowId,
    sourceRowNumber,
    bucket,
    operation,
    existingRecordId,
    existingRecordLabel,
    joinedFromSecondary,
    rawValues,
    normalizedValues: normalized,
    warnings,
    errors,
    fixableFields: Array.from(fixableFields),
    autoGeneratedCredentialsNote:
      operation === 'create' && (targetType === 'students' || targetType === 'teachers')
        ? 'ایجاد خودکار رمز امن اولیه (الزام تغییر در اولین ورود)'
        : undefined,
  };
}

/**
 * Evaluates all merged rows into Valid, Needs Quick Fix, and Quarantine buckets.
 */
export function evaluateAllImportRows(params: {
  mergedRecords: Array<{
    rowId: string;
    sourceRowNumber: number;
    joinedFromSecondary: boolean;
    rawValues: Partial<Record<SmartImportFieldKey, string>>;
  }>;
  targetType: SmartImportTargetType;
  policies: MissingCellPolicyMap;
  duplicateStrategy: DuplicateHandlingStrategy;
  existing: ExistingSchoolLookup;
  splitFullName: boolean;
}): ValidatedImportRow[] {
  const seenIdentifiersInFile = new Set<string>();
  return params.mergedRecords.map((rec) =>
    evaluateSingleImportRow({
      ...rec,
      targetType: params.targetType,
      policies: params.policies,
      duplicateStrategy: params.duplicateStrategy,
      existing: params.existing,
      seenIdentifiersInFile,
      splitFullName: params.splitFullName,
    })
  );
}

/**
 * Computes Dry-Run numeric preview summary for Step 5.
 */
export function computeDryRunSummary(
  rows: ValidatedImportRow[],
  targetType: SmartImportTargetType,
  existingClasses: ClassRoom[]
): SmartImportDryRunSummary {
  const existingClassNames = new Set(existingClasses.map((c) => normalizePersianText(c.name)));
  const newClassSet = new Set<string>();

  let validCount = 0;
  let createCount = 0;
  let updateCount = 0;
  let skipCount = 0;
  let needsFixCount = 0;
  let quarantineCount = 0;
  let joinedCount = 0;
  let newAccountsToCreateCount = 0;

  for (const row of rows) {
    if (row.joinedFromSecondary) joinedCount++;
    if (row.bucket === 'valid') {
      validCount++;
      if (row.operation === 'create') {
        createCount++;
        if (targetType === 'students' || targetType === 'teachers') {
          newAccountsToCreateCount++;
        }
      } else if (row.operation === 'update') {
        updateCount++;
      } else {
        skipCount++;
      }

      if (targetType === 'students' || targetType === 'sida_grades') {
        const clsName = normalizePersianText(row.normalizedValues.className ?? '');
        if (clsName && !existingClassNames.has(clsName)) {
          newClassSet.add(clsName);
        }
      }
    } else if (row.bucket === 'needs_fix') {
      needsFixCount++;
    } else {
      quarantineCount++;
    }
  }

  return {
    totalDataRows: rows.length,
    validCount,
    createCount,
    updateCount,
    skipCount,
    needsFixCount,
    quarantineCount,
    joinedCount,
    newClassesToCreate: Array.from(newClassSet),
    newAccountsToCreateCount,
  };
}

/**
 * Exports quarantined (and optionally needs-fix) rows to UTF-8 BOM Persian CSV with explicit error reasons column.
 */
export function buildQuarantineCsv(
  quarantinedRows: ValidatedImportRow[],
  targetType: SmartImportTargetType
): string {
  const fields = getFieldsForTarget(targetType);
  const headers = ['شماره ردیف فایل', ...fields.map((f) => f.labelFa), 'دلیل خطا / علت قرنطینه'];

  const csvRows = quarantinedRows.map((row) => [
    row.sourceRowNumber,
    ...fields.map((f) => row.rawValues[f.key] ?? row.normalizedValues[f.key] ?? ''),
    row.errors.join(' | '),
  ]);

  return buildUtf8BomCsv(headers, csvRows);
}

/**
 * Helper to extract human-readable label for a field key.
 */
export { getFieldLabelFa };
