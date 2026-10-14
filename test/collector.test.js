import test from 'node:test';
import assert from 'node:assert/strict';
import { usageRowFromApi, fetchCompanyUsage, collectAll } from '../scripts/lib/collector.js';

const apiJson = { company_id: 7, total_users: 42, active_users: 38, usage_gb: 512.37, traffic_gb: 120.5, quota_value: 2, quota_unit: 'TB', quota_gb: 2048 };
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
const noSleep = async () => {};

test('usageRowFromApi maps the NRF-5058 response', () => {
  const row = usageRowFromApi(apiJson, { companyId: 7, weekStart: '2026-10-12', weekLabel: '2026년 10월 3주차', collectedAt: '2026-10-16T00:00:00.000Z' });
  assert.deepEqual(row, {
    company_id: 7, week_start: '2026-10-12', week_label: '2026년 10월 3주차',
    total_users: 42, active_users: 38, usage_gb: 512.37, traffic_gb: 120.5,
    quota_value: 2, quota_unit: 'TB', quota_gb: 2048, source: 'auto',
    collected_at: '2026-10-16T00:00:00.000Z', note: null,
  });
});

test('fetchCompanyUsage builds the URL with company_id and api_token', async () => {
  let seen;
  const fetchFn = async (url) => { seen = url; return res(200, apiJson); };
  const r = await fetchCompanyUsage({ fetchFn, apiBase: 'https://api.gov.cloudike.kr/', apiToken: 't k', companyId: 7, sleep: noSleep });
  assert.equal(r.ok, true);
  assert.equal(seen, 'https://api.gov.cloudike.kr/api/1/analytics/company_usage_summary/?company_id=7&api_token=t%20k');
});

test('fetchCompanyUsage: 404/403 are not retried, 5xx retries then fails', async () => {
  let calls = 0;
  const r404 = await fetchCompanyUsage({ fetchFn: async () => { calls++; return res(404, {}); }, apiBase: 'x', apiToken: 't', companyId: 1, sleep: noSleep });
  assert.deepEqual([r404.ok, r404.error, calls], [false, '기업 없음(404)', 1]);
  calls = 0;
  const r403 = await fetchCompanyUsage({ fetchFn: async () => { calls++; return res(403, {}); }, apiBase: 'x', apiToken: 't', companyId: 1, sleep: noSleep });
  assert.deepEqual([r403.ok, r403.error, calls], [false, 'API 토큰 거부(403)', 1]);
  calls = 0;
  const r500 = await fetchCompanyUsage({ fetchFn: async () => { calls++; return res(500, {}); }, apiBase: 'x', apiToken: 't', companyId: 1, retries: 3, sleep: noSleep });
  assert.equal(r500.ok, false);
  assert.equal(calls, 3);
  assert.match(r500.error, /HTTP 500/);
});

test('fetchCompanyUsage recovers when a retry succeeds', async () => {
  let calls = 0;
  const fetchFn = async () => { calls++; if (calls < 2) throw new Error('ECONNRESET'); return res(200, apiJson); };
  const r = await fetchCompanyUsage({ fetchFn, apiBase: 'x', apiToken: 't', companyId: 1, sleep: noSleep });
  assert.equal(r.ok, true);
  assert.equal(calls, 2);
});

test('collectAll continues after a failure and reports partial status', async () => {
  const companies = [{ company_id: 1, name: '가' }, { company_id: 2, name: '나' }, { company_id: 3, name: '다' }];
  const fetchFn = async (url) => (url.includes('company_id=2') ? res(404, {}) : res(200, { ...apiJson }));
  const out = await collectAll({ fetchFn, companies, apiBase: 'x', apiToken: 't', weekStart: '2026-10-12', now: new Date('2026-10-16T00:00:00Z'), sleep: noSleep });
  assert.equal(out.status, 'partial');
  assert.equal(out.successCount, 2);
  assert.equal(out.failureCount, 1);
  assert.equal(out.rows.length, 2);
  assert.equal(out.rows[0].week_label, '2026년 10월 3주차');
  assert.equal(out.rows[0].collected_at, '2026-10-16T00:00:00.000Z');
  assert.match(out.message, /나\(2\): 기업 없음\(404\)/);
});

test('collectAll: all fail → failed, all ok → success, none → success', async () => {
  const companies = [{ company_id: 1, name: '가' }];
  const failed = await collectAll({ fetchFn: async () => res(404, {}), companies, apiBase: 'x', apiToken: 't', weekStart: '2026-10-12', sleep: noSleep });
  assert.equal(failed.status, 'failed');
  const ok = await collectAll({ fetchFn: async () => res(200, apiJson), companies, apiBase: 'x', apiToken: 't', weekStart: '2026-10-12', sleep: noSleep });
  assert.equal(ok.status, 'success');
  assert.match(ok.message, /1개 기업 수집 완료/);
  const none = await collectAll({ fetchFn: async () => res(200, apiJson), companies: [], apiBase: 'x', apiToken: 't', weekStart: '2026-10-12', sleep: noSleep });
  assert.equal(none.status, 'success');
  assert.match(none.message, /활성 기업이 없습니다/);
});

test('fetchCompanyUsage passes signal with timeout and retries AbortError', async () => {
  let calls = 0;
  let seenSignal = null;
  const fetchFn = async (url, init) => {
    calls++;
    seenSignal = init.signal;
    assert(init.signal instanceof AbortSignal, 'signal must be an AbortSignal');
    if (calls < 2) throw new DOMException('The operation was aborted', 'AbortError');
    return res(200, apiJson);
  };
  const r = await fetchCompanyUsage({ fetchFn, apiBase: 'x', apiToken: 't', companyId: 1, retries: 3, sleep: noSleep, timeoutMs: 5000 });
  assert.equal(r.ok, true);
  assert.equal(calls, 2);
  assert(seenSignal instanceof AbortSignal, 'seenSignal must be an AbortSignal');
});

test('fetchCompanyUsage with repeated AbortError eventually fails as 요청 실패', async () => {
  let calls = 0;
  const fetchFn = async () => {
    calls++;
    throw new DOMException('The operation was aborted', 'AbortError');
  };
  const r = await fetchCompanyUsage({ fetchFn, apiBase: 'x', apiToken: 't', companyId: 1, retries: 2, sleep: noSleep, timeoutMs: 1000 });
  assert.equal(r.ok, false);
  assert.equal(calls, 2);
  assert.match(r.error, /요청 실패:/);
});
