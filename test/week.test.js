import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDate, addDays, weekdayIndex, mondayOf, isMonday, weekStartFromRecordDate,
  weekLabel, weekStartFromLabel, normalizeLabel, weekRangeText, todayKST,
  currentWeekStartKST, kstMidnightIso,
} from '../js/lib/week.js';

test('parseDate accepts spreadsheet formats', () => {
  assert.equal(parseDate('2025. 01. 06 '), '2025-01-06');
  assert.equal(parseDate('2025-01-06'), '2025-01-06');
  assert.equal(parseDate('2025.1.6'), '2025-01-06');
  assert.equal(parseDate('2025/1/6'), '2025-01-06');
  assert.equal(parseDate('2025. 02. 30'), null);
  assert.equal(parseDate('어제'), null);
  assert.equal(parseDate(''), null);
});

test('weekday helpers', () => {
  assert.equal(weekdayIndex('2026-10-12'), 0); // 월
  assert.equal(weekdayIndex('2026-10-18'), 6); // 일
  assert.equal(mondayOf('2026-10-15'), '2026-10-12');
  assert.equal(mondayOf('2026-10-12'), '2026-10-12');
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.ok(isMonday('2026-10-12'));
  assert.ok(!isMonday('2026-10-13'));
});

test('weekStartFromRecordDate: Wed-Sun same week, Mon-Tue previous week', () => {
  assert.equal(weekStartFromRecordDate('2025-01-10'), '2025-01-06'); // 금
  assert.equal(weekStartFromRecordDate('2025-10-02'), '2025-09-29'); // 목
  assert.equal(weekStartFromRecordDate('2025-01-06'), '2024-12-30'); // 월 → 직전 주
  assert.equal(weekStartFromRecordDate('2025-02-25'), '2025-02-17'); // 화 → 직전 주
  assert.equal(weekStartFromRecordDate('2025-02-26'), '2025-02-24'); // 수
});

test('weekLabel uses Thursday rule', () => {
  assert.equal(weekLabel('2026-09-28'), '2026년 10월 1주차'); // 목 10/01
  assert.equal(weekLabel('2026-10-05'), '2026년 10월 2주차');
  assert.equal(weekLabel('2025-10-27'), '2025년 10월 5주차'); // 목 10/30
  assert.equal(weekLabel('2025-12-29'), '2026년 1월 1주차');  // 목 01/01
  assert.equal(weekLabel('2026-06-29'), '2026년 7월 1주차');  // 목 07/02
  assert.equal(weekLabel('2026-07-27'), '2026년 7월 5주차');  // 목 07/30
});

test('weekStartFromLabel inverts weekLabel', () => {
  for (const ws of ['2026-09-28', '2026-10-05', '2025-10-27', '2025-12-29', '2026-07-27']) {
    assert.equal(weekStartFromLabel(weekLabel(ws)), ws);
  }
  assert.equal(weekStartFromLabel('2026년 10월  2주차'), '2026-10-05'); // 공백 변형
  assert.equal(weekStartFromLabel('2025년 10월 6주차'), null);        // 없는 주차
  assert.equal(weekStartFromLabel('10월 2주차'), null);
});

test('normalizeLabel and weekRangeText', () => {
  assert.equal(normalizeLabel('  2026년  10월 2주차 '), '2026년 10월 2주차');
  assert.equal(weekRangeText('2026-10-05'), '10/05~10/11');
  assert.equal(weekRangeText('2025-12-29'), '12/29~01/04');
});

test('todayKST / currentWeekStartKST crosses midnight in KST', () => {
  const sundayLateUtc = new Date('2026-10-11T15:30:00Z'); // KST 월요일 00:30
  assert.equal(todayKST(sundayLateUtc), '2026-10-12');
  assert.equal(currentWeekStartKST(sundayLateUtc), '2026-10-12');
  const fridayUtc = new Date('2026-10-16T00:05:00Z'); // KST 금요일 09:05
  assert.equal(currentWeekStartKST(fridayUtc), '2026-10-12');
  assert.equal(kstMidnightIso('2025-01-06'), '2025-01-06T00:00:00+09:00');
});
