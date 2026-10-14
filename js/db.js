// Supabase 데이터 접근. 모두 supabase-js 결과 {data, error} 를 그대로 반환한다.
export function makeDb(sb) {
  return {
    listCompanies: () => sb.from('usage_companies').select('*').order('company_id'),
    addCompany: (company_id, name) => sb.from('usage_companies').insert({ company_id, name }).select().single(),
    setCompanyActive: (company_id, is_active) => sb.from('usage_companies').update({ is_active }).eq('company_id', company_id),
    deleteCompany: (company_id) => sb.from('usage_companies').delete().eq('company_id', company_id),

    listWeekly: ({ companyIds, fromWeek } = {}) => {
      let q = sb.from('usage_weekly').select('*').order('week_start', { ascending: true }).order('company_id').limit(10000);
      if (companyIds?.length) q = q.in('company_id', companyIds);
      if (fromWeek) q = q.gte('week_start', fromWeek);
      return q;
    },
    upsertWeekly: (rows) => sb.from('usage_weekly').upsert(rows, { onConflict: 'company_id,week_start' }).select(),
    updateWeekly: (id, fields) => sb.from('usage_weekly').update(fields).eq('id', id).select().single(),
    deleteWeekly: (id) => sb.from('usage_weekly').delete().eq('id', id),

    latestRun: () => sb.from('usage_collection_runs').select('*').order('started_at', { ascending: false }).limit(1).maybeSingle(),
  };
}
