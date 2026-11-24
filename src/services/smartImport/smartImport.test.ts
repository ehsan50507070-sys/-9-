// Step 3-C Automated Verification Suite: Smart Table Mapping & Auto Column Matching Wizard
// Zero external dependencies — pure Node test runner + strict assertions.
import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizeMutation } from '../../core/auth/policy';
import { generateSeedDataset } from '../../core/data/seedData';
import { autoMatchColumns, detectColumnCellPattern } from './columnMatcher';
import {
  buildMergedRawRecords,
  buildQuarantineCsv,
  computeDryRunSummary,
  evaluateAllImportRows,
  getDefaultMissingCellPolicies,
} from './importPipeline';
import {
  normalizeGradeScore,
  normalizeIranianMobile,
  normalizeIranianNationalId,
  normalizeJalaliDateInput,
  splitPersianFullName,
} from './iranianValidators';
import {
  detectDelimiter,
  detectHeaderRowIndex,
  generateSampleIrregularSidaSource,
  parseDelimitedText,
  parseSidaHtmlTable,
  parseSmartImportSource,
  stripUtf8Bom,
} from './nativeTableParser';
import {
  applyMappingTemplateToColumns,
  buildImportMappingTemplateRecord,
  getVisibleTemplatesForSchool,
} from './templateRepository';
import type { SecondaryJoinConfig } from './types';

test('Step 3-C: Native CSV/TSV/semicolon parser handles UTF-8 BOM, quotes, and delimiters', () => {
  const bomSemicolon =
    '\uFEFF"نام و نام خانوادگی";"کد ملی";"توضیحات"\r\n"محمدطاها رستگار";"0013520849";"دانش‌آموز، کلاس ""الف"""\r\n';
  assert.equal(stripUtf8Bom(bomSemicolon).startsWith('"نام'), true);
  assert.equal(detectDelimiter(bomSemicolon), ';');

  const parsed = parseDelimitedText(bomSemicolon);
  assert.equal(parsed.delimiter, ';');
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0][0], 'نام و نام خانوادگی');
  assert.equal(parsed.rows[1][1], '0013520849');
  assert.equal(parsed.rows[1][2], 'دانش‌آموز، کلاس "الف"');

  const excelPasteTsv = 'شماره ملی\tنام کامل\tموبایل ولی\n0013520849\tعلی رضایی\t9123456789';
  assert.equal(detectDelimiter(excelPasteTsv), '\t');
  const parsedTsv = parseSmartImportSource(excelPasteTsv, 'paste.tsv', 'students', 'paste');
  assert.equal(parsedTsv.sourceFormat, 'paste');
  assert.equal(parsedTsv.rows.length, 2);
  assert.equal(parsedTsv.detectedHeaderRowIndex, 0);
});

test('Step 3-C: SIDA HTML-table parser + Header Row Auto-Detector skips 3 top banner rows', () => {
  const sample = generateSampleIrregularSidaSource('students');
  const parsed = parseSmartImportSource(sample.content, sample.fileName, 'students', 'file');

  assert.equal(parsed.sourceFormat, 'html_sida');
  assert.equal(parsed.delimiter, 'html');
  // Rows 0, 1, 2 are SIDA ministry/school banners; Row 3 is the true column header
  assert.equal(parsed.detectedHeaderRowIndex, 3);
  assert.equal(parsed.rows[3][1], 'شماره ملی دانش‌آموز');
  assert.equal(parsed.rows.length, 12); // 3 banners + 1 header + 8 student data rows

  // Verify standalone HTML extractor & header detector
  const htmlRows = parseSidaHtmlTable(sample.content);
  const { detectedHeaderRowIndex, candidates } = detectHeaderRowIndex(htmlRows, 'students');
  assert.equal(detectedHeaderRowIndex, 3);
  assert.ok(candidates.length <= 10);
  assert.ok(candidates[3].score > candidates[0].score);
});

test('Step 3-C: Iranian National ID, Mobile, Jalali Date, Score & FullName validators', () => {
  // Valid 10-digit Persian digits
  const validNat = normalizeIranianNationalId('۰۰۱۳۵۲۰۸۴۹');
  assert.equal(validNat.valid, true);
  assert.equal(validNat.normalized, '0013520849');
  assert.equal(validNat.paddedLeadingZeros, false);

  // 8-digit leading zero stripped by Excel -> auto-padded to 10 digits with warning
  const paddedNat = normalizeIranianNationalId('12345679');
  assert.equal(paddedNat.valid, true);
  assert.equal(paddedNat.normalized, '0012345679');
  assert.equal(paddedNat.paddedLeadingZeros, true);
  assert.ok(paddedNat.warningFa);

  // Identical digits rejected
  const identicalNat = normalizeIranianNationalId('1111111111');
  assert.equal(identicalNat.valid, false);
  assert.ok(identicalNat.errorFa?.includes('یکسان'));

  // Wrong Mod-11 check digit rejected
  const badCheckNat = normalizeIranianNationalId('1270894519');
  assert.equal(badCheckNat.valid, false);
  assert.ok(badCheckNat.errorFa?.includes('کنترل'));

  // Mobile normalization variants
  assert.equal(normalizeIranianMobile('+989123456789').normalized, '09123456789');
  assert.equal(normalizeIranianMobile('00989123456789').normalized, '09123456789');
  assert.equal(normalizeIranianMobile('9123456789').normalized, '09123456789');
  assert.equal(normalizeIranianMobile('۰۹۳۵۱۲۳۴۵۶۷').normalized, '09351234567');
  assert.equal(normalizeIranianMobile('0912888').valid, false);

  // Jalali Date & Grade Score
  assert.equal(normalizeJalaliDateInput('۱۳۹۵-۴-۹').normalized, '1395/04/09');
  assert.equal(normalizeJalaliDateInput('1405/13/01').valid, false);
  assert.equal(normalizeGradeScore('۱۸٫۷۵').numericValue, 18.75);
  assert.equal(normalizeGradeScore('21.5').valid, false);

  // Compound Persian full-name splitting
  const split1 = splitPersianFullName('امیر علی رضایی پور');
  assert.equal(split1.firstName, 'امیر علی');
  assert.equal(split1.lastName, 'رضایی پور');

  const split2 = splitPersianFullName('سید محمد حسینی');
  assert.equal(split2.firstName, 'سید محمد');
  assert.equal(split2.lastName, 'حسینی');
});

test('Step 3-C: Two-Layer Auto Column Matcher (Dictionary + 10-Sample Pattern Recognition)', () => {
  // Layer 1 + Layer 2 on messy SIDA student sample
  const sample = generateSampleIrregularSidaSource('students');
  const parsed = parseSmartImportSource(sample.content, sample.fileName, 'students', 'file');
  const headers = parsed.rows[parsed.detectedHeaderRowIndex];
  const dataRows = parsed.rows.slice(parsed.detectedHeaderRowIndex + 1);

  const matchRes = autoMatchColumns(headers, dataRows, 'students');
  assert.equal(matchRes.recommendSplitFullName, true);
  assert.equal(matchRes.mappings[0].targetField, '__ignore__'); // ردیف ignored
  assert.equal(matchRes.mappings[1].targetField, 'nationalId');
  assert.equal(matchRes.mappings[2].targetField, 'fullName');
  assert.equal(matchRes.mappings[3].targetField, 'parentName');
  assert.equal(matchRes.mappings[4].targetField, 'parentMobile');
  assert.equal(matchRes.mappings[5].targetField, 'className');
  assert.equal(matchRes.mappings[6].targetField, 'birthDateJalali');
  assert.equal(matchRes.mappings[7].targetField, 'sidaStudentCode');

  // Layer 2 pure pattern recognition when headers are completely unknown
  const crypticHeaders = ['ستون الف', 'ستون ب', 'ستون ج', 'ستون د'];
  const crypticData = [
    ['0013520849', '9123456789', '1395/04/18', 'متن دلخواه ۱'],
    ['0084561238', '+989127654321', '1396/02/09', 'متن دلخواه ۲'],
    ['0451234561', '09351234567', '1394/11/25', 'متن دلخواه ۳'],
  ];
  assert.equal(detectColumnCellPattern(crypticData.map((r) => r[0])).pattern, 'national_id');
  assert.equal(detectColumnCellPattern(crypticData.map((r) => r[1])).pattern, 'iranian_mobile');
  assert.equal(detectColumnCellPattern(crypticData.map((r) => r[2])).pattern, 'jalali_date');

  const patternOnlyMatch = autoMatchColumns(crypticHeaders, crypticData, 'students');
  assert.equal(patternOnlyMatch.mappings[0].targetField, 'nationalId');
  assert.equal(patternOnlyMatch.mappings[0].confidence, 'smart');
  assert.equal(patternOnlyMatch.mappings[1].targetField, 'parentMobile');
  assert.equal(patternOnlyMatch.mappings[2].targetField, 'birthDateJalali');
  assert.equal(patternOnlyMatch.mappings[3].targetField, '__ignore__');
});

test('Step 3-C: Multi-Table Join, Missing-Cell Policies, 3-Bucket Quarantine & Dry-Run Summary', () => {
  const seed = generateSeedDataset();
  const schoolId = seed.schools[0].id;
  const existing = {
    students: seed.students.filter((s) => s.schoolId === schoolId),
    teachers: seed.teachers.filter((t) => t.schoolId === schoolId),
    classes: seed.classes.filter((c) => c.schoolId === schoolId),
    gradebookEntries: seed.gradebook_entries.filter((g) => g.schoolId === schoolId),
  };

  const sample = generateSampleIrregularSidaSource('students');
  const primary = parseSmartImportSource(sample.content, sample.fileName, 'students', 'file');
  const headers = primary.rows[primary.detectedHeaderRowIndex];
  const dataRows = primary.rows.slice(primary.detectedHeaderRowIndex + 1);
  const { mappings } = autoMatchColumns(headers, dataRows, 'students');

  // 1) Without Secondary Join: row 4 (invalid mobile 0912888) -> needs_fix; rows 6,7,8 -> quarantine
  const disabledJoin: SecondaryJoinConfig = {
    enabled: false,
    fileName: '',
    parsedTable: null,
    headerRowIndex: 0,
    nationalIdColIndex: 0,
    selectedAppendColIndices: [],
    appendColumnMappings: {},
  };

  const mergedNoJoin = buildMergedRawRecords({
    primaryRows: primary.rows,
    primaryHeaderRowIndex: primary.detectedHeaderRowIndex,
    columnMappings: mappings,
    splitFullName: true,
    joinConfig: disabledJoin,
  });

  const evaluatedNoJoin = evaluateAllImportRows({
    mergedRecords: mergedNoJoin.records,
    targetType: 'students',
    policies: getDefaultMissingCellPolicies('students'),
    duplicateStrategy: 'smart_merge',
    existing,
    splitFullName: true,
  });

  const validNoJoin = evaluatedNoJoin.filter((r) => r.bucket === 'valid');
  const needsFixNoJoin = evaluatedNoJoin.filter((r) => r.bucket === 'needs_fix');
  const quarantineNoJoin = evaluatedNoJoin.filter((r) => r.bucket === 'quarantine');

  assert.equal(validNoJoin.length, 4); // rows 1,2,3 + row 5 (parentName auto_generated!)
  assert.equal(needsFixNoJoin.length, 1); // row 4 (0912888 invalid mobile -> quick-fixable)
  assert.equal(quarantineNoJoin.length, 3); // row 6 (1111111111), row 7 (bad checksum), row 8 (in-file duplicate)

  // Verify Quarantine CSV export includes UTF-8 BOM and explicit error reason
  const quarantineCsv = buildQuarantineCsv(quarantineNoJoin, 'students');
  assert.equal(quarantineCsv.startsWith('\uFEFF'), true);
  assert.ok(quarantineCsv.includes('دلیل خطا / علت قرنطینه'));
  assert.ok(quarantineCsv.includes('تکراری'));

  // 2) With Secondary Join enabled: rescues row 4's invalid mobile & fills row 5's parentName & emergencyNotes!
  const secondary = parseSmartImportSource(
    sample.secondaryContent,
    sample.secondaryFileName,
    'students',
    'file'
  );
  const enabledJoin: SecondaryJoinConfig = {
    enabled: true,
    fileName: sample.secondaryFileName,
    parsedTable: secondary,
    headerRowIndex: secondary.detectedHeaderRowIndex,
    nationalIdColIndex: 0,
    selectedAppendColIndices: [1, 2, 3],
    appendColumnMappings: {
      1: 'parentName',
      2: 'parentMobile',
      3: 'emergencyNotes',
    },
  };

  const mergedWithJoin = buildMergedRawRecords({
    primaryRows: primary.rows,
    primaryHeaderRowIndex: primary.detectedHeaderRowIndex,
    columnMappings: mappings,
    splitFullName: true,
    joinConfig: enabledJoin,
  });

  assert.ok(mergedWithJoin.joinSummary.joinedCount >= 3);

  const evaluatedWithJoin = evaluateAllImportRows({
    mergedRecords: mergedWithJoin.records,
    targetType: 'students',
    policies: getDefaultMissingCellPolicies('students'),
    duplicateStrategy: 'smart_merge',
    existing,
    splitFullName: true,
  });

  // Row 4 is now rescued by the secondary file's valid mobile!
  const validWithJoin = evaluatedWithJoin.filter((r) => r.bucket === 'valid');
  const needsFixWithJoin = evaluatedWithJoin.filter((r) => r.bucket === 'needs_fix');
  assert.equal(validWithJoin.length, 5);
  assert.equal(needsFixWithJoin.length, 0);

  const dryRun = computeDryRunSummary(evaluatedWithJoin, 'students', existing.classes);
  assert.equal(dryRun.validCount, 5);
  assert.equal(dryRun.quarantineCount, 3);
  assert.ok(dryRun.newClassesToCreate.includes('پایه پنجم - کلاس ج'));
});

test('Step 3-C: Mapping Templates visibility isolation & RBAC policy enforcement', () => {
  const sample = generateSampleIrregularSidaSource('students');
  const parsed = parseSmartImportSource(sample.content, sample.fileName, 'students', 'file');
  const headers = parsed.rows[parsed.detectedHeaderRowIndex];
  const dataRows = parsed.rows.slice(parsed.detectedHeaderRowIndex + 1);
  const { mappings } = autoMatchColumns(headers, dataRows, 'students');

  const schoolATemplate = buildImportMappingTemplateRecord({
    nameFa: 'الگوی سیدا مدرسه الف',
    complexId: 'complex-1',
    schoolId: 'school-a',
    academicYearId: 'ay-1404-1405',
    isComplexWide: false,
    targetType: 'students',
    columnMappings: mappings,
    splitFullName: true,
    missingPolicies: getDefaultMissingCellPolicies('students'),
    createdByUserId: 'u-1',
    createdByName: 'مدیر مدرسه الف',
  });

  const complexTemplate = buildImportMappingTemplateRecord({
    nameFa: 'الگوی استاندارد کل مجموعه',
    complexId: 'complex-1',
    schoolId: 'school-a',
    academicYearId: 'ay-1404-1405',
    isComplexWide: true,
    targetType: 'students',
    columnMappings: mappings,
    splitFullName: true,
    missingPolicies: getDefaultMissingCellPolicies('students'),
    createdByUserId: 'u-super',
    createdByName: 'راهبر ارشد',
  });

  const deletedTemplate = {
    ...schoolATemplate,
    id: 'tpl-deleted',
    deletedAtIso: new Date().toISOString(),
  };

  const allTemplates = [schoolATemplate, complexTemplate, deletedTemplate];

  // School B sees ONLY the complex-wide template (NOT school-a's private template and NOT soft-deleted)
  const visibleForB = getVisibleTemplatesForSchool(allTemplates, 'school-b', 'complex-1', 'students');
  assert.equal(visibleForB.length, 1);
  assert.equal(visibleForB[0].id, complexTemplate.id);

  // Applying template maps columns cleanly
  const applied = applyMappingTemplateToColumns(schoolATemplate, mappings);
  assert.ok(applied.matchedCount >= 6);
  assert.equal(applied.mappings[1].targetField, 'nationalId');

  // RBAC policy verification
  const principalSession = {
    userId: 'p1',
    username: 'p1',
    displayName: 'مدیر',
    role: 'principal' as const,
    schoolId: 'school-a',
    isComplexWide: false,
    loggedInAt: new Date().toISOString(),
  };

  const principalOwnSchool = authorizeMutation(
    { session: principalSession },
    'import_mapping_templates',
    'write',
    { schoolId: 'school-a', record: { schoolId: 'school-a', isComplexWide: false } }
  );
  assert.equal(principalOwnSchool.allowed, true);

  const principalComplexWideDenied = authorizeMutation(
    { session: principalSession },
    'import_mapping_templates',
    'write',
    { schoolId: 'school-a', record: { schoolId: 'school-a', isComplexWide: true } }
  );
  assert.equal(principalComplexWideDenied.allowed, false);

  const principalOtherSchoolDenied = authorizeMutation(
    { session: principalSession },
    'import_mapping_templates',
    'write',
    { schoolId: 'school-b', record: { schoolId: 'school-b', isComplexWide: false } }
  );
  assert.equal(principalOtherSchoolDenied.allowed, false);

  const teacherDenied = authorizeMutation(
    {
      session: {
        userId: 't1',
        username: 't1',
        displayName: 'معلم',
        role: 'teacher',
        schoolId: 'school-a',
        isComplexWide: false,
        loggedInAt: new Date().toISOString(),
      },
    },
    'import_mapping_templates',
    'write',
    { schoolId: 'school-a', record: { schoolId: 'school-a', isComplexWide: false } }
  );
  assert.equal(teacherDenied.allowed, false);
});
