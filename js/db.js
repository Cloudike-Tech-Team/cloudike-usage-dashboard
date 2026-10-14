// Supabase 데이터 접근. 모두 supabase-js 결과 {data, error} 를 그대로 반환한다.
const PAGE = 1000;

export function makeDb(sb) {
  return {
    listCompanies: () => sb.from('usage_companies').select('*').order('company_id'),
    addCompany: (company_id, name) => sb.from('usage_companies').insert({ company_id, name }).select().single(),
    setCompanyActive: (company_id, is_active) => sb.from('usage_companies').update({ is_active }).eq('company_id', company_id),
    deleteCompany: (company_id) => sb.from('usage_companies').delete().eq('company_id', company_id),

    listWeekly: async ({ companyIds, fromWeek } = {}) => {
      // PostgREST max-rows(기본 1000)로 잘리지 않도록 range 로 페이지를 나눠 모두 가져온다.
      const all = [];
      for (let from = 0; ; from += PAGE) {
        let q = sb.from('usage_weekly').select('*').order('week_start', { ascending: true }).order('company_id');
        if (companyIds?.length) q = q.in('company_id', companyIds);
        if (fromWeek) q = q.gte('week_start', fromWeek);
        const { data, error } = await q.range(from, from + PAGE - 1);
        if (error) return { data: null, error };
        all.push(...data);
        if (data.length < PAGE) break;
      }
      return { data: all, error: null };
    },
    upsertWeekly: (rows) => sb.from('usage_weekly').upsert(rows, { onConflict: 'company_id,week_start' }).select(),
    updateWeekly: (id, fields) => sb.from('usage_weekly').update(fields).eq('id', id).select().single(),
    deleteWeekly: (id) => sb.from('usage_weekly').delete().eq('id', id),

    latestRun: () => sb.from('usage_collection_runs').select('*').order('started_at', { ascending: false }).limit(1).maybeSingle(),
  };
}
