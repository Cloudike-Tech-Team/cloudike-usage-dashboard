#!/usr/bin/env node
// GitHub Actions에서 실행. 활성 기업을 읽어 GOV API를 호출하고 Supabase REST(service_role)로 upsert한다.
import { collectAll } from './lib/collector.js';
import { currentWeekStartKST, isMonday } from '../js/lib/week.js';

function env(name, required = true) {
  const v = process.env[name]?.trim();
  if (required && !v) { console.error(`환경변수 ${name}이(가) 없습니다`); process.exit(2); }
  return v;
}
const SUPABASE_URL = env('SUPABASE_URL').replace(/\/+$/, '');
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const API_BASE = env('CLOUDIKE_API_BASE');
const API_TOKEN = env('CLOUDIKE_API_TOKEN');
const trigger = process.env.TRIGGER === 'schedule' ? 'schedule' : 'manual';
const weekStart = env('WEEK_START', false) || currentWeekStartKST();
if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !isMonday(weekStart)) {
  console.error(`WEEK_START는 월요일 날짜(YYYY-MM-DD)여야 합니다: ${weekStart}`);
  process.exit(2);
}

const baseHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
async function sb(method, path, body, prefer) {
  const headers = prefer ? { ...baseHeaders, Prefer: prefer } : baseHeaders;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const [run] = await sb('POST', 'usage_collection_runs', { trigger, week_start: weekStart, status: 'running' }, 'return=representation');
const finish = (patch) => sb('PATCH', `usage_collection_runs?id=eq.${run.id}`, { finished_at: new Date().toISOString(), ...patch });

try {
  const companies = await sb('GET', 'usage_companies?is_active=eq.true&select=company_id,name&order=company_id');
  const result = await collectAll({ fetchFn: fetch, companies, apiBase: API_BASE, apiToken: API_TOKEN, weekStart });
  if (result.rows.length) {
    await sb('POST', 'usage_weekly?on_conflict=company_id,week_start', result.rows, 'resolution=merge-duplicates,return=minimal');
  }
  await finish({ status: result.status, success_count: result.successCount, failure_count: result.failureCount, message: result.message });
  console.log(`[${result.status}] 주차 ${weekStart} (${trigger}): 성공 ${result.successCount}, 실패 ${result.failureCount}`);
  if (result.failureCount) console.log(result.message);
  process.exit(result.status === 'failed' ? 1 : 0);
} catch (e) {
  await finish({ status: 'failed', message: `수집기 오류: ${e.message}` }).catch(() => {});
  console.error('수집기 오류:', e.message);
  process.exit(1);
}
