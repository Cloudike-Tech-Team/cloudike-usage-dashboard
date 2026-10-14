import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsePaste, toUsageRows } from '../js/lib/paste-parser.js';

const fixture = readFileSync(new URL('./fixtures/sample-93rows.tsv', import.meta.url), 'utf8');

test('parses the 93-row fixture with header: all ok, unique monotonic weeks, labels verbatim', () => {
  const parsed = parsePaste(fixture);
  assert.equal(parsed.headerDetected, true);
  assert.equal(parsed.quotaUnit, 'TB');
  assert.deepEqual(parsed.summary, { total: 93, ok: 93, error: 0 });
  const starts = parsed.rows.map((r) => r.weekStart);
  assert.equal(new Set(starts).size, 93);
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i] > starts[i - 1], `${starts[i - 1]} < ${starts[i]}`);
  const first = parsed.rows[0];
  assert.equal(first.weekLabel, '2024년 12월 5주차');
  assert.equal(first.weekStart, '2024-12-30');            // 월요일 기록 → 직전 주
  assert.equal(first.collectedAt, '2025-01-06T00:00:00+09:00');
  assert.equal(first.totalUsers, 592);
  assert.equal(first.usageGb, 586.97);
  assert.equal(first.quotaValue, 8);
  assert.equal(first.quotaUnit, 'TB');
  assert.equal(first.quotaGb, 8192);
  const dash = parsed.rows.find((r) => r.line === 26);     // 25번 행: 트래픽 '-'
  assert.equal(dash.trafficGb, null);
  assert.equal(dash.errors.length, 0);
  const threeDecimals = parsed.rows.find((r) => r.weekLabel === '2026년 3월 4주차');
  assert.equal(threeDecimals.usageGb, 1289.112);
});

test('parses without header using default column order', () => {
  const parsed = parsePaste('1\t2026년 10월 2주차\t563\t513\t1516.16\t11.18\t8\t2026. 10. 08\n');
  assert.equal(parsed.headerDetected, false);
  assert.equal(parsed.rows[0].weekStart, '2026-10-05');
  assert.equal(parsed.rows[0].quotaGb, 8192);
});

test('parses without 번호 column when first cell is the label', () => {
  const parsed = parsePaste('2026년 10월 2주차\t563\t513\t1516.16\t11.18\t8\t2026-10-08');
  assert.equal(parsed.rows[0].totalUsers, 563);
  assert.equal(parsed.rows[0].weekStart, '2026-10-05');
});

test('trims trailing whitespace and CRLF', () => {
  const parsed = parsePaste('번호\t주차\t총 유저수\t활성 유저수\t사용량(GB)\t트래픽(GB)\t제공량(TB)\t기록 날짜\r\n1\t2026년 10월 2주차 \t563 \t513\t1,516.16\t11.18\t8\t2026. 10. 08 \r\n\r\n');
  assert.equal(parsed.summary.total, 1);
  assert.equal(parsed.rows[0].errors.length, 0);
  assert.equal(parsed.rows[0].usageGb, 1516.16);
  assert.equal(parsed.rows[0].weekLabel, '2026년 10월 2주차');
});

test('header with 제공량(GB) sets GB unit', () => {
  const parsed = parsePaste('주차\t총 유저수\t활성 유저수\t사용량(GB)\t트래픽(GB)\t제공량(GB)\t기록 날짜\n2026년 10월 2주차\t10\t9\t100\t1\t500\t2026-10-08');
  assert.equal(parsed.quotaUnit, 'GB');
  assert.equal(parsed.rows[0].quotaGb, 500);
});

test('falls back to label when record date missing (warning, not error)', () => {
  const parsed = parsePaste('주차\t총 유저수\t활성 유저수\t사용량(GB)\t트래픽(GB)\t제공량(TB)\n2026년 10월 1주차\t10\t9\t100\t1\t8');
  const r = parsed.rows[0];
  assert.equal(r.errors.length, 0);
  assert.equal(r.weekStart, '2026-09-28');
  assert.equal(r.collectedAt, null);
  assert.match(r.warnings[0], /라벨로 추정/);
});

test('reports row errors: bad label, bad numbers, non-integer users, bad date', () => {
  const parsed = parsePaste([
    '1\t10월 둘째주\t563\t513\t1516.16\t11.18\t8\t2026. 10. 08',
    '2\t2026년 10월 2주차\tabc\t513\t1516.16\t11.18\t8\t2026. 10. 08',
    '3\t2026년 10월 3주차\t563.5\t513\t1516.16\t11.18\t8\t2026. 10. 15',
    '4\t2026년 10월 4주차\t563\t513\t1516.16\t11.18\t8\t어제',
  ].join('\n'));
  assert.equal(parsed.summary.error, 4);
  assert.match(parsed.rows[0].errors[0], /주차 형식/);
  assert.match(parsed.rows[1].errors[0], /총 유저수/);
  assert.match(parsed.rows[2].errors[0], /정수/);
  assert.match(parsed.rows[3].errors[0], /기록 날짜/);
});

test('duplicate weeks inside one paste are errors on both rows', () => {
  const parsed = parsePaste('1\t2026년 10월 2주차\t1\t1\t1\t1\t8\t2026-10-08\n2\t2026년 10월 2주차\t2\t2\t2\t2\t8\t2026-10-09');
  assert.equal(parsed.summary.error, 2);
  assert.match(parsed.rows[0].errors[0], /중복/);
  assert.match(parsed.rows[0].errors[0], /2행/);
});

test('toUsageRows maps ok rows to usage_weekly insert objects', () => {
  const parsed = parsePaste('1\t2026년 10월 2주차\t563\t513\t1516.16\t-\t8\t2026. 10. 08\n2\t잘못\t1\t1\t1\t1\t8\t2026-10-01');
  const rows = toUsageRows(parsed, 42);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    company_id: 42, week_start: '2026-10-05', week_label: '2026년 10월 2주차',
    total_users: 563, active_users: 513, usage_gb: 1516.16, traffic_gb: null,
    quota_value: 8, quota_unit: 'TB', quota_gb: 8192, source: 'import',
    collected_at: '2026-10-08T00:00:00+09:00',
  });
});
