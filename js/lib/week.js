// 주차 계산. 모든 날짜는 'YYYY-MM-DD' 문자열로 주고받고 내부는 Date.UTC만 쓴다(타임존 영향 없음).
export const DAY_MS = 86400000;
const KST_OFFSET_MS = 9 * 3600000;
const LABEL_RE = /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d)\s*주차/;

export function toIso(dt) { return dt.toISOString().slice(0, 10); }
export function fromIso(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }

export function parseDate(text) {
  if (text == null) return null;
  const m = String(text).trim().match(/^(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\s*\.?$/);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return toIso(dt);
}

export function addDays(iso, n) { return toIso(new Date(fromIso(iso).getTime() + n * DAY_MS)); }
export function weekdayIndex(iso) { return (fromIso(iso).getUTCDay() + 6) % 7; } // 월=0 … 일=6
export function mondayOf(iso) { return addDays(iso, -weekdayIndex(iso)); }
export function isMonday(iso) { return weekdayIndex(iso) === 0; }

// 금요일 수집이 다음 주 월·화에 늦게 기록된 경우 직전 주로 판정한다.
export function weekStartFromRecordDate(iso) {
  const mon = mondayOf(iso);
  return weekdayIndex(iso) <= 1 ? addDays(mon, -7) : mon;
}

// 목요일 규칙: 그 주 목요일이 속한 달, N = 그 달의 몇 번째 목요일
export function weekLabel(weekStart) {
  const thu = fromIso(addDays(weekStart, 3));
  const n = Math.floor((thu.getUTCDate() - 1) / 7) + 1;
  return `${thu.getUTCFullYear()}년 ${thu.getUTCMonth() + 1}월 ${n}주차`;
}

export function weekStartFromLabel(label) {
  const m = String(label ?? '').match(LABEL_RE);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), n = Number(m[3]);
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const firstThuDay = 1 + ((4 - first.getUTCDay() + 7) % 7);
  const thu = new Date(Date.UTC(y, mo - 1, firstThuDay + 7 * (n - 1)));
  if (thu.getUTCMonth() !== mo - 1) return null;
  return addDays(toIso(thu), -3);
}

export function isWeekLabel(text) { return LABEL_RE.test(String(text ?? '')); }
export function normalizeLabel(label) { return String(label ?? '').replace(/\s+/g, ' ').trim(); }

export function weekRangeText(weekStart) {
  const f = (iso) => { const d = fromIso(iso); return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`; };
  return `${f(weekStart)}~${f(addDays(weekStart, 6))}`;
}

export function todayKST(now = new Date()) { return toIso(new Date(now.getTime() + KST_OFFSET_MS)); }
export function currentWeekStartKST(now = new Date()) { return mondayOf(todayKST(now)); }
export function kstMidnightIso(iso) { return `${iso}T00:00:00+09:00`; }

// 'YYYY-MM-DD' → '2026. 10. 12' (화면 표시용)
export function formatDateKo(iso) {
  if (!iso) return '-';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${y}. ${m}. ${d}`;
}
