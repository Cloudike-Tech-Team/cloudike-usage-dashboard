import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeWheelSwipe, touchSwipeDir } from '../js/lib/swipe.js';

test('wheel swipe fires once per gesture after threshold', () => {
  const feed = makeWheelSwipe({ threshold: 80, idleMs: 300 });
  assert.equal(feed(30, 0, 0), 0);
  assert.equal(feed(30, 0, 16), 0);
  assert.equal(feed(30, 0, 32), 1); // 누적 90 ≥ 80 → 다음 기업
  assert.equal(feed(60, 0, 48), 0); // 같은 제스처(관성)에서는 다시 안 넘어감
  assert.equal(feed(-100, 0, 1000), -1); // 쉬었다가 반대 방향 → 이전 기업
});

test('reversing direction right after a swipe starts a new gesture', () => {
  const feed = makeWheelSwipe({ threshold: 80, idleMs: 300 });
  assert.equal(feed(100, 0, 0), 1);
  assert.equal(feed(20, 0, 16), 0); // 관성(같은 방향)은 무시
  assert.equal(feed(-50, 0, 32), 0); // 쉬지 않고 바로 반대로 밀기 시작
  assert.equal(feed(-50, 0, 48), -1); // 반대 방향으로 넘어감
  assert.equal(feed(-20, 0, 64), 0); // 그 관성도 한 번만
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

test('adjacentTab follows nav order and stops at ends', async () => {
  const { adjacentTab } = await import('../js/pager.js');
  const tabs = [{ view: 'dashboard' }, { view: 'weekly' }, { view: 'companies' }];
  assert.equal(adjacentTab(tabs, 'dashboard', 1).view, 'weekly');
  assert.equal(adjacentTab(tabs, 'weekly', -1).view, 'dashboard');
  assert.equal(adjacentTab(tabs, 'dashboard', -1), null);
  assert.equal(adjacentTab(tabs, 'companies', 1), null);
});

// 실제 macOS 트랙패드 기록: 왼쪽 → 오른쪽 → 오른쪽을 쉬지 않고 연달아 밈(관성에 이어 다음 제스처 시작)
test('back-to-back trackpad swipes from a real recording each switch once', () => {
  const events = JSON.parse(readFileSync(new URL('./fixtures/mac-trackpad-wheel.json', import.meta.url), 'utf8'));
  const feed = makeWheelSwipe();
  const fired = events.map(([t, dx, dy]) => feed(dx, dy, t)).filter(Boolean);
  assert.deepEqual(fired, [-1, 1, 1]);
});

test('momentum after a frame gap does not switch twice', () => {
  const feed = makeWheelSwipe();
  assert.equal(feed(60, 0, 0), 0);
  assert.equal(feed(60, 0, 13), 1);
  assert.equal(feed(50, 0, 80), 0); // 렌더링으로 끊겼다 이어진 관성(약해지는 중)
  assert.equal(feed(45, 0, 93), 0);
  assert.equal(feed(40, 0, 106), 0);
});
