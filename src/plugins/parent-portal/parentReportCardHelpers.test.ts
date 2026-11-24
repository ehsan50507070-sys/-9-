import assert from 'node:assert/strict';
import test from 'node:test';
import { generateSeedDataset } from '../../core/data/seedData';
import type { GradebookEntry } from '../../types/domain';
import {
  ALL_ACADEMIC_MONTHS,
  buildComprehensiveParentReport,
  CORE_PARENT_SUBJECTS,
  formatSingleColumnReportForMessenger,
  TERM1_MONTHS,
  TERM2_MONTHS,
} from './parentReportCardHelpers';

const seed = generateSeedDataset();
const student = seed.students.find((s) => s.schoolId === 'school-1')!;
const schoolGradebook = seed.gradebook_entries.filter((g) => g.schoolId === 'school-1');
const schoolWeights = seed.gradebook_weights.filter((w) => w.schoolId === 'school-1');
const schoolAttendance = seed.student_attendance.filter((a) => a.schoolId === 'school-1');
const schoolAssignments = seed.homework_assignments.filter((h) => h.schoolId === 'school-1');
const schoolSubmissions = seed.homework_submissions.filter((s) => s.schoolId === 'school-1');
const schoolExams = seed.online_exams.filter((e) => e.schoolId === 'school-1');
const schoolExamSubs = seed.online_exam_submissions.filter((s) => s.schoolId === 'school-1');

test('Parent Report Card: default ALL subjects returns all 5 core subjects with 9-month curves', () => {
  const report = buildComprehensiveParentReport({
    studentId: student.id,
    studentName: student.fullName,
    classId: student.classId,
    schoolId: 'school-1',
    timeframe: 'full_year',
    selectedMonth: 'آذر',
    selectedSubject: 'ALL',
    gradebookEntries: schoolGradebook,
    gradebookWeights: schoolWeights,
    studentAttendance: schoolAttendance,
    homeworkAssignments: schoolAssignments,
    homeworkSubmissions: schoolSubmissions,
    onlineExams: schoolExams,
    onlineExamSubmissions: schoolExamSubs,
  });

  assert.equal(report.visibleSubjectRows.length, CORE_PARENT_SUBJECTS.length);
  assert.equal(report.subjectCharts.length, CORE_PARENT_SUBJECTS.length);
  assert.equal(report.overallTrendSeries.points.length, ALL_ACADEMIC_MONTHS.length);
  assert.equal(report.overallTrendSeries.termDividerAfterIndex, 3);
  assert.ok(report.kpis.primaryGpaValue >= 10 && report.kpis.primaryGpaValue <= 20);

  for (const chart of report.subjectCharts) {
    assert.equal(chart.points.length, 9);
    assert.equal(chart.points[0].label, 'مهر');
    assert.equal(chart.points[8].label, 'خرداد');
    assert.equal(chart.termDividerAfterIndex, 3);
    assert.ok(chart.term1Average !== null && chart.term2Average !== null);
  }
});

test('Parent Report Card: monthly, term1, and term2 timeframes adapt X-axis and reference lines accurately', () => {
  const monthly = buildComprehensiveParentReport({
    studentId: student.id,
    studentName: student.fullName,
    classId: student.classId,
    schoolId: 'school-1',
    timeframe: 'monthly',
    selectedMonth: 'آذر',
    selectedSubject: 'ALL',
    gradebookEntries: schoolGradebook,
    gradebookWeights: schoolWeights,
    studentAttendance: schoolAttendance,
    homeworkAssignments: schoolAssignments,
    homeworkSubmissions: schoolSubmissions,
    onlineExams: schoolExams,
    onlineExamSubmissions: schoolExamSubs,
  });

  assert.equal(monthly.subjectCharts[0].points.length, 4);
  assert.equal(monthly.subjectCharts[0].points[0].label, 'هفته ۱');
  assert.ok(monthly.subjectCharts[0].referenceScore !== null);
  assert.ok(monthly.subjectCharts[0].referenceLabelFa?.includes('آبان'));

  const term1 = buildComprehensiveParentReport({
    studentId: student.id,
    studentName: student.fullName,
    classId: student.classId,
    schoolId: 'school-1',
    timeframe: 'term1',
    selectedMonth: 'آذر',
    selectedSubject: 'ALL',
    gradebookEntries: schoolGradebook,
    gradebookWeights: schoolWeights,
    studentAttendance: schoolAttendance,
    homeworkAssignments: schoolAssignments,
    homeworkSubmissions: schoolSubmissions,
    onlineExams: schoolExams,
    onlineExamSubmissions: schoolExamSubs,
  });
  assert.deepEqual(
    term1.subjectCharts[0].points.map((p) => p.label),
    [...TERM1_MONTHS]
  );

  const term2 = buildComprehensiveParentReport({
    studentId: student.id,
    studentName: student.fullName,
    classId: student.classId,
    schoolId: 'school-1',
    timeframe: 'term2',
    selectedMonth: 'آذر',
    selectedSubject: 'ALL',
    gradebookEntries: schoolGradebook,
    gradebookWeights: schoolWeights,
    studentAttendance: schoolAttendance,
    homeworkAssignments: schoolAssignments,
    homeworkSubmissions: schoolSubmissions,
    onlineExams: schoolExams,
    onlineExamSubmissions: schoolExamSubs,
  });
  assert.deepEqual(
    term2.subjectCharts[0].points.map((p) => p.label),
    [...TERM2_MONTHS]
  );
});

test('Parent Report Card: live teacher gradebook entries override derived fallback & subject filter narrows view', () => {
  const customEntry: GradebookEntry = {
    id: `school-1:gb:${student.classId}:علوم تجربی:بهمن:${student.id}`,
    schoolId: 'school-1',
    studentId: student.id,
    classId: student.classId,
    subject: 'علوم تجربی',
    jalaliMonth: 'بهمن',
    jalaliDate: '1405/11/20',
    numericScore: 19.75,
    descriptiveLevel: 'خیلی خوب',
    disciplinaryNote: 'آزمایش بسیار دقیق و منظم',
    recordedBy: 'teacher',
    updatedAt: '2026-11-22T08:00:00Z',
  };

  const report = buildComprehensiveParentReport({
    studentId: student.id,
    studentName: student.fullName,
    classId: student.classId,
    schoolId: 'school-1',
    timeframe: 'monthly',
    selectedMonth: 'بهمن',
    selectedSubject: 'علوم تجربی',
    gradebookEntries: [...schoolGradebook, customEntry],
    gradebookWeights: schoolWeights,
    studentAttendance: schoolAttendance,
    homeworkAssignments: schoolAssignments,
    homeworkSubmissions: schoolSubmissions,
    onlineExams: schoolExams,
    onlineExamSubmissions: schoolExamSubs,
  });

  assert.equal(report.visibleSubjectRows.length, 1);
  assert.equal(report.visibleSubjectRows[0].subject, 'علوم تجربی');
  assert.equal(report.visibleSubjectRows[0].monthlyScore, 19.8);
  assert.equal(report.visibleSubjectRows[0].teacherFeedback, 'آزمایش بسیار دقیق و منظم');
  assert.equal(report.subjectCharts.length, 1);
});

test('Parent Report Card: single-column messenger formatter includes all subjects and Persian digits', () => {
  const report = buildComprehensiveParentReport({
    studentId: student.id,
    studentName: student.fullName,
    classId: student.classId,
    schoolId: 'school-1',
    timeframe: 'full_year',
    selectedMonth: 'آذر',
    selectedSubject: 'ALL',
    gradebookEntries: schoolGradebook,
    gradebookWeights: schoolWeights,
    studentAttendance: schoolAttendance,
    homeworkAssignments: schoolAssignments,
    homeworkSubmissions: schoolSubmissions,
    onlineExams: schoolExams,
    onlineExamSubmissions: schoolExamSubs,
  });

  const text = formatSingleColumnReportForMessenger({
    schoolName: 'دبستان شهدای دانش',
    studentName: student.fullName,
    className: 'پایه دوم - کلاس الف',
    academicYear: '1405-1406',
    todayJalali: '1405/09/01',
    report,
    displayMode: 'combined',
  });

  assert.ok(text.includes(student.fullName));
  assert.ok(text.includes('۱۴۰۵-۱۴۰۶'));
  for (const subj of CORE_PARENT_SUBJECTS) {
    assert.ok(text.includes(subj), `Expected subject ${subj} in messenger copy`);
  }
  assert.equal(text.includes('\t'), false);
});
