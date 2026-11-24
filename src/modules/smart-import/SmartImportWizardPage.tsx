// Step 3-C: 5-Step Smart Table Mapping & Auto Column Matching Wizard (/smart-import-wizard)
// Strictly accessible to super_admin (any school in complex) and principal (own active school & academic year).
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarRange,
  Check,
  FileSpreadsheet,
  ShieldAlert,
} from 'lucide-react';
import { useAcademicYear } from '../../core/academic-year/AcademicYearContext';
import { useSchoolData } from '../../core/data/DataContext';
import { useRouter } from '../../core/router/RouterContext';
import { useToast } from '../../core/ui/ToastContext';
import { toPersianDigits } from '../../lib/digits';
import { autoMatchColumns } from '../../services/smartImport/columnMatcher';
import {
  buildMergedRawRecords,
  computeDryRunSummary,
  evaluateAllImportRows,
  getDefaultMissingCellPolicies,
} from '../../services/smartImport/importPipeline';
import {
  generateSampleIrregularSidaSource,
  parseSmartImportSource,
} from '../../services/smartImport/nativeTableParser';
import {
  applyMappingTemplateToColumns,
  buildImportMappingTemplateRecord,
  getVisibleTemplatesForSchool,
} from '../../services/smartImport/templateRepository';
import type {
  ColumnMappingItem,
  DuplicateHandlingStrategy,
  MappingTargetSelection,
  MissingCellPolicyConfig,
  MissingCellPolicyMap,
  ParsedTableResult,
  SecondaryJoinConfig,
  SmartImportCommitReceipt,
  SmartImportFieldKey,
  SmartImportTargetType,
} from '../../services/smartImport/types';
import type { ImportMappingTemplate } from '../../types/domain';
import { Step1SourceAndHeader } from './Step1SourceAndHeader';
import { Step2ColumnMapping } from './Step2ColumnMapping';
import { Step3JoinAndPolicies } from './Step3JoinAndPolicies';
import { Step4ReviewAndQuarantine } from './Step4ReviewAndQuarantine';
import { Step5TemplateCommitAndPrint } from './Step5TemplateCommitAndPrint';

const WIZARD_STEPS = [
  { id: 1, titleFa: 'بارگذاری و سرستون' },
  { id: 2, titleFa: 'تطبیق خودکار ستون‌ها' },
  { id: 3, titleFa: 'پیوند و خانه‌های خالی' },
  { id: 4, titleFa: 'اعتبارسنجی و قرنطینه' },
  { id: 5, titleFa: 'الگو، ثبت و چاپ رسمی' },
] as const;

const EMPTY_JOIN_CONFIG: SecondaryJoinConfig = {
  enabled: false,
  fileName: '',
  parsedTable: null,
  headerRowIndex: 0,
  nationalIdColIndex: 0,
  selectedAppendColIndices: [],
  appendColumnMappings: {},
};

export const SmartImportWizardPage: React.FC = () => {
  const {
    session,
    activeRole,
    activeSchool,
    activeSchoolId,
    allSchools,
    isActiveSchoolPanicLocked,
    importMappingTemplates,
    getSchoolRecordsForImport,
    saveImportMappingTemplate,
    deleteImportMappingTemplate,
    commitSmartImportBatch,
  } = useSchoolData();
  const { academicYears, academicYearId, currentYear } = useAcademicYear();
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const isSuperAdmin = activeRole === 'super_admin';
  const isPrincipal = activeRole === 'principal';
  const hasWizardAccess = isSuperAdmin || isPrincipal;

  // Multi-school & academic year scope (Super Admin can pick any school/year; Principal is strictly locked to own active school & year)
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(activeSchoolId);
  const [selectedYearCode, setSelectedYearCode] = useState<string>(
    currentYear?.code ?? activeSchool.academicYear ?? academicYearId
  );

  useEffect(() => {
    if (!isSuperAdmin) {
      setSelectedSchoolId(activeSchoolId);
      setSelectedYearCode(currentYear?.code ?? activeSchool.academicYear ?? academicYearId);
    }
  }, [isSuperAdmin, activeSchoolId, activeSchool.academicYear, currentYear?.code, academicYearId]);

  const targetSchool = useMemo(
    () => allSchools.find((s) => s.id === selectedSchoolId) ?? activeSchool,
    [allSchools, selectedSchoolId, activeSchool]
  );

  const targetComplexId = targetSchool.complexId ?? session?.complexId ?? 'complex-1';

  // Wizard Core State
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [targetType, setTargetType] = useState<SmartImportTargetType>('students');
  const [parsedTable, setParsedTable] = useState<ParsedTableResult | null>(null);
  const [headerRowIndex, setHeaderRowIndex] = useState<number>(0);
  const [parseErrorFa, setParseErrorFa] = useState<string | null>(null);

  const [columnMappings, setColumnMappings] = useState<ColumnMappingItem[]>([]);
  const [splitFullName, setSplitFullName] = useState<boolean>(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const [joinConfig, setJoinConfig] = useState<SecondaryJoinConfig>(EMPTY_JOIN_CONFIG);
  const [policies, setPolicies] = useState<MissingCellPolicyMap>(() =>
    getDefaultMissingCellPolicies('students')
  );
  const [duplicateStrategy, setDuplicateStrategy] =
    useState<DuplicateHandlingStrategy>('smart_merge');

  // Inline edits applied by user in Step 4 (keyed by rowId -> partial field overrides)
  const [inlineOverrides, setInlineOverrides] = useState<
    Record<string, Partial<Record<SmartImportFieldKey, string>>>
  >({});

  const [committing, setCommitting] = useState(false);
  const [commitReceipt, setCommitReceipt] = useState<SmartImportCommitReceipt | null>(null);

  // Access Guard
  if (!hasWizardAccess || !session) {
    return (
      <div className="max-w-xl mx-auto py-8" dir="rtl">
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
            <ShieldAlert className="w-6 h-6 shrink-0" />
            <div>
              <div className="text-xs font-bold">محدودیت سطح دسترسی</div>
              <h1 className="text-base font-extrabold text-slate-900 dark:text-white">
                دسترسی به ویزارد ورود هوشمند صرفاً برای راهبر ارشد و مدیر مدرسه مجاز است
              </h1>
            </div>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-6">
            برای حفظ امنیت و ایزوله‌سازی داده‌های مدارس، ابزار نگاشت هوشمند جدول‌ها و ورود گروهی فایل‌های سیدا و اکسل تنها در اختیار «راهبر ارشد سامانه» و «مدیر مدرسه» قرار دارد.
          </p>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="min-h-[42px] inline-flex items-center gap-2 rounded-xl brand-btn px-4 text-xs font-bold"
          >
            <ArrowRight className="w-4 h-4" />
            بازگشت به داشبورد
          </button>
        </div>
      </div>
    );
  }

  const existingSchoolLookup = useMemo(
    () => getSchoolRecordsForImport(targetSchool.id),
    [getSchoolRecordsForImport, targetSchool.id, commitReceipt]
  );

  const visibleTemplates = useMemo(
    () =>
      getVisibleTemplatesForSchool(
        importMappingTemplates,
        targetSchool.id,
        targetComplexId,
        targetType
      ),
    [importMappingTemplates, targetSchool.id, targetComplexId, targetType]
  );

  // Re-run auto column matcher whenever table, header row, or targetType changes
  const runAutoColumnMatch = (
    table: ParsedTableResult,
    hdrIdx: number,
    entityType: SmartImportTargetType
  ) => {
    const headers = table.rows[hdrIdx] ?? [];
    const dataRows = table.rows.slice(hdrIdx + 1);
    const { mappings, recommendSplitFullName } = autoMatchColumns(headers, dataRows, entityType);
    setColumnMappings(mappings);
    setSplitFullName(recommendSplitFullName);
    setSelectedTemplateId('');
    setInlineOverrides({});
  };

  const handleChangeTargetType = (next: SmartImportTargetType) => {
    setTargetType(next);
    setPolicies(getDefaultMissingCellPolicies(next));
    setJoinConfig(EMPTY_JOIN_CONFIG);
    setInlineOverrides({});
    setCommitReceipt(null);
    if (parsedTable) {
      runAutoColumnMatch(parsedTable, headerRowIndex, next);
    }
  };

  const handleParseRawInput = (
    rawText: string,
    fileName: string,
    sourceHint: 'file' | 'paste'
  ) => {
    setParseErrorFa(null);
    setCommitReceipt(null);
    const result = parseSmartImportSource(rawText, fileName, targetType, sourceHint);
    if (result.totalRows < 2 || result.columnCount === 0) {
      setParseErrorFa(
        'فایل یا متن واردشده فاقد ساختار جدولی معتبر (حداقل یک ردیف سرستون و یک ردیف داده) است.'
      );
      setParsedTable(null);
      return;
    }
    setParsedTable(result);
    setHeaderRowIndex(result.detectedHeaderRowIndex);
    setJoinConfig(EMPTY_JOIN_CONFIG);
    runAutoColumnMatch(result, result.detectedHeaderRowIndex, targetType);
    showToast(
      `فایل «${fileName}» پردازش شد؛ ردیف ${toPersianDigits(result.detectedHeaderRowIndex + 1)} به‌صورت خودکار به‌عنوان سرستون تشخیص داده شد.`
    );
  };

  const handleSelectHeaderRowIndex = (idx: number) => {
    setHeaderRowIndex(idx);
    if (parsedTable) {
      runAutoColumnMatch(parsedTable, idx, targetType);
    }
  };

  const handleLoadSampleIrregularSida = () => {
    const sample = generateSampleIrregularSidaSource(targetType);
    handleParseRawInput(sample.content, sample.fileName, 'file');
  };

  const handleUploadSecondaryRaw = (rawText: string, fileName: string) => {
    const secParsed = parseSmartImportSource(rawText, fileName, targetType, 'file');
    if (secParsed.totalRows < 2) {
      showToast('فایل دوم ساختار جدولی معتبر ندارد.', 'error');
      return;
    }
    const secHeaders = secParsed.rows[secParsed.detectedHeaderRowIndex] ?? [];
    const secData = secParsed.rows.slice(secParsed.detectedHeaderRowIndex + 1);
    const { mappings: secAuto } = autoMatchColumns(secHeaders, secData, targetType);

    const natCol =
      secAuto.find((m) => m.targetField === 'nationalId')?.colIndex ?? 0;

    const appendIndices: number[] = [];
    const appendMap: Record<number, MappingTargetSelection> = {};
    for (const m of secAuto) {
      if (m.colIndex === natCol) continue;
      appendMap[m.colIndex] = m.targetField;
      if (m.targetField !== '__ignore__') {
        appendIndices.push(m.colIndex);
      }
    }

    setJoinConfig({
      enabled: true,
      fileName,
      parsedTable: secParsed,
      headerRowIndex: secParsed.detectedHeaderRowIndex,
      nationalIdColIndex: natCol,
      selectedAppendColIndices: appendIndices,
      appendColumnMappings: appendMap,
    });
    setInlineOverrides({});
    showToast(`فایل مکمل «${fileName}» با موفقیت برای پیوند روی کد ملی بارگذاری شد.`);
  };

  const handleLoadSampleSecondary = () => {
    const sample = generateSampleIrregularSidaSource(targetType);
    handleUploadSecondaryRaw(sample.secondaryContent, sample.secondaryFileName);
  };

  const handleChangeColumnTarget = (colIndex: number, nextTarget: MappingTargetSelection) => {
    setColumnMappings((prev) =>
      prev.map((col) =>
        col.colIndex === colIndex
          ? {
              ...col,
              targetField: nextTarget,
              confidence: nextTarget === '__ignore__' ? 'unmatched' : 'exact',
              matchReasonFa:
                nextTarget === '__ignore__'
                  ? 'نادیده گرفته‌شده توسط کاربر'
                  : 'تنظیم دستی توسط کاربر',
            }
          : col
      )
    );
    setInlineOverrides({});
  };

  const handleApplyTemplate = (template: ImportMappingTemplate) => {
    const { mappings, matchedCount } = applyMappingTemplateToColumns(template, columnMappings);
    setColumnMappings(mappings);
    setSplitFullName(template.splitFullName);
    if (template.missingPolicies && Object.keys(template.missingPolicies).length > 0) {
      setPolicies(template.missingPolicies as MissingCellPolicyMap);
    }
    setSelectedTemplateId(template.id);
    setInlineOverrides({});
    showToast(
      `الگوی «${template.nameFa}» اعمال شد (${toPersianDigits(matchedCount)} ستون منطبق گردید).`
    );
  };

  const handleDeleteTemplate = async (template: ImportMappingTemplate) => {
    const res = await deleteImportMappingTemplate(template.id, template.schoolId);
    if (res.ok) {
      if (selectedTemplateId === template.id) setSelectedTemplateId('');
      showToast(`الگوی «${template.nameFa}» به سطل بازیابی امن منتقل شد (حذف نرم).`);
    } else {
      showToast(res.errorFa ?? 'خطا در حذف الگو.', 'error');
    }
  };

  const handleUpdatePolicy = (fieldKey: SmartImportFieldKey, next: MissingCellPolicyConfig) => {
    setPolicies((prev) => ({
      ...prev,
      [fieldKey]: next,
    }));
  };

  // Merge + Join records reactively
  const mergedResult = useMemo(() => {
    if (!parsedTable) {
      return {
        records: [],
        joinSummary: {
          joinedCount: 0,
          unmatchedPrimaryCount: 0,
          unmatchedSecondaryCount: 0,
          secondaryValidKeyCount: 0,
        },
      };
    }
    return buildMergedRawRecords({
      primaryRows: parsedTable.rows,
      primaryHeaderRowIndex: headerRowIndex,
      columnMappings,
      splitFullName,
      joinConfig,
    });
  }, [parsedTable, headerRowIndex, columnMappings, splitFullName, joinConfig]);

  // Apply live inline overrides from Step 4 and run Iranian validation + Quarantine engine
  const validatedRows = useMemo(() => {
    const patchedRecords = mergedResult.records.map((rec) => {
      const override = inlineOverrides[rec.rowId];
      if (!override) return rec;
      return {
        ...rec,
        rawValues: {
          ...rec.rawValues,
          ...override,
        },
      };
    });

    return evaluateAllImportRows({
      mergedRecords: patchedRecords,
      targetType,
      policies,
      duplicateStrategy,
      existing: existingSchoolLookup,
      splitFullName,
    });
  }, [
    mergedResult.records,
    inlineOverrides,
    targetType,
    policies,
    duplicateStrategy,
    existingSchoolLookup,
    splitFullName,
  ]);

  const dryRunSummary = useMemo(
    () => computeDryRunSummary(validatedRows, targetType, existingSchoolLookup.classes),
    [validatedRows, targetType, existingSchoolLookup.classes]
  );

  const validRows = useMemo(
    () => validatedRows.filter((r) => r.bucket === 'valid'),
    [validatedRows]
  );
  const nonValidRows = useMemo(
    () => validatedRows.filter((r) => r.bucket !== 'valid'),
    [validatedRows]
  );

  const handleEditRowField = (
    rowId: string,
    fieldKey: SmartImportFieldKey,
    nextValue: string
  ) => {
    setInlineOverrides((prev) => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] ?? {}),
        [fieldKey]: nextValue,
      },
    }));
  };

  const handleSaveTemplate = async (nameFa: string, isComplexWide: boolean) => {
    const tpl = buildImportMappingTemplateRecord({
      nameFa,
      complexId: targetComplexId,
      schoolId: targetSchool.id,
      academicYearId: selectedYearCode,
      isComplexWide: isSuperAdmin ? isComplexWide : false,
      targetType,
      columnMappings,
      splitFullName,
      missingPolicies: policies,
      createdByUserId: session.userId,
      createdByName: session.displayName,
    });
    const res = await saveImportMappingTemplate(tpl);
    if (res.ok) {
      setSelectedTemplateId(tpl.id);
      showToast(`الگوی نگاشت «${nameFa}» با موفقیت ذخیره شد.`);
    } else {
      showToast(res.errorFa ?? 'خطا در ذخیره الگوی نگاشت.', 'error');
    }
  };

  const handleCommitImport = async () => {
    if (!parsedTable) return;
    setCommitting(true);
    const res = await commitSmartImportBatch({
      complexId: targetComplexId,
      schoolId: targetSchool.id,
      academicYearId: selectedYearCode,
      targetType,
      sourceFileName: parsedTable.fileName,
      secondaryFileName: joinConfig.enabled ? joinConfig.fileName : undefined,
      duplicateStrategy,
      missingPolicies: policies,
      validRows,
      quarantinedRows: nonValidRows,
      joinedCount: mergedResult.joinSummary.joinedCount,
    });
    setCommitting(false);

    if (res.ok && res.receipt) {
      setCommitReceipt(res.receipt);
      showToast(
        `عملیات ورود هوشمند تکمیل شد: ${toPersianDigits(res.receipt.createdCount)} جدید و ${toPersianDigits(res.receipt.updatedCount)} به‌روزرسانی ثبت گردید.`
      );
    } else {
      showToast(res.errorFa ?? 'خطا در ثبت نهایی داده‌ها.', 'error');
    }
  };

  const handleStartFreshWizard = () => {
    setStep(1);
    setParsedTable(null);
    setHeaderRowIndex(0);
    setColumnMappings([]);
    setJoinConfig(EMPTY_JOIN_CONFIG);
    setInlineOverrides({});
    setCommitReceipt(null);
    setParseErrorFa(null);
  };

  const canProceedFromStep1 = Boolean(parsedTable && parsedTable.totalRows >= 2);
  const canProceedFromStep2 = columnMappings.some((c) => c.targetField !== '__ignore__');

  return (
    <div className="space-y-5" dir="rtl" data-testid="smart-import-wizard-page">
      {/* Page Header & Multi-School / Academic Year Scope Bar */}
      <div className="no-print rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl brand-bg flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
              ویزارد نگاشت هوشمند جدول‌ها و تطبیق خودکار ستون‌ها
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-5">
              ورود بومی و آفلاین فایل‌های سیدا، اکسل و CSV با کشف خودکار سرستون، پیوند دو جدول، اعتبارسنجی قوانین ایران و قرنطینه خطادار
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* School Scope Selector (Editable for Super Admin, Locked Read-Only for Principal) */}
          <div className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            {isSuperAdmin ? (
              <select
                aria-label="انتخاب مدرسه مقصد برای ورود هوشمند"
                value={selectedSchoolId}
                onChange={(e) => {
                  setSelectedSchoolId(e.target.value);
                  setCommitReceipt(null);
                }}
                className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-bold text-slate-800 dark:text-slate-100"
              >
                {allSchools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {targetSchool.name}
              </span>
            )}
          </div>

          <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
            ·
          </span>

          {/* Academic Year Scope Selector */}
          <div className="flex items-center gap-1.5">
            <CalendarRange className="w-4 h-4 text-slate-400 shrink-0" />
            {isSuperAdmin && academicYears.length > 0 ? (
              <select
                aria-label="انتخاب سال تحصیلی مقصد"
                value={selectedYearCode}
                onChange={(e) => setSelectedYearCode(e.target.value)}
                className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-bold text-slate-800 dark:text-slate-100 tabular-nums"
              >
                {academicYears.map((y) => (
                  <option key={y.id} value={y.code}>
                    {toPersianDigits(y.code)}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                سال تحصیلی {toPersianDigits(selectedYearCode)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Panic Mode Alert */}
      {isActiveSchoolPanicLocked && (
        <div
          role="alert"
          className="no-print rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-xs font-bold text-rose-800 dark:text-rose-200 flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            سامانه در وضعیت قفل اضطراری (فقط‌خواندنی) قرار دارد؛ می‌توانید مراحل تحلیل و پیش‌نمایش را بررسی کنید اما ثبت نهایی تا رفع قفل غیرفعال است.
          </span>
        </div>
      )}

      {/* 5-Step Progress Bar */}
      <nav
        aria-label="مراحل ویزارد ورود هوشمند"
        className="no-print rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"
      >
        <ol className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {WIZARD_STEPS.map((s) => {
            const isActive = step === s.id;
            const isCompleted = step > s.id;
            const clickable =
              s.id === 1 ||
              (s.id === 2 && canProceedFromStep1) ||
              (s.id >= 3 && canProceedFromStep1 && canProceedFromStep2);

            return (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && setStep(s.id)}
                  className={`w-full min-h-[44px] flex items-center gap-2 rounded-xl px-3 py-2 text-right transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${
                    isActive
                      ? 'brand-btn shadow-xs'
                      : isCompleted
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 tabular-nums ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : isCompleted
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : toPersianDigits(s.id)}
                  </span>
                  <span className="text-xs font-bold truncate">{s.titleFa}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Active Step Viewport */}
      <div>
        {step === 1 && (
          <Step1SourceAndHeader
            targetType={targetType}
            onChangeTargetType={handleChangeTargetType}
            parsedTable={parsedTable}
            headerRowIndex={headerRowIndex}
            onSelectHeaderRowIndex={handleSelectHeaderRowIndex}
            onParseRawInput={handleParseRawInput}
            onLoadSampleIrregularSida={handleLoadSampleIrregularSida}
            parseErrorFa={parseErrorFa}
          />
        )}

        {step === 2 && (
          <Step2ColumnMapping
            targetType={targetType}
            columnMappings={columnMappings}
            onChangeColumnTarget={handleChangeColumnTarget}
            onResetAutoMatch={() => {
              if (parsedTable) runAutoColumnMatch(parsedTable, headerRowIndex, targetType);
            }}
            splitFullName={splitFullName}
            onToggleSplitFullName={setSplitFullName}
            visibleTemplates={visibleTemplates}
            selectedTemplateId={selectedTemplateId}
            onApplyTemplate={handleApplyTemplate}
            onDeleteTemplate={(tpl) => void handleDeleteTemplate(tpl)}
            canDeleteTemplate={(tpl) =>
              isSuperAdmin || (!tpl.isComplexWide && tpl.schoolId === session.schoolId)
            }
          />
        )}

        {step === 3 && (
          <Step3JoinAndPolicies
            targetType={targetType}
            joinConfig={joinConfig}
            joinSummary={mergedResult.joinSummary}
            onUploadSecondaryRaw={handleUploadSecondaryRaw}
            onLoadSampleSecondary={handleLoadSampleSecondary}
            onClearSecondary={() => setJoinConfig(EMPTY_JOIN_CONFIG)}
            onUpdateJoinConfig={setJoinConfig}
            policies={policies}
            onUpdatePolicy={handleUpdatePolicy}
          />
        )}

        {step === 4 && (
          <Step4ReviewAndQuarantine
            targetType={targetType}
            schoolId={targetSchool.id}
            validatedRows={validatedRows}
            duplicateStrategy={duplicateStrategy}
            onChangeDuplicateStrategy={setDuplicateStrategy}
            onEditRowField={handleEditRowField}
          />
        )}

        {step === 5 && (
          <Step5TemplateCommitAndPrint
            targetType={targetType}
            targetSchoolId={targetSchool.id}
            targetSchoolName={targetSchool.name}
            academicYearLabel={selectedYearCode}
            sourceFileName={parsedTable?.fileName ?? 'فایل ورودی'}
            secondaryFileName={joinConfig.enabled ? joinConfig.fileName : undefined}
            isSuperAdmin={isSuperAdmin}
            isPanicLocked={isActiveSchoolPanicLocked}
            dryRun={dryRunSummary}
            quarantinedRows={nonValidRows}
            committing={committing}
            commitReceipt={commitReceipt}
            onSaveTemplate={handleSaveTemplate}
            onCommitImport={handleCommitImport}
            onStartFreshWizard={handleStartFreshWizard}
          />
        )}
      </div>

      {/* Bottom Step Navigation Footer */}
      <div className="no-print rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={step === 1}
          onClick={() => setStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4 | 5) : prev))}
          className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-4 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          مرحله قبل
        </button>

        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
          مرحله {toPersianDigits(step)} از {toPersianDigits(5)}
        </div>

        {step < 5 ? (
          <button
            type="button"
            data-testid="wizard-next-step-btn"
            disabled={
              (step === 1 && !canProceedFromStep1) ||
              (step === 2 && !canProceedFromStep2)
            }
            onClick={() =>
              setStep((prev) => (prev < 5 ? ((prev + 1) as 1 | 2 | 3 | 4 | 5) : prev))
            }
            className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl brand-btn px-5 text-xs font-bold disabled:opacity-40 transition-colors"
          >
            <span>مرحله بعد</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        ) : (
          <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
            {commitReceipt ? 'ثبت نهایی انجام شد ✓' : 'آماده تأیید نهایی'}
          </div>
        )}
      </div>
    </div>
  );
};
