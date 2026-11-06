// 트랙패드 가로 스와이프(휠 deltaX)를 제스처 단위로 묶어 방향을 판정한다.
// 반환: 1(다음) / -1(이전) / 0(아직 아님). 한 제스처(관성 포함)에서는 한 번만 넘어간다.
export function makeWheelSwipe({ threshold = 80, idleMs = 300 } = {}) {
  let acc = 0;
  let last = -Infinity;
  let fired = false;
  function startIfIdle(t) {
    if (t - last > idleMs) { acc = 0; fired = false; }
    last = t;
  }
  function feed(deltaX, deltaY, t) {
    startIfIdle(t);
    if (fired || Math.abs(deltaX) <= Math.abs(deltaY)) return 0;
    acc += deltaX;
    if (Math.abs(acc) < threshold) return 0;
    fired = true;
    return acc > 0 ? 1 : -1;
  }
  // 표 가로 스크롤 등 다른 용도로 쓰인 제스처는 끝날 때까지 넘어가지 않게 막는다.
  feed.block = (t) => { startIfIdle(t); fired = true; };
  return feed;
}

// 터치 스와이프: 왼쪽으로 밀면 다음(1), 오른쪽으로 밀면 이전(-1).
export function touchSwipeDir(dx, dy, min = 60) {
  if (Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}
