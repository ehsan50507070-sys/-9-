// Pure Helper Functions for Phase 4 Electronic Forms & Digital Consent («فرم‌ساز الکترونیک و رضایت‌نامه دیجیتال»)
// Decoupled from React for unit testing via node:test.
import { buildUtf8BomCsv } from '../../lib/csv';
import { toPersianDigits } from '../../lib/digits';
import { formatSingleColumnMessengerReport } from '../../lib/messenger';
import type {
  ClassRoom,
  ElectronicForm,
  ElectronicFormField,
  ElectronicFormPresetType,
  ElectronicFormResponse,
  Student,
} from '../../types/domain';

export interface FormStarterPreset {
  type: ElectronicFormPresetType;
  labelFa: string;
  defaultTitle: string;
  defaultBody: string;
  requireSignature: boolean;
  defaultFields: ElectronicFormField[];
}

export const FORM_STARTER_PRESETS: FormStarterPreset[] = [
  {
    type: 'field_trip',
    labelFa: 'رضایت‌نامه اردو و بازدید علمی',
    defaultTitle: 'رضایت‌نامه شرکت در اردو و بازدید علمی',
    defaultBody:
      'ولی گرامی، بدین‌وسیله به اطلاع می‌رساند بازدید علمی و تربیتی مدرسه با حضور کادر آموزشی و سرویس ایمن برگزار می‌گردد. خواهشمند است در صورت موافقت با حضور فرزندتان، فرم زیر را تکمیل و امضای دیجیتال خود را ثبت فرمایید.',
    requireSignature: true,
    defaultFields: [
      {
        id: 'fld-health',
        label: 'آیا دانش‌آموز حساسیت غذایی، دارویی یا نکته پزشکی خاصی دارد؟',
        type: 'short_text',
        required: false,
      },
      {
        id: 'fld-return',
        label: 'نحوه بازگشت دانش‌آموز پس از پایان اردو',
        type: 'single_choice',
        required: true,
        options: ['با سرویس رسمی مدرسه', 'تحویل حضوری توسط ولی در مدرسه'],
      },
      {
        id: 'fld-agree',
        label: 'موافقت کامل با حضور دانش‌آموز و رعایت ضوابط ایمنی اردو',
        type: 'yes_no',
        required: true,
      },
    ],
  },
  {
    type: 'extra_class',
    labelFa: 'رضایت‌نامه کلاس تقویتی / فوق‌برنامه',
    defaultTitle: 'رضایت‌نامه ثبت‌نام در کلاس تقویتی و فوق‌برنامه',
    defaultBody:
      'ولی گرامی، کلاس‌های تقویتی و مهارتی فوق‌برنامه پس از ساعات رسمی مدرسه برگزار می‌شود. لطفاً وضعیت حضور فرزندتان و نحوه بازگشت به منزل را مشخص و تایید فرمایید.',
    requireSignature: true,
    defaultFields: [
      {
        id: 'fld-track',
        label: 'انتخاب دوره فوق‌برنامه مورد نظر',
        type: 'single_choice',
        required: true,
        options: ['تقویتی ریاضی و حل مسئله', 'کارگاه خلاقیت و پژوهش علوم', 'زبان و مهارت‌های ارتباطی'],
      },
      {
        id: 'fld-pickup',
        label: 'نام تحویل‌گیرنده دانش‌آموز پس از پایان کلاس',
        type: 'short_text',
        required: true,
      },
      {
        id: 'fld-agree',
        label: 'با حضور منظم فرزندم در ساعات فوق‌برنامه موافق هستم',
        type: 'yes_no',
        required: true,
      },
    ],
  },
  {
    type: 'health_emergency',
    labelFa: 'فرم اطلاعات اضطراری و سلامت',
    defaultTitle: 'فرم به‌روزرسانی اطلاعات تماس اضطراری و سلامت دانش‌آموز',
    defaultBody:
      'ولی گرامی، جهت حفظ ایمنی و ارائه بهترین مراقبت بهداشتی در مدرسه، لطفاً اطلاعات تماس اضطراری و نکات سلامت فرزندتان را به‌دقت تکمیل و تایید فرمایید.',
    requireSignature: true,
    defaultFields: [
      {
        id: 'fld-emergency-phone',
        label: 'شماره تماس اضطراری دوم (بستگان نزدیک)',
        type: 'short_text',
        required: true,
      },
      {
        id: 'fld-blood',
        label: 'آیا دانش‌آموز سابقه آسم، آلرژی یا بیماری خاص دارد؟',
        type: 'single_choice',
        required: true,
        options: ['خیر، کاملاً سالم است', 'بله (در بخش توضیحات ذکر می‌شود)'],
      },
      {
        id: 'fld-notes',
        label: 'توضیحات تکمیلی بهداشتی یا دارویی',
        type: 'short_text',
        required: false,
      },
    ],
  },
  {
    type: 'custom',
    labelFa: 'فرم سفارشی',
    defaultTitle: 'فرم اطلاع‌رسانی و هماهنگی با اولیا',
    defaultBody:
      'ولی گرامی، لطفاً متن این اطلاعیه را مطالعه فرموده و پاسخ خود را در سامانه ثبت نمایید.',
    requireSignature: false,
    defaultFields: [
      {
        id: 'fld-note',
        label: 'نظر یا توضیحات ولی',
        type: 'short_text',
        required: false,
      },
    ],
  },
];

export function getTargetStudentsForForm(form: ElectronicForm, students: Student[]): Student[] {
  const active = students.filter((s) => s.active);
  if (form.targetAudience === 'all_school') return active;
  return active.filter((s) => form.targetClassIds.includes(s.classId));
}

export interface FormTrackingPartition {
  targetStudents: Student[];
  signedRows: Array<{ student: Student; response: ElectronicFormResponse }>;
  pendingStudents: Student[];
  signedCount: number;
  totalCount: number;
  completionPercent: number;
}

export function partitionFormResponses(
  form: ElectronicForm,
  students: Student[],
  responses: ElectronicFormResponse[]
): FormTrackingPartition {
  const targetStudents = getTargetStudentsForForm(form, students);
  const respByStudentId = new Map(
    responses.filter((r) => r.formId === form.id).map((r) => [r.studentId, r])
  );

  const signedRows: Array<{ student: Student; response: ElectronicFormResponse }> = [];
  const pendingStudents: Student[] = [];

  for (const st of targetStudents) {
    const resp = respByStudentId.get(st.id);
    if (resp) {
      signedRows.push({ student: st, response: resp });
    } else {
      pendingStudents.push(st);
    }
  }

  const totalCount = targetStudents.length;
  const signedCount = signedRows.length;
  const completionPercent = totalCount > 0 ? Math.round((signedCount / totalCount) * 100) : 0;

  return {
    targetStudents,
    signedRows,
    pendingStudents,
    signedCount,
    totalCount,
    completionPercent,
  };
}

export function formatPendingParentsMessenger(params: {
  schoolName: string;
  form: ElectronicForm;
  pendingStudents: Student[];
  classes: ClassRoom[];
  jalaliDate: string;
}): string {
  const { schoolName, form, pendingStudents, classes, jalaliDate } = params;
  const classById = new Map(classes.map((c) => [c.id, c.name]));

  const lines =
    pendingStudents.length === 0
      ? ['خوشبختانه تمامی اولیای هدف این رضایت‌نامه را تکمیل و امضا کرده‌اند.']
      : [
          `تعداد در انتظار تکمیل و امضا: ${toPersianDigits(pendingStudents.length)} نفر`,
          `مهلت تکمیل: ${toPersianDigits(form.deadlineJalali)}`,
          '',
          ...pendingStudents.map(
            (st, idx) =>
              `${toPersianDigits(idx + 1)}. ${st.fullName} (${classById.get(st.classId) ?? ''}) — ولی: ${st.parentName}`
          ),
        ];

  return formatSingleColumnMessengerReport({
    schoolName,
    reportTitle: `فهرست اولیای در انتظار امضا — ${form.title}`,
    jalaliDateDisplay: jalaliDate,
    sections: [{ lines }],
    footerNote: 'لطفاً از طریق پنل ولی نسبت به تکمیل و امضای دیجیتال اقدام فرمایید.',
  });
}

export function buildFormResponsesCsv(params: {
  form: ElectronicForm;
  partition: FormTrackingPartition;
  classes: ClassRoom[];
}): string {
  const { form, partition, classes } = params;
  const classById = new Map(classes.map((c) => [c.id, c.name]));

  const headers = [
    'نام دانش‌آموز',
    'کلاس',
    'نام ولی',
    'وضعیت',
    'تاریخ ثبت',
    'نحوه امضا',
    ...form.fields.map((f) => f.label),
  ];

  const rows: string[][] = [];
  for (const { student, response } of partition.signedRows) {
    rows.push([
      student.fullName,
      classById.get(student.classId) ?? '',
      response.parentName,
      'تکمیل و تایید شده',
      `${response.submittedAtJalali} ${response.submittedAtTime}`,
      response.signatureDataUrl
        ? 'امضای دیجیتال لمسی'
        : response.fallbackConfirmed
          ? `کد تایید ولی (${response.fallbackConfirmationCode ?? 'تاییدشده'})`
          : 'تایید سیستمی',
      ...form.fields.map((f) => response.answers[f.id] ?? ''),
    ]);
  }
  for (const student of partition.pendingStudents) {
    rows.push([
      student.fullName,
      classById.get(student.classId) ?? '',
      student.parentName,
      'در انتظار پاسخ',
      '—',
      '—',
      ...form.fields.map(() => ''),
    ]);
  }

  return buildUtf8BomCsv(headers, rows);
}
