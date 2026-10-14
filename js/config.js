// Supabase Dashboard → Project Settings → API 에서 복사.
// anon(public) key 는 브라우저에 공개되는 키라 커밋해도 됨. 보안은 RLS(supabase/schema.sql)가 담당.
// service_role key 는 절대 여기에 넣지 말 것.
window.USAGE_CONFIG = {
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-ANON-KEY',
};
