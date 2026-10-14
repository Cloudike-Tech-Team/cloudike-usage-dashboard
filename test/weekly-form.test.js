import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWeeklyInput } from '../js/lib/weekly-form.js';

const base = { weekStart: '2026-10-05', weekLabel: '2026년 10월 2주차', totalUsers: '563', activeUsers: '513', usageGb: '1,516.16', trafficGb: '-', quotaValue: '8', quotaUnit: 'TB', note: ' 메모 ' };

test('valid input → snake_case fields with normalized numbers', () => {
  const r = validateWeeklyInput(base);
  assert.equal(r.ok, true);
  assert.deepEqual(r.fields, {
    week_start: '2026-10-05', week_label: '2026년 10월 2주차', total_users: 563, active_users: 513,
    usage_gb: 1516.16, traffic_gb: null, quota_value: 8, quota_unit: 'TB', quota_gb: 8192, note: '메모',
  });
});

test('non-Monday week_start, empty label, bad numbers, negative are errors', () => {
  const r = validateWeeklyInput({ ...base, weekStart: '2026-10-06', weekLabel: '', totalUsers: '12.5', usageGb: 'abc', trafficGb: '-3' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /월요일/.test(e)));
  assert.ok(r.errors.some((e) => /라벨/.test(e)));
  assert.ok(r.errors.some((e) => /총 유저수/.test(e)));
  assert.ok(r.errors.some((e) => /사용량/.test(e)));
  assert.ok(r.errors.some((e) => /트래픽.*0 이상/.test(e)));
});

test('quota without value stores null unit and gb', () => {
  const r = validateWeeklyInput({ ...base, quotaValue: '', quotaUnit: 'TB' });
  assert.equal(r.fields.quota_value, null);
  assert.equal(r.fields.quota_unit, null);
  assert.equal(r.fields.quota_gb, null);
});
