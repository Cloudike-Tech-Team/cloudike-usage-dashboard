import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNumber, round3, toQuotaGb, quotaDisplayParts, formatGb, formatQuota, formatInt } from '../js/lib/units.js';

test('parseNumber strips thousands separators and treats dashes as null', () => {
  assert.equal(parseNumber('1,516.16'), 1516.16);
  assert.equal(parseNumber(' 592 '), 592);
  assert.equal(parseNumber('-'), null);
  assert.equal(parseNumber('—'), null);
  assert.equal(parseNumber(''), null);
  assert.equal(parseNumber(undefined), null);
  assert.ok(Number.isNaN(parseNumber('abc')));
  assert.ok(Number.isNaN(parseNumber('12.3.4')));
});

test('round3 and quota conversion', () => {
  assert.equal(round3(1289.112), 1289.112);
  assert.equal(round3(1.23456), 1.235);
  assert.equal(round3(null), null);
  assert.equal(toQuotaGb(8, 'TB'), 8192);
  assert.equal(toQuotaGb(500, 'GB'), 500);
  assert.equal(toQuotaGb(1.5, 'TB'), 1536);
  assert.equal(toQuotaGb(null, 'TB'), null);
});

test('quota display: TB from 1024 GB, GB below', () => {
  assert.deepEqual(quotaDisplayParts(1023.99), { value: 1023.99, unit: 'GB' });
  assert.deepEqual(quotaDisplayParts(1024), { value: 1, unit: 'TB' });
  assert.deepEqual(quotaDisplayParts(8192), { value: 8, unit: 'TB' });
  assert.deepEqual(quotaDisplayParts(1536), { value: 1.5, unit: 'TB' });
  assert.equal(quotaDisplayParts(null), null);
  assert.equal(formatQuota(8192), '8 TB');
  assert.equal(formatQuota(500), '500 GB');
  assert.equal(formatQuota(null), '-');
});

test('formatGb / formatInt use ko-KR grouping', () => {
  assert.equal(formatGb(1516.16), '1,516.16 GB');
  assert.equal(formatGb(1289.112), '1,289.11 GB');
  assert.equal(formatGb(null), '-');
  assert.equal(formatInt(1234), '1,234');
  assert.equal(formatInt(null), '-');
});
