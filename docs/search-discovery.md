# 호담 검색 유입 운영

검색용 공개 콘텐츠와 개인 책장은 분리해서 운영한다. 공개 동화에는 아이의 실제 이름·사진·개인 책장 데이터를 재사용하지 않는다. 이 문서의 구현 상태는 검색엔진 등록·색인 완료를 의미하지 않는다.

## 공개 페이지

- `/bedtime-stories`: 로그인 없이 읽는 잠자리 동화 모음
- `/bedtime-stories/moonlit-rabbit`
- `/bedtime-stories/pinecone-promise`
- `/bedtime-stories/little-fox-crossing`
- `/ai-storybook`: AI 동화책 제작 소개와 만들기 진입

공개 페이지는 서버가 내보내는 HTML에 본문과 페이지별 제목·설명·canonical을 포함한다. 개별 동화의 원문과 삽화는 방문자가 완결된 이야기를 읽을 수 있도록 제공하고, 공개 샘플에서 개인 동화 만들기로 연결한다. 실제 서비스에 없는 기능이나 효과를 검색 문구에 약속하지 않는다.

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

## 첫 성과 점검

첫 확인은 색인 가능 상태와 사이트맵 처리 결과다. 이후 4~6주를 첫 성과 점검 주기로 삼되 검색 반영 기한으로 약속하지 않는다. 검색엔진이 노출·순위·반영 시점을 결정한다.

- 노출이 거의 없으면 수집·색인 상태와 검색 의도를 확인한다.
- 노출은 있는데 클릭이 적으면 실제 검색어와 페이지 제목·설명을 함께 살핀다.
- 샘플은 읽지만 만들기로 이어지지 않으면 샘플과 진입 버튼의 내용·위치를 살핀다.
- 만들기는 시작하지만 완성하지 못하면 로그인·이용권·생성 단계에서의 이탈을 확인한다.

검색 보고서의 노출·클릭과 서비스의 만들기 시작·완료는 서로 다른 지표다. 이용자의 동의 설정이나 분석 차단 등으로 집계가 누락될 수 있으며, 모든 생성이 특정 검색어에서 비롯되었다고 추정하지 않는다. 검색량은 예상 방문자 수나 고객 수가 아니다.

## 공식 참고 문서

- [Next.js Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Google 사이트맵 작성 및 제출](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google canonical URL 지정](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google Search Console 소유권 확인](https://support.google.com/webmasters/answer/9008080?hl=ko)
- [Google 재수집 요청](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)
- [네이버 사이트 등록 및 소유 확인](https://searchadvisor.naver.com/guide/faq-start-register)
- [네이버 콘텐츠 마크업](https://searchadvisor.naver.com/guide/markup-content)
- [네이버 선호 URL 및 로봇 메타 태그](https://searchadvisor.naver.com/guide/markup-structure)
