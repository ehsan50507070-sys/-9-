// Phase 9-C Comprehensive Unit Tests: Discipline, Leave/Exit, Confidential Counseling & Virtual Class Hub
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDisciplineTrendPoints,
  calculateStudentDisciplineScore,
  filterVisibleDisciplineRecords,
} from './disciplineService';
import {
  computeDurationHoursFromRange,
  computeStaffLeaveSummary,
  generateExitTrackingCode,
} from './leaveExitService';
import {
  canEditClinicalLayer1,
  canViewClinicalLayer1,
  filterCounselingSessionsForRole,
  getDueCounselingFollowUps,
} from './counselingService';
import {
  computeVirtualClassLiveStatus,
  validateVirtualClassUrl,
} from './virtualClassService';
import { authorizeMutation, type AuthGuardContext } from '../../core/auth/policy';
import { dateToJalaliString } from '../../lib/jalali';
import type {
  AuthSession,
  CounselingClinicalNote,
  CounselingSession,
  DisciplinePledge,
  DisciplineRecord,
  RoleId,
  StaffLeaveRequest,
  StudentExitPass,
  VirtualClassAttendance,
} from '../../types/domain';

const baseMeta = {
  complexId: 'complex-1',
  schoolId: 'school-1',
  academicYearId: '1405-1406',
  createdAtIso: '2026-01-01T08:00:00.000Z',
  updatedAtIso: '2026-01-01T08:00:00.000Z',
};

describe('Phase 9-C — Discipline Score, Trend & Visibility', () => {
  const sampleRecords: DisciplineRecord[] = [
    {
      ...baseMeta,
      id: 'd-1',
      studentId: 'st-1',
      classId: 'cls-1',
      kind: 'infraction',
      severity: 'critical',
      category: 'بی‌نظمی',
      title: 'بی‌نظمی شدید',
      description: '',
      jalaliDate: '1405/08/01',
      pointsDelta: 3,
      visibleToParentStudent: true,
      recordedByUserId: 'u-dep',
      recordedByName: 'معاون',
      recordedByRole: 'deputy',
    },
    {
      ...baseMeta,
      id: 'd-2',
      studentId: 'st-1',
      classId: 'cls-1',
      kind: 'reward',
      severity: 'minor',
      category: 'همکاری',
      title: 'همکاری ممتاز',
      description: '',
      jalaliDate: '1405/08/05',
      pointsDelta: 1.5,
      visibleToParentStudent: true,
      recordedByUserId: 'u-t1',
      recordedByName: 'معلم',
      recordedByRole: 'teacher',
    },
    {
      ...baseMeta,
      id: 'd-3',
      studentId: 'st-1',
      classId: 'cls-1',
      kind: 'infraction',
      severity: 'minor',
      category: 'یادداشت داخلی',
      title: 'تذکر داخلی کادر',
      description: '',
      jalaliDate: '1405/08/07',
      pointsDelta: 0.5,
      visibleToParentStudent: false,
      recordedByUserId: 'u-dep',
      recordedByName: 'معاون',
      recordedByRole: 'deputy',
    },
  ];

  it('calculates discipline score from base 20 clamped to [0, 20]', () => {
    const summary = calculateStudentDisciplineScore(sampleRecords, 'st-1');
    assert.equal(summary.finalScore, 18); // 20 - 3 + 1.5 - 0.5 = 18
    assert.equal(summary.rewardCount, 1);
    assert.equal(summary.infractionCount, 2);
    assert.equal(summary.criticalCount, 1);

    // Overflow clamp to 20
    const highReward: DisciplineRecord[] = [
      { ...sampleRecords[1], pointsDelta: 5 },
    ];
    assert.equal(calculateStudentDisciplineScore(highReward, 'st-1').finalScore, 20);

    // Underflow clamp to 0
    const heavyInfraction: DisciplineRecord[] = [
      { ...sampleRecords[0], pointsDelta: 35 },
    ];
    assert.equal(calculateStudentDisciplineScore(heavyInfraction, 'st-1').finalScore, 0);
  });

  it('builds chronological trend points starting from base 20', () => {
    const pts = buildDisciplineTrendPoints(sampleRecords, 'st-1');
    assert.equal(pts.length, 4);
    assert.equal(pts[0].score, 20);
    assert.equal(pts[1].score, 17);
    assert.equal(pts[2].score, 18.5);
    assert.equal(pts[3].score, 18);
  });

  it('filters hidden staff-only records away from parent and student roles', () => {
    const parentView = filterVisibleDisciplineRecords({
      records: sampleRecords,
      role: 'parent',
      linkedStudentId: 'st-1',
    });
    assert.equal(parentView.length, 2);
    assert.ok(parentView.every((r) => r.visibleToParentStudent));

    const otherParentView = filterVisibleDisciplineRecords({
      records: sampleRecords,
      role: 'parent',
      linkedStudentId: 'st-999',
    });
    assert.equal(otherParentView.length, 0);
  });
});

describe('Phase 9-C — Leave & Student Exit Pass Calculations', () => {
  it('generates deterministic tracking code and computes hourly duration', () => {
    assert.equal(generateExitTrackingCode('1405/08/10', 1234), 'EX-1405-2234');
    assert.equal(computeDurationHoursFromRange('09:30', '12:00'), 2.5);
    assert.equal(computeDurationHoursFromRange('12:00', '09:30'), 0);
  });

  it('computes cumulative approved hourly and daily leave for a staff member', () => {
    const reqs: StaffLeaveRequest[] = [
      {
        ...baseMeta,
        id: 'l-1',
        staffUserId: 'u-t1',
        staffName: 'معلم ۱',
        staffRole: 'teacher',
        leaveType: 'hourly',
        jalaliDate: '1405/08/01',
        startTimeHm: '10:00',
        endTimeHm: '12:30',
        durationHours: 2.5,
        reason: 'اداری',
        status: 'approved',
      },
      {
        ...baseMeta,
        id: 'l-2',
        staffUserId: 'u-t1',
        staffName: 'معلم ۱',
        staffRole: 'teacher',
        leaveType: 'daily',
        jalaliDate: '1405/08/03',
        reason: 'استحقاقی',
        status: 'approved',
      },
      {
        ...baseMeta,
        id: 'l-3',
        staffUserId: 'u-t1',
        staffName: 'معلم ۱',
        staffRole: 'teacher',
        leaveType: 'hourly',
        jalaliDate: '1405/08/06',
        durationHours: 3,
        reason: 'در انتظار',
        status: 'pending',
      },
    ];
    const sum = computeStaffLeaveSummary(reqs, 'u-t1', '1405-1406');
    assert.equal(sum.approvedDailyDays, 1);
    assert.equal(sum.approvedHourlyHours, 2.5);
    assert.equal(sum.pendingCount, 1);
  });
});

describe('Phase 9-C — Strict Two-Layer Counseling Confidentiality', () => {
  it('restricts Layer-1 clinical notes strictly to counselor, super_admin, and audited principal', () => {
    assert.equal(canViewClinicalLayer1('counselor', 'school-1', []).allowed, true);
    assert.equal(canViewClinicalLayer1('super_admin', 'school-1', []).allowed, true);
    assert.equal(canEditClinicalLayer1('counselor'), true);
    assert.equal(canEditClinicalLayer1('principal'), false);

    // Principal denied by default
    assert.equal(canViewClinicalLayer1('principal', 'school-1', []).allowed, false);
    // Principal allowed ONLY for granted school in read-only audit mode
    const audited = canViewClinicalLayer1('principal', 'school-1', ['school-1']);
    assert.equal(audited.allowed, true);
    assert.equal(audited.mode, 'principal_audit');
    assert.equal(canViewClinicalLayer1('principal', 'school-2', ['school-1']).allowed, false);

    // Zero access for teacher, deputy, parent, student, complex_admin
    for (const role of ['teacher', 'deputy', 'parent', 'student', 'complex_admin'] as const) {
      assert.equal(canViewClinicalLayer1(role, 'school-1', ['school-1']).allowed, false);
      assert.equal(canEditClinicalLayer1(role), false);
    }
  });

  it('independently gates Layer-2 shared advice for parent vs teacher and detects due follow-ups', () => {
    const sessions: CounselingSession[] = [
      {
        ...baseMeta,
        id: 'c-1',
        studentId: 'st-1',
        classId: 'cls-1',
        jalaliDate: '1405/08/10',
        timeHm: '09:30',
        mode: 'in_person',
        status: 'completed',
        requestedByRole: 'teacher',
        requestedByName: 'معلم ۱',
        isReferral: true,
        referredByUserId: 'u-t1',
        sharedAdviceText: 'توصیه فقط برای ولی',
        shareWithParent: true,
        shareWithTeacher: false,
        followUpDateJalali: '1405/08/15',
      },
    ];

    const parentView = filterCounselingSessionsForRole({
      sessions,
      role: 'parent',
      userId: 'u-p1',
      linkedStudentId: 'st-1',
    });
    assert.equal(parentView.length, 1);
    assert.equal(parentView[0].canSeeSharedAdvice, true);
    assert.equal(parentView[0].sharedAdviceText, 'توصیه فقط برای ولی');

    const teacherView = filterCounselingSessionsForRole({
      sessions,
      role: 'teacher',
      userId: 'u-t1',
      teacherAssignedClassIds: ['cls-1'],
    });
    assert.equal(teacherView.length, 1);
    assert.equal(teacherView[0].canSeeSharedAdvice, false);
    assert.equal(teacherView[0].sharedAdviceText, undefined);

    const dueToday = getDueCounselingFollowUps(sessions, '1405/08/15');
    assert.equal(dueToday.length, 1);
    assert.equal(dueToday[0].isToday, true);
  });
});

describe('Phase 9-C — Virtual Class Hub URL Validation & Live Status Engine', () => {
  it('validates safe https/http URLs and rejects unsafe schemes', () => {
    assert.equal(validateVirtualClassUrl('https://www.skyroom.online/ch/test').valid, true);
    assert.equal(validateVirtualClassUrl('javascript:alert(1)').valid, false);
    assert.equal(validateVirtualClassUrl('not-a-url').valid, false);
  });

  it('computes live, soon, scheduled, and ended statuses accurately', () => {
    const now = new Date(2026, 9, 25, 10, 15, 0); // 10:15
    const today = dateToJalaliString(now);

    assert.equal(
      computeVirtualClassLiveStatus(
        { jalaliDate: today, startTimeHm: '10:00', durationMinutes: 45 },
        now
      ),
      'live'
    );
    assert.equal(
      computeVirtualClassLiveStatus(
        { jalaliDate: today, startTimeHm: '10:35', durationMinutes: 45 },
        now
      ),
      'soon'
    );
    assert.equal(
      computeVirtualClassLiveStatus(
        { jalaliDate: today, startTimeHm: '13:00', durationMinutes: 45 },
        now
      ),
      'scheduled'
    );
    assert.equal(
      computeVirtualClassLiveStatus(
        { jalaliDate: today, startTimeHm: '08:00', durationMinutes: 45 },
        now
      ),
      'ended'
    );
  });
});

describe('Phase 9-C — RBAC Policy Enforcement (authorizeMutation)', () => {
  const makeCtx = (
    role: RoleId,
    extra?: Partial<AuthSession>
  ): AuthGuardContext => ({
    session: {
      userId: `u-${role}`,
      username: '09120000001',
      displayName: role,
      role,
      schoolId: 'school-1',
      isComplexWide: role === 'complex_admin' || role === 'super_admin',
      loggedInAt: '2026-01-01T08:00:00.000Z',
      ...extra,
    },
    teacherAssignedClassIds: ['cls-1'],
  });

  const sampleNote: CounselingClinicalNote = {
    ...baseMeta,
    id: 'cn-1',
    sessionId: 'c-1',
    studentId: 'st-1',
    counselorUserId: 'u-counselor',
    counselorName: 'مشاور',
    clinicalSummary: 'محرمانه',
    riskLevel: 'low',
    lastUpdatedAtJalali: '1405/08/10',
  };

  it('allows counselor to write clinical notes and denies teacher, deputy, principal, parent, student', () => {
    assert.equal(
      authorizeMutation(makeCtx('counselor'), 'counseling_clinical_notes', 'write', {
        schoolId: 'school-1',
        record: sampleNote,
      }).allowed,
      true
    );

    for (const role of ['teacher', 'deputy', 'principal', 'parent', 'student'] as const) {
      const res = authorizeMutation(makeCtx(role), 'counseling_clinical_notes', 'write', {
        schoolId: 'school-1',
        record: sampleNote,
      });
      assert.equal(res.allowed, false, `Role ${role} must be denied clinical note write`);
    }
  });

  it('scopes parent pledge signing and exit requests strictly to linkedStudentId', () => {
    const parentCtx = makeCtx('parent', { linkedStudentId: 'st-1' });
    const ownPledge: DisciplinePledge = {
      ...baseMeta,
      id: 'p-1',
      studentId: 'st-1',
      classId: 'cls-1',
      title: 'تعهدنامه',
      bodyText: 'متن',
      issuedAtJalali: '1405/08/01',
      issuedByUserId: 'u-dep',
      issuedByName: 'معاون',
      status: 'signed_digital',
    };
    assert.equal(
      authorizeMutation(parentCtx, 'discipline_pledges', 'write', {
        schoolId: 'school-1',
        record: ownPledge,
      }).allowed,
      true
    );
    assert.equal(
      authorizeMutation(parentCtx, 'discipline_pledges', 'write', {
        schoolId: 'school-1',
        record: { ...ownPledge, studentId: 'st-other' },
      }).allowed,
      false
    );

    const ownExit: StudentExitPass = {
      ...baseMeta,
      id: 'ex-1',
      trackingCode: 'EX-1405-1001',
      studentId: 'st-1',
      classId: 'cls-1',
      jalaliDate: '1405/08/10',
      reasonCategory: 'medical',
      plannedExitTimeHm: '10:30',
      pickupPersonName: 'ولی',
      pickupRelation: 'پدر',
      parentVerified: true,
      requestedByRole: 'parent',
      requestedByName: 'ولی',
      status: 'requested',
    };
    assert.equal(
      authorizeMutation(parentCtx, 'student_exit_passes', 'write', {
        schoolId: 'school-1',
        record: ownExit,
      }).allowed,
      true
    );
  });

  it('allows student to log own virtual class attendance only', () => {
    const studentCtx = makeCtx('student', { linkedStudentId: 'st-1' });
    const ownAtt: VirtualClassAttendance = {
      ...baseMeta,
      id: 'att-1',
      sessionId: 'vc-1',
      classId: 'cls-1',
      studentId: 'st-1',
      studentName: 'دانش‌آموز ۱',
      joinedAtIso: '2026-01-01T08:00:00.000Z',
      joinedAtJalali: '1405/08/10',
      joinedAtTimeHm: '10:02',
    };
    assert.equal(
      authorizeMutation(studentCtx, 'virtual_class_attendance', 'write', {
        schoolId: 'school-1',
        record: ownAtt,
      }).allowed,
      true
    );
    assert.equal(
      authorizeMutation(studentCtx, 'virtual_class_attendance', 'write', {
        schoolId: 'school-1',
        record: { ...ownAtt, studentId: 'st-2' },
      }).allowed,
      false
    );
  });
});
