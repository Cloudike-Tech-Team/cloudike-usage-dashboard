import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('fixture has header and 93 data rows', () => {
  const text = readFileSync(new URL('./fixtures/sample-93rows.tsv', import.meta.url), 'utf8');
  const lines = text.trim().split('\n');
  assert.equal(lines.length, 94);
  assert.match(lines[0], /^번호\t주차\t/);
});
