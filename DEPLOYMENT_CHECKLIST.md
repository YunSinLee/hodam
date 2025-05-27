# 🚀 프로덕션 배포 체크리스트

## OAuth 설정

### Supabase 설정

- [ ] 프로덕션 도메인으로 Site URL 업데이트
- [ ] Redirect URLs에 프로덕션 도메인 추가
  - `https://yourdomain.com/auth/callback`
- [ ] 개발 환경 URL 제거 (보안)

### Google OAuth

- [ ] Google Cloud Console에서 프로덕션 도메인 추가
- [ ] Authorized redirect URIs 업데이트
- [ ] OAuth consent screen 검토

### Kakao OAuth

- [ ] Kakao Developers에서 프로덕션 도메인 추가
- [ ] Redirect URI 업데이트
- [ ] 앱 심사 신청 (필요시)

## 환경변수 설정

### 필수 환경변수

```bash
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
OPENAI_API_KEY=your_openai_api_key
```

### 보안 체크

- [ ] 개발 환경 키 제거
- [ ] API 키 권한 최소화
- [ ] CORS 설정 확인

## 테스트

### 기능 테스트

- [ ] 구글 로그인/로그아웃
- [ ] 카카오 로그인/로그아웃
- [ ] 동화 생성 기능
- [ ] 곶감 시스템
- [ ] 이미지 생성

### 성능 테스트

- [ ] 페이지 로딩 속도
- [ ] 이미지 최적화
- [ ] API 응답 시간

### 브라우저 호환성

- [ ] Chrome, Safari, Firefox
- [ ] 모바일 브라우저
- [ ] 다양한 화면 크기

## 모니터링 설정

### 에러 추적

- [ ] Sentry 또는 유사 서비스 설정
- [ ] 로그 수집 시스템
- [ ] 알림 설정

### 분석

- [ ] Google Analytics 설정
- [ ] 사용자 행동 분석
- [ ] 성능 모니터링

## 법적 준수

### 개인정보보호

- [ ] 개인정보처리방침 최신화
- [ ] 쿠키 정책 확인
- [ ] GDPR 준수 (해외 서비스 시)

### 서비스 약관

- [ ] 이용약관 검토
- [ ] 사업자 정보 확인
- [ ] 고객센터 연락처

## 백업 및 복구

### 데이터베이스

- [ ] 자동 백업 설정
- [ ] 복구 절차 테스트
- [ ] 데이터 마이그레이션 계획

### 코드

- [ ] Git 태그 생성
- [ ] 릴리즈 노트 작성
- [ ] 롤백 계획
