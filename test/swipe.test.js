import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWheelSwipe, touchSwipeDir } from '../js/lib/swipe.js';

test('wheel swipe fires once per gesture after threshold', () => {
  const feed = makeWheelSwipe({ threshold: 80, idleMs: 300 });
  assert.equal(feed(30, 0, 0), 0);
  assert.equal(feed(30, 0, 16), 0);
  assert.equal(feed(30, 0, 32), 1); // 누적 90 ≥ 80 → 다음 기업
  assert.equal(feed(60, 0, 48), 0); // 같은 제스처(관성)에서는 다시 안 넘어감
  assert.equal(feed(-100, 0, 1000), -1); // 쉬었다가 반대 방향 → 이전 기업
});

test('wheel swipe ignores mostly-vertical scrolling', () => {
  const feed = makeWheelSwipe({ threshold: 80 });
  assert.equal(feed(50, 120, 0), 0);
  assert.equal(feed(50, 120, 16), 0);
});

test('blocked gesture does not switch until idle', () => {
  const feed = makeWheelSwipe({ threshold: 80, idleMs: 300 });
  feed.block(0); // 표 가로 스크롤에 쓰인 제스처
  assert.equal(feed(200, 0, 16), 0);
  assert.equal(feed(200, 0, 500), 1);
});

test('touch swipe direction', () => {
  assert.equal(touchSwipeDir(-100, 10), 1); // 왼쪽으로 밀기 → 다음
  assert.equal(touchSwipeDir(100, 10), -1);
  assert.equal(touchSwipeDir(30, 0), 0); // 너무 짧음
  assert.equal(touchSwipeDir(-100, 90), 0); // 세로에 가까움
});
