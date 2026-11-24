// Granular Live Permission Hook (Phase 8A Super Admin Role & Permission Governance)
import { useMemo } from 'react';
import type { PermissionAction } from '../../types/domain';
import { useSchoolData } from '../data/DataContext';
import { PLUGIN_REGISTRY } from '../plugins/registry';
import { evaluateModulePermission } from './superAdminHelpers';

/**
 * Evaluates whether the active role (real or impersonated) has permission to perform
 * `action` (`view`, `create`, `edit`, `delete`, `export`) on `moduleId`.
 */
export function usePermission(moduleId: string, action: PermissionAction): boolean {
  const { activeRole, roleGovernanceConfigs } = useSchoolData();

  return useMemo(
    () =>
      evaluateModulePermission({
        role: activeRole,
        moduleId,
        action,
        configs: roleGovernanceConfigs,
        manifests: PLUGIN_REGISTRY,
      }),
    [activeRole, moduleId, action, roleGovernanceConfigs]
  );
}

/**
 * Returns a convenient boolean capability object for a given moduleId.
 */
export function useModulePermissions(moduleId: string): Record<PermissionAction, boolean> {
  const { activeRole, roleGovernanceConfigs } = useSchoolData();

  return useMemo(
    () => ({
      view: evaluateModulePermission({
        role: activeRole,
        moduleId,
        action: 'view',
        configs: roleGovernanceConfigs,
        manifests: PLUGIN_REGISTRY,
      }),
      create: evaluateModulePermission({
        role: activeRole,
        moduleId,
        action: 'create',
        configs: roleGovernanceConfigs,
        manifests: PLUGIN_REGISTRY,
      }),
      edit: evaluateModulePermission({
        role: activeRole,
        moduleId,
        action: 'edit',
        configs: roleGovernanceConfigs,
        manifests: PLUGIN_REGISTRY,
      }),
      delete: evaluateModulePermission({
        role: activeRole,
        moduleId,
        action: 'delete',
        configs: roleGovernanceConfigs,
        manifests: PLUGIN_REGISTRY,
      }),
      export: evaluateModulePermission({
        role: activeRole,
        moduleId,
        action: 'export',
        configs: roleGovernanceConfigs,
        manifests: PLUGIN_REGISTRY,
      }),
    }),
    [activeRole, moduleId, roleGovernanceConfigs]
  );
}
