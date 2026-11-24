// Drop-in Plugin / Add-on Engine Type Contracts
import type React from 'react';
import type { CollectionName, RoleId } from '../../types/domain';

export type PluginCategory =
  | 'core'
  | 'operations'
  | 'academics'
  | 'digital_learning'
  | 'communication'
  | 'exams_records'
  | 'finance_analytics'
  | 'teacher_development';

export type PluginPhase = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type PluginIconName =
  | 'LayoutDashboard'
  | 'UserCheck'
  | 'Users'
  | 'UserPlus'
  | 'ClipboardList'
  | 'Blocks'
  | 'Settings'
  | 'Database'
  | 'CalendarClock'
  | 'BookOpenCheck'
  | 'FolderKanban'
  | 'GraduationCap'
  | 'FileCheck2'
  | 'Award'
  | 'PlayCircle'
  | 'Video'
  | 'FileSpreadsheet'
  | 'Home'
  | 'MessageSquare'
  | 'CalendarHeart'
  | 'FileSignature'
  | 'BellRing'
  | 'ArrowLeftRight'
  | 'Grid2x2Check'
  | 'IdCard'
  | 'Wallet'
  | 'BarChart3'
  | 'MessageSquareQuote'
  | 'Library'
  | 'Palette'
  | 'Sliders'
  | 'ShieldCheck'
  | 'ShieldAlert'
  | 'Target'
  | 'CalendarRange'
  | 'LineChart'
  | 'RotateCcw'
  | 'Scale'
  | 'DoorOpen'
  | 'HeartHandshake'
  | 'Radio';

export interface PluginManifest {
  id: string;
  nameFa: string;
  shortNameFa: string;
  descriptionFa: string;
  version: string;
  phase: PluginPhase;
  category: PluginCategory;
  categoryLabelFa: string;
  iconName: PluginIconName;
  isCore: boolean;
  defaultEnabled: boolean;
  dependencies?: string[];
  route: string; // e.g., '/student-attendance'
  allowedRoles: RoleId[];
  dataStores: CollectionName[];
  implemented: boolean; // true for Phase 1 operational plugins & core, false for roadmap Phases 2-6
  component?: React.ComponentType;
  dashboardWidget?: React.ComponentType;
}

export interface PluginRuntimeStatus {
  manifest: PluginManifest;
  installed: boolean;
  enabled: boolean;
  preservedRecordCount: number;
  blockedByDisabledDependencies: PluginManifest[];
  activeDependents: PluginManifest[];
}
