// 단위 규칙: 1024 기반. 사용량·트래픽은 항상 GB, 제공량은 1024 GB 이상이면 TB.
export const GB_PER_TB = 1024;
const nf2 = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });

export function parseNumber(text) {
  if (text == null) return null;
  const t = String(text).trim().replace(/,/g, '');
  if (t === '' || t === '-' || t === '—' || t === '–') return null;
  if (!/^-?\d+(\.\d+)?$/.test(t)) return NaN;
  return Number(t);
}

export function round3(n) { return n == null ? null : Math.round(Number(n) * 1000) / 1000; }
export function round2(n) { return n == null ? null : Math.round(Number(n) * 100) / 100; }

export function toQuotaGb(value, unit) {
  if (value == null) return null;
  return round3(unit === 'TB' ? Number(value) * GB_PER_TB : Number(value));
}

export function quotaDisplayParts(quotaGb) {
  if (quotaGb == null) return null;
  const gb = Number(quotaGb);
  return gb >= GB_PER_TB ? { value: round2(gb / GB_PER_TB), unit: 'TB' } : { value: round2(gb), unit: 'GB' };
}

export function formatGb(n) { return n == null ? '-' : `${nf2.format(Number(n))} GB`; }
export function formatQuota(quotaGb) { const p = quotaDisplayParts(quotaGb); return p ? `${nf2.format(p.value)} ${p.unit}` : '-'; }
export function formatInt(n) { return n == null ? '-' : nf0.format(Number(n)); }
