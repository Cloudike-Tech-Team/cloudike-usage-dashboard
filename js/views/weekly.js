import { el, toast, mapDbError, confirmKo, option } from '../ui.js';
import { mondayOf, weekLabel, weekRangeText, formatDateKo, todayKST, kstMidnightIso } from '../lib/week.js';
import { formatGb, formatQuota, formatInt } from '../lib/units.js';
import { filterByWeeks } from '../lib/series.js';
import { validateWeeklyInput } from '../lib/weekly-form.js';

const PERIODS = [[12, '최근 12주'], [26, '최근 26주'], [52, '최근 52주'], [0, '전체']];
const SOURCE_KO = { auto: '자동', manual: '수동', import: '가져오기' };
const state = { companyId: null, weeks: 52 };

export async function mount(root, ctx) {
  const companies = await ctx.companies();
  if (!companies.length) {
    root.replaceChildren(el('h2', { text: '주차별 데이터' }), el('p', { class: 'muted', text: '먼저 "기업 관리"에서 기업을 추가하세요.' }));
    return;
  }
  if (!companies.some((c) => c.company_id === state.companyId)) state.companyId = companies[0].company_id;

  const companySel = el('select', { onChange: (e) => { state.companyId = Number(e.target.value); addArea.replaceChildren(); load(); } },
    ...companies.map((c) => option(String(c.company_id), `${c.name} (${c.company_id})`, c.company_id === state.companyId)));
  const periodSel = el('select', { onChange: (e) => { state.weeks = Number(e.target.value); load(); } },
    ...PERIODS.map(([w, t]) => option(String(w), t, w === state.weeks)));
  const addBtn = el('button', { type: 'button', class: 'btn primary', text: '행 추가', onClick: () => showAddForm() });
  const importBtn = el('button', { type: 'button', class: 'btn ghost', text: '붙여넣기 가져오기', onClick: () => ctx.navigate('import') });
  const toolbar = el('div', { class: 'toolbar' }, el('label', {}, '기업', companySel), el('label', {}, '기간', periodSel), addBtn, importBtn);
  const addArea = el('div');
  const tbody = el('tbody');
  const table = el('table', { class: 'grid' },
    el('thead', {}, el('tr', {}, ...['주차', '기간', '총 유저수', '활성 유저수', '사용량', '트래픽', '제공량', '출처', '기록 날짜', '메모', '작업']
      .map((t, i) => el('th', { class: i < 2 || i === 9 ? 'left' : '', text: t })))),
    tbody);
  root.replaceChildren(el('h2', { text: '주차별 데이터' }), toolbar, addArea, el('div', { class: 'table-wrap' }, table));

  let rows = [];
  let allRows = []; // 기간 필터 전 전체 행(덮어쓰기 확인용)
  let loadSeq = 0;
  async function load() {
    tbody.replaceChildren(el('tr', {}, el('td', { colspan: '11', class: 'left muted', text: '불러오는 중…' })));
    const seq = ++loadSeq;
    const { data, error } = await ctx.db.listWeekly({ companyIds: [state.companyId] });
    if (seq !== loadSeq) return;
    if (error) { toast(mapDbError(error), 'error'); return; }
    allRows = data;
    rows = filterByWeeks(data, state.weeks).slice().sort((a, b) => (a.week_start < b.week_start ? 1 : -1)); // 최신 먼저
    render();
  }
  function render() {
    tbody.replaceChildren(...(rows.length ? rows.map(viewRow) : [el('tr', {}, el('td', { colspan: '11', class: 'left muted', text: '데이터가 없습니다. "행 추가" 또는 "붙여넣기 가져오기"로 입력하세요.' }))]));
  }
  function viewRow(r) {
    return el('tr', {},
      el('td', { class: 'left', text: r.week_label }),
      el('td', { class: 'left muted', text: weekRangeText(r.week_start) }),
      el('td', { text: formatInt(r.total_users) }),
      el('td', { text: formatInt(r.active_users) }),
      el('td', { text: formatGb(r.usage_gb) }),
      el('td', { text: formatGb(r.traffic_gb) }),
      el('td', { text: formatQuota(r.quota_gb) }),
      el('td', {}, el('span', { class: 'badge', text: SOURCE_KO[r.source] || r.source })),
      el('td', { text: r.collected_at ? formatDateKo(new Date(new Date(r.collected_at).getTime() + 9 * 3600000).toISOString()) : '-' }),
      el('td', { class: 'left', text: r.note || '' }),
      el('td', {}, el('div', { class: 'actions' },
        el('button', { type: 'button', class: 'btn ghost', text: '수정', onClick: () => editRow(r) }),
        el('button', { type: 'button', class: 'btn ghost danger', text: '삭제', onClick: () => deleteRow(r) }))),
    );
  }

  function inputs(r = {}) {
    return {
      weekLabel: el('input', { value: r.week_label || '', maxlength: '50' }),
      totalUsers: el('input', { value: r.total_users ?? '', inputmode: 'numeric' }),
      activeUsers: el('input', { value: r.active_users ?? '', inputmode: 'numeric' }),
      usageGb: el('input', { value: r.usage_gb ?? '', inputmode: 'decimal' }),
      trafficGb: el('input', { value: r.traffic_gb ?? '', inputmode: 'decimal', placeholder: '- 가능' }),
      quotaValue: el('input', { value: r.quota_value ?? '', inputmode: 'decimal' }),
      quotaUnit: el('select', {}, option('TB', 'TB', (r.quota_unit || 'TB') === 'TB'), option('GB', 'GB', r.quota_unit === 'GB')),
      note: el('input', { value: r.note || '', maxlength: '2000' }),
    };
  }
  function collect(i, weekStart) {
    return validateWeeklyInput({ weekStart, weekLabel: i.weekLabel.value, totalUsers: i.totalUsers.value, activeUsers: i.activeUsers.value,
      usageGb: i.usageGb.value, trafficGb: i.trafficGb.value, quotaValue: i.quotaValue.value, quotaUnit: i.quotaUnit.value, note: i.note.value });
  }

  function editRow(r) {
    const i = inputs(r);
    const tr = el('tr', {},
      el('td', { class: 'left' }, i.weekLabel),
      el('td', { class: 'left muted', text: weekRangeText(r.week_start) }),
      el('td', {}, i.totalUsers), el('td', {}, i.activeUsers), el('td', {}, i.usageGb), el('td', {}, i.trafficGb),
      el('td', {}, el('div', { class: 'actions' }, i.quotaValue, i.quotaUnit)),
      el('td', {}, el('span', { class: 'badge', text: '수동' })),
      el('td', { text: '-' }),
      el('td', { class: 'left' }, i.note),
      el('td', {}, el('div', { class: 'actions' },
        el('button', { type: 'button', class: 'btn primary', text: '저장', onClick: save }),
        el('button', { type: 'button', class: 'btn ghost', text: '취소', onClick: render }))),
    );
    const idx = rows.indexOf(r);
    tbody.children[idx].replaceWith(tr);
    async function save() {
      const v = collect(i, r.week_start);
      if (!v.ok) return toast(v.errors.join('\n'), 'error');
      const { week_start, ...fields } = v.fields;
      const { data, error } = await ctx.db.updateWeekly(r.id, { ...fields, source: 'manual' });
      if (error) return toast(mapDbError(error), 'error');
      rows[idx] = data;
      render();
      toast('저장했습니다');
    }
  }

  async function deleteRow(r) {
    if (!confirmKo(`${r.week_label} 데이터를 삭제할까요?`)) return;
    const { error } = await ctx.db.deleteWeekly(r.id);
    if (error) return toast(mapDbError(error), 'error');
    rows = rows.filter((x) => x.id !== r.id);
    render();
    toast('삭제했습니다');
  }

  function showAddForm() {
    const companyId = state.companyId;
    const dateInput = el('input', { type: 'date', value: todayKST(), onChange: syncWeek });
    const weekInfo = el('span', { class: 'hint' });
    const i = inputs();
    let weekStart = mondayOf(dateInput.value);
    function syncWeek() {
      if (!dateInput.value) return;
      weekStart = mondayOf(dateInput.value);
      i.weekLabel.value = weekLabel(weekStart);
      weekInfo.textContent = `주차 시작(월): ${weekStart} (${weekRangeText(weekStart)})`;
    }
    syncWeek();
    const form = el('form', { class: 'card toolbar', onSubmit: submit },
      el('label', {}, '날짜 선택(그 주의 월요일로 보정)', dateInput),
      el('label', {}, '주차 라벨', i.weekLabel),
      el('label', {}, '총 유저수', i.totalUsers), el('label', {}, '활성 유저수', i.activeUsers),
      el('label', {}, '사용량(GB)', i.usageGb), el('label', {}, '트래픽(GB)', i.trafficGb),
      el('label', {}, '제공량', el('div', { class: 'actions' }, i.quotaValue, i.quotaUnit)),
      el('label', {}, '메모', i.note),
      el('button', { type: 'submit', class: 'btn primary', text: '저장' }),
      el('button', { type: 'button', class: 'btn ghost', text: '닫기', onClick: () => addArea.replaceChildren() }),
      weekInfo,
    );
    addArea.replaceChildren(form);
    async function submit(e) {
      e.preventDefault();
      const v = collect(i, weekStart);
      if (!v.ok) return toast(v.errors.join('\n'), 'error');
      const existing = allRows.find((x) => x.week_start === weekStart);
      if (existing && !confirmKo(`${existing.week_label} 데이터가 이미 있습니다. 덮어쓸까요?`)) return;
      const btn = e.submitter;
      if (btn) btn.disabled = true;
      let error;
      try {
        ({ error } = await ctx.db.upsertWeekly([{ company_id: companyId, ...v.fields, source: 'manual', collected_at: kstMidnightIso(dateInput.value) }]));
      } finally {
        if (btn) btn.disabled = false;
      }
      if (error) return toast(mapDbError(error), 'error');
      toast(existing ? '덮어썼습니다' : '추가했습니다');
      addArea.replaceChildren();
      load();
    }
  }

  load();
}
