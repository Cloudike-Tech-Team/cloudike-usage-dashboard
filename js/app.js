import { makeDb } from './db.js';
import { toast } from './ui.js';
import * as dashboard from './views/dashboard.js';
import * as weekly from './views/weekly.js';
import * as companies from './views/companies.js';
import * as importView from './views/import.js';

const VIEWS = { dashboard, weekly, companies, import: importView };
const cfg = window.USAGE_CONFIG || {};
const $ = (id) => document.getElementById(id);

if (!window.supabase || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes('YOUR-PROJECT')) {
  $('config-error').hidden = false;
} else {
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  const db = makeDb(sb);
  let user = null;
  let current = null;
  let companyCache = null;

  const ctx = {
    db,
    toast,
    get user() { return user; },
    navigate,
    async companies(force = false) {
      if (companyCache && !force) return companyCache;
      const { data, error } = await db.listCompanies();
      if (error) { toast(`기업 목록을 불러오지 못했습니다: ${error.message}`, 'error'); return companyCache || []; }
      companyCache = data;
      return data;
    },
    invalidateCompanies() { companyCache = null; },
  };

  function navigate(name) {
    if (!VIEWS[name]) name = 'dashboard';
    current = name;
    location.hash = name;
    document.querySelectorAll('#nav .tab').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    const root = $('view-root');
    root.replaceChildren();
    VIEWS[name].mount(root, ctx);
  }

  function renderAuth(session) {
    const nextUser = session?.user || null;
    $('login-view').hidden = !!session;
    $('app-view').hidden = !session;
    if ((nextUser?.id || null) === (user?.id || null) && current) return;
    user = nextUser;
    if (user) {
      $('user-email').textContent = user.email || '';
      navigate(location.hash.replace('#', '') || 'dashboard');
    } else {
      current = null;
      companyCache = null;
      $('login-form').reset();
      $('view-root').replaceChildren();
    }
  }

  $('nav').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-view]');
    if (btn) navigate(btn.dataset.view);
  });
  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('login-error');
    err.hidden = true;
    const btn = e.submitter || e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: $('login-email').value.trim(), password: $('login-password').value });
    btn.disabled = false;
    if (!error) $('login-form').reset();
    if (error) { err.textContent = '이메일 또는 비밀번호가 올바르지 않습니다.'; err.hidden = false; }
  });
  $('logout-btn').addEventListener('click', () => sb.auth.signOut());

  const { data: { session } } = await sb.auth.getSession();
  renderAuth(session);
  sb.auth.onAuthStateChange((_event, s) => renderAuth(s));
}
