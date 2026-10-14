import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Element.replaceChildren(...nodes) takes separate nodes; an array argument is stringified.
const files = [
  ...readdirSync(new URL('../js/views/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => `../js/views/${f}`),
  '../js/app.js',
];

test('replaceChildren is never passed an un-spread .map() array', () => {
  for (const f of files) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /replaceChildren\((?!\.\.\.)[^()]*\.map\(/, `${f}: spread the array into replaceChildren(...)`);
  }
});
