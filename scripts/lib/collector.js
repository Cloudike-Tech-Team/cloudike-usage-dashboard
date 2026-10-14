// GOV API → usage_weekly 행. fetch를 주입받아 테스트 가능. 네트워크·Supabase 호출은 collect.mjs가 담당.
import { weekLabel } from '../../js/lib/week.js';

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function usageRowFromApi(json, { companyId, weekStart, weekLabel: label, collectedAt }) {
  return {
    company_id: companyId,
    week_start: weekStart,
    week_label: label,
    total_users: json.total_users ?? null,
    active_users: json.active_users ?? null,
    usage_gb: json.usage_gb ?? null,
    traffic_gb: json.traffic_gb ?? null,
    quota_value: json.quota_value ?? null,
    quota_unit: json.quota_unit ?? null,
    quota_gb: json.quota_gb ?? null,
    source: 'auto',
    collected_at: collectedAt,
    note: null,
  };
}

export function usageSummaryUrl(apiBase, companyId, apiToken) {
  const base = String(apiBase).replace(/\/+$/, '');
  return `${base}/api/1/analytics/company_usage_summary/?company_id=${encodeURIComponent(companyId)}&api_token=${encodeURIComponent(apiToken)}`;
}

export async function fetchCompanyUsage({ fetchFn, apiBase, apiToken, companyId, retries = 3, sleep = defaultSleep, timeoutMs = 30000 }) {
  const url = usageSummaryUrl(apiBase, companyId, apiToken);
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const signal = AbortSignal.timeout(timeoutMs);
      const res = await fetchFn(url, { headers: { accept: 'application/json' }, signal });
      if (res.status === 404) return { ok: false, error: '기업 없음(404)' };
      if (res.status === 403) return { ok: false, error: 'API 토큰 거부(403)' };
      if (res.status === 400) return { ok: false, error: '잘못된 요청(400)' };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { ok: true, json: await res.json() };
    } catch (e) {
      lastError = e;
      if (attempt < retries) await sleep(500 * 2 ** (attempt - 1));
    }
  }
  return { ok: false, error: `요청 실패: ${lastError?.message ?? String(lastError)}` };
}

export async function collectAll({ fetchFn, companies, apiBase, apiToken, weekStart, now = new Date(), retries = 3, sleep = defaultSleep, timeoutMs = 30000 }) {
  const label = weekLabel(weekStart);
  const collectedAt = now.toISOString();
  const results = [];
  for (const c of companies) {
    const r = await fetchCompanyUsage({ fetchFn, apiBase, apiToken, companyId: c.company_id, retries, sleep, timeoutMs });
    results.push(r.ok
      ? { companyId: c.company_id, name: c.name, ok: true, row: usageRowFromApi(r.json, { companyId: c.company_id, weekStart, weekLabel: label, collectedAt }) }
      : { companyId: c.company_id, name: c.name, ok: false, error: r.error });
  }
  const successCount = results.filter((r) => r.ok).length;
  const failureCount = results.length - successCount;
  const status = results.length === 0 || failureCount === 0 ? 'success' : successCount === 0 ? 'failed' : 'partial';
  const failures = results.filter((r) => !r.ok).map((r) => `${r.name}(${r.companyId}): ${r.error}`).join('; ');
  const message = results.length === 0 ? '활성 기업이 없습니다'
    : failureCount === 0 ? `${successCount}개 기업 수집 완료`
      : `성공 ${successCount}, 실패 ${failureCount} — ${failures}`;
  return { results, rows: results.filter((r) => r.ok).map((r) => r.row), status, successCount, failureCount, message };
}
