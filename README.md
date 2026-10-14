# 기업 사용량 대시보드

Cloudike GOV 환경의 기업별 주차 사용량(총 유저수, 활성 유저수, 사용량 GB, 트래픽 GB, 제공량)을 보고, 과거 데이터를 편집하며, 추이를 그래프로 확인하는 정적 웹사이트입니다.
화면은 GitHub Pages에서 호스팅하고, 데이터는 Supabase(Postgres)에 저장하며, 매주 금요일 GitHub Actions가 GOV API에서 값을 자동 수집합니다.

```
cloudike-usage-dashboard/
├── index.html                  # 화면 (로그인 / 대시보드 / 주차별 데이터 / 기업 관리 / 가져오기)
├── css/style.css
├── js/config.js                # Supabase URL, anon key  ← 여기만 채우면 됨
├── js/app.js, db.js, ui.js, charts.js
├── js/views/                   # dashboard, weekly, companies, import
├── js/lib/                     # week, units, paste-parser, series, weekly-form (순수 로직)
├── scripts/collect.mjs         # 주간 수집기 (Actions에서 실행)
├── scripts/lib/collector.js
├── supabase/schema.sql         # 테이블 3개 + RLS + 수정자 트리거
├── .github/workflows/          # collect.yml (주간 수집), test.yml (테스트)
├── test/                       # node:test 단위 테스트
└── .nojekyll
```

## 구조와 보안 모델

```
브라우저 (GitHub Pages, 정적 파일)
   │  supabase-js  +  anon key (공개) + 로그인 세션(JWT)
   ▼
Supabase  ── Auth: 이메일/비밀번호 로그인 (가입 금지)
          └─ Postgres: usage_companies / usage_weekly / usage_collection_runs
                       (RLS: authenticated 만 접근, anon 은 전부 차단)
                          ▲
GitHub Actions (금요일 09:00 KST)
   scripts/collect.mjs ── GOV API (company_usage_summary) 호출
                       └─ service_role key 로 upsert (Actions 시크릿에서만 사용)
```

- GitHub Pages는 정적 호스팅이라 **anon key가 누구에게나 보입니다.** 이것은 정상이며, 데이터 보호는 RLS가 담당합니다.
- 저장소에는 코드와 anon key, 그리고 테스트용 픽스처(`test/fixtures/sample-93rows.tsv`)만 있습니다 — 픽스처를 실제 데이터로 두려면 공개 저장소 특성을 고려하세요. 데이터는 **로그인한 사용자만** 조회·수정할 수 있고, 비로그인(anon) 요청은 DB에서 차단됩니다.
- **공개 회원가입은 반드시 끄고**, 관리자가 계정을 직접 만들어 줍니다. 가입이 켜져 있으면 누구나 가입해서 데이터를 볼 수 있습니다.
- `service_role` key는 RLS를 우회하므로 **GitHub Actions 시크릿에만** 두고, 프론트엔드·저장소·`js/config.js`에는 절대 넣지 않습니다.
- GOV API 토큰(`CLOUDIKE_API_TOKEN`)도 Actions 시크릿에만 둡니다.

## 1. Supabase 설정

### 1-1. 스키마 생성
Dashboard → **SQL Editor** → `supabase/schema.sql` 내용 전체를 붙여넣고 **Run**. 여러 번 실행해도 안전합니다.

생성되는 것:
| 객체 | 설명 |
|---|---|
| `usage_companies` | 기업 목록 (`company_id`, 이름, 활성 여부). 비활성 기업은 자동 수집에서 제외 |
| `usage_weekly` | 기업별 주차 사용량. `(company_id, week_start)` 유일, `week_start`는 월요일만 허용 |
| `usage_collection_runs` | 자동 수집 실행 이력 (상태 `running/success/partial/failed`, 성공·실패 건수, 사유) |
| `usage_weekly_stamp` 트리거 | `updated_by / updated_at` 자동 기록 (수집기는 `collector`) |
| RLS 정책 | `authenticated` 역할만 접근. 수집 이력은 읽기 전용 |

기존 cs-dashboard와 같은 Supabase 프로젝트를 써도 되도록 모든 객체에 `usage_` 접두어가 붙어 있습니다.
확인: **Table Editor**에서 세 테이블 모두 "RLS enabled"가 표시되어야 합니다.

### 1-2. 회원가입 끄기
Dashboard → **Authentication → Sign In / Providers**
- **Allow new users to sign up** → **OFF**
- **Allow anonymous sign-ins** → **OFF** (익명 로그인도 `authenticated` 역할이라 켜면 누구나 데이터를 봅니다)
- Email provider는 켜둔 상태 유지

### 1-3. 사용자 추가
Dashboard → **Authentication → Users → Add user → Create new user**
- 이메일 / 비밀번호 입력, **Auto Confirm User** 체크
- 팀원에게 비밀번호를 전달합니다.

### 1-4. URL 설정
Dashboard → **Authentication → URL Configuration**
- **Site URL**: `https://cloudike-tech-team.github.io/cloudike-usage-dashboard/`
- 이 Supabase 프로젝트를 cs-dashboard와 공유한다면 **Site URL은 바꾸지 말고**, Pages 주소를 **Redirect URLs**에만 추가하세요.
- 현재 정책은 `using (true)`라서, 공유 프로젝트의 모든 계정(cs-dashboard 사용자 포함)이 사용량 데이터를 읽고 쓸 수 있습니다. 제한하려면 `supabase/schema.sql` 하단의 도메인 제한 주석을 참고하세요.

### 1-5. API 키 복사
Dashboard → **Project Settings → API** (또는 **API Keys**)
- **Project URL** → `js/config.js`의 `SUPABASE_URL`
- **anon public** key (새 키 체계라면 **publishable** key `sb_publishable_...`) → `SUPABASE_ANON_KEY`
- **service_role** key는 `js/config.js`에 넣지 않습니다. 3절에서 Actions 시크릿으로만 등록합니다.

### 1-6. 참고: PostgREST max-rows
Supabase의 PostgREST는 기본적으로 한 요청에 최대 1000행만 돌려줍니다. 앱은 `listWeekly`에서 1000행 단위로 나눠 모두 가져오므로 설정을 바꿀 필요가 없습니다.

## 2. 로컬에서 확인

```bash
cd cloudike-usage-dashboard
python3 -m http.server 8000
# http://localhost:8000 접속 → 1-3에서 만든 계정으로 로그인
```
`file://`로 직접 열지 말고 반드시 로컬 서버로 여세요(ES 모듈이 동작하지 않습니다).

## 3. GitHub 저장소 · Pages · 시크릿/변수

```bash
cd cloudike-usage-dashboard

# public 저장소 생성 + push
gh repo create Cloudike-Tech-Team/cloudike-usage-dashboard --public --source=. --push \
  --description "Cloudike GOV 기업별 주차 사용량 대시보드 (GitHub Pages + Supabase)"

# GitHub Pages 켜기: main 브랜치의 루트(/)에서 배포
gh api -X POST repos/Cloudike-Tech-Team/cloudike-usage-dashboard/pages \
  -f "source[branch]=main" -f "source[path]=/"

# 배포 상태/URL 확인 (1~2분 소요)
gh api repos/Cloudike-Tech-Team/cloudike-usage-dashboard/pages --jq '.html_url,.status'
```

배포 주소: `https://cloudike-tech-team.github.io/cloudike-usage-dashboard/` → 이 주소를 1-4의 Site URL에 넣습니다.
이후 수정 사항은 `git push`만 하면 자동으로 재배포됩니다.

수집기용 변수와 시크릿 (시크릿 값은 명령 인자에 남지 않도록 표준입력으로 전달):

```bash
R=Cloudike-Tech-Team/cloudike-usage-dashboard

gh variable set CLOUDIKE_API_BASE --body "https://api.gov.cloudike.kr" -R $R
gh variable set SUPABASE_URL      --body "https://<프로젝트 ref>.supabase.co" -R $R

printf '%s' "<GOV api_token>"       | gh secret set CLOUDIKE_API_TOKEN -R $R
printf '%s' "<service_role key>"    | gh secret set SUPABASE_SERVICE_ROLE_KEY -R $R

gh secret list -R $R
```

| 이름 | 종류 | 설명 |
|---|---|---|
| `CLOUDIKE_API_BASE` | 변수 | GOV API 주소 `https://api.gov.cloudike.kr` |
| `SUPABASE_URL` | 변수 | Supabase Project URL |
| `CLOUDIKE_API_TOKEN` | 시크릿 | 백엔드 `analytics.api_token` 값 (GOV 환경) |
| `SUPABASE_SERVICE_ROLE_KEY` | 시크릿 | 수집기가 RLS를 우회해 쓰기 위한 키 |

## 4. 자동 수집

- 워크플로: `.github/workflows/collect.yml` ("주간 사용량 수집"). **매주 금요일 09:00 KST** (cron `0 0 * * 5`, UTC 기준).
- 대상 API: `https://api.gov.cloudike.kr/api/1/analytics/company_usage_summary/` (기업마다 `company_id`로 호출). 활성(`is_active`) 기업만 수집하며 기업당 최대 3회 재시도합니다.
- 결과는 `usage_weekly`에 `source = auto`로 upsert되고(같은 주차는 덮어씀), 실행 이력은 `usage_collection_runs`에 남습니다.
- 기업을 추가하면 다음 금요일부터 자동 수집됩니다. 즉시 수집하려면 수동 실행을 사용하세요.

수동 실행:

```bash
gh workflow run "주간 사용량 수집" -R Cloudike-Tech-Team/cloudike-usage-dashboard

# 특정 주 재수집: week_start 는 반드시 그 주의 월요일 날짜
gh workflow run "주간 사용량 수집" -R Cloudike-Tech-Team/cloudike-usage-dashboard -f week_start=2026-10-05
```
웹 UI에서는 레포 → **Actions → 주간 사용량 수집 → Run workflow**. `week_start`를 비우면 실행 시각(KST)이 속한 주가 대상입니다. 월요일이 아닌 날짜를 넣으면 종료 코드 2로 거부됩니다.

수집 상태와 종료 코드:

| 상태 | 의미 | 종료 코드 |
|---|---|---|
| `success` | 모든 활성 기업 수집 성공 | 0 |
| `partial` | 일부 기업 실패 (사유는 로그와 이력 `message`에 기록) | 0 (로그에 경고) |
| `failed` | 전부 실패, 또는 수집기 자체 오류 | 1 (Actions 잡 실패) |
| (설정 오류) | 환경변수 누락, `week_start`가 월요일이 아님 | 2 |

> **NRF-5058이 GOV에 배포되기 전에는** `company_usage_summary` 엔드포인트가 없어 모든 기업이 `기업 없음(404)`으로 실패하고 `failed`가 기록됩니다. 이 시점에는 정상 동작이며, 배포 후 수동 재실행하면 `success`로 바뀝니다.

## 5. 기능 요약

| 요구사항 | 화면 / 구현 |
|---|---|
| 모든 주차별 사용량 저장·조회 | **주차별 데이터** 탭: 기업·기간 필터, 표 조회 |
| 과거 데이터 추가·수정 | **주차별 데이터**의 "행 추가"(날짜 선택 → 그 주 월요일로 보정, 라벨 자동 채움), 행 수정·삭제. 저장하면 출처가 "수동"으로 바뀜 |
| 사용량·트래픽 자동 그래프 | **대시보드** 탭: "사용량(GB) 추이", "트래픽(GB) 추이". 주차가 쌓이면 자동으로 늘어남. 기업 다중 선택, 기간 12/26/52주/전체 |
| 기간별 자동 저장 | 금요일 자동 수집 (4절). 대시보드 "최근 자동 수집" 상자와 요약 카드("기업별 최신 주차 요약") |
| 기업 동적 추가 | **기업 관리** 탭: "기업 추가"(company_id, 표시 이름), 활성/비활성 전환, 삭제 |
| 전부 한글 | 모든 화면·오류 메시지 한글 |
| 스프레드시트 붙여넣기 | **붙여넣기 가져오기**: 기업 선택 → 붙여넣기 → 미리보기 → 가져오기 (7절) |
| 등록된 사용자만 접근 | Supabase Auth 이메일 로그인 + RLS (보안 모델 참고) |

## 6. 주차 규칙

- 한 주는 월요일 ~ 일요일(KST). 레코드의 키는 `week_start` = **그 주 월요일 날짜**이며, 주차 라벨(예: "2026년 10월 2주차")은 별도의 표시용 텍스트입니다. 붙여넣은 라벨은 원문 그대로 보존하고 화면에서 수정할 수 있습니다.
- **기록 날짜 → 주차**: 기록 날짜가 수~일요일이면 그 주의 월요일, **월·화요일이면 직전 주**의 월요일입니다(금요일 수집이 휴일 등으로 다음 주 초에 늦게 기록된 경우).
- **자동 생성 라벨(목요일 규칙)**: 그 주 목요일이 속한 연·월을 쓰고, 그 달의 몇 번째 목요일인지가 N입니다. 예: 2026-09-28 주 → "2026년 10월 1주차", 2026-10-05 주 → "2026년 10월 2주차". 자동 수집과 "행 추가"가 이 규칙을 씁니다.
- 자동 수집은 실행 시각(KST)이 속한 주의 월요일을 `week_start`로 씁니다. 같은 `(기업, 주차)`에 다시 쓰면 덮어씁니다.
- **단위**: 1024 기반(1 TB = 1024 GB). 사용량·트래픽은 항상 GB로 표시하고, 제공량은 1 TB(1024 GB) 이상이면 TB(예: "8 TB"), 미만이면 GB(예: "500 GB")로 표시합니다.

## 7. 붙여넣기 형식

스프레드시트에서 표를 복사해 **붙여넣기 가져오기**에 그대로 붙여넣습니다. 탭 구분이 기본이고, 탭이 없으면 공백 2칸 이상 구분도 허용합니다.

기본 열 순서 (헤더가 없을 때):

| 번호 | 주차 | 총 유저수 | 활성 유저수 | 사용량(GB) | 트래픽(GB) | 제공량(TB) | 기록 날짜 |
|---|---|---|---|---|---|---|---|
| 1 | 2026년 10월 2주차 | 120 | 98 | 1,234.5 | 56.7 | 8 | 2026. 10. 09 |

- **헤더는 선택**입니다. 첫 줄에 "주차"와 "유저/사용량/트래픽" 같은 단어가 있으면 헤더로 보고 열 위치를 헤더에서 읽습니다. 헤더가 없고 첫 칸이 주차 라벨이면 번호 열이 없는 표로 처리합니다. "번호"와 "기록 날짜"는 없어도 됩니다.
- 숫자의 천 단위 쉼표는 제거되고, `-`, 빈 값, `—`는 "없음"(null)으로 저장됩니다. 유저수는 정수여야 합니다.
- **제공량 단위**는 헤더로 정합니다. "제공량(GB)"면 GB, "제공량(TB)"이거나 헤더가 없으면 TB입니다.
- **주차 라벨**은 `2026년 10월 2주차` 형식이어야 합니다.
- **기록 날짜**는 `2026. 10. 09`, `2026-10-09`, `2026.10.9` 형식을 허용합니다. 있으면 6절의 규칙으로 주차를 정하고, 없으면 라벨을 목요일 규칙으로 되돌려 추정하며 미리보기에 경고를 표시합니다.
- 같은 주차가 입력 안에 중복되면 해당 행들이 오류로 표시됩니다. 미리보기에서 해석된 주차와 기간(월~일)을 눈으로 확인한 뒤 "가져오기"를 누르세요. 오류 행은 "오류 행은 건너뛰고 가져오기"를 체크해야 나머지만 저장됩니다.
- 가져온 행의 출처는 UI에 "가져오기"로 표시됩니다.

## 8. 테스트

```bash
npm test    # node --test test/*.test.js (Node 20 이상, 의존성 설치 불필요)
```
주차 계산, 단위 변환, 붙여넣기 파서, 차트 데이터 시리즈, 수집기(fetch 주입) 등 순수 로직을 검증합니다. push 시 `.github/workflows/test.yml`이 같은 테스트를 실행합니다.

## 9. 운영 메모

- **Supabase Free 플랜은 7일간 요청이 없으면 프로젝트가 일시정지**됩니다. 주간 수집이 매주 Supabase에 요청을 보내지만, 수집이 중단되면 일시정지될 수 있습니다. 정지되면 Dashboard에서 Restore하세요.
- **Actions의 cron은 정시에 시작되지 않고 몇 분~수십 분 지연될 수 있습니다.** 지연되어도 실행 시각(KST)이 속한 주 기준이라, 월요일 00:00을 넘기지 않는 한 같은 주차로 기록됩니다.
- 수집이 실패했는지는 대시보드의 **"최근 자동 수집"** 상자에서 확인합니다. 전부 실패하면 빨간 "실패" 배지, 일부만 실패하면 "일부 실패" 배지와 사유가 표시됩니다. 원인을 고친 뒤 4절의 수동 실행으로 재수집하세요.
- **공개 저장소는 60일간 저장소 활동이 없으면 GitHub가 예약(schedule) 워크플로를 자동으로 비활성화**합니다. 주기적으로 push하거나 수동 실행이 필요하며, 비활성화되었다면 Actions 탭에서 해당 워크플로의 "Enable workflow"를 눌러 다시 켜세요.
- 대시보드의 "최근 자동 수집"이 약 8일보다 오래됐다면 Actions 탭을 확인하세요.
- 기업을 삭제하면 해당 기업의 주차 데이터도 함께 삭제됩니다. 수집만 멈추려면 "비활성화"를 사용하세요.
- 회사 도메인 계정만 허용하려면 `supabase/schema.sql` 하단 주석의 조건식으로 정책을 바꾸세요.
