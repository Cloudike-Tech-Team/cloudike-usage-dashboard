import { el, toast, mapDbError, confirmKo } from '../ui.js';
import { formatDateKo } from '../lib/week.js';
import { latestRowsByCompany } from '../lib/series.js';

export async function mount(root, ctx) {
  root.replaceChildren(el('p', { class: 'muted', text: '불러오는 중…' }));
  const [companies, weeklyRes] = await Promise.all([ctx.companies(true), ctx.db.listWeekly()]);
  if (weeklyRes.error) toast(mapDbError(weeklyRes.error), 'error');
  const latest = latestRowsByCompany(weeklyRes.data || []);

  const form = el('form', { class: 'toolbar card', onSubmit: onAdd },
    el('label', {}, '기업 ID (company_id)', el('input', { name: 'company_id', type: 'number', min: '1', step: '1', required: true, placeholder: '예: 123' })),
    el('label', {}, '표시 이름', el('input', { name: 'name', type: 'text', required: true, maxlength: '200', placeholder: '예: 가나다 주식회사' })),
    el('button', { type: 'submit', class: 'btn primary', text: '기업 추가' }),
  );
  const hint = el('p', { class: 'hint', text: '추가한 기업은 다음 금요일 09:00부터 자동 수집됩니다. 즉시 수집은 GitHub Actions → "주간 사용량 수집" → "Run workflow"를 사용하세요.' });

  const table = el('table', { class: 'grid' },
    el('thead', {}, el('tr', {},
      ...['기업 ID', '이름', '상태', '등록일', '최신 주차', '작업'].map((t, i) => el('th', { class: i < 2 ? 'left' : '', text: t })))),
    el('tbody', {}, companies.length ? companies.map(rowOf) : el('tr', {}, el('td', { colspan: '6', class: 'left muted', text: '등록된 기업이 없습니다. 위에서 추가하세요.' }))),
  );
  root.replaceChildren(el('h2', { text: '기업 관리' }), form, hint, table);

  function rowOf(c) {
    const last = latest.get(c.company_id);
    return el('tr', {},
      el('td', { class: 'left', text: String(c.company_id) }),
      el('td', { class: 'left', text: c.name }),
      el('td', {}, el('span', { class: `badge ${c.is_active ? 'ok' : ''}`, text: c.is_active ? '수집 중' : '비활성' })),
      el('td', { text: formatDateKo(new Date(new Date(c.created_at).getTime() + 9 * 3600000).toISOString()) }),
      el('td', { text: last ? `${last.week_label}` : '-' }),
      el('td', {}, el('div', { class: 'actions' },
        el('button', { type: 'button', class: 'btn ghost', text: c.is_active ? '비활성화' : '활성화', onClick: () => onToggle(c) }),
        el('button', { type: 'button', class: 'btn ghost danger', text: '삭제', onClick: () => onDelete(c) }),
      )),
    );
  }

  async function onAdd(e) {
    e.preventDefault();
    const fd = new FormData(form);
    const company_id = Number(fd.get('company_id'));
    const name = String(fd.get('name')).trim();
    if (!Number.isInteger(company_id) || company_id <= 0) return toast('기업 ID는 1 이상의 정수여야 합니다', 'error');
    if (!name) return toast('표시 이름을 입력하세요', 'error');
    const { error } = await ctx.db.addCompany(company_id, name);
    if (error) return toast(error.code === '23505' ? '이미 등록된 기업입니다' : mapDbError(error), 'error');
    toast(`${name} 기업을 추가했습니다`);
    ctx.invalidateCompanies();
    mount(root, ctx);
  }
  async function onToggle(c) {
    const { error } = await ctx.db.setCompanyActive(c.company_id, !c.is_active);
    if (error) return toast(mapDbError(error), 'error');
    ctx.invalidateCompanies();
    mount(root, ctx);
  }
  async function onDelete(c) {
    if (!confirmKo(`${c.name}(${c.company_id}) 기업을 삭제할까요?\n이 기업의 주차별 데이터도 모두 삭제됩니다.`)) return;
    const { error } = await ctx.db.deleteCompany(c.company_id);
    if (error) return toast(mapDbError(error), 'error');
    toast('삭제했습니다');
    ctx.invalidateCompanies();
    mount(root, ctx);
  }
}
