import { el } from '../ui.js';
export function mount(root) { root.append(el('p', { class: 'muted', text: '대시보드 준비 중' })); }
