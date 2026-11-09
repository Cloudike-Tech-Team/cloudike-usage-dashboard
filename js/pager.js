import { makeWheelSwipe, touchSwipeDir } from './lib/swipe.js';

const CHEVRON = { [-1]: 'M15 6l-6 6 6 6', [1]: 'M9 6l6 6-6 6' };

// 탭 순서(#nav) 기준 dir 방향의 옆 탭. 없으면 null.
export function adjacentTab(tabs, current, dir) {
  const i = tabs.findIndex((t) => t.view === current);
  return i < 0 ? null : tabs[i + dir] || null;
}

// target에서 위로 올라가며 dx 방향으로 더 스크롤될 수 있는 가로 스크롤 영역을 찾는다.
function scrollableX(target, dx) {
  for (let n = target instanceof Element ? target : null; n && n !== document.body; n = n.parentElement) {
    if (n.scrollWidth <= n.clientWidth + 1 || !/auto|scroll/.test(getComputedStyle(n).overflowX)) continue;
    if (dx == null) return n;
    if (dx > 0 ? n.scrollLeft + n.clientWidth < n.scrollWidth - 1 : n.scrollLeft > 0) return n;
  }
  return null;
}
const isFormField = (t) => t instanceof Element && !!t.closest('input, select, textarea');

// 모든 화면 양옆 화살표 + 가로 스와이프. 현재 화면이 handler로 먼저 처리(예: 주차별 데이터의 기업 전환)하고,
// 처리하지 않으면 옆 탭으로 이동한다.
// handler: { step(dir) → 처리했으면 true, label(dir) → 버튼 설명 또는 null }
export function createPager({ host, getCurrent, navigate }) {
  const tabs = () => [...document.querySelectorAll('#nav .tab')].map((b) => ({ view: b.dataset.view, label: b.textContent.trim() }));
  let handler = null;
  const buttons = [-1, 1].map((dir) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `page-nav ${dir < 0 ? 'prev' : 'next'}`;
    b.innerHTML = `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="${CHEVRON[dir]}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    b.addEventListener('click', () => step(dir));
    host.append(b);
    return [b, dir];
  });

  function step(dir) {
    if (handler?.step(dir)) return refresh();
    const tab = adjacentTab(tabs(), getCurrent(), dir);
    if (tab) navigate(tab.view);
  }
  function refresh() {
    for (const [b, dir] of buttons) {
      const own = handler?.label(dir) || null;
      const tab = own ? null : adjacentTab(tabs(), getCurrent(), dir);
      const label = own || (tab ? `${tab.label}(으)로 이동` : '');
      b.hidden = !label;
      b.title = label;
      b.setAttribute('aria-label', label);
      b.classList.toggle('edge', !own); // 점선: 탭 이동
    }
  }

  const wheelSwipe = makeWheelSwipe();
  host.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || isFormField(e.target)) return;
    if (scrollableX(e.target, e.deltaX)) { wheelSwipe.block(e.timeStamp); return; } // 표 등 가로 스크롤 우선
    e.preventDefault();
    const dir = wheelSwipe(e.deltaX, e.deltaY, e.timeStamp);
    if (dir) step(dir);
  }, { passive: false });
  let touch = null;
  host.addEventListener('touchstart', (e) => {
    const p = e.touches[0];
    const area = scrollableX(e.target);
    touch = e.touches.length === 1 && !isFormField(e.target)
      ? { x: p.clientX, y: p.clientY, area, left: area?.scrollLeft } : null;
  }, { passive: true });
  host.addEventListener('touchend', (e) => {
    if (!touch) return;
    const p = e.changedTouches[0];
    const scrolled = touch.area && touch.area.scrollLeft !== touch.left; // 가로 스크롤한 터치는 제외
    const dir = scrolled ? 0 : touchSwipeDir(p.clientX - touch.x, p.clientY - touch.y);
    touch = null;
    if (dir) step(dir);
  });

  return {
    set(h) { handler = h; refresh(); },
    refresh,
  };
}
