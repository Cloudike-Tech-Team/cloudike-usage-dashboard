import { weekLabel, addDays } from './week.js';

const num = (v) => (v == null || v === '' ? null : Number(v));

export function filterByWeeks(rows, weeks) {
  if (!weeks || !rows.length) return rows;
  const latest = rows.reduce((m, r) => (r.week_start > m ? r.week_start : m), rows[0].week_start);
  const cutoff = addDays(latest, -7 * (weeks - 1));
  return rows.filter((r) => r.week_start >= cutoff);
}

export function buildSeries(rows, companies, metric) {
  const weekStarts = [...new Set(rows.map((r) => r.week_start))].sort();
  const labelFor = new Map();
  for (const r of rows) {
    if (!labelFor.has(r.week_start) && r.week_label) labelFor.set(r.week_start, r.week_label);
  }
  const labels = weekStarts.map((w) => labelFor.get(w) || weekLabel(w));
  const datasets = companies.map((c) => {
    const byWeek = new Map(rows.filter((r) => r.company_id === c.company_id).map((r) => [r.week_start, num(r[metric])]));
    return { companyId: c.company_id, label: c.name, data: weekStarts.map((w) => (byWeek.has(w) ? byWeek.get(w) : null)) };
  });
  return { weekStarts, labels, datasets };
}

export function latestRowsByCompany(rows) {
  const m = new Map();
  for (const r of rows) {
    const cur = m.get(r.company_id);
    if (!cur || r.week_start > cur.week_start) m.set(r.company_id, r);
  }
  return m;
}
