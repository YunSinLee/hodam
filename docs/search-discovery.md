# 호담 검색 유입 운영

검색용 공개 콘텐츠와 개인 책장은 분리해서 운영한다. 공개 동화에는 아이의 실제 이름·사진·개인 책장 데이터를 재사용하지 않는다. 이 문서의 구현 상태는 검색엔진 등록·색인 완료를 의미하지 않는다.

## 공개 페이지

- `/bedtime-stories`: 로그인 없이 읽는 잠자리 동화 모음
- `/bedtime-stories/moonlit-rabbit`
- `/bedtime-stories/pinecone-promise`
- `/bedtime-stories/little-fox-crossing`
- `/ai-storybook`: AI 동화책 제작 소개와 만들기 진입

공개 페이지는 서버가 내보내는 HTML에 본문과 페이지별 제목·설명·canonical을 포함한다. 개별 동화의 원문과 삽화는 방문자가 완결된 이야기를 읽을 수 있도록 제공하고, 공개 샘플에서 개인 동화 만들기로 연결한다. 실제 서비스에 없는 기능이나 효과를 검색 문구에 약속하지 않는다.

원고는 `src/content/public-stories.ts`의 `PUBLIC_STORIES`에서 관리한다. 현재 공개 동화는 편당 본문 8개 단락과 대표 삽화 1장으로 구성한다. 계정에서 생성하는 8쪽·8장 삽화의 개인 그림책과 구분하며, 공개 페이지 열람에는 AI 생성·로그인·곶감 차감이 없다.

공개 삽화 3장은 imagegen으로 제작해 확인한 `public/stories/*.webp` 파일이다. 각 원고의 `imagePrompt`에 제작 프롬프트를 보관한다. 추가 제작 기록인 `reports/local/search-discovery/image-prompts.json`은 Git에서 제외되므로 배포나 새 체크아웃에 필요한 파일로 취급하지 않는다.

## 메타데이터와 주소

`src/lib/seo.ts`의 `createPublicMetadata({ title, description, path, image? })`를 사용한다. 제목에는 `| 호담`을 붙이지 않는다. root layout의 제목 템플릿이 붙이고, 공유 제목도 helper가 생성한다. `path`와 `image`에는 `/`로 시작하는 로컬 경로를 전달한다. 경로의 조회 매개변수와 fragment는 canonical에서 제외한다.

`config/site-url.js`를 metadata와 `next-sitemap.config.js`가 함께 사용한다. `NEXT_PUBLIC_SITE_URL`이 공개 HTTPS origin이면 사용하며, 값이 없거나 localhost·IP·내부 호스트·다른 Vercel preview 주소·하위 경로인 경우 `https://hodam.vercel.app`으로 돌아간다. 주소는 요청의 Host 헤더나 Vercel preview 환경변수에서 추론하지 않는다. 도메인을 이전할 때는 이 환경변수, 리다이렉트, OAuth 설정, 검색엔진 속성을 함께 확인한다.

JSON-LD를 `<script type="application/ld+json">`에 넣을 때는 `serializeJsonLd`를 사용한다. 이야기 제목에 `<`가 있더라도 script 요소를 닫을 수 없도록 직렬화한다. 구조화 데이터는 실제 화면에 있는 내용과 일치시킨다. 구조화 데이터를 넣었다고 특수 검색 결과가 보장되지는 않는다.

루트 layout에는 모든 페이지가 홈페이지 주소를 상속하지 않도록 canonical을 넣지 않는다. `/my-story`, `/service`, 로그인·계정·결제 페이지의 기존 `noindex` 설정과 사이트맵 제외 규칙을 유지한다. robots.txt의 차단만으로 개인정보 보호나 검색 삭제를 보장하지 않는다. 개인 데이터의 접근 권한 검증은 별개로 계속 적용한다.

## 사이트맵

`npm run build`의 `postbuild`가 `next-sitemap`과 정규화 스크립트를 실행해 `public/sitemap.xml`, `public/sitemap-0.xml`, `public/robots.txt`를 생성한다. 정적 공개 동화 페이지는 `generateStaticParams`로 빌드에 포함되어야 사이트맵에 나타난다. 날짜가 바뀔 때마다 의미 없는 수정일이 생성되지 않도록 `autoLastmod: false`를 유지한다.

배포 후 확인할 주소:

- [사이트맵 인덱스](https://hodam.vercel.app/sitemap.xml)
- [공개 URL 사이트맵](https://hodam.vercel.app/sitemap-0.xml)
- [robots.txt](https://hodam.vercel.app/robots.txt)

새 공개 페이지 5개가 사이트맵에 있고, 개인 책장과 로그인·결제 URL은 없는지 확인한다. 로그인하지 않은 상태에서 각 URL의 상태 코드가 200이며 HTML에 고유한 제목·설명·본문·canonical이 나오는지 확인한다. 존재하지 않는 동화 slug는 404여야 한다.

## 소유권 확인과 등록

Google Search Console과 네이버 서치어드바이저에서 `https://hodam.vercel.app` 속성의 기존 소유권 상태를 먼저 확인한다. 저장소에는 기존 Google HTML 인증 파일 `public/google3bfc19763798d3ea.html`이 있다. 파일이 있다는 사실만으로 현재 계정의 소유권이 검증되었다고 판단하지 않는다. 인증 파일은 삭제하지 않는다.

HTML 메타 태그 방식이 필요하면 콘솔이 발급한 **실제 content 값만** 아래 환경변수에 저장하고 다시 빌드·배포한다. 임의의 값이나 전체 `<meta>` 태그를 입력하지 않는다. 값이 없으면 해당 인증 태그를 출력하지 않는다.

| 환경변수 | 용도 |
| --- | --- |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Google Search Console의 HTML 태그 인증 값 |
| `NEXT_PUBLIC_NAVER_SITE_VERIFICATION` | 네이버 서치어드바이저의 HTML 태그 인증 값 |
| `NEXT_PUBLIC_GA_ID` | 선택 사항: 서비스 내 유입·행동 측정 |

이 인증 토큰은 공개 HTML에 노출되는 값이다. API 비밀키나 계정 비밀번호를 넣지 않는다. Vercel Production 환경에 설정한 뒤 재배포하고 실제 홈페이지 `<head>`에 태그가 나오는지 확인한다.

소유권 확인 후 Google에는 `/sitemap.xml`을 제출한다. 네이버에는 공개 URL이 들어 있는 `/sitemap-0.xml`을 제출한다. Google URL 검사와 네이버 웹페이지 수집 요청으로 공개 페이지를 확인한다. 요청 완료와 실제 색인은 구분해 기록한다. 콘솔 로그인이나 계정의 소유권 확인이 필요하면 그 단계만 운영자가 진행한다.

2026-09-14 배포 전 확인: Google Search Console에서 호담 속성이 이미 등록된 것을 확인했다. 기존 `/sitemap.xml`은 성공 상태였지만 마지막 읽은 날짜가 2025-06-15여서 신규 페이지 배포 후 재제출할 예정이다. 네이버는 최초 이용약관 동의 전 단계로 사이트 등록이 완료되지 않았다. 이 시점의 기존 색인·클릭 수치는 이번 변경의 성과가 아니다.

## 서비스 내 이벤트 측정

`src/lib/client/search-analytics.ts`는 `gtag`가 준비된 경우 아래 이벤트를 보낸다. 공개 페이지 본문과 상단 메뉴의 만들기 링크는 같은 출처를 사용한다.

| 이벤트 | 발생 조건 |
| --- | --- |
| `hodam_cta_click` | 공개 페이지에서 그림책 만들기 링크 클릭 |
| `hodam_generation_started` | 입력·인증 확인 후 새 생성 요청 시작. 같은 요청 재시도는 중복 시작으로 세지 않음 |
| `hodam_generation_completed` | 해당 요청의 책이 `complete`이고 본문 8쪽과 각 쪽의 삽화 URL이 모두 준비됨. 책장 화면에서 이어 완성해도 같은 탭 메모리가 유지되면 기록 |

`search_source` 값은 `bedtime`, `ai-maker`, 세 동화 slug 중 하나다. 검색엔진이나 검색어가 아니라 **마지막으로 만들기를 누른 공개 페이지**를 뜻한다. 같은 탭의 `sessionStorage`에 출처만 보관하고, 책과 요청의 연결은 메모리에만 둔다. 새로고침·탭 종료 시 완료가 누락될 수 있다. 이 세 이벤트에는 아이 이름·입력 본문·책 ID를 보내지 않고, URL·referrer도 중립적인 `/service` 주소와 빈 값으로 지정한다. 기존 GA의 자동 페이지 조회 수집과는 별개의 처리다.

운영 HTML에 기존 GA 태그가 포함된 것은 확인했지만, 새 이벤트가 GA 속성에 실제 수신되는지는 배포 후 별도로 확인한다. 이벤트 수신은 실시간 보고서 또는 설정한 DebugView에서 검사한다. `search_source`를 보고서에서 비교하려면 이벤트 범위의 맞춤 측정기준으로 등록한다. 태그 존재, 이벤트 수신, 분석 보고서 반영을 같은 완료 상태로 취급하지 않는다. [GA 이벤트 확인](https://developers.google.com/analytics/devguides/collection/ga4/events), [맞춤 측정기준 안내](https://support.google.com/analytics/answer/14240153?hl=ko).

## 첫 성과 점검

첫 확인은 색인 가능 상태와 사이트맵 처리 결과다. 이후 4~6주를 첫 성과 점검 주기로 삼되 검색 반영 기한으로 약속하지 않는다. 검색엔진이 노출·순위·반영 시점을 결정한다.

- 노출이 거의 없으면 수집·색인 상태와 검색 의도를 확인한다.
- 노출은 있는데 클릭이 적으면 실제 검색어와 페이지 제목·설명을 함께 살핀다.
- 샘플은 읽지만 만들기로 이어지지 않으면 샘플과 진입 버튼의 내용·위치를 살핀다.
- 만들기는 시작하지만 완성하지 못하면 로그인·이용권·생성 단계에서의 이탈을 확인한다.

검색 보고서의 노출·클릭과 서비스의 만들기 시작·완료는 서로 다른 지표다. 이용자의 동의 설정이나 분석 차단 등으로 집계가 누락될 수 있으며, 모든 생성이 특정 검색어에서 비롯되었다고 추정하지 않는다. 검색량은 예상 방문자 수나 고객 수가 아니다.

이번 배포 전 로컬 검증은 187개 파일·1,249개 테스트, ESLint, TypeScript, 프로덕션 빌드를 통과했다. 생성된 사이트맵에 신규 공개 URL 5개가 포함된 것도 확인했다. 이는 코드·로컬 결과이며 운영 페이지의 상태와 검색엔진 처리는 배포 후 다시 확인한다.

## 공식 참고 문서

- [Next.js Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Google 사이트맵 작성 및 제출](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google canonical URL 지정](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google Search Console 소유권 확인](https://support.google.com/webmasters/answer/9008080?hl=ko)
- [Google 재수집 요청](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)
- [네이버 사이트 등록 및 소유 확인](https://searchadvisor.naver.com/guide/faq-start-register)
- [네이버 콘텐츠 마크업](https://searchadvisor.naver.com/guide/markup-content)
- [네이버 선호 URL 및 로봇 메타 태그](https://searchadvisor.naver.com/guide/markup-structure)
