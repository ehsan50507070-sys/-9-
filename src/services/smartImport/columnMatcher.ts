// Step 3-C: Two-Layer Auto Column Matcher (Persian/SIDA Synonym Dictionary + 10-Sample Pattern Recognition)
import {
  normalizeGradeScore,
  normalizeIranianMobile,
  normalizeIranianNationalId,
  normalizeJalaliDateInput,
  toNormalizedHeaderKey,
} from './iranianValidators';
import type {
  ColumnMatchConfidence,
  ColumnMappingItem,
  DetectedCellPattern,
  MappingTargetSelection,
  SmartImportFieldDefinition,
  SmartImportFieldKey,
  SmartImportTargetType,
} from './types';

export const SMART_IMPORT_TARGET_LABELS_FA: Record<SmartImportTargetType, string> = {
  students: 'دانش‌آموزان و اولیا',
  teachers: 'معلمان و کادر آموزشی',
  classes: 'کلاس‌بندی و سازماندهی کلاس‌ها',
  sida_grades: 'نمرات و سوابق سامانه سیدا',
};

export const SMART_IMPORT_FIELDS: readonly SmartImportFieldDefinition[] = [
  {
    key: 'nationalId',
    labelFa: 'کد ملی (۱۰ رقمی)',
    required: true,
    supportsDefault: false,
    supportsAutoGenerate: false,
    targets: ['students', 'teachers', 'sida_grades'],
  },
  {
    key: 'fullName',
    labelFa: 'نام و نام خانوادگی',
    required: true,
    supportsDefault: false,
    supportsAutoGenerate: false,
    targets: ['students', 'teachers', 'sida_grades'],
  },
  {
    key: 'firstName',
    labelFa: 'نام (مجزا)',
    required: false,
    supportsDefault: false,
    supportsAutoGenerate: false,
    targets: ['students', 'teachers'],
  },
  {
    key: 'lastName',
    labelFa: 'نام خانوادگی (مجزا)',
    required: false,
    supportsDefault: false,
    supportsAutoGenerate: false,
    targets: ['students', 'teachers'],
  },
  {
    key: 'fatherName',
    labelFa: 'نام پدر',
    required: false,
    supportsDefault: true,
    supportsAutoGenerate: false,
    defaultPlaceholderFa: 'مثلاً: ثبت‌نشده',
    targets: ['students'],
  },
  {
    key: 'parentName',
    labelFa: 'نام ولی (پدر / مادر)',
    required: false,
    supportsDefault: true,
    supportsAutoGenerate: true,
    autoGenerateHintFa: 'تولید خودکار از نام پدر یا نام خانوادگی دانش‌آموز',
    defaultPlaceholderFa: 'مثلاً: ولی دانش‌آموز',
    targets: ['students'],
  },
  {
    key: 'parentMobile',
    labelFa: 'شماره موبایل ولی',
    required: true,
    supportsDefault: true,
    supportsAutoGenerate: false,
    defaultPlaceholderFa: 'مثلاً: 09120000000',
    targets: ['students'],
  },
  {
    key: 'className',
    labelFa: 'کلاس / شعبه',
    required: true,
    supportsDefault: true,
    supportsAutoGenerate: false,
    defaultPlaceholderFa: 'مثلاً: پایه چهارم - کلاس الف',
    targets: ['students', 'classes', 'sida_grades'],
  },
  {
    key: 'gradeLabel',
    labelFa: 'پایه / مقطع تحصیلی',
    required: false,
    supportsDefault: true,
    supportsAutoGenerate: false,
    defaultPlaceholderFa: 'مثلاً: چهارم',
    targets: ['students', 'classes', 'sida_grades'],
  },
  {
    key: 'section',
    labelFa: 'شعبه (الف، ب، ج...)',
    required: false,
    supportsDefault: true,
    supportsAutoGenerate: true,
    autoGenerateHintFa: 'استخراج خودکار از عنوان کلاس یا الف',
    defaultPlaceholderFa: 'مثلاً: الف',
    targets: ['classes'],
  },
  {
    key: 'roomCode',
    labelFa: 'کد اتاق کلاس',
    required: false,
    supportsDefault: true,
    supportsAutoGenerate: true,
    autoGenerateHintFa: 'تولید خودکار کد اتاق (مانند ۱۰۱، ۱۰۲...)',
    defaultPlaceholderFa: 'مثلاً: 101',
    targets: ['classes'],
  },
  {
    key: 'capacity',
    labelFa: 'ظرفیت کلاس',
    required: false,
    supportsDefault: true,
    supportsAutoGenerate: false,
    defaultPlaceholderFa: 'مثلاً: 28',
    targets: ['classes'],
  },
  {
    key: 'birthDateJalali',
    labelFa: 'تاریخ تولد (شمسی)',
    required: false,
    supportsDefault: true,
    supportsAutoGenerate: false,
    defaultPlaceholderFa: 'مثلاً: 1395/01/01',
    targets: ['students'],
  },
  {
    key: 'studentCode',
    labelFa: 'کد دانش‌آموزی مدرسه',
    required: false,
    supportsDefault: false,
    supportsAutoGenerate: true,
    autoGenerateHintFa: 'تولید خودکار کد ۵ رقمی یکتا',
    targets: ['students'],
  },
  {
    key: 'sidaStudentCode',
    labelFa: 'کد دانش‌آموزی سیدا',
    required: false,
    supportsDefault: false,
    supportsAutoGenerate: false,
    targets: ['students'],
  },
  {
    key: 'enrollmentStatus',
    labelFa: 'وضعیت ثبت‌نام سیدا',
    required: false,
    supportsDefault: true,
    supportsAutoGenerate: false,
    defaultPlaceholderFa: 'عادی',
    targets: ['students'],
  },
  {
    key: 'emergencyNotes',
    labelFa: 'توضیحات / یادداشت اضطراری',
    required: false,
    supportsDefault: true,
    supportsAutoGenerate: false,
    defaultPlaceholderFa: 'ندارد',
    targets: ['students'],
  },
  {
    key: 'personnelCode',
    labelFa: 'کد پرسنلی',
    required: false,
    supportsDefault: false,
    supportsAutoGenerate: true,
    autoGenerateHintFa: 'تولید خودکار کد پرسنلی ۶ رقمی',
    targets: ['teachers'],
  },
  {
    key: 'mobile',
    labelFa: 'شماره موبایل همکار',
    required: true,
    supportsDefault: true,
    supportsAutoGenerate: false,
    defaultPlaceholderFa: 'مثلاً: 09120000000',
    targets: ['teachers'],
  },
  {
    key: 'specialty',
    labelFa: 'تخصص / رشته تدریسی',
    required: true,
    supportsDefault: true,
    supportsAutoGenerate: false,
    defaultPlaceholderFa: 'آموزگار عمومی',
    targets: ['teachers'],
  },
  {
    key: 'weeklyQuotaPeriods',
    labelFa: 'ساعات / زنگ موظف هفتگی',
    required: false,
    supportsDefault: true,
    supportsAutoGenerate: false,
    defaultPlaceholderFa: '24',
    targets: ['teachers'],
  },
  {
    key: 'subject',
    labelFa: 'عنوان درس',
    required: true,
    supportsDefault: true,
    supportsAutoGenerate: false,
    defaultPlaceholderFa: 'ریاضی',
    targets: ['sida_grades'],
  },
  {
    key: 'continuousScore',
    labelFa: 'نمره مستمر (۰ تا ۲۰)',
    required: false,
    supportsDefault: true,
    supportsAutoGenerate: false,
    defaultPlaceholderFa: '18',
    targets: ['sida_grades'],
  },
  {
    key: 'finalScore',
    labelFa: 'نمره پایانی (۰ تا ۲۰)',
    required: true,
    supportsDefault: false,
    supportsAutoGenerate: false,
    targets: ['sida_grades'],
  },
  {
    key: 'term',
    labelFa: 'نوبت ارزشیابی',
    required: false,
    supportsDefault: true,
    supportsAutoGenerate: false,
    defaultPlaceholderFa: 'نوبت اول',
    targets: ['sida_grades'],
  },
  {
    key: 'jalaliMonth',
    labelFa: 'ماه تحصیلی (شمسی)',
    required: false,
    supportsDefault: true,
    supportsAutoGenerate: false,
    defaultPlaceholderFa: 'دی',
    targets: ['sida_grades'],
  },
];

export function getFieldsForTarget(targetType: SmartImportTargetType): SmartImportFieldDefinition[] {
  return SMART_IMPORT_FIELDS.filter((f) => f.targets.includes(targetType));
}

export function getFieldLabelFa(key: MappingTargetSelection): string {
  if (key === '__ignore__') return 'نادیده گرفتن ستون';
  return SMART_IMPORT_FIELDS.find((f) => f.key === key)?.labelFa ?? key;
}

// Layer 1: Persian & SIDA Synonym Dictionary (normalized keys)
const FIELD_SYNONYMS: Record<SmartImportFieldKey, string[]> = {
  nationalId: [
    'کد ملی',
    'کدملی',
    'شماره ملی',
    'شماره ملی دانش آموز',
    'شماره ملی همکار',
    'شناسه ملی',
    'شناسه ملی دانش آموز',
    'کد ملی دانش آموز',
    'کد ملی معلم',
    'nationalid',
    'national_id',
    'codemelli',
  ],
  fullName: [
    'نام و نام خانوادگی',
    'نام و نام خانوادگی کامل',
    'نام کامل',
    'نام دانش آموز',
    'نام همکار',
    'نام معلم',
    'نام و شهرت',
    'fullname',
    'full_name',
    'studentname',
    'teachername',
  ],
  firstName: ['نام', 'نام کوچک', 'firstname', 'first_name'],
  lastName: ['نام خانوادگی', 'شهرت', 'فامیلی', 'lastname', 'last_name'],
  fatherName: ['نام پدر', 'پدر', 'fathername', 'father_name'],
  parentName: [
    'نام ولی',
    'نام پدر / ولی',
    'نام ولی تکمیلی',
    'ولی',
    'سرپرست',
    'نام سرپرست',
    'parentname',
    'parent_name',
  ],
  parentMobile: [
    'موبایل ولی',
    'تلفن همراه ولی',
    'موبایل پدر',
    'تلفن پدر',
    'شماره تماس ولی',
    'موبایل ولی اصلاحی',
    'شماره همراه ولی',
    'شماره تماس',
    'تلفن همراه',
    'موبایل',
    'parentmobile',
    'parent_mobile',
  ],
  className: [
    'کلاس',
    'عنوان کلاس',
    'نام کلاس',
    'شعبه کلاس',
    'کلاس / شعبه',
    'کلاس بندی',
    'classname',
    'class',
    'classid',
  ],
  gradeLabel: ['پایه', 'مقطع', 'پایه تحصیلی', 'مقطع تحصیلی', 'grade', 'gradelabel'],
  section: ['شعبه', 'گروه کلاس', 'section'],
  roomCode: ['کد اتاق', 'شماره اتاق', 'اتاق', 'room', 'roomcode'],
  capacity: ['ظرفیت', 'ظرفیت کلاس', 'سقف دانش آموز', 'capacity'],
  birthDateJalali: [
    'تاریخ تولد',
    'تولد',
    'تاریخ تولد شمسی',
    'birthdate',
    'birthdatejalali',
  ],
  studentCode: ['کد دانش آموز', 'کد دانش آموزی', 'شماره دانش آموزی', 'studentcode'],
  sidaStudentCode: ['کد سیدا', 'شناسه سیدا', 'کد دانش آموزی سیدا', 'sidacode'],
  enrollmentStatus: ['وضعیت ثبت نام', 'وضعیت سیدا', 'نوع ثبت نام', 'وضعیت'],
  emergencyNotes: ['توضیحات', 'یادداشت', 'یادداشت اضطراری', 'ملاحظات', 'notes'],
  personnelCode: ['کد پرسنلی', 'شماره پرسنلی', 'پرسنلی', 'personnelcode'],
  mobile: [
    'موبایل',
    'تلفن همراه',
    'موبایل همکار',
    'تلفن همراه اصلاحی',
    'شماره تماس',
    'شماره موبایل',
    'mobile',
    'phone',
  ],
  specialty: ['تخصص', 'تخصص تکمیلی', 'رشته تدریسی', 'رشته', 'سمت', 'specialty'],
  weeklyQuotaPeriods: [
    'ساعات موظف',
    'سقف زنگ هفتگی',
    'زنگ هفتگی',
    'ساعت هفتگی',
    'weeklyquota',
  ],
  subject: ['درس', 'عنوان درس', 'نام درس', 'ماده درسی', 'subject'],
  continuousScore: [
    'نمره مستمر',
    'مستمر',
    'ارزشیابی مستمر',
    'نمره کلاسی',
    'continuous',
    'continuousscore',
  ],
  finalScore: [
    'نمره پایانی',
    'پایانی',
    'نمره کتبی',
    'نمره نهایی',
    'نمره',
    'نمره سیدا',
    'finalscore',
    'score',
  ],
  term: ['نوبت', 'نیمسال', 'ترم', 'نوبت ارزشیابی', 'term'],
  jalaliMonth: ['ماه', 'ماه تحصیلی', 'month', 'jalalimonth'],
};

const NORMALIZED_SYNONYMS: Record<SmartImportFieldKey, string[]> = Object.fromEntries(
  (Object.entries(FIELD_SYNONYMS) as Array<[SmartImportFieldKey, string[]]>).map(
    ([key, list]) => [key, list.map(toNormalizedHeaderKey)]
  )
) as Record<SmartImportFieldKey, string[]>;

/**
 * Layer 2: Pattern Recognition over up to 10 non-empty sample cells in a column.
 */
export function detectColumnCellPattern(samples: string[]): {
  pattern: DetectedCellPattern;
  matchRatio: number;
} {
  const nonEmpty = samples.map((s) => s.trim()).filter(Boolean).slice(0, 10);
  if (nonEmpty.length === 0) {
    return { pattern: 'empty', matchRatio: 0 };
  }

  let natIdHits = 0;
  let mobileHits = 0;
  let dateHits = 0;
  let scoreHits = 0;

  for (const val of nonEmpty) {
    if (normalizeIranianMobile(val).valid) {
      mobileHits++;
    }
    const natRes = normalizeIranianNationalId(val);
    if (natRes.valid || /^\d{8,10}$/.test(val.replace(/[\s-]/g, ''))) {
      // Avoid confusing 11-digit mobile starting with 09 as National ID
      if (!normalizeIranianMobile(val).valid) {
        natIdHits++;
      }
    }
    if (normalizeJalaliDateInput(val).valid) {
      dateHits++;
    }
    const scoreRes = normalizeGradeScore(val);
    if (scoreRes.valid && !/^\d{4,}$/.test(val.trim())) {
      scoreHits++;
    }
  }

  const total = nonEmpty.length;
  const mobileRatio = mobileHits / total;
  const natIdRatio = natIdHits / total;
  const dateRatio = dateHits / total;
  const scoreRatio = scoreHits / total;

  if (mobileRatio >= 0.5) return { pattern: 'iranian_mobile', matchRatio: mobileRatio };
  if (natIdRatio >= 0.5) return { pattern: 'national_id', matchRatio: natIdRatio };
  if (dateRatio >= 0.5) return { pattern: 'jalali_date', matchRatio: dateRatio };
  if (scoreRatio >= 0.65) return { pattern: 'grade_score', matchRatio: scoreRatio };

  return { pattern: 'text', matchRatio: 1 };
}

function mapPatternToField(
  pattern: DetectedCellPattern,
  targetType: SmartImportTargetType,
  usedFields: Set<SmartImportFieldKey>
): SmartImportFieldKey | null {
  if (pattern === 'national_id') {
    if (targetType !== 'classes' && !usedFields.has('nationalId')) return 'nationalId';
  }
  if (pattern === 'iranian_mobile') {
    if (targetType === 'students' && !usedFields.has('parentMobile')) return 'parentMobile';
    if (targetType === 'teachers' && !usedFields.has('mobile')) return 'mobile';
  }
  if (pattern === 'jalali_date') {
    if (targetType === 'students' && !usedFields.has('birthDateJalali')) {
      return 'birthDateJalali';
    }
  }
  if (pattern === 'grade_score') {
    if (targetType === 'sida_grades') {
      if (!usedFields.has('finalScore')) return 'finalScore';
      if (!usedFields.has('continuousScore')) return 'continuousScore';
    }
  }
  return null;
}

/**
 * Matches all columns of a table using Layer 1 (Persian/SIDA Dictionary) + Layer 2 (10-Sample Pattern Recognition).
 */
export function autoMatchColumns(
  headers: string[],
  dataRows: string[][],
  targetType: SmartImportTargetType
): {
  mappings: ColumnMappingItem[];
  recommendSplitFullName: boolean;
} {
  const allowedFields = getFieldsForTarget(targetType);
  const allowedKeys = new Set<SmartImportFieldKey>(allowedFields.map((f) => f.key));
  const usedFields = new Set<SmartImportFieldKey>();

  const preliminary: Array<{
    colIndex: number;
    headerLabel: string;
    samples: string[];
    pattern: DetectedCellPattern;
    dictField: SmartImportFieldKey | null;
    dictStrength: 'exact' | 'partial' | 'none';
  }> = [];

  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    const headerLabel = headers[colIdx]?.trim() || `ستون ${colIdx + 1}`;
    const samples: string[] = [];
    for (let r = 0; r < dataRows.length && samples.length < 10; r++) {
      const cell = (dataRows[r]?.[colIdx] ?? '').trim();
      if (cell) samples.push(cell);
    }

    const { pattern } = detectColumnCellPattern(samples);
    const normHeader = toNormalizedHeaderKey(headerLabel);

    // Ignore pure serial/index column («ردیف»)
    if (normHeader === 'ردیف' || normHeader === 'شمارهردیف' || normHeader === 'row' || normHeader === 'no') {
      preliminary.push({
        colIndex: colIdx,
        headerLabel,
        samples,
        pattern,
        dictField: null,
        dictStrength: 'none',
      });
      continue;
    }

    let bestField: SmartImportFieldKey | null = null;
    let bestStrength: 'exact' | 'partial' | 'none' = 'none';
    let bestSpecificity = 0;

    for (const field of allowedFields) {
      const synonyms = NORMALIZED_SYNONYMS[field.key] ?? [];
      for (const syn of synonyms) {
        if (normHeader === syn) {
          if (bestStrength !== 'exact' || syn.length > bestSpecificity) {
            bestField = field.key;
            bestStrength = 'exact';
            bestSpecificity = syn.length;
          }
        } else if (
          syn.length >= 3 &&
          (normHeader.includes(syn) || (normHeader.length >= 4 && syn.includes(normHeader)))
        ) {
          if (bestStrength === 'none' || (bestStrength === 'partial' && syn.length > bestSpecificity)) {
            bestField = field.key;
            bestStrength = 'partial';
            bestSpecificity = syn.length;
          }
        }
      }
    }

    preliminary.push({
      colIndex: colIdx,
      headerLabel,
      samples,
      pattern,
      dictField: bestField,
      dictStrength: bestStrength,
    });
  }

  // Pass 1: Assign exact dictionary matches first so they claim canonical fields
  const mappings: ColumnMappingItem[] = preliminary.map((item) => ({
    colIndex: item.colIndex,
    headerLabel: item.headerLabel,
    samples: item.samples,
    targetField: '__ignore__',
    confidence: 'unmatched',
    matchReasonFa: 'تطابق خودکار یافت نشد (نادیده گرفته می‌شود)',
    detectedPattern: item.pattern,
  }));

  for (const item of preliminary) {
    if (item.dictStrength === 'exact' && item.dictField && !usedFields.has(item.dictField)) {
      usedFields.add(item.dictField);
      mappings[item.colIndex].targetField = item.dictField;
      mappings[item.colIndex].confidence = 'exact';
      mappings[item.colIndex].matchReasonFa = 'تطابق دقیق با فرهنگ‌لغت فارسی/سیدا';
    }
  }

  // Pass 2: Assign partial dictionary matches (boosted to exact if pattern agrees)
  for (const item of preliminary) {
    if (mappings[item.colIndex].targetField !== '__ignore__') continue;
    if (item.dictStrength === 'partial' && item.dictField && !usedFields.has(item.dictField)) {
      usedFields.add(item.dictField);
      const patternAgrees =
        (item.dictField === 'nationalId' && item.pattern === 'national_id') ||
        ((item.dictField === 'parentMobile' || item.dictField === 'mobile') &&
          item.pattern === 'iranian_mobile') ||
        (item.dictField === 'birthDateJalali' && item.pattern === 'jalali_date') ||
        ((item.dictField === 'finalScore' || item.dictField === 'continuousScore') &&
          item.pattern === 'grade_score');

      const confidence: ColumnMatchConfidence = patternAgrees ? 'exact' : 'smart';
      mappings[item.colIndex].targetField = item.dictField;
      mappings[item.colIndex].confidence = confidence;
      mappings[item.colIndex].matchReasonFa = patternAgrees
        ? 'تطابق هم‌زمان فرهنگ‌لغت و الگوی شکل داده‌ها'
        : 'پیشنهاد هوشمند بر اساس مشابهت سرستون فارسی';
    }
  }

  // Pass 3: Pattern-only recognition for remaining unmatched columns
  for (const item of preliminary) {
    if (mappings[item.colIndex].targetField !== '__ignore__') continue;
    const normHeader = toNormalizedHeaderKey(item.headerLabel);
    if (normHeader === 'ردیف' || normHeader === 'شمارهردیف') continue;

    const inferred = mapPatternToField(item.pattern, targetType, usedFields);
    if (inferred && allowedKeys.has(inferred)) {
      usedFields.add(inferred);
      mappings[item.colIndex].targetField = inferred;
      mappings[item.colIndex].confidence = 'smart';
      const patternNameFa =
        item.pattern === 'national_id'
          ? 'کد ملی ۱۰ رقمی'
          : item.pattern === 'iranian_mobile'
            ? 'شماره موبایل ایران'
            : item.pattern === 'jalali_date'
              ? 'تاریخ شمسی'
              : 'نمره عددی ۰ تا ۲۰';
      mappings[item.colIndex].matchReasonFa = `تشخیص هوشمند از روی الگوی ۱۰ نمونه اول (${patternNameFa})`;
    }
  }

  const hasFullName = mappings.some((m) => m.targetField === 'fullName');
  const hasSeparateName = mappings.some(
    (m) => m.targetField === 'firstName' || m.targetField === 'lastName'
  );

  return {
    mappings,
    recommendSplitFullName: hasFullName && !hasSeparateName && (targetType === 'students' || targetType === 'teachers'),
  };
}
