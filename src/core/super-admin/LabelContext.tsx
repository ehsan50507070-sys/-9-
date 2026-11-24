// Centralized Reactive Label & Terminology Provider (Phase 8A Super Admin Governance)
import React, { createContext, useCallback, useContext, useMemo } from 'react';
import type { RoleId } from '../../types/domain';
import { useSchoolData } from '../data/DataContext';
import { resolveGlobalLabel, resolveRoleDisplayMeta } from './superAdminHelpers';

interface LabelContextValue {
  labels: Record<string, string>;
  getLabel: (key: string, defaultText: string) => string;
  getRoleMeta: (roleId: RoleId) => { labelFa: string; shortLabelFa: string; descriptionFa: string };
}

const LabelContext = createContext<LabelContextValue | null>(null);

export const LabelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { globalSystemConfig, roleGovernanceConfigs } = useSchoolData();

  const labels = useMemo(() => globalSystemConfig?.labels ?? {}, [globalSystemConfig]);

  const getLabel = useCallback(
    (key: string, defaultText: string) => resolveGlobalLabel(labels, null, key, defaultText),
    [labels]
  );

  const getRoleMeta = useCallback(
    (roleId: RoleId) => resolveRoleDisplayMeta(roleId, roleGovernanceConfigs),
    [roleGovernanceConfigs]
  );

  const value = useMemo<LabelContextValue>(
    () => ({
      labels,
      getLabel,
      getRoleMeta,
    }),
    [labels, getLabel, getRoleMeta]
  );

  return <LabelContext.Provider value={value}>{children}</LabelContext.Provider>;
};

export function useLabelContext(): LabelContextValue {
  const ctx = useContext(LabelContext);
  if (!ctx) {
    throw new Error('useLabelContext must be used inside LabelProvider');
  }
  return ctx;
}

/**
 * Resolves a reactive global label/terminology override set by Super Admin.
 */
export function useLabel(key: string, defaultText: string): string {
  const { getLabel } = useLabelContext();
  return getLabel(key, defaultText);
}

/**
 * Resolves the active Persian role title, short title, and description (live-editable by Super Admin).
 */
export function useRoleLabel(roleId: RoleId): {
  labelFa: string;
  shortLabelFa: string;
  descriptionFa: string;
} {
  const { getRoleMeta } = useLabelContext();
  return getRoleMeta(roleId);
}
