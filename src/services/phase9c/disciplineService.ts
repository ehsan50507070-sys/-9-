// Phase 9-C: Discipline, Rewards & Pledges Pure TypeScript Service
import { toPersianDigits } from '../../lib/digits';
import { escapeHtml } from '../../core/security/sanitize';
import type {
  DisciplinePledge,
  DisciplineRecord,
  DisciplineSeverity,
  RoleId,
  School,
  Student,
} from '../../types/domain';

export const REWARD_CATEGORIES_FA: string[] = [
  'نظم و انضباط نمونه',
  'ادب و احترام به همکلاسی‌ها',
  'همکاری در فعالیت‌های گروهی',
  'پیشرفت چشمگیر تحصیلی',
  'مسئولیت‌پذیری و امانت‌داری',
  'مشارکت در برنامه‌های فرهنگی و پرورشی',
];

export const INFRACTION_CATEGORIES_FA: string[] = [
  'تاخیر مکرر در ورود به مدرسه',
  'بی‌نظمی در محیط کلاس',
  'عدم رعایت پوشش یا مقررات مدرسه',
  'رفتار نامناسب با همکلاسی‌ها',
  'همراه داشتن وسایل غیرمجاز',
  'غیبت غیرموجه یا ترک کلاس',
];

export const DISCIPLINE_SEVERITY_META: Record<
  DisciplineSeverity,
  { labelFa: string; defaultPoints: number }
> = {
  minor: { labelFa: 'عادی', defaultPoints: 0.5 },
  moderate: { labelFa: 'متوسط', defaultPoints: 1 },
  critical: { labelFa: 'مهم / نیازمند تعهدنامه', defaultPoints: 2 },
};

export interface StudentDisciplineScoreSummary {
  studentId: string;
  baseScore: number;
  totalRewardPoints: number;
  totalInfractionPoints: number;
  rawScore: number;
  finalScore: number; // Clamped strictly to [0, 20]
  rewardCount: number;
  infractionCount: number;
  criticalCount: number;
  band: 'excellent' | 'good' | 'attention' | 'critical';
  bandLabelFa: string;
}

export interface DisciplineTrendPoint {
  id: string;
  jalaliDate: string;
  score: number;
  delta: number;
  kind: 'base' | 'reward' | 'infraction';
  title: string;
}

export function calculateStudentDisciplineScore(
  records: DisciplineRecord[],
  studentId: string
): StudentDisciplineScoreSummary {
  const baseScore = 20;
  let totalRewardPoints = 0;
  let totalInfractionPoints = 0;
  let rewardCount = 0;
  let infractionCount = 0;
  let criticalCount = 0;

  for (const rec of records) {
    if (rec.studentId !== studentId) continue;
    const pts = Number.isFinite(rec.pointsDelta) ? Math.abs(rec.pointsDelta) : 0;
    if (rec.kind === 'reward') {
      totalRewardPoints += pts;
      rewardCount += 1;
    } else {
      totalInfractionPoints += pts;
      infractionCount += 1;
      if (rec.severity === 'critical') criticalCount += 1;
    }
  }

  const rawScore = Number((baseScore + totalRewardPoints - totalInfractionPoints).toFixed(2));
  const finalScore = Math.max(0, Math.min(20, rawScore));

  let band: StudentDisciplineScoreSummary['band'] = 'excellent';
  let bandLabelFa = 'عالی و الگو';
  if (finalScore < 14) {
    band = 'critical';
    bandLabelFa = 'نیازمند پیگیری فوری و تعهدنامه';
  } else if (finalScore < 17) {
    band = 'attention';
    bandLabelFa = 'نیازمند توجه و مشاوره';
  } else if (finalScore < 19) {
    band = 'good';
    bandLabelFa = 'خوب و قابل قبول';
  }

  return {
    studentId,
    baseScore,
    totalRewardPoints: Number(totalRewardPoints.toFixed(2)),
    totalInfractionPoints: Number(totalInfractionPoints.toFixed(2)),
    rawScore,
    finalScore,
    rewardCount,
    infractionCount,
    criticalCount,
    band,
    bandLabelFa,
  };
}

export function buildDisciplineTrendPoints(
  records: DisciplineRecord[],
  studentId: string
): DisciplineTrendPoint[] {
  const studentRecs = records
    .filter((r) => r.studentId === studentId)
    .sort((a, b) => {
      const cmp = a.jalaliDate.localeCompare(b.jalaliDate);
      if (cmp !== 0) return cmp;
      return (a.createdAtIso ?? '').localeCompare(b.createdAtIso ?? '');
    });

  const points: DisciplineTrendPoint[] = [
    {
      id: 'base-start',
      jalaliDate: 'آغاز سال',
      score: 20,
      delta: 0,
      kind: 'base',
      title: 'نمره پایه انضباط ابتدای سال تحصیلی',
    },
  ];

  let runningRaw = 20;
  for (const rec of studentRecs) {
    const absPts = Number.isFinite(rec.pointsDelta) ? Math.abs(rec.pointsDelta) : 0;
    const signed = rec.kind === 'reward' ? absPts : -absPts;
    runningRaw = Number((runningRaw + signed).toFixed(2));
    const clamped = Math.max(0, Math.min(20, runningRaw));
    points.push({
      id: rec.id,
      jalaliDate: rec.jalaliDate,
      score: clamped,
      delta: signed,
      kind: rec.kind,
      title: rec.title,
    });
  }

  return points;
}

export function filterVisibleDisciplineRecords(params: {
  records: DisciplineRecord[];
  role: RoleId;
  linkedStudentId?: string;
  teacherAssignedClassIds?: string[];
}): DisciplineRecord[] {
  const { records, role, linkedStudentId, teacherAssignedClassIds = [] } = params;
  if (role === 'parent' || role === 'student') {
    if (!linkedStudentId) return [];
    return records.filter(
      (r) => r.studentId === linkedStudentId && r.visibleToParentStudent === true
    );
  }
  if (role === 'teacher') {
    const set = new Set(teacherAssignedClassIds);
    return records.filter((r) => set.size === 0 || set.has(r.classId));
  }
  return records;
}

export function buildDefaultPledgeTextFa(params: {
  studentName: string;
  className: string;
  schoolName: string;
  reasonTitle: string;
  jalaliDate: string;
}): string {
  return `اینجانب ولی دانش‌آموز «${params.studentName}» مشغول به تحصیل در کلاس «${params.className}» واحد آموزشی «${params.schoolName}»، بدین‌وسیله ضمن اطلاع کامل از موضوع انضباطی ثبت‌شده با عنوان «${params.reasonTitle}» در تاریخ ${toPersianDigits(params.jalaliDate)}، متعهد می‌گردم با همکاری مستمر با کادر آموزشی و پرورشی مدرسه، زمینه رعایت کامل آیین‌نامه انضباطی، نظم فردی و حسن رفتار فرزند خود را فراهم نمایم. بدیهی است در صورت تکرار مورد مشابه، تصمیم شورای انضباطی مدرسه مطابق ضوابط آموزش و پرورش ملاک عمل خواهد بود.`;
}

export function buildPledgePrintHtml(params: {
  pledge: DisciplinePledge;
  studentName: string;
  studentNationalId: string;
  parentName: string;
  className: string;
  school: School;
}): string {
  const { pledge, studentName, studentNationalId, parentName, className, school } = params;
  const statusLabel =
    pledge.status === 'signed_digital'
      ? `تایید و امضای دیجیتال ولی (${toPersianDigits(pledge.parentSignedAtJalali ?? '')})`
      : pledge.status === 'signed_in_person'
        ? `امضای حضوری ثبت‌شده در دفتر مدرسه (${toPersianDigits(pledge.parentSignedAtJalali ?? '')})`
        : 'در انتظار امضای ولی';

  return `
    <div style="font-family: Vazirmatn, Tahoma, sans-serif; color: #0f172a; line-height: 1.9;">
      <div style="text-align:center; margin-bottom: 16px;">
        <h2 style="margin:0; font-size: 16px; font-weight: 800;">تعهدنامه رسمی انضباطی دانش‌آموز</h2>
        <div style="font-size: 12px; color: #475569; margin-top: 4px;">
          شماره سند: ${escapeHtml(toPersianDigits(pledge.id.slice(-8).toUpperCase()))} &nbsp;|&nbsp;
          تاریخ صدور: ${escapeHtml(toPersianDigits(pledge.issuedAtJalali))}
        </div>
      </div>

      <table style="width:100%; border-collapse: collapse; margin-bottom: 14px; font-size: 12px;">
        <tbody>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px; background:#f8fafc; font-weight:700; width: 22%;">نام دانش‌آموز</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 28%;">${escapeHtml(studentName)}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px; background:#f8fafc; font-weight:700; width: 22%;">کد ملی</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 28%;">${escapeHtml(toPersianDigits(studentNationalId))}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px; background:#f8fafc; font-weight:700;">کلاس / پایه</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">${escapeHtml(className)}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px; background:#f8fafc; font-weight:700;">نام ولی</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">${escapeHtml(parentName)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px; background:#f8fafc; font-weight:700;">موضوع تعهدنامه</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;" colspan="3">${escapeHtml(pledge.title)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px; background:#f8fafc; font-weight:700;">وضعیت تایید ولی</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;" colspan="3">${escapeHtml(statusLabel)}</td>
          </tr>
        </tbody>
      </table>

      <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px 16px; background: #ffffff; font-size: 13px; text-align: justify; margin-bottom: 18px;">
        ${escapeHtml(pledge.bodyText).replace(/\n/g, '<br/>')}
      </div>

      ${
        pledge.parentSignatureNote
          ? `<div style="border: 1px dashed #64748b; border-radius: 6px; padding: 8px 12px; font-size: 12px; margin-bottom: 16px;">
              <strong>توضیح/تاییدیه ثبت‌شده توسط ولی (${escapeHtml(pledge.parentSignedByName ?? parentName)}):</strong>
              ${escapeHtml(pledge.parentSignatureNote)}
            </div>`
          : ''
      }

      <table style="width:100%; border-collapse: collapse; margin-top: 24px; font-size: 12px; text-align: center;">
        <tbody>
          <tr>
            <td style="width:33%; padding: 12px; border: 1px solid #e2e8f0; vertical-align: top; height: 84px;">
              <div style="font-weight:700; margin-bottom: 8px;">امضای دانش‌آموز</div>
              <div style="color:#64748b; font-size:11px;">${escapeHtml(studentName)}</div>
            </td>
            <td style="width:33%; padding: 12px; border: 1px solid #e2e8f0; vertical-align: top; height: 84px;">
              <div style="font-weight:700; margin-bottom: 8px;">امضا و اثر انگشت ولی</div>
              <div style="color:#64748b; font-size:11px;">${escapeHtml(pledge.parentSignedByName ?? parentName)}</div>
            </td>
            <td style="width:34%; padding: 12px; border: 1px solid #e2e8f0; vertical-align: top; height: 84px;">
              <div style="font-weight:700; margin-bottom: 8px;">تایید معاونت / مدیریت مدرسه</div>
              <div style="color:#64748b; font-size:11px;">${escapeHtml(school.principalName)}</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

export function buildDisciplineReportPrintHtml(params: {
  student: Student;
  className: string;
  summary: StudentDisciplineScoreSummary;
  records: DisciplineRecord[];
  school: School;
  todayJalali: string;
}): string {
  const { student, className, summary, records, school, todayJalali } = params;
  const rowsHtml =
    records.length === 0
      ? `<tr><td colspan="6" style="text-align:center; padding:12px; border:1px solid #cbd5e1; color:#64748b;">هیچ مورد انضباطی یا تشویقی ثبت نشده است (نمره انضباط کامل ۲۰).</td></tr>`
      : records
          .map((r, idx) => {
            const sign = r.kind === 'reward' ? '+' : '−';
            const kindFa = r.kind === 'reward' ? 'تشویق' : 'تذکر / مورد انضباطی';
            return `<tr>
              <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center;">${toPersianDigits(idx + 1)}</td>
              <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center;">${escapeHtml(toPersianDigits(r.jalaliDate))}</td>
              <td style="border:1px solid #cbd5e1; padding:6px 8px; font-weight:700; color:${r.kind === 'reward' ? '#047857' : '#be123c'};">${kindFa}</td>
              <td style="border:1px solid #cbd5e1; padding:6px 8px;">${escapeHtml(r.title)} <span style="color:#64748b; font-size:11px;">(${escapeHtml(r.category)})</span></td>
              <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center; font-weight:700;">${sign}${toPersianDigits(r.pointsDelta)}</td>
              <td style="border:1px solid #cbd5e1; padding:6px 8px;">${escapeHtml(r.recordedByName)}</td>
            </tr>`;
          })
          .join('');

  return `
    <div style="font-family: Vazirmatn, Tahoma, sans-serif; color:#0f172a; line-height: 1.7;">
      <div style="text-align:center; margin-bottom:14px;">
        <h2 style="margin:0; font-size:16px; font-weight:800;">کارنامه و گزارش جامع انضباطی دانش‌آموز</h2>
        <div style="font-size:12px; color:#475569; margin-top:4px;">
          تاریخ صدور گزارش: ${escapeHtml(toPersianDigits(todayJalali))} &nbsp;|&nbsp; سال تحصیلی: ${escapeHtml(toPersianDigits(school.academicYear))}
        </div>
      </div>

      <table style="width:100%; border-collapse:collapse; margin-bottom:14px; font-size:12px;">
        <tbody>
          <tr>
            <td style="border:1px solid #cbd5e1; padding:6px 10px; background:#f8fafc; font-weight:700;">دانش‌آموز</td>
            <td style="border:1px solid #cbd5e1; padding:6px 10px;">${escapeHtml(student.fullName)}</td>
            <td style="border:1px solid #cbd5e1; padding:6px 10px; background:#f8fafc; font-weight:700;">کلاس</td>
            <td style="border:1px solid #cbd5e1; padding:6px 10px;">${escapeHtml(className)}</td>
            <td style="border:1px solid #cbd5e1; padding:6px 10px; background:#f8fafc; font-weight:700;">نمره انضباط فعلی</td>
            <td style="border:1px solid #cbd5e1; padding:6px 10px; font-weight:800; font-size:14px; text-align:center;">${toPersianDigits(summary.finalScore)} از ۲۰</td>
          </tr>
          <tr>
            <td style="border:1px solid #cbd5e1; padding:6px 10px; background:#f8fafc; font-weight:700;">تعداد تشویق‌ها</td>
            <td style="border:1px solid #cbd5e1; padding:6px 10px;">${toPersianDigits(summary.rewardCount)} مورد (+${toPersianDigits(summary.totalRewardPoints)})</td>
            <td style="border:1px solid #cbd5e1; padding:6px 10px; background:#f8fafc; font-weight:700;">تعداد تذکرات</td>
            <td style="border:1px solid #cbd5e1; padding:6px 10px;">${toPersianDigits(summary.infractionCount)} مورد (−${toPersianDigits(summary.totalInfractionPoints)})</td>
            <td style="border:1px solid #cbd5e1; padding:6px 10px; background:#f8fafc; font-weight:700;">ارزیابی وضعیت</td>
            <td style="border:1px solid #cbd5e1; padding:6px 10px;">${escapeHtml(summary.bandLabelFa)}</td>
          </tr>
        </tbody>
      </table>

      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="border:1px solid #cbd5e1; padding:7px 8px; width:44px;">ردیف</th>
            <th style="border:1px solid #cbd5e1; padding:7px 8px; width:96px;">تاریخ شمسی</th>
            <th style="border:1px solid #cbd5e1; padding:7px 8px; width:120px;">نوع</th>
            <th style="border:1px solid #cbd5e1; padding:7px 8px;">شرح و دسته‌بندی</th>
            <th style="border:1px solid #cbd5e1; padding:7px 8px; width:74px;">امتیاز</th>
            <th style="border:1px solid #cbd5e1; padding:7px 8px; width:130px;">ثبت‌کننده</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}
