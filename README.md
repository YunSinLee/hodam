# 호담 (HODAM) — 오늘을 담은 잠자리 그림책

아이의 하루를 입력하고 첫 4쪽을 읽은 뒤, 행동을 선택하면 결말 4쪽이 이어지는 개인 맞춤형 그림책 서비스입니다. `/sample`에서는 로그인 없이 읽기 흐름을 체험할 수 있습니다.

## 🚀 시작하기

### 환경 설정

1. 환경변수 파일 생성

```bash
cp .env.example .env.local
```

2. 필요한 환경변수 설정

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
```

### Cursor MCP 설정 (선택사항)

AI 개발 도구인 Cursor에서 MCP 서버를 사용하려면:

#### Supabase MCP 설정

1. Supabase 대시보드에서 Personal Access Token 생성
2. `.cursor/mcp.json` 파일에 Supabase 설정 추가

#### Figma MCP 설정

1. Figma에서 Personal Access Token 생성:
   - Figma 설정 → Account → Personal Access Tokens
   - 새 토큰 생성 및 복사
2. `.cursor/mcp.json` 파일에 Figma 설정 추가

**전체 설정 예시:**

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@latest", "--access-token"],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "your_personal_access_token"
      }
    },
    "figma": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-figma"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "your_figma_access_token"
      }
    }
  }
}
```

⚠️ **보안 주의사항**: `.cursor/` 폴더는 `.gitignore`에 포함되어 있어 Git에 추적되지 않습니다.

## 🔒 보안 가이드라인

### 환경변수 관리

- 모든 API 키와 시크릿은 환경변수로 관리
- `.env.local` 파일은 절대 Git에 커밋하지 않음
- 프로덕션 환경에서는 플랫폼의 환경변수 설정 사용

### 파일 보안

- 실제 API 키가 포함된 파일은 `.gitignore`에 추가
- 하드코딩된 토큰이나 시크릿키 사용 금지
- 이미지나 미디어 파일의 서명된 URL 사용 시 주의

### 코드 검토

- 커밋 전 민감한 정보 노출 여부 확인
- `grep -r "sk_\|secret\|key\|token" .` 명령어로 정기 검사
- 문서 파일(.md)에서도 실제 키 노출 주의

## 📦 설치

```bash
npm ci
npm run dev
```

## 🛠️ 기술 스택

- **Frontend**: Next.js, React, TypeScript
- **Backend**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4o-mini
- **Styling**: Tailwind CSS
- **Development**: Cursor with MCP

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 있습니다.

## 개발 및 검증

Node.js 22.13 이상을 권장합니다. npm과 `package-lock.json`을 사용합니다.

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run start
```

로컬 PostgreSQL의 `initdb`, `pg_ctl`, `psql`이 있다면 `npm run test:db`로 권한 마이그레이션을 격리된 임시 DB에서 검증할 수 있습니다. 운영 Supabase에는 연결하지 않습니다.

## 그림책과 결제 설정

`.env.example`에 필요한 항목을 정리했습니다. OpenAI 키는 서버 환경변수 `OPENAI_API_KEY`로만 설정합니다. 기존 `OPEN_AI_API_KEY`도 호환되지만 공개 빌드 설정에 넣지 않습니다. 글 모델은 `OPENAI_STORY_MODEL`, 그림 모델은 `OPENAI_IMAGE_MODEL`로 설정합니다. 기본 그림 모델은 `gpt-image-2.5-flare`이며 1024×1024, low 품질을 사용합니다.

결제에는 `SUPABASE_SERVICE_ROLE_KEY`, `TOSS_PAYMENTS_SECRET_KEY`, `NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY`가 모두 필요합니다. 누락되면 결제 버튼을 활성화하지 않습니다. 해당 서버 코드와 `supabase/migrations/`의 회계·저장소 마이그레이션 두 개를 함께 반영해야 직접 DB 호출을 통한 임의 지급도 차단됩니다. OAuth 리다이렉트 허용 목록에는 배포 도메인의 `/auth/callback`과 사용 중인 로컬 주소를 등록합니다.

[전체 개선 기록과 운영 반영 항목](docs/2026-09-14-service-review.md)을 먼저 확인하세요. SQL은 자동으로 운영에 적용되지 않습니다.
