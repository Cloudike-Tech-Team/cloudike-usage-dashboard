import { el, toast, mapDbError, option } from '../ui.js';
import { buildSeries, filterByWeeks, latestRowsByCompany } from '../lib/series.js';
import { formatGb, formatQuota, formatInt } from '../lib/units.js';
import { weekRangeText, formatDateKo } from '../lib/week.js';
import { renderLineChart } from '../charts.js';

const PERIODS = [[12, '최근 12주'], [26, '최근 26주'], [52, '최근 52주'], [0, '전체']];
const STATUS_KO = { running: ['실행 중', 'warn'], success: ['성공', 'ok'], partial: ['일부 실패', 'bad'], failed: ['실패', 'bad'] };
const state = { selected: null, weeks: 26 };
const knownIds = new Set();

export async function mount(root, ctx) {
  const companies = await ctx.companies();
  if (!state.selected) state.selected = new Set();
  for (const c of companies) {
    if (c.is_active && !knownIds.has(c.company_id)) { knownIds.add(c.company_id); state.selected.add(c.company_id); }
  }
  for (const id of [...state.selected]) if (!companies.some((c) => c.company_id === id)) state.selected.delete(id);

  // 기업 선택: 토글 칩. on = 선명, off = 흐림(차트·카드에서 제외)
  const chips = el('div', { class: 'chips' }, ...companies.map((c) => el('button', {
    type: 'button', class: 'chip', 'aria-pressed': state.selected.has(c.company_id) ? 'true' : 'false',
    onClick: (e) => {
      const on = !state.selected.has(c.company_id);
      on ? state.selected.add(c.company_id) : state.selected.delete(c.company_id);
      e.currentTarget.setAttribute('aria-pressed', on ? 'true' : 'false');
      load();
    },
  }, el('span', { class: 'name', text: c.name }), el('span', { class: 'id', text: `ID ${c.company_id}` }))));
  const periodSel = el('select', { onChange: (e) => { state.weeks = Number(e.target.value); load(); } },
    ...PERIODS.map(([w, t]) => option(String(w), t, w === state.weeks)));
  const runBox = el('div', { class: 'stat' }, el('div', { class: 'label', text: '최근 자동 수집' }), el('div', { class: 'value muted', text: '…' }));
  const cards = el('div', { class: 'cards' });
  const usageCanvas = el('canvas');
  const trafficCanvas = el('canvas');
  root.replaceChildren(
    el('h2', { text: '대시보드' }),
    el('div', { class: 'toolbar' }, el('label', {}, '기간', periodSel), el('div', {}, el('div', { class: 'hint', text: '기업 선택 (누르면 켜고 끔)' }), chips)),
    runBox,
    el('div', { class: 'chart-card' }, usageCanvas),
    el('div', { class: 'chart-card' }, trafficCanvas),
    el('h2', { text: '기업별 최신 주차 요약' }),
    cards,
  );

  if (!companies.length) {
    cards.append(el('p', { class: 'muted', text: '"기업 관리"에서 기업을 추가하면 여기에 표시됩니다.' }));
  }

  let loadSeq = 0;
  async function load() {
    const seq = ++loadSeq;
    const ids = [...state.selected];
    const [weeklyRes, runRes] = await Promise.all([ids.length ? ctx.db.listWeekly({ companyIds: ids }) : Promise.resolve({ data: [] }), ctx.db.latestRun()]);
    if (seq !== loadSeq) return;
    renderRun(runRes);
    if (runRes.error) toast(mapDbError(runRes.error), 'error');
    if (weeklyRes.error) return toast(mapDbError(weeklyRes.error), 'error');
    const selectedCompanies = companies.filter((c) => state.selected.has(c.company_id));
    const rows = filterByWeeks(weeklyRes.data || [], state.weeks);
    renderLineChart(usageCanvas, buildSeries(rows, selectedCompanies, 'usage_gb'), { title: '사용량(GB) 추이', unit: 'GB' });
    renderLineChart(trafficCanvas, buildSeries(rows, selectedCompanies, 'traffic_gb'), { title: '트래픽(GB) 추이', unit: 'GB' });
    renderCards(weeklyRes.data || [], selectedCompanies);
  }

  function renderRun({ data: run, error }) {
    const value = runBox.querySelector('.value');
    if (error) { value.className = 'value muted'; value.textContent = '수집 이력을 불러오지 못했습니다'; return; }
    value.className = 'value';
    if (!run) { value.textContent = '아직 실행 기록이 없습니다'; return; }
    const [label, kind] = STATUS_KO[run.status] || [run.status, ''];
    const when = new Date(run.started_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    value.replaceChildren(
      el('span', { class: `badge ${kind}`, text: label }), ` ${when} · ${run.trigger === 'schedule' ? '정기' : '수동'} · 성공 ${run.success_count} / 실패 ${run.failure_count}`,
      run.week_start ? el('div', { class: 'hint', text: `대상 주차 시작: ${formatDateKo(run.week_start)}` }) : null,
      run.failure_count || run.status === 'failed' ? el('div', { class: 'hint error', text: run.message || '' }) : null,
    );
  }

  function renderCards(allRows, selectedCompanies) {
    const latest = latestRowsByCompany(allRows);
    cards.replaceChildren(...selectedCompanies.map((c) => {
      const r = latest.get(c.company_id);
      if (!r) return el('div', { class: 'stat' }, el('div', { class: 'label', text: c.name }), el('div', { class: 'value muted', text: '데이터 없음' }));
      return el('div', { class: 'stat' },
        el('div', { class: 'label', text: `${c.name} · ${r.week_label} (${weekRangeText(r.week_start)})` }),
        el('div', { class: 'value', text: formatGb(r.usage_gb) }),
        el('div', { class: 'hint', text: `총 ${formatInt(r.total_users)}명 · 활성 ${formatInt(r.active_users)}명` }),
        el('div', { class: 'hint', text: `트래픽 ${formatGb(r.traffic_gb)} · 제공량 ${formatQuota(r.quota_gb)}` }),
      );
    }));
  }

  load();
}
