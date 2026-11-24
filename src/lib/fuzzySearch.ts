// Pure, zero-dependency Persian & Numeric Fuzzy Search Engine across Multi-School Students, National IDs, and Classes
import { toAsciiDigits } from './digits';
import type { AccentTheme, ClassRoom, School, Student, Teacher } from '../types/domain';

export type SmartSearchCategory = 'all' | 'student' | 'national_id' | 'class';

export type SmartSearchMatchedField =
  | 'نام دانش‌آموز'
  | 'کد ملی'
  | 'کد دانش‌آموزی'
  | 'نام ولی'
  | 'نام کلاس'
  | 'کد اتاق'
  | 'معلم کلاس';

export interface SmartSearchResult {
  id: string;
  entityType: 'student' | 'class';
  schoolId: string;
  schoolName: string;
  schoolShortLabel: string;
  schoolAccent: AccentTheme;
  classId: string;
  className: string;
  studentId?: string;
  title: string;
  nationalId?: string;
  studentCode?: string;
  parentName?: string;
  roomCode?: string;
  studentCount?: number;
  homeroomTeacherName?: string;
  matchedField: SmartSearchMatchedField;
  score: number;
}

export interface SmartSearchOptions {
  query: string;
  schools: School[];
  students: Student[];
  classes: ClassRoom[];
  teachers: Teacher[];
  categoryFilter?: SmartSearchCategory;
  schoolScope?: 'all' | string;
  limit?: number;
}

const PERSIAN_CHAR_MAP: Record<string, string> = {
  ي: 'ی',
  ى: 'ی',
  ئ: 'ی',
  ك: 'ک',
  ة: 'ه',
  ۀ: 'ه',
  أ: 'ا',
  إ: 'ا',
  آ: 'ا',
  ؤ: 'و',
};

const DIACRITICS_REGEX = /[\u064B-\u065F\u0670\u0640]/g;
const SEPARATORS_REGEX = /[\u200C\u200D\-_–—/\\.,:;()[\]{}]+/g;

/**
 * Normalizes Persian/Arabic characters, strips diacritics/ZWNJ, converts Persian & Arabic-Indic digits to ASCII.
 */
export function normalizePersianForSearch(input: string): string {
  if (!input) return '';
  let out = toAsciiDigits(input).toLowerCase();
  out = out.replace(DIACRITICS_REGEX, '');
  let mapped = '';
  for (let i = 0; i < out.length; i++) {
    const ch = out[i];
    mapped += PERSIAN_CHAR_MAP[ch] ?? ch;
  }
  return mapped.replace(SEPARATORS_REGEX, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Bounded Optimal String Alignment (Damerau-Levenshtein) distance.
 * Supports substitutions, insertions, deletions, and adjacent character transpositions.
 * Returns `maxDistance + 1` early if edit distance exceeds `maxDistance`.
 */
export function damerauLevenshteinBounded(
  a: string,
  b: string,
  maxDistance: number
): number {
  const lenA = a.length;
  const lenB = b.length;
  if (Math.abs(lenA - lenB) > maxDistance) return maxDistance + 1;
  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;

  const dp: number[][] = Array.from({ length: lenA + 1 }, () =>
    new Array<number>(lenB + 1).fill(0)
  );

  for (let i = 0; i <= lenA; i++) dp[i][0] = i;
  for (let j = 0; j <= lenB; j++) dp[0][j] = j;

  for (let i = 1; i <= lenA; i++) {
    let rowMin = maxDistance + 1;
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        val = Math.min(val, dp[i - 2][j - 2] + 1); // transposition
      }
      dp[i][j] = val;
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > maxDistance) {
      return maxDistance + 1;
    }
  }
  return dp[lenA][lenB];
}

/**
 * Subsequence fuzzy matcher with consecutive & word-boundary bonuses.
 * Guards against noisy matches by enforcing a compactness ratio.
 */
function subsequenceScore(query: string, target: string): number {
  if (query.length < 2 || query.length > target.length) return 0;

  let qIdx = 0;
  let firstMatch = -1;
  let lastMatch = -1;
  let consecutiveCount = 0;
  let boundaryCount = 0;
  let prevMatchIdx = -2;

  for (let tIdx = 0; tIdx < target.length && qIdx < query.length; tIdx++) {
    if (target[tIdx] === query[qIdx]) {
      if (firstMatch === -1) firstMatch = tIdx;
      lastMatch = tIdx;
      if (tIdx === prevMatchIdx + 1) {
        consecutiveCount++;
      }
      if (tIdx === 0 || target[tIdx - 1] === ' ') {
        boundaryCount++;
      }
      prevMatchIdx = tIdx;
      qIdx++;
    }
  }

  if (qIdx < query.length || firstMatch === -1) return 0;

  const span = lastMatch - firstMatch + 1;
  const compactness = query.length / span;

  // Reject loose, accidental scatter matches on short queries
  if (compactness < 0.48 && boundaryCount < 2) {
    return 0;
  }

  const base = 54;
  const compactnessBonus = Math.round(compactness * 16);
  const consecutiveBonus = Math.min(8, consecutiveCount * 2);
  const boundaryBonus = Math.min(6, boundaryCount * 3);
  return Math.min(79, base + compactnessBonus + consecutiveBonus + boundaryBonus);
}

/**
 * Computes fuzzy relevance score for a single normalized token against a normalized target token.
 */
function scoreSingleToken(qToken: string, tToken: string): number {
  if (!qToken || !tToken) return 0;
  if (tToken === qToken) return 100;
  if (tToken.startsWith(qToken)) return 93;
  if (tToken.includes(qToken)) return 84;

  const qLen = qToken.length;
  const tLen = tToken.length;

  // Typo-tolerant edit distance (supports Persian typos like «زهزا» -> «زهرا», «امیرغلی» -> «امیرعلی»)
  if (qLen >= 3) {
    const maxEdits = qLen >= 6 ? 2 : 1;
    const fullDist = damerauLevenshteinBounded(qToken, tToken, maxEdits);
    if (fullDist <= maxEdits) {
      return fullDist === 1 ? (qLen >= 5 ? 76 : 70) : 60;
    }

    // Prefix typo tolerance (e.g. typing first 4-6 letters with 1 typo matches a longer word)
    if (qLen >= 4 && tLen > qLen) {
      const prefixDist = damerauLevenshteinBounded(qToken, tToken.slice(0, qLen), 1);
      if (prefixDist <= 1) {
        return 72;
      }
      const prefixDistPlus = damerauLevenshteinBounded(
        qToken,
        tToken.slice(0, Math.min(tLen, qLen + 1)),
        1
      );
      if (prefixDistPlus <= 1) {
        return 69;
      }
    }
  }

  // Subsequence fallback inside token (e.g. «امعل» -> «امیرعلی»)
  if (qLen >= 3) {
    return subsequenceScore(qToken, tToken);
  }

  return 0;
}

/**
 * Scores a general Persian/Latin text query against a target string.
 * Returns 0 when unmatched, up to 100 for exact normalized match.
 */
export function fuzzyMatchScore(rawQuery: string, rawTarget: string): number {
  const query = normalizePersianForSearch(rawQuery);
  const target = normalizePersianForSearch(rawTarget);
  if (!query || !target) return 0;

  if (target === query) return 100;
  if (target.startsWith(query)) return 94;

  const idx = target.indexOf(query);
  if (idx >= 0) {
    const atBoundary = idx === 0 || target[idx - 1] === ' ';
    return atBoundary ? 89 : 82;
  }

  const queryTokens = query.split(' ').filter(Boolean);
  const targetTokens = target.split(' ').filter(Boolean);

  // Multi-token AND scoring (every query token must match some target token or compact target)
  let tokenTotal = 0;
  let allMatched = true;
  for (const qt of queryTokens) {
    let bestForToken = 0;
    for (const tt of targetTokens) {
      const s = scoreSingleToken(qt, tt);
      if (s > bestForToken) bestForToken = s;
    }
    if (bestForToken === 0) {
      allMatched = false;
      break;
    }
    tokenTotal += bestForToken;
  }

  let bestScore = 0;
  if (allMatched && queryTokens.length > 0) {
    const avg = Math.round(tokenTotal / queryTokens.length);
    // Slight bonus when multiple query tokens all align cleanly
    bestScore = Math.min(96, avg);
  }

  // Compact comparison (handles missing space in Persian compound names like «امیرعلی» vs «امیر علی»)
  const compactQuery = query.replace(/\s+/g, '');
  const compactTarget = target.replace(/\s+/g, '');
  if (compactQuery.length >= 3) {
    const compactTokenScore = scoreSingleToken(compactQuery, compactTarget);
    if (compactTokenScore > bestScore) {
      bestScore = compactTokenScore;
    }
  }

  // Cross-word subsequence match (e.g. «اراد رض» -> «آراد رضایی»)
  const subScore = subsequenceScore(compactQuery, compactTarget);
  if (subScore > bestScore) {
    bestScore = subScore;
  }

  return bestScore;
}

/**
 * Specialized Fuzzy Matcher for Iranian 10-digit National IDs & numeric student/room codes.
 * Supports Persian digits, ASCII digits, partial prefixes/substrings, and 1-2 digit typos.
 */
export function fuzzyNumericMatchScore(rawQuery: string, rawNumericTarget: string): number {
  const qDigits = toAsciiDigits(rawQuery).replace(/\D/g, '');
  const tDigits = toAsciiDigits(rawNumericTarget).replace(/\D/g, '');
  if (!qDigits || !tDigits) return 0;

  if (tDigits === qDigits) return 100;
  if (tDigits.startsWith(qDigits)) return 96;
  if (tDigits.includes(qDigits)) {
    return qDigits.length >= 3 ? 88 : 78;
  }

  // Typo tolerance on National IDs (only when query has at least 4 digits)
  if (qDigits.length >= 4) {
    const maxEdits = qDigits.length >= 7 ? 2 : 1;
    const fullDist = damerauLevenshteinBounded(qDigits, tDigits, maxEdits);
    if (fullDist <= maxEdits) {
      return fullDist === 1 ? 80 : 68;
    }

    // Sliding window typo tolerance (e.g., partial 5-digit entry with 1 wrong digit)
    if (qDigits.length < tDigits.length) {
      let bestWindowDist = 2;
      for (let start = 0; start <= tDigits.length - qDigits.length; start++) {
        const slice = tDigits.slice(start, start + qDigits.length);
        const dist = damerauLevenshteinBounded(qDigits, slice, 1);
        if (dist < bestWindowDist) {
          bestWindowDist = dist;
          if (bestWindowDist === 1) break;
        }
      }
      if (bestWindowDist === 1) {
        return 72;
      }
    }
  }

  return 0;
}

function getShortSchoolLabel(school: School): string {
  const parts = school.name.split('-');
  if (parts.length > 1) {
    return parts[parts.length - 1].trim();
  }
  return school.name;
}

/**
 * Executes instant cross-school fuzzy search across students, 10-digit National IDs, and classes.
 */
export function runSmartFuzzySearch(options: SmartSearchOptions): SmartSearchResult[] {
  const {
    query,
    schools,
    students,
    classes,
    teachers,
    categoryFilter = 'all',
    schoolScope = 'all',
    limit = 15,
  } = options;

  const trimmed = query.trim();
  if (!trimmed) return [];

  const schoolMap = new Map<string, School>(schools.map((s) => [s.id, s]));
  const classMap = new Map<string, ClassRoom>(classes.map((c) => [c.id, c]));
  const teacherMap = new Map<string, Teacher>(teachers.map((t) => [t.id, t]));

  // Precompute active student counts per class
  const studentCountByClass = new Map<string, number>();
  for (const st of students) {
    if (!st.active) continue;
    studentCountByClass.set(st.classId, (studentCountByClass.get(st.classId) ?? 0) + 1);
  }

  const results: SmartSearchResult[] = [];

  // 1. Search Students (by Name, National ID, Student Code, Parent Name)
  if (categoryFilter === 'all' || categoryFilter === 'student' || categoryFilter === 'national_id') {
    for (const student of students) {
      if (!student.active) continue;
      if (schoolScope !== 'all' && student.schoolId !== schoolScope) continue;

      const school = schoolMap.get(student.schoolId);
      if (!school) continue;
      const cls = classMap.get(student.classId);

      let bestScore = 0;
      let matchedField: SmartSearchMatchedField = 'نام دانش‌آموز';

      const natScore = fuzzyNumericMatchScore(trimmed, student.nationalId);
      if (natScore > bestScore) {
        bestScore = natScore;
        matchedField = 'کد ملی';
      }

      if (categoryFilter !== 'national_id') {
        const nameScore = fuzzyMatchScore(trimmed, student.fullName);
        if (nameScore > bestScore) {
          bestScore = nameScore;
          matchedField = 'نام دانش‌آموز';
        }

        const codeScore = fuzzyNumericMatchScore(trimmed, student.studentCode);
        if (codeScore > bestScore) {
          bestScore = Math.max(0, codeScore - 2);
          matchedField = 'کد دانش‌آموزی';
        }

        const parentScore = fuzzyMatchScore(trimmed, student.parentName);
        // Slightly weight student's own name above parent's name on ties
        const adjustedParentScore = parentScore > 0 ? Math.max(50, parentScore - 6) : 0;
        if (adjustedParentScore > bestScore) {
          bestScore = adjustedParentScore;
          matchedField = 'نام ولی';
        }

        // Combined fullName + className match for queries like «آراد ششم»
        if (cls && trimmed.includes(' ')) {
          const combinedScore = fuzzyMatchScore(trimmed, `${student.fullName} ${cls.name}`);
          if (combinedScore > bestScore) {
            bestScore = combinedScore;
            matchedField = 'نام دانش‌آموز';
          }
        }
      }

      if (bestScore >= 55) {
        results.push({
          id: `student:${student.id}`,
          entityType: 'student',
          schoolId: school.id,
          schoolName: school.name,
          schoolShortLabel: getShortSchoolLabel(school),
          schoolAccent: school.accent,
          classId: student.classId,
          className: cls?.name ?? 'کلاس نامشخص',
          studentId: student.id,
          title: student.fullName,
          nationalId: student.nationalId,
          studentCode: student.studentCode,
          parentName: student.parentName,
          matchedField,
          score: bestScore,
        });
      }
    }
  }

  // 2. Search Classes (by Class Name, Grade Level, Room Code, Homeroom Teacher)
  if (categoryFilter === 'all' || categoryFilter === 'class') {
    for (const cls of classes) {
      if (schoolScope !== 'all' && cls.schoolId !== schoolScope) continue;
      const school = schoolMap.get(cls.schoolId);
      if (!school) continue;
      const homeroomTeacher = teacherMap.get(cls.homeroomTeacherId);

      let bestScore = 0;
      let matchedField: SmartSearchMatchedField = 'نام کلاس';

      const classNameScore = fuzzyMatchScore(trimmed, `${cls.name} پایه ${cls.gradeLevel}`);
      if (classNameScore > bestScore) {
        bestScore = classNameScore;
        matchedField = 'نام کلاس';
      }

      const roomScore = fuzzyNumericMatchScore(trimmed, cls.roomCode);
      if (roomScore > bestScore) {
        bestScore = roomScore;
        matchedField = 'کد اتاق';
      }

      if (homeroomTeacher) {
        const teacherScore = fuzzyMatchScore(trimmed, homeroomTeacher.fullName);
        const adjustedTeacher = teacherScore > 0 ? Math.max(50, teacherScore - 4) : 0;
        if (adjustedTeacher > bestScore) {
          bestScore = adjustedTeacher;
          matchedField = 'معلم کلاس';
        }
      }

      if (bestScore >= 55) {
        results.push({
          id: `class:${cls.id}`,
          entityType: 'class',
          schoolId: school.id,
          schoolName: school.name,
          schoolShortLabel: getShortSchoolLabel(school),
          schoolAccent: school.accent,
          classId: cls.id,
          className: cls.name,
          title: cls.name,
          roomCode: cls.roomCode,
          studentCount: studentCountByClass.get(cls.id) ?? 0,
          homeroomTeacherName: homeroomTeacher?.fullName,
          matchedField,
          score: bestScore,
        });
      }
    }
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Prefer exact/high-relevance student matches before classes on identical score
    if (a.entityType !== b.entityType) {
      return a.entityType === 'student' ? -1 : 1;
    }
    return a.title.localeCompare(b.title, 'fa');
  });

  return results.slice(0, limit);
}
