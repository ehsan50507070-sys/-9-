import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDefaultRoleGovernanceConfigs,
  buildFullLabelCatalog,
  clampLoginBackgroundConfig,
  createNewComplexBundle,
  createNewSchoolBundle,
  DEFAULT_COMPLEX_ID,
  evaluateModulePermission,
  generatePhase8ASeedData,
  getVisibleSchoolsForSession,
  resolveGlobalLabel,
} from './superAdminHelpers';
import { PLUGIN_REGISTRY } from '../plugins/registry';
import {
  authenticateUserAsync,
  COMPLEX_ADMIN_SCOPE,
  SUPER_ADMIN_SCOPE,
} from '../auth/authService';
import { generateSeedDataset } from '../data/seedData';
import { clearFailedLoginAttempts } from '../security/securityGuard';
import type { AuthSession, ManagedAdminAccount } from '../../types/domain';

describe('Phase 8A & Layer-1 Super Admin Governance & Dynamic Multi-Complex Helpers', () => {
  it('evaluates granular permissions dynamically, keeps addons exclusive to super_admin, and keeps super_admin unrestricted', () => {
    const configs = buildDefaultRoleGovernanceConfigs(PLUGIN_REGISTRY);
    assert.equal(configs.length, 6, 'Should generate configs for all 6 manageable roles');

    // By default principal can view and create in finance
    assert.equal(
      evaluateModulePermission({
        role: 'principal',
        moduleId: 'finance',
        action: 'view',
        configs,
        manifests: PLUGIN_REGISTRY,
      }),
      true
    );
    assert.equal(
      evaluateModulePermission({
        role: 'principal',
        moduleId: 'finance',
        action: 'create',
        configs,
        manifests: PLUGIN_REGISTRY,
      }),
      true
    );

    // Addons plugin management is exclusively restricted to super_admin
    assert.equal(
      evaluateModulePermission({
        role: 'principal',
        moduleId: 'addons',
        action: 'view',
        configs,
        manifests: PLUGIN_REGISTRY,
      }),
      false
    );
    assert.equal(
      evaluateModulePermission({
        role: 'complex_admin',
        moduleId: 'addons',
        action: 'view',
        configs,
        manifests: PLUGIN_REGISTRY,
      }),
      false
    );
    assert.equal(
      evaluateModulePermission({
        role: 'super_admin',
        moduleId: 'addons',
        action: 'edit',
        configs,
        manifests: PLUGIN_REGISTRY,
      }),
      true
    );

    // Revoke view on finance for principal -> both view and create must become false
    const updatedConfigs = configs.map((c) =>
      c.roleId === 'principal'
        ? {
            ...c,
            modulePermissions: {
              ...c.modulePermissions,
              finance: { ...c.modulePermissions.finance, view: false },
            },
          }
        : c
    );

    assert.equal(
      evaluateModulePermission({
        role: 'principal',
        moduleId: 'finance',
        action: 'view',
        configs: updatedConfigs,
        manifests: PLUGIN_REGISTRY,
      }),
      false
    );
    assert.equal(
      evaluateModulePermission({
        role: 'principal',
        moduleId: 'finance',
        action: 'create',
        configs: updatedConfigs,
        manifests: PLUGIN_REGISTRY,
      }),
      false
    );

    // Other roles like complex_admin remain unaffected
    assert.equal(
      evaluateModulePermission({
        role: 'complex_admin',
        moduleId: 'finance',
        action: 'view',
        configs: updatedConfigs,
        manifests: PLUGIN_REGISTRY,
      }),
      true
    );

    // super_admin always has full access; non-super_admin cannot access super-admin module
    assert.equal(
      evaluateModulePermission({
        role: 'super_admin',
        moduleId: 'super-admin',
        action: 'delete',
        configs: updatedConfigs,
        manifests: PLUGIN_REGISTRY,
      }),
      true
    );
    assert.equal(
      evaluateModulePermission({
        role: 'complex_admin',
        moduleId: 'super-admin',
        action: 'view',
        configs: updatedConfigs,
        manifests: PLUGIN_REGISTRY,
      }),
      false
    );
  });

  it('resolves global label overrides cleanly with trim and fallback to school labels or defaults', () => {
    const catalog = buildFullLabelCatalog(PLUGIN_REGISTRY);
    assert.ok(catalog.some((i) => i.key === 'site.name'));
    assert.ok(catalog.some((i) => i.key === 'menu.dashboard'));
    assert.ok(catalog.some((i) => i.key === 'term.student'));
    // site-user-settings must not appear as a standalone page in registry/catalog
    assert.equal(
      catalog.some((i) => i.key === 'menu.site-user-settings'),
      false,
      'site-user-settings should no longer appear in menu catalog'
    );

    assert.equal(
      resolveGlobalLabel({ 'site.name': '  سامانه اختصاصی البرز  ' }, {}, 'site.name', 'پیشفرض'),
      'سامانه اختصاصی البرز'
    );
    assert.equal(
      resolveGlobalLabel({ 'site.name': '   ' }, {}, 'site.name', 'پیشفرض'),
      'پیشفرض'
    );
    assert.equal(
      resolveGlobalLabel({}, { finance: 'امور شهریه' }, 'menu.finance', 'مالی'),
      'امور شهریه'
    );
    assert.equal(
      resolveGlobalLabel({ 'menu.finance': 'مالی سراسری' }, { finance: 'امور شهریه' }, 'menu.finance', 'مالی'),
      'مالی سراسری'
    );
  });

  it('creates isolated new school and complex bundles while enforcing strict complex isolation and zero plaintext passwords', () => {
    const seed = generateSeedDataset();
    assert.equal(seed.schools.length, 3);
    assert.ok(seed.schools.every((s) => s.complexId === DEFAULT_COMPLEX_ID));

    // Official school names verified
    assert.equal(seed.schools[0].name, 'دبستان گلستان راه روشن');
    assert.equal(seed.schools[1].name, 'متوسطه اول گلستان راه روشن');
    assert.equal(seed.schools[2].name, 'متوسطه دوم گلستان راه روشن');

    // Add school-4 inside complex-1
    const newSchoolBundle = createNewSchoolBundle({
      complexId: DEFAULT_COMPLEX_ID,
      name: 'هنرستان گلستان راه روشن',
      gradeLevel: 'high',
      principalFullName: 'آقای کریم رضایی',
      principalUsername: 'principal4',
      principalPassword: 'Pass@4444',
      createPrincipalAccount: true,
      existingSchoolIds: seed.schools.map((s) => s.id),
      activePluginIds: ['gradebook', 'finance'],
    });
    assert.equal(newSchoolBundle.school.id, 'school-4');
    assert.equal(newSchoolBundle.school.complexId, DEFAULT_COMPLEX_ID);
    assert.equal(newSchoolBundle.principalAccount?.username, 'principal4');
    assert.equal(newSchoolBundle.principalAccount?.password, undefined);
    assert.ok(newSchoolBundle.principalAccount?.passwordHash && newSchoolBundle.principalAccount?.passwordSalt);
    assert.equal(newSchoolBundle.pluginStates.length, 2);
    assert.equal(newSchoolBundle.tdSettings.schoolId, 'school-4');

    // Add complex-2 with 1 initial school
    const newComplexBundle = createNewComplexBundle({
      name: 'مجموعه مدارس اندیشه نو',
      adminFullName: 'دکتر مریم احمدی',
      adminUsername: 'complex2',
      adminPassword: 'Pass@2222',
      initialSchools: [{ name: 'دبستان اندیشه نو', gradeLevel: 'middle' }],
      existingComplexIds: [DEFAULT_COMPLEX_ID],
      existingSchoolIds: [...seed.schools.map((s) => s.id), newSchoolBundle.school.id],
      activePluginIds: ['gradebook'],
    });

    assert.equal(newComplexBundle.complex.id, 'complex-2');
    assert.equal(newComplexBundle.adminAccount.complexId, 'complex-2');
    assert.equal(newComplexBundle.adminAccount.password, undefined);
    assert.ok(newComplexBundle.adminAccount.passwordHash && newComplexBundle.adminAccount.passwordSalt);
    assert.equal(newComplexBundle.schools.length, 1);
    assert.equal(newComplexBundle.schools[0].id, 'school-5');
    assert.equal(newComplexBundle.schools[0].complexId, 'complex-2');

    const allSchools = [...seed.schools, newSchoolBundle.school, ...newComplexBundle.schools];

    const superSession: AuthSession = {
      userId: 'user-super-admin',
      username: '09120000001',
      displayName: 'راهبر ارشد',
      role: 'super_admin',
      schoolId: 'school-1',
      isComplexWide: true,
      isSuperAdmin: true,
      loggedInAt: new Date().toISOString(),
    };
    assert.equal(getVisibleSchoolsForSession(superSession, allSchools).length, 5);

    const complex1Session: AuthSession = {
      userId: 'user-complex-admin',
      username: '09120000002',
      displayName: 'مدیر کل ۱',
      role: 'complex_admin',
      schoolId: 'school-1',
      complexId: DEFAULT_COMPLEX_ID,
      isComplexWide: true,
      loggedInAt: new Date().toISOString(),
    };
    const visibleC1 = getVisibleSchoolsForSession(complex1Session, allSchools);
    assert.deepEqual(
      visibleC1.map((s) => s.id),
      ['school-1', 'school-2', 'school-3', 'school-4']
    );

    const complex2Session: AuthSession = {
      userId: newComplexBundle.adminAccount.id,
      username: 'complex2',
      displayName: 'دکتر مریم احمدی',
      role: 'complex_admin',
      schoolId: 'school-5',
      complexId: 'complex-2',
      isComplexWide: true,
      loggedInAt: new Date().toISOString(),
    };
    const visibleC2 = getVisibleSchoolsForSession(complex2Session, allSchools);
    assert.deepEqual(
      visibleC2.map((s) => s.id),
      ['school-5']
    );
  });

  it('authenticates against live managed admin accounts including updates, suspension, and new complexes', async () => {
    const seed = generateSeedDataset();
    const p8 = generatePhase8ASeedData({ schools: seed.schools, manifests: PLUGIN_REGISTRY });

    const newComplexBundle = createNewComplexBundle({
      name: 'مجموعه علم و هنر',
      adminFullName: 'مدیر کل علم و هنر',
      adminUsername: 'elmadm',
      adminPassword: 'Elm@7890',
      initialSchools: [{ name: 'دبیرستان علم و هنر', gradeLevel: 'high' }],
      existingComplexIds: [DEFAULT_COMPLEX_ID],
      existingSchoolIds: seed.schools.map((s) => s.id),
      activePluginIds: [],
    });

    const allSchools = [...seed.schools, ...newComplexBundle.schools];
    const accounts: ManagedAdminAccount[] = [
      ...p8.managed_admin_accounts.map((a) =>
        a.username === '09120000102' ? { ...a, isActive: false } : a
      ),
      newComplexBundle.adminAccount,
    ];

    // 1. Super Admin login succeeds with mandatory first-login password change
    clearFailedLoginAttempts('09120000001');
    const resSuper = await authenticateUserAsync(
      { selectedScope: SUPER_ADMIN_SCOPE, roleGroup: 'management', username: '09120000001', password: 'Admin@1404' },
      allSchools,
      seed.students,
      seed.teachers,
      accounts
    );
    assert.equal(resSuper.ok, true);
    assert.equal(resSuper.session?.role, 'super_admin');
    assert.equal(resSuper.session?.isSuperAdmin, true);
    assert.equal(resSuper.session?.mustChangePassword, true);

    // 2. Suspended account rejected with clear Persian message
    clearFailedLoginAttempts('09120000102');
    const resSuspended = await authenticateUserAsync(
      { selectedScope: 'school-1', roleGroup: 'management', username: '09120000102', password: 'Moaven@1405' },
      allSchools,
      seed.students,
      seed.teachers,
      accounts
    );
    assert.equal(resSuspended.ok, false);
    assert.match(resSuspended.errorFa ?? '', /غیرفعال|معلق/);

    // 3. Complex 2 admin can log into COMPLEX_ADMIN_SCOPE and lands on complex-2 school
    clearFailedLoginAttempts('elmadm');
    const resC2 = await authenticateUserAsync(
      { selectedScope: COMPLEX_ADMIN_SCOPE, roleGroup: 'management', username: 'elmadm', password: 'Elm@7890' },
      allSchools,
      seed.students,
      seed.teachers,
      accounts
    );
    assert.equal(resC2.ok, true);
    assert.equal(resC2.session?.complexId, 'complex-2');
    assert.equal(resC2.session?.schoolId, 'school-4');

    // 4. Complex 2 admin CANNOT log into school-1 (belongs to complex-1)
    clearFailedLoginAttempts('elmadm');
    const resC2Cross = await authenticateUserAsync(
      { selectedScope: 'school-1', roleGroup: 'management', username: 'elmadm', password: 'Elm@7890' },
      allSchools,
      seed.students,
      seed.teachers,
      accounts
    );
    assert.equal(resC2Cross.ok, false);
  });

  it('clamps login background blur (0..20) and overlay opacity (0..80) safely', () => {
    const clampedHigh = clampLoginBackgroundConfig({ blurPx: 99, overlayOpacity: 150, overlayTone: 'dark' });
    assert.equal(clampedHigh.blurPx, 20);
    assert.equal(clampedHigh.overlayOpacity, 80);
    assert.equal(clampedHigh.overlayTone, 'dark');

    const clampedLow = clampLoginBackgroundConfig({ blurPx: -10, overlayOpacity: -5 });
    assert.equal(clampedLow.blurPx, 0);
    assert.equal(clampedLow.overlayOpacity, 0);
  });
});
