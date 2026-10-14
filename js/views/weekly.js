import { el } from '../ui.js';
export function mount(root) { root.append(el('p', { class: 'muted', text: '주차별 데이터 준비 중' })); }
