// 스프레드시트에서 복사한 탭 구분 표 → usage_weekly 행. 라벨은 원문 보존, 주차는 기록 날짜로 결정.
import {
  parseDate, weekStartFromRecordDate, weekStartFromLabel, normalizeLabel, isWeekLabel,
  weekRangeText, kstMidnightIso,
} from './week.js';
import { parseNumber, toQuotaGb, round3 } from './units.js';

export const DEFAULT_ORDER = ['no', 'label', 'totalUsers', 'activeUsers', 'usage', 'traffic', 'quota', 'recordedAt'];
const HEADER_KEYS = [
  ['no', /번호|No\.?/i],
  ['label', /주차/],
  ['totalUsers', /총\s*(유저|사용자)|전체\s*(유저|사용자)/],
  ['activeUsers', /활성/],
  ['usage', /사용량/],
  ['traffic', /트래픽/],
  ['quota', /제공량|쿼터|할당/],
  ['recordedAt', /기록|날짜|일자/],
];

export function splitLine(line) {
  const l = line.replace(/\r$/, '');
  const cells = l.includes('\t') ? l.split('\t') : l.trim().split(/\s{2,}/);
  return cells.map((c) => c.trim());
}

export function detectHeader(cells) {
  const joined = cells.join(' ');
  return /주차/.test(joined) && /(유저|사용자|사용량|트래픽)/.test(joined) && !cells.some(isWeekLabel);
}

export function mapHeader(cells) {
  const map = {};
  let quotaUnit = 'TB';
  cells.forEach((c, i) => {
    for (const [key, re] of HEADER_KEYS) {
      if (map[key] === undefined && re.test(c)) { map[key] = i; break; }
    }
    if (/제공량|쿼터|할당/.test(c)) quotaUnit = /GB/i.test(c) ? 'GB' : 'TB';
  });
  return { map, quotaUnit };
}

function orderMap(order) { return Object.fromEntries(order.map((k, i) => [k, i])); }

export function parsePaste(text, options = {}) {
  const lines = String(text ?? '').split(/\r?\n/)
    .map((raw, i) => ({ line: i + 1, raw }))
    .filter((l) => l.raw.trim() !== '');
  let map = orderMap(DEFAULT_ORDER);
  let quotaUnit = options.quotaUnit || 'TB';
  let headerDetected = false;

  if (lines.length && detectHeader(splitLine(lines[0].raw))) {
    headerDetected = true;
    const h = mapHeader(splitLine(lines[0].raw));
    map = h.map;
    quotaUnit = options.quotaUnit || h.quotaUnit;
    lines.shift();
  } else if (lines.length && isWeekLabel(splitLine(lines[0].raw)[0] ?? '')) {
    map = orderMap(DEFAULT_ORDER.slice(1)); // 번호 열 없음
  }

  const rows = lines.map((l) => parseRow(splitLine(l.raw), map, quotaUnit, l));

  const byWeek = new Map();
  for (const r of rows) {
    if (!r.weekStart) continue;
    if (!byWeek.has(r.weekStart)) byWeek.set(r.weekStart, []);
    byWeek.get(r.weekStart).push(r);
  }
  for (const group of byWeek.values()) {
    if (group.length < 2) continue;
    for (const r of group) {
      const others = group.filter((o) => o !== r).map((o) => `${o.line}행`).join(', ');
      r.errors.push(`같은 주차(${r.weekStart})가 ${others}과 중복됩니다`);
    }
  }

  const ok = rows.filter((r) => r.errors.length === 0).length;
  return { rows, headerDetected, quotaUnit, summary: { total: rows.length, ok, error: rows.length - ok } };
}

function cellOf(cells, map, key) { const i = map[key]; return i === undefined ? undefined : cells[i]; }

function parseRow(cells, map, quotaUnit, l) {
  const r = { line: l.line, raw: l.raw, warnings: [], errors: [], collectedAt: null, weekStart: null, rangeText: '' };

  r.weekLabel = normalizeLabel(cellOf(cells, map, 'label') ?? '');
  const labelOk = isWeekLabel(r.weekLabel);
  if (!labelOk) r.errors.push('주차 형식을 해석할 수 없습니다 (예: 2026년 10월 2주차)');

  const recText = cellOf(cells, map, 'recordedAt');
  const recIso = recText ? parseDate(recText) : null;
  if (recText && !recIso) r.errors.push('기록 날짜 형식을 해석할 수 없습니다 (예: 2026. 10. 08)');

  if (recIso) {
    r.collectedAt = kstMidnightIso(recIso);
    r.weekStart = weekStartFromRecordDate(recIso);
  } else if (labelOk && !recText) {
    r.weekStart = weekStartFromLabel(r.weekLabel);
    if (r.weekStart) r.warnings.push('기록 날짜가 없어 주차 라벨로 추정했습니다');
    else r.errors.push('주차 라벨에서 날짜를 계산할 수 없습니다 (그 달에 없는 주차)');
  }
  if (r.weekStart) r.rangeText = weekRangeText(r.weekStart);

  const intField = (key, name) => {
    const v = parseNumber(cellOf(cells, map, key));
    if (Number.isNaN(v)) { r.errors.push(`${name}가 숫자가 아닙니다`); return null; }
    if (v != null && !Number.isInteger(v)) { r.errors.push(`${name}는 정수여야 합니다`); return null; }
    return v;
  };
  const numField = (key, name) => {
    const v = parseNumber(cellOf(cells, map, key));
    if (Number.isNaN(v)) { r.errors.push(`${name}이(가) 숫자가 아닙니다`); return null; }
    return round3(v);
  };
  r.totalUsers = intField('totalUsers', '총 유저수');
  r.activeUsers = intField('activeUsers', '활성 유저수');
  r.usageGb = numField('usage', '사용량');
  r.trafficGb = numField('traffic', '트래픽');
  r.quotaValue = numField('quota', '제공량');
  r.quotaUnit = r.quotaValue == null ? null : quotaUnit;
  r.quotaGb = toQuotaGb(r.quotaValue, quotaUnit);
  return r;
}

export function toUsageRows(parsed, companyId) {
  return parsed.rows.filter((r) => r.errors.length === 0).map((r) => ({
    company_id: companyId,
    week_start: r.weekStart,
    week_label: r.weekLabel,
    total_users: r.totalUsers,
    active_users: r.activeUsers,
    usage_gb: r.usageGb,
    traffic_gb: r.trafficGb,
    quota_value: r.quotaValue,
    quota_unit: r.quotaUnit,
    quota_gb: r.quotaGb,
    source: 'import',
    collected_at: r.collectedAt,
  }));
}
