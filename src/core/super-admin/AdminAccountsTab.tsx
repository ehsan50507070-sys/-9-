// Tab 3: Admin Accounts CRUD, Live Impersonation Preview & Jalali Audit Log (Phase 8A Super Admin Governance)
import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Edit3,
  Eye,
  KeyRound,
  Power,
  ShieldAlert,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { toPersianDigits } from '../../lib/digits';
import { getTodayJalali } from '../../lib/jalali';
import type {
  ManageableRoleId,
  ManagedAdminAccount,
  ManagedAdminRole,
  SuperAdminAuditCategory,
} from '../../types/domain';
import { MANAGEABLE_ROLES, ROLE_DEFINITIONS } from '../auth/rbac';
import { useSchoolData } from '../data/DataContext';
import { containsPersianLetters } from '../security/sanitize';
import { GLOBAL_TENANT_ID } from './superAdminHelpers';

const AUDIT_CATEGORY_LABELS: Record<SuperAdminAuditCategory, string> = {
  permissions: 'دسترسی‌ها',
  labels: 'واژگان و منوها',
  accounts: 'حساب‌های مدیریتی',
  complex_school: 'مجموعه‌ها و مدارس',
  login_studio: 'صفحه ورود',
  impersonation: 'پیش‌نمایش نقش',
};

export const AdminAccountsTab: React.FC = () => {
  const {
    allSchools,
    educationalComplexes,
    managedAdminAccounts,
    superAdminAuditLogs,
    upsertManagedAdminAccount,
    deleteManagedAdminAccount,
    toggleManagedAdminAccountActive,
    startImpersonation,
  } = useSchoolData();

  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [auditFilter, setAuditFilter] = useState<string>('all');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  // Create / Edit Modal state
  const [editingAccount, setEditingAccount] = useState<ManagedAdminAccount | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Quick Impersonation Picker state
  const [previewRole, setPreviewRole] = useState<ManageableRoleId>('principal');
  const [previewSchoolId, setPreviewSchoolId] = useState<string>(allSchools[0]?.id ?? 'school-1');

  const filteredAccounts = useMemo(() => {
    return managedAdminAccounts.filter((a) =>
      roleFilter === 'all' ? true : a.role === roleFilter
    );
  }, [managedAdminAccounts, roleFilter]);

  const filteredAuditLogs = useMemo(() => {
    return superAdminAuditLogs
      .filter((log) => (auditFilter === 'all' ? true : log.category === auditFilter))
      .slice(0, 30);
  }, [superAdminAuditLogs, auditFilter]);

  const openNewAccountModal = () => {
    const nowIso = new Date().toISOString();
    setEditingAccount({
      id: `acct-${Date.now()}`,
      schoolId: allSchools[0]?.id ?? 'school-1',
      complexId: educationalComplexes[0]?.id ?? 'complex-1',
      role: 'principal',
      fullName: '',
      username: '',
      password: '',
      isActive: true,
      createdAtJalali: getTodayJalali(),
      updatedAt: nowIso,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (acc: ManagedAdminAccount) => {
    setEditingAccount({ ...acc, password: '' });
    setIsModalOpen(true);
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    const res = upsertManagedAdminAccount(editingAccount);
    if (res.ok) {
      setIsModalOpen(false);
      setEditingAccount(null);
      setFeedback({ ok: true, text: 'اطلاعات حساب مدیریتی با موفقیت ذخیره و فعال شد.' });
      setTimeout(() => setFeedback(null), 3500);
    } else {
      setFeedback({ ok: false, text: res.errorFa ?? 'خطا در ذخیره حساب کاربری.' });
    }
  };

  const handleStartRolePreview = () => {
    const schoolObj = allSchools.find((s) => s.id === previewSchoolId) ?? allSchools[0];
    const roleLabel = ROLE_DEFINITIONS[previewRole].labelFa;
    startImpersonation({
      targetRole: previewRole,
      targetDisplayName: `${roleLabel} — ${schoolObj?.name ?? ''}`,
      targetSchoolId: schoolObj?.id,
      targetComplexId: schoolObj?.complexId ?? 'complex-1',
    });
  };

  const handleImpersonateAccount = (acc: ManagedAdminAccount) => {
    if (acc.role === 'super_admin') return;
    startImpersonation({
      targetRole: acc.role,
      targetUserId: acc.id,
      targetDisplayName: acc.fullName,
      targetSchoolId: acc.schoolId !== GLOBAL_TENANT_ID ? acc.schoolId : undefined,
      targetComplexId: acc.complexId,
    });
  };

  const resolveScopeLabel = (acc: ManagedAdminAccount): string => {
    if (acc.role === 'super_admin') return 'کل سامانه (همه مجموعه‌ها)';
    if (acc.role === 'complex_admin') {
      const c = educationalComplexes.find((x) => x.id === acc.complexId);
      return c ? `مجموعه: ${c.name}` : 'مجموعه پیشفرض';
    }
    const s = allSchools.find((x) => x.id === acc.schoolId);
    return s ? s.name : acc.schoolId ?? '—';
  };

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          role="status"
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold ${
            feedback.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300'
          }`}
        >
          {feedback.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <ShieldAlert className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Quick Role Impersonation Preview Strip */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center gap-2">
          <Eye className="h-4 w-4 brand-text" />
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              پیش‌نمایش زنده سامانه با دید هر نقش (Impersonation Preview)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              بدون خروج از حساب راهبر ارشد، سامانه را دقیقاً با منوها و دسترسی‌های هر نقش و مدرسه بررسی کنید.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">
              نقش هدف
            </label>
            <select
              data-testid="impersonation-role-select"
              value={previewRole}
              onChange={(e) => setPreviewRole(e.target.value as ManageableRoleId)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {MANAGEABLE_ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.labelFa}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">
              واحد آموزشی (مدرسه)
            </label>
            <select
              data-testid="impersonation-school-select"
              value={previewSchoolId}
              onChange={(e) => setPreviewSchoolId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {allSchools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            data-testid="start-impersonation-btn"
            onClick={handleStartRolePreview}
            className="brand-btn inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold"
          >
            <Eye className="h-4 w-4" />
            <span>مشاهده با دید این نقش</span>
          </button>
        </div>
      </div>

      {/* Managed Admin Accounts Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 brand-text" />
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              حساب‌های مدیریتی و کلیدی ({toPersianDigits(filteredAccounts.length)} حساب)
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">همه نقش‌های مدیریتی</option>
              <option value="super_admin">راهبر ارشد سامانه</option>
              <option value="complex_admin">مدیر کل مجموعه</option>
              <option value="principal">مدیر مدرسه</option>
              <option value="deputy">معاون اجرایی</option>
              <option value="counselor">مشاور مدرسه</option>
            </select>
            <button
              type="button"
              data-testid="add-admin-account-btn"
              onClick={openNewAccountModal}
              className="brand-btn inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>افزودن حساب مدیریتی</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                <th className="px-3 py-2.5 font-extrabold">نام و نام خانوادگی</th>
                <th className="px-2.5 py-2.5 font-extrabold">نقش</th>
                <th className="px-2.5 py-2.5 font-extrabold">محدوده انتساب</th>
                <th className="px-2.5 py-2.5 font-extrabold">نام کاربری</th>
                <th className="px-2.5 py-2.5 font-extrabold">وضعیت</th>
                <th className="px-2.5 py-2.5 text-center font-extrabold">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredAccounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white">
                    {acc.fullName}
                  </td>
                  <td className="px-2.5 py-2.5 text-slate-700 dark:text-slate-200">
                    {ROLE_DEFINITIONS[acc.role].labelFa}
                  </td>
                  <td className="px-2.5 py-2.5 text-slate-600 dark:text-slate-300">
                    {resolveScopeLabel(acc)}
                  </td>
                  <td className="px-2.5 py-2.5 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200" dir="ltr">
                    {acc.username}
                  </td>
                  <td className="px-2.5 py-2.5">
                    <span
                      className={`inline-block rounded-lg px-2 py-0.5 text-[11px] font-bold ${
                        acc.isActive
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                      }`}
                    >
                      {acc.isActive ? 'فعال' : 'معلق'}
                    </span>
                  </td>
                  <td className="px-2.5 py-2.5">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        title="ویرایش و تغییر رمز"
                        onClick={() => openEditModal(acc)}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title={acc.isActive ? 'تعلیق حساب' : 'فعال‌سازی حساب'}
                        onClick={() => {
                          const r = toggleManagedAdminAccountActive(acc.id);
                          if (!r.ok && r.errorFa) setFeedback({ ok: false, text: r.errorFa });
                        }}
                        className="rounded-lg border border-slate-200 p-1.5 text-amber-600 hover:bg-amber-50 dark:border-slate-700 dark:text-amber-400 dark:hover:bg-slate-800"
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                      {acc.role !== 'super_admin' && (
                        <button
                          type="button"
                          title="مشاهده سامانه با دید این کاربر"
                          onClick={() => handleImpersonateAccount(acc)}
                          className="rounded-lg border border-slate-200 p-1.5 text-sky-600 hover:bg-sky-50 dark:border-slate-700 dark:text-sky-400 dark:hover:bg-slate-800"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {acc.role !== 'super_admin' && (
                        <button
                          type="button"
                          title="حذف حساب"
                          onClick={() => {
                            const r = deleteManagedAdminAccount(acc.id);
                            if (!r.ok && r.errorFa) setFeedback({ ok: false, text: r.errorFa });
                          }}
                          className="rounded-lg border border-slate-200 p-1.5 text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:text-rose-400 dark:hover:bg-slate-800"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Jalali Audit Log */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 brand-text" />
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              گزارش ممیزی تغییرات راهبر ارشد (تاریخ شمسی)
            </h3>
          </div>
          <select
            value={auditFilter}
            onChange={(e) => setAuditFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="all">همه دسته‌ها</option>
            {Object.entries(AUDIT_CATEGORY_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {filteredAuditLogs.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">
            هنوز رویداد ممیزی در این دسته ثبت نشده است.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredAuditLogs.map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs"
              >
                <div>
                  <span className="ml-2 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {AUDIT_CATEGORY_LABELS[log.category]}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">{log.summaryFa}</span>
                  {log.detailsFa && (
                    <span className="mr-2 text-[11px] text-slate-500 dark:text-slate-400">
                      — {log.detailsFa}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                  {toPersianDigits(log.timestampJalali)} | {log.actorName}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                {managedAdminAccounts.some((a) => a.id === editingAccount.id)
                  ? 'ویرایش حساب مدیریتی'
                  : 'تعریف حساب مدیریتی جدید'}
              </h4>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">
                  نام و نام خانوادگی
                </label>
                <input
                  type="text"
                  required
                  value={editingAccount.fullName}
                  onChange={(e) =>
                    setEditingAccount((p) => (p ? { ...p, fullName: e.target.value } : p))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">
                  نقش مدیریتی
                </label>
                <select
                  value={editingAccount.role}
                  onChange={(e) =>
                    setEditingAccount((p) =>
                      p ? { ...p, role: e.target.value as ManagedAdminRole } : p
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="super_admin">راهبر ارشد سامانه</option>
                  <option value="complex_admin">مدیر کل مجموعه</option>
                  <option value="principal">مدیر مدرسه</option>
                  <option value="deputy">معاون اجرایی</option>
                  <option value="counselor">مشاور مدرسه</option>
                </select>
              </div>

              {editingAccount.role === 'complex_admin' && (
                <div>
                  <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">
                    مجموعه آموزشی منتسب
                  </label>
                  <select
                    value={editingAccount.complexId ?? educationalComplexes[0]?.id ?? 'complex-1'}
                    onChange={(e) =>
                      setEditingAccount((p) =>
                        p ? { ...p, complexId: e.target.value, schoolId: GLOBAL_TENANT_ID } : p
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {educationalComplexes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(editingAccount.role === 'principal' ||
                editingAccount.role === 'deputy' ||
                editingAccount.role === 'counselor') && (
                <div>
                  <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">
                    مدرسه منتسب
                  </label>
                  <select
                    value={
                      editingAccount.schoolId !== GLOBAL_TENANT_ID
                        ? editingAccount.schoolId
                        : (allSchools[0]?.id ?? 'school-1')
                    }
                    onChange={(e) => {
                      const sObj = allSchools.find((s) => s.id === e.target.value);
                      setEditingAccount((p) =>
                        p
                          ? {
                              ...p,
                              schoolId: e.target.value,
                              complexId: sObj?.complexId ?? 'complex-1',
                            }
                          : p
                      );
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {allSchools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">
                    نام کاربری (انگلیسی یا عدد)
                  </label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={editingAccount.username}
                    onChange={(e) =>
                      setEditingAccount((p) => (p ? { ...p, username: e.target.value } : p))
                    }
                    placeholder="مثلاً 09120001001 یا admin1"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  {containsPersianLetters(editingAccount.username) && (
                    <p className="mt-1 text-[10px] font-bold text-rose-600">
                      حروف فارسی در نام کاربری مجاز نیست.
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">
                    {managedAdminAccounts.some((a) => a.id === editingAccount.id)
                      ? 'رمز عبور جدید (اختیاری)'
                      : 'رمز عبور اولیه (حداقل ۸ کاراکتر، حرف و عدد)'}
                  </label>
                  <input
                    type="password"
                    required={!managedAdminAccounts.some((a) => a.id === editingAccount.id)}
                    dir="ltr"
                    value={editingAccount.password ?? ''}
                    onChange={(e) =>
                      setEditingAccount((p) => (p ? { ...p, password: e.target.value } : p))
                    }
                    placeholder={
                      managedAdminAccounts.some((a) => a.id === editingAccount.id)
                        ? 'برای حفظ رمز فعلی خالی بگذارید'
                        : 'مثلاً School@1405'
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="brand-btn rounded-xl px-4 py-2 font-bold"
                >
                  ذخیره حساب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
