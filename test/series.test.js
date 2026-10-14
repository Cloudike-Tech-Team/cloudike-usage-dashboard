import test from 'node:test';
import assert from 'node:assert/strict';
import { filterByWeeks, buildSeries, latestRowsByCompany } from '../js/lib/series.js';

const rows = [
  { company_id: 1, week_start: '2026-09-28', week_label: '2026년 10월 1주차', usage_gb: 100, traffic_gb: 5 },
  { company_id: 1, week_start: '2026-10-05', week_label: '2026년 10월 2주차', usage_gb: '110.5', traffic_gb: null },
  { company_id: 2, week_start: '2026-10-05', week_label: '2026년 10월 2주차', usage_gb: 50, traffic_gb: 1 },
  { company_id: 2, week_start: '2026-10-12', week_label: '', usage_gb: 55, traffic_gb: 2 },
];
const companies = [{ company_id: 1, name: '가나다' }, { company_id: 2, name: '라마바' }];

test('buildSeries unions weeks, fills gaps with null, coerces numbers, falls back label', () => {
  const s = buildSeries(rows, companies, 'usage_gb');
  assert.deepEqual(s.weekStarts, ['2026-09-28', '2026-10-05', '2026-10-12']);
  assert.deepEqual(s.labels, ['2026년 10월 1주차', '2026년 10월 2주차', '2026년 10월 3주차']);
  assert.deepEqual(s.datasets[0], { companyId: 1, label: '가나다', data: [100, 110.5, null] });
  assert.deepEqual(s.datasets[1], { companyId: 2, label: '라마바', data: [null, 50, 55] });
  const t = buildSeries(rows, companies, 'traffic_gb');
  assert.deepEqual(t.datasets[0].data, [5, null, null]);
});

test('filterByWeeks keeps the latest N weeks relative to the newest row', () => {
  assert.equal(filterByWeeks(rows, 2).length, 3);
  assert.deepEqual(filterByWeeks(rows, 1).map((r) => r.week_start), ['2026-10-12']);
  assert.equal(filterByWeeks(rows, null).length, 4);
  assert.deepEqual(filterByWeeks([], 12), []);
});

test('latestRowsByCompany picks the newest week per company', () => {
  const m = latestRowsByCompany(rows);
  assert.equal(m.get(1).week_start, '2026-10-05');
  assert.equal(m.get(2).week_start, '2026-10-12');
});
