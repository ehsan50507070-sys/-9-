// Pure TypeScript Helpers for Phase 5 Plugin: In-Person Exams Management («مدیریت هوشمند امتحانات حضوری»)
// Real-time 3-way conflict detector, 2D anti-cheating checkerboard seating algorithm, manual swap with instant
// adjacency re-check, card pagination helpers, and single-column messenger formatter.
import { toAsciiDigits, toPersianDigits } from '../../lib/digits';
import type {
  ClassRoom,
  ExamSeatAssignment,
  InPersonExamHall,
  InPersonExamSession,
  Student,
  Teacher,
} from '../../types/domain';

export interface ExamConflictItem {
  type: 'class' | 'hall' | 'proctor';
  conflictingSessionId: string;
  messageFa: string;
}

export function timeToMinutes(hhmm: string): number {
  const clean = toAsciiDigits(hhmm).trim();
  const [hStr, mStr] = clean.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return -1;
  return h * 60 + m;
}

export function timeRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const a1 = timeToMinutes(startA);
  const a2 = timeToMinutes(endA);
  const b1 = timeToMinutes(startB);
  const b2 = timeToMinutes(endB);
  if (a1 < 0 || a2 < 0 || b1 < 0 || b2 < 0) return false;
  return a1 < b2 && b1 < a2;
}

/**
 * Real-time 3-way Conflict Detector («تشخیص خودکار تداخل»):
 * Detects overlapping exams on the same Jalali date for:
 * (a) Same class scheduled for two overlapping exams
 * (b) Same hall double-booked
 * (c) Same teacher assigned as proctor in two halls at the same time
 */
export function detectExamScheduleConflicts(params: {
  candidate: {
    id?: string;
    jalaliDate: string;
    startTime: string;
    endTime: string;
    classIds: string[];
    hallId: string;
    proctorTeacherId: string;
  };
  existingSessions: InPersonExamSession[];
  classes: ClassRoom[];
  halls: InPersonExamHall[];
  teachers: Teacher[];
}): ExamConflictItem[] {
  const { candidate, existingSessions, classes, halls, teachers } = params;
  const conflicts: ExamConflictItem[] = [];

  const classMap = new Map(classes.map((c) => [c.id, c.name]));
  const hallMap = new Map(halls.map((h) => [h.id, h.name]));
  const teacherMap = new Map(teachers.map((t) => [t.id, t.fullName]));

  for (const session of existingSessions) {
    if (candidate.id && session.id === candidate.id) continue;
    if (session.jalaliDate !== candidate.jalaliDate) continue;
    if (!timeRangesOverlap(candidate.startTime, candidate.endTime, session.startTime, session.endTime)) {
      continue;
    }

    // (a) Overlapping class
    const sharedClasses = candidate.classIds.filter((cid) => session.classIds.includes(cid));
    if (sharedClasses.length > 0) {
      const names = sharedClasses.map((cid) => classMap.get(cid) ?? cid).join('، ');
      conflicts.push({
        type: 'class',
        conflictingSessionId: session.id,
        messageFa: `تداخل کلاسی: ${names} در تاریخ ${toPersianDigits(session.jalaliDate)} ساعت ${toPersianDigits(session.startTime)} تا ${toPersianDigits(session.endTime)} آزمون «${session.subject}» دارد.`,
      });
    }

    // (b) Double-booked hall
    if (candidate.hallId && session.hallId === candidate.hallId) {
      const hallName = hallMap.get(session.hallId) ?? 'حوزه انتخابی';
      conflicts.push({
        type: 'hall',
        conflictingSessionId: session.id,
        messageFa: `تداخل حوزه امتحانی: «${hallName}» در ساعت ${toPersianDigits(session.startTime)} تا ${toPersianDigits(session.endTime)} برای آزمون «${session.subject}» رزرو شده است.`,
      });
    }

    // (c) Double-booked proctor teacher
    if (candidate.proctorTeacherId && session.proctorTeacherId === candidate.proctorTeacherId) {
      const teacherName = teacherMap.get(session.proctorTeacherId) ?? 'مراقب انتخابی';
      conflicts.push({
        type: 'proctor',
        conflictingSessionId: session.id,
        messageFa: `تداخل مراقب: «${teacherName}» هم‌زمان مراقب آزمون «${session.subject}» در حوزه «${hallMap.get(session.hallId) ?? 'دیگر'}» است.`,
      });
    }
  }

  return conflicts;
}

/**
 * Evaluates orthogonal (up/down/left/right) same-class adjacency warnings on a 2D seating grid.
 * Returns the set of seatNumbers involved in any orthogonal same-class adjacency and total adjacent pairs.
 */
export function evaluateSeatingAdjacency(
  assignments: ExamSeatAssignment[],
  rows: number,
  cols: number
): { warningSeatNumbers: Set<number>; adjacentPairCount: number } {
  const grid: Array<Array<ExamSeatAssignment | null>> = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null)
  );
  for (const seat of assignments) {
    if (seat.row >= 0 && seat.row < rows && seat.col >= 0 && seat.col < cols) {
      grid[seat.row][seat.col] = seat;
    }
  }

  const warningSeatNumbers = new Set<number>();
  let adjacentPairCount = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cur = grid[r][c];
      if (!cur || !cur.studentId || !cur.classId) continue;

      // Check right neighbor (r, c+1) and bottom neighbor (r+1, c) to count each pair once
      const neighbors = [
        c + 1 < cols ? grid[r][c + 1] : null,
        r + 1 < rows ? grid[r + 1][c] : null,
      ];
      for (const nb of neighbors) {
        if (nb && nb.studentId && nb.classId && nb.classId === cur.classId) {
          adjacentPairCount++;
          warningSeatNumbers.add(cur.seatNumber);
          warningSeatNumbers.add(nb.seatNumber);
        }
      }
    }
  }

  return { warningSeatNumbers, adjacentPairCount };
}

/**
 * Smart Checkerboard Seating Algorithm («چیدمان هوشمند شطرنجی ضدتقلب»):
 * Places students from 2 or more classes/grades across a 2D hall grid so that no two students
 * from the same class sit orthogonally adjacent (left, right, front, back) whenever mathematically possible.
 * Uses parity-first coloring (`(row + col) % 2`) paired with largest-remaining-class greedy conflict avoidance.
 */
export function generateCheckerboardSeating(params: {
  rows: number;
  cols: number;
  startSeatNumber: number;
  students: Student[];
}): {
  assignments: ExamSeatAssignment[];
  warningSeatNumbers: Set<number>;
  adjacencyWarningCount: number;
  unseatedStudentIds: string[];
} {
  const { rows, cols, startSeatNumber, students } = params;
  const totalSeats = rows * cols;

  // Group active students by classId deterministically
  const buckets = new Map<string, Student[]>();
  for (const st of students) {
    const list = buckets.get(st.classId) ?? [];
    list.push(st);
    buckets.set(st.classId, list);
  }
  for (const list of buckets.values()) {
    list.sort((a, b) => a.fullName.localeCompare(b.fullName, 'fa'));
  }

  const grid: Array<Array<ExamSeatAssignment>> = [];
  let seatCounter = startSeatNumber;
  for (let r = 0; r < rows; r++) {
    const rowArr: ExamSeatAssignment[] = [];
    for (let c = 0; c < cols; c++) {
      rowArr.push({
        row: r,
        col: c,
        seatNumber: seatCounter++,
        studentId: null,
      });
    }
    grid.push(rowArr);
  }

  // Partition coordinates into two independent checkerboard parity sets:
  // No two cells in `evenCoords` are orthogonally adjacent, and no two cells in `oddCoords` are orthogonally adjacent.
  const evenCoords: Array<[number, number]> = [];
  const oddCoords: Array<[number, number]> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((r + c) % 2 === 0) evenCoords.push([r, c]);
      else oddCoords.push([r, c]);
    }
  }

  // Sort class buckets by descending student count
  const classIdsSorted = Array.from(buckets.keys()).sort(
    (a, b) => (buckets.get(b)?.length ?? 0) - (buckets.get(a)?.length ?? 0)
  );

  const hasSameClassNeighbor = (r: number, c: number, classId: string): boolean => {
    const dirs: Array<[number, number]> = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc].classId === classId) {
        return true;
      }
    }
    return false;
  };

  const unseatedStudentIds: string[] = [];

  for (const cid of classIdsSorted) {
    const queue = [...(buckets.get(cid) ?? [])];
    if (queue.length === 0) continue;

    // Step 1: Prefer placing the entire class inside whichever parity set has enough free slots
    // (preferring the smaller sufficient set if both fit, or the larger set if it overflows).
    const evenFits = evenCoords.length >= queue.length;
    const oddFits = oddCoords.length >= queue.length;

    let primarySet: Array<[number, number]>;
    let secondarySet: Array<[number, number]>;
    if (evenFits && oddFits) {
      if (evenCoords.length <= oddCoords.length) {
        primarySet = evenCoords;
        secondarySet = oddCoords;
      } else {
        primarySet = oddCoords;
        secondarySet = evenCoords;
      }
    } else if (evenFits) {
      primarySet = evenCoords;
      secondarySet = oddCoords;
    } else if (oddFits) {
      primarySet = oddCoords;
      secondarySet = evenCoords;
    } else if (evenCoords.length >= oddCoords.length) {
      primarySet = evenCoords;
      secondarySet = oddCoords;
    } else {
      primarySet = oddCoords;
      secondarySet = evenCoords;
    }

    // Place as many students as possible into primary parity set (guaranteed 0 internal adjacencies!)
    while (queue.length > 0 && primarySet.length > 0) {
      const [r, c] = primarySet.shift()!;
      const st = queue.shift()!;
      grid[r][c].studentId = st.id;
      grid[r][c].classId = st.classId;
    }

    // Step 2: If students remain (class > single parity capacity), place into secondary parity set
    // picking non-adjacent cells first (from the far end) before falling back to unavoidable adjacencies.
    while (queue.length > 0 && secondarySet.length > 0) {
      let pickIdx = -1;
      for (let i = secondarySet.length - 1; i >= 0; i--) {
        const [r, c] = secondarySet[i];
        if (!hasSameClassNeighbor(r, c, cid)) {
          pickIdx = i;
          break;
        }
      }
      if (pickIdx < 0) pickIdx = secondarySet.length - 1;
      const [r, c] = secondarySet.splice(pickIdx, 1)[0];
      const st = queue.shift()!;
      grid[r][c].studentId = st.id;
      grid[r][c].classId = st.classId;
    }

    for (const left of queue) {
      unseatedStudentIds.push(left.id);
    }
  }

  const assignments: ExamSeatAssignment[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      assignments.push(grid[r][c]);
    }
  }

  const { warningSeatNumbers, adjacentPairCount } = evaluateSeatingAdjacency(assignments, rows, cols);

  return {
    assignments,
    warningSeatNumbers,
    adjacencyWarningCount: adjacentPairCount,
    unseatedStudentIds: students.length > totalSeats ? unseatedStudentIds : [],
  };
}

/**
 * Swaps two seats cleanly (including moving a student into an empty seat) and immediately recomputes adjacency warnings.
 */
export function swapSeatsInGrid(params: {
  assignments: ExamSeatAssignment[];
  rows: number;
  cols: number;
  seatNumberA: number;
  seatNumberB: number;
}): {
  assignments: ExamSeatAssignment[];
  warningSeatNumbers: Set<number>;
  adjacencyWarningCount: number;
} {
  const { assignments, rows, cols, seatNumberA, seatNumberB } = params;
  const next = assignments.map((s) => ({ ...s }));
  const seatA = next.find((s) => s.seatNumber === seatNumberA);
  const seatB = next.find((s) => s.seatNumber === seatNumberB);
  if (seatA && seatB && seatA !== seatB) {
    const tmpStudentId = seatA.studentId;
    const tmpClassId = seatA.classId;
    seatA.studentId = seatB.studentId;
    seatA.classId = seatB.classId;
    seatB.studentId = tmpStudentId;
    seatB.classId = tmpClassId;
  }
  const { warningSeatNumbers, adjacentPairCount } = evaluateSeatingAdjacency(next, rows, cols);
  return {
    assignments: next,
    warningSeatNumbers,
    adjacencyWarningCount: adjacentPairCount,
  };
}

export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    pages.push(items.slice(i, i + chunkSize));
  }
  return pages;
}

/**
 * Formats a clean single-column Persian exam schedule ready for Eitaa, Bale, and Shad.
 */
export function formatExamScheduleMessenger(params: {
  schoolName: string;
  termTitle: string;
  sessions: InPersonExamSession[];
  classes: ClassRoom[];
  halls: InPersonExamHall[];
  teachers: Teacher[];
}): string {
  const { schoolName, termTitle, sessions, classes, halls, teachers } = params;
  const classMap = new Map(classes.map((c) => [c.id, c.name]));
  const hallMap = new Map(halls.map((h) => [h.id, h.name]));
  const teacherMap = new Map(teachers.map((t) => [t.id, t.fullName]));

  const sorted = [...sessions].sort((a, b) =>
    `${a.jalaliDate} ${a.startTime}`.localeCompare(`${b.jalaliDate} ${b.startTime}`)
  );

  const lines: string[] = [
    `📋 برنامه امتحانات حضوری — ${termTitle}`,
    `🏫 ${schoolName}`,
    `────────────────────`,
  ];

  sorted.forEach((s, idx) => {
    const classNames = s.classIds.map((cid) => classMap.get(cid) ?? cid).join('، ');
    const hallName = hallMap.get(s.hallId) ?? 'تعیین نشده';
    const proctorName = teacherMap.get(s.proctorTeacherId) ?? 'تعیین نشده';
    lines.push(
      `${toPersianDigits(idx + 1)}. درس ${s.subject}`,
      `   📅 تاریخ: ${toPersianDigits(s.jalaliDate)} | ⏰ ساعت ${toPersianDigits(s.startTime)} تا ${toPersianDigits(s.endTime)}`,
      `   🎓 کلاس‌ها: ${classNames}`,
      `   🏛️ حوزه: ${hallName} | 👨‍🏫 مراقب: ${proctorName}`
    );
  });

  lines.push(`────────────────────`, `لطفاً ۱۵ دقیقه پیش از شروع امتحان با کارت ورود به جلسه در حوزه حضور یابید.`);
  return lines.join('\n');
}
