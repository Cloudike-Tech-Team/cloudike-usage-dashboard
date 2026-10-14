import { isMonday, normalizeLabel, isWeekLabel } from './week.js';
import { parseNumber, round3, toQuotaGb } from './units.js';

export function validateWeeklyInput(input) {
  const errors = [];
  const weekStart = String(input.weekStart || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !isMonday(weekStart)) errors.push('주차 시작일은 월요일 날짜여야 합니다');
  const weekLabel = normalizeLabel(input.weekLabel);
  if (!weekLabel) errors.push('주차 라벨을 입력하세요');
  else if (!isWeekLabel(weekLabel)) errors.push('주차 라벨 형식은 "2026년 10월 2주차"처럼 입력하세요');

  const int = (v, name) => {
    const n = parseNumber(v);
    if (Number.isNaN(n)) { errors.push(`${name}는 숫자여야 합니다`); return null; }
    if (n != null && !Number.isInteger(n)) { errors.push(`${name}는 정수여야 합니다`); return null; }
    if (n != null && n < 0) { errors.push(`${name}는 0 이상이어야 합니다`); return null; }
    return n;
  };
  const num = (v, name) => {
    const n = parseNumber(v);
    if (Number.isNaN(n)) { errors.push(`${name}은(는) 숫자여야 합니다`); return null; }
    if (n != null && n < 0) { errors.push(`${name}은(는) 0 이상이어야 합니다`); return null; }
    return round3(n);
  };
  const total_users = int(input.totalUsers, '총 유저수');
  const active_users = int(input.activeUsers, '활성 유저수');
  const usage_gb = num(input.usageGb, '사용량');
  const traffic_gb = num(input.trafficGb, '트래픽');
  const quota_value = num(input.quotaValue, '제공량');
  const quota_unit = quota_value == null ? null : (input.quotaUnit === 'GB' ? 'GB' : 'TB');
  const quota_gb = toQuotaGb(quota_value, quota_unit);
  const note = String(input.note ?? '').trim() || null;

  if (errors.length) return { ok: false, errors };
  return { ok: true, fields: { week_start: weekStart, week_label: weekLabel, total_users, active_users, usage_gb, traffic_gb, quota_value, quota_unit, quota_gb, note } };
}
