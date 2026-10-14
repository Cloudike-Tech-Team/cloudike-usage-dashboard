-- 기업 사용량 대시보드 스키마
-- Supabase Dashboard → SQL Editor 에 전체 붙여넣고 Run. 여러 번 실행해도 안전(idempotent).
-- cs-dashboard 와 같은 프로젝트를 쓸 수 있으므로 모든 객체에 usage_ 접두어를 붙인다.

-- ─────────────────────────────────────────────
-- 1. 테이블
-- ─────────────────────────────────────────────
create table if not exists public.usage_companies (
  company_id   integer primary key check (company_id > 0),          -- Cloudike company_id
  name         text not null check (char_length(name) between 1 and 200),
  environment  text not null default 'gov',
  is_active    boolean not null default true,                       -- false 면 자동 수집 제외
  created_at   timestamptz not null default now()
);

create table if not exists public.usage_weekly (
  id            bigint generated always as identity primary key,
  company_id    integer not null references public.usage_companies(company_id) on delete cascade,
  week_start    date not null check (extract(isodow from week_start) = 1),   -- 월요일만
  week_label    text not null check (char_length(week_label) between 1 and 50), -- 예 '2026년 10월 2주차'
  total_users   integer check (total_users >= 0),
  active_users  integer check (active_users >= 0),
  usage_gb      numeric(14,3) check (usage_gb >= 0),
  traffic_gb    numeric(14,3) check (traffic_gb >= 0),
  quota_value   numeric(14,3) check (quota_value >= 0),
  quota_unit    text check (quota_unit in ('GB','TB')),
  quota_gb      numeric(14,3) check (quota_gb >= 0),
  source        text not null check (source in ('auto','manual','import')),
  collected_at  timestamptz,
  note          text check (char_length(note) <= 2000),
  updated_by    text,                    -- 트리거가 기록: 로그인 이메일 또는 'collector'
  updated_at    timestamptz not null default now(),
  unique (company_id, week_start)
);
create index if not exists usage_weekly_company_week on public.usage_weekly (company_id, week_start desc);

create table if not exists public.usage_collection_runs (
  id             bigint generated always as identity primary key,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  trigger        text not null check (trigger in ('schedule','manual')),
  week_start     date,
  status         text not null check (status in ('running','success','partial','failed')),
  success_count  integer not null default 0,
  failure_count  integer not null default 0,
  message        text
);
create index if not exists usage_collection_runs_started on public.usage_collection_runs (started_at desc);

-- ─────────────────────────────────────────────
-- 2. 수정자/수정시각 자동 기록 (클라이언트가 위조 불가)
--    service_role(수집기)은 JWT 에 이메일이 없어 'collector' 로 기록된다.
-- ─────────────────────────────────────────────
create or replace function public.usage_weekly_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_catalog.pg_trigger_depth() > 1 then
    return new;
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.jwt() ->> 'email', 'collector');
  return new;
end;
$$;

drop trigger if exists usage_weekly_stamp on public.usage_weekly;
create trigger usage_weekly_stamp
  before insert or update on public.usage_weekly
  for each row execute function public.usage_weekly_stamp();

-- ─────────────────────────────────────────────
-- 3. RLS: 로그인한 사용자(authenticated)만 접근. 비로그인(anon)은 전부 차단.
--    anon key 는 GitHub Pages 에 공개되므로 보안은 전적으로 이 정책에 의존한다.
-- ─────────────────────────────────────────────
alter table public.usage_companies       enable row level security;
alter table public.usage_weekly          enable row level security;
alter table public.usage_collection_runs enable row level security;

revoke all on table public.usage_companies, public.usage_weekly, public.usage_collection_runs from anon;
grant select, insert, update, delete on table public.usage_companies, public.usage_weekly to authenticated;
grant select on table public.usage_collection_runs to authenticated;

do $$
declare t text;
begin
  foreach t in array array['usage_companies','usage_weekly'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (true)', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (true) with check (true)', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (true)', t || '_delete', t);
  end loop;
end $$;

drop policy if exists usage_collection_runs_select on public.usage_collection_runs;
create policy usage_collection_runs_select on public.usage_collection_runs
  for select to authenticated using (true);

-- (선택) 회사 도메인 계정만 허용하려면 위 정책의 true 를 아래 식으로 교체:
--   (auth.jwt() ->> 'email') like '%@cloudike.io'
