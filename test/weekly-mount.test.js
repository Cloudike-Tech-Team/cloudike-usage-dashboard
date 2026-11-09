import test from 'node:test';
import assert from 'node:assert/strict';

// mount()가 실제로 끝까지 실행돼 행을 그리는지 확인하기 위한 최소 가짜 DOM
class Node {
  constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this.listeners = {}; this.textContent = ''; this.isConnected = true; this.classList = { toggle() {} }; }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener(t, f) { this.listeners[t] = f; }
  append(...c) { this.children.push(...c.map((x) => (typeof x === 'string' ? Object.assign(new Node('#text'), { textContent: x }) : x))); }
  replaceChildren(...c) { this.children = []; this.append(...c); }
  replaceWith() {}
}
globalThis.document = { createElement: (t) => new Node(t), getElementById: () => null };

const find = (n, tag, out = []) => { if (n.tagName === tag) out.push(n); n.children.forEach((c) => find(c, tag, out)); return out; };

test('weekly mount renders rows and registers pager handler', async () => {
  const { mount } = await import('../js/views/weekly.js');
  const companies = [{ company_id: 1, name: 'A' }, { company_id: 2, name: 'B' }];
  let handler = null;
  let loaded;
  const done = new Promise((r) => { loaded = r; });
  const ctx = {
    companies: async () => companies,
    navigate() {},
    pager: { set(h) { handler = h; }, refresh() {} },
    db: { listWeekly: async () => { setTimeout(loaded); return { data: [
      { id: 1, week_start: '2026-11-02', week_label: '26-45', total_users: 10, active_users: 5, usage_gb: 1, traffic_gb: 1, quota_gb: 1024, quota_unit: 'TB', quota_value: 1, source: 'auto', collected_at: null, note: '' },
    ], error: null }; } },
  };
  const root = new Node('div');
  await mount(root, ctx);
  await done;
  const tbody = find(root, 'tbody')[0];
  assert.equal(tbody.children.length, 1);
  assert.equal(tbody.children[0].children[0].textContent, '26-45');
  assert.equal(handler.label(-1), null); // 첫 기업 → 옆 탭으로 넘김
  assert.equal(handler.label(1), '다음 기업: B');
  assert.equal(handler.step(-1), false);
});
