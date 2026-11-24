// Step 3-C: Mapping Template Factory & Application Helpers (persisted via IDataRepository)
import { generateUUID, sanitizeText } from '../../core/security/sanitize';
import type { ImportMappingTemplate } from '../../types/domain';
import { toNormalizedHeaderKey } from './iranianValidators';
import type {
  ColumnMappingItem,
  MappingTargetSelection,
  MissingCellPolicyMap,
  SmartImportTargetType,
} from './types';

export function buildImportMappingTemplateRecord(params: {
  nameFa: string;
  complexId: string;
  schoolId: string;
  academicYearId: string;
  isComplexWide: boolean;
  targetType: SmartImportTargetType;
  columnMappings: ColumnMappingItem[];
  splitFullName: boolean;
  missingPolicies: MissingCellPolicyMap;
  createdByUserId: string;
  createdByName: string;
}): ImportMappingTemplate {
  const nowIso = new Date().toISOString();
  const headerMap: Record<string, MappingTargetSelection> = {};
  for (const col of params.columnMappings) {
    if (col.targetField !== '__ignore__') {
      headerMap[toNormalizedHeaderKey(col.headerLabel)] = col.targetField;
    }
  }

  return {
    id: generateUUID(),
    complexId: params.complexId,
    schoolId: params.schoolId,
    academicYearId: params.academicYearId,
    createdByUserId: params.createdByUserId,
    createdByName: sanitizeText(params.createdByName, 120),
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
    nameFa: sanitizeText(params.nameFa, 120),
    targetType: params.targetType,
    isComplexWide: params.isComplexWide,
    headerMap,
    splitFullName: params.splitFullName,
    missingPolicies: params.missingPolicies,
    recordVersion: 1,
    deletedAtIso: null,
  };
}

/**
 * Applies a saved Mapping Template onto the currently detected columns of an uploaded table.
 */
export function applyMappingTemplateToColumns(
  template: ImportMappingTemplate,
  currentColumns: ColumnMappingItem[]
): {
  mappings: ColumnMappingItem[];
  matchedCount: number;
} {
  let matchedCount = 0;
  const next: ColumnMappingItem[] = currentColumns.map((col) => {
    const key = toNormalizedHeaderKey(col.headerLabel);
    const rawTarget = template.headerMap[key];
    if (rawTarget && rawTarget !== '__ignore__') {
      matchedCount++;
      return {
        ...col,
        targetField: rawTarget as MappingTargetSelection,
        confidence: 'exact',
        matchReasonFa: `اعمال‌شده از الگوی «${template.nameFa}»`,
      };
    }
    return {
      ...col,
      targetField: '__ignore__',
      confidence: 'unmatched',
      matchReasonFa: 'در الگوی انتخابی تعریف نشده است',
    };
  });

  return { mappings: next, matchedCount };
}

/**
 * Filters templates visible to the current school (own school templates + complex-wide templates).
 */
export function getVisibleTemplatesForSchool(
  allTemplates: ImportMappingTemplate[],
  schoolId: string,
  complexId: string,
  targetType?: SmartImportTargetType
): ImportMappingTemplate[] {
  return allTemplates.filter((tpl) => {
    if (tpl.deletedAtIso) return false;
    if (targetType && tpl.targetType !== targetType) return false;
    if (tpl.schoolId === schoolId) return true;
    if (tpl.isComplexWide && tpl.complexId === complexId) return true;
    return false;
  });
}
