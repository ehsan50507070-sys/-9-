// Pure, testable logic for the Non-Destructive Plugin Engine & Smart Substitute Finder
import type {
  CollectionName,
  PersianWeekdayIndex,
  PeriodNumber,
  ScheduleSlot,
  SchoolPluginState,
  StaffAttendanceRecord,
  SubstitutionRecord,
  Teacher,
} from '../../types/domain';
import type { PluginManifest, PluginRuntimeStatus } from './types';

export type CollectionCountMap = Partial<Record<CollectionName, number>>;

/**
 * Computes effective plugin state for a school without mutating any data stores.
 */
export function resolvePluginState(
  manifest: PluginManifest,
  statesForSchool: SchoolPluginState[]
): { installed: boolean; enabled: boolean } {
  if (manifest.isCore) {
    return { installed: true, enabled: true };
  }
  const found = statesForSchool.find((s) => s.pluginId === manifest.id);
  if (!found) {
    return { installed: manifest.implemented, enabled: manifest.implemented && manifest.defaultEnabled };
  }
  return {
    installed: found.installed,
    enabled: found.installed && found.enabled,
  };
}

/**
 * Counts preserved user records belonging to a plugin in the active school.
 * This count MUST remain intact even when installed=false or enabled=false.
 */
export function countPreservedRecordsForPlugin(
  manifest: PluginManifest,
  collectionCounts: CollectionCountMap
): number {
  return manifest.dataStores.reduce((sum, store) => sum + (collectionCounts[store] ?? 0), 0);
}

/**
 * Returns active plugins that declare `pluginId` in their `dependencies` array.
 * Used by the Dependency Guard before disabling or soft-uninstalling a plugin.
 */
export function getActiveDependents(
  pluginId: string,
  allManifests: PluginManifest[],
  statesForSchool: SchoolPluginState[]
): PluginManifest[] {
  return allManifests.filter((m) => {
    if (!m.dependencies?.includes(pluginId)) return false;
    const state = resolvePluginState(m, statesForSchool);
    return state.installed && state.enabled;
  });
}

/**
 * Returns dependencies of `manifest` that are currently disabled or uninstalled.
 */
export function getDisabledDependencies(
  manifest: PluginManifest,
  allManifests: PluginManifest[],
  statesForSchool: SchoolPluginState[]
): PluginManifest[] {
  if (!manifest.dependencies || manifest.dependencies.length === 0) return [];
  return manifest.dependencies
    .map((depId) => allManifests.find((m) => m.id === depId))
    .filter((dep): dep is PluginManifest => {
      if (!dep) return false;
      const state = resolvePluginState(dep, statesForSchool);
      return !state.installed || !state.enabled;
    });
}

export function buildPluginRuntimeStatuses(
  allManifests: PluginManifest[],
  statesForSchool: SchoolPluginState[],
  collectionCounts: CollectionCountMap
): PluginRuntimeStatus[] {
  return allManifests.map((manifest) => {
    const { installed, enabled } = resolvePluginState(manifest, statesForSchool);
    return {
      manifest,
      installed,
      enabled,
      preservedRecordCount: countPreservedRecordsForPlugin(manifest, collectionCounts),
      blockedByDisabledDependencies: getDisabledDependencies(manifest, allManifests, statesForSchool),
      activeDependents: getActiveDependents(manifest.id, allManifests, statesForSchool),
    };
  });
}

/**
 * Pure non-destructive transition: disabling or soft-uninstalling ONLY updates `school_plugin_states`.
 * Never touches user records.
 */
export function createPluginStateTransition(params: {
  schoolId: string;
  pluginId: string;
  action: 'enable' | 'disable' | 'uninstall' | 'install';
  updatedBy: string;
  nowIso?: string;
}): SchoolPluginState {
  const updatedAt = params.nowIso ?? new Date().toISOString();
  const id = `${params.schoolId}:${params.pluginId}`;

  switch (params.action) {
    case 'enable':
    case 'install':
      return {
        id,
        schoolId: params.schoolId,
        pluginId: params.pluginId,
        installed: true,
        enabled: true,
        updatedAt,
        updatedBy: params.updatedBy,
      };
    case 'disable':
      return {
        id,
        schoolId: params.schoolId,
        pluginId: params.pluginId,
        installed: true,
        enabled: false,
        updatedAt,
        updatedBy: params.updatedBy,
      };
    case 'uninstall':
      return {
        id,
        schoolId: params.schoolId,
        pluginId: params.pluginId,
        installed: false,
        enabled: false,
        updatedAt,
        updatedBy: params.updatedBy,
      };
  }
}

// --- Smart Substitute Finder Pure Engine ---

export interface SubstitutionNeed {
  key: string;
  schoolId: string;
  jalaliDate: string;
  weekday: PersianWeekdayIndex;
  period: PeriodNumber;
  classId: string;
  subjectName: string;
  absentTeacher: Teacher;
  reason: 'absent' | 'late';
  existingAssignment?: SubstitutionRecord;
  suggestedFreeTeachers: Teacher[];
}

/**
 * Identifies every scheduled period on `jalaliDate` where the assigned teacher is marked
 * `absent` or `late`, and computes free colleagues in the same `schoolId` at that exact day/period.
 */
export function computeSubstitutionNeeds(params: {
  schoolId: string;
  jalaliDate: string;
  weekday: PersianWeekdayIndex;
  teachers: Teacher[];
  schedules: ScheduleSlot[];
  staffAttendance: StaffAttendanceRecord[];
  substitutions: SubstitutionRecord[];
}): SubstitutionNeed[] {
  const { schoolId, jalaliDate, weekday, teachers, schedules, staffAttendance, substitutions } = params;

  // Enforce strict schoolId filtering inside the pure engine too
  const schoolTeachers = teachers.filter((t) => t.schoolId === schoolId && t.active);
  const schoolSchedules = schedules.filter((s) => s.schoolId === schoolId && s.weekday === weekday);
  const dateAttendance = staffAttendance.filter(
    (a) => a.schoolId === schoolId && a.jalaliDate === jalaliDate
  );
  const dateSubs = substitutions.filter(
    (sub) => sub.schoolId === schoolId && sub.jalaliDate === jalaliDate
  );

  const teacherMap = new Map(schoolTeachers.map((t) => [t.id, t]));
  const needs: SubstitutionNeed[] = [];

  for (const record of dateAttendance) {
    if (record.status !== 'absent' && record.status !== 'late') continue;
    const absentTeacher = teacherMap.get(record.teacherId);
    if (!absentTeacher) continue;

    // Find the class this teacher is scheduled to teach on this weekday & period
    const slot = schoolSchedules.find(
      (s) => s.teacherId === record.teacherId && s.period === record.period
    );
    if (!slot) continue;

    // Determine which teachers are busy during this exact period
    const busyTeacherIds = new Set<string>();
    busyTeacherIds.add(record.teacherId);

    // Busy teaching another class in this period
    for (const s of schoolSchedules) {
      if (s.period === record.period) {
        busyTeacherIds.add(s.teacherId);
      }
    }

    // Absent, late, or excused themselves in this period
    for (const att of dateAttendance) {
      if (att.period === record.period && att.status !== 'present') {
        busyTeacherIds.add(att.teacherId);
      }
    }

    // Already assigned as substitute for another class in this same period
    for (const sub of dateSubs) {
      if (sub.period === record.period && sub.absentTeacherId !== record.teacherId) {
        busyTeacherIds.add(sub.substituteTeacherId);
      }
    }

    const existingAssignment = dateSubs.find(
      (sub) => sub.period === record.period && sub.absentTeacherId === record.teacherId
    );

    const suggestedFreeTeachers = schoolTeachers.filter((t) => !busyTeacherIds.has(t.id));

    needs.push({
      key: `${schoolId}:${jalaliDate}:${record.period}:${record.teacherId}`,
      schoolId,
      jalaliDate,
      weekday,
      period: record.period,
      classId: slot.classId,
      subjectName: slot.subjectName,
      absentTeacher,
      reason: record.status,
      existingAssignment,
      suggestedFreeTeachers,
    });
  }

  return needs.sort((a, b) => a.period - b.period);
}

export interface AttendanceSummaryMetrics {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRatePercent: number;
}

/**
 * Unified student attendance rate calculation:
 * Physically in-school = present + late; not in-school = absent + excused.
 */
export function computeStudentAttendanceSummary(params: {
  totalActiveStudents: number;
  recordsForSlot: Array<{ status: 'present' | 'absent' | 'late' | 'excused' }>;
}): AttendanceSummaryMetrics {
  const { totalActiveStudents, recordsForSlot } = params;
  let absent = 0;
  let late = 0;
  let excused = 0;
  for (const r of recordsForSlot) {
    if (r.status === 'absent') absent++;
    else if (r.status === 'late') late++;
    else if (r.status === 'excused') excused++;
  }
  const present = Math.max(0, totalActiveStudents - absent - late - excused);
  const inSchool = Math.max(0, totalActiveStudents - absent - excused);
  const attendanceRatePercent =
    totalActiveStudents > 0 ? Math.round((inSchool / totalActiveStudents) * 100) : 100;

  return {
    total: totalActiveStudents,
    present,
    absent,
    late,
    excused,
    attendanceRatePercent,
  };
}

