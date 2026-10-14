import { el, toast, mapDbError, confirmKo, option } from '../ui.js';
import { parsePaste, toUsageRows } from '../lib/paste-parser.js';
import { formatDateKo } from '../lib/week.js';
import { formatGb, formatQuota, formatInt } from '../lib/units.js';

export async function mount(root, ctx) {
  const companies = await ctx.companies();
  if (!companies.length) {
    root.replaceChildren(el('h2', { text: '붙여넣기 가져오기' }), el('p', { class: 'muted', text: '먼저 "기업 관리"에서 기업을 추가하세요.' }));
    return;
  }
  const companySel = el('select', { onChange: invalidate }, ...companies.map((c) => option(String(c.company_id), `${c.name} (${c.company_id})`)));
  const textarea = el('textarea', { class: 'paste', onInput: invalidate, placeholder: '스프레드시트에서 표를 복사해 여기에 붙여넣으세요.\n열 순서: 번호, 주차, 총 유저수, 활성 유저수, 사용량(GB), 트래픽(GB), 제공량(TB), 기록 날짜 (헤더 줄이 있어도 됩니다)' });
  const previewBtn = el('button', { type: 'button', class: 'btn primary', text: '미리보기', onClick: preview });
  const importBtn = el('button', { type: 'button', class: 'btn primary', text: '가져오기', disabled: true, onClick: doImport });
  const skipErrors = el('input', { type: 'checkbox' });
  const summary = el('p', { class: 'hint' });
  const previewArea = el('div');
  root.replaceChildren(
    el('h2', { text: '붙여넣기 가져오기' }),
    el('div', { class: 'toolbar' }, el('label', {}, '대상 기업', companySel), previewBtn, importBtn,
      el('label', { class: 'checks' }, skipErrors, '오류 행은 건너뛰고 가져오기')),
    textarea, summary, previewArea,
  );

  let parsed = null;
  let existingWeeks = new Set();
  let previewedCompanyId = null;
  let previewGen = 0;

  function invalidate() {
    previewGen++;
    parsed = null;
    existingWeeks = new Set();
    previewedCompanyId = null;
    previewArea.replaceChildren();
    summary.textContent = '내용이 바뀌었습니다. 다시 미리보기를 눌러주세요.';
    importBtn.disabled = true;
  }

  async function preview() {
    const next = parsePaste(textarea.value);
    const companyId = Number(companySel.value);
    const companyName = companies.find((c) => c.company_id === companyId)?.name || String(companyId);
    const gen = previewGen;
    previewBtn.disabled = true;
    importBtn.disabled = true;
    parsed = null;
    let res;
    try {
      res = await ctx.db.listWeekly({ companyIds: [companyId] });
    } finally {
      previewBtn.disabled = false;
    }
    if (gen !== previewGen) return;
    const { data, error } = res;
    if (error) return toast(mapDbError(error), 'error');
    parsed = next;
    existingWeeks = new Set(data.map((r) => r.week_start));
    previewedCompanyId = companyId;
    const overwrite = parsed.rows.filter((r) => r.errors.length === 0 && existingWeeks.has(r.weekStart)).length;
    const warn = parsed.rows.filter((r) => r.warnings.length).length;
    summary.textContent = `대상 기업: ${companyName} · 총 ${parsed.summary.total}행, 정상 ${parsed.summary.ok}, 오류 ${parsed.summary.error}, 경고 ${warn}, 기존 주차 덮어쓰기 ${overwrite}` +
      (parsed.headerDetected ? ' · 헤더 인식됨' : ' · 헤더 없음(기본 열 순서)') + ` · 제공량 단위 ${parsed.quotaUnit}`;
    importBtn.disabled = parsed.summary.ok === 0;
    previewArea.replaceChildren(el('div', { class: 'table-wrap' }, el('table', { class: 'grid' },
      el('thead', {}, el('tr', {}, ...['행', '주차 라벨', '주차 시작', '기간', '총 유저수', '활성 유저수', '사용량', '트래픽', '제공량', '기록 날짜', '상태']
        .map((t, i) => el('th', { class: i <= 3 || i === 10 ? 'left' : '', text: t })))),
      el('tbody', {}, parsed.rows.map((r) => el('tr', { class: r.errors.length ? 'error' : r.warnings.length ? 'warn' : '' },
        el('td', { class: 'left', text: String(r.line) }),
        el('td', { class: 'left', text: r.weekLabel || r.raw.slice(0, 30) }),
        el('td', { class: 'left', text: r.weekStart || '-' }),
        el('td', { class: 'left muted', text: r.rangeText }),
        el('td', { text: formatInt(r.totalUsers) }),
        el('td', { text: formatInt(r.activeUsers) }),
        el('td', { text: formatGb(r.usageGb) }),
        el('td', { text: formatGb(r.trafficGb) }),
        el('td', { text: formatQuota(r.quotaGb) }),
        el('td', { text: r.collectedAt ? formatDateKo(r.collectedAt.slice(0, 10)) : '-' }),
        el('td', { class: 'left' }, r.errors.length
          ? el('span', { class: 'badge bad', text: r.errors.join(' / ') })
          : existingWeeks.has(r.weekStart)
            ? el('span', { class: 'badge warn', text: ['덮어쓰기', ...r.warnings].join(' / ') })
            : el('span', { class: r.warnings.length ? 'badge warn' : 'badge ok', text: r.warnings.length ? r.warnings.join(' / ') : '신규' })),
      ))),
    )));
  }

  async function doImport() {
    if (!parsed) return;
    if (parsed.summary.error > 0 && !skipErrors.checked) return toast('오류 행이 있습니다. 수정하거나 "오류 행은 건너뛰고 가져오기"를 체크하세요.', 'error');
    const companyId = previewedCompanyId;
    const rows = toUsageRows(parsed, companyId);
    const overwrite = rows.filter((r) => existingWeeks.has(r.week_start)).length;
    if (overwrite && !confirmKo(`${companies.find((c) => c.company_id === companyId)?.name || companyId} 기업의 기존 주차 ${overwrite}건을 덮어씁니다. 계속할까요?`)) return;
    importBtn.disabled = true;
    const { error } = await ctx.db.upsertWeekly(rows);
    importBtn.disabled = false;
    if (error) return toast(mapDbError(error), 'error');
    toast(`${rows.length}행 저장 (신규 ${rows.length - overwrite}, 덮어쓰기 ${overwrite})`);
    textarea.value = '';
    previewArea.replaceChildren();
    summary.textContent = '';
    parsed = null;
    previewedCompanyId = null;
    importBtn.disabled = true;
  }
}
