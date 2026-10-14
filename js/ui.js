// DOM 헬퍼. 모듈 최상위에서 document 를 건드리지 않는다(Node 테스트에서 import 가능해야 함).
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') node.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'selected') node[k] = !!v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) if (c != null && c !== false) node.append(c);
  return node;
}

let toastTimer;
export function toast(msg, kind = 'info') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.dataset.kind = kind;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, kind === 'error' ? 5000 : 2500);
}

export function mapDbError(error) {
  if (!error) return '요청에 실패했습니다';
  const code = error.code;
  if (code === '23505') return '이미 등록된 항목입니다 (중복)';
  if (code === '23503') return '연결된 데이터가 있어 처리할 수 없습니다';
  if (code === '23514') return '허용되지 않는 값입니다 (예: 음수, 월요일이 아닌 주차)';
  if (code === '42501' || error.status === 401 || error.status === 403 || /JWT/i.test(error.message || '')) return '권한이 없습니다. 다시 로그인하세요';
  return `요청에 실패했습니다: ${error.message || error}`;
}

export function confirmKo(msg) { return window.confirm(msg); }

export function option(value, text, selected = false) { return el('option', { value, text, selected }); }
