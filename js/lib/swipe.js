// 트랙패드 가로 스와이프(휠 deltaX)를 제스처 단위로 묶어 방향을 판정한다.
// 반환: 1(다음) / -1(이전) / 0(아직 아님). 한 제스처(관성 포함)에서는 한 번만 넘어간다.
// macOS는 관성 입력에 바로 이어 다음 제스처가 시작되므로(간격 ~40ms), 입력이 쉬는 것만으로는 구분할 수 없다.
// 넘어간 뒤에는 ① 반대 방향 입력, ② 입력이 잠깐 끊긴(gapMs) 뒤 세기가 다시 커짐 을 새 제스처로 본다.
// 관성은 방향이 바뀌지 않고 세기가 줄어들기만 한다.
export function makeWheelSwipe({ threshold = 80, idleMs = 300, gapMs = 30, rise = 20 } = {}) {
  let acc = 0;
  let last = -Infinity;
  let fired = 0; // 이번 제스처에서 넘어간 방향(1/-1), 막힘은 true, 아직이면 0
  let floor = null; // 끊김 이후 관찰한 가장 약한 세기(새 제스처 판별용)
  function reset() { acc = 0; fired = 0; floor = null; }
  function track(dx, t) {
    const gap = t - last;
    last = t;
    if (gap > idleMs) return reset();
    if (!fired) return;
    const mag = Math.abs(dx);
    if (typeof fired === 'number' && fired * dx < 0) return reset();
    if (gap >= gapMs) floor = mag;
    else if (floor != null) {
      if (mag >= floor + rise) return reset();
      floor = Math.min(floor, mag);
    }
  }
  function feed(deltaX, deltaY, t) {
    if (Math.abs(deltaX) <= Math.abs(deltaY)) { if (t - last > idleMs) reset(); last = t; return 0; }
    track(deltaX, t);
    if (fired) return 0;
    acc += deltaX;
    if (Math.abs(acc) < threshold) return 0;
    fired = acc > 0 ? 1 : -1;
    floor = null;
    return fired;
  }
  // 표 가로 스크롤 등 다른 용도로 쓰인 제스처는 끝날 때까지 넘어가지 않게 막는다.
  feed.block = (t) => { if (t - last > idleMs) reset(); last = t; fired = true; floor = null; };
  return feed;
}

// 터치 스와이프: 왼쪽으로 밀면 다음(1), 오른쪽으로 밀면 이전(-1).
export function touchSwipeDir(dx, dy, min = 60) {
  if (Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}
